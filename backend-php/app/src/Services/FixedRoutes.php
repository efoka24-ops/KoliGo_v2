<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;

/**
 * Trajets a prix fixe (ex. Pitoa <-> Garoua) : tarif reel du terrain, modifiable au back-office, qui remplace
 * « base + km x tarif au km » pour les trajets habituels. Un trajet peut cibler des villes entieres ou des quartiers precis.
 */
final class FixedRoutes
{
    /**
     * Trajet fixe applicable, le plus precis d'abord (2 quartiers > 1 quartier > villes seules).
     * Les villes doivent correspondre ; un quartier vide signifie « toute la ville ».
     */
    public static function find(?string $fromCity, string $fromPlace, ?string $toCity, string $toPlace): ?array
    {
        if ($fromCity === null || $toCity === null) {
            return null;
        }
        $rows = Db::all('SELECT * FROM `FixedRoute` WHERE isActive = 1');
        if (!$rows) {
            return null;
        }
        $best = null;
        $bestScore = -1;
        foreach ($rows as $r) {
            foreach ([false, true] as $reverse) {
                if ($reverse && !(int)$r['bothWays']) {
                    continue;
                }
                $score = self::score($r, $reverse ? [$toCity, $toPlace, $fromCity, $fromPlace] : [$fromCity, $fromPlace, $toCity, $toPlace]);
                if ($score > $bestScore || ($score === $bestScore && $best !== null && (int)$r['priceXAF'] < (int)$best['priceXAF'])) {
                    $best = $r;
                    $bestScore = $score;
                }
            }
        }
        return $bestScore >= 0 ? $best : null;
    }

    /** -1 si le trajet ne correspond pas ; sinon le nombre de quartiers qui correspondent (0 a 2). */
    private static function score(array $r, array $q): int
    {
        [$fc, $fp, $tc, $tp] = $q;
        if (Distance::norm((string)$r['fromCity']) !== Distance::norm($fc) || Distance::norm((string)$r['toCity']) !== Distance::norm($tc)) {
            return -1;
        }
        $score = 0;
        foreach ([[(string)($r['fromPlace'] ?? ''), $fp], [(string)($r['toPlace'] ?? ''), $tp]] as [$want, $got]) {
            if ($want === '') {
                continue;
            }
            if (Distance::norm($want) !== Distance::norm($got)) {
                return -1;
            }
            $score++;
        }
        return $score;
    }
}
