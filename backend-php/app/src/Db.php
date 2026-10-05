<?php
declare(strict_types=1);

namespace Koligo;

use PDO;

/**
 * Acces base de donnees. MySQL en production, SQLite en local : seules des
 * requetes portables sont ecrites ici. Les dates sont stockees en UTC au
 * format 'Y-m-d H:i:s', ce qui rend les comparaisons identiques des deux cotes.
 */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo) {
            return self::$pdo;
        }
        if (self::isSqlite()) {
            $pdo = new PDO('sqlite:' . Env::get('DB_SQLITE_PATH', dirname(__DIR__) . '/storage/koligo.sqlite'));
            $pdo->exec('PRAGMA foreign_keys = ON');
        } else {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                Env::get('DB_HOST', 'localhost'),
                Env::get('DB_PORT', '3306'),
                Env::get('DB_NAME', '')
            );
            // FOUND_ROWS : rowCount() = lignes trouvees (comme SQLite), pas seulement modifiees.
            $pdo = new PDO($dsn, Env::get('DB_USER', ''), Env::get('DB_PASS', ''), [PDO::MYSQL_ATTR_FOUND_ROWS => true]);
            $pdo->exec("SET time_zone = '+00:00'");
        }
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
        return self::$pdo = $pdo;
    }

    public static function isSqlite(): bool
    {
        return Env::get('DB_DRIVER', 'mysql') === 'sqlite';
    }

    /** @return array<int,array<string,mixed>> */
    public static function all(string $sql, array $params = []): array
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        $row = $st->fetch();
        return $row === false ? null : $row;
    }

    public static function val(string $sql, array $params = [])
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        $v = $st->fetchColumn();
        return $v === false ? null : $v;
    }

    /** Retourne le nombre de lignes touchees. */
    public static function exec(string $sql, array $params = []): int
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st->rowCount();
    }

    public static function insert(string $table, array $data): void
    {
        $cols = array_keys($data);
        $sql = sprintf(
            'INSERT INTO `%s` (%s) VALUES (%s)',
            $table,
            implode(',', array_map(fn($c) => "`$c`", $cols)),
            implode(',', array_fill(0, count($cols), '?'))
        );
        self::exec($sql, array_values(self::bind($data)));
    }

    public static function update(string $table, string $id, array $data): void
    {
        if (!$data) {
            return;
        }
        $set = implode(',', array_map(fn($c) => "`$c` = ?", array_keys($data)));
        self::exec("UPDATE `$table` SET $set WHERE id = ?", [...array_values(self::bind($data)), $id]);
    }

    /** Execute $fn dans une transaction ; annule tout si elle leve. */
    public static function tx(callable $fn)
    {
        $pdo = self::pdo();
        if ($pdo->inTransaction()) {
            return $fn();
        }
        $pdo->beginTransaction();
        try {
            $r = $fn();
            $pdo->commit();
            return $r;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function id(): string
    {
        return 'c' . bin2hex(random_bytes(12));
    }

    public static function now(): string
    {
        return gmdate('Y-m-d H:i:s');
    }

    private static function bind(array $data): array
    {
        foreach ($data as $k => $v) {
            if (is_bool($v)) {
                $data[$k] = $v ? 1 : 0;
            }
        }
        return $data;
    }

    /** Motif LIKE "contient" ; a utiliser avec ESCAPE '!' (seul echappement identique sous MySQL et SQLite). */
    public static function like(string $q): string
    {
        return '%' . preg_replace('/[%_!]/', '!$0', $q) . '%';
    }
}
