<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;

/**
 * Surveillance des messages echanges dans les livraisons (produits illicites ou dangereux).
 * Un message qui contient un mot de la liste est SIGNALE a l'administrateur ; il n'est pas bloque.
 * La liste vit en base (reglage `moderation_keywords`, un mot ou une expression par ligne ou separes par une virgule).
 */
final class Moderation
{
    public const DEFAULT_KEYWORDS = [
        'drogue', 'cannabis', 'chanvre indien', 'marijuana', 'cocaine', 'heroine', 'crack', 'ecstasy', 'tramadol', 'ketamine', 'amphetamine',
        'arme', 'armes', 'pistolet', 'fusil', 'kalachnikov', 'munition', 'munitions', 'explosif', 'grenade', 'poudre noire',
        'faux billets', 'faux billet', 'faux documents', 'faux papiers', 'ivoire', 'pangolin', 'poison',
    ];

    /** Minuscules, sans accents, espaces normalises. */
    public static function normalize(string $s): string
    {
        $s = mb_strtolower($s, 'UTF-8');
        $map = ['à' => 'a', 'â' => 'a', 'ä' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', 'œ' => 'oe'];
        $s = strtr($s, $map);
        return trim((string)preg_replace('/\s+/u', ' ', $s));
    }

    /** @return string[] */
    public static function keywords(): array
    {
        $raw = Db::val("SELECT `value` FROM `PlatformSetting` WHERE `key` = 'moderation_keywords'");
        if ($raw === null || $raw === false || trim((string)$raw) === '') {
            return self::DEFAULT_KEYWORDS;
        }
        $out = [];
        foreach (preg_split('/[\r\n,;]+/', (string)$raw) ?: [] as $w) {
            $w = self::normalize($w);
            if ($w !== '') {
                $out[] = $w;
            }
        }
        return $out;
    }

    /** Mots de la liste trouves dans le texte (mots entiers). */
    public static function scan(string $text): array
    {
        $t = self::normalize($text);
        $hits = [];
        foreach (self::keywords() as $k) {
            if (preg_match('/(?<![a-z0-9])' . preg_quote($k, '/') . '(?![a-z0-9])/u', $t)) {
                $hits[] = $k;
            }
        }
        return array_values(array_unique($hits));
    }
}
