<?php
declare(strict_types=1);

// Usage : php app/bin/setup.php [--admin=+2376XXXXXXXX:PIN] [--demo]
// L'admin n'est jamais cree avec un PIN par defaut : il faut le fournir.
require __DIR__ . '/../bootstrap.php';

use Koligo\Setup;

$opts = getopt('', ['admin::', 'demo']);
$say = fn(string $m) => print($m . PHP_EOL);

foreach (Setup::migrate() as $l) { $say("[schema] $l"); }
foreach (Setup::seedReference() as $l) { $say("[reference] $l"); }
if (!empty($opts['admin'])) {
    [$phone, $pin] = array_pad(explode(':', (string)$opts['admin'], 2), 2, '');
    $say('[admin] ' . Setup::ensureAdmin($phone, $pin));
}
if (isset($opts['demo'])) {
    foreach (Setup::seedDemo() as $l) { $say("[demo] $l"); }
}
$say('Termine.');
