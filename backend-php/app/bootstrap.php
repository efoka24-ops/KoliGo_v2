<?php
declare(strict_types=1);

use Koligo\Env;
use Koligo\Http;
use Koligo\Router;

// Un petit projet : on charge tout explicitement plutot que de dependre d'un
// autoloader (plusieurs classes partagent un fichier, ex. Http/HttpError/Out).
foreach ([
    'Env', 'Db', 'Jwt', 'Http', 'Router', 'Auth', 'RateLimit', 'Rel',
    'Services/Pricing', 'Services/Distance', 'Services/Sungku', 'Services/Smtp', 'Services/Notify',
    'Services/Accounts', 'Services/AdminLogin', 'Services/Uploads', 'Services/Kyc', 'Services/Cgu',
    'Services/Deliveries', 'Services/Payments', 'Services/Invoices', 'Setup',
    'Controllers/AuthController', 'Controllers/DeliveryController', 'Controllers/WalletController',
    'Controllers/PaymentController', 'Controllers/AdminController', 'Controllers/PublicController',
] as $f) {
    require_once __DIR__ . "/src/$f.php";
}

foreach ([getenv('KOLIGO_ENV_FILE') ?: '', __DIR__ . '/.env.php', __DIR__ . '/.env'] as $envFile) {
    if ($envFile !== '' && is_file($envFile)) {
        Env::load($envFile);
        break;
    }
}

date_default_timezone_set('UTC');
ini_set('display_errors', '0');
ini_set('log_errors', '1');
@mkdir(__DIR__ . '/storage/logs', 0750, true);
ini_set('error_log', __DIR__ . '/storage/logs/php-error.log');

function koligo_run(): void
{
    set_exception_handler(function (\Throwable $e) {
        error_log('[fatal] ' . $e);
        Http::json(['error' => 'Erreur interne'], 500);
    });

    // CORS ouvert (l'app mobile et le back-office web appellent depuis d'autres origines).
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    \Koligo\Setup::ensureSchema();

    $path = rtrim((string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/') ?: '/';

    // Mode maintenance (réglable depuis le back-office) : seuls l'état de la plateforme, la connexion,
    // le back-office et les webhooks de paiement restent joignables.
    if (\Koligo\Services\Pricing::config()['maintenance']
        && !preg_match('#^(/api)?/(health|public|admin|auth|payments?)(/|$)#', $path)) {
        Http::json(['error' => 'KoliGo est en maintenance. Réessayez dans quelques instants.', 'code' => 'MAINTENANCE'], 503);
    }

    $router = new Router();
    (require __DIR__ . '/routes.php')($router);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // L'hebergeur (Apache/WAF) rejette PUT, PATCH et DELETE par un 403 avant PHP.
    // Les clients envoient donc POST + X-HTTP-Method-Override ; les vrais verbes
    // restent acceptes pour les environnements sans cette restriction.
    if ($method === 'POST') {
        $override = strtoupper((string)(Http::header('X-HTTP-Method-Override') ?? ''));
        if (in_array($override, ['PUT', 'PATCH', 'DELETE'], true)) {
            $method = $override;
        }
    }
    $router->dispatch($method, $path);
}
