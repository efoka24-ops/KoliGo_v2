<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Ctx;
use Koligo\Db;
use Koligo\Http;
use Koligo\RateLimit;
use Koligo\HttpError;
use Koligo\Rel;
use Koligo\Services\Accounts;
use Koligo\Services\Cgu;
use Koligo\Services\Invoices;
use Koligo\Services\Kyc;
use Koligo\Services\Notifier;
use Koligo\Services\Payments;
use Koligo\Services\Pricing;

/** Back-office : toutes les routes exigent un JWT avec le role ADMIN (cf. routes.php). */
final class AdminController
{
    private const SITE_CONTENT_KEY = 'site_content_json';
    private const DEFAULT_SITE_CONTENT = [
        // Aucun contenu d'exemple : équipe et actualités sont saisies depuis le back-office.
        'heroTitle' => '',
        'heroSubtitle' => '',
        'aboutTitle' => '',
        'aboutText' => '',
        'team' => [],
        'news' => [],
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

    private static function audit(Ctx $c, string $userId, string $action): void
    {
        Db::insert('AdminAction', ['id' => Db::id(), 'adminId' => $c->user['userId'], 'userId' => $userId, 'action' => $action, 'createdAt' => Db::now()]);
    }

    /** Un administrateur ne peut pas etre cible ici (ni soi-meme) : evite de se verrouiller ou de prendre un compte admin. */
    private static function mustManage(Ctx $c): array
    {
        $u = Accounts::mustUser($c->param('id'));
        if (str_contains((string)$u['roles'], 'ADMIN') || $u['id'] === $c->user['userId']) {
            throw new HttpError('Action impossible sur un compte administrateur', 403);
        }
        return $u;
    }

    public static function blockUser(Ctx $c): array
    {
        $u = self::mustManage($c);
        $blocked = (bool)$c->input('blocked');
        Db::update('User', $u['id'], ['isBlocked' => $blocked, 'updatedAt' => Db::now()]);
        self::audit($c, $u['id'], $blocked ? 'BLOCK' : 'UNBLOCK');
        return self::publicUser($u['id']);
    }

    /** POST /admin/users/:id/reset-pin : PIN temporaire a 6 chiffres, affiche une seule fois a l'administrateur. */
    public static function resetPin(Ctx $c): array
    {
        $u = self::mustManage($c);
        $temp = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        Db::exec('UPDATE `User` SET pinHash = ?, updatedAt = ? WHERE id = ?', [Accounts::hashPin($temp), Db::now(), $u['id']]);
        RateLimit::clear('signin:' . strtolower((string)$u['phone']));
        if ($u['email']) {
            RateLimit::clear('signin:' . strtolower((string)$u['email']));
        }
        self::audit($c, $u['id'], 'RESET_PIN');
        Notifier::send($u['id'], 'SECURITY', 'PIN réinitialisé', 'KoliGo a réinitialisé votre PIN. Utilisez le PIN temporaire communiqué par le support, puis changez-le dans Paramètres.');
        return ['tempPin' => $temp, 'phone' => $u['phone'], 'name' => $u['name']];
    }

    /** POST /admin/users/:id/lock-pin : le PIN actuel ne fonctionne plus (le titulaire doit passer par « PIN oublie » ou le support). */
    public static function lockPin(Ctx $c): array
    {
        $u = self::mustManage($c);
        Db::exec('UPDATE `User` SET pinHash = ?, updatedAt = ? WHERE id = ?', [Accounts::hashPin(bin2hex(random_bytes(16))), Db::now(), $u['id']]);
        self::audit($c, $u['id'], 'LOCK_PIN');
        return ['locked' => true];
    }

    /** GET /admin/messages?flagged=1&q=&page= : tous les messages des livraisons, les signales en premier si flagged=1. */
    public static function listMessages(Ctx $c): array
    {
        [$take, $skip] = self::page(30);
        $where = '1=1';
        $args = [];
        if (!empty($_GET['flagged'])) {
            $where .= ' AND m.flagged = 1';
        }
        if ($q = self::q()) {
            $where .= " AND (m.content LIKE ? ESCAPE '!' OR m.senderName LIKE ? ESCAPE '!')";
            $args[] = $args[] = Db::like($q);
        }
        $items = Db::all(
            "SELECT m.id, m.deliveryId, m.senderId, m.senderName, m.senderRole, m.content, m.flagged, m.flagReason, m.createdAt,
                    d.pickupAddress, d.dropoffAddress, d.status, v.name AS vendorName, p.name AS delivererName
             FROM `Message` m JOIN `Delivery` d ON d.id = m.deliveryId
             LEFT JOIN `User` v ON v.id = d.vendorId LEFT JOIN `User` p ON p.id = d.delivererId
             WHERE $where ORDER BY m.createdAt DESC LIMIT $take OFFSET $skip",
            $args
        );
        return [
            'items' => $items,
            'total' => (int)Db::val("SELECT COUNT(*) FROM `Message` m WHERE $where", $args),
            'flaggedOpen' => (int)Db::val('SELECT COUNT(*) FROM `Message` WHERE flagged = 1'),
        ];
    }

    /** PATCH /admin/messages/:id/clear : le message signale est examine et classe sans suite. */
    public static function clearMessage(Ctx $c): array
    {
        if (Db::exec('UPDATE `Message` SET flagged = 0 WHERE id = ?', [$c->param('id')]) !== 1) {
            throw new HttpError('Message introuvable', 404);
        }
        return ['ok' => true];
    }

    public static function reviewKyc(Ctx $c): array
    {
        $status = (string)$c->input('status', '');
        if (!in_array($status, ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'], true)) {
            throw new HttpError('Statut KYC invalide');
        }
        $u = Accounts::mustUser($c->param('id'));
        Kyc::set($u['id'], $status, $status === 'REJECTED' ? ((string)$c->input('reason') ?: null) : null);
        if ($status === 'VERIFIED') {
            Notifier::send($u['id'], 'KYC', 'Identité validée', 'Votre dossier KYC est validé : vous pouvez publier et livrer des colis.');
        } elseif ($status === 'REJECTED') {
            $why = trim((string)$c->input('reason'));
            Notifier::send($u['id'], 'KYC', 'Dossier KYC refusé', 'Votre dossier a été refusé' . ($why !== '' ? ' : ' . $why : '.') . ' Vous pouvez le renvoyer.');
        }
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
        $w = Db::one('SELECT * FROM `Withdrawal` WHERE id = ?', [$id]);
        $owner = $w ? Db::val('SELECT userId FROM `Wallet` WHERE id = ?', [$w['walletId']]) : null;
        if ($owner) {
            Notifier::send((string)$owner, 'WITHDRAWAL', 'Retrait effectué', 'Votre retrait de ' . number_format((int)$w['amountXAF'], 0, ',', ' ') . ' F vers ' . $w['phone'] . ' a été traité.');
        }
        return $w;
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

    // ── Analyse : tout est calcule depuis la base, rien n'est inventé ────────────

    /**
     * GET /admin/analytics?period=7d|30d|12m
     * Indicateurs de la periode et evolution par rapport a la periode precedente de meme longueur,
     * courbes, repartition des statuts, classements, zones les plus actives et activite recente.
     */
    public static function analytics(Ctx $c): array
    {
        $period = in_array($_GET['period'] ?? '', ['7d', '30d', '12m'], true) ? (string)$_GET['period'] : '30d';
        $now = time();
        $dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        $monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        $midnight = fn(int $t): int => (int)strtotime(gmdate('Y-m-d', $t) . ' 00:00:00 UTC');

        // Fenetre courante : liste de seaux [debut, fin, etiquette]
        $buckets = [];
        if ($period === '12m') {
            $y = (int)gmdate('Y', $now);
            $m = (int)gmdate('n', $now);
            for ($i = 11; $i >= 0; $i--) {
                $mm = $m - $i;
                $yy = $y;
                while ($mm < 1) {
                    $mm += 12;
                    $yy--;
                }
                $s = (int)strtotime(sprintf('%04d-%02d-01 00:00:00 UTC', $yy, $mm));
                $e = (int)strtotime(sprintf('%04d-%02d-01 00:00:00 UTC', $mm === 12 ? $yy + 1 : $yy, $mm === 12 ? 1 : $mm + 1));
                $buckets[] = [$s, $e, $monthNames[$mm - 1]];
            }
        } else {
            $n = $period === '7d' ? 7 : 30;
            $first = $midnight($now) - ($n - 1) * 86400;
            for ($i = 0; $i < $n; $i++) {
                $s = $first + $i * 86400;
                $buckets[] = [$s, $s + 86400, $n === 7 ? $dayNames[(int)gmdate('w', $s)] : gmdate('d/m', $s)];
            }
        }
        $from = $buckets[0][0];
        $to = $buckets[count($buckets) - 1][1];
        $prevFrom = $from - ($to - $from);

        $rows = Db::all(
            'SELECT id, vendorId, delivererId, pickupAddress, status, priceXAF, commissionXAF, createdAt, updatedAt FROM `Delivery` WHERE createdAt >= ? ORDER BY createdAt ASC LIMIT 100000',
            [gmdate('Y-m-d H:i:s', min($prevFrom, $midnight($now) - 6 * 86400))]
        );
        foreach ($rows as &$r) {
            $r['_t'] = (int)strtotime($r['createdAt'] . ' UTC');
        }
        unset($r);

        $inRange = fn(array $set, int $a, int $b): array => array_values(array_filter($set, fn($r) => $r['_t'] >= $a && $r['_t'] < $b));
        $sum = fn(array $set, string $k): int => (int)array_sum(array_column(array_filter($set, fn($r) => $r['status'] === 'LIVRE'), $k));
        $actors = function (array $set): int {
            $ids = [];
            foreach ($set as $r) {
                $ids[$r['vendorId']] = true;
                if ($r['delivererId']) {
                    $ids[$r['delivererId']] = true;
                }
            }
            return count($ids);
        };
        $delta = fn(int|float $cur, int|float $prev): ?int => $prev > 0 ? (int)round(($cur - $prev) / $prev * 100) : null;

        $cur = $inRange($rows, $from, $to);
        $prev = $inRange($rows, $prevFrom, $from);

        $series = [];
        foreach ($buckets as [$s, $e, $label]) {
            $b = $inRange($cur, $s, $e);
            $series[] = ['label' => $label, 'gmv' => $sum($b, 'priceXAF'), 'count' => count($b)];
        }

        // Les sept derniers jours, toujours (courbe et mini-graphiques du tableau de bord).
        $last7 = [];
        $d0 = $midnight($now) - 6 * 86400;
        for ($i = 0; $i < 7; $i++) {
            $s = $d0 + $i * 86400;
            $b = $inRange($rows, $s, $s + 86400);
            $last7[] = ['label' => $dayNames[(int)gmdate('w', $s)], 'gmv' => $sum($b, 'priceXAF'), 'count' => count($b), 'actors' => $actors($b)];
        }

        $breakdown = [];
        foreach ($cur as $r) {
            $breakdown[$r['status']] = ($breakdown[$r['status']] ?? 0) + 1;
        }

        // Classements
        $byVendor = [];
        $byDeliverer = [];
        $byZone = [];
        foreach ($cur as $r) {
            $byVendor[$r['vendorId']]['n'] = ($byVendor[$r['vendorId']]['n'] ?? 0) + 1;
            $byVendor[$r['vendorId']]['gmv'] = ($byVendor[$r['vendorId']]['gmv'] ?? 0) + ($r['status'] === 'LIVRE' ? (int)$r['priceXAF'] : 0);
            if ($r['delivererId'] && $r['status'] === 'LIVRE') {
                $byDeliverer[$r['delivererId']] = ($byDeliverer[$r['delivererId']] ?? 0) + 1;
            }
            $z = trim((string)$r['pickupAddress']);
            if ($z !== '') {
                $byZone[$z] = ($byZone[$z] ?? 0) + 1;
            }
        }
        $names = function (array $ids): array {
            if (!$ids) {
                return [];
            }
            $out = [];
            foreach (Db::all('SELECT id, name, shopName FROM `User` WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')', array_values($ids)) as $u) {
                $out[$u['id']] = $u;
            }
            return $out;
        };
        uasort($byVendor, fn($a, $b) => $b['n'] <=> $a['n']);
        $topVendorIds = array_slice(array_keys($byVendor), 0, 5);
        $vn = $names($topVendorIds);
        $topVendors = array_map(fn($id) => [
            'id' => $id, 'name' => ($vn[$id]['shopName'] ?? null) ?: ($vn[$id]['name'] ?? '—'),
            'deliveries' => $byVendor[$id]['n'], 'gmv' => $byVendor[$id]['gmv'],
        ], $topVendorIds);

        arsort($byDeliverer);
        $topDelIds = array_slice(array_keys($byDeliverer), 0, 5);
        $dn = $names($topDelIds);
        $topDeliverers = array_map(function ($id) use ($dn, $byDeliverer) {
            $r = Db::one('SELECT AVG(score) AS a, COUNT(*) AS n FROM `Rating` WHERE toUserId = ?', [$id]);
            return ['id' => $id, 'name' => $dn[$id]['name'] ?? '—', 'deliveries' => $byDeliverer[$id],
                'rating' => $r && $r['a'] !== null ? round((float)$r['a'], 1) : null];
        }, $topDelIds);

        arsort($byZone);
        $topZones = [];
        foreach (array_slice($byZone, 0, 5, true) as $name => $n) {
            $topZones[] = ['name' => $name, 'deliveries' => $n];
        }

        // Activite recente : evenements reels, tous types confondus
        $events = [];
        $ref = fn(string $id): string => 'KG-' . strtoupper(substr($id, -8));
        $xaf = fn($n): string => number_format((int)$n, 0, ',', ' ') . ' XAF';
        foreach (Db::all('SELECT id, status, priceXAF, updatedAt, pickupAddress, dropoffAddress FROM `Delivery` ORDER BY updatedAt DESC LIMIT 8') as $d) {
            [$kind, $txt] = match ($d['status']) {
                'LIVRE' => ['delivered', $ref($d['id']) . ' livrée à ' . $d['dropoffAddress'] . ' · ' . $xaf($d['priceXAF'])],
                'EN_ROUTE' => ['inroute', $ref($d['id']) . ' en route vers ' . $d['dropoffAddress']],
                'ACCEPTE' => ['accepted', $ref($d['id']) . ' acceptée par un livreur'],
                'ANNULE' => ['cancelled', $ref($d['id']) . ' annulée'],
                default => ['created', $ref($d['id']) . ' publiée : ' . $d['pickupAddress'] . ' → ' . $d['dropoffAddress']],
            };
            $events[] = ['kind' => $kind, 'text' => $txt, 'at' => $d['updatedAt']];
        }
        foreach (Db::all('SELECT i.id, i.type, i.createdAt, i.deliveryId FROM `Issue` i ORDER BY i.createdAt DESC LIMIT 5') as $i) {
            $events[] = ['kind' => 'issue', 'text' => 'Incident signalé sur ' . $ref($i['deliveryId']) . ' (' . $i['type'] . ')', 'at' => $i['createdAt']];
        }
        foreach (Db::all("SELECT name, updatedAt FROM `User` WHERE kycStatus = 'PENDING' ORDER BY updatedAt DESC LIMIT 5") as $u) {
            $events[] = ['kind' => 'kyc', 'text' => $u['name'] . ' a soumis ses documents KYC', 'at' => $u['updatedAt']];
        }
        foreach (Db::all('SELECT amountXAF, provider, createdAt FROM `Withdrawal` ORDER BY createdAt DESC LIMIT 5') as $w) {
            $events[] = ['kind' => 'withdrawal', 'text' => 'Retrait de ' . $xaf($w['amountXAF']) . ' · ' . $w['provider'], 'at' => $w['createdAt']];
        }
        usort($events, fn($a, $b) => strcmp((string)$b['at'], (string)$a['at']));
        $events = array_slice($events, 0, 8);

        $curGmv = $sum($cur, 'priceXAF');
        $prevGmv = $sum($prev, 'priceXAF');
        $curComm = $sum($cur, 'commissionXAF');
        $prevComm = $sum($prev, 'commissionXAF');
        return [
            'period' => $period,
            'kpis' => [
                'gmv' => ['value' => $curGmv, 'delta' => $delta($curGmv, $prevGmv)],
                'deliveries' => ['value' => count($cur), 'delta' => $delta(count($cur), count($prev))],
                'commission' => ['value' => $curComm, 'delta' => $delta($curComm, $prevComm)],
                'activeUsers' => ['value' => $actors($cur), 'delta' => $delta($actors($cur), $actors($prev))],
                'activeDeliverers' => (int)Db::val("SELECT COUNT(*) FROM `User` WHERE isOnline = 1 AND roles LIKE '%DELIVERER%'"),
            ],
            'series' => $series,
            'last7' => $last7,
            'statusBreakdown' => (object)$breakdown,
            'topVendors' => $topVendors,
            'topDeliverers' => $topDeliverers,
            'topZones' => $topZones,
            'activity' => $events,
            'generatedAt' => gmdate('c'),
        ];
    }

    // ── Test de paiement Sungku : 100 F, sans toucher aux livraisons des clients ──

    /** Montant d'un test : 100 F par defaut, jamais plus de 500 F (borne cote serveur, pas cote navigateur). */
    private const TEST_PAYMENT_DEFAULT_XAF = 100;
    private const TEST_PAYMENT_MAX_XAF = 500;

    /**
     * POST /admin/test-payment {phone} : demande de 100 F (ou le montant choisi, 500 F max) au numero indique, par le meme chemin que
     * les recharges (Sungku, webhook signe). Si le paiement aboutit, les 100 F sont credites au
     * portefeuille de l'administrateur qui l'a lance.
     */
    public static function startTestPayment(Ctx $c): array
    {
        $uid = $c->user['userId'];
        RateLimit::hit('testpay:' . $uid, 10, 3600);
        $phone = trim((string)$c->input('phone', ''));
        if (!preg_match('/^(\+?237)?6\d{8}$/', preg_replace('/\s+/', '', $phone) ?? '')) {
            throw new HttpError('Numéro Mobile Money invalide (ex. 6XXXXXXXX)');
        }
        $amount = (int)($c->input('amount') ?? self::TEST_PAYMENT_DEFAULT_XAF);
        if ($amount < self::TEST_PAYMENT_DEFAULT_XAF || $amount > self::TEST_PAYMENT_MAX_XAF) {
            throw new HttpError('Le montant du test doit être entre ' . self::TEST_PAYMENT_DEFAULT_XAF . ' et ' . self::TEST_PAYMENT_MAX_XAF . ' FCFA');
        }
        $wallet = Db::one('SELECT * FROM `Wallet` WHERE userId = ?', [$uid]);
        if (!$wallet) {
            $wallet = ['id' => Db::id(), 'userId' => $uid, 'balanceXAF' => 0, 'paymentProvider' => 'MTN'];
            Db::insert('Wallet', ['id' => $wallet['id'], 'userId' => $uid, 'balanceXAF' => 0, 'updatedAt' => Db::now()]);
        }
        $out = Payments::startTopUp($wallet, $amount, $phone);
        return $out + ['amountXAF' => $amount, 'mock' => Payments::mock(), 'gateway' => \Koligo\Services\Sungku::$last];
    }

    /** GET /admin/test-payment/:id : statut d'un test lance par cet administrateur. */
    public static function testPaymentStatus(Ctx $c): array
    {
        $q = 'SELECT t.id, t.status, t.amountXAF, t.phone, t.paymentId, t.externalRef, t.createdAt, t.updatedAt FROM `TopUp` t JOIN `Wallet` w ON w.id = t.walletId WHERE t.id = ? AND w.userId = ?';
        $row = Db::one($q, [$c->param('id'), $c->user['userId']]);
        if (!$row) {
            throw new HttpError('Test introuvable', 404);
        }
        if ($row['status'] === 'PENDING') {
            // Le webhook peut ne pas arriver : on interroge Sungku, puis on relit l'etat.
            Payments::reconcile('TopUp', $row);
            $row = Db::one($q, [$c->param('id'), $c->user['userId']]);
        }
        unset($row['paymentId'], $row['externalRef']);
        return $row + ['gateway' => \Koligo\Services\Sungku::$last];
    }

    // ── Tarification (zones, gabarits, frais) : modifiable sans déploiement ──

    public static function getPricing(Ctx $c): array
    {
        $cfg = Pricing::config();
        return [
            'zones' => $cfg['zones'], 'gabarits' => $cfg['gabarits'], 'defaultZone' => $cfg['defaultZone'],
            'minPriceXAF' => $cfg['minPrice'], 'weightRateXAF' => $cfg['weightRate'], 'commissionRate' => $cfg['commissionRate'],
            'cancelFeeXAF' => $cfg['cancelFee'], 'revisionTimeoutMin' => $cfg['revisionTimeoutMin'], 'cancelGraceMin' => $cfg['cancelGraceMin'],
            'strikeWindowDays' => $cfg['strikeWindowDays'], 'strikeThreshold' => $cfg['strikeThreshold'],
            'regions' => array_column(Db::all('SELECT DISTINCT region FROM `City` ORDER BY region ASC'), 'region'),
            'vehicles' => array_keys(Pricing::VEHICLES),
        ];
    }

    public static function updatePricing(Ctx $c): array
    {
        $b = $c->body();
        $ints = [
            'minPriceXAF' => ['pricing_min_xaf', 0, 100000], 'weightRateXAF' => ['weight_surcharge_xaf', 0, 10000],
            'cancelFeeXAF' => ['cancel_fee_xaf', 0, 50000], 'revisionTimeoutMin' => ['revision_timeout_min', 1, 120],
            'cancelGraceMin' => ['cancel_grace_min', 0, 60], 'strikeWindowDays' => ['strike_window_days', 1, 365],
            'strikeThreshold' => ['strike_threshold', 1, 100],
        ];
        $writes = [];
        foreach ($ints as $field => [$key, $min, $max]) {
            if (array_key_exists($field, $b)) {
                if (!is_numeric($b[$field]) || $b[$field] < $min || $b[$field] > $max) {
                    throw new HttpError("$field doit être entre $min et $max");
                }
                $writes[$key] = (string)(int)$b[$field];
            }
        }
        if (array_key_exists('commissionRate', $b)) {
            if (!is_numeric($b['commissionRate']) || $b['commissionRate'] < 0 || $b['commissionRate'] > 0.5) {
                throw new HttpError('commissionRate doit être entre 0 et 0.5');
            }
            $writes['commission_rate'] = (string)(float)$b['commissionRate'];
        }
        if (array_key_exists('zones', $b)) {
            $zones = Pricing::validateZones($b['zones']);
            $writes['pricing_zones'] = json_encode($zones, JSON_UNESCAPED_UNICODE);
            $default = (string)($b['defaultZone'] ?? Pricing::config()['defaultZone']);
            if (!in_array($default, array_column($zones, 'name'), true)) {
                throw new HttpError("La zone de repli doit être l'une des zones");
            }
            $writes['pricing_default_zone'] = $default;
        } elseif (array_key_exists('defaultZone', $b)) {
            if (!in_array((string)$b['defaultZone'], array_column(Pricing::config()['zones'], 'name'), true)) {
                throw new HttpError("La zone de repli doit être l'une des zones");
            }
            $writes['pricing_default_zone'] = (string)$b['defaultZone'];
        }
        if (array_key_exists('gabarits', $b)) {
            $writes['pricing_gabarits'] = json_encode(Pricing::validateGabarits($b['gabarits']), JSON_UNESCAPED_UNICODE);
        }
        foreach ($writes as $k => $v) {
            self::putSetting($k, $v);
        }
        Pricing::resetCache();
        return self::getPricing($c);
    }

    // ── CGU : texte versionné en base, édité ici ─────────────────────────────

    public static function getCgu(Ctx $c): array
    {
        Cgu::ensureSeeded();
        $latest = Cgu::latestVersion();
        return [
            'version' => $latest,
            'fr' => Cgu::raw('fr')['articles'], 'en' => Cgu::raw('en')['articles'],
            'history' => Cgu::history(),
            'tokens' => ['{{cancel_fee}}', '{{revision_timeout}}', '{{strike_threshold}}', '{{strike_window}}', '{{cancel_grace}}'],
            'acceptedLatest' => (int)Db::val('SELECT COUNT(*) FROM `User` WHERE cguVersion = ?', [$latest]),
            'totalUsers' => (int)Db::val("SELECT COUNT(*) FROM `User` WHERE activeRole <> 'ADMIN'"),
        ];
    }

    /** Publie une nouvelle version : tous les utilisateurs devront la re-accepter. */
    public static function publishCgu(Ctx $c): array
    {
        Cgu::publish((array)$c->input('fr', []), (array)$c->input('en', []), $c->user['userId'] ?? null);
        return self::getCgu($c);
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
            $u['kycDocuments'] = Db::all('SELECT type, role, createdAt FROM `KycDocument` WHERE userId = ?', [$u['id']]);
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
    private const TRANSACTIONAL = ['GabaritRevision', 'Message', 'GpsLocation', 'EscrowEntry', 'Rating', 'Issue', 'DeliveryPayment', 'Transaction', 'TopUp', 'Withdrawal', 'Delivery', 'OtpCode'];

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
