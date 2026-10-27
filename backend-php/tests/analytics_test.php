<?php
// Test en processus du suivi d'usage (SQLite en memoire).
//   DB_DRIVER=sqlite DB_SQLITE_PATH=:memory: php tests/analytics_test.php
require __DIR__ . '/../app/bootstrap.php';

use Koligo\Db;
use Koligo\HttpError;
use Koligo\Setup;
use Koligo\Services\Analytics;
use Koligo\Services\Kyc;
use Koligo\Services\Payments;

Setup::migrate();
Setup::seedReference();

$pass = 0;
$fail = 0;
function ck(string $n, bool $ok, $d = ''): void
{
    global $pass, $fail;
    $ok ? $pass++ : $fail++;
    echo ($ok ? '  ok   ' : '  FAIL ') . $n . ($ok ? '' : '  -> ' . json_encode($d, JSON_UNESCAPED_UNICODE)) . PHP_EOL;
}
function count_events(string $where = '1=1', array $a = []): int
{
    return (int)Db::val("SELECT COUNT(*) FROM `AnalyticsEvent` WHERE $where", $a);
}
function ev(string $id, string $name, array $x = []): array
{
    return $x + ['id' => $id, 'name' => $name, 't' => (time() - 60) * 1000, 'sid' => 'sess-0000-0001'];
}

$plan = Analytics::plan();
$names = array_column($plan['events'], 'name');
ck('plan charge', count($names) > 40 && in_array('screen_view', $names, true));
ck('noms uniques dans le plan', count($names) === count(array_unique($names)));
ck('entonnoirs du plan referencent des evenements du plan', (function () use ($plan, $names) {
    foreach ($plan['funnels'] as $f) {
        foreach ($f['steps'] as $s) {
            if (!in_array($s['event'], $names, true)) {
                return false;
            }
        }
    }
    return true;
})());

// ── Reception ────────────────────────────────────────────────────────────────
$dev = 'dev-aaaa-0001';
$batch = ['deviceId' => $dev, 'appVersion' => '1.0.23', 'platform' => 'android', 'lang' => 'fr', 'events' => [
    ev('e-0000-0001', 'screen_view', ['screen' => 'Signup']),
    ev('e-0000-0002', 'otp_sent', ['params' => ['sms' => true, 'email' => false]]),
    ev('e-0000-0003', 'otp_verified'),
    ev('e-0000-0004', 'signup_success', ['params' => ['role' => 'VENDOR']]),
]];
$r = Analytics::ingest($batch, null);
ck('lot accepte', $r['accepted'] === 4 && $r['dropped'] === 0, $r);
ck('evenements enregistres avec appareil et version', count_events('deviceId = ? AND appVersion = ? AND platform = ?', [$dev, '1.0.23', 'android']) === 4);

$r = Analytics::ingest($batch, null);
ck('renvoi du meme lot : aucun doublon', $r['accepted'] === 4 && count_events() === 4, $r);

$r = Analytics::ingest(['deviceId' => $dev, 'events' => [
    ev('e-0000-0010', 'evenement_inconnu'),
    ev('e-0000-0011', 'payment_confirmed'),          // reserve au serveur
    ['id' => 'x', 'name' => 'screen_view'],            // identifiant invalide
    'pas un tableau',
    ev('e-0000-0012', 'screen_view', ['screen' => 'Ads']),
]], null);
ck('inconnus, evenements serveur et malformes ecartes', $r['accepted'] === 1 && $r['dropped'] === 4, $r);

foreach (['', 'court', "bad id with spaces and ;"] as $i => $bad) {
    try {
        Analytics::ingest(['deviceId' => $bad, 'events' => []], null);
        ck("deviceId invalide #$i refuse", false);
    } catch (HttpError) {
        ck("deviceId invalide #$i refuse", true);
    }
}

// ── Donnees personnelles ─────────────────────────────────────────────────────
$p = json_decode((string)Analytics::cleanParams([
    'phone' => '+237677000099', 'code' => '1234', 'pin' => '0000', 'email' => 'a@b.cm', 'name' => 'Awa',
    'message' => 'Numero 677000099 invalide pour awa@gmail.com', 'type' => 'BOOST', 'days' => 3, 'enabled' => true,
    'tableau' => [1, 2], 'Mauvaise Cle' => 'x',
]), true);
ck('cles personnelles retirees', !isset($p['phone'], $p['code'], $p['pin'], $p['email'], $p['name']), $p);
ck('numeros et e-mails masques dans le texte', ($p['message'] ?? '') === 'Numero # invalide pour #', $p);
ck('valeurs simples conservees, tableaux et mauvaises cles ecartes', ($p['type'] ?? '') === 'BOOST' && ($p['days'] ?? 0) === 3 && ($p['enabled'] ?? null) === true && !isset($p['tableau']) && !isset($p['Mauvaise Cle']), $p);
$many = Analytics::cleanParams(array_combine(array_map(fn($i) => "k$i", range(1, 20)), range(1, 20)));
ck('10 parametres au plus', count(json_decode((string)$many, true)) === 10);
ck('chaine trop longue tronquee', strlen(json_decode((string)Analytics::cleanParams(['m' => str_repeat('a', 300)]), true)['m']) === 100);
ck('rien a garder : null', Analytics::cleanParams(['phone' => '1']) === null && Analytics::cleanParams([]) === null);

// ── Horloge et identite ──────────────────────────────────────────────────────
Analytics::ingest(['deviceId' => 'dev-bbbb-0002', 'events' => [ev('f-0000-0001', 'app_open', ['t' => (time() + 86400 * 30) * 1000])]], null);
$t = strtotime((string)Db::val("SELECT occurredAt FROM AnalyticsEvent WHERE deviceId = 'dev-bbbb-0002'") . ' UTC');
ck('horloge du telephone fausse : date de reception', abs($t - time()) < 10, $t);

Db::insert('User', ['id' => 'cuser0000000000000000001', 'phone' => '+237677000099', 'name' => 'Awa', 'pinHash' => 'x', 'createdAt' => Db::now(), 'updatedAt' => Db::now()]);
$uid = 'cuser0000000000000000001';
Analytics::ingest(['deviceId' => $dev, 'events' => [ev('e-0000-0020', 'login_success', ['role' => 'vendor', 'userId' => 'pirate'])]], $uid);
ck("l'identite vient du jeton, pas du corps", (string)Db::val("SELECT userId FROM AnalyticsEvent WHERE id = ?", [sha1($dev . '|e-0000-0020')]) === $uid);
ck('role normalise', Db::val("SELECT role FROM AnalyticsEvent WHERE id = ?", [sha1($dev . '|e-0000-0020')]) === 'vendor');

// ── Evenements du serveur ────────────────────────────────────────────────────
Analytics::server('payment_confirmed', null, ['kind' => 'ad'], 'KOLIGO-AD-1|ok');
Analytics::server('payment_confirmed', null, ['kind' => 'ad'], 'KOLIGO-AD-1|ok');
ck('evenement serveur : un seul par cle', count_events("name = 'payment_confirmed'") === 1);
Analytics::server('screen_view', null, []);
Analytics::server('inconnu', null, []);
ck('evenement du serveur : seulement ceux du plan, source serveur', count_events("name IN ('screen_view','inconnu') AND source = 'server'") === 0 && count_events("source = 'server'") === 1);

Payments::handleWebhook(['id' => 'PID1', 'status' => 'CONFIRMED', 'reference' => 'KOLIGO-AD-xyz']);
Payments::handleWebhook(['id' => 'PID1', 'status' => 'CONFIRMED', 'reference' => 'KOLIGO-AD-xyz']);
ck('webhook rejoue : un seul payment_confirmed', count_events("name = 'payment_confirmed' AND params LIKE '%\"kind\":\"ad\"%'") === 2, Db::all("SELECT name, params FROM AnalyticsEvent WHERE source='server'"));
Payments::handleWebhook(['id' => 'PID2', 'status' => 'FAILED', 'reference' => 'KOLIGO-DELIV-abc']);
ck('paiement refuse : payment_failed', count_events("name = 'payment_failed' AND params LIKE '%delivery%'") === 1);
Kyc::set($uid, 'VERIFIED');
Kyc::set($uid, 'PENDING');
ck('decision KYC : evenement pour VERIFIED, pas pour PENDING', count_events("name = 'kyc_decided' AND userId = ?", [$uid]) === 1);

// ── Statistiques ─────────────────────────────────────────────────────────────
Analytics::ingest(['deviceId' => 'dev-cccc-0003', 'appVersion' => '1.0.22', 'events' => [
    ev('g-0000-0001', 'screen_view', ['screen' => 'Signup', 'sid' => 'sess-0000-0002']),
    ev('g-0000-0002', 'api_error', ['sid' => 'sess-0000-0002', 'params' => ['endpoint' => '/deliveries', 'status' => 500]]),
    ev('g-0000-0003', 'form_error', ['sid' => 'sess-0000-0002']),
]], null);
$o = Analytics::overview(7);
ck('appareils, sessions et utilisateurs comptes', $o['totals']['devices'] === 3 && $o['totals']['sessions'] === 2 && $o['totals']['users'] === 1, $o['totals']);
ck('erreurs comptees', $o['totals']['errors'] === 2 && $o['totals']['errorsPerSession'] === 1.0, $o['totals']);
ck('serie par jour complete sur la periode', count($o['daily']) === 7 && end($o['daily'])['events'] > 0);
ck('ecrans les plus vus', ($o['screens'][0]['screen'] ?? '') === 'Signup' && (int)$o['screens'][0]['views'] === 2, $o['screens']);
ck('versions utilisees', count($o['versions']) === 2, $o['versions']);
ck('erreurs serveur par route', ($o['apiErrors'][0]['key'] ?? '') === '/deliveries · 500', $o['apiErrors']);
$f = array_values(array_filter($o['funnels'], fn($x) => $x['id'] === 'inscription'))[0];
ck('entonnoir inscription : 2 appareils sur l\'ecran, 1 jusqu\'a la creation', $f['steps'][0]['count'] === 2 && $f['steps'][3]['count'] === 1 && $f['steps'][3]['rate'] === 50.0 && $f['steps'][4]['count'] === 0, $f['steps']);
$b = array_values(array_filter($o['funnels'], fn($x) => $x['id'] === 'boost'))[0];
ck('entonnoir Boost : filtre sur les parametres', $b['steps'][2]['count'] === 2 && $b['steps'][1]['count'] === 0, $b['steps']);

$e = Analytics::events(7);
$sv = array_values(array_filter($e['items'], fn($x) => $x['name'] === 'screen_view'))[0];
ck('plan avec comptes reels', $sv['count'] === 3 && $sv['uniques'] === 2 && $sv['last'] !== null && $e['received'] > 10, [$sv, $e['received']]);

// ── Parcours ─────────────────────────────────────────────────────────────────
$j = Analytics::journey('677000099');
ck('parcours par telephone : utilisateur retrouve', ($j['user']['id'] ?? '') === $uid && $j['devices'] === [$dev], $j['user']);
$allNames = [];
foreach ($j['sessions'] as $s) {
    foreach ($s['events'] as $x) {
        $allNames[] = $x['name'];
    }
}
ck("parcours : avant et apres la connexion, plus les evenements du serveur", in_array('signup_success', $allNames, true) && in_array('login_success', $allNames, true) && in_array('kyc_decided', $allNames, true), $allNames);
$first = $j['sessions'][count($j['sessions']) - 1]['events'][0] ?? null;
ck('evenements d\'une session dans l\'ordre', $first && $first['name'] === 'screen_view', $first);
ck('parcours par e-mail inconnu : introuvable', (function () {
    try {
        Analytics::journey('nobody@example.com');
        return false;
    } catch (HttpError $e) {
        return $e->status === 404;
    }
})());
$jd = Analytics::journey('dev-cccc-0003');
ck('parcours par appareil', $jd['user'] === null && $jd['total'] === 3 && $jd['sessions'][0]['id'] === 'sess-0000-0002', $jd['sessions'][0]['id'] ?? null);

// ── Ordre exact dans la meme seconde ────────────────────────────────────────
$base = (time() - 5) * 1000;
$order = ['ad_reported', 'screen_view', 'otp_sent', 'ad_withdrawn', 'notifications_read', 'login_failed', 'app_open', 'logout'];
$evs = [];
foreach ($order as $i => $name) {
    $evs[] = ['id' => sprintf('o-%04d-0000', $i), 'name' => $name, 't' => $base + $i * 7, 'sid' => 'sess-order-001'];
}
shuffle($evs); // l'arrivee dans le lot ne doit pas decider de l'ordre
Analytics::ingest(['deviceId' => 'dev-ffff-0006', 'events' => $evs], null);
$got = array_map(fn($x) => $x['name'], Analytics::journey('dev-ffff-0006')['sessions'][0]['events']);
ck('huit evenements de la meme seconde : ordre du telephone respecte', $got === $order, $got);

// ── Limites ──────────────────────────────────────────────────────────────────
$limited = false;
for ($i = 0; $i < 85 && !$limited; $i++) {
    try {
        Analytics::ingest(['deviceId' => 'dev-dddd-0004', 'events' => []], null);
    } catch (HttpError $e) {
        $limited = $e->status === 429;
    }
}
ck('limite de debit par appareil', $limited);
$big = ['deviceId' => 'dev-eeee-0005', 'events' => array_map(fn($i) => ev("h-$i-0000-00", 'app_open'), range(1, 80))];
$r = Analytics::ingest($big, null);
ck('50 evenements par lot au plus', $r['accepted'] === 50, $r);

echo PHP_EOL . "$pass ok, $fail echec" . PHP_EOL;
exit($fail ? 1 : 0);
