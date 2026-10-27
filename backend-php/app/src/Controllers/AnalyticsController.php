<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Ctx;
use Koligo\Http;
use Koligo\Services\Analytics;

final class AnalyticsController
{
    /** POST /analytics/events : lot d'evenements de l'application. Jeton facultatif : l'identite vient du jeton, jamais du corps. */
    public static function ingest(Ctx $c): array
    {
        return Analytics::ingest($c->body(), $c->user['userId'] ?? null);
    }

    /** GET /admin/usage/overview?days=7 */
    public static function overview(Ctx $c): array
    {
        return Analytics::overview((int)(Http::query('days') ?: 7));
    }

    /** GET /admin/usage/events?days=7 : le plan de marquage et ce qui a ete recu. */
    public static function events(Ctx $c): array
    {
        return Analytics::events((int)(Http::query('days') ?: 7));
    }

    /** GET /admin/usage/journey?q=... */
    public static function journey(Ctx $c): array
    {
        return Analytics::journey((string)Http::query('q', ''));
    }
}
