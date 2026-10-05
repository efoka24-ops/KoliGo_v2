<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Env;

/**
 * Distance routiere entre deux adresses camerounaises.
 * Ordre : table de paires de villes -> coordonnees connues (haversine x 1.4)
 * -> Nominatim + OSRM -> null.
 */
final class Distance
{
    private const PAIRS = [
        'douala-yaounde' => 250, 'douala-bafoussam' => 195, 'douala-garoua' => 905,
        'douala-maroua' => 1055, 'douala-ngaoundere' => 620, 'douala-bamenda' => 290,
        'douala-ebolowa' => 215, 'douala-buea' => 75, 'douala-kribi' => 150,
        'douala-bertoua' => 570, 'douala-edea' => 55, 'douala-nkongsamba' => 105,
        'douala-limbe' => 65, 'douala-kumba' => 105,
        'yaounde-bafoussam' => 270, 'yaounde-garoua' => 660, 'yaounde-maroua' => 810,
        'yaounde-ngaoundere' => 340, 'yaounde-bamenda' => 360, 'yaounde-ebolowa' => 165,
        'yaounde-kribi' => 210, 'yaounde-bertoua' => 350, 'yaounde-edea' => 200,
        'bafoussam-bamenda' => 100, 'bafoussam-ngaoundere' => 480, 'bafoussam-garoua' => 700,
        'garoua-maroua' => 200, 'garoua-ngaoundere' => 260,
        'ngaoundere-maroua' => 310, 'ngaoundere-bertoua' => 300,
        'bamenda-buea' => 280, 'ebolowa-kribi' => 105,
        'edea-kribi' => 95, 'nkongsamba-bafoussam' => 90,
    ];

    private const COORDS = [
        'douala' => [4.049, 9.767], 'yaounde' => [3.866, 11.516],
        'garoua' => [9.301, 13.397], 'maroua' => [10.591, 14.316],
        'ngaoundere' => [7.321, 13.583], 'bafoussam' => [5.477, 10.417],
        'bamenda' => [5.963, 10.160], 'ebolowa' => [2.901, 11.155],
        'buea' => [4.157, 9.237], 'kribi' => [2.940, 9.909],
        'bertoua' => [4.578, 13.685], 'edea' => [3.803, 10.131],
        'nkongsamba' => [4.952, 9.942], 'limbe' => [4.022, 9.199],
        'kumba' => [4.636, 9.447], 'foumban' => [5.727, 10.907],
        'dschang' => [5.447, 10.053], 'sangmelima' => [2.940, 11.981],
        'mbalmayo' => [3.516, 11.503], 'obala' => [4.167, 11.533],
    ];

    public static function norm(string $s): string
    {
        // Table explicite : iconv //TRANSLIT ne donne pas le meme resultat selon l'OS.
        $s = strtr(mb_strtolower($s), [
            'à' => 'a', 'â' => 'a', 'ä' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'ç' => 'c', 'œ' => 'oe',
        ]);
        return preg_replace('/[^a-z0-9]/', '', $s) ?? '';
    }

    public static function km(string $from, string $to): ?float
    {
        $f = self::norm($from);
        $t = self::norm($to);
        if ($f === $t) {
            return 1.0;
        }
        $pair = self::PAIRS["$f-$t"] ?? self::PAIRS["$t-$f"] ?? null;
        if ($pair !== null) {
            return (float)$pair;
        }
        if (isset(self::COORDS[$f], self::COORDS[$t])) {
            [$a, $b] = [self::COORDS[$f], self::COORDS[$t]];
            return round(self::haversine($a[0], $a[1], $b[0], $b[1]) * 1.4, 1);
        }

        $g1 = self::geocode("$from, Cameroun");
        $g2 = $g1 ? self::geocode("$to, Cameroun") : null;
        if ($g1 && $g2) {
            return self::osrm($g1, $g2) ?? round(self::haversine($g1[0], $g1[1], $g2[0], $g2[1]) * 1.4, 1);
        }
        return null;
    }

    /** Distance Google Distance Matrix, si GOOGLE_MAPS_KEY est configuree. */
    public static function googleKm(string $from, string $to): ?float
    {
        $key = Env::get('GOOGLE_MAPS_KEY');
        if (!$key) {
            return null;
        }
        $url = 'https://maps.googleapis.com/maps/api/distancematrix/json?' . http_build_query([
            'origins' => "$from, Cameroon", 'destinations' => "$to, Cameroon",
            'key' => $key, 'units' => 'metric', 'mode' => 'driving',
        ]);
        $j = self::getJson($url);
        $m = $j['rows'][0]['elements'][0]['distance']['value'] ?? null;
        return is_numeric($m) ? round($m / 100) / 10 : null;
    }

    private static function haversine(float $la1, float $lo1, float $la2, float $lo2): float
    {
        $r = 6371;
        $dLat = deg2rad($la2 - $la1);
        $dLng = deg2rad($lo2 - $lo1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($la1)) * cos(deg2rad($la2)) * sin($dLng / 2) ** 2;
        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private static function geocode(string $place): ?array
    {
        $j = self::getJson('https://nominatim.openstreetmap.org/search?' . http_build_query([
            'q' => $place, 'format' => 'json', 'limit' => 1, 'countrycodes' => 'cm',
        ]));
        return isset($j[0]['lat'], $j[0]['lon']) ? [(float)$j[0]['lat'], (float)$j[0]['lon']] : null;
    }

    private static function osrm(array $a, array $b): ?float
    {
        $j = self::getJson("https://router.project-osrm.org/route/v1/driving/{$a[1]},{$a[0]};{$b[1]},{$b[0]}?overview=false");
        $m = $j['routes'][0]['distance'] ?? null;
        return is_numeric($m) ? round($m / 100) / 10 : null;
    }

    /** GET JSON avec un delai court : ces services tiers ne doivent jamais bloquer une creation de course. */
    private static function getJson(string $url): ?array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 4,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_USERAGENT => 'KoliGoApp/2.0',
        ]);
        $body = curl_exec($ch);
        curl_close($ch);
        if (!is_string($body)) {
            return null;
        }
        $j = json_decode($body, true);
        return is_array($j) ? $j : null;
    }
}
