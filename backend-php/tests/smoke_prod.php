<?php
// Test de fumee contre un serveur reel (MySQL + vrai Sungku).
//   BASE=http://koligo.trugroup.cm RESOLVE=185.215.180.170 ADMIN_PIN=xxxxxx php tests/smoke_prod.php
// RESOLVE (optionnel) force l'IP quand le DNS n'est pas encore publie.
// Ne declenche AUCUN vrai paiement : la recharge utilise un numero invalide,
// que Sungku doit refuser. Laisse des donnees de test : voir CLEANUP=1.

$base = getenv('BASE') ?: 'http://koligo.trugroup.cm';
$resolve = getenv('RESOLVE') ?: '';
$adminPin = getenv('ADMIN_PIN') ?: '';
$host = parse_url($base, PHP_URL_HOST);
$port = parse_url($base, PHP_URL_PORT) ?: (parse_url($base, PHP_URL_SCHEME) === 'https' ? 443 : 80);

$pass = 0;
$fail = 0;
function check(string $name, bool $ok, $detail = ''): void
{
    global $pass, $fail;
    $ok ? $pass++ : $fail++;
    echo ($ok ? '  ok   ' : '  FAIL ') . $name . ($ok ? '' : '  -> ' . (is_string($detail) ? $detail : json_encode($detail))) . PHP_EOL;
}

function call(string $method, string $path, ?array $body = null, ?string $token = null): array
{
    global $base, $resolve, $host, $port;
    $ch = curl_init($base . $path);
    $h = ['Accept: application/json'];
    // Comme les clients : l'hebergeur bloque PUT/PATCH/DELETE, on passe par POST + override.
    if (in_array($method, ['PUT', 'PATCH', 'DELETE'], true)) {
        $h[] = 'X-HTTP-Method-Override: ' . $method;
        $method = 'POST';
        $body ??= [];
    }
    if ($token) {
        $h[] = "Authorization: Bearer $token";
    }
    if ($body !== null) {
        $h[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $opts = [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $h, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60];
    if ($resolve) {
        $opts[CURLOPT_RESOLVE] = ["$host:$port:$resolve"];
    }
    curl_setopt_array($ch, $opts);
    $out = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return ['code' => $code, 'json' => json_decode((string)$out, true), 'raw' => (string)$out];
}

function signup(string $phone, string $name, string $role, string $pin = '1234'): array
{
    $o = call('POST', '/api/auth/otp/send', ['phone' => $phone, 'name' => $name]);
    call('POST', '/api/auth/otp/verify', ['phone' => $phone, 'code' => $o['json']['devCode'] ?? '']);
    $r = call('POST', '/api/auth/signup', ['name' => $name, 'phone' => $phone, 'pin' => $pin, 'role' => $role]);
    return [$r['json']['accessToken'] ?? '', $r['json']['user']['id'] ?? '', $r];
}

echo "== Serveur reel : $base\n";
$h = call('GET', '/health');
check('health + base MySQL', ($h['json']['ok'] ?? false) && ($h['json']['db'] ?? false), $h['raw']);
check('villes seedees (17)', count(call('GET', '/api/public/cities')['json'] ?? []) === 17);
check('/payments/webhook/sungku refuse sans signature', call('POST', '/payments/webhook/sungku', ['data' => []])['code'] === 401);
check('/payment/webhook/sungku (alias) refuse sans signature', call('POST', '/payment/webhook/sungku', ['data' => []])['code'] === 401);

[$aTok] = [call('POST', '/api/auth/signin', ['phone' => '+237600000001', 'pin' => $adminPin])['json']['accessToken'] ?? ''];
check('admin se connecte', $aTok !== '');
check('admin/stats (agregats MySQL)', isset(call('GET', '/api/admin/stats', null, $aTok)['json']['trend']));

$sfx = substr((string)time(), -6);
[$vTok, $vId, $rv] = signup("+2376990$sfx", 'Vendeur Test', 'VENDOR');
[$dTok, $dId, $rd] = signup("+2376991$sfx", 'Livreur Test', 'DELIVERER');
check('inscription vendeur + livreur (OTP)', $vTok && $dTok, [$rv['raw'], $rd['raw']]);

$del = call('POST', '/api/deliveries', ['pickupAddress' => 'Akwa', 'dropoffAddress' => 'Bonapriso', 'weightKg' => 2, 'delivererType' => 'TEMPORAIRE'], $vTok);
$id = $del['json']['id'] ?? '';
check('creation livraison (prix serveur)', $id !== '' && ($del['json']['priceXAF'] ?? 0) > 0, $del['raw']);
check('accept', (call('PATCH', "/api/deliveries/$id/accept", null, $dTok)['json']['status'] ?? '') === 'ACCEPTE');
check('2e accept refuse (UPDATE conditionnel MySQL)', (call('PATCH', "/api/deliveries/$id/accept", null, $dTok)['json']['error'] ?? '') === 'Delivery not available');
check('collecte', (call('PATCH', "/api/deliveries/$id/confirm-collect", ['collectCode' => $del['json']['collectCode']], $dTok)['json']['status'] ?? '') === 'EN_ROUTE');
check('GPS', (call('POST', "/api/deliveries/$id/location", ['latitude' => 4.05, 'longitude' => 9.7], $dTok)['json']['ok'] ?? false) === true);
check('chat', (call('POST', "/api/deliveries/$id/messages", ['content' => 'ok'], $vTok)['json']['senderRole'] ?? '') === 'vendor');
$page = call('GET', "/track/$id");
check('page de suivi HTML', $page['code'] === 200 && str_contains($page['raw'], 'En route vers vous'));
$earn = $del['json']['delivererEarning'];
check('livraison par code -> LIVRE + gain credite', (call('PATCH', "/api/deliveries/$id/confirm-deliver", ['deliverCode' => $del['json']['deliverCode']], $dTok)['json']['status'] ?? '') === 'LIVRE'
    && (call('GET', '/api/wallet', null, $dTok)['json']['balance'] ?? 0) === $earn);

// Vrai Sungku, numero invalide : doit etre REFUSE (4xx) sans aucun mouvement d'argent.
$top = call('POST', '/api/wallet/topup', ['amount' => 1000, 'phone' => '000000000'], $vTok);
echo '  info Sungku (numero invalide) -> HTTP ' . $top['code'] . ' ' . $top['raw'] . PHP_EOL;
check('recharge : jamais creditee a l\'initiation', (call('GET', '/api/wallet', null, $vTok)['json']['balance'] ?? -1) === 0);

check('retrait refuse si solde insuffisant', (call('POST', '/api/wallet/withdraw', ['amount' => 5000, 'provider' => 'MTN', 'phone' => '690000001'], $vTok)['json']['error'] ?? '') === 'Solde insuffisant');
$w = call('POST', '/api/wallet/withdraw', ['amount' => 500, 'provider' => 'MTN', 'phone' => '690000001'], $dTok);
check('retrait livreur (debit atomique)', ($w['json']['status'] ?? '') === 'PENDING' && (call('GET', '/api/wallet', null, $dTok)['json']['balance'] ?? 0) === $earn - 500, $w['raw']);

check('admin : recherche utilisateurs (LIKE ESCAPE MySQL)', (call('GET', '/api/admin/users?q=Livreur', null, $aTok)['json']['total'] ?? 0) >= 1);
check('admin : finance', (call('GET', '/api/admin/finance', null, $aTok)['json']['pendingCount'] ?? 0) === 1);
check('admin : packages (recherche)', (call('GET', '/api/admin/packages?q=Akwa', null, $aTok)['json']['total'] ?? 0) >= 1);
check('admin : wallets', (call('GET', '/api/admin/wallets', null, $aTok)['json']['totalBalance'] ?? 0) > 0);
check('admin : export', call('GET', '/api/admin/export', null, $aTok)['code'] === 200);

if (getenv('CLEANUP') === '1') {
    $wipe = call('POST', '/api/admin/wipe-total', ['label' => 'smoke test'], $aTok);
    check('nettoyage : wipe-total (ordre des cles etrangeres MySQL)', ($wipe['json']['wiped'] ?? false) === true, $wipe['raw']);
    check('  admin conserve', (call('GET', '/api/admin/stats', null, $aTok)['json']['users'] ?? 0) === 1);
}

echo PHP_EOL . "Resultat : $pass ok, $fail echec(s)" . PHP_EOL;
exit($fail ? 1 : 0);
