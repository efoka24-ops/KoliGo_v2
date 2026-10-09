<?php
declare(strict_types=1);

namespace Koligo;

final class Auth
{
    public static function accessSecret(): string
    {
        return Env::get('JWT_ACCESS_SECRET', '') ?? '';
    }

    public static function signAccess(array $payload): string
    {
        return Jwt::sign($payload, self::accessSecret(), Jwt::ttl(Env::get('JWT_ACCESS_EXPIRES', '15m'), 900));
    }

    public static function signRefresh(array $payload): string
    {
        return Jwt::sign($payload, Env::get('JWT_REFRESH_SECRET', '') ?? '', Jwt::ttl(Env::get('JWT_REFRESH_EXPIRES', '7d'), 604800));
    }

    public static function verifyAccess(string $token): array
    {
        return Jwt::verify($token, self::accessSecret());
    }

    public static function verifyRefresh(string $token): array
    {
        return Jwt::verify($token, Env::get('JWT_REFRESH_SECRET', '') ?? '');
    }

    public static function signClientToken(string $deliveryId): string
    {
        return Jwt::sign(['deliveryId' => $deliveryId, 'type' => 'client'], self::accessSecret(), 7 * 86400);
    }

    /** Middleware : exige un Bearer valide. */
    public static function verifyJWT(Ctx $c): void
    {
        $h = Http::header('Authorization');
        if (!$h || !str_starts_with($h, 'Bearer ')) {
            throw new HttpError('Missing token', 401);
        }
        try {
            $d = self::verifyAccess(substr($h, 7));
        } catch (\Throwable) {
            throw new HttpError('Invalid or expired token', 401);
        }
        if (($d['type'] ?? '') === 'admin-setup') {
            throw new HttpError('Invalid or expired token', 401);
        }
        // Un compte bloque perd sa session tout de suite (401 : l'application se deconnecte).
        if (!empty($d['userId']) && Db::val('SELECT isBlocked FROM `User` WHERE id = ?', [$d['userId']])) {
            throw new HttpError('Compte suspendu. Contactez KoliGo.', 401, 'ACCOUNT_BLOCKED');
        }
        $c->user = ['userId' => $d['userId'] ?? '', 'phone' => $d['phone'] ?? '', 'activeRole' => $d['activeRole'] ?? ''];
    }

    public static function requireRole(string ...$roles): callable
    {
        return function (Ctx $c) use ($roles): void {
            if (!$c->user || !in_array($c->user['activeRole'], $roles, true)) {
                throw new HttpError('Forbidden', 403);
            }
        };
    }

    /** Code a 4 chiffres. */
    public static function code4(): string
    {
        return str_pad((string)random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
    }
}
