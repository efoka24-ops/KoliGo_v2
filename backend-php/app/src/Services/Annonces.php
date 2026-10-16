<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\HttpError;
use Koligo\RateLimit;

/**
 * Annonces de produits « Flash » (24 h, gratuites) et « Boost » (3, 7, 15 ou 30 jours, payantes).
 *
 * Statuts : BROUILLON (Boost en attente de paiement) -> ACTIVE -> EXPIREE ; SUSPENDUE (moderation) ; SUPPRIMEE (retiree).
 * Regle d'expiration : une annonce n'est visible que si status = ACTIVE ET expiresAt > maintenant, controle a CHAQUE lecture.
 * Le nettoyage (passage a EXPIREE + notification) n'est qu'un complement, execute au plus une fois par 10 minutes.
 */
final class Annonces
{
    public const CATEGORIES = ['ELECTRONICS', 'CLOTHING', 'FOOD', 'HOME', 'BEAUTY', 'BOOKS', 'AUTO', 'OTHER'];
    public const CONTACTS = ['CALL', 'WHATSAPP'];
    public const DEFAULT_TARIFFS = [['days' => 3, 'priceXAF' => 500], ['days' => 7, 'priceXAF' => 1000], ['days' => 15, 'priceXAF' => 2000], ['days' => 30, 'priceXAF' => 3000]];
    private const MAX_PHOTOS = 4;

    // ── Reglages ─────────────────────────────────────────────────────────────

    private static function setting(string $key, string $default): string
    {
        $v = Db::val('SELECT `value` FROM `PlatformSetting` WHERE `key` = ?', [$key]);
        return ($v === null || $v === false || $v === '') ? $default : (string)$v;
    }

    /** @return array<int,array{days:int,priceXAF:int}> */
    public static function tariffs(): array
    {
        $j = json_decode(self::setting('ad_boost_tariffs', ''), true);
        $out = [];
        foreach (is_array($j) ? $j : self::DEFAULT_TARIFFS as $t) {
            if (is_array($t) && (int)($t['days'] ?? 0) > 0 && (int)($t['priceXAF'] ?? -1) >= 0) {
                $out[] = ['days' => (int)$t['days'], 'priceXAF' => (int)$t['priceXAF']];
            }
        }
        usort($out, fn($a, $b) => $a['days'] <=> $b['days']);
        return $out ?: self::DEFAULT_TARIFFS;
    }

    public static function config(): array
    {
        return [
            'tariffs' => self::tariffs(), 'flashHours' => 24,
            'flashPerDay' => max(1, (int)self::setting('ad_flash_per_day', '3')),
            'maxActive' => max(1, (int)self::setting('ad_max_active', '10')),
            'categories' => self::CATEGORIES, 'maxPhotos' => self::MAX_PHOTOS,
        ];
    }

    public static function saveConfig(array $b): array
    {
        $now = Db::now();
        $put = function (string $k, string $v) use ($now) {
            if (Db::exec('UPDATE `PlatformSetting` SET `value` = ?, updatedAt = ? WHERE `key` = ?', [$v, $now, $k]) === 0
                && !Db::one('SELECT `key` FROM `PlatformSetting` WHERE `key` = ?', [$k])) {
                Db::exec('INSERT INTO `PlatformSetting` (`key`, `value`, updatedAt) VALUES (?, ?, ?)', [$k, $v, $now]);
            }
        };
        if (isset($b['tariffs'])) {
            if (!is_array($b['tariffs']) || count($b['tariffs']) < 1 || count($b['tariffs']) > 8) {
                throw new HttpError('Indiquez entre 1 et 8 tarifs Boost');
            }
            $clean = [];
            $seen = [];
            foreach ($b['tariffs'] as $t) {
                $d = is_array($t) ? ($t['days'] ?? null) : null;
                $p = is_array($t) ? ($t['priceXAF'] ?? null) : null;
                if (!is_numeric($d) || (int)$d < 1 || (int)$d > 365 || !is_numeric($p) || (int)$p < 0 || (int)$p > 1000000 || isset($seen[(int)$d])) {
                    throw new HttpError('Tarif Boost invalide (durée de 1 à 365 jours sans doublon, prix de 0 à 1 000 000 F)');
                }
                $seen[(int)$d] = true;
                $clean[] = ['days' => (int)$d, 'priceXAF' => (int)$p];
            }
            $put('ad_boost_tariffs', json_encode($clean));
        }
        foreach (['flashPerDay' => ['ad_flash_per_day', 1, 50], 'maxActive' => ['ad_max_active', 1, 200]] as $f => [$k, $min, $max]) {
            if (isset($b[$f])) {
                if (!is_numeric($b[$f]) || (int)$b[$f] < $min || (int)$b[$f] > $max) {
                    throw new HttpError("$f doit être entre $min et $max");
                }
                $put($k, (string)(int)$b[$f]);
            }
        }
        return self::config();
    }

    // ── Publication ──────────────────────────────────────────────────────────

    /**
     * @param array $p title, description, category, priceXAF, city, quartier?, stock?, contactMode, photos[] (base64 brut),
     *                 type FLASH|BOOST, days? (Boost), phone? (Mobile Money, Boost)
     * @return array{ad:array,payment:?array,moderated:bool}
     */
    public static function create(string $vendorId, array $p): array
    {
        $vendor = Db::one('SELECT * FROM `User` WHERE id = ?', [$vendorId]);
        if (!$vendor) {
            throw new HttpError('Utilisateur introuvable', 404);
        }
        Deliveries::assertCanPublish($vendor); // CGU a jour, KYC valide, compte non suspendu

        $title = trim((string)($p['title'] ?? ''));
        $desc = trim((string)($p['description'] ?? ''));
        $cat = strtoupper(trim((string)($p['category'] ?? '')));
        $city = mb_substr(trim((string)($p['city'] ?? '')), 0, 100);
        $quartier = mb_substr(trim((string)($p['quartier'] ?? '')), 0, 191);
        $contact = strtoupper(trim((string)($p['contactMode'] ?? 'CALL')));
        $type = strtoupper(trim((string)($p['type'] ?? 'FLASH')));
        if (mb_strlen($title) < 3 || mb_strlen($title) > 100) {
            throw new HttpError('Le titre doit faire entre 3 et 100 caractères.', 400, 'AD_TITLE');
        }
        if (mb_strlen($desc) < 10 || mb_strlen($desc) > 1000) {
            throw new HttpError('La description doit faire entre 10 et 1000 caractères.', 400, 'AD_DESCRIPTION');
        }
        if (!in_array($cat, self::CATEGORIES, true)) {
            throw new HttpError('Catégorie invalide', 400, 'AD_CATEGORY');
        }
        if ($city === '') {
            throw new HttpError('Indiquez la ville', 400, 'AD_CITY');
        }
        if (!is_numeric($p['priceXAF'] ?? null) || (int)$p['priceXAF'] < 0 || (int)$p['priceXAF'] > 50000000) {
            throw new HttpError('Prix invalide', 400, 'AD_PRICE');
        }
        $stock = isset($p['stock']) && $p['stock'] !== '' && $p['stock'] !== null ? (int)$p['stock'] : null;
        if ($stock !== null && ($stock < 0 || $stock > 99999)) {
            throw new HttpError('Stock invalide', 400, 'AD_STOCK');
        }
        if (!in_array($contact, self::CONTACTS, true)) {
            throw new HttpError('Mode de contact invalide', 400, 'AD_CONTACT');
        }
        if (!in_array($type, ['FLASH', 'BOOST'], true)) {
            throw new HttpError('Type d\'annonce invalide', 400, 'AD_TYPE');
        }
        $photos = $p['photos'] ?? [];
        if (!is_array($photos) || count($photos) < 1 || count($photos) > self::MAX_PHOTOS) {
            throw new HttpError('Ajoutez de 1 à ' . self::MAX_PHOTOS . ' photos.', 400, 'AD_PHOTOS');
        }

        $hours = 24;
        $price = 0;
        if ($type === 'BOOST') {
            $days = (int)($p['days'] ?? 0);
            $tariff = null;
            foreach (self::tariffs() as $t) {
                if ($t['days'] === $days) {
                    $tariff = $t;
                }
            }
            if (!$tariff) {
                throw new HttpError('Durée Boost invalide', 400, 'AD_DURATION');
            }
            $hours = $days * 24;
            $price = $tariff['priceXAF'];
        }
        self::assertLimits($vendorId, $type);

        $words = Moderation::scan($title . ' ' . $desc);
        $id = Db::id();
        $now = Db::now();
        $status = $words ? 'SUSPENDUE' : ($type === 'FLASH' || $price === 0 ? 'ACTIVE' : 'BROUILLON');
        Db::tx(function () use ($id, $vendorId, $title, $desc, $cat, $p, $city, $quartier, $stock, $contact, $type, $hours, $status, $words, $now, $photos) {
            Db::insert('Annonce', [
                'id' => $id, 'vendorId' => $vendorId, 'title' => $title, 'description' => $desc, 'category' => $cat,
                'priceXAF' => (int)$p['priceXAF'], 'city' => $city, 'quartier' => $quartier !== '' ? $quartier : null, 'stock' => $stock,
                'contactMode' => $contact, 'type' => $type, 'durationHours' => $hours, 'status' => $status,
                'publishedAt' => $status === 'ACTIVE' ? $now : null, 'expiresAt' => $status === 'ACTIVE' ? gmdate('Y-m-d H:i:s', time() + $hours * 3600) : null,
                'suspendReason' => $words ? 'Mots surveillés : ' . mb_substr(implode(', ', $words), 0, 150) : null,
                'createdAt' => $now, 'updatedAt' => $now,
            ]);
            foreach (array_values($photos) as $i => $b64) {
                if (!is_string($b64) || $b64 === '') {
                    throw new HttpError('Photo invalide', 400, 'AD_PHOTOS');
                }
                Db::insert('AnnoncePhoto', ['id' => Db::id(), 'adId' => $id, 'path' => Uploads::storeImage(Uploads::decode($b64), $vendorId, 'ad'), 'position' => $i]);
            }
        });

        $payment = null;
        if ($status === 'BROUILLON') {
            $phone = preg_replace('/\D/', '', (string)($p['phone'] ?? '')) ?? '';
            if (str_starts_with($phone, '237') && strlen($phone) === 12) {
                $phone = substr($phone, 3);
            }
            if (!preg_match('/^6\d{8}$/', $phone)) {
                Db::exec("UPDATE `Annonce` SET status = 'SUPPRIMEE', updatedAt = ? WHERE id = ?", [Db::now(), $id]);
                throw new HttpError('Numéro Mobile Money invalide (format : 6XXXXXXXX)', 400, 'PHONE_INVALID');
            }
            try {
                $payment = Payments::startAdPayment(self::row($id), $price, $phone);
            } catch (\Throwable $e) {
                Db::exec("UPDATE `Annonce` SET status = 'SUPPRIMEE', updatedAt = ? WHERE id = ?", [Db::now(), $id]);
                throw $e;
            }
        } elseif ($status === 'ACTIVE') {
            Notifier::send($vendorId, 'AD', 'Annonce publiée', 'Votre annonce « ' . $title . ' » est en ligne.', ['adId' => $id]);
        } else {
            Notifier::send($vendorId, 'AD', 'Annonce en vérification', 'Votre annonce « ' . $title . ' » est en cours de vérification par KoliGo avant sa mise en ligne.', ['adId' => $id]);
        }
        return ['ad' => self::mineView(self::row($id)), 'payment' => $payment, 'moderated' => (bool)$words];
    }

    private static function assertLimits(string $vendorId, string $type): void
    {
        $cfg = self::config();
        $active = (int)Db::val("SELECT COUNT(*) FROM `Annonce` WHERE vendorId = ? AND status IN ('ACTIVE','BROUILLON') AND (expiresAt IS NULL OR expiresAt > ?)", [$vendorId, Db::now()]);
        if ($active >= $cfg['maxActive']) {
            throw new HttpError('Vous avez atteint le nombre maximum d\'annonces actives (' . $cfg['maxActive'] . ').', 409, 'AD_LIMIT_ACTIVE');
        }
        if ($type === 'FLASH') {
            $today = (int)Db::val("SELECT COUNT(*) FROM `Annonce` WHERE vendorId = ? AND type = 'FLASH' AND status <> 'SUPPRIMEE' AND createdAt >= ?", [$vendorId, gmdate('Y-m-d 00:00:00')]);
            if ($today >= $cfg['flashPerDay']) {
                throw new HttpError('Limite de ' . $cfg['flashPerDay'] . ' annonces Flash gratuites par jour atteinte : choisissez un Boost ou revenez demain.', 409, 'AD_LIMIT_FLASH');
            }
        }
    }

    /** Active un Boost apres confirmation du paiement (appele par le webhook, idempotent). */
    public static function activateBoost(string $adId): void
    {
        $ad = Db::one('SELECT * FROM `Annonce` WHERE id = ?', [$adId]);
        if (!$ad || $ad['status'] !== 'BROUILLON') {
            return;
        }
        $now = Db::now();
        $won = Db::exec("UPDATE `Annonce` SET status = 'ACTIVE', publishedAt = ?, expiresAt = ?, updatedAt = ? WHERE id = ? AND status = 'BROUILLON'",
            [$now, gmdate('Y-m-d H:i:s', time() + (int)$ad['durationHours'] * 3600), $now, $adId]);
        if ($won === 1) {
            Notifier::send((string)$ad['vendorId'], 'AD', 'Paiement confirmé', 'Votre annonce Boost « ' . $ad['title'] . ' » est en ligne pour ' . (int)round($ad['durationHours'] / 24) . ' jours.', ['adId' => $adId]);
        }
    }

    // ── Lecture ──────────────────────────────────────────────────────────────

    private static function row(string $id): array
    {
        $r = Db::one('SELECT * FROM `Annonce` WHERE id = ?', [$id]);
        if (!$r) {
            throw new HttpError('Annonce introuvable', 404);
        }
        return $r;
    }

    private static function isLive(array $r): bool
    {
        return $r['status'] === 'ACTIVE' && $r['expiresAt'] !== null && $r['expiresAt'] > Db::now();
    }

    private static function secondsLeft(array $r): int
    {
        return $r['expiresAt'] ? max(0, (int)strtotime($r['expiresAt'] . ' UTC') - time()) : 0;
    }

    private static function photoCount(string $adId): int
    {
        return (int)Db::val('SELECT COUNT(*) FROM `AnnoncePhoto` WHERE adId = ?', [$adId]);
    }

    private static function publicView(array $r, ?array $vendor = null): array
    {
        $vendor ??= Db::one('SELECT name, shopName FROM `User` WHERE id = ?', [$r['vendorId']]) ?: [];
        return [
            'id' => $r['id'], 'title' => $r['title'], 'description' => $r['description'], 'category' => $r['category'],
            'priceXAF' => (int)$r['priceXAF'], 'city' => $r['city'], 'quartier' => $r['quartier'], 'stock' => $r['stock'] !== null ? (int)$r['stock'] : null,
            'contactMode' => $r['contactMode'], 'type' => $r['type'], 'expiresAt' => $r['expiresAt'], 'secondsLeft' => self::secondsLeft($r),
            'photoCount' => self::photoCount($r['id']), 'seller' => ($vendor['shopName'] ?? '') !== '' ? $vendor['shopName'] : ($vendor['name'] ?? ''),
            'sellerId' => $r['vendorId'], 'createdAt' => $r['createdAt'],
        ];
    }

    private static function mineView(array $r): array
    {
        return self::publicView($r) + [
            'status' => $r['status'], 'live' => self::isLive($r), 'views' => (int)$r['views'], 'contacts' => (int)$r['contacts'],
            'suspendReason' => $r['status'] === 'SUSPENDUE' ? $r['suspendReason'] : null, 'removeReason' => $r['removeReason'],
            'durationHours' => (int)$r['durationHours'], 'publishedAt' => $r['publishedAt'],
        ];
    }

    /** Nettoyage : passe les annonces echues a EXPIREE et previent les vendeurs. Au plus une fois par 10 minutes. */
    public static function expireDue(bool $force = false): int
    {
        $last = (int)self::setting('ads_last_expire', '0');
        if (!$force && $last > time() - 600) {
            return 0;
        }
        $now = Db::now();
        $stamp = (string)time();
        if (Db::exec("UPDATE `PlatformSetting` SET `value` = ?, updatedAt = ? WHERE `key` = 'ads_last_expire'", [$stamp, $now]) === 0
            && !Db::one("SELECT `key` FROM `PlatformSetting` WHERE `key` = 'ads_last_expire'")) {
            Db::exec("INSERT INTO `PlatformSetting` (`key`, `value`, updatedAt) VALUES ('ads_last_expire', ?, ?)", [$stamp, $now]);
        }
        $rows = Db::all("SELECT id, vendorId, title FROM `Annonce` WHERE status = 'ACTIVE' AND expiresAt <= ? LIMIT 200", [$now]);
        $n = 0;
        foreach ($rows as $r) {
            if (Db::exec("UPDATE `Annonce` SET status = 'EXPIREE', updatedAt = ? WHERE id = ? AND status = 'ACTIVE'", [$now, $r['id']]) === 1) {
                Notifier::send((string)$r['vendorId'], 'AD', 'Annonce expirée', 'Votre annonce « ' . $r['title'] . ' » a expiré. Republiez-la en Flash gratuit ou boostez-la.', ['adId' => $r['id']]);
                $n++;
            }
        }
        return $n;
    }

    /** Fil des annonces en ligne : filtre d'expiration applique a chaque requete, Boost d'abord. */
    public static function feed(array $q, string $viewerId): array
    {
        self::expireDue();
        $page = max(1, (int)($q['page'] ?? 1));
        $where = "a.status = 'ACTIVE' AND a.expiresAt > ? AND u.isBlocked = 0 AND u.suspendedAt IS NULL";
        $args = [Db::now()];
        if (!empty($q['city'])) {
            $where .= ' AND LOWER(a.city) = ?';
            $args[] = mb_strtolower(trim((string)$q['city']));
        }
        if (!empty($q['quartier'])) {
            $where .= " AND LOWER(a.quartier) LIKE ? ESCAPE '!'";
            $args[] = Db::like(mb_strtolower(trim((string)$q['quartier'])));
        }
        if (!empty($q['category']) && in_array(strtoupper((string)$q['category']), self::CATEGORIES, true)) {
            $where .= ' AND a.category = ?';
            $args[] = strtoupper((string)$q['category']);
        }
        if (!empty($q['type']) && in_array(strtoupper((string)$q['type']), ['FLASH', 'BOOST'], true)) {
            $where .= ' AND a.type = ?';
            $args[] = strtoupper((string)$q['type']);
        }
        if (isset($q['minPrice']) && is_numeric($q['minPrice'])) {
            $where .= ' AND a.priceXAF >= ?';
            $args[] = (int)$q['minPrice'];
        }
        if (isset($q['maxPrice']) && is_numeric($q['maxPrice']) && (int)$q['maxPrice'] > 0) {
            $where .= ' AND a.priceXAF <= ?';
            $args[] = (int)$q['maxPrice'];
        }
        if (!empty($q['q'])) {
            $where .= " AND (a.title LIKE ? ESCAPE '!' OR a.description LIKE ? ESCAPE '!')";
            $args[] = $args[] = Db::like(trim((string)$q['q']));
        }
        $off = ($page - 1) * 20;
        $rows = Db::all(
            "SELECT a.*, u.name AS vName, u.shopName AS vShop FROM `Annonce` a JOIN `User` u ON u.id = a.vendorId
             WHERE $where ORDER BY (a.type = 'BOOST') DESC, a.createdAt DESC LIMIT 20 OFFSET $off",
            $args
        );
        return array_map(fn($r) => self::publicView($r, ['name' => $r['vName'], 'shopName' => $r['vShop']]) + ['mine' => $r['vendorId'] === $viewerId], $rows);
    }

    public static function mine(string $vendorId): array
    {
        self::expireDue();
        $rows = Db::all('SELECT * FROM `Annonce` WHERE vendorId = ? AND status <> ? ORDER BY createdAt DESC LIMIT 100', [$vendorId, 'SUPPRIMEE']);
        return array_map([self::class, 'mineView'], $rows);
    }

    /** Detail : une annonce non visible n'est lisible que par son vendeur ou un administrateur. */
    public static function get(string $id, string $viewerId, bool $admin = false): array
    {
        $r = self::row($id);
        $owner = $r['vendorId'] === $viewerId;
        if (!$owner && !$admin && !self::isLive($r)) {
            throw new HttpError('Cette annonce n\'est plus disponible.', 404, 'AD_GONE');
        }
        if (!$owner && !$admin) {
            Db::exec('UPDATE `Annonce` SET views = views + 1 WHERE id = ?', [$id]);
        }
        return $owner ? self::mineView($r) : self::publicView($r) + ['mine' => false];
    }

    /** Coordonnees du vendeur : comptees comme un contact (au plus une fois par jour et par acheteur). */
    public static function contact(string $id, string $userId): array
    {
        $r = self::row($id);
        if (!self::isLive($r)) {
            throw new HttpError('Cette annonce n\'est plus disponible.', 404, 'AD_GONE');
        }
        $v = Db::one('SELECT name, phone FROM `User` WHERE id = ?', [$r['vendorId']]);
        if ($r['vendorId'] !== $userId) {
            try {
                RateLimit::hit("adcontact:$userId:$id", 1, 86400);
                Db::exec('UPDATE `Annonce` SET contacts = contacts + 1 WHERE id = ?', [$id]);
                Notifier::send((string)$r['vendorId'], 'AD', 'Nouveau contact', 'Un acheteur s\'intéresse à « ' . $r['title'] . ' ».', ['adId' => $id]);
            } catch (HttpError) {
                // deja compte aujourd'hui
            }
        }
        return ['phone' => $v['phone'] ?? null, 'name' => $v['name'] ?? null, 'mode' => $r['contactMode']];
    }

    public static function withdraw(string $id, string $vendorId): array
    {
        $r = self::row($id);
        if ($r['vendorId'] !== $vendorId) {
            throw new HttpError('Forbidden', 403);
        }
        if ($r['status'] === 'SUSPENDUE') {
            throw new HttpError('Cette annonce est en cours de vérification par KoliGo.', 409);
        }
        Db::exec("UPDATE `Annonce` SET status = 'SUPPRIMEE', removeReason = 'Retirée par le vendeur', updatedAt = ? WHERE id = ?", [Db::now(), $id]);
        return ['ok' => true];
    }

    /** Republier : nouvelle annonce copiee de l'ancienne (memes photos), en Flash gratuit ou en Boost. */
    public static function republish(string $id, string $vendorId, string $type, ?int $days, ?string $phone): array
    {
        $r = self::row($id);
        if ($r['vendorId'] !== $vendorId) {
            throw new HttpError('Forbidden', 403);
        }
        if (self::isLive($r) || !in_array($r['status'], ['EXPIREE', 'SUPPRIMEE'], true)) {
            throw new HttpError('Seule une annonce expirée ou retirée peut être republiée.', 409, 'AD_NOT_EXPIRED');
        }
        $photos = [];
        foreach (Db::all('SELECT path FROM `AnnoncePhoto` WHERE adId = ? ORDER BY position', [$id]) as $ph) {
            $bytes = is_file((string)$ph['path']) ? (string)file_get_contents((string)$ph['path']) : '';
            if ($bytes !== '') {
                $photos[] = base64_encode($bytes);
            }
        }
        return self::create($vendorId, [
            'title' => $r['title'], 'description' => $r['description'], 'category' => $r['category'], 'priceXAF' => $r['priceXAF'],
            'city' => $r['city'], 'quartier' => $r['quartier'], 'stock' => $r['stock'], 'contactMode' => $r['contactMode'],
            'photos' => $photos, 'type' => $type, 'days' => $days, 'phone' => $phone,
        ]);
    }

    public static function report(string $id, string $userId, string $reason): array
    {
        $reason = mb_substr(trim($reason), 0, 300);
        if (mb_strlen($reason) < 3) {
            throw new HttpError('Indiquez le motif du signalement', 400, 'REPORT_REASON');
        }
        self::row($id);
        if (Db::one('SELECT id FROM `AnnonceReport` WHERE adId = ? AND userId = ?', [$id, $userId])) {
            return ['ok' => true];
        }
        Db::insert('AnnonceReport', ['id' => Db::id(), 'adId' => $id, 'userId' => $userId, 'reason' => $reason, 'createdAt' => Db::now()]);
        return ['ok' => true];
    }

    public static function photoPath(string $id, int $n, string $viewerId, bool $admin): string
    {
        $r = self::row($id);
        if ($r['vendorId'] !== $viewerId && !$admin && !self::isLive($r)) {
            throw new HttpError('Photo introuvable', 404);
        }
        $p = Db::val('SELECT path FROM `AnnoncePhoto` WHERE adId = ? AND position = ?', [$id, max(0, $n)]);
        if (!$p) {
            throw new HttpError('Photo introuvable', 404);
        }
        return (string)$p;
    }

    /** Etat du paiement Boost (interroge le fournisseur si le webhook tarde). */
    public static function paymentStatus(string $id, string $vendorId): array
    {
        $r = self::row($id);
        if ($r['vendorId'] !== $vendorId) {
            throw new HttpError('Forbidden', 403);
        }
        $p = Db::one('SELECT * FROM `AnnoncePayment` WHERE adId = ? ORDER BY createdAt DESC, id DESC LIMIT 1', [$id]);
        if (!$p) {
            return ['status' => 'none', 'adStatus' => $r['status']];
        }
        if ($p['status'] === 'PENDING') {
            // Mode test : le paiement est confirme automatiquement apres 5 s, comme pour la livraison.
            if (Payments::mock() && strtotime($p['createdAt'] . ' UTC') < time() - 5) {
                Payments::handleWebhook(['id' => (string)$p['paymentId'], 'status' => 'SUCCESS', 'reference' => $p['externalRef']]);
            } else {
                Payments::reconcile('AnnoncePayment', $p);
            }
            $p = Db::one('SELECT * FROM `AnnoncePayment` WHERE id = ?', [$p['id']]);
        }
        $status = $p['status'] === 'SUCCESS' ? 'success' : ($p['status'] === 'FAILED' ? 'failed' : 'pending');
        return ['status' => $status, 'adStatus' => self::row($id)['status'], 'amountXAF' => (int)$p['amountXAF']];
    }

    // ── Administration ───────────────────────────────────────────────────────

    /** Derniers paiements Boost, avec l'annonce et le vendeur : sert a suivre un paiement qui tarde. */
    public static function adminPayments(): array
    {
        return Db::all(
            'SELECT p.id, p.adId, p.amountXAF, p.phone, p.status, p.paymentId, p.externalRef, p.createdAt, p.updatedAt, p.gatewayInfo, a.title, a.status AS adStatus, a.type, a.durationHours, u.name AS vendorName, u.phone AS vendorPhone '
            . 'FROM `AnnoncePayment` p LEFT JOIN `Annonce` a ON a.id = p.adId LEFT JOIN `User` u ON u.id = a.vendorId '
            . 'ORDER BY p.createdAt DESC LIMIT 50'
        );
    }

    /**
     * Validation manuelle d'un paiement Boost par un administrateur, sur preuve du debit (reference de l'operateur).
     * Met l'annonce en ligne SANS confirmation de Sungku : la preuve, l'administrateur et l'heure sont conservés (gatewayInfo + journal d'audit).
     */
    public static function adminValidatePayment(string $id, string $adminId, string $proof): array
    {
        $proof = trim($proof);
        if (!preg_match('/^[A-Za-z0-9._\-]{8,60}$/', $proof)) {
            throw new HttpError("Indiquez la référence de l'opérateur pour ce débit (ex. MP261016.1013.D53600)");
        }
        $p = Db::one('SELECT * FROM `AnnoncePayment` WHERE id = ?', [$id]);
        if (!$p) {
            throw new HttpError('Paiement introuvable', 404);
        }
        if ($p['status'] !== 'PENDING') {
            throw new HttpError("Ce paiement n'est pas en attente (statut " . $p['status'] . ')');
        }
        $ad = Db::one('SELECT id, vendorId, status FROM `Annonce` WHERE id = ?', [$p['adId']]);
        if (!$ad || $ad['status'] !== 'BROUILLON') {
            throw new HttpError("L'annonce n'est plus en brouillon (statut " . ($ad['status'] ?? 'introuvable') . ') : validation impossible');
        }
        $now = Db::now();
        $info = json_encode(['at' => $now, 'etape' => 'validation manuelle', 'admin' => $adminId, 'reference' => $proof], JSON_UNESCAPED_UNICODE);
        if (Db::exec("UPDATE `AnnoncePayment` SET status = 'SUCCESS', gatewayInfo = ?, updatedAt = ? WHERE id = ? AND status = 'PENDING'", [$info, $now, $id]) !== 1) {
            throw new HttpError('Ce paiement vient de changer de statut');
        }
        Db::insert('AdminAction', ['id' => Db::id(), 'adminId' => $adminId, 'userId' => (string)$ad['vendorId'], 'action' => 'AD_PAYMENT_MANUAL', 'createdAt' => $now]);
        self::activateBoost((string)$p['adId']);
        return ['status' => 'SUCCESS', 'adStatus' => self::row((string)$p['adId'])['status'], 'message' => "Paiement validé à la main (référence $proof) : l'annonce est en ligne."];
    }

    /**
     * Revérifie un paiement Boost aupres de Sungku, sans delai d'attente, et applique le resultat (annonce en ligne si confirme).
     * Renvoie ce que Sungku a repondu, pour comprendre un paiement bloque.
     */
    public static function adminCheckPayment(string $id): array
    {
        $p = Db::one('SELECT * FROM `AnnoncePayment` WHERE id = ?', [$id]);
        if (!$p) {
            throw new HttpError('Paiement introuvable', 404);
        }
        if ($p['status'] !== 'PENDING') {
            return ['status' => $p['status'], 'message' => 'Ce paiement est déjà clôturé.'];
        }
        if (Payments::mock()) {
            return ['status' => 'PENDING', 'message' => 'Mode test : aucune vérification réelle.'];
        }
        if (empty($p['paymentId'])) {
            return ['status' => 'PENDING', 'message' => "Sungku n'a jamais renvoyé d'identifiant pour cette demande : aucune demande de paiement n'a été créée côté opérateur. Le vendeur peut relancer."];
        }
        try {
            $res = \Koligo\Services\Sungku::fetchDeposit((string)$p['paymentId']);
            Payments::noteGateway('AnnoncePayment', $id, 'revérification');
        } catch (\Throwable $e) {
            Payments::noteGateway('AnnoncePayment', $id, 'revérification');
            return ['status' => 'PENDING', 'message' => 'Sungku ne répond pas : ' . $e->getMessage()];
        }
        $data = $res['data'] ?? $res;
        $remote = (string)($data['status'] ?? '');
        $applied = false;
        if (\Koligo\Services\Sungku::isSettled($remote) || \Koligo\Services\Sungku::isFailed($remote)) {
            Payments::handleWebhook(['id' => $p['paymentId'], 'status' => $remote, 'reference' => $p['externalRef']]);
            $applied = true;
        }
        $now = Db::one('SELECT status FROM `AnnoncePayment` WHERE id = ?', [$id]);
        return ['status' => $now['status'], 'sungkuStatus' => $remote, 'applied' => $applied,
            'message' => $applied ? 'Résultat appliqué.' : "Sungku indique « $remote » : l'opérateur n'a pas encore confirmé ni refusé."];
    }

    public static function adminList(array $q, int $take, int $skip): array
    {
        $where = '1=1';
        $args = [];
        $status = strtoupper((string)($q['status'] ?? ''));
        if (in_array($status, ['BROUILLON', 'ACTIVE', 'EXPIREE', 'SUSPENDUE', 'SUPPRIMEE'], true)) {
            $where .= ' AND a.status = ?';
            $args[] = $status;
        }
        if (in_array(strtoupper((string)($q['type'] ?? '')), ['FLASH', 'BOOST'], true)) {
            $where .= ' AND a.type = ?';
            $args[] = strtoupper((string)$q['type']);
        }
        if (!empty($q['reported'])) {
            $where .= ' AND (SELECT COUNT(*) FROM `AnnonceReport` r WHERE r.adId = a.id) > 0';
        }
        if (!empty($q['q'])) {
            $where .= " AND (a.title LIKE ? ESCAPE '!' OR a.city LIKE ? ESCAPE '!' OR u.name LIKE ? ESCAPE '!')";
            $args[] = $args[] = $args[] = Db::like(trim((string)$q['q']));
        }
        $rows = Db::all(
            "SELECT a.*, u.name AS vendorName, u.phone AS vendorPhone,
                    (SELECT COUNT(*) FROM `AnnonceReport` r WHERE r.adId = a.id) AS reports
             FROM `Annonce` a LEFT JOIN `User` u ON u.id = a.vendorId WHERE $where ORDER BY (a.status = 'SUSPENDUE') DESC, a.createdAt DESC LIMIT $take OFFSET $skip",
            $args
        );
        foreach ($rows as &$r) {
            $r['photoCount'] = self::photoCount($r['id']);
            $r['live'] = self::isLive($r);
            $r['reportList'] = (int)$r['reports'] > 0 ? Db::all('SELECT reason, createdAt FROM `AnnonceReport` WHERE adId = ? ORDER BY createdAt DESC LIMIT 5', [$r['id']]) : [];
        }
        unset($r);
        $stats = [
            'active' => (int)Db::val("SELECT COUNT(*) FROM `Annonce` WHERE status = 'ACTIVE' AND expiresAt > ?", [Db::now()]),
            'pending' => (int)Db::val("SELECT COUNT(*) FROM `Annonce` WHERE status = 'SUSPENDUE'"),
            'reported' => (int)Db::val('SELECT COUNT(DISTINCT adId) FROM `AnnonceReport`'),
            'boostRevenueXAF' => (int)Db::val("SELECT COALESCE(SUM(amountXAF),0) FROM `AnnoncePayment` WHERE status = 'SUCCESS'"),
        ];
        return ['items' => $rows, 'total' => (int)Db::val("SELECT COUNT(*) FROM `Annonce` a LEFT JOIN `User` u ON u.id = a.vendorId WHERE $where", $args), 'stats' => $stats];
    }

    /** action : suspend | restore | remove */
    public static function adminDecide(string $id, string $adminId, string $action, string $reason): array
    {
        $r = self::row($id);
        $reason = mb_substr(trim($reason), 0, 255);
        $now = Db::now();
        if ($action === 'suspend') {
            Db::exec("UPDATE `Annonce` SET status = 'SUSPENDUE', suspendReason = ?, updatedAt = ? WHERE id = ?", [$reason !== '' ? $reason : 'Suspendue par KoliGo', $now, $id]);
            Notifier::send((string)$r['vendorId'], 'AD', 'Annonce suspendue', 'Votre annonce « ' . $r['title'] . ' » a été suspendue par KoliGo' . ($reason !== '' ? " : $reason" : '.'), ['adId' => $id]);
        } elseif ($action === 'restore') {
            $exp = $r['expiresAt'];
            if ($exp === null) {
                // jamais publiee (moderation a la creation) : elle demarre maintenant, Boost impaye exclu
                if ($r['type'] === 'BOOST' && (int)Db::val("SELECT COUNT(*) FROM `AnnoncePayment` WHERE adId = ? AND status = 'SUCCESS'", [$id]) === 0) {
                    throw new HttpError('Cette annonce Boost n\'a pas été payée : le vendeur doit la republier.', 409);
                }
                $exp = gmdate('Y-m-d H:i:s', time() + (int)$r['durationHours'] * 3600);
                Db::exec("UPDATE `Annonce` SET status = 'ACTIVE', publishedAt = ?, expiresAt = ?, suspendReason = NULL, updatedAt = ? WHERE id = ?", [$now, $exp, $now, $id]);
            } else {
                Db::exec('UPDATE `Annonce` SET status = ?, suspendReason = NULL, updatedAt = ? WHERE id = ?', [$exp > $now ? 'ACTIVE' : 'EXPIREE', $now, $id]);
            }
            Notifier::send((string)$r['vendorId'], 'AD', 'Annonce en ligne', 'Votre annonce « ' . $r['title'] . ' » a été validée par KoliGo.', ['adId' => $id]);
        } elseif ($action === 'remove') {
            Db::exec("UPDATE `Annonce` SET status = 'SUPPRIMEE', removeReason = ?, updatedAt = ? WHERE id = ?", [$reason !== '' ? $reason : 'Retirée par KoliGo', $now, $id]);
            Notifier::send((string)$r['vendorId'], 'AD', 'Annonce retirée', 'Votre annonce « ' . $r['title'] . ' » a été retirée par KoliGo' . ($reason !== '' ? " : $reason" : '.'), ['adId' => $id]);
        } else {
            throw new HttpError('Action invalide', 400);
        }
        Db::insert('AdminAction', ['id' => Db::id(), 'adminId' => $adminId, 'userId' => (string)$r['vendorId'], 'action' => 'AD_' . strtoupper($action), 'createdAt' => $now]);
        return self::mineView(self::row($id));
    }
}
