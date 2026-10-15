<?php
// Test en processus de la gestion des versions (SQLite en memoire).
//   DB_DRIVER=sqlite DB_SQLITE_PATH=:memory: php tests/app_versions_test.php
require __DIR__ . '/../app/bootstrap.php';

use Koligo\Setup;
use Koligo\Services\AppVersions;

Setup::migrate();
Setup::seedReference();

$pass = 0;
$fail = 0;
function ck(string $n, bool $ok, $d = ''): void
{
    global $pass, $fail;
    $ok ? $pass++ : $fail++;
    echo ($ok ? '  ok   ' : '  FAIL ') . $n . ($ok ? '' : '  -> ' . json_encode($d)) . PHP_EOL;
}

$cur = AppVersions::current();
ck('version de depart active', $cur && $cur['version'] === '1.0.20' && (int)$cur['versionCode'] === 21);
ck('telephone a jour : pas de blocage', AppVersions::check(21)['mustUpdate'] === false);
ck('build inconnu (0) : jamais bloque', AppVersions::check(0)['mustUpdate'] === false);

$v = AppVersions::create(['version' => '1.0.50', 'versionCode' => 50, 'downloadUrl' => '/landing/koligo-v1.0.50.apk', 'notes' => 'Notifications'], 'admin1');
ck('creation sans activation', (int)$v['isCurrent'] === 0 && AppVersions::current()['version'] === '1.0.20');
ck('toujours pas bloque', AppVersions::check(21)['mustUpdate'] === false);

AppVersions::activate($v['id']);
$r = AppVersions::check(21);
ck('activation : ancien telephone bloque', $r['mustUpdate'] === true && $r['version'] === '1.0.50' && $r['downloadUrl'] === '/landing/koligo-v1.0.50.apk', $r);
ck('telephone a jour passe', AppVersions::check(50)['mustUpdate'] === false);

$old = AppVersions::all();
$first = null;
foreach ($old as $o) {
    if ((int)$o['versionCode'] === 21) {
        $first = $o;
    }
}
AppVersions::activate($first['id']);
$r = AppVersions::check(50);
ck('retour arriere : le telephone plus recent est invite', $r['mustUpdate'] === true && $r['downgrade'] === true && $r['version'] === '1.0.20', $r);
ck('une seule version active', count(array_filter(AppVersions::all(), fn($x) => (int)$x['isCurrent'] === 1)) === 1);

AppVersions::update($first['id'], ['forceUpdate' => false]);
$r = AppVersions::check(50);
ck('mise a jour facultative : propose sans bloquer', $r['mustUpdate'] === false && $r['updateAvailable'] === true, $r);

foreach ([['version' => 'abc', 'versionCode' => 30, 'downloadUrl' => '/x.apk'], ['version' => '1.0.30', 'versionCode' => 0, 'downloadUrl' => '/x.apk'],
          ['version' => '1.0.30', 'versionCode' => 30, 'downloadUrl' => 'javascript:alert(1)'], ['version' => '1.0.30', 'versionCode' => 22, 'downloadUrl' => '/x.apk']] as $i => $bad) {
    try {
        AppVersions::create($bad, 'a');
        ck("refus entree invalide #$i", false);
    } catch (\Koligo\HttpError) {
        ck("refus entree invalide #$i", true);
    }
}
try {
    AppVersions::delete($first['id']);
    ck('suppression de la version active refusee', false);
} catch (\Koligo\HttpError) {
    ck('suppression de la version active refusee', true);
}
AppVersions::delete($v['id']);
ck('suppression d\'une ancienne version', count(AppVersions::all()) === 2);

echo PHP_EOL . "$pass ok, $fail echec" . PHP_EOL;
exit($fail ? 1 : 0);
