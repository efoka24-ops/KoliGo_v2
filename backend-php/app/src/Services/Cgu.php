<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\HttpError;

/**
 * CGU versionnees en base (jamais en dur dans l'app). Chaque publication cree une nouvelle
 * version pour les deux langues ; l'acceptation d'un utilisateur enregistre la version et la date.
 */
final class Cgu
{
    private const LANGS = ['fr', 'en'];

    public static function latestVersion(): int
    {
        return (int)Db::val('SELECT MAX(`version`) FROM `CguVersion`');
    }

    /** Amorce la version 1 depuis le texte par defaut, une seule fois. */
    public static function ensureSeeded(): void
    {
        if (self::latestVersion() > 0) {
            return;
        }
        $def = require dirname(__DIR__, 2) . '/database/cgu_default.php';
        $now = Db::now();
        foreach (self::LANGS as $lang) {
            Db::insert('CguVersion', ['version' => 1, 'lang' => $lang, 'content' => json_encode($def[$lang], JSON_UNESCAPED_UNICODE), 'createdAt' => $now]);
        }
    }

    /** @return array{version:int,lang:string,publishedAt:?string,articles:array<int,array{num:string,title:string,body:string}>} */
    public static function get(string $lang, ?int $version = null): array
    {
        self::ensureSeeded();
        $lang = in_array($lang, self::LANGS, true) ? $lang : 'fr';
        $version ??= self::latestVersion();
        $row = Db::one('SELECT * FROM `CguVersion` WHERE `version` = ? AND lang = ?', [$version, $lang]);
        if (!$row) {
            throw new HttpError('Version des CGU introuvable', 404);
        }
        $articles = json_decode((string)$row['content'], true) ?: [];
        $cfg = Pricing::config();
        $tokens = [
            '{{cancel_fee}}' => (string)$cfg['cancelFee'],
            '{{revision_timeout}}' => (string)$cfg['revisionTimeoutMin'],
            '{{strike_threshold}}' => (string)$cfg['strikeThreshold'],
            '{{strike_window}}' => (string)$cfg['strikeWindowDays'],
            '{{cancel_grace}}' => (string)$cfg['cancelGraceMin'],
        ];
        foreach ($articles as &$a) {
            $a['title'] = strtr((string)$a['title'], $tokens);
            $a['body'] = strtr((string)$a['body'], $tokens);
        }
        return ['version' => (int)$row['version'], 'lang' => $lang, 'publishedAt' => $row['createdAt'], 'articles' => $articles];
    }

    /** Texte brut (jetons non remplaces) pour l'edition dans le back-office. */
    public static function raw(string $lang, ?int $version = null): array
    {
        self::ensureSeeded();
        $version ??= self::latestVersion();
        $row = Db::one('SELECT * FROM `CguVersion` WHERE `version` = ? AND lang = ?', [$version, $lang]);
        return ['version' => $version, 'lang' => $lang, 'articles' => $row ? (json_decode((string)$row['content'], true) ?: []) : []];
    }

    /** Publie une nouvelle version (les deux langues). Les utilisateurs devront la re-accepter. */
    public static function publish(array $fr, array $en, ?string $adminId): int
    {
        $fr = self::validate($fr, 'français');
        $en = self::validate($en, 'anglais');
        self::ensureSeeded();
        $next = self::latestVersion() + 1;
        $now = Db::now();
        Db::tx(function () use ($next, $fr, $en, $adminId, $now) {
            foreach (['fr' => $fr, 'en' => $en] as $lang => $articles) {
                Db::insert('CguVersion', ['version' => $next, 'lang' => $lang, 'content' => json_encode($articles, JSON_UNESCAPED_UNICODE), 'createdBy' => $adminId, 'createdAt' => $now]);
            }
        });
        return $next;
    }

    public static function history(): array
    {
        return Db::all('SELECT `version`, MIN(createdAt) AS publishedAt, MAX(createdBy) AS createdBy FROM `CguVersion` GROUP BY `version` ORDER BY `version` DESC');
    }

    /** @return array<int,array{num:string,title:string,body:string}> */
    private static function validate(array $articles, string $label): array
    {
        if (!$articles || count($articles) > 40) {
            throw new HttpError("CGU $label : au moins un article (40 maximum)");
        }
        $out = [];
        foreach (array_values($articles) as $i => $a) {
            $title = trim((string)($a['title'] ?? ''));
            $body = trim((string)($a['body'] ?? ''));
            if ($title === '' || $body === '' || mb_strlen($title) > 200 || mb_strlen($body) > 8000) {
                throw new HttpError('CGU ' . $label . ' : article ' . ($i + 1) . ' invalide (titre et texte requis)');
            }
            $out[] = ['num' => (string)($a['num'] ?? ($i + 1)), 'title' => $title, 'body' => $body];
        }
        return $out;
    }

    /** Enregistre l'acceptation de la version courante par l'utilisateur. */
    public static function accept(string $userId, int $version): array
    {
        $latest = self::latestVersion();
        if ($version !== $latest) {
            throw new HttpError('Une nouvelle version des CGU est disponible', 409, 'CGU_OUTDATED');
        }
        $now = Db::now();
        Db::update('User', $userId, ['cguVersion' => $version, 'cguAcceptedAt' => $now, 'updatedAt' => $now]);
        return ['cguVersion' => $version, 'cguAcceptedAt' => $now];
    }

    public static function needsAcceptance(array $user): bool
    {
        return (int)($user['cguVersion'] ?? 0) < max(1, self::latestVersion());
    }
}
