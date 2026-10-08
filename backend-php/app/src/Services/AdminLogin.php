<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Auth;
use Koligo\Db;
use Koligo\HttpError;
use Koligo\Jwt;
use Koligo\RateLimit;

/**
 * Connexion du back-office par e-mail.
 *
 *  1. L'administrateur saisit son e-mail. Premiere fois (ou mot de passe oublie) : un code a 6 chiffres lui est
 *     envoye par e-mail ; l'e-mail seul ne suffit jamais a entrer.
 *  2. Le code valide, il cree son mot de passe (un PIN de 6 a 12 chiffres), qui remplace l'ancien.
 *  3. Ensuite : e-mail + mot de passe (POST /auth/signin avec l'e-mail).
 *
 * Reponses volontairement identiques que l'e-mail existe ou non : rien n'indique quel e-mail est administrateur.
 */
final class AdminLogin
{
    private const CODE_TTL = 600;
    private const CODE_MAX_ATTEMPTS = 5;
    private const SETUP_TTL = 600;

    /** Cle stockee dans OtpCode.phone (30 caracteres max) : jamais l'e-mail en clair. */
    private static function bucket(string $email): string
    {
        return 'adm:' . substr(md5(strtolower($email)), 0, 26);
    }

    private static function adminByEmail(string $email): ?array
    {
        $u = Db::one('SELECT * FROM `User` WHERE LOWER(email) = LOWER(?) LIMIT 1', [$email]);
        if (!$u || $u['activeRole'] !== 'ADMIN' || $u['isBlocked']) {
            return null;
        }
        return $u;
    }

    private static function cleanEmail(string $email): string
    {
        $email = trim($email);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 191) {
            throw new HttpError('Adresse e-mail invalide');
        }
        return $email;
    }

    /** @return array{step:string} 'password' si le mot de passe existe deja, sinon 'code' (code envoye) */
    public static function start(string $email, bool $reset): array
    {
        $email = self::cleanEmail($email);
        RateLimit::hit('admin-email:ip:' . RateLimit::ip(), 15, 600);
        RateLimit::hit('admin-email:' . strtolower($email), 5, 600);

        $u = self::adminByEmail($email);
        if ($u && !empty($u['adminPinSetAt']) && !$reset) {
            return ['step' => 'password'];
        }
        if ($u) {
            $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            Db::exec('UPDATE `OtpCode` SET used = 1 WHERE phone = ? AND used = 0', [self::bucket($email)]);
            Db::insert('OtpCode', [
                'id' => Db::id(), 'phone' => self::bucket($email), 'code' => $code,
                'expiresAt' => gmdate('Y-m-d H:i:s', time() + self::CODE_TTL), 'createdAt' => Db::now(),
            ]);
            Notify::email($email, '[KoliGo] Votre code de connexion au back-office',
                '<p>Votre code de connexion : <b style="font-size:24px;letter-spacing:4px">' . $code . '</b></p>'
                . '<p>Il est valable 10 minutes. Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message.</p>');
        }
        return ['step' => 'code'];
    }

    /** Verifie le code et renvoie un jeton de creation de mot de passe, valable 10 minutes. */
    public static function verifyCode(string $email, string $code): array
    {
        $email = self::cleanEmail($email);
        RateLimit::hit('admin-code:ip:' . RateLimit::ip(), 30, 600);
        $u = self::adminByEmail($email);
        $rec = Db::one(
            'SELECT * FROM `OtpCode` WHERE phone = ? AND used = 0 AND expiresAt > ? ORDER BY createdAt DESC LIMIT 1',
            [self::bucket($email), Db::now()]
        );
        if (!$u || !$rec) {
            throw new HttpError('Code expiré ou introuvable');
        }
        if ((int)$rec['attempts'] >= self::CODE_MAX_ATTEMPTS) {
            throw new HttpError('Trop d\'essais : demandez un nouveau code');
        }
        Db::exec('UPDATE `OtpCode` SET attempts = attempts + 1 WHERE id = ?', [$rec['id']]);
        if (!hash_equals((string)$rec['code'], preg_replace('/\D/', '', $code) ?? '')) {
            throw new HttpError('Code incorrect');
        }
        Db::exec('UPDATE `OtpCode` SET used = 1 WHERE id = ?', [$rec['id']]);
        return ['setupToken' => Jwt::sign(['userId' => $u['id'], 'type' => 'admin-setup'], Auth::accessSecret(), self::SETUP_TTL)];
    }

    private static function validatePassword(string $password): void
    {
        if (!preg_match('/^\d{6,12}$/', $password) || preg_match('/^(\d)\1+$/', $password)) {
            throw new HttpError('Le mot de passe doit contenir 6 à 12 chiffres, pas tous identiques');
        }
    }

    /** Un administrateur deja connecte change son mot de passe (sans passer par l'e-mail). */
    public static function changePassword(string $userId, string $password): array
    {
        self::validatePassword($password);
        $now = Db::now();
        Db::update('User', $userId, ['pinHash' => Accounts::hashPin($password), 'adminPinSetAt' => $now, 'updatedAt' => $now]);
        return ['ok' => true];
    }

    /** Enregistre le mot de passe et ouvre la session. */
    public static function setPassword(string $setupToken, string $password): array
    {
        try {
            $d = Jwt::verify($setupToken, Auth::accessSecret());
        } catch (\Throwable) {
            throw new HttpError('Session de création expirée : recommencez', 401);
        }
        if (($d['type'] ?? '') !== 'admin-setup') {
            throw new HttpError('Session de création invalide', 401);
        }
        self::validatePassword($password);
        $u = Db::one('SELECT * FROM `User` WHERE id = ?', [$d['userId'] ?? '']);
        if (!$u || $u['activeRole'] !== 'ADMIN' || $u['isBlocked']) {
            throw new HttpError('Compte introuvable', 404);
        }
        $now = Db::now();
        Db::update('User', $u['id'], ['pinHash' => Accounts::hashPin($password), 'adminPinSetAt' => $now, 'updatedAt' => $now]);
        return Accounts::issueTokens(Accounts::mustUser($u['id']));
    }
}
