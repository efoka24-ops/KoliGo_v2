<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\Env;

/**
 * Passerelle SMS teeeotp (TRU GROUP) : un telephone Android avec SIM envoie les SMS.
 * KoliGo genere et verifie lui-meme ses codes (il doit pouvoir les montrer a l'administrateur) ; teeeotp ne sert qu'a
 * transporter le message (POST /v1/sms). Chaque envoi est journalise (SmsLog) sans le texte du message, pour savoir
 * ce qui est reellement parti, ce qui est arrive, et pourquoi un envoi a ete refuse.
 *
 * Codes d'erreur (jamais de detail du fournisseur vers les applications) :
 *   not_configured, invalid_phone, unreachable, auth, rate_limited, quota, rejected
 */
final class Sms
{
    private const KEY_SETTING = 'teeeotp_api_key';
    /** Etats suivis par teeeotp (GET /v1/sms/{id}). */
    private const STATUSES = ['QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'EXPIRED'];
    private const PENDING = ['SUBMITTED', 'QUEUED', 'SENDING', 'SENT'];

    public static function baseUrl(): string
    {
        $url = rtrim(Env::get('TEEEOTP_BASE_URL', 'https://trugroup.cm/teeeotp') ?? '', '/');
        // La cle ne voyage jamais en clair, sauf vers la machine locale (tests).
        if (str_starts_with($url, 'http://') && !preg_match('#^http://(localhost|127\.0\.0\.1)(:|/|$)#', $url)) {
            $url = 'https://' . substr($url, 7);
        }
        return $url;
    }

    /** Cle de l'environnement, sinon celle saisie au back-office. */
    public static function key(): string
    {
        $env = Env::get('TEEEOTP_API_KEY', '') ?? '';
        if ($env !== '') {
            return $env;
        }
        try {
            return (string)(Db::val('SELECT `value` FROM `PlatformSetting` WHERE `key` = ?', [self::KEY_SETTING]) ?: '');
        } catch (\Throwable) {
            return '';
        }
    }

    public static function keySource(): ?string
    {
        if ((Env::get('TEEEOTP_API_KEY', '') ?? '') !== '') {
            return 'serveur';
        }
        return self::key() !== '' ? 'back-office' : null;
    }

    public static function configured(): bool
    {
        return self::key() !== '';
    }

    /** « sk_abc…wxyz » : assez pour reconnaitre la cle, jamais la cle. */
    public static function keyHint(): ?string
    {
        $k = self::key();
        return $k === '' ? null : substr($k, 0, 3) . '…' . substr($k, -4);
    }

    /** Enregistre (ou efface, avec '') la cle saisie au back-office. */
    public static function saveKey(string $key): void
    {
        $now = Db::now();
        if (Db::exec('UPDATE `PlatformSetting` SET `value` = ?, updatedAt = ? WHERE `key` = ?', [$key, $now, self::KEY_SETTING]) === 0
            && !Db::one('SELECT `key` FROM `PlatformSetting` WHERE `key` = ?', [self::KEY_SETTING])) {
            Db::exec('INSERT INTO `PlatformSetting` (`key`, `value`, updatedAt) VALUES (?, ?, ?)', [self::KEY_SETTING, $key, $now]);
        }
    }

    /** Mobile camerounais au format 2376XXXXXXXX, ou null. */
    public static function normalize(string $phone): ?string
    {
        $d = preg_replace('/\D/', '', $phone) ?? '';
        if (strlen($d) === 9 && $d[0] === '6') {
            $d = '237' . $d;
        }
        return preg_match('/^2376\d{8}$/', $d) ? $d : null;
    }

    /** @return array{http:int,json:array,curl:?string} */
    private static function call(string $method, string $path, ?array $body = null, int $timeout = 6): array
    {
        $ch = curl_init(self::baseUrl() . $path);
        $opt = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => ['X-Api-Key: ' . self::key(), 'Accept: application/json', 'Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 4,
        ];
        if ($body !== null) {
            $opt[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
        }
        curl_setopt_array($ch, $opt);
        $raw = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        $j = is_string($raw) ? json_decode($raw, true) : null;
        return ['http' => $http, 'json' => is_array($j) ? $j : [], 'curl' => $err ?: null];
    }

    private static function errorCode(array $r): string
    {
        if ($r['http'] === 0 || $r['http'] >= 500) {
            return 'unreachable';
        }
        if ($r['http'] === 401 || $r['http'] === 403) {
            return 'auth';
        }
        $code = strtoupper((string)($r['json']['error']['code'] ?? ''));
        return match ($code) {
            'TOO_MANY_REQUESTS' => 'rate_limited',
            'QUOTA_EXCEEDED' => 'quota',
            'INVALID_PHONE' => 'invalid_phone',
            'UNREACHABLE' => 'unreachable',
            default => 'rejected',
        };
    }

    /**
     * Envoie un SMS. Ne leve jamais d'exception : une panne ici ne doit pas faire echouer l'action metier.
     *
     * @param int $ttl duree de validite en secondes (0 = defaut de la passerelle) : un code expire n'est jamais envoye en retard
     * @return array{ok:bool,id:?string,error:?string}
     */
    public static function send(string $phone, string $text, string $purpose = 'SMS', int $ttl = 0, ?string $userId = null, ?string $by = null): array
    {
        $to = self::normalize($phone);
        if (!self::configured()) {
            return self::fail($to ?? $phone, $purpose, 'not_configured', $userId, $by);
        }
        if ($to === null) {
            return self::fail($phone, $purpose, 'invalid_phone', $userId, $by);
        }
        $body = ['phone' => $to, 'message' => mb_substr($text, 0, 480)];
        if ($ttl > 0) {
            $body['ttlSeconds'] = $ttl;
        }
        $r = self::call('POST', '/v1/sms', $body);
        if ($r['http'] >= 200 && $r['http'] < 300) {
            $id = (string)($r['json']['id'] ?? $r['json']['smsId'] ?? '');
            self::log($to, $purpose, $id ?: null, 'SUBMITTED', null, $userId, $by);
            return ['ok' => true, 'id' => $id ?: null, 'error' => null];
        }
        $code = self::errorCode($r);
        error_log("[sms] $purpose refuse : http={$r['http']} code=$code" . ($r['curl'] ? ' curl=' . $r['curl'] : ''));
        return self::fail($to, $purpose, $code, $userId, $by);
    }

    /** @return array{ok:bool,id:?string,error:?string} */
    private static function fail(string $phone, string $purpose, string $code, ?string $userId, ?string $by): array
    {
        self::log($phone, $purpose, null, 'FAILED', $code, $userId, $by);
        return ['ok' => false, 'id' => null, 'error' => $code];
    }

    private static function log(string $phone, string $purpose, ?string $providerId, string $status, ?string $error, ?string $userId, ?string $by): void
    {
        try {
            $now = Db::now();
            Db::insert('SmsLog', [
                'id' => Db::id(), 'phone' => mb_substr($phone, 0, 30), 'purpose' => mb_substr($purpose, 0, 20), 'providerId' => $providerId,
                'status' => $status, 'error' => $error, 'userId' => $userId, 'createdBy' => $by, 'createdAt' => $now, 'updatedAt' => $now,
            ]);
        } catch (\Throwable $e) {
            error_log('[sms] journal : ' . $e->getMessage());
        }
    }

    /** Quota et consommation du projet chez teeeotp, ou null si la passerelle ne repond pas. */
    public static function me(): ?array
    {
        if (!self::configured()) {
            return null;
        }
        $r = self::call('GET', '/v1/me', null, 5);
        return $r['http'] >= 200 && $r['http'] < 300 ? $r['json'] : ['error' => self::errorCode($r)];
    }

    /** Releve l'etat reel (en file, envoye, delivre, echec) des derniers SMS non termines. @return int nombre de lignes interrogees */
    public static function refresh(int $max = 10): int
    {
        if (!self::configured()) {
            return 0;
        }
        $in = "'" . implode("','", self::PENDING) . "'";
        $rows = Db::all("SELECT id, providerId FROM `SmsLog` WHERE status IN ($in) AND providerId IS NOT NULL AND createdAt > ? ORDER BY createdAt DESC LIMIT " . max(1, $max),
            [gmdate('Y-m-d H:i:s', time() - 2 * 86400)]);
        foreach ($rows as $row) {
            $r = self::call('GET', '/v1/sms/' . rawurlencode((string)$row['providerId']), null, 4);
            if ($r['http'] < 200 || $r['http'] >= 300) {
                continue;
            }
            $st = strtoupper((string)($r['json']['status'] ?? $r['json']['sms']['status'] ?? ''));
            if (in_array($st, self::STATUSES, true)) {
                Db::exec('UPDATE `SmsLog` SET status = ?, updatedAt = ? WHERE id = ?', [$st, Db::now(), $row['id']]);
            }
        }
        return count($rows);
    }

    public static function recent(int $limit = 30): array
    {
        return Db::all('SELECT id, phone, purpose, providerId, status, error, createdBy, createdAt, updatedAt FROM `SmsLog` ORDER BY createdAt DESC, id DESC LIMIT ' . max(1, min(100, $limit)));
    }
}
