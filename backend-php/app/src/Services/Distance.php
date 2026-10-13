<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
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

    // ── Distance par la route (quartier a quartier) ──────────────────────────

    /**
     * Distance routiere entre deux lieux. Ordre : memoire -> Google (si cle) -> table des trajets entre villes
     * -> OSRM sur les coordonnees (le quartier est geocode une seule fois puis memorise) -> estimation SIGNALEE.
     * `estimated` vaut true quand la distance n'a pas pu etre mesuree : l'application et le back-office l'affichent.
     *
     * @return array{km:float,source:string,estimated:bool}
     */
    public static function route(string $fromPlace, ?string $fromCity, string $toPlace, ?string $toCity): array
    {
        $fromPlace = trim($fromPlace);
        $toPlace = trim($toPlace);
        [$fromCity, $toCity] = self::resolveCities($fromPlace, $fromCity, $toPlace, $toCity);

        $a = self::norm((string)$fromCity) . ':' . self::norm($fromPlace);
        $b = self::norm((string)$toCity) . ':' . self::norm($toPlace);
        $key = $a <= $b ? "$a>$b" : "$b>$a";
        $hit = Db::one('SELECT km, source FROM `RouteCache` WHERE `key` = ?', [$key]);
        if ($hit) {
            return ['km' => (float)$hit['km'], 'source' => (string)$hit['source'], 'estimated' => false];
        }

        $sameCity = $fromCity !== null && $toCity !== null && self::norm($fromCity) === self::norm($toCity);
        if ($fromCity !== null && $toCity !== null && !$sameCity) {
            $pair = self::PAIRS[self::norm($fromCity) . '-' . self::norm($toCity)] ?? self::PAIRS[self::norm($toCity) . '-' . self::norm($fromCity)] ?? null;
            if ($pair !== null) {
                return self::remember($key, (float)$pair, 'TABLE');
            }
        }

        $g = self::googleKm($fromPlace . ($fromCity ? ", $fromCity" : ''), $toPlace . ($toCity ? ", $toCity" : ''));
        if ($g !== null) {
            return self::remember($key, $g, 'GOOGLE');
        }

        $p1 = self::locate($fromCity, $fromPlace);
        $p2 = self::locate($toCity, $toPlace);
        if ($p1 && $p2) {
            $precise = $p1[2] && $p2[2];
            // Deux lieux d'une meme ville dont l'un n'est repere qu'au centre-ville : la mesure est approximative.
            $estimated = $sameCity && !$precise;
            $samePoint = abs($p1[0] - $p2[0]) < 0.00001 && abs($p1[1] - $p2[1]) < 0.00001;
            if ($samePoint) {
                return $precise ? self::remember($key, 1.0, 'SAME') : ['km' => self::defaultCityKm(), 'source' => 'ESTIMATE', 'estimated' => true];
            }
            $km = self::osrm([$p1[0], $p1[1]], [$p2[0], $p2[1]]);
            if ($km !== null) {
                $km = max(1.0, $km);
                return $estimated ? ['km' => $km, 'source' => 'OSRM', 'estimated' => true] : self::remember($key, $km, 'OSRM');
            }
            $line = round(self::haversine($p1[0], $p1[1], $p2[0], $p2[1]) * 1.4, 1);
            return ['km' => max(1.0, $line), 'source' => 'ESTIMATE', 'estimated' => true];
        }
        return ['km' => self::defaultCityKm(), 'source' => 'ESTIMATE', 'estimated' => true];
    }

    /**
     * Villes de depart et d'arrivee : celles envoyees, sinon deduites du quartier (si sans ambiguite).
     * L'arrivee vaut la ville de depart par defaut, sauf si l'adresse d'arrivee est elle-meme une autre ville.
     *
     * @return array{0:?string,1:?string}
     */
    public static function resolveCities(string $fromPlace, ?string $fromCity, string $toPlace, ?string $toCity): array
    {
        $fromCity = self::cityOf(trim($fromPlace), $fromCity);
        if ($toCity !== null && trim($toCity) !== '') {
            $toCity = trim($toCity);
        } elseif (isset(self::COORDS[self::norm($toPlace)]) && ($fromCity === null || self::norm($toPlace) !== self::norm($fromCity))) {
            $toCity = trim($toPlace); // l'adresse d'arrivee est elle-meme une ville (ancien format : « Douala » -> « Yaounde »)
        } else {
            $toCity = $fromCity ?? self::cityOf(trim($toPlace), null);
        }
        return [$fromCity, $toCity];
    }

    /** @return array{km:float,source:string,estimated:bool} */
    private static function remember(string $key, float $km, string $source): array
    {
        try {
            Db::exec('INSERT INTO `RouteCache` (`key`, km, source, createdAt) VALUES (?, ?, ?, ?)', [$key, $km, $source, Db::now()]);
        } catch (\Throwable) {
            // ecriture concurrente de la meme paire : sans importance
        }
        return ['km' => $km, 'source' => $source, 'estimated' => false];
    }

    private static function defaultCityKm(): float
    {
        $v = Db::val("SELECT `value` FROM `PlatformSetting` WHERE `key` = 'estimated_city_km'");
        return is_numeric($v) && (float)$v > 0 ? (float)$v : 4.0;
    }

    private static array $hoods = [];

    /** Quartiers connus (nom, ville, coordonnees eventuelles). */
    private static function hoods(): array
    {
        if (!self::$hoods) {
            self::$hoods = Db::all('SELECT n.id, n.name, n.latitude, n.longitude, c.name AS city FROM `Neighborhood` n JOIN `City` c ON c.id = n.cityId');
        }
        return self::$hoods;
    }

    private static function findHood(?string $city, string $place): ?array
    {
        $cn = $city !== null && $city !== '' ? self::norm($city) : null;
        $pn = self::norm($place);
        foreach (self::hoods() as $r) {
            if (self::norm((string)$r['name']) === $pn && ($cn === null || self::norm((string)$r['city']) === $cn)) {
                return $r;
            }
        }
        return null;
    }

    /** Ville d'un quartier quand l'application ne l'a pas envoyee (uniquement si elle est sans ambiguite). */
    private static function cityOf(string $place, ?string $city): ?string
    {
        if ($city !== null && trim($city) !== '') {
            return trim($city);
        }
        $pn = self::norm($place);
        $cities = [];
        foreach (self::hoods() as $r) {
            if (self::norm((string)$r['name']) === $pn) {
                $cities[(string)$r['city']] = true;
            }
        }
        if (count($cities) === 1) {
            return (string)array_key_first($cities);
        }
        return isset(self::COORDS[$pn]) ? $place : null;
    }

    /**
     * Coordonnees d'un lieu : celles du quartier si connues, sinon geocodage (memorise), sinon centre-ville.
     * Le 3e element dit si le point est precis (quartier) ou seulement le centre de la ville.
     *
     * @return array{0:float,1:float,2:bool}|null
     */
    private static function locate(?string $city, string $place): ?array
    {
        // Le « lieu » est la ville elle-meme : son centre fait office de point precis.
        if ($city !== null && self::norm($place) === self::norm($city) && isset(self::COORDS[self::norm($city)])) {
            $c = self::COORDS[self::norm($city)];
            return [$c[0], $c[1], true];
        }
        $row = self::findHood($city, $place);
        if ($row && $row['latitude'] !== null && $row['longitude'] !== null) {
            return [(float)$row['latitude'], (float)$row['longitude'], true];
        }
        $cityName = $row['city'] ?? $city;
        $center = $cityName ? (self::COORDS[self::norm((string)$cityName)] ?? null) : null;

        $g = self::geocodeIn($place . ($cityName ? ", $cityName" : '') . ', Cameroun', $center);
        if ($g) {
            if ($row) {
                try {
                    Db::exec('UPDATE `Neighborhood` SET latitude = ?, longitude = ? WHERE id = ?', [$g[0], $g[1], $row['id']]);
                    self::$hoods = [];
                } catch (\Throwable) {
                }
            }
            return [$g[0], $g[1], true];
        }
        return $center ? [$center[0], $center[1], false] : null;
    }

    /** Geocode un lieu en refusant tout resultat hors du Cameroun ou trop loin du centre de la ville annoncee. */
    private static function geocodeIn(string $query, ?array $center): ?array
    {
        $memo = 'nogeo:' . self::norm($query);
        $past = Db::val('SELECT createdAt FROM `RouteCache` WHERE `key` = ?', [$memo]);
        if ($past && strtotime($past . ' UTC') > time() - 7 * 86400) {
            return null; // deja cherche sans resultat : on ne reessaie pas a chaque devis
        }
        $j = self::getJson('https://nominatim.openstreetmap.org/search?' . http_build_query([
            'q' => $query, 'format' => 'json', 'limit' => 1, 'countrycodes' => 'cm',
        ]));
        if ($j === null) {
            return null; // service injoignable : rien de memorise
        }
        $ok = null;
        if (isset($j[0]['lat'], $j[0]['lon'])) {
            $lat = (float)$j[0]['lat'];
            $lng = (float)$j[0]['lon'];
            $inCountry = $lat >= 1.6 && $lat <= 13.2 && $lng >= 8.3 && $lng <= 16.3;
            $near = $center === null || self::haversine($center[0], $center[1], $lat, $lng) <= 45;
            if ($inCountry && $near) {
                $ok = [$lat, $lng];
            }
        }
        if ($ok === null) {
            try {
                Db::exec('DELETE FROM `RouteCache` WHERE `key` = ?', [$memo]);
                Db::exec('INSERT INTO `RouteCache` (`key`, km, source, createdAt) VALUES (?, 0, ?, ?)', [$memo, 'NOGEO', Db::now()]);
            } catch (\Throwable) {
            }
        }
        return $ok;
    }

    private static function isOffline(): bool
    {
        $until = Db::val("SELECT `value` FROM `PlatformSetting` WHERE `key` = 'geo_offline_until'");
        return is_numeric($until) && (int)$until > time();
    }

    /** Service de cartes injoignable : on le laisse tranquille 10 minutes pour ne pas ralentir chaque devis. */
    private static function setOffline(): void
    {
        $v = (string)(time() + 600);
        $now = Db::now();
        if (Db::exec("UPDATE `PlatformSetting` SET `value` = ?, updatedAt = ? WHERE `key` = 'geo_offline_until'", [$v, $now]) === 0
            && !Db::one("SELECT `key` FROM `PlatformSetting` WHERE `key` = 'geo_offline_until'")) {
            Db::exec("INSERT INTO `PlatformSetting` (`key`, `value`, updatedAt) VALUES ('geo_offline_until', ?, ?)", [$v, $now]);
        }
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
        if (self::isOffline()) {
            return null;
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 4,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_USERAGENT => 'KoliGo/2.0 (+https://koligo.trugroup.cm)',
        ]);
        $body = curl_exec($ch);
        curl_close($ch);
        if (!is_string($body)) {
            self::setOffline();
            return null;
        }
        $j = json_decode($body, true);
        return is_array($j) ? $j : null;
    }
}
