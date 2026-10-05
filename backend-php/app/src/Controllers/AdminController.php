<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Ctx;
use Koligo\Db;
use Koligo\Http;
use Koligo\HttpError;
use Koligo\Rel;
use Koligo\Services\Accounts;
use Koligo\Services\Invoices;

/** Back-office : toutes les routes exigent un JWT avec le role ADMIN (cf. routes.php). */
final class AdminController
{
    private const SITE_CONTENT_KEY = 'site_content_json';
    private const DEFAULT_SITE_CONTENT = [
        'heroTitle' => 'Livraison rapide et fiable',
        'heroSubtitle' => 'KoliGo simplifie vos envois dans toute la ville.',
        'aboutTitle' => 'A propos de nous',
        'aboutText' => 'Nous aidons les vendeurs et livreurs a travailler plus vite avec une logistique moderne.',
        'team' => [
            ['name' => 'Marie N.', 'role' => 'Operations', 'bio' => 'Coordonne le reseau de livraison.'],
            ['name' => 'Joel T.', 'role' => 'Produit', 'bio' => 'Ameliore l experience client.'],
        ],
        'news' => [['title' => 'Ouverture de nouvelles zones', 'summary' => 'De nouveaux quartiers sont maintenant couverts.']],
    ];

    private static function page(int $size): array
    {
        $p = max(1, (int)($_GET['page'] ?? 1));
        return [$size, ($p - 1) * $size];
    }

    private static function q(): ?string
    {
        $q = $_GET['q'] ?? null;
        return is_string($q) && $q !== '' ? $q : null;
    }

    public static function stats(Ctx $c): array
    {
        $ago30 = gmdate('Y-m-d H:i:s', time() - 30 * 86400);
        $recent = Db::all('SELECT priceXAF, commissionXAF, createdAt, status FROM `Delivery` WHERE createdAt >= ?', [$ago30]);
        $livrees = array_filter($recent, fn($d) => $d['status'] === 'LIVRE');

        $days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        $trend = [];
        $start0 = time() - 7 * 86400;
        for ($i = 0; $i < 7; $i++) {
            $s = $start0 + $i * 86400;
            $e = $s + 86400;
            $bucket = array_filter($recent, function ($d) use ($s, $e) {
                $t = strtotime($d['createdAt'] . ' UTC');
                return $t >= $s && $t < $e;
            });
            $trend[] = [
                'day' => $days[(int)gmdate('w', $s)],
                'gmv' => array_sum(array_column(array_filter($bucket, fn($d) => $d['status'] === 'LIVRE'), 'priceXAF')),
                'count' => count($bucket),
            ];
        }
        $breakdown = [];
        foreach (Db::all('SELECT status, COUNT(*) AS n FROM `Delivery` GROUP BY status') as $g) {
            $breakdown[$g['status']] = (int)$g['n'];
        }
        return [
            'users' => (int)Db::val('SELECT COUNT(*) FROM `User`'),
            'deliveries' => (int)Db::val('SELECT COUNT(*) FROM `Delivery`'),
            'deliveries30d' => count($recent),
            'pendingKyc' => (int)Db::val("SELECT COUNT(*) FROM `User` WHERE kycStatus = 'PENDING'"),
            'activeDeliveries' => $breakdown['EN_ATTENTE'] ?? 0,
            'activeDeliverers' => (int)Db::val("SELECT COUNT(*) FROM `User` WHERE isOnline = 1 AND roles LIKE '%DELIVERER%'"),
            'gmv30d' => array_sum(array_column($livrees, 'priceXAF')),
            'commission30d' => array_sum(array_column($livrees, 'commissionXAF')),
            'trend' => $trend,
            'statusBreakdown' => (object)$breakdown,
        ];
    }

    public static function listUsers(Ctx $c): array
    {
        [$take, $skip] = self::page(25);
        $where = '1=1';
        $args = [];
        if ($q = self::q()) {
            $where .= " AND (name LIKE ? ESCAPE '!' OR phone LIKE ? ESCAPE '!')";
            $args[] = $args[] = Db::like($q);
        }
        if (!empty($_GET['role']) && is_string($_GET['role'])) {
            $where .= " AND roles LIKE ? ESCAPE '!'";
            $args[] = Db::like($_GET['role']);
        }
        $items = Db::all(
            "SELECT id, name, phone, email, activeRole, roles, kycStatus, isBlocked, isOnline, createdAt FROM `User` WHERE $where ORDER BY createdAt DESC LIMIT $take OFFSET $skip",
            $args
        );
        foreach ($items as &$u) {
            $u['_count'] = [
                'vendorDeliveries' => (int)Db::val('SELECT COUNT(*) FROM `Delivery` WHERE vendorId = ?', [$u['id']]),
                'delivererDeliveries' => (int)Db::val('SELECT COUNT(*) FROM `Delivery` WHERE delivererId = ?', [$u['id']]),
            ];
        }
        return ['items' => $items, 'total' => (int)Db::val("SELECT COUNT(*) FROM `User` WHERE $where", $args)];
    }

    public static function getUser(Ctx $c): array
    {
        $u = Accounts::mustUser($c->param('id'));
        unset($u['pinHash']);
        $u['kycDocuments'] = Db::all('SELECT * FROM `KycDocument` WHERE userId = ?', [$u['id']]);
        $u['wallet'] = Db::one('SELECT * FROM `Wallet` WHERE userId = ?', [$u['id']]);
        return $u;
    }

    public static function blockUser(Ctx $c): array
    {
        $u = Accounts::mustUser($c->param('id'));
        Db::update('User', $u['id'], ['isBlocked' => (bool)$c->input('blocked'), 'updatedAt' => Db::now()]);
        return self::publicUser($u['id']);
    }

    public static function reviewKyc(Ctx $c): array
    {
        $status = (string)$c->input('status', '');
        if (!in_array($status, ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'], true)) {
            throw new HttpError('Statut KYC invalide');
        }
        $u = Accounts::mustUser($c->param('id'));
        Db::update('User', $u['id'], [
            'kycStatus' => $status,
            'kycRejectionReason' => $status === 'REJECTED' ? ($c->input('reason') ?: null) : null,
            'updatedAt' => Db::now(),
        ]);
        return self::publicUser($u['id']);
    }

    private static function publicUser(string $id): array
    {
        $u = Accounts::mustUser($id);
        unset($u['pinHash']);
        return $u;
    }

    public static function serveKycDoc(Ctx $c): void
    {
        $doc = Db::one('SELECT * FROM `KycDocument` WHERE id = ?', [$c->param('docId')]);
        $real = $doc ? realpath($doc['filePath']) : false;
        $root = realpath(AuthController::uploadDir());
        // Le chemin vient de la base : on verifie qu'il reste dans le dossier d'uploads.
        if (!$doc || !$real || !$root || !str_starts_with($real, $root) || !is_file($real)) {
            Http::json(['error' => 'Document not found'], 404);
        }
        header('Content-Type: ' . (strtolower(pathinfo($real, PATHINFO_EXTENSION)) === 'png' ? 'image/png' : 'image/jpeg'));
        header('Cache-Control: private, max-age=3600');
        header('X-Content-Type-Options: nosniff');
        readfile($real);
        exit;
    }

    public static function listDeliveries(Ctx $c): array
    {
        [$take, $skip] = self::page(25);
        $where = '1=1';
        $args = [];
        if (!empty($_GET['status']) && is_string($_GET['status'])) {
            $where .= ' AND status = ?';
            $args[] = $_GET['status'];
        }
        $items = Db::all("SELECT * FROM `Delivery` WHERE $where ORDER BY createdAt DESC LIMIT $take OFFSET $skip", $args);
        $items = Rel::user($items, 'vendorId', 'vendor', ['name', 'phone']);
        $items = Rel::user($items, 'delivererId', 'deliverer', ['name', 'phone']);
        return ['items' => $items, 'total' => (int)Db::val("SELECT COUNT(*) FROM `Delivery` WHERE $where", $args)];
    }

    public static function cancelDelivery(Ctx $c): array
    {
        $id = $c->param('id');
        $now = Db::now();
        if (Db::exec("UPDATE `Delivery` SET status = 'ANNULE', updatedAt = ? WHERE id = ?", [$now, $id]) !== 1) {
            throw new HttpError('Livraison introuvable', 404);
        }
        Db::exec('UPDATE `EscrowEntry` SET releasedAt = ? WHERE deliveryId = ? AND releasedAt IS NULL', [$now, $id]);
        return Db::one('SELECT * FROM `Delivery` WHERE id = ?', [$id]);
    }

    public static function finance(Ctx $c): array
    {
        $txs = Db::all('SELECT * FROM `Transaction` ORDER BY createdAt DESC LIMIT 20');
        $txs = self::withWalletUser($txs);
        $pending = self::withWalletUser(Db::all("SELECT * FROM `Withdrawal` WHERE status = 'PENDING' ORDER BY createdAt DESC"));
        return [
            // La commission de la plateforme = somme des commissions des livraisons livrees.
            'platformBalance' => (int)Db::val("SELECT COALESCE(SUM(commissionXAF),0) FROM `Delivery` WHERE status = 'LIVRE'"),
            'totalWallets' => (int)Db::val('SELECT COALESCE(SUM(balanceXAF),0) FROM `Wallet`'),
            'pendingCount' => count($pending),
            'pendingAmount' => array_sum(array_column($pending, 'amountXAF')),
            'transactions' => $txs,
            'pendingWithdrawals' => $pending,
        ];
    }

    /** Ajoute wallet.user{name,phone} comme le faisait l'include Prisma. */
    private static function withWalletUser(array $rows): array
    {
        $rows = Rel::one($rows, 'walletId', '_wallet', 'Wallet', ['userId']);
        foreach ($rows as &$r) {
            $u = $r['_wallet'] ? Db::one('SELECT name, phone FROM `User` WHERE id = ?', [$r['_wallet']['userId']]) : null;
            $r['wallet'] = ['user' => $u];
            unset($r['_wallet']);
        }
        return $rows;
    }

    public static function payWithdrawal(Ctx $c): array
    {
        $id = $c->param('id');
        if (Db::exec("UPDATE `Withdrawal` SET status = 'SUCCESS' WHERE id = ? AND status = 'PENDING'", [$id]) !== 1) {
            throw new HttpError('Retrait introuvable ou deja traite');
        }
        return Db::one('SELECT * FROM `Withdrawal` WHERE id = ?', [$id]);
    }

    public static function getSettings(Ctx $c): array
    {
        return Db::all('SELECT * FROM `PlatformSetting`');
    }

    public static function updateSetting(Ctx $c): array
    {
        $key = (string)$c->input('key', '');
        if ($key === '') {
            throw new HttpError('key requis');
        }
        self::putSetting($key, (string)$c->input('value', ''));
        return Db::one('SELECT * FROM `PlatformSetting` WHERE `key` = ?', [$key]);
    }

    private static function putSetting(string $key, string $value): void
    {
        $now = Db::now();
        if (Db::exec('UPDATE `PlatformSetting` SET `value` = ?, updatedAt = ? WHERE `key` = ?', [$value, $now, $key]) === 0
            && !Db::one('SELECT `key` FROM `PlatformSetting` WHERE `key` = ?', [$key])) {
            Db::exec('INSERT INTO `PlatformSetting` (`key`, `value`, updatedAt) VALUES (?, ?, ?)', [$key, $value, $now]);
        }
    }

    private static function siteContent(): array
    {
        $raw = Db::val('SELECT `value` FROM `PlatformSetting` WHERE `key` = ?', [self::SITE_CONTENT_KEY]);
        $saved = $raw ? json_decode((string)$raw, true) : null;
        return is_array($saved) ? array_merge(self::DEFAULT_SITE_CONTENT, $saved) : self::DEFAULT_SITE_CONTENT;
    }

    public static function getSiteContent(Ctx $c): array
    {
        return self::siteContent();
    }

    public static function updateSiteContent(Ctx $c): array
    {
        $p = $c->body();
        $base = self::siteContent();
        $merged = array_merge($base, $p);
        $merged['team'] = isset($p['team']) && is_array($p['team']) ? $p['team'] : $base['team'];
        $merged['news'] = isset($p['news']) && is_array($p['news']) ? $p['news'] : $base['news'];
        self::putSetting(self::SITE_CONTENT_KEY, json_encode($merged, JSON_UNESCAPED_UNICODE));
        return $merged;
    }

    // ── Villes et quartiers ──────────────────────────────────────────────────

    public static function listCities(Ctx $c): array
    {
        $rows = Db::all('SELECT * FROM `City` ORDER BY region ASC, name ASC');
        if (($_GET['withCount'] ?? '') === 'true') {
            foreach ($rows as &$r) {
                $r['_count'] = ['neighborhoods' => (int)Db::val('SELECT COUNT(*) FROM `Neighborhood` WHERE cityId = ?', [$r['id']])];
            }
        }
        return $rows;
    }

    public static function createCity(Ctx $c): array
    {
        $name = trim((string)$c->input('name', ''));
        $region = trim((string)$c->input('region', ''));
        if ($name === '' || $region === '') {
            throw new HttpError('name et region requis');
        }
        $id = Db::id();
        Db::insert('City', ['id' => $id, 'name' => $name, 'region' => $region, 'createdAt' => Db::now()]);
        return Db::one('SELECT * FROM `City` WHERE id = ?', [$id]);
    }

    public static function updateCity(Ctx $c): array
    {
        $id = $c->param('id');
        $b = $c->body();
        $data = [];
        foreach (['name', 'region'] as $k) {
            if (!empty($b[$k])) {
                $data[$k] = $b[$k];
            }
        }
        if (array_key_exists('isActive', $b)) {
            $data['isActive'] = (bool)$b['isActive'];
        }
        Db::update('City', $id, $data);
        $row = Db::one('SELECT * FROM `City` WHERE id = ?', [$id]);
        if (!$row) {
            throw new HttpError('Ville introuvable', 404);
        }
        return $row;
    }

    public static function deleteCity(Ctx $c): array
    {
        $id = $c->param('id');
        $row = Db::one('SELECT * FROM `City` WHERE id = ?', [$id]);
        if (!$row) {
            throw new HttpError('Ville introuvable', 404);
        }
        Db::tx(function () use ($id) {
            Db::exec('DELETE FROM `Neighborhood` WHERE cityId = ?', [$id]);
            Db::exec('DELETE FROM `City` WHERE id = ?', [$id]);
        });
        return $row;
    }

    public static function listNeighborhoods(Ctx $c): array
    {
        return Db::all('SELECT * FROM `Neighborhood` WHERE cityId = ? ORDER BY name ASC', [$c->param('cityId')]);
    }

    public static function createNeighborhood(Ctx $c): array
    {
        $name = trim((string)$c->input('name', ''));
        if ($name === '') {
            throw new HttpError('name requis');
        }
        $id = Db::id();
        Db::insert('Neighborhood', [
            'id' => $id, 'name' => $name, 'cityId' => $c->param('cityId'),
            'latitude' => $c->input('latitude'), 'longitude' => $c->input('longitude'), 'createdAt' => Db::now(),
        ]);
        return Db::one('SELECT * FROM `Neighborhood` WHERE id = ?', [$id]);
    }

    public static function updateNeighborhood(Ctx $c): array
    {
        $id = $c->param('id');
        $b = $c->body();
        $data = [];
        if (!empty($b['name'])) {
            $data['name'] = $b['name'];
        }
        foreach (['latitude', 'longitude'] as $k) {
            if (array_key_exists($k, $b)) {
                $data[$k] = $b[$k];
            }
        }
        if (array_key_exists('isActive', $b)) {
            $data['isActive'] = (bool)$b['isActive'];
        }
        Db::update('Neighborhood', $id, $data);
        $row = Db::one('SELECT * FROM `Neighborhood` WHERE id = ?', [$id]);
        if (!$row) {
            throw new HttpError('Quartier introuvable', 404);
        }
        return $row;
    }

    public static function deleteNeighborhood(Ctx $c): array
    {
        $row = Db::one('SELECT * FROM `Neighborhood` WHERE id = ?', [$c->param('id')]);
        if (!$row) {
            throw new HttpError('Quartier introuvable', 404);
        }
        Db::exec('DELETE FROM `Neighborhood` WHERE id = ?', [$row['id']]);
        return $row;
    }

    // ── Support ──────────────────────────────────────────────────────────────

    public static function listIssues(Ctx $c): array
    {
        [$take, $skip] = [30, (max(1, (int)($_GET['page'] ?? 1)) - 1) * 30];
        $where = '1=1';
        $args = [];
        $st = $_GET['status'] ?? '';
        if (is_string($st) && $st !== '' && $st !== 'all') {
            $where .= ' AND status = ?';
            $args[] = strtoupper($st);
        }
        $items = Db::all("SELECT * FROM `Issue` WHERE $where ORDER BY createdAt DESC LIMIT $take OFFSET $skip", $args);
        $items = Rel::user($items, 'userId', 'user', ['name', 'phone']);
        $items = Rel::delivery($items, 'delivery', ['pickupAddress', 'dropoffAddress', 'priceXAF']);
        return ['items' => $items, 'total' => (int)Db::val("SELECT COUNT(*) FROM `Issue` WHERE $where", $args)];
    }

    public static function resolveIssue(Ctx $c): array
    {
        $status = (string)$c->input('status', 'RESOLVED');
        if (!in_array($status, ['OPEN', 'IN_PROGRESS', 'RESOLVED'], true)) {
            throw new HttpError('Statut invalide');
        }
        if (Db::exec('UPDATE `Issue` SET status = ? WHERE id = ?', [$status, $c->param('id')]) === 0 && !Db::one('SELECT id FROM `Issue` WHERE id = ?', [$c->param('id')])) {
            throw new HttpError('Incident introuvable', 404);
        }
        return Db::one('SELECT * FROM `Issue` WHERE id = ?', [$c->param('id')]);
    }

    public static function listPackages(Ctx $c): array
    {
        [$take, $skip] = self::page(25);
        $where = '1=1';
        $args = [];
        if (!empty($_GET['status']) && is_string($_GET['status'])) {
            $where .= ' AND status = ?';
            $args[] = $_GET['status'];
        }
        if ($q = self::q()) {
            $where .= " AND (pickupAddress LIKE ? ESCAPE '!' OR dropoffAddress LIKE ? ESCAPE '!' OR description LIKE ? ESCAPE '!')";
            array_push($args, Db::like($q), Db::like($q), Db::like($q));
        }
        $items = Db::all("SELECT * FROM `Delivery` WHERE $where ORDER BY createdAt DESC LIMIT $take OFFSET $skip", $args);
        $items = Rel::user($items, 'vendorId', 'vendor', ['name', 'phone', 'email']);
        $items = Rel::user($items, 'delivererId', 'deliverer', ['name', 'phone']);
        foreach ($items as &$d) {
            $d['locations'] = Db::all('SELECT * FROM `GpsLocation` WHERE deliveryId = ? ORDER BY createdAt ASC LIMIT 50', [$d['id']]);
        }
        return ['items' => $items, 'total' => (int)Db::val("SELECT COUNT(*) FROM `Delivery` WHERE $where", $args)];
    }

    public static function getPackage(Ctx $c): array
    {
        $d = Db::one('SELECT * FROM `Delivery` WHERE id = ?', [$c->param('id')]);
        if (!$d) {
            throw new HttpError('Livraison introuvable', 404);
        }
        $d = Rel::user([$d], 'vendorId', 'vendor', ['id', 'name', 'phone', 'email'])[0];
        $d = Rel::user([$d], 'delivererId', 'deliverer', ['id', 'name', 'phone'])[0];
        $d['locations'] = Db::all('SELECT * FROM `GpsLocation` WHERE deliveryId = ? ORDER BY createdAt ASC', [$d['id']]);
        $d['ratings'] = Db::all('SELECT * FROM `Rating` WHERE deliveryId = ?', [$d['id']]);
        $d['issues'] = Rel::user(Db::all('SELECT * FROM `Issue` WHERE deliveryId = ?', [$d['id']]), 'userId', 'user', ['name', 'phone']);
        $d['escrow'] = Db::one('SELECT * FROM `EscrowEntry` WHERE deliveryId = ?', [$d['id']]);
        return $d;
    }

    /** GET /admin/invoices — livraisons avec leurs factures disponibles (par defaut : livrees). */
    public static function listInvoices(Ctx $c): array
    {
        [$take, $skip] = self::page(25);
        $status = $_GET['status'] ?? 'LIVRE';
        $where = '1=1';
        $args = [];
        if (is_string($status) && $status !== '' && $status !== 'all') {
            $where .= ' AND status = ?';
            $args[] = $status;
        }
        if ($q = self::q()) {
            $where .= " AND (id LIKE ? ESCAPE '!' OR pickupAddress LIKE ? ESCAPE '!' OR dropoffAddress LIKE ? ESCAPE '!' OR shopName LIKE ? ESCAPE '!' OR recipientName LIKE ? ESCAPE '!')";
            array_push($args, Db::like($q), Db::like($q), Db::like($q), Db::like($q), Db::like($q));
        }
        $items = Db::all("SELECT * FROM `Delivery` WHERE $where ORDER BY createdAt DESC LIMIT $take OFFSET $skip", $args);
        $items = Rel::user($items, 'vendorId', 'vendor', ['name', 'phone']);
        $items = Rel::user($items, 'delivererId', 'deliverer', ['name', 'phone']);
        foreach ($items as &$d) {
            $d['ref'] = strtoupper(substr($d['id'], -8));
            $d['invoices'] = (object)Invoices::available($d);
            unset($d['collectCode'], $d['deliverCode'], $d['clientToken']);
        }
        return ['items' => $items, 'total' => (int)Db::val("SELECT COUNT(*) FROM `Delivery` WHERE $where", $args)];
    }

    /** GET /admin/invoices/:id/:type */
    public static function getInvoice(Ctx $c): array
    {
        return Invoices::build($c->param('id'), $c->param('type'));
    }

    public static function listWallets(Ctx $c): array
    {
        [$take, $skip] = self::page(25);
        $join = 'FROM `Wallet` w JOIN `User` u ON u.id = w.userId';
        $where = '1=1';
        $args = [];
        if ($q = self::q()) {
            $where .= " AND (u.name LIKE ? ESCAPE '!' OR u.phone LIKE ? ESCAPE '!')";
            array_push($args, Db::like($q), Db::like($q));
        }
        $items = Db::all("SELECT w.* $join WHERE $where ORDER BY w.balanceXAF DESC LIMIT $take OFFSET $skip", $args);
        $items = Rel::user($items, 'userId', 'user', ['id', 'name', 'phone', 'activeRole']);
        foreach ($items as &$w) {
            $w['transactions'] = Db::all('SELECT * FROM `Transaction` WHERE walletId = ? ORDER BY createdAt DESC LIMIT 5', [$w['id']]);
            $w['withdrawals'] = Db::all("SELECT * FROM `Withdrawal` WHERE walletId = ? AND status = 'PENDING' ORDER BY createdAt DESC LIMIT 3", [$w['id']]);
        }
        return [
            'items' => $items,
            'total' => (int)Db::val("SELECT COUNT(*) $join WHERE $where", $args),
            'totalBalance' => (int)Db::val('SELECT COALESCE(SUM(balanceXAF),0) FROM `Wallet`'),
        ];
    }

    public static function securityEvents(Ctx $c): array
    {
        $skip = (max(1, (int)($_GET['page'] ?? 1)) - 1) * 50;
        // Les codes OTP ne sont jamais renvoyes en clair, meme a un admin.
        $otps = Db::all("SELECT id, phone, attempts, expiresAt, used, createdAt FROM `OtpCode` ORDER BY createdAt DESC LIMIT 50 OFFSET $skip");
        $kyc = Db::all("SELECT id, name, phone, kycStatus, createdAt FROM `User` WHERE kycStatus IN ('PENDING','REJECTED') ORDER BY createdAt DESC");
        foreach ($kyc as &$u) {
            $u['kycDocuments'] = Db::all('SELECT type, createdAt FROM `KycDocument` WHERE userId = ?', [$u['id']]);
        }
        return ['otps' => $otps, 'kycUsers' => $kyc];
    }

    public static function createUser(Ctx $c): array
    {
        foreach (['name', 'phone', 'pin', 'role'] as $k) {
            if (!$c->input($k)) {
                throw new HttpError('name, phone, pin, role requis');
            }
        }
        return Accounts::signup($c->body(), true);
    }

    // ── Archive / export / wipe ──────────────────────────────────────────────

    /** Tables transactionnelles, dans l'ordre de suppression compatible avec les cles etrangeres. */
    private const TRANSACTIONAL = ['Message', 'GpsLocation', 'EscrowEntry', 'Rating', 'Issue', 'DeliveryPayment', 'Transaction', 'TopUp', 'Withdrawal', 'Delivery', 'OtpCode'];

    public static function export(Ctx $c): void
    {
        $dump = ['exportedAt' => gmdate('c'), 'version' => '3.0-php'];
        foreach (['User', 'KycDocument', 'Wallet', 'Delivery', 'EscrowEntry', 'GpsLocation', 'Transaction', 'Withdrawal', 'TopUp', 'DeliveryPayment', 'Rating', 'Issue', 'Message', 'PlatformSetting', 'City', 'Neighborhood'] as $t) {
            $dump[$t] = Db::all("SELECT * FROM `$t`");
        }
        // Les empreintes de PIN ne quittent jamais la base.
        foreach ($dump['User'] as &$u) {
            unset($u['pinHash']);
        }
        $dump['counts'] = ['users' => count($dump['User']), 'deliveries' => count($dump['Delivery']), 'transactions' => count($dump['Transaction']), 'wallets' => count($dump['Wallet'])];
        $json = json_encode($dump, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_PARTIAL_OUTPUT_ON_ERROR);
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="koligo-backup-' . gmdate('Y-m-d') . '.json"');
        header('Content-Length: ' . strlen($json));
        echo $json;
        exit;
    }

    private static function snapshot(array $tables): array
    {
        $data = [];
        foreach ($tables as $t) {
            $data[$t] = Db::all("SELECT * FROM `$t`");
        }
        return $data;
    }

    public static function archiveAndReset(Ctx $c): array
    {
        $label = (string)($c->input('label') ?: 'Archive ' . gmdate('Y-m-d'));
        $data = self::snapshot(['Delivery', 'Transaction', 'OtpCode', 'Rating', 'Issue', 'Withdrawal']);
        $counts = [
            'users' => (int)Db::val('SELECT COUNT(*) FROM `User`'),
            'deliveries' => count($data['Delivery']), 'transactions' => count($data['Transaction']),
            'otps' => count($data['OtpCode']), 'date' => gmdate('c'),
        ];
        $id = Db::id();
        Db::tx(function () use ($id, $label, $counts, $data, $c) {
            Db::insert('DbArchive', [
                'id' => $id, 'label' => $label, 'archivedAt' => Db::now(), 'archivedBy' => $c->user['userId'],
                'snapshotJson' => json_encode($counts + ['_data' => $data], JSON_UNESCAPED_UNICODE),
            ]);
            foreach (self::TRANSACTIONAL as $t) {
                Db::exec("DELETE FROM `$t`");
            }
        });
        return ['archived' => true, 'archiveId' => $id, 'snapshot' => $counts];
    }

    public static function wipeTotal(Ctx $c): array
    {
        $adminId = $c->user['userId'];
        $label = (string)($c->input('label') ?: 'WipeTotal ' . gmdate('Y-m-d H:i'));
        $data = self::snapshot(['User', 'Delivery', 'Transaction', 'OtpCode', 'Rating', 'Issue', 'Withdrawal', 'Wallet']);
        foreach ($data['User'] as &$u) {
            unset($u['pinHash']); // l'archive restaurable ne doit pas contenir les empreintes de PIN
        }
        $counts = [
            'users' => count($data['User']), 'deliveries' => count($data['Delivery']),
            'transactions' => count($data['Transaction']), 'wallets' => count($data['Wallet']),
            'otps' => count($data['OtpCode']), 'date' => gmdate('c'),
        ];
        Db::tx(function () use ($label, $counts, $data, $adminId) {
            Db::insert('DbArchive', [
                'id' => Db::id(), 'label' => "[WIPE] $label", 'archivedAt' => Db::now(), 'archivedBy' => $adminId,
                'snapshotJson' => json_encode($counts + ['_data' => $data], JSON_UNESCAPED_UNICODE),
            ]);
            foreach (self::TRANSACTIONAL as $t) {
                Db::exec("DELETE FROM `$t`");
            }
            Db::exec('DELETE FROM `KycDocument`');
            Db::exec('DELETE FROM `Wallet` WHERE userId <> ?', [$adminId]);
            Db::exec('DELETE FROM `User` WHERE id <> ?', [$adminId]);
        });
        return ['wiped' => true, 'snapshot' => $counts];
    }

    public static function listArchives(Ctx $c): array
    {
        return Db::all('SELECT id, label, archivedAt, archivedBy, snapshotJson FROM `DbArchive` ORDER BY archivedAt DESC');
    }

    public static function restoreArchive(Ctx $c): array
    {
        $a = Db::one('SELECT * FROM `DbArchive` WHERE id = ?', [$c->param('id')]);
        if (!$a) {
            throw new HttpError('Archive introuvable');
        }
        $snap = json_decode((string)$a['snapshotJson'], true);
        if (!is_array($snap)) {
            throw new HttpError('Snapshot corrompu');
        }
        $data = $snap['_data'] ?? null;
        if (!is_array($data)) {
            throw new HttpError('Cette archive ne contient pas de données restaurables (ancienne version — comptages uniquement)');
        }

        $restored = ['deliveries' => 0, 'transactions' => 0, 'otps' => 0];
        $map = ['Delivery' => 'deliveries', 'Transaction' => 'transactions', 'OtpCode' => 'otps'];
        foreach ($map as $table => $label) {
            // Anciennes archives (Node) : cles en minuscule/pluriel.
            $rows = $data[$table] ?? $data[$label] ?? [];
            foreach ((array)$rows as $row) {
                if (!is_array($row) || empty($row['id']) || Db::one("SELECT id FROM `$table` WHERE id = ?", [$row['id']])) {
                    continue;
                }
                try {
                    Db::insert($table, self::restorable($row));
                    $restored[$label]++;
                } catch (\Throwable) {
                    // ligne orpheline (utilisateur supprime depuis) : ignoree
                }
            }
        }
        return ['restored' => true, 'archiveId' => $a['id'], 'counts' => $restored];
    }

    /** Remet les dates ISO d'un ancien snapshot au format SQL. */
    private static function restorable(array $row): array
    {
        foreach ($row as $k => $v) {
            if (is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/', $v)) {
                $row[$k] = gmdate('Y-m-d H:i:s', strtotime($v));
            } elseif (is_array($v)) {
                unset($row[$k]);
            }
        }
        return $row;
    }
}
