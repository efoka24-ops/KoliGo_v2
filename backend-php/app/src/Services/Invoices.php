<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\HttpError;

/**
 * Factures generees a la demande a partir de la livraison (aucune table : une
 * facture est une vue figee par les montants calcules a la creation).
 *
 * Trois documents, chacun avec son emetteur, son destinataire et son contenu :
 *  - sale     : VENTE. Le vendeur facture son client (produit + frais de livraison).
 *  - payment  : PAIEMENT. Recu du reglement du transport par le destinataire, encaisse par KoliGo.
 *  - delivery : LIVRAISON. Releve de course du livreur : calcul du prix, commission, gain net.
 *
 * Forme commune : title, number, issuedAt, accent, issuer{label,name,phone}, billedTo{...},
 * details[] (blocs {title, rows[{label,value,bold?}]} propres a chaque type), lines[], total.
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
    private const ACCENT = ['sale' => '#178A3C', 'payment' => '#E8551C', 'delivery' => '#0E2A1C'];
    private const TYPE_LABEL = [
        'TEMPORAIRE' => 'Temporaire', 'PERMANENT' => 'Permanent', 'EXPRESS' => 'Express',
        'VVIP' => 'VVIP', 'INTERURBAIN' => 'Interurbain', 'FROID_FRAGILE' => 'Froid / fragile',
    ];

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

    private static function digits(?string $phone): string
    {
        $p = preg_replace('/\D/', '', (string)$phone) ?? '';
        return preg_replace('/^237/', '', $p) ?? '';
    }

    private static function mask(?string $phone): ?string
    {
        $p = self::digits($phone);
        return strlen($p) >= 6 ? substr($p, 0, 1) . str_repeat('*', strlen($p) - 4) . substr($p, -3) : null;
    }

    private static function phone(?string $phone): ?string
    {
        $p = self::digits($phone);
        return $p === '' ? null : '+237 ' . $p;
    }

    private static function xaf(int $n): string
    {
        return number_format($n, 0, ',', ' ') . ' XAF';
    }

    private static function when(?string $sql): ?string
    {
        return $sql ? gmdate('Y-m-d H:i:s', strtotime($sql . ' UTC')) : null;
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

        $vendor = Db::one('SELECT name, phone, shopName FROM `User` WHERE id = ?', [$d['vendorId']]) ?? [];
        $deliverer = $d['delivererId'] ? Db::one('SELECT name, phone FROM `User` WHERE id = ?', [$d['delivererId']]) : null;
        $pay = Db::one("SELECT * FROM `DeliveryPayment` WHERE deliveryId = ? AND status = 'SUCCESS' ORDER BY updatedAt DESC LIMIT 1", [$d['id']]);

        $ref = strtoupper(substr($d['id'], -8));
        $price = (int)$d['priceXAF'];
        $product = (int)$d['productPriceXAF'];
        $shop = $d['shopName'] ?: ($vendor['shopName'] ?? null) ?: ($vendor['name'] ?? null);
        $route = $d['pickupAddress'] . ' → ' . $d['dropoffAddress'];
        $recipient = ['name' => $d['recipientName'] ?: 'Destinataire', 'phone' => self::phone($d['recipientPhone'])];
        $deliveredAt = $d['status'] === 'LIVRE' ? self::when($d['updatedAt']) : null;

        $base = [
            'type' => $type,
            'title' => self::TITLES[$type],
            'number' => self::number($d, $type),
            'accent' => self::ACCENT[$type],
            'currency' => 'XAF',
            'delivery' => [
                'id' => $d['id'], 'ref' => $ref, 'status' => $d['status'],
                'pickupAddress' => $d['pickupAddress'], 'dropoffAddress' => $d['dropoffAddress'],
                'description' => $d['description'], 'weightKg' => $d['weightKg'], 'distanceKm' => $d['distanceKm'],
                'createdAt' => $d['createdAt'],
            ],
            'disclaimer' => "Document généré par la plateforme KoliGo ; il n'a pas valeur de facture fiscale.",
        ];

        if ($type === 'sale') {
            $lines = [];
            if ($product > 0 || $d['description']) {
                $lines[] = ['label' => 'Produit : ' . ($d['description'] ?: 'colis') . ($product > 0 ? '' : ' (prix non renseigné)'), 'amountXAF' => $product];
            }
            $lines[] = ['label' => 'Frais de livraison KoliGo', 'amountXAF' => $price];
            return $base + [
                'issuedAt' => $d['createdAt'],
                'issuer' => ['label' => 'Vendeur', 'name' => $shop, 'subname' => ($vendor['name'] ?? null) !== $shop ? ($vendor['name'] ?? null) : null, 'phone' => self::phone($vendor['phone'] ?? null)],
                'billedTo' => ['label' => 'Facturé au client', 'name' => $recipient['name'], 'phone' => $recipient['phone']],
                'details' => [
                    ['title' => 'Vente', 'rows' => array_values(array_filter([
                        ['label' => 'Boutique', 'value' => $shop],
                        ['label' => 'Produit', 'value' => $d['description'] ?: '—'],
                        ['label' => 'Prix du produit', 'value' => $product > 0 ? self::xaf($product) : 'non renseigné', 'bold' => $product > 0],
                        ['label' => 'Référence colis', 'value' => $ref],
                    ]))],
                    ['title' => 'Livraison associée', 'rows' => array_values(array_filter([
                        ['label' => 'Trajet', 'value' => $route],
                        ['label' => 'Poids', 'value' => $d['weightKg'] ? $d['weightKg'] . ' kg' : null],
                        ['label' => 'Statut', 'value' => $d['status'] === 'LIVRE' ? 'Livré' : 'En cours'],
                    ], fn($r) => $r['value']))],
                    ['title' => 'Règlement', 'rows' => [
                        ['label' => 'Produit', 'value' => $product > 0 ? 'à régler au vendeur (hors plateforme)' : '—'],
                        ['label' => 'Frais de livraison', 'value' => 'payés par mobile money à la réception'],
                    ]],
                ],
                'lines' => $lines,
                'total' => $product + $price,
                'totalLabel' => 'TOTAL À RÉGLER PAR LE CLIENT',
            ];
        }

        if ($type === 'payment') {
            $paidAt = $pay ? self::when($pay['updatedAt']) : $deliveredAt;
            $rows = $pay
                ? [
                    ['label' => 'Statut', 'value' => 'Payé', 'bold' => true],
                    ['label' => 'Mode', 'value' => 'Mobile money (Sungku)'],
                    ['label' => 'Numéro payeur', 'value' => self::mask($pay['phone'])],
                    ['label' => 'Référence', 'value' => $pay['externalRef']],
                    ['label' => 'Transaction', 'value' => $pay['paymentId']],
                    ['label' => 'Payé le', 'value' => $paidAt, 'date' => true],
                ]
                : [
                    ['label' => 'Statut', 'value' => 'Réglé', 'bold' => true],
                    ['label' => 'Mode', 'value' => 'Code de réception (confirmé par le livreur)'],
                    ['label' => 'Référence', 'value' => $d['momoRef']],
                    ['label' => 'Réglé le', 'value' => $paidAt, 'date' => true],
                ];
            return $base + [
                'issuedAt' => $paidAt ?? $d['createdAt'],
                'issuer' => ['label' => 'Encaissé par', 'name' => 'KoliGo', 'subname' => 'Plateforme de livraison', 'phone' => null],
                'billedTo' => ['label' => 'Payé par', 'name' => $recipient['name'], 'phone' => $recipient['phone']],
                'details' => [
                    ['title' => 'Reçu de paiement', 'rows' => array_values(array_filter($rows, fn($r) => $r['value']))],
                    ['title' => 'Prestation payée', 'rows' => array_values(array_filter([
                        ['label' => 'Livraison', 'value' => $route],
                        ['label' => 'Colis', 'value' => $ref],
                        ['label' => 'Boutique', 'value' => $shop],
                        ['label' => 'Livreur', 'value' => $deliverer['name'] ?? null],
                    ], fn($r) => $r['value']))],
                ],
                'lines' => [['label' => 'Transport KoliGo — ' . $route, 'amountXAF' => $price]],
                'total' => $price,
                'totalLabel' => 'MONTANT PAYÉ',
            ];
        }

        // delivery : releve de course du livreur, avec le calcul du prix.
        $c = Pricing::DEFAULTS;
        $km = (float)($d['distanceKm'] ?? 0);
        $kg = (float)$d['weightKg'];
        $coef = Pricing::coefficient((string)$d['delivererType']);
        $distPart = (int)round($km * $c['perKmRate']);
        $weightPart = (int)round($kg * $c['weightSurcharge']);
        $commission = (int)$d['commissionXAF'];
        $earning = (int)$d['delivererEarning'];
        return $base + [
            'issuedAt' => $deliveredAt ?? $d['createdAt'],
            'issuer' => ['label' => 'Livreur (prestataire)', 'name' => $deliverer['name'] ?? '—', 'subname' => self::TYPE_LABEL[$d['delivererType']] ?? null, 'phone' => self::phone($deliverer['phone'] ?? null)],
            'billedTo' => ['label' => 'Pour le compte de', 'name' => $shop ?: 'Vendeur', 'phone' => null],
            'details' => [
                ['title' => 'Course effectuée', 'rows' => array_values(array_filter([
                    ['label' => 'Trajet', 'value' => $route],
                    ['label' => 'Distance', 'value' => $km > 0 ? $km . ' km' : null],
                    ['label' => 'Poids', 'value' => $kg > 0 ? $kg . ' kg' : null],
                    ['label' => 'Type de course', 'value' => self::TYPE_LABEL[$d['delivererType']] ?? $d['delivererType']],
                    ['label' => 'Publiée le', 'value' => self::when($d['createdAt']), 'date' => true],
                    ['label' => 'Livrée le', 'value' => $deliveredAt, 'date' => true],
                ], fn($r) => $r['value']))],
                ['title' => 'Calcul du prix de la course', 'rows' => [
                    ['label' => 'Prise en charge', 'value' => self::xaf($c['baseRate'])],
                    ['label' => 'Distance (' . $km . ' km × ' . $c['perKmRate'] . ')', 'value' => self::xaf($distPart)],
                    ['label' => 'Poids (' . $kg . ' kg × ' . $c['weightSurcharge'] . ')', 'value' => self::xaf($weightPart)],
                    ['label' => 'Coefficient ' . (self::TYPE_LABEL[$d['delivererType']] ?? ''), 'value' => '× ' . number_format($coef, 2, ',', '')],
                    ['label' => 'Prix de la course', 'value' => self::xaf($price), 'bold' => true],
                ]],
                ['title' => 'Votre gain', 'rows' => [
                    ['label' => 'Commission KoliGo (' . rtrim(rtrim(number_format($c['commissionRate'] * 100, 1, ',', ''), '0'), ',') . ' %)', 'value' => '- ' . self::xaf($commission)],
                    ['label' => 'Gain net crédité sur le portefeuille', 'value' => self::xaf($earning), 'bold' => true],
                ]],
            ],
            'lines' => [
                ['label' => 'Course ' . $route, 'amountXAF' => $price],
                ['label' => 'Commission KoliGo', 'amountXAF' => -$commission],
            ],
            'total' => $earning,
            'totalLabel' => 'GAIN NET DU LIVREUR',
        ];
    }
}
