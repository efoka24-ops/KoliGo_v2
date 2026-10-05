<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Ctx;
use Koligo\Db;
use Koligo\Env;
use Koligo\Http;
use Koligo\HttpError;
use Koligo\Services\Accounts;

final class AuthController
{
    /** Colonnes modifiables par l'utilisateur sur son propre profil (liste blanche). */
    private const PROFILE_FIELDS = ['name', 'email', 'gender', 'shopName', 'language', 'theme', 'biometryEnabled', 'expoPushToken', 'cniNumber', 'quartier', 'isOnline'];

    public static function sendOtp(Ctx $c): array
    {
        return Accounts::sendOtp((string)$c->input('phone', ''), $c->input('email'), $c->input('name'));
    }

    public static function verifyOtp(Ctx $c): bool
    {
        $phone = (string)$c->input('phone', '');
        if ($phone === '' && $c->input('email')) {
            $u = Db::one('SELECT phone FROM `User` WHERE email = ? LIMIT 1', [(string)$c->input('email')]);
            if (!$u) {
                throw new HttpError('Email introuvable');
            }
            $phone = $u['phone'];
        }
        return Accounts::verifyOtp($phone, (string)$c->input('code', ''));
    }

    public static function signup(Ctx $c): array
    {
        return Accounts::signup($c->body());
    }

    public static function signin(Ctx $c): array
    {
        return Accounts::signin((string)($c->input('email') ?? $c->input('phone', '')), (string)$c->input('pin', ''));
    }

    public static function refresh(Ctx $c): array
    {
        return Accounts::refresh((string)$c->input('token', ''));
    }

    public static function switchRole(Ctx $c): array
    {
        return Accounts::switchRole($c->user['userId'], (string)$c->input('role', ''));
    }

    public static function forgotPin(Ctx $c): array
    {
        return Accounts::forgotPin((string)($c->input('email') ?? $c->input('phone', '')));
    }

    public static function resetPin(Ctx $c): array
    {
        return Accounts::resetPin((string)($c->input('email') ?? $c->input('phone', '')), (string)$c->input('otp', ''), (string)$c->input('newPin', ''));
    }

    public static function deviceSession(Ctx $c): array
    {
        return ['ok' => true];
    }

    public static function getProfile(Ctx $c): array
    {
        $u = Accounts::mustUser($c->user['userId']);
        return array_intersect_key($u, array_flip(['id', 'name', 'phone', 'activeRole', 'kycStatus', 'gender', 'shopName', 'language', 'theme']));
    }

    public static function updateProfile(Ctx $c): array
    {
        $data = array_intersect_key($c->body(), array_flip(self::PROFILE_FIELDS));
        foreach (['name', 'cniNumber', 'quartier', 'shopName'] as $k) {
            if (isset($data[$k]) && is_string($data[$k])) {
                $data[$k] = trim($data[$k]);
            }
        }
        if (isset($data['name']) && $data['name'] === '') {
            throw new HttpError('Nom invalide');
        }
        Db::update('User', $c->user['userId'], $data + ['updatedAt' => Db::now()]);
        $u = Accounts::mustUser($c->user['userId']);
        unset($u['pinHash']);
        return $u;
    }

    public static function stats(Ctx $c): array
    {
        $uid = $c->user['userId'];
        $today = gmdate('Y-m-d 00:00:00');
        $month = gmdate('Y-m-01 00:00:00');
        $wallet = Db::one('SELECT id, balanceXAF FROM `Wallet` WHERE userId = ?', [$uid]);
        $gains = $wallet
            ? (int)Db::val("SELECT COALESCE(SUM(amountXAF),0) FROM `Transaction` WHERE walletId = ? AND createdAt >= ? AND type = 'EARNING'", [$wallet['id'], $today])
            : 0;
        $courses = (int)Db::val("SELECT COUNT(*) FROM `Delivery` WHERE delivererId = ? AND status = 'LIVRE'", [$uid]);
        $totalMonth = (int)Db::val('SELECT COUNT(*) FROM `Delivery` WHERE (vendorId = ? OR delivererId = ?) AND createdAt >= ?', [$uid, $uid, $month]);
        $r = Db::one('SELECT AVG(score) AS a, COUNT(*) AS n FROM `Rating` WHERE toUserId = ?', [$uid]);
        $avg = $r && $r['a'] !== null ? round((float)$r['a'], 1) : null;
        return [
            'balance' => (int)($wallet['balanceXAF'] ?? 0),
            'gainsToday' => $gains,
            'courses' => $courses,
            'totalMonth' => $totalMonth,
            'note' => $avg,
            'ratingsCount' => (int)($r['n'] ?? 0),
        ];
    }

    public static function updatePaymentAccount(Ctx $c): array
    {
        $provider = (string)$c->input('provider', '');
        if (!in_array($provider, ['MTN', 'ORANGE'], true)) {
            throw new HttpError('Operateur invalide');
        }
        $w = Db::one('SELECT id FROM `Wallet` WHERE userId = ?', [$c->user['userId']]);
        if (!$w) {
            throw new HttpError('Portefeuille introuvable', 404);
        }
        Db::update('Wallet', $w['id'], ['paymentProvider' => $provider, 'paymentPhone' => $c->input('phone'), 'updatedAt' => Db::now()]);
        return Db::one('SELECT * FROM `Wallet` WHERE id = ?', [$w['id']]);
    }

    // ── KYC ──────────────────────────────────────────────────────────────────

    public static function submitKyc(Ctx $c): array
    {
        $uid = $c->user['userId'];
        $docs = [];

        if (!empty($_FILES)) {
            foreach (['idFront' => 'ID_FRONT', 'idBack' => 'ID_BACK', 'selfie' => 'SELFIE'] as $field => $type) {
                $f = $_FILES[$field] ?? null;
                if (!$f || $f['error'] !== UPLOAD_ERR_OK) {
                    continue;
                }
                $docs[] = ['type' => $type, 'filePath' => self::storeImage((string)file_get_contents($f['tmp_name']), $uid, $type)];
            }
        } else {
            $b = $c->body();
            foreach (['cniRecto' => 'ID_FRONT', 'cniVerso' => 'ID_BACK', 'selfie' => 'SELFIE'] as $field => $type) {
                if (!empty($b[$field]) && is_string($b[$field])) {
                    $raw = base64_decode((string)preg_replace('#^data:image/\w+;base64,#', '', $b[$field]), true);
                    if ($raw === false) {
                        throw new HttpError('Image invalide');
                    }
                    $docs[] = ['type' => $type, 'filePath' => self::storeImage($raw, $uid, $type)];
                }
            }
            if (!empty($b['cniNumber'])) {
                Db::update('User', $uid, ['cniNumber' => trim((string)$b['cniNumber']), 'updatedAt' => Db::now()]);
            }
        }

        foreach ($docs as $d) {
            Db::insert('KycDocument', ['id' => Db::id(), 'userId' => $uid, 'type' => $d['type'], 'filePath' => $d['filePath'], 'createdAt' => Db::now()]);
        }
        Db::update('User', $uid, ['kycStatus' => 'PENDING', 'updatedAt' => Db::now()]);
        return ['status' => 'PENDING'];
    }

    public static function uploadDir(): string
    {
        $dir = Env::get('UPLOAD_DIR') ?: dirname(__DIR__, 2) . '/storage/uploads';
        if (!is_dir($dir)) {
            mkdir($dir, 0750, true);
        }
        return $dir;
    }

    /** N'ecrit que de vraies images (JPEG/PNG), jamais un fichier arbitraire. */
    private static function storeImage(string $bytes, string $userId, string $type): string
    {
        if (strlen($bytes) > 8 * 1024 * 1024) {
            throw new HttpError('Image trop volumineuse');
        }
        $ext = match (true) {
            str_starts_with($bytes, "\xFF\xD8\xFF") => 'jpg',
            str_starts_with($bytes, "\x89PNG") => 'png',
            default => throw new HttpError('Format image invalide (JPEG ou PNG)'),
        };
        $path = self::uploadDir() . '/' . $userId . '_' . strtolower($type) . '_' . time() . '_' . bin2hex(random_bytes(3)) . '.' . $ext;
        file_put_contents($path, $bytes);
        return $path;
    }
}
