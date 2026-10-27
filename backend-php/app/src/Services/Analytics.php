<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\HttpError;
use Koligo\RateLimit;

/**
 * Suivi d'usage : evenements remontes par l'application (et quelques evenements du serveur), stockes dans AnalyticsEvent.
 *
 * Le plan de marquage (app/database/tracking_plan.json) est la reference unique : seuls les evenements du plan sont acceptes,
 * ce qui garde des donnees propres et empeche un client de remplir la base avec n'importe quoi. Aucune donnee personnelle
 * n'est conservee dans les parametres (numeros, codes, PIN, e-mails, noms sont retires). L'identite d'un utilisateur ne vient
 * jamais du client : elle est lue dans le jeton d'acces.
 */
final class Analytics
{
    public const MAX_BATCH = 50;
    private const PII_KEYS = ['phone', 'tel', 'pin', 'code', 'otp', 'password', 'pass', 'email', 'mail', 'name', 'nom', 'token', 'cni', 'number', 'numero', 'address', 'adresse', 'photo', 'selfie'];
    private static ?array $plan = null;

    public static function plan(): array
    {
        if (self::$plan === null) {
            $j = json_decode((string)@file_get_contents(__DIR__ . '/../../database/tracking_plan.json'), true);
            self::$plan = is_array($j) ? $j : ['events' => [], 'funnels' => [], 'retentionDays' => 90];
        }
        return self::$plan;
    }

    /** @return array<string,true> noms d'evenements acceptes depuis un client, selon leur source dans le plan */
    private static function names(string $source): array
    {
        $out = [];
        foreach (self::plan()['events'] ?? [] as $e) {
            if (($e['source'] ?? 'app') === $source) {
                $out[(string)$e['name']] = true;
            }
        }
        return $out;
    }

    private static function id(string $v): ?string
    {
        return preg_match('/^[A-Za-z0-9-]{8,40}$/', $v) ? $v : null;
    }

    /** Parametres : scalaires seulement, sans donnee personnelle, bornes. @return ?string JSON ou null */
    public static function cleanParams(mixed $params): ?string
    {
        if (!is_array($params) || !$params) {
            return null;
        }
        $out = [];
        foreach ($params as $k => $v) {
            $k = strtolower((string)$k);
            if (!preg_match('/^[a-z][a-z0-9_]{0,29}$/', $k) || in_array($k, self::PII_KEYS, true) || count($out) >= 10) {
                continue;
            }
            if (is_bool($v) || is_int($v) || is_float($v)) {
                $out[$k] = $v;
            } elseif (is_string($v)) {
                // Les suites de 6 chiffres ou plus (numeros, codes, montants saisis a la main) ne sortent pas de l'appareil.
                $v = preg_replace('/\d{6,}/', '#', mb_substr(trim($v), 0, 100)) ?? '';
                $v = preg_replace('/[\w.+-]+@[\w-]+\.[\w.]+/', '#', $v) ?? $v;
                $out[$k] = $v;
            }
        }
        if (!$out) {
            return null;
        }
        $json = json_encode($out, JSON_UNESCAPED_UNICODE);
        return $json !== false && strlen($json) <= 500 ? $json : null;
    }

    /**
     * Recoit un lot d'evenements de l'application.
     *
     * @return array{accepted:int,dropped:int}
     */
    public static function ingest(array $body, ?string $userId): array
    {
        $deviceId = self::id((string)($body['deviceId'] ?? ''));
        if ($deviceId === null) {
            throw new HttpError('deviceId invalide');
        }
        RateLimit::hit('analytics:ip:' . RateLimit::ip(), 240, 600);
        RateLimit::hit('analytics:dev:' . $deviceId, 80, 600);

        $events = $body['events'] ?? [];
        if (!is_array($events) || !$events) {
            return ['accepted' => 0, 'dropped' => 0];
        }
        $events = array_slice($events, 0, self::MAX_BATCH);
        $allowed = self::names('app');
        $version = mb_substr((string)($body['appVersion'] ?? ''), 0, 20) ?: null;
        $platform = in_array($body['platform'] ?? '', ['android', 'ios', 'web'], true) ? $body['platform'] : null;
        $lang = preg_match('/^[a-z]{2}$/', (string)($body['lang'] ?? '')) ? $body['lang'] : null;
        $now = time();
        $received = Db::now();
        $accepted = 0;
        $dropped = 0;

        Db::tx(function () use ($events, $allowed, $deviceId, $userId, $version, $platform, $lang, $now, $received, &$accepted, &$dropped) {
            foreach ($events as $e) {
                if (!is_array($e)) {
                    $dropped++;
                    continue;
                }
                $name = (string)($e['name'] ?? '');
                $eid = self::id((string)($e['id'] ?? ''));
                if (!isset($allowed[$name]) || $eid === null) {
                    $dropped++;
                    continue;
                }
                // Heure du telephone en millisecondes : garde l'ordre exact de deux evenements de la meme seconde.
                $ms = (int)($e['t'] ?? 0);
                if ($ms < ($now - 3 * 86400) * 1000 || $ms > ($now + 300) * 1000) {
                    $ms = (int)(microtime(true) * 1000); // horloge du telephone fausse : on date a la reception
                }
                $t = intdiv($ms, 1000);
                $role = in_array($e['role'] ?? '', ['vendor', 'deliverer'], true) ? $e['role'] : null;
                $screen = preg_match('/^[A-Za-z][A-Za-z0-9_]{0,39}$/', (string)($e['screen'] ?? '')) ? $e['screen'] : null;
                try {
                    Db::insert('AnalyticsEvent', [
                        'id' => sha1($deviceId . '|' . $eid), 'name' => $name, 'screen' => $screen, 'params' => self::cleanParams($e['params'] ?? null),
                        'source' => 'app', 'deviceId' => $deviceId, 'sessionId' => self::id((string)($e['sid'] ?? '')), 'userId' => $userId, 'role' => $role,
                        'appVersion' => $version, 'platform' => $platform, 'lang' => $lang,
                        'occurredAt' => gmdate('Y-m-d H:i:s', $t), 'tms' => $ms, 'receivedAt' => $received,
                    ]);
                    $accepted++;
                } catch (\PDOException) {
                    $accepted++; // deja recu (renvoi apres une coupure) : l'evenement existe, rien a faire
                }
            }
        });
        self::maybePurge();
        return ['accepted' => $accepted, 'dropped' => $dropped];
    }

    /** Evenement emis par le serveur (paiement confirme, livraison terminee...). Ne leve jamais : une statistique ne doit pas casser le metier. */
    public static function server(string $name, ?string $userId, array $params = [], ?string $dedupe = null): void
    {
        try {
            if (!isset(self::names('server')[$name])) {
                return;
            }
            $now = Db::now();
            Db::insert('AnalyticsEvent', [
                'id' => $dedupe !== null ? sha1('srv|' . $name . '|' . $dedupe) : Db::id(), 'name' => $name, 'screen' => null, 'params' => self::cleanParams($params),
                'source' => 'server', 'deviceId' => null, 'sessionId' => null, 'userId' => $userId, 'role' => null,
                'appVersion' => null, 'platform' => null, 'lang' => null, 'occurredAt' => $now, 'tms' => (int)(microtime(true) * 1000), 'receivedAt' => $now,
            ]);
        } catch (\Throwable) {
            // doublon (rejeu d'un webhook) ou erreur : ignore
        }
    }

    private static function maybePurge(): void
    {
        try {
            if (random_int(1, 40) !== 1) {
                return;
            }
            $days = (int)(self::plan()['retentionDays'] ?? 90);
            Db::exec('DELETE FROM `AnalyticsEvent` WHERE occurredAt < ?', [gmdate('Y-m-d H:i:s', time() - max(7, $days) * 86400)]);
        } catch (\Throwable) {
        }
    }

    // ── Statistiques (back-office) ───────────────────────────────────────────

    private static function since(int $days): string
    {
        return gmdate('Y-m-d H:i:s', time() - max(1, min(90, $days)) * 86400);
    }

    /** Entonnoirs du plan : nombre d'appareils (ou d'evenements) par etape sur la periode. */
    private static function funnels(string $since): array
    {
        $out = [];
        foreach (self::plan()['funnels'] ?? [] as $f) {
            $events = ($f['unit'] ?? 'devices') === 'events';
            $unit = $events ? 'COUNT(*)' : 'COUNT(DISTINCT COALESCE(deviceId, userId))';
            $steps = [];
            $first = null;
            foreach ($f['steps'] as $s) {
                $sql = "SELECT $unit FROM `AnalyticsEvent` WHERE name = ? AND occurredAt >= ?";
                $args = [$s['event'], $since];
                if (!empty($s['screen'])) {
                    $sql .= ' AND screen = ?';
                    $args[] = $s['screen'];
                }
                foreach ($s['where'] ?? [] as $k => $v) {
                    $sql .= ' AND params LIKE ?';
                    $args[] = '%"' . $k . '":"' . $v . '"%';
                }
                $n = (int)Db::val($sql, $args);
                $first ??= $n;
                $steps[] = ['label' => $s['label'], 'count' => $n, 'rate' => $first > 0 ? round($n / $first * 100, 1) : null];
            }
            $out[] = ['id' => $f['id'], 'label' => $f['label'], 'unit' => $events ? 'événements' : 'appareils', 'steps' => $steps];
        }
        return $out;
    }

    /** Vue d'ensemble : audience, sessions, erreurs, ecrans, versions, entonnoirs. */
    public static function overview(int $days): array
    {
        $days = max(1, min(90, $days));
        $since = self::since($days);
        $tot = Db::one('SELECT COUNT(*) AS events, COUNT(DISTINCT deviceId) AS devices, COUNT(DISTINCT sessionId) AS sessions, COUNT(DISTINCT userId) AS users FROM `AnalyticsEvent` WHERE occurredAt >= ?', [$since]) ?: [];
        $errors = (int)Db::val("SELECT COUNT(*) FROM `AnalyticsEvent` WHERE name IN ('form_error','api_error') AND occurredAt >= ?", [$since]);

        $byDay = [];
        foreach (Db::all('SELECT SUBSTR(occurredAt, 1, 10) AS day, COUNT(*) AS events, COUNT(DISTINCT deviceId) AS devices, COUNT(DISTINCT sessionId) AS sessions FROM `AnalyticsEvent` WHERE occurredAt >= ? GROUP BY SUBSTR(occurredAt, 1, 10)', [$since]) as $r) {
            $byDay[$r['day']] = ['day' => $r['day'], 'events' => (int)$r['events'], 'devices' => (int)$r['devices'], 'sessions' => (int)$r['sessions']];
        }
        $daily = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $d = gmdate('Y-m-d', time() - $i * 86400);
            $daily[] = $byDay[$d] ?? ['day' => $d, 'events' => 0, 'devices' => 0, 'sessions' => 0];
        }

        $dur = 0;
        $evs = 0;
        $sessions = Db::all('SELECT MIN(occurredAt) AS a, MAX(occurredAt) AS b, COUNT(*) AS n FROM `AnalyticsEvent` WHERE sessionId IS NOT NULL AND occurredAt >= ? GROUP BY sessionId ORDER BY MAX(occurredAt) DESC LIMIT 3000', [$since]);
        foreach ($sessions as $s) {
            $dur += max(0, strtotime($s['b'] . ' UTC') - strtotime($s['a'] . ' UTC'));
            $evs += (int)$s['n'];
        }
        $ns = count($sessions);

        $apiErrors = [];
        foreach (Db::all("SELECT params FROM `AnalyticsEvent` WHERE name = 'api_error' AND occurredAt >= ? ORDER BY occurredAt DESC LIMIT 1500", [$since]) as $r) {
            $p = json_decode((string)$r['params'], true) ?: [];
            $k = ($p['endpoint'] ?? '?') . ' · ' . ($p['status'] ?? '?');
            $apiErrors[$k] = ($apiErrors[$k] ?? 0) + 1;
        }
        arsort($apiErrors);

        return [
            'days' => $days,
            'totals' => ['events' => (int)($tot['events'] ?? 0), 'devices' => (int)($tot['devices'] ?? 0), 'sessions' => (int)($tot['sessions'] ?? 0), 'users' => (int)($tot['users'] ?? 0), 'errors' => $errors,
                'avgSessionSeconds' => $ns ? (int)round($dur / $ns) : 0, 'avgEventsPerSession' => $ns ? round($evs / $ns, 1) : 0,
                'errorsPerSession' => (int)($tot['sessions'] ?? 0) > 0 ? round($errors / (int)$tot['sessions'], 2) : 0],
            'daily' => $daily,
            'screens' => Db::all("SELECT screen, COUNT(*) AS views, COUNT(DISTINCT deviceId) AS devices FROM `AnalyticsEvent` WHERE name = 'screen_view' AND screen IS NOT NULL AND occurredAt >= ? GROUP BY screen ORDER BY COUNT(*) DESC LIMIT 12", [$since]),
            'versions' => Db::all('SELECT appVersion, COUNT(DISTINCT deviceId) AS devices FROM `AnalyticsEvent` WHERE appVersion IS NOT NULL AND occurredAt >= ? GROUP BY appVersion ORDER BY COUNT(DISTINCT deviceId) DESC LIMIT 8', [$since]),
            'roles' => Db::all('SELECT role, COUNT(DISTINCT deviceId) AS devices FROM `AnalyticsEvent` WHERE role IS NOT NULL AND occurredAt >= ? GROUP BY role', [$since]),
            'apiErrors' => array_map(fn($k, $n) => ['key' => $k, 'count' => $n], array_slice(array_keys($apiErrors), 0, 8), array_slice(array_values($apiErrors), 0, 8)),
            'funnels' => self::funnels($since),
        ];
    }

    /** Le plan de marquage avec, pour chaque evenement, ce qui a reellement ete recu sur la periode. */
    public static function events(int $days): array
    {
        $since = self::since($days);
        $stats = [];
        foreach (Db::all('SELECT name, COUNT(*) AS n, COUNT(DISTINCT COALESCE(deviceId, userId)) AS u, MAX(occurredAt) AS last FROM `AnalyticsEvent` WHERE occurredAt >= ? GROUP BY name', [$since]) as $r) {
            $stats[$r['name']] = $r;
        }
        $items = [];
        foreach (self::plan()['events'] ?? [] as $e) {
            $s = $stats[$e['name']] ?? null;
            $items[] = $e + ['count' => (int)($s['n'] ?? 0), 'uniques' => (int)($s['u'] ?? 0), 'last' => $s['last'] ?? null];
        }
        return ['days' => max(1, min(90, $days)), 'items' => $items, 'received' => (int)array_sum(array_map(fn($s) => (int)$s['n'], $stats))];
    }

    /**
     * Parcours : tout ce qu'une personne ou un appareil a fait, session par session.
     * $q : numero de telephone, e-mail, identifiant d'utilisateur, d'appareil ou de session.
     */
    public static function journey(string $q): array
    {
        $q = trim($q);
        if ($q === '') {
            throw new HttpError('Indiquez un numéro, un e-mail ou un identifiant');
        }
        $user = null;
        if (str_contains($q, '@')) {
            $user = Db::one('SELECT id, name, phone, email, roles, activeRole, kycStatus, createdAt FROM `User` WHERE LOWER(email) = LOWER(?) LIMIT 1', [$q]);
        } elseif (preg_match('/^\+?[0-9 ]{8,15}$/', $q)) {
            $d = preg_replace('/\D/', '', $q) ?? '';
            $d = strlen($d) > 9 && str_starts_with($d, '237') ? substr($d, 3) : $d;
            $user = Db::one('SELECT id, name, phone, email, roles, activeRole, kycStatus, createdAt FROM `User` WHERE phone IN (?, ?, ?) LIMIT 1', [$q, '+237' . $d, $d]);
        } elseif (preg_match('/^c[0-9a-f]{24}$/', $q)) {
            $user = Db::one('SELECT id, name, phone, email, roles, activeRole, kycStatus, createdAt FROM `User` WHERE id = ? LIMIT 1', [$q]);
        }

        if ($user) {
            $devices = array_column(Db::all('SELECT DISTINCT deviceId FROM `AnalyticsEvent` WHERE userId = ? AND deviceId IS NOT NULL LIMIT 20', [$user['id']]), 'deviceId');
            $sql = 'SELECT * FROM `AnalyticsEvent` WHERE userId = ?';
            $args = [$user['id']];
            if ($devices) {
                $sql .= ' OR deviceId IN (' . implode(',', array_fill(0, count($devices), '?')) . ')';
                $args = [...$args, ...$devices];
            }
        } elseif (self::id($q) !== null) {
            $devices = [$q];
            $sql = 'SELECT * FROM `AnalyticsEvent` WHERE deviceId = ? OR sessionId = ?';
            $args = [$q, $q];
        } else {
            throw new HttpError('Aucun utilisateur trouvé pour cette recherche', 404);
        }
        $rows = Db::all($sql . ' ORDER BY occurredAt DESC, tms DESC, id DESC LIMIT 400', $args);

        $sessions = [];
        foreach (array_reverse($rows) as $r) {
            $sid = $r['sessionId'] ?: 'serveur';
            $sessions[$sid]['id'] = $sid;
            $sessions[$sid]['events'][] = ['t' => $r['occurredAt'], 'name' => $r['name'], 'screen' => $r['screen'], 'source' => $r['source'], 'params' => $r['params'] ? json_decode((string)$r['params'], true) : null,
                'role' => $r['role'], 'version' => $r['appVersion']];
        }
        $list = array_values(array_map(function ($s) {
            $s['start'] = $s['events'][0]['t'];
            $s['end'] = $s['events'][count($s['events']) - 1]['t'];
            return $s;
        }, $sessions));
        usort($list, fn($a, $b) => strcmp($b['start'], $a['start']));
        return ['user' => $user, 'devices' => $devices, 'total' => count($rows), 'truncated' => count($rows) >= 400, 'sessions' => $list];
    }
}
