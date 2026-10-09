<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Ctx;
use Koligo\Db;
use Koligo\Env;
use Koligo\Http;
use Koligo\HttpError;
use Koligo\Services\Accounts;
use Koligo\Services\AdminLogin;
use Koligo\Services\Cgu;
use Koligo\Services\Deliveries;
use Koligo\Services\Kyc;
use Koligo\Services\Pricing;
use Koligo\Services\Uploads;

final class AuthController
{
    /** Colonnes modifiables par l'utilisateur sur son propre profil (liste blanche). */
    private const PROFILE_FIELDS = ['name', 'email', 'gender', 'shopName', 'language', 'theme', 'biometryEnabled', 'expoPushToken', 'cniNumber', 'quartier', 'isOnline', 'vehicleType', 'vehiclePlate'];

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

    public static function changePin(Ctx $c): array
    {
        return Accounts::changePin($c->user['userId'], (string)$c->input('currentPin', ''), (string)$c->input('newPin', ''));
    }

    public static function deviceSession(Ctx $c): array
    {
        return ['ok' => true];
    }

    public static function getProfile(Ctx $c): array
    {
        return self::profileOf(Accounts::mustUser($c->user['userId']));
    }

    /** Profil expose a l'app : le statut KYC est celui du role actif, avec le detail par role. */
    private static function profileOf(array $u): array
    {
        $out = array_intersect_key($u, array_flip(['id', 'name', 'phone', 'activeRole', 'gender', 'shopName', 'language', 'theme', 'vehicleType', 'vehiclePlate']));
        $byRole = Kyc::byRole($u);
        $out['kycStatus'] = $byRole[$u['activeRole']] ?? (string)$u['kycStatus'];
        $out['kycByRole'] = $byRole;
        $out['cguVersion'] = $u['cguVersion'] !== null ? (int)$u['cguVersion'] : null;
        $out['currentCguVersion'] = Cgu::latestVersion();
        $out['needsCgu'] = Cgu::needsAcceptance($u);
        $out['strikes'] = Deliveries::strikeInfo($u['id']);
        return $out;
    }

    /** POST /auth/admin/email/start {email, reset?} : etape 1 de la connexion du back-office. */
    public static function adminEmailStart(Ctx $c): array
    {
        return AdminLogin::start((string)$c->input('email', ''), (bool)$c->input('reset', false));
    }

    /** POST /auth/admin/change-password {password} : réservé à un administrateur connecté. */
    public static function adminChangePassword(Ctx $c): array
    {
        return AdminLogin::changePassword($c->user['userId'], (string)$c->input('password', ''));
    }

    public static function adminEmailVerify(Ctx $c): array
    {
        return AdminLogin::verifyCode((string)$c->input('email', ''), (string)$c->input('code', ''));
    }

    public static function adminEmailSetPassword(Ctx $c): array
    {
        return AdminLogin::setPassword((string)$c->input('setupToken', ''), (string)$c->input('password', ''));
    }

    public static function acceptCgu(Ctx $c): array
    {
        return Cgu::accept($c->user['userId'], (int)$c->input('version', 0));
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
        // L'e-mail sert d'identifiant de connexion : valide, et jamais partage entre deux comptes.
        if (array_key_exists('email', $data)) {
            $email = is_string($data['email']) ? trim($data['email']) : '';
            if ($email === '') {
                $data['email'] = null;
            } else {
                if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 191) {
                    throw new HttpError('Adresse e-mail invalide');
                }
                if (Db::one('SELECT id FROM `User` WHERE LOWER(email) = LOWER(?) AND id <> ?', [$email, $c->user['userId']])) {
                    throw new HttpError('Cette adresse e-mail est déjà utilisée par un autre compte');
                }
                $data['email'] = $email;
            }
        }
        if (isset($data['vehicleType']) && !isset(Pricing::VEHICLES[(string)$data['vehicleType']])) {
            throw new HttpError('Véhicule invalide');
        }
        if (array_key_exists('vehiclePlate', $data)) {
            $plate = strtoupper(trim((string)$data['vehiclePlate']));
            if ($plate !== '' && !preg_match('/^[A-Z0-9][A-Z0-9 \-]{2,18}[A-Z0-9]$/', $plate)) {
                throw new HttpError('Matricule invalide (lettres, chiffres et tirets, ex. LT-892-DA)');
            }
            $data['vehiclePlate'] = $plate !== '' ? $plate : null;
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
        // Taux d'acceptation : courses prises / (courses prises + offres refusees), sans saisie manuelle.
        $taken = (int)Db::val('SELECT COUNT(*) FROM `Delivery` WHERE delivererId = ?', [$uid]);
        $declined = (int)Db::val('SELECT COUNT(*) FROM `OfferDecline` WHERE userId = ?', [$uid]);
        $acceptation = $taken + $declined > 0 ? (int)round(100 * $taken / ($taken + $declined)) : null;
        return [
            'balance' => (int)($wallet['balanceXAF'] ?? 0),
            'gainsToday' => $gains,
            'courses' => $courses,
            'totalMonth' => $totalMonth,
            'note' => $avg,
            'ratingsCount' => (int)($r['n'] ?? 0),
            'acceptation' => $acceptation,
        ];
    }

    /** PATCH /user/payment-account {provider: MTN|ORANGE, phone: 6XXXXXXXX, name} : compte Mobile Money qui recoit les gains. */
    public static function updatePaymentAccount(Ctx $c): array
    {
        $provider = strtoupper((string)$c->input('provider', ''));
        if (!in_array($provider, ['MTN', 'ORANGE'], true)) {
            throw new HttpError('Operateur invalide');
        }
        $phone = preg_replace('/\D/', '', (string)$c->input('phone', '')) ?? '';
        if (str_starts_with($phone, '237') && strlen($phone) === 12) {
            $phone = substr($phone, 3);
        }
        if (!preg_match('/^6\d{8}$/', $phone)) {
            throw new HttpError('Numéro Mobile Money invalide (format : 6XXXXXXXX)');
        }
        $name = trim((string)$c->input('name', ''));
        if (mb_strlen($name) < 3 || mb_strlen($name) > 120) {
            throw new HttpError('Indiquez le nom du titulaire du compte');
        }
        $w = Db::one('SELECT id FROM `Wallet` WHERE userId = ?', [$c->user['userId']]);
        if (!$w) {
            throw new HttpError('Portefeuille introuvable', 404);
        }
        Db::update('Wallet', $w['id'], ['paymentProvider' => $provider, 'paymentPhone' => $phone, 'paymentName' => $name, 'updatedAt' => Db::now()]);
        return Db::one('SELECT paymentProvider, paymentPhone, paymentName FROM `Wallet` WHERE id = ?', [$w['id']]);
    }

    // ── KYC ──────────────────────────────────────────────────────────────────

    public static function submitKyc(Ctx $c): array
    {
        $uid = $c->user['userId'];
        $docs = [];
        // Un seul dossier par personne, valable pour les deux roles : valide ou en cours, il ne se renvoie pas.
        $me = Accounts::mustUser($uid);
        $role = $me['activeRole'];
        $current = Kyc::status($me);
        if (in_array($current, ['PENDING', 'VERIFIED'], true)) {
            throw new HttpError($current === 'VERIFIED' ? 'Votre KYC est déjà validé.' : 'Votre dossier est déjà en cours de vérification.', 409, 'KYC_ALREADY');
        }

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
            Db::insert('KycDocument', ['id' => Db::id(), 'userId' => $uid, 'type' => $d['type'], 'role' => $role, 'filePath' => $d['filePath'], 'createdAt' => Db::now()]);
        }
        Kyc::set($uid, 'PENDING');
        return ['status' => 'PENDING'];
    }

    public static function uploadDir(): string
    {
        return Uploads::dir();
    }

    private static function storeImage(string $bytes, string $userId, string $type): string
    {
        return Uploads::storeImage($bytes, $userId, $type);
    }
}
