<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\Env;
use Koligo\HttpError;

/**
 * Notifications : chaque envoi est d'abord enregistre (centre de notifications de l'application),
 * puis pousse au telephone via Firebase Cloud Messaging si le compte de service est configure.
 * Une notification ne doit jamais faire echouer l'action metier qui la declenche : tout est avale ici.
 */
final class Notifier
{
    public const AUDIENCES = ['ALL', 'VENDOR', 'DELIVERER', 'USER'];

    /** Notification a un utilisateur. */
    public static function send(string $userId, string $type, string $title, string $body, array $data = []): void
    {
        self::sendMany([$userId], $type, $title, $body, $data);
    }

    /** @param string[] $userIds */
    public static function sendMany(array $userIds, string $type, string $title, string $body, array $data = [], ?string $broadcastId = null): int
    {
        $userIds = array_values(array_unique(array_filter($userIds)));
        if (!$userIds) {
            return 0;
        }
        $title = mb_substr($title, 0, 160);
        $body = mb_substr($body, 0, 500);
        $json = $data ? json_encode($data, JSON_UNESCAPED_UNICODE) : null;
        $now = Db::now();
        $tokens = [];
        $n = 0;
        foreach ($userIds as $uid) {
            try {
                Db::insert('Notification', [
                    'id' => Db::id(), 'userId' => $uid, 'type' => $type, 'title' => $title, 'body' => $body,
                    'data' => $json, 'broadcastId' => $broadcastId, 'createdAt' => $now,
                ]);
                $n++;
            } catch (\Throwable $e) {
                error_log('[notif] ' . $e->getMessage());
            }
        }
        try {
            $in = implode(',', array_fill(0, count($userIds), '?'));
            foreach (Db::all("SELECT expoPushToken FROM `User` WHERE id IN ($in) AND expoPushToken IS NOT NULL AND expoPushToken <> ''", $userIds) as $r) {
                $tokens[] = (string)$r['expoPushToken'];
            }
            if ($tokens && self::fcmConfigured()) {
                foreach (array_unique($tokens) as $t) {
                    self::fcmSend($t, $title, $body, $data + ['type' => $type]);
                }
            }
        } catch (\Throwable $e) {
            error_log('[push] ' . $e->getMessage());
        }
        return $n;
    }

    /** Ids des destinataires d'une audience du back-office. */
    public static function audienceIds(string $audience, ?string $userId): array
    {
        if (!in_array($audience, self::AUDIENCES, true)) {
            throw new HttpError('Audience invalide');
        }
        if ($audience === 'USER') {
            if (!$userId || !Db::one('SELECT id FROM `User` WHERE id = ?', [$userId])) {
                throw new HttpError('Utilisateur introuvable', 404);
            }
            return [$userId];
        }
        $where = "isBlocked = 0 AND roles NOT LIKE '%ADMIN%'";
        $args = [];
        if ($audience !== 'ALL') {
            $where .= ' AND roles LIKE ?';
            $args[] = '%' . $audience . '%';
        }
        return array_map(fn($r) => $r['id'], Db::all("SELECT id FROM `User` WHERE $where", $args));
    }

    /** Message du back-office : enregistre l'envoi puis notifie chaque destinataire. */
    public static function broadcast(string $adminId, string $audience, ?string $userId, string $title, string $body): array
    {
        $title = trim($title);
        $body = trim($body);
        if (mb_strlen($title) < 2 || mb_strlen($body) < 2) {
            throw new HttpError('Titre et message requis');
        }
        $ids = self::audienceIds($audience, $userId);
        $bid = Db::id();
        $n = self::sendMany($ids, 'ADMIN', $title, $body, [], $bid);
        Db::insert('Broadcast', [
            'id' => $bid, 'audience' => $audience, 'targetUserId' => $audience === 'USER' ? $userId : null,
            'title' => mb_substr($title, 0, 160), 'body' => mb_substr($body, 0, 500), 'recipients' => $n,
            'createdBy' => $adminId, 'createdAt' => Db::now(),
        ]);
        return ['id' => $bid, 'recipients' => $n, 'push' => self::fcmConfigured()];
    }

    // ── Firebase Cloud Messaging (API HTTP v1) ───────────────────────────────

    private static function serviceAccount(): ?array
    {
        static $sa = false;
        if ($sa !== false) {
            return $sa;
        }
        $sa = null;
        $path = Env::get('FCM_SERVICE_ACCOUNT') ?: __DIR__ . '/../../storage/fcm-service-account.json';
        if (is_file($path)) {
            $j = json_decode((string)file_get_contents($path), true);
            if (is_array($j) && !empty($j['private_key']) && !empty($j['client_email']) && !empty($j['project_id'])) {
                $sa = $j;
            }
        }
        return $sa;
    }

    public static function fcmConfigured(): bool
    {
        return self::serviceAccount() !== null;
    }

    private static function b64(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    private static function accessToken(): ?string
    {
        $sa = self::serviceAccount();
        if (!$sa) {
            return null;
        }
        $cache = Db::one("SELECT `value`, updatedAt FROM `PlatformSetting` WHERE `key` = 'fcm_access_token'");
        if ($cache && strtotime($cache['updatedAt'] . ' UTC') > time() - 3000 && $cache['value'] !== '') {
            return (string)$cache['value'];
        }
        $now = time();
        $head = self::b64((string)json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $claim = self::b64((string)json_encode([
            'iss' => $sa['client_email'], 'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token', 'iat' => $now, 'exp' => $now + 3600,
        ]));
        $sig = '';
        if (!openssl_sign("$head.$claim", $sig, $sa['private_key'], OPENSSL_ALGO_SHA256)) {
            return null;
        }
        $res = self::post('https://oauth2.googleapis.com/token', http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => "$head.$claim." . self::b64($sig),
        ]), ['Content-Type: application/x-www-form-urlencoded']);
        $tok = json_decode($res, true)['access_token'] ?? null;
        if (!$tok) {
            error_log('[fcm] jeton refuse : ' . substr($res, 0, 200));
            return null;
        }
        $ts = Db::now();
        if (Db::exec("UPDATE `PlatformSetting` SET `value` = ?, updatedAt = ? WHERE `key` = 'fcm_access_token'", [$tok, $ts]) === 0
            && !Db::one("SELECT `key` FROM `PlatformSetting` WHERE `key` = 'fcm_access_token'")) {
            Db::exec("INSERT INTO `PlatformSetting` (`key`, `value`, updatedAt) VALUES ('fcm_access_token', ?, ?)", [$tok, $ts]);
        }
        return $tok;
    }

    private static function post(string $url, string $body, array $headers): string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
        $out = curl_exec($ch);
        curl_close($ch);
        return is_string($out) ? $out : '';
    }

    private static function fcmSend(string $token, string $title, string $body, array $data): void
    {
        $sa = self::serviceAccount();
        $at = self::accessToken();
        if (!$sa || !$at) {
            return;
        }
        $data = array_map(fn($v) => (string)$v, $data);
        $res = self::post("https://fcm.googleapis.com/v1/projects/{$sa['project_id']}/messages:send", (string)json_encode([
            'message' => [
                'token' => $token,
                'notification' => ['title' => $title, 'body' => $body],
                'data' => $data,
                'android' => ['priority' => 'HIGH', 'notification' => ['channel_id' => 'koligo', 'sound' => 'default']],
            ],
        ], JSON_UNESCAPED_UNICODE), ["Authorization: Bearer $at", 'Content-Type: application/json']);
        if (str_contains($res, 'UNREGISTERED') || str_contains($res, 'INVALID_ARGUMENT')) {
            Db::exec('UPDATE `User` SET expoPushToken = NULL WHERE expoPushToken = ?', [$token]);
        }
    }
}
