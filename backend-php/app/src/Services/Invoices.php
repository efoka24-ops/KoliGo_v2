<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\HttpError;

/**
 * Factures generees a la demande a partir de la livraison (aucune table : une
 * facture est une vue figee par les montants calcules a la creation).
 *
 *  - sale     : facture de VENTE du vendeur au destinataire (produit + frais de livraison)
 *  - payment  : facture de PAIEMENT du destinataire (reglement du transport)
 *  - delivery : facture de LIVRAISON du livreur (prix, commission KoliGo, gain net)
 */
final class Invoices
{
    public const TYPES = ['sale', 'payment', 'delivery'];
    private const TITLES = [
        'sale' => 'Facture de vente',
        'payment' => 'Facture de paiement',
        'delivery' => 'Facture de livraison',
    ];
    private const LETTER = ['sale' => 'V', 'payment' => 'P', 'delivery' => 'L'];

    /** Roles autorises par type de facture. */
    public static function allowedFor(string $type, string $role): bool
    {
        return match ($type) {
            'sale' => in_array($role, ['VENDOR', 'ADMIN'], true),
            'payment' => in_array($role, ['VENDOR', 'ADMIN'], true),
            'delivery' => in_array($role, ['DELIVERER', 'ADMIN'], true),
            default => false,
        };
    }

    public static function number(array $d, string $type): string
    {
        return sprintf('KG-%s-%s-%s', self::LETTER[$type], gmdate('Ymd', strtotime($d['createdAt'] . ' UTC')), strtoupper(substr($d['id'], -8)));
    }

    /** Numeros de facture disponibles pour une livraison (liste du back-office). */
    public static function available(array $d): array
    {
        $out = [];
        foreach (self::TYPES as $t) {
            $ok = $t === 'sale' ? in_array($d['status'], ['ACCEPTE', 'EN_ROUTE', 'LIVRE'], true) : $d['status'] === 'LIVRE';
            if ($ok) {
                $out[$t] = self::number($d, $t);
            }
        }
        return $out;
    }

    private static function mask(?string $phone): ?string
    {
        $p = preg_replace('/\D/', '', (string)$phone) ?? '';
        $p = preg_replace('/^237/', '', $p) ?? '';
        return strlen($p) >= 6 ? substr($p, 0, 1) . str_repeat('*', strlen($p) - 4) . substr($p, -3) : null;
    }

    private static function phone(?string $phone): ?string
    {
        $p = preg_replace('/\D/', '', (string)$phone) ?? '';
        $p = preg_replace('/^237/', '', $p) ?? '';
        return $p === '' ? null : '+237 ' . $p;
    }

    /** @throws HttpError */
    public static function build(string $deliveryId, string $type): array
    {
        if (!in_array($type, self::TYPES, true)) {
            throw new HttpError('Type de facture inconnu');
        }
        $d = Deliveries::find($deliveryId);
        if ($type === 'sale' && !in_array($d['status'], ['ACCEPTE', 'EN_ROUTE', 'LIVRE'], true)) {
            throw new HttpError('La facture de vente est disponible une fois un livreur trouvé.');
        }
        if ($type !== 'sale' && $d['status'] !== 'LIVRE') {
            throw new HttpError('Cette facture sera disponible après la livraison.');
        }

        $vendor = Db::one('SELECT name, phone, shopName FROM `User` WHERE id = ?', [$d['vendorId']]);
        $deliverer = $d['delivererId'] ? Db::one('SELECT name, phone FROM `User` WHERE id = ?', [$d['delivererId']]) : null;
        $pay = Db::one("SELECT * FROM `DeliveryPayment` WHERE deliveryId = ? AND status = 'SUCCESS' ORDER BY updatedAt DESC LIMIT 1", [$d['id']]);

        $price = (int)$d['priceXAF'];
        $product = (int)$d['productPriceXAF'];
        $lines = [];
        $payment = null;
        $notes = [];

        if ($type === 'sale') {
            if ($product > 0) {
                $lines[] = ['label' => 'Produit : ' . ($d['description'] ?: 'colis'), 'amountXAF' => $product];
            }
            $lines[] = ['label' => 'Frais de livraison KoliGo (réglés par le destinataire à la réception)', 'amountXAF' => $price];
            $total = $product + $price;
            $notes[] = $product > 0 ? 'Le montant du produit est à régler au vendeur ; les frais de livraison sont payés par mobile money à la réception.' : 'Les frais de livraison sont payés par mobile money à la réception.';
        } elseif ($type === 'payment') {
            $lines[] = ['label' => 'Frais de livraison KoliGo — ' . $d['pickupAddress'] . ' → ' . $d['dropoffAddress'], 'amountXAF' => $price];
            $total = $price;
            $payment = $pay
                ? ['method' => 'Mobile money (Sungku)', 'reference' => $pay['externalRef'], 'transactionId' => $pay['paymentId'], 'status' => 'Payé', 'paidAt' => $pay['updatedAt'], 'payerPhone' => self::mask($pay['phone'])]
                : ['method' => 'Code de réception (confirmé par le livreur)', 'reference' => $d['momoRef'], 'transactionId' => null, 'status' => 'Réglé', 'paidAt' => $d['updatedAt'], 'payerPhone' => null];
        } else {
            $lines[] = ['label' => 'Course ' . $d['pickupAddress'] . ' → ' . $d['dropoffAddress'], 'amountXAF' => $price];
            $lines[] = ['label' => 'Commission KoliGo', 'amountXAF' => -(int)$d['commissionXAF']];
            $total = (int)$d['delivererEarning'];
            $notes[] = 'Le gain net a été crédité sur votre portefeuille KoliGo.';
        }

        return [
            'type' => $type,
            'title' => self::TITLES[$type],
            'number' => self::number($d, $type),
            'issuedAt' => $d['status'] === 'LIVRE' ? $d['updatedAt'] : $d['createdAt'],
            'currency' => 'XAF',
            'delivery' => [
                'id' => $d['id'], 'ref' => strtoupper(substr($d['id'], -8)), 'status' => $d['status'],
                'pickupAddress' => $d['pickupAddress'], 'dropoffAddress' => $d['dropoffAddress'],
                'description' => $d['description'], 'weightKg' => $d['weightKg'], 'distanceKm' => $d['distanceKm'],
                'createdAt' => $d['createdAt'],
            ],
            'vendor' => ['name' => $vendor['name'] ?? null, 'shopName' => $d['shopName'] ?: ($vendor['shopName'] ?? null), 'phone' => self::phone($vendor['phone'] ?? null)],
            'recipient' => ['name' => $d['recipientName'], 'phone' => self::phone($d['recipientPhone'])],
            'deliverer' => $deliverer ? ['name' => $deliverer['name'], 'phone' => self::phone($deliverer['phone'])] : null,
            'lines' => $lines,
            'total' => $total,
            'payment' => $payment,
            'notes' => $notes,
            'disclaimer' => "Document généré par la plateforme KoliGo ; il n'a pas valeur de facture fiscale.",
        ];
    }
}
