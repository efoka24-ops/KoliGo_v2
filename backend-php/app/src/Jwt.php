<?php
declare(strict_types=1);

namespace Koligo;

/** JWT HS256 minimal. Compatible avec les jetons emis par l'ancien backend Node. */
final class Jwt
{
    public static function sign(array $payload, string $secret, int $ttl): string
    {
        $now = time();
        $payload += ['iat' => $now, 'exp' => $now + $ttl];
        $h = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $p = self::b64(json_encode($payload));
        return "$h.$p." . self::b64(hash_hmac('sha256', "$h.$p", $secret, true));
    }

    /** @throws \RuntimeException jeton invalide ou expire */
    public static function verify(string $token, string $secret): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3 || $secret === '') {
            throw new \RuntimeException('jwt malformed');
        }
        [$h, $p, $s] = $parts;
        $header = json_decode(self::unb64($h), true);
        // On n'accepte que HS256 : refuser "none" est ce qui empeche de forger un jeton.
        if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256') {
            throw new \RuntimeException('jwt alg');
        }
        $expected = self::b64(hash_hmac('sha256', "$h.$p", $secret, true));
        if (!hash_equals($expected, $s)) {
            throw new \RuntimeException('invalid signature');
        }
        $payload = json_decode(self::unb64($p), true);
        if (!is_array($payload)) {
            throw new \RuntimeException('jwt payload');
        }
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            throw new \RuntimeException('jwt expired');
        }
        return $payload;
    }

    /** "15m", "7d", "3600" -> secondes. */
    public static function ttl(string $spec, int $default): int
    {
        if (!preg_match('/^(\d+)\s*([smhd]?)$/', trim($spec), $m)) {
            return $default;
        }
        $mult = ['' => 1, 's' => 1, 'm' => 60, 'h' => 3600, 'd' => 86400][$m[2]];
        return (int)$m[1] * $mult;
    }

    private static function b64(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    private static function unb64(string $s): string
    {
        return (string)base64_decode(strtr($s, '-_', '+/'));
    }
}
