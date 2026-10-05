<?php
declare(strict_types=1);

namespace Koligo;

/** Chargement de relations en lot (equivalent minimal des `include` Prisma). */
final class Rel
{
    /**
     * Attache a chaque ligne l'enregistrement de $table dont l'id est $row[$fk],
     * sous la cle $key, restreint aux colonnes $cols (null si absent).
     *
     * @param array<int,array<string,mixed>> $rows
     * @return array<int,array<string,mixed>>
     */
    public static function one(array $rows, string $fk, string $key, string $table, array $cols): array
    {
        $ids = array_values(array_unique(array_filter(array_column($rows, $fk))));
        $map = [];
        if ($ids) {
            $sel = implode(',', array_map(fn($c) => "`$c`", array_unique(['id', ...$cols])));
            $in = implode(',', array_fill(0, count($ids), '?'));
            foreach (Db::all("SELECT $sel FROM `$table` WHERE id IN ($in)", $ids) as $r) {
                $map[$r['id']] = array_intersect_key($r, array_flip($cols));
            }
        }
        foreach ($rows as &$row) {
            $row[$key] = $map[$row[$fk] ?? ''] ?? null;
        }
        return $rows;
    }

    public static function user(array $rows, string $fk, string $key, array $cols): array
    {
        return self::one($rows, $fk, $key, 'User', $cols);
    }

    public static function delivery(array $rows, string $key, array $cols): array
    {
        return self::one($rows, 'deliveryId', $key, 'Delivery', $cols);
    }

    /** Variante pour une seule ligne. */
    public static function single(?array $row, callable $attach): ?array
    {
        return $row ? $attach([$row])[0] : null;
    }
}
