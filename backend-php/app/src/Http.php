<?php
declare(strict_types=1);

namespace Koligo;

/** Erreur metier renvoyee telle quelle au client : {"error": message}. */
class HttpError extends \RuntimeException
{
    public function __construct(string $message, public int $status = 400)
    {
        parent::__construct($message);
    }
}

final class Http
{
    private static ?array $body = null;
    public static ?string $raw = null;

    public static function rawBody(): string
    {
        return self::$raw ??= (string)file_get_contents('php://input');
    }

    /** Corps JSON decode ; tableau vide si absent ou invalide. */
    public static function body(): array
    {
        if (self::$body !== null) {
            return self::$body;
        }
        $d = json_decode(self::rawBody(), true);
        return self::$body = is_array($d) ? $d : [];
    }

    public static function query(string $key, ?string $default = null): ?string
    {
        $v = $_GET[$key] ?? null;
        return is_string($v) && $v !== '' ? $v : $default;
    }

    public static function header(string $name): ?string
    {
        $k = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        if (isset($_SERVER[$k])) {
            return (string)$_SERVER[$k];
        }
        // Certains Apache/FastCGI ne transmettent pas Authorization : .htaccess le reinjecte.
        if ($name === 'Authorization') {
            return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null;
        }
        return null;
    }

    /** Sans $status explicite, garde le code deja positionne par le handler (ex. 201). */
    public static function json($data, ?int $status = null): never
    {
        http_response_code($status ?? (http_response_code() ?: 200));
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(Out::clean($data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
        exit;
    }

    public static function html(string $html, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        echo $html;
        exit;
    }
}

/**
 * Normalise les lignes SQL avant de les serialiser, pour que l'API reste
 * identique a celle de Prisma : dates en ISO 8601, booleens en vrais booleens.
 */
final class Out
{
    private const BOOLS = ['isBlocked', 'isOnline', 'biometryEnabled', 'isActive', 'used'];

    public static function clean($v)
    {
        if (!is_array($v)) {
            return $v;
        }
        $out = [];
        foreach ($v as $k => $x) {
            if (is_string($k) && $x !== null && !is_array($x)) {
                if (in_array($k, self::BOOLS, true)) {
                    $x = (bool)$x;
                } elseif (is_string($x) && preg_match('/At$/', $k) && preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $x)) {
                    $x = str_replace(' ', 'T', $x) . '.000Z';
                }
            }
            $out[$k] = self::clean($x);
        }
        return $out;
    }
}
