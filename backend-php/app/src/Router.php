<?php
declare(strict_types=1);

namespace Koligo;

final class Router
{
    /** @var array<int,array{0:string,1:string,2:callable,3:array}> */
    private array $routes = [];
    /** @var array<int,callable> */
    private array $stack = [];

    /** Les middlewares actifs a l'ajout d'une route lui sont rattaches. */
    public function use(callable ...$mw): void
    {
        array_push($this->stack, ...$mw);
    }

    public function reset(): void
    {
        $this->stack = [];
    }

    public function add(string $method, string $path, callable $handler, callable ...$mw): void
    {
        $regex = '#^' . preg_replace('#:([A-Za-z_]+)#', '(?P<$1>[^/]+)', $path) . '/?$#';
        $this->routes[] = [$method, $regex, $handler, [...$this->stack, ...$mw]];
    }

    public function get(string $p, callable $h, callable ...$mw): void { $this->add('GET', $p, $h, ...$mw); }
    public function post(string $p, callable $h, callable ...$mw): void { $this->add('POST', $p, $h, ...$mw); }
    public function patch(string $p, callable $h, callable ...$mw): void { $this->add('PATCH', $p, $h, ...$mw); }
    public function delete(string $p, callable $h, callable ...$mw): void { $this->add('DELETE', $p, $h, ...$mw); }

    public function dispatch(string $method, string $path): void
    {
        $pathMatched = false;
        foreach ($this->routes as [$m, $regex, $handler, $mw]) {
            if (!preg_match($regex, $path, $match)) {
                continue;
            }
            if ($m !== $method) {
                $pathMatched = true;
                continue;
            }
            $params = array_filter($match, 'is_string', ARRAY_FILTER_USE_KEY);
            $ctx = new Ctx($params);
            try {
                foreach ($mw as $fn) {
                    $fn($ctx);
                }
                // Meme contrat que l'ancien wrap() : le retour est la reponse JSON.
                Http::json($handler($ctx));
            } catch (HttpError $e) {
                Http::json(['error' => $e->getMessage()], $e->status);
            } catch (\Throwable $e) {
                Http::json(['error' => self::publicMessage($e)], 400);
            }
        }
        Http::json(['error' => $pathMatched ? 'Method not allowed' : 'Not found'], $pathMatched ? 405 : 404);
    }

    /** Les details SQL ne sortent jamais vers le client. */
    private static function publicMessage(\Throwable $e): string
    {
        if ($e instanceof \PDOException) {
            error_log('[db] ' . $e->getMessage());
            return 'Erreur interne';
        }
        return $e->getMessage();
    }
}

/** Contexte de requete passe aux middlewares et handlers. */
final class Ctx
{
    public ?array $user = null;

    public function __construct(public array $params) {}

    public function param(string $k): string
    {
        return urldecode($this->params[$k] ?? '');
    }

    public function body(): array
    {
        return Http::body();
    }

    public function input(string $k, $default = null)
    {
        return Http::body()[$k] ?? $default;
    }
}
