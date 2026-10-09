<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Auth;
use Koligo\Db;
use Koligo\HttpError;

/**
 * Cycle de vie d'une livraison : EN_ATTENTE -> ACCEPTE -> EN_ROUTE -> LIVRE (ANNULE par le vendeur).
 *
 * Entre ACCEPTE et EN_ROUTE, le livreur peut proposer un autre gabarit (GabaritRevision) ;
 * tant qu'une revision est en attente de reponse du vendeur, la collecte est bloquee.
 */
final class Deliveries
{
    public const CATEGORIES = ['CLOTHING', 'DOCUMENTS', 'ELECTRONICS', 'FOOD', 'FRAGILE', 'APPLIANCE', 'OTHER'];

    public static function find(string $id): array
    {
        $d = Db::one('SELECT * FROM `Delivery` WHERE id = ?', [$id]);
        if (!$d) {
            throw new HttpError('Livraison introuvable', 404);
        }
        return $d;
    }

    private static function user(string $id): array
    {
        $u = Db::one('SELECT * FROM `User` WHERE id = ?', [$id]);
        if (!$u) {
            throw new HttpError('Utilisateur introuvable', 404);
        }
        return $u;
    }

    // ── Regles d'acces ───────────────────────────────────────────────────────

    /** Publier : CGU a jour acceptees et KYC Vendeur verifie par le back-office. */
    private static function assertCanPublish(array $u): void
    {
        self::assertCompliant($u, 'VENDOR', 'publier une livraison');
    }

    /** Livrer : CGU a jour acceptees et KYC Livreur verifie par le back-office. */
    public static function assertCanDeliver(array $u): void
    {
        self::assertCompliant($u, 'DELIVERER', 'livrer un colis');
    }

    private static function assertCompliant(array $u, string $role, string $action): void
    {
        if (Cgu::needsAcceptance($u)) {
            throw new HttpError('Vous devez accepter la dernière version des CGU.', 403, 'CGU_REQUIRED');
        }
        $kyc = Kyc::status($u, $role);
        if ($kyc !== 'VERIFIED') {
            throw new HttpError(match ($kyc) {
                'PENDING' => "Votre dossier KYC est en cours de vérification : vous ne pouvez pas encore $action.",
                'REJECTED' => "Votre dossier KYC a été refusé : renvoyez-le pour pouvoir $action.",
                default => "Un dossier KYC validé est requis pour $action.",
            }, 403, 'KYC_REQUIRED');
        }
    }

    // ── Creation ─────────────────────────────────────────────────────────────

    public static function create(string $vendorId, array $p): array
    {
        self::assertCanPublish(self::user($vendorId));

        $type = (string)($p['delivererType'] ?? 'TEMPORAIRE');
        if (!Pricing::isValidType($type)) {
            throw new HttpError('Type de livreur invalide');
        }

        // Gabarit : explicite pour l'app actuelle ; une ancienne app qui n'envoie qu'un poids est convertie.
        $size = isset($p['size']) ? strtoupper(trim((string)$p['size'])) : '';
        $explicit = $size !== '';
        if (!$explicit) {
            $weight = (float)($p['weightKg'] ?? 1);
            if ($weight <= 0 || $weight > 1000) {
                throw new HttpError('Poids invalide');
            }
            $size = Pricing::sizeForWeight($weight) ?? throw new HttpError('Colis trop lourd : contactez le support KoliGo.', 400, 'SIZE_ON_QUOTE');
        }

        $category = isset($p['category']) ? strtoupper(trim((string)$p['category'])) : null;
        if ($explicit && !in_array($category, self::CATEGORIES, true)) {
            throw new HttpError('Indiquez la nature du colis', 400, 'CATEGORY_REQUIRED');
        }
        $photoPath = null;
        if ($explicit) {
            if (empty($p['photo']) || !is_string($p['photo'])) {
                throw new HttpError('Une photo du colis emballé est obligatoire', 400, 'PHOTO_REQUIRED');
            }
            $photoPath = Uploads::storeImage(Uploads::decode($p['photo']), $vendorId, 'parcel');
        }

        // Le prix est toujours calcule ici, jamais pris au client.
        $km = Distance::googleKm($p['pickupAddress'], $p['dropoffAddress'])
            ?? Distance::km($p['pickupAddress'], $p['dropoffAddress'])
            ?? (isset($p['distanceKm']) ? (float)$p['distanceKm'] : 2.0);
        $city = isset($p['fromCity']) ? trim((string)$p['fromCity']) : null;
        $region = Pricing::resolveRegion($city, (string)$p['pickupAddress']);
        $price = Pricing::quote($region, (float)$km, $size, $type);

        $id = Db::id();
        $now = Db::now();
        $collect = Auth::code4();
        $deliver = Auth::code4();
        $clientToken = Auth::signClientToken($id);

        Db::tx(function () use ($id, $now, $vendorId, $p, $type, $size, $category, $photoPath, $city, $km, $price, $collect, $deliver, $clientToken) {
            Db::insert('Delivery', [
                'id' => $id, 'vendorId' => $vendorId,
                'pickupAddress' => $p['pickupAddress'], 'dropoffAddress' => $p['dropoffAddress'],
                // weightKg garde sa colonne : il porte desormais le poids de reference du gabarit.
                'weightKg' => $price['refWeightKg'], 'distanceKm' => $km,
                'size' => $size, 'category' => $category, 'photoPath' => $photoPath, 'fromCity' => $city,
                'priceBreakdown' => json_encode($price, JSON_UNESCAPED_UNICODE),
                'description' => $p['description'] ?? null, 'delivererType' => $type,
                'collectCode' => $collect, 'deliverCode' => $deliver, 'clientToken' => $clientToken,
                'priceXAF' => $price['finalPrice'], 'commissionXAF' => $price['commissionXAF'],
                'delivererEarning' => $price['delivererEarning'],
                'shopName' => $p['shopName'] ?? null, 'recipientName' => $p['recipientName'] ?? null,
                'recipientPhone' => $p['recipientPhone'] ?? null,
                'productPriceXAF' => (int)($p['productPriceXAF'] ?? 0),
                'createdAt' => $now, 'updatedAt' => $now,
            ]);
            Db::insert('EscrowEntry', ['id' => Db::id(), 'deliveryId' => $id, 'amountXAF' => $price['finalPrice'], 'lockedAt' => $now]);
        });

        $d = self::find($id);
        self::notifyNewDelivery($d);
        $vendor = Db::one('SELECT * FROM `User` WHERE id = ?', [$vendorId]);
        if ($vendor) {
            if ($vendor['email']) {
                Notify::email($vendor['email'], '[KoliGo] Livraison créée — code de collecte',
                    '<p>Livraison publiée : ' . htmlspecialchars($d['pickupAddress']) . ' → ' . htmlspecialchars($d['dropoffAddress'])
                    . '</p><p>Prix : ' . Notify::xaf($d['priceXAF']) . ' XAF</p><p>Code de collecte : <b>' . $d['collectCode'] . '</b></p>');
            }
            Notify::whatsapp($vendor['phone'], "✅ KoliGo — Livraison publiée !\n{$d['pickupAddress']} → {$d['dropoffAddress']}\nPrix : " . Notify::xaf($d['priceXAF']) . " XAF\nCode collecte (pour livreur) : *{$d['collectCode']}*");
            if ($d['recipientPhone']) {
                Notify::whatsapp($d['recipientPhone'], "📦 KoliGo — Un colis arrive pour vous !\nDe : " . ($d['shopName'] ?? $d['pickupAddress']) . "\nVotre code de réception : *{$d['deliverCode']}*\nGardez ce code pour confirmer la livraison et payer.");
            }
        }
        return $d;
    }

    /** Offres ouvertes : toutes, sans filtre de ville, jamais celles du livreur lui-meme. 20 par page. */
    public static function listAvailable(string $userId, int $page, ?string $city = null, ?string $quartier = null): array
    {
        $u = self::user($userId);
        $where = "status = 'EN_ATTENTE' AND delivererId IS NULL AND vendorId <> ?";
        $args = [$userId];
        // Filtres facultatifs du livreur : ville ou quartier de collecte.
        if ($city !== null && trim($city) !== '') {
            $where .= ' AND LOWER(fromCity) = ?';
            $args[] = mb_strtolower(trim($city));
        }
        if ($quartier !== null && trim($quartier) !== '') {
            $where .= " AND LOWER(pickupAddress) LIKE ? ESCAPE '!'";
            $args[] = Db::like(mb_strtolower(trim($quartier)));
        }
        $rows = Db::all("SELECT * FROM `Delivery` WHERE $where ORDER BY createdAt DESC LIMIT 20 OFFSET " . (max(1, $page) - 1) * 20, $args);
        foreach ($rows as &$r) {
            // Les codes et le jeton de suivi ne sont jamais montres avant l'acceptation.
            unset($r['collectCode'], $r['deliverCode'], $r['clientToken'], $r['photoPath']);
            $r['vehicleOk'] = Pricing::vehicleFits($u['vehicleType'] ?? null, (string)($r['size'] ?: 'M'));
            $r['requiredVehicle'] = Pricing::config()['gabarits'][$r['size'] ?: 'M']['vehicle'] ?? 'MOTO';
        }
        return $rows;
    }

    // ── Acceptation, annulation ──────────────────────────────────────────────

    /** Previent les livreurs qui peuvent prendre la course : KYC valide, non bloques, vehicule adapte au gabarit. */
    private static function notifyNewDelivery(array $d): void
    {
        try {
            $rows = Db::all("SELECT id, vehicleType FROM `User` WHERE roles LIKE '%DELIVERER%' AND kycStatus = 'VERIFIED' AND isBlocked = 0 AND id <> ? LIMIT 500", [$d['vendorId']]);
            $ids = [];
            foreach ($rows as $r) {
                if (Pricing::vehicleFits($r['vehicleType'] ?? null, (string)($d['size'] ?: 'M'))) {
                    $ids[] = $r['id'];
                }
            }
            $where = trim(($d['fromCity'] ? $d['fromCity'] . ' · ' : '') . $d['pickupAddress'] . ' → ' . $d['dropoffAddress']);
            Notifier::sendMany($ids, 'NEW_DELIVERY', 'Nouvelle course disponible', $where . ' · ' . Notify::xaf((int)$d['delivererEarning']) . ' F pour vous', ['deliveryId' => $d['id']]);
        } catch (\Throwable $e) {
            error_log('[notif] ' . $e->getMessage());
        }
    }

    public static function accept(string $id, string $delivererId): array
    {
        $d = self::find($id);
        $u = self::user($delivererId);
        if ($d['vendorId'] === $delivererId) {
            throw new HttpError('Vous ne pouvez pas livrer votre propre colis.', 403, 'SELF_DELIVERY');
        }
        self::assertCanDeliver($u);
        if (!Pricing::vehicleFits($u['vehicleType'] ?? null, (string)($d['size'] ?: 'M'))) {
            throw new HttpError('Votre véhicule ne peut pas transporter ce gabarit.', 403, 'VEHICLE_MISMATCH');
        }
        // UPDATE conditionnel : deux livreurs qui acceptent en meme temps, un seul gagne.
        $won = Db::exec(
            "UPDATE `Delivery` SET status = 'ACCEPTE', delivererId = ?, updatedAt = ? WHERE id = ? AND status = 'EN_ATTENTE'",
            [$delivererId, Db::now(), $id]
        );
        if ($won !== 1) {
            throw new HttpError('Delivery not available');
        }
        $deliverer = Db::one('SELECT name FROM `User` WHERE id = ?', [$delivererId]);
        $vendor = Db::one('SELECT * FROM `User` WHERE id = ?', [$d['vendorId']]);
        $who = $deliverer['name'] ?? 'Un livreur';
        Notifier::send((string)$d['vendorId'], 'DELIVERY_ACCEPTED', 'Course acceptée', "$who a accepté votre livraison et se rend chez vous.", ['deliveryId' => $id]);
        if ($vendor) {
            if ($vendor['email']) {
                Notify::email($vendor['email'], '[KoliGo] Un livreur a accepté votre course', "<p>$who a accepté votre livraison.</p>");
            }
            Notify::whatsapp($vendor['phone'], "🛵 KoliGo — $who a accepté votre livraison !\n{$d['pickupAddress']} → {$d['dropoffAddress']}\nIl est en route vers vous.");
        }
        if ($d['recipientPhone']) {
            Notify::whatsapp($d['recipientPhone'], "🛵 KoliGo — $who prend en charge votre colis !\nPréparez votre code de réception.");
        }
        return self::find($id);
    }

    /**
     * Annulation par le vendeur. Gratuite tant que personne n'a accepte, et pendant un court delai apres
     * l'acceptation ; ensuite des frais sont dus au livreur deja en route.
     */
    public static function cancel(string $id, string $vendorId): array
    {
        $d = self::find($id);
        if ($d['vendorId'] !== $vendorId) {
            throw new HttpError('Forbidden');
        }
        if (self::pendingRevision($id)) {
            return self::respondRevision($id, $vendorId, false);
        }
        $cfg = Pricing::config();
        $fee = 0;
        if ($d['status'] === 'ACCEPTE') {
            $acceptedAgo = time() - (int)strtotime($d['updatedAt'] . ' UTC');
            if ($acceptedAgo > $cfg['cancelGraceMin'] * 60) {
                $fee = $cfg['cancelFee'];
            }
        }
        $now = Db::now();
        $n = Db::exec(
            "UPDATE `Delivery` SET status = 'ANNULE', updatedAt = ? WHERE id = ? AND status IN ('EN_ATTENTE','ACCEPTE')",
            [$now, $id]
        );
        if ($n !== 1) {
            throw new HttpError('Cannot cancel in current state');
        }
        Db::exec('UPDATE `EscrowEntry` SET releasedAt = ? WHERE deliveryId = ?', [$now, $id]);
        if ($fee > 0 && $d['delivererId']) {
            self::chargeCancelFee($vendorId, (string)$d['delivererId'], $fee, $id, "Frais d'annulation (course déjà en route)");
        }
        if ($d['delivererId']) {
            Notifier::send((string)$d['delivererId'], 'DELIVERY_CANCELLED', 'Course annulée', 'Le vendeur a annulé la course' . ($fee > 0 ? " : $fee F vous seront versés en dédommagement." : '.'), ['deliveryId' => $id]);
        }
        return self::find($id);
    }

    // ── Controle du gabarit a la collecte ────────────────────────────────────

    /** Revision en attente et non expiree ; une revision expiree annule la course sans frais. */
    public static function pendingRevision(string $deliveryId): ?array
    {
        $rev = Db::one("SELECT * FROM `GabaritRevision` WHERE deliveryId = ? AND status = 'PENDING' ORDER BY createdAt DESC LIMIT 1", [$deliveryId]);
        if (!$rev) {
            return null;
        }
        if ($rev['expiresAt'] >= Db::now()) {
            return $rev;
        }
        $now = Db::now();
        if (Db::exec("UPDATE `GabaritRevision` SET status = 'EXPIRED', respondedAt = ? WHERE id = ? AND status = 'PENDING'", [$now, $rev['id']]) === 1) {
            Db::exec("UPDATE `Delivery` SET status = 'ANNULE', updatedAt = ? WHERE id = ? AND status = 'ACCEPTE'", [$now, $deliveryId]);
            Db::exec('UPDATE `EscrowEntry` SET releasedAt = ? WHERE deliveryId = ?', [$now, $deliveryId]);
        }
        return null;
    }

    public static function latestRevision(string $deliveryId): ?array
    {
        self::pendingRevision($deliveryId); // applique l'expiration eventuelle
        return Db::one('SELECT * FROM `GabaritRevision` WHERE deliveryId = ? ORDER BY createdAt DESC LIMIT 1', [$deliveryId]);
    }

    public static function proposeRevision(string $id, string $delivererId, string $size, string $photo): array
    {
        $d = self::find($id);
        if ($d['delivererId'] !== $delivererId) {
            throw new HttpError('Forbidden', 403);
        }
        if ($d['status'] !== 'ACCEPTE') {
            throw new HttpError('Le gabarit ne peut plus être corrigé : le colis est déjà parti.', 409, 'WRONG_STATE');
        }
        if (self::pendingRevision($id)) {
            throw new HttpError('Une correction est déjà en attente de réponse du vendeur.', 409, 'REVISION_PENDING');
        }
        $size = strtoupper(trim($size));
        $declared = (string)($d['size'] ?: 'M');
        if ($size === $declared) {
            throw new HttpError('Le gabarit proposé est identique au gabarit déclaré.');
        }
        if ($photo === '') {
            throw new HttpError('Une photo du colis est obligatoire pour corriger le gabarit', 400, 'PHOTO_REQUIRED');
        }
        $bd = json_decode((string)$d['priceBreakdown'], true);
        if (!is_array($bd)) {
            throw new HttpError('Cette livraison ne peut pas être révisée (ancien format).', 409, 'LEGACY_DELIVERY');
        }
        $new = Pricing::requote($bd, $size);
        $photoPath = Uploads::storeImage(Uploads::decode($photo), $delivererId, 'revision');
        $now = Db::now();
        $expires = gmdate('Y-m-d H:i:s', time() + Pricing::config()['revisionTimeoutMin'] * 60);
        $rid = Db::id();
        Db::insert('GabaritRevision', [
            'id' => $rid, 'deliveryId' => $id, 'proposedSize' => $size, 'declaredSize' => $declared, 'photoPath' => $photoPath,
            'oldPriceXAF' => (int)$d['priceXAF'], 'newPriceXAF' => $new['finalPrice'], 'status' => 'PENDING',
            'expiresAt' => $expires, 'createdAt' => $now,
        ]);
        Notifier::send((string)$d['vendorId'], 'REVISION_PROPOSED', 'Correction du gabarit', "Le livreur propose le gabarit $size au lieu de $declared (nouveau prix : " . Notify::xaf($new['finalPrice']) . ' F). Répondez avant expiration.', ['deliveryId' => $id]);
        $vendor = Db::one('SELECT phone FROM `User` WHERE id = ?', [$d['vendorId']]);
        if ($vendor) {
            Notify::whatsapp($vendor['phone'], "⚠️ KoliGo — Le livreur propose le gabarit $size au lieu de $declared.\nNouveau prix : " . Notify::xaf($new['finalPrice']) . ' XAF (avant : ' . Notify::xaf((int)$d['priceXAF']) . " XAF).\nOuvrez l'application pour accepter ou refuser.");
        }
        return Db::one('SELECT * FROM `GabaritRevision` WHERE id = ?', [$rid]);
    }

    /** Reponse du vendeur : accepter applique le nouveau prix, refuser annule la course et facture les frais. */
    public static function respondRevision(string $id, string $vendorId, bool $accept): array
    {
        $d = self::find($id);
        if ($d['vendorId'] !== $vendorId) {
            throw new HttpError('Forbidden', 403);
        }
        $rev = self::pendingRevision($id);
        if (!$rev) {
            throw new HttpError('Aucune correction en attente (délai dépassé : la course a été annulée sans frais).', 409, 'REVISION_EXPIRED');
        }
        $now = Db::now();
        if ($accept) {
            $bd = json_decode((string)$d['priceBreakdown'], true);
            $new = Pricing::requote(is_array($bd) ? $bd : [], $rev['proposedSize']);
            $new['revisedFrom'] = $rev['declaredSize'];
            Db::tx(function () use ($id, $rev, $new, $now) {
                if (Db::exec("UPDATE `GabaritRevision` SET status = 'ACCEPTED', respondedAt = ? WHERE id = ? AND status = 'PENDING'", [$now, $rev['id']]) !== 1) {
                    throw new HttpError('Correction déjà traitée', 409);
                }
                Db::exec(
                    'UPDATE `Delivery` SET size = ?, weightKg = ?, priceBreakdown = ?, priceXAF = ?, commissionXAF = ?, delivererEarning = ?, updatedAt = ? WHERE id = ?',
                    [$new['size'], $new['refWeightKg'], json_encode($new, JSON_UNESCAPED_UNICODE), $new['finalPrice'], $new['commissionXAF'], $new['delivererEarning'], $now, $id]
                );
                Db::exec('UPDATE `EscrowEntry` SET amountXAF = ? WHERE deliveryId = ?', [$new['finalPrice'], $id]);
            });
            Notifier::send((string)$d['delivererId'], 'REVISION_ACCEPTED', 'Correction acceptée', 'Le vendeur a accepté le nouveau prix : vous pouvez collecter le colis.', ['deliveryId' => $id]);
            return self::find($id);
        }

        $fee = Pricing::config()['cancelFee'];
        Db::tx(function () use ($id, $rev, $now, $fee) {
            if (Db::exec("UPDATE `GabaritRevision` SET status = 'REFUSED', feeXAF = ?, respondedAt = ? WHERE id = ? AND status = 'PENDING'", [$fee, $now, $rev['id']]) !== 1) {
                throw new HttpError('Correction déjà traitée', 409);
            }
            Db::exec("UPDATE `Delivery` SET status = 'ANNULE', updatedAt = ? WHERE id = ? AND status = 'ACCEPTE'", [$now, $id]);
            Db::exec('UPDATE `EscrowEntry` SET releasedAt = ? WHERE deliveryId = ?', [$now, $id]);
        });
        self::chargeCancelFee($vendorId, (string)$d['delivererId'], $fee, $id, 'Frais d\'annulation (prix révisé refusé)');
        Notifier::send((string)$d['delivererId'], 'REVISION_REFUSED', 'Correction refusée', "Le vendeur a refusé : course annulée, $fee F de dédommagement vous sont dus.", ['deliveryId' => $id]);
        return self::find($id);
    }

    /**
     * Ecarts confirmes du vendeur sur la fenetre glissante : corrections acceptees ou refusees.
     * Au-dela du seuil, le vendeur passe en controle renforce (voir CGU article 10).
     */
    public static function strikeInfo(string $vendorId): array
    {
        $cfg = Pricing::config();
        $since = gmdate('Y-m-d H:i:s', time() - $cfg['strikeWindowDays'] * 86400);
        $count = (int)Db::val(
            "SELECT COUNT(*) FROM `GabaritRevision` r JOIN `Delivery` d ON d.id = r.deliveryId WHERE d.vendorId = ? AND r.status IN ('ACCEPTED','REFUSED') AND r.respondedAt >= ?",
            [$vendorId, $since]
        );
        return ['count' => $count, 'threshold' => $cfg['strikeThreshold'], 'windowDays' => $cfg['strikeWindowDays'], 'enhancedControl' => $count >= $cfg['strikeThreshold']];
    }

    /**
     * Debite le vendeur et credite le livreur. Si le solde du vendeur ne couvre pas les frais, le solde est
     * mis a zero et le reste devient une dette recuperee sur ses prochains gains (CGU 9.2).
     */
    private static function chargeCancelFee(string $vendorId, string $delivererId, int $fee, string $deliveryId, string $label): void
    {
        if ($fee <= 0) {
            return;
        }
        Db::tx(function () use ($vendorId, $delivererId, $fee, $deliveryId, $label) {
            $now = Db::now();
            $vw = self::walletOf($vendorId, $now);
            $taken = min($fee, max(0, (int)$vw['balanceXAF']));
            $debt = $fee - $taken;
            Db::exec('UPDATE `Wallet` SET balanceXAF = balanceXAF - ?, debtXAF = debtXAF + ?, updatedAt = ? WHERE id = ?', [$taken, $debt, $now, $vw['id']]);
            Db::insert('Transaction', [
                'id' => Db::id(), 'walletId' => $vw['id'], 'type' => 'CANCEL_FEE_PAID', 'amountXAF' => $fee, 'deliveryId' => $deliveryId,
                'description' => $label . ($debt > 0 ? ' — ' . $debt . ' F déduits de vos prochains gains' : ''), 'createdAt' => $now,
            ]);
            $dw = self::walletOf($delivererId, $now);
            Db::exec('UPDATE `Wallet` SET balanceXAF = balanceXAF + ?, updatedAt = ? WHERE id = ?', [$fee, $now, $dw['id']]);
            Db::insert('Transaction', [
                'id' => Db::id(), 'walletId' => $dw['id'], 'type' => 'CANCEL_FEE_RECEIVED', 'amountXAF' => $fee, 'deliveryId' => $deliveryId,
                'description' => "Dédommagement d'annulation", 'createdAt' => $now,
            ]);
        });
    }

    private static function walletOf(string $userId, string $now): array
    {
        $w = Db::one('SELECT * FROM `Wallet` WHERE userId = ?', [$userId]);
        if ($w) {
            return $w;
        }
        $w = ['id' => Db::id(), 'userId' => $userId, 'balanceXAF' => 0, 'debtXAF' => 0];
        Db::insert('Wallet', ['id' => $w['id'], 'userId' => $userId, 'balanceXAF' => 0, 'updatedAt' => $now]);
        return $w;
    }

    // ── Collecte, livraison ──────────────────────────────────────────────────

    public static function confirmCollect(string $id, string $delivererId, string $code): array
    {
        $d = self::find($id);
        if ($d['delivererId'] !== $delivererId) {
            throw new HttpError('Forbidden');
        }
        if (self::pendingRevision($id)) {
            throw new HttpError('Le vendeur doit d\'abord répondre à la correction du gabarit.', 409, 'REVISION_PENDING');
        }
        $d = self::find($id); // l'expiration d'une correction a pu annuler la course
        if ($d['status'] !== 'ACCEPTE') {
            throw new HttpError('Wrong state');
        }
        if (!hash_equals((string)$d['collectCode'], $code)) {
            throw new HttpError('Wrong collect code');
        }
        Db::exec("UPDATE `Delivery` SET status = 'EN_ROUTE', updatedAt = ? WHERE id = ? AND status = 'ACCEPTE'", [Db::now(), $id]);
        Notifier::send((string)$d['vendorId'], 'DELIVERY_PICKED_UP', 'Colis collecté', 'Le livreur a récupéré votre colis et est en route vers le destinataire.', ['deliveryId' => $id]);
        return self::find($id);
    }

    public static function confirmDeliver(string $id, string $delivererId, string $code, ?string $momoRef): array
    {
        $d = self::find($id);
        if ($d['delivererId'] !== $delivererId) {
            throw new HttpError('Forbidden');
        }
        if ($d['status'] !== 'EN_ROUTE') {
            throw new HttpError('Wrong state');
        }
        if (!hash_equals((string)$d['deliverCode'], $code)) {
            throw new HttpError('Wrong delivery code');
        }
        self::releaseAndCredit($d, $momoRef);
        return self::find($id);
    }

    /** Appele une fois le paiement du destinataire confirme par la passerelle. */
    public static function confirmDeliverByPayment(string $id, string $momoRef): void
    {
        $d = self::find($id);
        if ($d['status'] === 'LIVRE') {
            return; // idempotent
        }
        if ($d['status'] !== 'EN_ROUTE') {
            throw new HttpError('Wrong state for payment confirmation');
        }
        self::releaseAndCredit($d, $momoRef);
    }

    /**
     * Passe la livraison a LIVRE et credite le livreur, une seule fois : le
     * UPDATE conditionnel sur EN_ROUTE departage un webhook et une confirmation
     * manuelle simultanes, sans quoi le livreur serait credite deux fois.
     */
    private static function releaseAndCredit(array $d, ?string $momoRef): void
    {
        $credited = Db::tx(function () use ($d, $momoRef) {
            $now = Db::now();
            $won = Db::exec(
                "UPDATE `Delivery` SET status = 'LIVRE', momoRef = COALESCE(?, momoRef), updatedAt = ? WHERE id = ? AND status = 'EN_ROUTE'",
                [$momoRef, $now, $d['id']]
            );
            if ($won !== 1) {
                return false;
            }
            Db::exec('UPDATE `EscrowEntry` SET releasedAt = ? WHERE deliveryId = ?', [$now, $d['id']]);

            $wallet = self::walletOf((string)$d['delivererId'], $now);
            $earning = (int)$d['delivererEarning'];
            // Dette de frais d'annulation : recuperee sur les gains avant tout versement.
            $repay = min($earning, max(0, (int)($wallet['debtXAF'] ?? 0)));
            Db::exec('UPDATE `Wallet` SET balanceXAF = balanceXAF + ?, debtXAF = debtXAF - ?, updatedAt = ? WHERE id = ?', [$earning - $repay, $repay, $now, $wallet['id']]);
            Db::insert('Transaction', [
                'id' => Db::id(), 'walletId' => $wallet['id'], 'type' => 'EARNING',
                'amountXAF' => $earning, 'deliveryId' => $d['id'],
                'description' => $repay > 0 ? "Course livrée — $repay F retenus (frais d'annulation dus)" : null, 'createdAt' => $now,
            ]);
            return true;
        });
        if (!$credited) {
            return;
        }

        Notifier::send((string)$d['vendorId'], 'DELIVERY_DELIVERED', 'Colis livré', 'Votre colis a été livré à ' . $d['dropoffAddress'] . '.', ['deliveryId' => $d['id']]);
        Notifier::send((string)$d['delivererId'], 'EARNING', 'Gain reçu', 'Course livrée : ' . Notify::xaf((int)$d['delivererEarning']) . ' F crédités sur votre wallet.', ['deliveryId' => $d['id']]);
        $deliverer = Db::one('SELECT * FROM `User` WHERE id = ?', [$d['delivererId']]);
        $vendor = Db::one('SELECT * FROM `User` WHERE id = ?', [$d['vendorId']]);
        $ref = strtoupper(substr($d['id'], -8));
        if ($deliverer) {
            if ($deliverer['email']) {
                Notify::email($deliverer['email'], '[KoliGo] Livraison complète · Gains crédités', '<p>Gains crédités : <b>' . Notify::xaf($d['delivererEarning']) . ' XAF</b></p>');
            }
            Notify::whatsapp($deliverer['phone'], "✅ KoliGo — Course payée !\nGains crédités : *" . Notify::xaf($d['delivererEarning']) . " XAF*\nDestination : {$d['dropoffAddress']}\nRéf. : $ref");
        }
        if ($vendor) {
            if ($vendor['email']) {
                Notify::email($vendor['email'], '[KoliGo] Colis livré', '<p>Votre colis a été livré à ' . htmlspecialchars($d['dropoffAddress']) . '.</p>');
            }
            Notify::whatsapp($vendor['phone'], "✅ KoliGo — Colis livré avec succès !\nDestinataire à : {$d['dropoffAddress']}\nMontant transport : " . Notify::xaf($d['priceXAF']) . " XAF\nRéf. : $ref");
        }
    }
}
