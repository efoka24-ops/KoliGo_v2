<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Ctx;
use Koligo\Http;
use Koligo\HttpError;
use Koligo\RateLimit;
use Koligo\Services\Annonces;

final class AnnonceController
{
    /** Identifiant du demandeur ; vide pour un visiteur sans compte (le fil est public). */
    private static function uid(Ctx $c): string
    {
        return (string)($c->user['userId'] ?? '');
    }

    private static function isAdmin(Ctx $c): bool
    {
        return ($c->user['activeRole'] ?? '') === 'ADMIN';
    }

    /** GET /public/ads/config : categories, tarifs Boost, limites. */
    public static function config(Ctx $c): array
    {
        return Annonces::config();
    }

    /** GET /public/ads : fil des annonces en ligne (aucun compte requis). */
    public static function feed(Ctx $c): array
    {
        RateLimit::hit('adfeed:ip:' . RateLimit::ip(), 240, 600);
        return ['items' => Annonces::feed($_GET, self::uid($c))];
    }

    /** GET /public/ads/:id */
    public static function show(Ctx $c): array
    {
        RateLimit::hit('adview:ip:' . RateLimit::ip(), 240, 600);
        return Annonces::get($c->param('id'), self::uid($c), self::isAdmin($c));
    }

    /** GET /public/ads/:id/photo/:n */
    public static function photo(Ctx $c): void
    {
        $path = Annonces::photoPath($c->param('id'), (int)$c->param('n'), self::uid($c), self::isAdmin($c));
        $real = realpath($path);
        $root = realpath(AuthController::uploadDir());
        if (!$real || !$root || !str_starts_with($real, $root) || !is_file($real)) {
            throw new HttpError('Photo introuvable', 404);
        }
        header('Content-Type: ' . (strtolower(pathinfo($real, PATHINFO_EXTENSION)) === 'png' ? 'image/png' : 'image/jpeg'));
        header('Cache-Control: public, max-age=3600');
        header('X-Content-Type-Options: nosniff');
        readfile($real);
        exit;
    }

    /** POST /ads : publie une annonce (Flash gratuit, ou Boost : brouillon + paiement Mobile Money). */
    public static function create(Ctx $c): array
    {
        $r = Annonces::create(self::uid($c), $c->body());
        http_response_code(201);
        return $r;
    }

    public static function mine(Ctx $c): array
    {
        return ['items' => Annonces::mine(self::uid($c))];
    }

    public static function withdraw(Ctx $c): array
    {
        return Annonces::withdraw($c->param('id'), self::uid($c));
    }

    public static function republish(Ctx $c): array
    {
        $days = $c->input('days');
        $r = Annonces::republish($c->param('id'), self::uid($c), strtoupper((string)$c->input('type', 'FLASH')), is_numeric($days) ? (int)$days : null, $c->input('phone') !== null ? (string)$c->input('phone') : null);
        http_response_code(201);
        return $r;
    }

    public static function contact(Ctx $c): array
    {
        return Annonces::contact($c->param('id'), self::uid($c));
    }

    public static function report(Ctx $c): array
    {
        return Annonces::report($c->param('id'), self::uid($c), (string)$c->input('reason', ''));
    }

    public static function paymentStatus(Ctx $c): array
    {
        return Annonces::paymentStatus($c->param('id'), self::uid($c));
    }

    // ── Administration ───────────────────────────────────────────────────────

    public static function adminPayments(Ctx $c): array
    {
        return ['items' => Annonces::adminPayments()];
    }

    public static function adminCheckPayment(Ctx $c): array
    {
        return Annonces::adminCheckPayment($c->param('id'));
    }

    public static function adminList(Ctx $c): array
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        return Annonces::adminList($_GET, 25, ($page - 1) * 25);
    }

    public static function adminDecide(Ctx $c): array
    {
        return Annonces::adminDecide($c->param('id'), self::uid($c), (string)$c->input('action', ''), (string)$c->input('reason', ''));
    }

    public static function adminConfig(Ctx $c): array
    {
        return Annonces::config();
    }

    public static function adminSaveConfig(Ctx $c): array
    {
        return Annonces::saveConfig($c->body());
    }
}
