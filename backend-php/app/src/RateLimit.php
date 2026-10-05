<?php
declare(strict_types=1);

namespace Koligo;

/**
 * Limiteur a fenetre fixe, stocke en base (pas de Redis sur l'hebergement).
 * Indispensable ici : un PIN a 4 chiffres ne resiste pas a 10 000 essais.
 */
final class RateLimit
{
    /** @throws HttpError 429 quand le seuil est depasse */
    public static function hit(string $bucket, int $max, int $windowSec): void
    {
        $now = Db::now();
        $row = Db::one('SELECT hits, resetAt FROM `RateLimit` WHERE bucket = ?', [$bucket]);
        if (!$row || $row['resetAt'] <= $now) {
            if ($row) {
                Db::exec('UPDATE `RateLimit` SET hits = 1, resetAt = ? WHERE bucket = ?', [gmdate('Y-m-d H:i:s', time() + $windowSec), $bucket]);
            } else {
                try {
                    Db::exec('INSERT INTO `RateLimit` (bucket, hits, resetAt) VALUES (?, 1, ?)', [$bucket, gmdate('Y-m-d H:i:s', time() + $windowSec)]);
                } catch (\PDOException) {
                    // course avec une requete concurrente : la ligne existe deja, on compte dessus
                    Db::exec('UPDATE `RateLimit` SET hits = hits + 1 WHERE bucket = ?', [$bucket]);
                }
            }
            return;
        }
        if ((int)$row['hits'] >= $max) {
            throw new HttpError('Trop de tentatives. Reessayez dans quelques minutes.', 429);
        }
        Db::exec('UPDATE `RateLimit` SET hits = hits + 1 WHERE bucket = ?', [$bucket]);
    }

    /** @throws HttpError 429 si le seuil est deja atteint (sans consommer de tentative). */
    public static function assertBelow(string $bucket, int $max): void
    {
        $row = Db::one('SELECT hits, resetAt FROM `RateLimit` WHERE bucket = ?', [$bucket]);
        if ($row && $row['resetAt'] > Db::now() && (int)$row['hits'] >= $max) {
            throw new HttpError('Trop de tentatives. Reessayez dans quelques minutes.', 429);
        }
    }

    public static function clear(string $bucket): void
    {
        Db::exec('DELETE FROM `RateLimit` WHERE bucket = ?', [$bucket]);
    }

    public static function ip(): string
    {
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
}
