<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Auth;
use Koligo\Db;
use Koligo\HttpError;

/** Cycle de vie d'une livraison : EN_ATTENTE -> ACCEPTE -> EN_ROUTE -> LIVRE (ANNULE par le vendeur). */
final class Deliveries
{
    public static function find(string $id): array
    {
        $d = Db::one('SELECT * FROM `Delivery` WHERE id = ?', [$id]);
        if (!$d) {
            throw new HttpError('Livraison introuvable', 404);
        }
        return $d;
    }

    public static function create(string $vendorId, array $p): array
    {
        $type = (string)($p['delivererType'] ?? 'TEMPORAIRE');
        if (!Pricing::isValidType($type)) {
            throw new HttpError('Type de livreur invalide');
        }
        $weight = (float)($p['weightKg'] ?? 1);
        if ($weight <= 0 || $weight > 1000) {
            throw new HttpError('Poids invalide');
        }
        // Le prix est toujours calcule ici, jamais pris au client.
        $km = Distance::googleKm($p['pickupAddress'], $p['dropoffAddress'])
            ?? Distance::km($p['pickupAddress'], $p['dropoffAddress'])
            ?? (isset($p['distanceKm']) ? (float)$p['distanceKm'] : 2.0);
        $price = Pricing::calculate($km, $weight, $type);

        $id = Db::id();
        $now = Db::now();
        $collect = Auth::code4();
        $deliver = Auth::code4();
        $clientToken = Auth::signClientToken($id);

        Db::tx(function () use ($id, $now, $vendorId, $p, $type, $weight, $km, $price, $collect, $deliver, $clientToken) {
            Db::insert('Delivery', [
                'id' => $id, 'vendorId' => $vendorId,
                'pickupAddress' => $p['pickupAddress'], 'dropoffAddress' => $p['dropoffAddress'],
                'weightKg' => $weight, 'distanceKm' => $km,
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

    public static function accept(string $id, string $delivererId): array
    {
        $d = self::find($id);
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

    public static function cancel(string $id, string $vendorId): array
    {
        $d = self::find($id);
        if ($d['vendorId'] !== $vendorId) {
            throw new HttpError('Forbidden');
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
        return self::find($id);
    }

    public static function confirmCollect(string $id, string $delivererId, string $code): array
    {
        $d = self::find($id);
        if ($d['delivererId'] !== $delivererId) {
            throw new HttpError('Forbidden');
        }
        if ($d['status'] !== 'ACCEPTE') {
            throw new HttpError('Wrong state');
        }
        if (!hash_equals((string)$d['collectCode'], $code)) {
            throw new HttpError('Wrong collect code');
        }
        Db::exec("UPDATE `Delivery` SET status = 'EN_ROUTE', updatedAt = ? WHERE id = ? AND status = 'ACCEPTE'", [Db::now(), $id]);
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

            $wallet = Db::one('SELECT id FROM `Wallet` WHERE userId = ?', [$d['delivererId']]);
            if (!$wallet) {
                $wallet = ['id' => Db::id()];
                Db::insert('Wallet', ['id' => $wallet['id'], 'userId' => $d['delivererId'], 'balanceXAF' => 0, 'updatedAt' => $now]);
            }
            Db::exec('UPDATE `Wallet` SET balanceXAF = balanceXAF + ?, updatedAt = ? WHERE id = ?', [$d['delivererEarning'], $now, $wallet['id']]);
            Db::insert('Transaction', [
                'id' => Db::id(), 'walletId' => $wallet['id'], 'type' => 'EARNING',
                'amountXAF' => $d['delivererEarning'], 'deliveryId' => $d['id'], 'createdAt' => $now,
            ]);
            return true;
        });
        if (!$credited) {
            return;
        }

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
