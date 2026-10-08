<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\HttpError;

/**
 * Prix d'une livraison : (prise en charge de la zone + prix/km de la zone + 100 F x poids de reference du gabarit)
 * x coefficient du type de livreur, avec un plancher.
 *
 * Tous les parametres vivent dans PlatformSetting (modifiables depuis le back-office) ; les constantes
 * ci-dessous ne servent que de valeurs par defaut quand une cle n'a jamais ete enregistree.
 * Le detail calcule est renvoye par quote() et conserve sur la livraison : un changement de tarif
 * ne modifie jamais une livraison ni une facture deja creee.
 */
final class Pricing
{
    private const COEFFICIENTS = [
        'TEMPORAIRE' => 1.00,
        'PERMANENT' => 1.15,
        'EXPRESS' => 1.25,
        'VVIP' => 1.40,
        'INTERURBAIN' => 1.00,
        'FROID_FRAGILE' => 1.30,
    ];

    /** Anciennes constantes, encore lues par les factures d'avant le detail conserve. */
    public const DEFAULTS = ['baseRate' => 500, 'perKmRate' => 150, 'weightSurcharge' => 100, 'commissionRate' => 0.03];

    public const VEHICLES = ['MOTO' => 1, 'TRICYCLE' => 2, 'VOITURE' => 3, 'UTILITAIRE' => 4];

    public const DEFAULT_ZONES = [
        ['name' => 'Grand Nord', 'regions' => ['Extrême-Nord', 'Nord', 'Adamaoua'], 'base' => 300, 'perKm' => 100],
        ['name' => 'Intermédiaire', 'regions' => ['Ouest', 'Nord-Ouest', 'Sud-Ouest', 'Est'], 'base' => 400, 'perKm' => 175],
        ['name' => 'Grand Sud', 'regions' => ['Littoral', 'Centre', 'Sud'], 'base' => 500, 'perKm' => 250],
    ];

    public const DEFAULT_GABARITS = [
        'XS' => ['dims' => '35 × 25 × 5', 'maxKg' => 0.5, 'refKg' => 0.5, 'vehicle' => 'MOTO', 'bookable' => true,
            'examples' => ['fr' => 'Documents, bijoux, carte SIM', 'en' => 'Documents, jewellery, SIM card']],
        'S' => ['dims' => '30 × 20 × 15', 'maxKg' => 2, 'refKg' => 2, 'vehicle' => 'MOTO', 'bookable' => true,
            'examples' => ['fr' => 'Téléphone, chaussures, robe pliée', 'en' => 'Phone, shoes, folded dress']],
        'M' => ['dims' => '50 × 40 × 30', 'maxKg' => 8, 'refKg' => 6, 'vehicle' => 'MOTO', 'bookable' => true,
            'examples' => ['fr' => 'Ordinateur portable en carton, fer à repasser, mixeur', 'en' => 'Boxed laptop, iron, blender']],
        'L' => ['dims' => '70 × 50 × 50', 'maxKg' => 20, 'refKg' => 15, 'vehicle' => 'MOTO', 'bookable' => true,
            'examples' => ['fr' => 'Unité centrale et écran, micro-ondes, sac de riz 10 kg', 'en' => 'Desktop PC and screen, microwave, 10 kg bag of rice']],
        'XL' => ['dims' => '120 × 80 × 80', 'maxKg' => 50, 'refKg' => 35, 'vehicle' => 'TRICYCLE', 'bookable' => true,
            'examples' => ['fr' => 'Téléviseur 43 à 55 pouces, petit réfrigérateur', 'en' => '43–55 inch TV, small fridge']],
        'XXL' => ['dims' => null, 'maxKg' => null, 'refKg' => null, 'vehicle' => 'UTILITAIRE', 'bookable' => false,
            'examples' => ['fr' => 'Matelas, meuble, gros électroménager', 'en' => 'Mattress, furniture, large appliance']],
    ];

    public const DEFAULT_SETTINGS = [
        'pricing_zones' => null, // JSON, voir DEFAULT_ZONES
        'pricing_gabarits' => null, // JSON, voir DEFAULT_GABARITS
        'pricing_default_zone' => 'Grand Sud',
        'pricing_min_xaf' => '1000',
        'weight_surcharge_xaf' => '100',
        'commission_rate' => '0.03',
        'cancel_fee_xaf' => '500',
        'revision_timeout_min' => '10',
        'cancel_grace_min' => '2',
        'strike_window_days' => '30',
        'strike_threshold' => '3',
    ];

    private static ?array $cache = null;

    public static function coefficient(string $type): float
    {
        return self::COEFFICIENTS[$type] ?? 1.0;
    }

    public static function isValidType(string $type): bool
    {
        return isset(self::COEFFICIENTS[$type]);
    }

    public static function resetCache(): void
    {
        self::$cache = null;
    }

    /** @return array{zones:array,gabarits:array,defaultZone:string,minPrice:int,weightRate:int,commissionRate:float,cancelFee:int,revisionTimeoutMin:int,cancelGraceMin:int,strikeWindowDays:int,strikeThreshold:int} */
    public static function config(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }
        $raw = [];
        foreach (Db::all('SELECT `key`, `value` FROM `PlatformSetting` WHERE `key` IN (' . implode(',', array_fill(0, count(self::DEFAULT_SETTINGS), '?')) . ')', array_keys(self::DEFAULT_SETTINGS)) as $r) {
            $raw[$r['key']] = (string)$r['value'];
        }
        $get = fn(string $k) => $raw[$k] ?? self::DEFAULT_SETTINGS[$k];
        $zones = json_decode((string)($raw['pricing_zones'] ?? ''), true);
        $gabs = json_decode((string)($raw['pricing_gabarits'] ?? ''), true);
        return self::$cache = [
            'zones' => is_array($zones) && $zones ? $zones : self::DEFAULT_ZONES,
            'gabarits' => is_array($gabs) && $gabs ? $gabs : self::DEFAULT_GABARITS,
            'defaultZone' => (string)$get('pricing_default_zone'),
            'minPrice' => (int)$get('pricing_min_xaf'),
            'weightRate' => (int)$get('weight_surcharge_xaf'),
            // Le back-office historique saisit la commission en pourcentage (3) ; le seed l'ecrit en fraction (0.03).
            'commissionRate' => (static fn(float $r): float => $r > 1 ? $r / 100 : $r)((float)$get('commission_rate')),
            'cancelFee' => (int)$get('cancel_fee_xaf'),
            'revisionTimeoutMin' => max(1, (int)$get('revision_timeout_min')),
            'cancelGraceMin' => max(0, (int)$get('cancel_grace_min')),
            'strikeWindowDays' => max(1, (int)$get('strike_window_days')),
            'strikeThreshold' => max(1, (int)$get('strike_threshold')),
        ];
    }

    /** Zone tarifaire d'une region ; null si aucune zone ne la contient. */
    public static function zoneForRegion(?string $region): ?array
    {
        if ($region !== null) {
            foreach (self::config()['zones'] as $z) {
                if (in_array($region, $z['regions'] ?? [], true)) {
                    return $z;
                }
            }
        }
        return null;
    }

    /**
     * Region d'une livraison. La ville envoyee par l'app prime ; sinon le quartier
     * (une dizaine de noms existent dans plusieurs villes, d'ou la ville explicite).
     */
    public static function resolveRegion(?string $city, string $quartier): ?string
    {
        if ($city !== null && trim($city) !== '') {
            $want = Distance::norm($city);
            foreach (Db::all('SELECT name, region FROM `City`') as $c) {
                if (Distance::norm((string)$c['name']) === $want) {
                    return (string)$c['region'];
                }
            }
        }
        $q = Distance::norm($quartier);
        if ($q !== '') {
            foreach (Db::all('SELECT n.name AS n, c.region AS r FROM `Neighborhood` n JOIN `City` c ON c.id = n.cityId ORDER BY c.name ASC') as $row) {
                if (Distance::norm((string)$row['n']) === $q) {
                    return (string)$row['r'];
                }
            }
        }
        return null;
    }

    /** Plus petit gabarit reservable pouvant porter ce poids (anciennes apps qui envoient encore un poids). */
    public static function sizeForWeight(float $kg): ?string
    {
        foreach (self::config()['gabarits'] as $code => $g) {
            if (($g['bookable'] ?? false) && $g['maxKg'] !== null && $kg <= (float)$g['maxKg']) {
                return (string)$code;
            }
        }
        return null;
    }

    /**
     * Calcule le prix et renvoie le detail complet. Le serveur est la seule source du prix.
     *
     * @return array<string,mixed> clefs : finalPrice, commissionXAF, delivererEarning + detail pour la facture
     */
    public static function quote(?string $region, float $km, string $size, string $type): array
    {
        $cfg = self::config();
        $g = $cfg['gabarits'][$size] ?? null;
        if (!$g) {
            throw new HttpError('Gabarit invalide', 400, 'SIZE_INVALID');
        }
        if (!($g['bookable'] ?? false) || $g['refKg'] === null) {
            throw new HttpError('Ce gabarit est sur devis : contactez le support KoliGo.', 400, 'SIZE_ON_QUOTE');
        }
        if (!self::isValidType($type)) {
            throw new HttpError('Type de livreur invalide');
        }
        $zone = self::zoneForRegion($region);
        $fallback = false;
        if ($zone === null) {
            $fallback = true;
            foreach ($cfg['zones'] as $z) {
                if (($z['name'] ?? '') === $cfg['defaultZone']) {
                    $zone = $z;
                }
            }
            $zone ??= $cfg['zones'][0];
        }
        $coef = self::coefficient($type);
        $refKg = (float)$g['refKg'];
        $subtotal = (float)$zone['base'] + $km * (float)$zone['perKm'] + $cfg['weightRate'] * $refKg;
        $raw = (int)round($subtotal * $coef);
        $total = max($cfg['minPrice'], $raw);
        $commission = (int)round($total * $cfg['commissionRate']);
        return [
            'version' => 2,
            'zone' => (string)$zone['name'],
            'zoneFallback' => $fallback,
            'region' => $region,
            'baseXAF' => (int)$zone['base'],
            'perKmXAF' => (int)$zone['perKm'],
            'km' => $km,
            'size' => $size,
            'refWeightKg' => $refKg,
            'weightRateXAF' => $cfg['weightRate'],
            'coefficient' => $coef,
            'minPriceXAF' => $cfg['minPrice'],
            'commissionRate' => $cfg['commissionRate'],
            'basePrice' => $raw,
            'multiplier' => $coef,
            'finalPrice' => $total,
            'commissionXAF' => $commission,
            'delivererEarning' => $total - $commission,
            'vehicle' => (string)($g['vehicle'] ?? 'MOTO'),
        ];
    }

    /**
     * Nouveau prix d'une livraison existante avec un autre gabarit, calcule avec les parametres
     * deja conserves sur cette livraison (zone, prix/km, coefficient) : seul le poids de reference change.
     */
    public static function requote(array $bd, string $newSize): array
    {
        $g = self::config()['gabarits'][$newSize] ?? null;
        if (!$g) {
            throw new HttpError('Gabarit invalide', 400, 'SIZE_INVALID');
        }
        if (!($g['bookable'] ?? false) || $g['refKg'] === null) {
            throw new HttpError('Ce gabarit est sur devis : contactez le support KoliGo.', 400, 'SIZE_ON_QUOTE');
        }
        $refKg = (float)$g['refKg'];
        $raw = (int)round(((float)$bd['baseXAF'] + (float)$bd['km'] * (float)$bd['perKmXAF'] + (float)$bd['weightRateXAF'] * $refKg) * (float)$bd['coefficient']);
        $total = max((int)$bd['minPriceXAF'], $raw);
        $commission = (int)round($total * (float)$bd['commissionRate']);
        return [
            'size' => $newSize, 'refWeightKg' => $refKg, 'basePrice' => $raw, 'finalPrice' => $total,
            'commissionXAF' => $commission, 'delivererEarning' => $total - $commission,
            'vehicle' => (string)($g['vehicle'] ?? 'MOTO'),
        ] + $bd;
    }

    /** Vrai si ce vehicule peut transporter ce gabarit. */
    public static function vehicleFits(?string $vehicle, string $size): bool
    {
        $need = self::config()['gabarits'][$size]['vehicle'] ?? 'MOTO';
        return (self::VEHICLES[$vehicle ?? 'MOTO'] ?? 1) >= (self::VEHICLES[$need] ?? 1);
    }

    // ── Validation des tarifs saisis depuis le back-office ───────────────────

    public static function validateZones(mixed $zones): array
    {
        if (!is_array($zones) || !$zones) {
            throw new HttpError('Au moins une zone tarifaire est requise');
        }
        $out = [];
        $seen = [];
        foreach ($zones as $z) {
            $name = trim((string)($z['name'] ?? ''));
            $regions = array_values(array_unique(array_filter(array_map('strval', (array)($z['regions'] ?? [])))));
            $base = $z['base'] ?? null;
            $perKm = $z['perKm'] ?? null;
            if ($name === '' || !is_numeric($base) || !is_numeric($perKm) || $base < 0 || $perKm < 0 || $base > 100000 || $perKm > 100000) {
                throw new HttpError("Zone invalide : « $name »");
            }
            foreach ($regions as $r) {
                if (isset($seen[$r])) {
                    throw new HttpError("La région « $r » est dans deux zones");
                }
                $seen[$r] = true;
            }
            $out[] = ['name' => $name, 'regions' => $regions, 'base' => (int)$base, 'perKm' => (int)$perKm];
        }
        return $out;
    }

    public static function validateGabarits(mixed $gabs): array
    {
        if (!is_array($gabs)) {
            throw new HttpError('Gabarits invalides');
        }
        $out = [];
        foreach (array_keys(self::DEFAULT_GABARITS) as $code) {
            $g = $gabs[$code] ?? null;
            if (!is_array($g)) {
                throw new HttpError("Gabarit $code manquant");
            }
            $bookable = (bool)($g['bookable'] ?? false);
            $vehicle = (string)($g['vehicle'] ?? 'MOTO');
            if (!isset(self::VEHICLES[$vehicle])) {
                throw new HttpError("Véhicule invalide pour $code");
            }
            if ($bookable && (!is_numeric($g['refKg'] ?? null) || !is_numeric($g['maxKg'] ?? null) || $g['refKg'] <= 0 || $g['maxKg'] <= 0)) {
                throw new HttpError("Poids invalides pour $code");
            }
            $out[$code] = [
                'dims' => isset($g['dims']) ? (string)$g['dims'] : null,
                'maxKg' => $bookable ? (float)$g['maxKg'] : null,
                'refKg' => $bookable ? (float)$g['refKg'] : null,
                'vehicle' => $vehicle,
                'bookable' => $bookable,
                'examples' => [
                    'fr' => (string)($g['examples']['fr'] ?? ''),
                    'en' => (string)($g['examples']['en'] ?? ''),
                ],
            ];
        }
        return $out;
    }
}
