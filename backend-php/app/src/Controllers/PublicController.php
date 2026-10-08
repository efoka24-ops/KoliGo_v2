<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Auth;
use Koligo\Ctx;
use Koligo\Db;
use Koligo\Env;
use Koligo\Http;
use Koligo\HttpError;
use Koligo\Rel;
use Koligo\Services\Cgu;
use Koligo\Services\Distance;
use Koligo\Services\Pricing;

final class PublicController
{
    public static function cities(Ctx $c): array
    {
        $cities = Db::all('SELECT * FROM `City` WHERE isActive = 1 ORDER BY region ASC, name ASC');
        $byCity = [];
        foreach (Db::all('SELECT id, name, latitude, longitude, cityId FROM `Neighborhood` WHERE isActive = 1 ORDER BY name ASC') as $n) {
            $cid = $n['cityId'];
            unset($n['cityId']);
            $byCity[$cid][] = $n;
        }
        foreach ($cities as &$city) {
            $city['neighborhoods'] = $byCity[$city['id']] ?? [];
        }
        return $cities;
    }

    /**
     * Tarifs publics, lus en base (modifiables depuis le back-office). Les anciennes cles (baseRate, perKmRate,
     * weightSurcharge...) restent pour les versions d'app deja installees.
     */
    public static function pricing(Ctx $c): array
    {
        $cfg = Pricing::config();
        $default = $cfg['zones'][0];
        foreach ($cfg['zones'] as $z) {
            if ($z['name'] === $cfg['defaultZone']) {
                $default = $z;
            }
        }
        return [
            'baseRate' => (int)$default['base'],
            'perKmRate' => (int)$default['perKm'],
            'minPrice' => $cfg['minPrice'],
            'weightSurcharge' => $cfg['weightRate'],
            'commissionRate' => (int)round($cfg['commissionRate'] * 100),
            'zones' => $cfg['zones'],
            'gabarits' => $cfg['gabarits'],
            'cancelFeeXAF' => $cfg['cancelFee'],
            'revisionTimeoutMin' => $cfg['revisionTimeoutMin'],
            'cancelGraceMin' => $cfg['cancelGraceMin'],
        ];
    }

    /** Etat de la plateforme lu par l'application (mode maintenance reglable depuis le back-office). */
    public static function config(Ctx $c): array
    {
        $cfg = Pricing::config();
        return ['maintenance' => $cfg['maintenance'], 'minWithdrawalXAF' => $cfg['minWithdrawal']];
    }

    /** Devis : le meme calcul que la creation (distance, zone, gabarit, type de livreur). */
    public static function quote(Ctx $c): array
    {
        $from = (string)Http::query('from');
        $to = (string)Http::query('to');
        $size = strtoupper((string)Http::query('size'));
        $type = (string)(Http::query('type') ?: 'TEMPORAIRE');
        if ($from === '' || $to === '' || $size === '') {
            throw new HttpError('from, to et size requis');
        }
        $km = Distance::googleKm($from, $to) ?? Distance::km($from, $to) ?? 2.0;
        $region = Pricing::resolveRegion(Http::query('fromCity') ?: null, $from);
        $q = Pricing::quote($region, (float)$km, $size, $type);
        return $q + ['cancelFeeXAF' => Pricing::config()['cancelFee']];
    }

    /** CGU en vigueur dans la langue demandee (texte stocke en base, jetons deja remplaces). */
    public static function cgu(Ctx $c): array
    {
        return Cgu::get((string)(Http::query('lang') ?: 'fr'));
    }

    public static function distance(Ctx $c): array
    {
        $from = Http::query('from');
        $to = Http::query('to');
        if (!$from || !$to) {
            throw new HttpError('from et to requis');
        }
        return ['km' => Distance::km($from, $to)];
    }

    // ── Page de suivi (HTML) pour les destinataires ──────────────────────────

    public static function trackStatus(Ctx $c): array
    {
        $s = Db::val('SELECT status FROM `Delivery` WHERE id = ?', [$c->param('id')]);
        if ($s === null) {
            throw new HttpError('not found', 404);
        }
        return ['status' => $s];
    }

    public static function trackPage(Ctx $c): void
    {
        $token = $c->param('token');
        try {
            if (str_contains($token, '.')) {
                // clientToken JWT historique, toujours accepte
                $id = (string)(Auth::verifyAccess($token)['deliveryId'] ?? '');
            } else {
                $id = $token;
            }
            $d = Db::one('SELECT * FROM `Delivery` WHERE id = ?', [$id]);
            if (!$d) {
                self::trackError('Cette livraison est introuvable. Vérifiez le lien.', 404);
            }
            $d = Rel::user([$d], 'delivererId', 'deliverer', ['name', 'phone', 'quartier'])[0];
            $d = Rel::user([$d], 'vendorId', 'vendor', ['name'])[0];
            ob_start();
            require dirname(__DIR__, 2) . '/views/track.php';
            Http::html((string)ob_get_clean());
        } catch (HttpError $e) {
            throw $e;
        } catch (\Throwable $e) {
            self::trackError("Ce lien de suivi est invalide ou expiré. Demandez un nouveau lien à l'expéditeur.", 400);
        }
    }

    private static function trackError(string $message, int $status): never
    {
        $m = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        Http::html('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<title>Lien invalide · KoliGo</title><style>body{font-family:-apple-system,sans-serif;background:#FBF5E6;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}'
            . '.box{background:#fff;border-radius:20px;padding:32px 24px;max-width:360px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}'
            . 'h2{font-size:22px;font-weight:800;color:#D8472A;margin-bottom:12px}p{font-size:14px;color:#666;line-height:1.6}</style></head>'
            . "<body><div class=\"box\"><h2>❌ Lien invalide</h2><p>$m</p></div></body></html>", $status);
    }
}
