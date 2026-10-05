<?php
declare(strict_types=1);

namespace Koligo\Services;

/** Formule : (base + km*perKm + kg*perKg) * coefficient du type de livreur. */
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

    public const DEFAULTS = ['baseRate' => 500, 'perKmRate' => 150, 'weightSurcharge' => 100, 'commissionRate' => 0.03];

    public static function isValidType(string $type): bool
    {
        return isset(self::COEFFICIENTS[$type]);
    }

    /** @return array{basePrice:int,multiplier:float,finalPrice:int,commissionXAF:int,delivererEarning:int} */
    public static function calculate(float $distanceKm, float $weightKg, string $type): array
    {
        $c = self::DEFAULTS;
        $mult = self::COEFFICIENTS[$type];
        $base = (int)round(($c['baseRate'] + $distanceKm * $c['perKmRate'] + $weightKg * $c['weightSurcharge']) * $mult);
        $commission = (int)round($base * $c['commissionRate']);
        return [
            'basePrice' => $base,
            'multiplier' => $mult,
            'finalPrice' => $base,
            'commissionXAF' => $commission,
            'delivererEarning' => $base - $commission,
        ];
    }
}
