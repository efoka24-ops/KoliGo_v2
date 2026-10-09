<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Ctx;
use Koligo\Db;
use Koligo\Services\Notifier;

final class NotificationController
{
    /** GET /notifications : les plus recentes d'abord, avec le nombre de non lues. */
    public static function list(Ctx $c): array
    {
        $uid = $c->user['userId'];
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 40)));
        $items = Db::all("SELECT id, type, title, body, data, readAt, createdAt FROM `Notification` WHERE userId = ? ORDER BY createdAt DESC, id DESC LIMIT $limit", [$uid]);
        foreach ($items as &$n) {
            $n['data'] = $n['data'] ? json_decode((string)$n['data'], true) : null;
            $n['read'] = $n['readAt'] !== null;
        }
        return [
            'items' => $items,
            'unread' => (int)Db::val('SELECT COUNT(*) FROM `Notification` WHERE userId = ? AND readAt IS NULL', [$uid]),
        ];
    }

    /** POST /notifications/read {ids?: string[]} : sans ids, tout est marque comme lu. */
    public static function markRead(Ctx $c): array
    {
        $uid = $c->user['userId'];
        $ids = $c->input('ids');
        $now = Db::now();
        if (is_array($ids) && $ids) {
            $ids = array_slice(array_map('strval', $ids), 0, 200);
            $in = implode(',', array_fill(0, count($ids), '?'));
            Db::exec("UPDATE `Notification` SET readAt = ? WHERE userId = ? AND readAt IS NULL AND id IN ($in)", array_merge([$now, $uid], $ids));
        } else {
            Db::exec('UPDATE `Notification` SET readAt = ? WHERE userId = ? AND readAt IS NULL', [$now, $uid]);
        }
        return ['ok' => true];
    }

    /** POST /admin/notifications {audience: ALL|VENDOR|DELIVERER|USER, userId?, title, body} */
    public static function adminBroadcast(Ctx $c): array
    {
        $r = Notifier::broadcast($c->user['userId'], strtoupper((string)$c->input('audience', '')), $c->input('userId'), (string)$c->input('title', ''), (string)$c->input('body', ''));
        http_response_code(201);
        return $r;
    }

    /** GET /admin/notifications : historique des messages envoyes depuis le back-office. */
    public static function adminHistory(Ctx $c): array
    {
        $items = Db::all('SELECT b.*, u.name AS targetName FROM `Broadcast` b LEFT JOIN `User` u ON u.id = b.targetUserId ORDER BY b.createdAt DESC LIMIT 100');
        return ['items' => $items, 'push' => Notifier::fcmConfigured()];
    }
}
