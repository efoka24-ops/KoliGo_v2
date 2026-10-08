<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Auth;
use Koligo\Db;
use Koligo\Env;
use Koligo\HttpError;
use Koligo\RateLimit;

/** Comptes, OTP et sessions. */
final class Accounts
{
    private const OTP_TTL = 300;
    private const OTP_MAX_ATTEMPTS = 3;
    /** Roles qu'un utilisateur peut se donner lui-meme. ADMIN ne s'obtient que par un admin. */
    public const SELF_ROLES = ['VENDOR', 'DELIVERER'];

    public static function bcryptCost(): int
    {
        return (int)Env::get('BCRYPT_ROUNDS', '12');
    }

    public static function hashPin(string $pin): string
    {
        return password_hash($pin, PASSWORD_BCRYPT, ['cost' => self::bcryptCost()]);
    }

    public static function validatePin(string $pin): void
    {
        if (!preg_match('/^\d{4,6}$/', $pin)) {
            throw new HttpError('Le PIN doit contenir 4 a 6 chiffres', 400);
        }
    }

    public static function sendOtp(string $phone, ?string $email, ?string $name): array
    {
        if ($phone === '') {
            throw new HttpError('phone requis');
        }
        RateLimit::hit('otp-send:ip:' . RateLimit::ip(), 30, 600);
        RateLimit::hit('otp-send:' . $phone, 5, 600);

        $code = Auth::code4();
        Db::insert('OtpCode', [
            'id' => Db::id(), 'phone' => $phone, 'code' => $code,
            'expiresAt' => gmdate('Y-m-d H:i:s', time() + self::OTP_TTL), 'createdAt' => Db::now(),
        ]);
        $viaWhatsApp = Notify::otp($phone, $email, $code, $name);

        // Le code est renvoye au client pour que l'application le remplisse seule.
        // Contrepartie : l'OTP ne prouve plus que l'appelant controle ce numero.
        // OTP_RETURN_CODE=false retablit cette garantie.
        $out = ['sent' => true, 'whatsApp' => $viaWhatsApp];
        // Jamais pour un numero deja inscrit : reset-pin accepte ce meme code, donc
        // le renvoyer permettrait de reinitialiser le PIN (admin compris) de n'importe
        // quel compte connaissant son numero. Il ne sert qu'a l'inscription.
        $registered = (bool)Db::one('SELECT id FROM `User` WHERE phone = ?', [$phone]);
        if (Env::bool('OTP_RETURN_CODE', true) && !$registered) {
            $out['devCode'] = $code;
        }
        return $out;
    }

    public static function verifyOtp(string $phone, string $code): bool
    {
        RateLimit::hit('otp-verify:ip:' . RateLimit::ip(), 40, 600);
        $rec = Db::one(
            'SELECT * FROM `OtpCode` WHERE phone = ? AND used = 0 AND expiresAt > ? ORDER BY createdAt DESC LIMIT 1',
            [$phone, Db::now()]
        );
        if (!$rec) {
            throw new HttpError('OTP expired or not found');
        }
        if ((int)$rec['attempts'] >= self::OTP_MAX_ATTEMPTS) {
            throw new HttpError('Too many attempts');
        }
        Db::exec('UPDATE `OtpCode` SET attempts = attempts + 1 WHERE id = ?', [$rec['id']]);
        if (!hash_equals((string)$rec['code'], $code)) {
            throw new HttpError('Invalid OTP');
        }
        Db::exec('UPDATE `OtpCode` SET used = 1 WHERE id = ?', [$rec['id']]);
        return true;
    }

    public static function signup(array $p, bool $allowAdmin = false): array
    {
        $name = trim((string)($p['name'] ?? ''));
        $phone = trim((string)($p['phone'] ?? ''));
        $pin = (string)($p['pin'] ?? '');
        $role = (string)($p['role'] ?? '');
        if ($name === '' || $phone === '') {
            throw new HttpError('name et phone requis');
        }
        self::validatePin($pin);
        $allowed = $allowAdmin ? [...self::SELF_ROLES, 'ADMIN'] : self::SELF_ROLES;
        if (!in_array($role, $allowed, true)) {
            throw new HttpError('Role invalide');
        }
        if (Db::one('SELECT id FROM `User` WHERE phone = ?', [$phone])) {
            throw new HttpError('Numéro déjà enregistré');
        }

        $id = Db::id();
        $now = Db::now();
        $email = isset($p['email']) && $p['email'] !== '' ? (string)$p['email'] : null;
        Db::tx(function () use ($id, $now, $name, $phone, $email, $pin, $role, $p) {
            Db::insert('User', [
                'id' => $id, 'name' => $name, 'phone' => $phone, 'email' => $email,
                'gender' => $p['gender'] ?? null,
                'shopName' => isset($p['shopName']) && trim((string)$p['shopName']) !== '' ? trim((string)$p['shopName']) : null,
                'pinHash' => self::hashPin($pin),
                'roles' => json_encode([$role]), 'activeRole' => $role,
                'createdAt' => $now, 'updatedAt' => $now,
            ]);
            Db::insert('Wallet', ['id' => Db::id(), 'userId' => $id, 'balanceXAF' => 0, 'updatedAt' => $now]);
        });

        if ($email) {
            Notify::email($email, "Bienvenue sur KoliGo, $name !",
                '<p>Bonjour <b>' . htmlspecialchars($name) . '</b>, votre compte ' . ($role === 'DELIVERER' ? 'Livreur' : 'Vendeur') . ' est créé.</p>');
        }
        return self::issueTokens(Db::one('SELECT * FROM `User` WHERE id = ?', [$id]));
    }

    public static function signin(string $identifier, string $pin): array
    {
        $identifier = trim($identifier);
        if ($identifier === '' || $pin === '') {
            throw new HttpError('Identifiant introuvable');
        }
        $bucket = 'signin:' . strtolower($identifier);
        RateLimit::hit('signin:ip:' . RateLimit::ip(), 40, 600);
        RateLimit::hit($bucket, 8, 600);

        if (str_contains($identifier, '@')) {
            $user = Db::one('SELECT * FROM `User` WHERE email = ? LIMIT 1', [$identifier]);
        } else {
            $user = Db::one('SELECT * FROM `User` WHERE phone = ?', [$identifier]);
            if (!$user && !str_starts_with($identifier, '+')) {
                $user = Db::one('SELECT * FROM `User` WHERE phone = ?', ['+237' . $identifier]);
            }
            if (!$user && str_starts_with($identifier, '+237')) {
                $user = Db::one('SELECT * FROM `User` WHERE phone = ?', [substr($identifier, 4)]);
            }
        }
        if (!$user) {
            throw new HttpError('Identifiant introuvable');
        }
        if ($user['isBlocked']) {
            throw new HttpError('Compte bloqué');
        }
        if (!password_verify($pin, $user['pinHash'])) {
            throw new HttpError('PIN incorrect');
        }
        RateLimit::clear($bucket);
        return self::issueTokens($user);
    }

    public static function refresh(string $token): array
    {
        try {
            $payload = Auth::verifyRefresh($token);
        } catch (\Throwable $e) {
            throw new HttpError($e->getMessage(), 401);
        }
        $user = Db::one('SELECT * FROM `User` WHERE id = ?', [$payload['userId'] ?? '']);
        if (!$user || $user['isBlocked']) {
            throw new HttpError('Session invalide', 401);
        }
        return self::issueTokens($user);
    }

    public static function switchRole(string $userId, string $role): array
    {
        // Seuls VENDOR et DELIVERER sont permutables : sinon n'importe quel
        // utilisateur pourrait s'attribuer ADMIN.
        if (!in_array($role, self::SELF_ROLES, true)) {
            throw new HttpError('Role invalide');
        }
        $u = self::mustUser($userId);
        $roles = json_decode((string)$u['roles'], true);
        $roles = is_array($roles) ? $roles : [$u['activeRole']];
        if (!in_array($role, $roles, true)) {
            $roles[] = $role;
        }
        Db::update('User', $userId, ['activeRole' => $role, 'roles' => json_encode(array_values($roles)), 'updatedAt' => Db::now()]);
        return self::issueTokens(self::mustUser($userId));
    }

    public static function forgotPin(string $identifier): array
    {
        RateLimit::hit('forgot:ip:' . RateLimit::ip(), 15, 600);
        $isEmail = str_contains($identifier, '@');
        $user = $isEmail
            ? Db::one('SELECT * FROM `User` WHERE email = ? LIMIT 1', [$identifier])
            : Db::one('SELECT * FROM `User` WHERE phone = ?', [$identifier]);
        if (!$user) {
            throw new HttpError($isEmail ? 'Email introuvable' : 'Numéro introuvable');
        }
        $code = Auth::code4();
        Db::insert('OtpCode', [
            'id' => Db::id(), 'phone' => $user['phone'], 'code' => $code,
            'expiresAt' => gmdate('Y-m-d H:i:s', time() + self::OTP_TTL), 'createdAt' => Db::now(),
        ]);
        Notify::otp($user['phone'], $user['email'], $code, $user['name']);

        $dest = $user['email'] ?? '';
        [$u, $d] = array_pad(explode('@', $dest, 2), 2, '');
        return [
            'sent' => true,
            'emailHint' => $dest ? substr($u, 0, 2) . '***@' . $d : '',
            'phoneRef' => substr($user['phone'], 0, 3) . '***' . substr($user['phone'], -2),
            '_phone' => $user['phone'],
        ];
    }

    public static function resetPin(string $identifier, string $otp, string $newPin): array
    {
        self::validatePin($newPin);
        $phone = $identifier;
        if (str_contains($identifier, '@')) {
            $u = Db::one('SELECT phone FROM `User` WHERE email = ? LIMIT 1', [$identifier]);
            if (!$u) {
                throw new HttpError('Email introuvable');
            }
            $phone = $u['phone'];
        }
        self::verifyOtp($phone, $otp);
        Db::exec('UPDATE `User` SET pinHash = ?, updatedAt = ? WHERE phone = ?', [self::hashPin($newPin), Db::now(), $phone]);
        return ['reset' => true];
    }

    public static function mustUser(string $id): array
    {
        $u = Db::one('SELECT * FROM `User` WHERE id = ?', [$id]);
        if (!$u) {
            throw new HttpError('Utilisateur introuvable', 404);
        }
        return $u;
    }

    public static function issueTokens(array $u): array
    {
        $payload = ['userId' => $u['id'], 'phone' => $u['phone'], 'activeRole' => $u['activeRole']];
        $roles = json_decode((string)($u['roles'] ?? ''), true);
        return [
            'accessToken' => Auth::signAccess($payload),
            'refreshToken' => Auth::signRefresh($payload),
            'user' => [
                'id' => $u['id'], 'phone' => $u['phone'], 'name' => $u['name'] ?? '',
                'activeRole' => $u['activeRole'], 'roles' => is_array($roles) ? $roles : [$u['activeRole']],
                'kycStatus' => Kyc::status($u, (string)$u['activeRole']), 'kycByRole' => Kyc::byRole($u),
                'vehicleType' => $u['vehicleType'] ?? null, 'needsCgu' => Cgu::needsAcceptance($u), 'gender' => $u['gender'] ?? null, 'shopName' => $u['shopName'] ?? null,
            ],
        ];
    }
}
