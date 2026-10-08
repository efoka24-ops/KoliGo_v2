<?php
// Test de bout en bout de l'API contre un serveur local.
//   php -S 127.0.0.1:3001 -t public_html public_html/index.php
//   php -S 127.0.0.1:8099 tests/fake_sungku.php
//   php tests/api_test.php
// Prerequis : base fraiche (php app/bin/setup.php --admin=+237600000001:4321 --demo).

const BASE = 'http://127.0.0.1:3001';
const FAKE = 'http://127.0.0.1:8099';
const WEBHOOK_SECRET = 'local_webhook_secret_for_tests';

$pass = 0;
$fail = 0;
function check(string $name, bool $ok, $detail = ''): void
{
    global $pass, $fail;
    $ok ? $pass++ : $fail++;
    echo ($ok ? '  ok   ' : '  FAIL ') . $name . ($ok ? '' : '  -> ' . (is_string($detail) ? $detail : json_encode($detail))) . PHP_EOL;
}

function call(string $method, string $path, ?array $body = null, ?string $token = null, array $headers = [], ?string $raw = null, string $base = BASE): array
{
    $ch = curl_init($base . $path);
    $h = ['Accept: application/json'];
    if ($token) {
        $h[] = "Authorization: Bearer $token";
    }
    if ($body !== null || $raw !== null) {
        $h[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, $raw ?? json_encode($body));
    }
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => [...$h, ...$headers], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30]);
    $out = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $json = json_decode((string)$out, true);
    return ['code' => $code, 'json' => $json, 'raw' => (string)$out];
}

function webhook(string $reference, string $status, ?string $secret = WEBHOOK_SECRET, ?string $id = 'dep_x'): array
{
    $raw = json_encode(['event' => 'deposit.updated', 'data' => ['id' => $id, 'reference' => $reference, 'status' => $status, 'type' => 'DEPOSIT']]);
    $ts = (string)time();
    $sig = 'sha256=' . hash_hmac('sha256', "$ts.$raw", (string)$secret);
    return call('POST', '/payments/webhook/sungku', null, null, ["X-Apisungku-Timestamp: $ts", "X-Apisungku-Signature: $sig"], $raw);
}

function login(string $phone, string $pin): array
{
    $r = call('POST', '/api/auth/signin', ['phone' => $phone, 'pin' => $pin]);
    return [$r['json']['accessToken'] ?? '', $r['json']['user']['id'] ?? ''];
}

function sql(string $q, array $p = []): ?array
{
    $pdo = new PDO('sqlite:' . __DIR__ . '/../app/storage/koligo.sqlite');
    $st = $pdo->prepare($q);
    $st->execute($p);
    $r = $st->fetch(PDO::FETCH_ASSOC);
    return $r ?: null;
}

call('GET', '/__reset', null, null, [], null, FAKE);

echo "== Sante et securite de base\n";
$r = call('GET', '/health');
check('health ok + db', ($r['json']['ok'] ?? false) && ($r['json']['db'] ?? false), $r['raw']);
check('route inconnue -> 404', call('GET', '/nope')['code'] === 404);
check('sans jeton -> 401', call('GET', '/api/user/profile')['code'] === 401);
check('jeton forge (alg none) -> 401', call('GET', '/api/user/profile', null, 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOiJ4In0.')['code'] === 401);

echo "== Auth\n";
[$vTok, $vId] = login('+237655111222', '1234');
[$dTok, $dId] = login('+237677234567', '1234');
[$aTok] = login('+237600000001', '4321');
check('signin vendeur/livreur/admin', $vTok && $dTok && $aTok);
check('mauvais PIN -> 400', call('POST', '/api/auth/signin', ['phone' => '+237655111222', 'pin' => '9999'])['json']['error'] === 'PIN incorrect');
check('signin sans prefixe +237', (call('POST', '/auth/signin', ['phone' => '655111222', 'pin' => '1234'])['json']['accessToken'] ?? '') !== '');
$r = call('POST', '/api/auth/signup', ['name' => 'Hack', 'phone' => '+237699000111', 'pin' => '1234', 'role' => 'ADMIN']);
check('signup role ADMIN refuse', $r['code'] === 400 && !isset($r['json']['accessToken']), $r['raw']);
check('switch-role ADMIN refuse', call('POST', '/api/auth/switch-role', ['role' => 'ADMIN'], $vTok)['code'] === 400);
call('PATCH', '/api/user/profile', ['name' => 'Marie N.', 'kycStatus' => 'NONE', 'isBlocked' => true, 'pinHash' => 'x', 'roles' => '["ADMIN"]'], $vTok);
$row = sql('SELECT name, isBlocked, roles, pinHash FROM User WHERE id = ?', [$vId]);
check('profil : liste blanche (name change, roles/pin/blocked intacts)', $row['name'] === 'Marie N.' && (int)$row['isBlocked'] === 0 && $row['roles'] === '["VENDOR"]' && $row['pinHash'] !== 'x', $row);
check('vendeur -> admin 403', call('GET', '/api/admin/stats', null, $vTok)['code'] === 403);

$o = call('POST', '/api/auth/otp/send', ['phone' => '+237699000222', 'name' => 'Test']);
$code = $o['json']['devCode'] ?? '';
check('OTP envoye + devCode', strlen($code) === 4, $o['raw']);
check('OTP faux refuse', call('POST', '/api/auth/otp/verify', ['phone' => '+237699000222', 'code' => $code === '1111' ? '2222' : '1111'])['code'] === 400);
check('OTP bon accepte', call('POST', '/api/auth/otp/verify', ['phone' => '+237699000222', 'code' => $code])['json'] === true);
$r = call('POST', '/api/auth/signup', ['name' => 'Nouveau Vendeur', 'phone' => '+237699000222', 'pin' => '2468', 'role' => 'VENDOR', 'shopName' => 'Chez Nouveau']);
check('signup vendeur', !empty($r['json']['accessToken']) && $r['json']['user']['shopName'] === 'Chez Nouveau', $r['raw']);
check('signup doublon refuse', call('POST', '/api/auth/signup', ['name' => 'X', 'phone' => '+237699000222', 'pin' => '2468', 'role' => 'VENDOR'])['code'] === 400);
$ref = call('POST', '/api/auth/refresh', ['token' => $r['json']['refreshToken']]);
check('refresh', !empty($ref['json']['accessToken']));

$r = call('POST', '/api/user/profile', ['language' => 'en'], $vTok, ['X-HTTP-Method-Override: PATCH']);
check('override POST + X-HTTP-Method-Override: PATCH -> profil modifie', ($r['json']['language'] ?? '') === 'en', $r['raw']);
$r = call('POST', '/api/user/profile', ['language' => 'fr'], $vTok, ['X-HTTP-Method-Override: GET']);
check('override GET ignore (seuls PUT/PATCH/DELETE)', $r['code'] === 405);

$o = call('POST', '/api/auth/otp/send', ['phone' => '+237655111222']);
check('OTP pour un compte existant : code NON renvoye (anti prise de controle)', ($o['json']['sent'] ?? false) === true && !isset($o['json']['devCode']), $o['raw']);
$rp = call('POST', '/api/auth/reset-pin', ['phone' => '+237655111222', 'otp' => '1234', 'newPin' => '0000']);
check('reset-pin sans le vrai code refuse', $rp['code'] === 400);
check('PIN du vendeur inchange', call('POST', '/api/auth/signin', ['phone' => '+237655111222', 'pin' => '1234'])['code'] === 200);

echo "== Donnees publiques\n";
$r = call('GET', '/api/public/cities');
check('villes + quartiers', count($r['json']) === 17 && count($r['json'][0]['neighborhoods']) > 5);
check('pricing', ($r['json'] ? call('GET', '/api/public/pricing')['json']['baseRate'] : 0) === 500);
check('distance Douala-Yaounde', call('GET', '/api/public/distance?from=Douala&to=Yaound%C3%A9')['json']['km'] === 250.0 || call('GET', '/api/public/distance?from=Douala&to=Yaound%C3%A9')['json']['km'] === 250);

echo "== Livraison : cycle complet + paiement Sungku\n";
$r = call('POST', '/api/deliveries', ['pickupAddress' => 'Douala', 'dropoffAddress' => 'Yaoundé', 'weightKg' => 2, 'delivererType' => 'EXPRESS', 'recipientName' => 'Paul Test', 'recipientPhone' => '690000000', 'shopName' => 'Chez Marie', 'priceXAF' => 1, 'productPrice' => 5000], $vTok);
$del = $r['json'];
$expected = (int)round((500 + 250 * 250 + 2 * 100) * 1.25);
check('creation : prix calcule serveur (ignore priceXAF client)', ($del['priceXAF'] ?? 0) === $expected, $r['raw']);
check('commission 3% + gain livreur', ($del['commissionXAF'] ?? 0) === (int)round($expected * 0.03) && $del['delivererEarning'] === $expected - $del['commissionXAF']);
check('livreur ne peut pas creer', call('POST', '/api/deliveries', ['pickupAddress' => 'A', 'dropoffAddress' => 'B'], $dTok)['code'] === 403);
$id = $del['id'];
check('offres ouvertes', in_array($id, array_column(call('GET', '/api/deliveries/available', null, $dTok)['json'], 'id'), true));
check('vendeur ne peut pas accepter', call('PATCH', "/api/deliveries/$id/accept", null, $vTok)['code'] === 403);
check('accept livreur', call('PATCH', "/api/deliveries/$id/accept", null, $dTok)['json']['status'] === 'ACCEPTE');
[$d2Tok] = login('+237655456789', '1234');
check('2e livreur ne peut plus accepter', call('PATCH', "/api/deliveries/$id/accept", null, $d2Tok)['json']['error'] === 'Delivery not available');
check('collecte : mauvais code refuse', call('PATCH', "/api/deliveries/$id/confirm-collect", ['collectCode' => '0000'], $dTok)['json']['error'] === 'Wrong collect code');
check('collecte : bon code -> EN_ROUTE', call('PATCH', "/api/deliveries/$id/confirm-collect", ['collectCode' => $del['collectCode']], $dTok)['json']['status'] === 'EN_ROUTE');
check('GPS post', call('POST', "/api/deliveries/$id/location", ['latitude' => 4.05, 'longitude' => 9.7], $dTok)['json']['ok'] === true);
$loc = call('GET', "/api/deliveries/$id/location", null, $vTok)['json'];
check('GPS lecture', ($loc['lat'] ?? null) == 4.05, $loc);
check('GPS coords invalides refusees', call('POST', "/api/deliveries/$id/location", ['latitude' => 999, 'longitude' => 0], $dTok)['code'] === 400);
check('chat vendeur', call('POST', "/api/deliveries/$id/messages", ['content' => 'Bonjour'], $vTok)['json']['senderRole'] === 'vendor');
check('chat destinataire (public)', call('POST', "/api/deliveries/$id/recipient-message", ['content' => 'Je suis la'])['json']['senderRole'] === 'recipient');
check('liste messages publique', count(call('GET', "/api/deliveries/$id/messages-public")['json']) === 2);
check('tiers sans lien -> messages refuses', call('POST', "/api/deliveries/$id/messages", ['content' => 'x'], $d2Tok)['code'] === 400);

$page = call('GET', "/track/$id");
check('page de suivi HTML', $page['code'] === 200 && str_contains($page['raw'], 'En route vers vous') && str_contains($page['raw'], 'btn-confirm'));
$r = call('GET', '/api/deliveries/by-ref/' . strtoupper(substr($id, -8)));
check('Ref du colis (8 car.) -> vue publique sans code ni telephone', ($r['json']['id'] ?? '') === $id && ($r['json']['ref'] ?? '') === strtoupper(substr($id, -8)) && !str_contains($r['raw'], 'deliverCode') && !str_contains($r['raw'], 'collectCode') && !str_contains($r['raw'], 'recipientPhone'), $r['raw']);
check('Ref inconnue -> 404', call('GET', '/api/deliveries/by-ref/ZZZZZZZZ')['code'] === 404);
for ($i = 0; $i < 30; $i++) { call('GET', '/api/deliveries/by-ref/' . strtoupper(substr($id, -8))); }
check('Ref valide interrogee 30x (suivi) : jamais bloquee', call('GET', '/api/deliveries/by-ref/' . strtoupper(substr($id, -8)))['code'] === 200);
check('rafraichissement par id', (call('GET', '/api/deliveries/' . $id . '/public')['json']['ref'] ?? '') === strtoupper(substr($id, -8)));
check('Ref trop courte -> 400', call('GET', '/api/deliveries/by-ref/AB')['code'] === 400);
$r = call('GET', '/api/deliveries/' . $id . '/public-location');
check('position livreur publique pendant la course', ($r['json']['lat'] ?? null) == 4.05, $r['raw']);
check('track/status', call('GET', "/track/$id/status")['json']['status'] === 'EN_ROUTE');
check('page de suivi : id inconnu -> 404', call('GET', '/track/inconnu')['code'] === 404);

$bal0 = (int)call('GET', '/api/wallet', null, $dTok)['json']['balance'];
check('paiement : mauvais code reception', call('POST', "/api/deliveries/$id/client-confirm", ['code' => '0000', 'momoPhone' => '690000001'])['json']['error'] === 'Code de réception invalide');
check('paiement : MoMo invalide', str_contains(call('POST', "/api/deliveries/$id/client-confirm", ['code' => $del['deliverCode'], 'momoPhone' => '12'])['json']['error'] ?? '', 'invalide'));
$r = call('POST', "/api/deliveries/$id/client-confirm", ['code' => $del['deliverCode'], 'momoPhone' => '690000001']);
check('paiement initie -> pending (pas LIVRE)', ($r['json']['pending'] ?? false) === true, $r['raw']);
check('  livraison toujours EN_ROUTE avant webhook', call('GET', "/track/$id/status")['json']['status'] === 'EN_ROUTE');
$logs = call('GET', '/__log', null, null, [], null, FAKE)['json'];
$sent = end($logs);
check('Sungku recoit : cle API + msisdn 237 + montant entier serveur + reference', $sent['key'] === 'sk_local_test_key' && $sent['body']['phoneNumber'] === '237690000001' && $sent['body']['amount'] === $expected && $sent['body']['currency'] === 'XAF' && str_starts_with($sent['body']['reference'], 'KOLIGO-DELIV-'), $sent);
check('  customerMessage/description : alphanumerique + espaces, 4-22 car. (exigence Sungku)', preg_match('/^[A-Za-z0-9 ]{4,22}$/', $sent['body']['customerMessage']) === 1 && preg_match('/^[A-Za-z0-9 ]+$/', $sent['body']['description']) === 1, $sent['body']);
$ref = $sent['body']['reference'];
$again = call('POST', "/api/deliveries/$id/client-confirm", ['code' => $del['deliverCode'], 'momoPhone' => '690000001']);
check('double clic : meme paiement repris, pas de 2e depot', count(call('GET', '/__log', null, null, [], null, FAKE)['json']) === count($logs) && ($again['json']['pending'] ?? false), $again['raw']);

echo "== Webhook\n";
check('sans signature -> 401', call('POST', '/payments/webhook/sungku', null, null, [], '{"data":{}}')['code'] === 401);
check('mauvaise signature -> 401', webhook($ref, 'CONFIRMED', 'autre-secret')['code'] === 401);
check('statut non final ignore (PENDING)', webhook($ref, 'PENDING')['code'] === 200 && call('GET', "/track/$id/status")['json']['status'] === 'EN_ROUTE');
check('statut inconnu ignore', webhook($ref, 'WHATEVER')['code'] === 200 && call('GET', "/track/$id/status")['json']['status'] === 'EN_ROUTE');
check('CONFIRMED valide -> 200', webhook($ref, 'CONFIRMED')['code'] === 200);
check('  livraison LIVRE', call('GET', "/track/$id/status")['json']['status'] === 'LIVRE');
$bal1 = (int)call('GET', '/api/wallet', null, $dTok)['json']['balance'];
check('  livreur credite du gain', $bal1 - $bal0 === $del['delivererEarning'], [$bal0, $bal1]);
webhook($ref, 'CONFIRMED');
check('rejeu webhook : pas de double credit', (int)call('GET', '/api/wallet', null, $dTok)['json']['balance'] === $bal1);
check('statut polling (mobile) = success', (call('GET', '/api/deliveries/client-payment-status?transactionId=' . urlencode($ref) . '&clientToken=' . urlencode($del['clientToken']))['json']['status'] ?? '') === 'success');
check('confirm-deliver apres LIVRE refuse', call('PATCH', "/api/deliveries/$id/confirm-deliver", ['deliverCode' => $del['deliverCode']], $dTok)['json']['error'] === 'Wrong state');
$tx = sql("SELECT COUNT(*) AS n FROM `Transaction` WHERE deliveryId = ?", [$id]);
check('  une seule ligne EARNING', (int)$tx['n'] === 1);
check('page de suivi LIVRE : recu', str_contains(call('GET', "/track/$id")['raw'], 'Reçu officiel'));
check('notation destinataire', call('POST', '/api/deliveries/client-rate', ['clientToken' => $del['clientToken'], 'score' => 5, 'tags' => ['Rapide']])['json']['ok'] === true);
check('stats livreur', (call('GET', '/api/user/stats', null, $dTok)['json']['courses'] ?? 0) === 1);

echo "== Factures\n";
function row(array $inv, string $label) { foreach ($inv['details'] as $b) { foreach ($b['rows'] as $r) { if ($r['label'] === $label) { return $r['value']; } } } return null; }
function titles(array $inv) { return array_column($inv['details'], 'title'); }
$sale = call('GET', "/api/deliveries/$id/invoice/sale", null, $vTok)['json'];
check('facture de VENTE (vendeur) : produit 5000 + transport', ($sale['number'] ?? '') === 'KG-V-' . gmdate('Ymd') . '-' . strtoupper(substr($id, -8)) && $sale['total'] === 5000 + $expected && count($sale['lines']) === 2, $sale);
$pay = call('GET', "/api/deliveries/$id/invoice/payment", null, $vTok)['json'];
check('facture de PAIEMENT : recu Sungku (mode, reference, transaction, n° masque), encaisse par KoliGo', row($pay, 'Mode') === 'Mobile money (Sungku)' && str_starts_with((string)row($pay, 'Référence'), 'KOLIGO-DELIV-') && row($pay, 'Numéro payeur') === '6*****001' && row($pay, 'Statut') === 'Payé' && $pay['issuer']['name'] === 'KoliGo' && $pay['billedTo']['label'] === 'Payé par' && $pay['total'] === $expected, $pay);
$dlv = call('GET', "/api/deliveries/$id/invoice/delivery", null, $dTok)['json'];
check('facture de LIVRAISON : releve de course, calcul du prix, commission, gain net', ($dlv['total'] ?? 0) === $del['delivererEarning'] && $dlv['lines'][1]['amountXAF'] === -$del['commissionXAF'] && in_array('Calcul du prix de la course', titles($dlv), true) && row($dlv, 'Coefficient Express') === '× 1,25' && $dlv['issuer']['name'] === 'Hervé Nkouamba', $dlv);
check('les 3 factures sont DIFFERENTES (emetteur, destinataire, blocs, libelle du total, couleur)', count(array_unique([json_encode([$sale['issuer']['name'], $sale['billedTo']['label'], titles($sale), $sale['totalLabel'], $sale['accent']]), json_encode([$pay['issuer']['name'], $pay['billedTo']['label'], titles($pay), $pay['totalLabel'], $pay['accent']]), json_encode([$dlv['issuer']['name'], $dlv['billedTo']['label'], titles($dlv), $dlv['totalLabel'], $dlv['accent']])])) === 3 && $sale['issuer']['name'] === 'Chez Marie' && $sale['billedTo']['name'] === 'Paul Test' && row($sale, 'Prix du produit') === '5 000 XAF', [$sale['issuer'], $pay['issuer'], $dlv['issuer']]);
check('livreur ne peut pas lire la facture de vente', call('GET', "/api/deliveries/$id/invoice/sale", null, $dTok)['code'] === 403);
check('vendeur ne peut pas lire la facture de livraison', call('GET', "/api/deliveries/$id/invoice/delivery", null, $vTok)['code'] === 403);
check('autre livreur : refuse', call('GET', "/api/deliveries/$id/invoice/delivery", null, $d2Tok)['code'] === 403);
check('type inconnu -> refuse', call('GET', "/api/deliveries/$id/invoice/xyz", null, $vTok)['code'] === 403);
$pub = call('GET', "/api/deliveries/$id/public-invoice");
check('facture de paiement PUBLIQUE (destinataire) sans telephones', $pub['code'] === 200 && row($pub['json'], 'Statut') === 'Payé' && !str_contains($pub['raw'], '+237'), $pub['raw']);
check('BACK-OFFICE : detail d\'une facture', (call('GET', "/api/admin/invoices/$id/delivery", null, $aTok)['json']['number'] ?? '') === 'KG-L-' . gmdate('Ymd') . '-' . strtoupper(substr($id, -8)));
check('BACK-OFFICE : refuse a un non-admin', call('GET', '/api/admin/invoices', null, $vTok)['code'] === 403);

echo "== Livraison : confirmation manuelle par code + annulation\n";
$r2 = call('POST', '/api/deliveries', ['pickupAddress' => 'Akwa', 'dropoffAddress' => 'Bonapriso', 'weightKg' => 1], $vTok)['json'];
call('PATCH', "/api/deliveries/{$r2['id']}/accept", null, $dTok);
call('PATCH', "/api/deliveries/{$r2['id']}/confirm-collect", ['collectCode' => $r2['collectCode']], $dTok);
check('confirm-deliver mauvais code', call('PATCH', "/api/deliveries/{$r2['id']}/confirm-deliver", ['deliverCode' => '0000'], $dTok)['json']['error'] === 'Wrong delivery code');
check('confirm-deliver bon code -> LIVRE', call('PATCH', "/api/deliveries/{$r2['id']}/confirm-deliver", ['deliverCode' => $r2['deliverCode']], $dTok)['json']['status'] === 'LIVRE');
$byCode = call('GET', "/api/deliveries/{$r2['id']}/invoice/payment", null, $vTok)['json'];
check('livraison validee par code : mode = "Code de reception"', str_starts_with((string)row($byCode, 'Mode'), 'Code de réception') && row($byCode, 'Statut') === 'Réglé', $byCode);
$aInv = call('GET', '/api/admin/invoices', null, $aTok)['json'];
check('BACK-OFFICE : liste des factures (livrees)', $aInv['total'] === 2 && count((array)$aInv['items'][0]['invoices']) === 3 && !isset($aInv['items'][0]['deliverCode']), $aInv);
$r3 = call('POST', '/api/deliveries', ['pickupAddress' => 'Akwa', 'dropoffAddress' => 'Deido', 'weightKg' => 1], $vTok)['json'];
check('annulation vendeur', call('PATCH', "/api/deliveries/{$r3['id']}/cancel", null, $vTok)['json']['status'] === 'ANNULE');
check('facture indisponible pour une livraison annulee', call('GET', "/api/deliveries/{$r3['id']}/invoice/payment", null, $vTok)['code'] === 400 && call('GET', "/api/deliveries/{$r3['id']}/invoice/sale", null, $vTok)['code'] === 400);
check('annulation 2x refusee', call('PATCH', "/api/deliveries/{$r3['id']}/cancel", null, $vTok)['json']['error'] === 'Cannot cancel in current state');
check('liste vendeur', count(call('GET', '/api/deliveries', null, $vTok)['json']) === 3);
check('trust-invoice (livreur assigne)', call('GET', "/api/deliveries/$id/trust-invoice", null, $vTok)['json']['deliverer']['name'] === 'Hervé Nkouamba');
check('getById : tiers refuse', call('GET', "/api/deliveries/$id", null, $d2Tok)['code'] === 403);

echo "== Wallet : recharge Sungku\n";
$balV0 = (int)call('GET', '/api/wallet', null, $vTok)['json']['balance'];
check('recharge < 100 refusee', call('POST', '/api/wallet/topup', ['amount' => 50, 'phone' => '690000001'], $vTok)['code'] === 400);
$r = call('POST', '/api/wallet/topup', ['amount' => 5000, 'phone' => '690000001'], $vTok);
check('recharge initiee : PENDING, solde inchange', ($r['json']['status'] ?? '') === 'PENDING' && (int)call('GET', '/api/wallet', null, $vTok)['json']['balance'] === $balV0, $r['raw']);
$topRef = sql('SELECT externalRef FROM TopUp WHERE id = ?', [$r['json']['topUpId']])['externalRef'];
webhook($topRef, 'CONFIRMED');
check('webhook CONFIRMED -> credit', (int)call('GET', '/api/wallet', null, $vTok)['json']['balance'] === $balV0 + 5000);
webhook($topRef, 'CONFIRMED');
check('rejeu : pas de double credit', (int)call('GET', '/api/wallet', null, $vTok)['json']['balance'] === $balV0 + 5000);
$r = call('POST', '/api/wallet/topup', ['amount' => 1000, 'phone' => '690000001'], $vTok);
$ref2 = sql('SELECT externalRef FROM TopUp WHERE id = ?', [$r['json']['topUpId']])['externalRef'];
webhook($ref2, 'FAILED');
check('webhook FAILED : solde inchange, TopUp FAILED', (int)call('GET', '/api/wallet', null, $vTok)['json']['balance'] === $balV0 + 5000 && sql('SELECT status FROM TopUp WHERE externalRef = ?', [$ref2])['status'] === 'FAILED');
$r = call('POST', '/api/wallet/topup', ['amount' => 1000, 'phone' => '600000000'], $vTok);
check('Sungku refuse (422) -> erreur + FAILED prouve', $r['code'] === 400 && str_contains($r['json']['error'], 'éligible'), $r['raw']);
$r = call('POST', '/api/wallet/topup', ['amount' => 1000, 'phone' => '600000500'], $vTok);
$last = sql("SELECT status FROM TopUp ORDER BY createdAt DESC, rowid DESC LIMIT 1");
check('Sungku indisponible (503) -> PENDING, pas de faux echec', ($r['json']['status'] ?? '') === 'PENDING' && !empty($r['json']['unverified']) && $last['status'] === 'PENDING', $r);

echo "== Wallet : retrait\n";
check('retrait > solde refuse', call('POST', '/api/wallet/withdraw', ['amount' => 9000000, 'provider' => 'MTN', 'phone' => '690000001'], $vTok)['json']['error'] === 'Solde insuffisant');
$balV1 = (int)call('GET', '/api/wallet', null, $vTok)['json']['balance'];
$r = call('POST', '/api/wallet/withdraw', ['amount' => 2000, 'provider' => 'MTN', 'phone' => '690000001'], $vTok);
check('retrait : debite + PENDING', ($r['json']['status'] ?? '') === 'PENDING' && (int)call('GET', '/api/wallet', null, $vTok)['json']['balance'] === $balV1 - 2000, $r['raw']);
$w = call('GET', '/api/wallet', null, $vTok)['json'];
check('historique : retrait en negatif', in_array(-2000, array_column($w['transactions'], 'amount'), true));
check('MAJ compte paiement', call('PATCH', '/api/user/payment-account', ['provider' => 'ORANGE', 'phone' => '690000009'], $vTok)['json']['paymentProvider'] === 'ORANGE');

echo "== Notes / incidents / KYC\n";
check('notation vendeur->livreur', call('POST', '/api/ratings', ['deliveryId' => $r2['id'], 'score' => 4, 'tags' => ['Pro']], $vTok)['code'] === 201);
check('note hors bornes refusee', call('POST', '/api/ratings', ['deliveryId' => $r2['id'], 'score' => 9], $vTok)['code'] === 400);
check('incident', call('POST', '/api/issues', ['deliveryId' => $r2['id'], 'type' => 'DAMAGED', 'description' => 'colis abime'], $vTok)['code'] === 201);
$png = base64_encode("\x89PNG\r\n\x1a\n" . str_repeat('x', 64));
call('PATCH', "/api/admin/users/$dId/kyc", ['status' => 'NONE'], $aTok);
check('KYC : fichier non-image refuse', call('POST', '/api/auth/kyc', ['selfie' => base64_encode('<?php echo 1;')], $dTok)['code'] === 400);
$k = call('POST', '/api/auth/kyc', ['cniNumber' => '123456789', 'cniRecto' => "data:image/png;base64,$png", 'selfie' => $png], $dTok);
check('KYC base64 -> PENDING', ($k['json']['status'] ?? '') === 'PENDING', $k['raw']);

echo "== Admin\n";
$s = call('GET', '/api/admin/stats', null, $aTok)['json'];
check('stats', $s['users'] >= 6 && $s['deliveries'] === 3 && count($s['trend']) === 7 && $s['pendingKyc'] === 1, $s);
$u = call('GET', '/api/admin/users?q=Herv%C3%A9', null, $aTok)['json'];
check('recherche utilisateurs', $u['total'] === 1 && $u['items'][0]['_count']['delivererDeliveries'] === 2, $u);
$ud = call('GET', "/api/admin/users/$dId", null, $aTok)['json'];
check('detail utilisateur : docs KYC, sans pinHash', count($ud['kycDocuments']) === 2 && !isset($ud['pinHash']));
$docId = $ud['kycDocuments'][0]['id'];
$img = call('GET', "/api/admin/kyc-doc/$docId", null, $aTok);
check('document KYC servi', $img['code'] === 200 && str_starts_with($img['raw'], "\x89PNG"));
check('KYC valide', call('PATCH', "/api/admin/users/$dId/kyc", ['status' => 'VERIFIED'], $aTok)['json']['kycStatus'] === 'VERIFIED');
check('KYC statut invalide refuse', call('PATCH', "/api/admin/users/$dId/kyc", ['status' => 'BOF'], $aTok)['code'] === 400);
$f = call('GET', '/api/admin/finance', null, $aTok)['json'];
check('finance', $f['pendingCount'] === 1 && $f['pendingAmount'] === 2000 && $f['platformBalance'] > 0, $f);
$wid = $f['pendingWithdrawals'][0]['id'];
check('retrait paye par admin', call('PATCH', "/api/admin/withdrawals/$wid/pay", null, $aTok)['json']['status'] === 'SUCCESS');
check('retrait deja traite refuse', call('PATCH', "/api/admin/withdrawals/$wid/pay", null, $aTok)['code'] === 400);
check('packages', call('GET', '/api/admin/packages?q=Akwa', null, $aTok)['json']['total'] === 2);
check('package detail', isset(call('GET', "/api/admin/packages/$id", null, $aTok)['json']['escrow']['releasedAt']));
check('wallets', call('GET', '/api/admin/wallets', null, $aTok)['json']['totalBalance'] > 0);
check('issues', call('GET', '/api/admin/issues', null, $aTok)['json']['total'] === 1);
check('security-events : OTP sans code en clair', !str_contains(call('GET', '/api/admin/security-events', null, $aTok)['raw'], '"code"'));
$c = call('POST', '/api/admin/cities', ['name' => 'Testville', 'region' => 'Test'], $aTok)['json'];
check('creer ville + quartier + supprimer', call('POST', "/api/admin/cities/{$c['id']}/neighborhoods", ['name' => 'Q1'], $aTok)['code'] === 200 && call('DELETE', "/api/admin/cities/{$c['id']}", null, $aTok)['code'] === 200);
check('creer admin', !empty(call('POST', '/api/admin/users/create', ['name' => 'Adm2', 'phone' => '+237600000009', 'pin' => '1357', 'role' => 'ADMIN'], $aTok)['json']['accessToken']));
check('settings upsert', call('PATCH', '/api/admin/settings', ['key' => 'maintenance_mode', 'value' => 'true'], $aTok)['json']['value'] === 'true');
check('site-content', call('PATCH', '/api/admin/site-content', ['heroTitle' => 'Salut'], $aTok)['json']['heroTitle'] === 'Salut');
check('bloquer utilisateur', call('PATCH', "/api/admin/users/$vId/block", ['blocked' => true], $aTok)['json']['isBlocked'] === true && call('POST', '/api/auth/signin', ['phone' => '+237655111222', 'pin' => '1234'])['json']['error'] === 'Compte bloqué');
call('PATCH', "/api/admin/users/$vId/block", ['blocked' => false], $aTok);
$exp = call('GET', '/api/admin/export', null, $aTok);
check('export sans pinHash', $exp['code'] === 200 && !str_contains($exp['raw'], 'pinHash'));
$arch = call('POST', '/api/admin/archive', ['label' => 'test'], $aTok)['json'];
check('archive & reset', ($arch['archived'] ?? false) && sql('SELECT COUNT(*) AS n FROM Delivery')['n'] == 0, $arch);
$rest = call('POST', "/api/admin/archives/{$arch['archiveId']}/restore", null, $aTok)['json'];
check('restauration', ($rest['counts']['deliveries'] ?? 0) === 3, $rest);

$refCodes = [];
for ($i = 0; $i < 25; $i++) {
    $refCodes[] = call('GET', '/api/deliveries/by-ref/ZZZZ' . str_pad((string)$i, 4, '0', STR_PAD_LEFT))['code'];
}
check('devinette de Ref : 429 apres 20 echecs', in_array(429, $refCodes, true) && $refCodes[0] === 404, $refCodes);

echo "== Brute-force PIN\n";
$codes = [];
for ($i = 0; $i < 10; $i++) {
    $codes[] = call('POST', '/api/auth/signin', ['phone' => '+237677333444', 'pin' => (string)(1000 + $i)])['code'];
}
check('429 apres 8 essais rates', in_array(429, $codes, true) && $codes[0] === 400, $codes);
check('  meme avec le bon PIN pendant le blocage', call('POST', '/api/auth/signin', ['phone' => '+237677333444', 'pin' => '1234'])['code'] === 429);


echo "== CGU en base, devis par zone et par gabarit\n";
$cgu = call('GET', '/api/public/cgu?lang=fr');
check('CGU : texte servi depuis la base, jetons remplaces', ($cgu['json']['version'] ?? 0) >= 1 && count($cgu['json']['articles'] ?? []) >= 11 && !str_contains($cgu['raw'], '{{'), $cgu['raw']);
check('CGU : version anglaise', count(call('GET', '/api/public/cgu?lang=en')['json']['articles'] ?? []) >= 11);
$art9 = '';
foreach ($cgu['json']['articles'] as $a) {
    if ($a['num'] === '9') {
        $art9 = $a['body'];
    }
}
check("CGU : frais d'annulation inscrits a l'article 9 (500 F, montant repris des tarifs)", str_contains($art9, '500 F CFA'), $art9);
$pp = call('GET', '/api/public/pricing')['json'];
check('pricing public : 3 zones, 6 gabarits, frais, delai', count($pp['zones']) === 3 && count($pp['gabarits']) === 6 && $pp['cancelFeeXAF'] === 500 && $pp['revisionTimeoutMin'] === 10, $pp);
$q = call('GET', '/api/public/quote?from=Douala&to=Yaound%C3%A9&fromCity=Douala&size=M&type=TEMPORAIRE')['json'];
check('devis Grand Sud, gabarit M : 500 + 250 x 250 + 100 x 6 = 63 600', ($q['zone'] ?? '') === 'Grand Sud' && ($q['finalPrice'] ?? 0) === 63600, $q);
$q = call('GET', '/api/public/quote?from=Garoua&to=Maroua&fromCity=Garoua&size=S&type=TEMPORAIRE')['json'];
check('devis Grand Nord, gabarit S : 300 + 100 x 200 + 100 x 2 = 20 500', ($q['zone'] ?? '') === 'Grand Nord' && ($q['finalPrice'] ?? 0) === 20500, $q);
check('devis XXL : sur devis', (call('GET', '/api/public/quote?from=Douala&to=Yaound%C3%A9&size=XXL')['json']['code'] ?? '') === 'SIZE_ON_QUOTE');

echo "== CGU et KYC obligatoires avant de publier ou de livrer\n";
[$nvTok, $nvId] = login('+237699000222', '2468');
$body = ['pickupAddress' => 'Douala', 'dropoffAddress' => 'Yaoundé', 'fromCity' => 'Douala', 'size' => 'M', 'category' => 'ELECTRONICS',
    'photo' => "data:image/png;base64,$png", 'recipientName' => 'Paul', 'recipientPhone' => '690000001', 'shopName' => 'Chez Nouveau'];
$r = call('POST', '/api/deliveries', $body, $nvTok);
check('publier sans CGU acceptees -> 403 CGU_REQUIRED', $r['code'] === 403 && ($r['json']['code'] ?? '') === 'CGU_REQUIRED', $r['raw']);
check('accepter une version perimee refuse', call('POST', '/api/auth/accept-cgu', ['version' => 99], $nvTok)['code'] === 409);
$ver = $cgu['json']['version'];
$acc = call('POST', '/api/auth/accept-cgu', ['version' => $ver], $nvTok)['json'];
check('acceptation des CGU : version et date enregistrees', ($acc['cguVersion'] ?? 0) === $ver && !empty($acc['cguAcceptedAt']), $acc);
$prof = call('GET', '/api/user/profile', null, $nvTok)['json'];
check('profil : needsCgu faux, KYC vendeur NONE', $prof['needsCgu'] === false && $prof['kycStatus'] === 'NONE' && $prof['kycByRole']['VENDOR'] === 'NONE', $prof);
$r = call('POST', '/api/deliveries', $body, $nvTok);
check('publier sans KYC -> 403 KYC_REQUIRED', $r['code'] === 403 && ($r['json']['code'] ?? '') === 'KYC_REQUIRED', $r['raw']);
$k = call('POST', '/api/auth/kyc', ['cniNumber' => '987654321', 'cniRecto' => "data:image/png;base64,$png", 'selfie' => $png], $nvTok);
check('KYC envoye -> PENDING', ($k['json']['status'] ?? '') === 'PENDING', $k['raw']);
check('KYC en attente : publier toujours refuse', (call('POST', '/api/deliveries', $body, $nvTok)['json']['code'] ?? '') === 'KYC_REQUIRED');
check('KYC : un seul dossier (renvoi refuse)', call('POST', '/api/auth/kyc', ['selfie' => $png], $nvTok)['code'] === 409);
check('admin valide le KYC', (call('PATCH', "/api/admin/users/$nvId/kyc", ['status' => 'VERIFIED'], $aTok)['json']['kycStatus'] ?? '') === 'VERIFIED');

echo "== Declaration par gabarit\n";
$r = call('POST', '/api/deliveries', array_diff_key($body, ['photo' => 1]), $nvTok);
check('photo obligatoire', $r['code'] === 400 && ($r['json']['code'] ?? '') === 'PHOTO_REQUIRED', $r['raw']);
$r = call('POST', '/api/deliveries', ['size' => 'XXL'] + $body, $nvTok);
check('XXL : sur devis, publication refusee', $r['code'] === 400 && ($r['json']['code'] ?? '') === 'SIZE_ON_QUOTE', $r['raw']);
$r = call('POST', '/api/deliveries', ['category' => ''] + $body, $nvTok);
check('nature du colis obligatoire', ($r['json']['code'] ?? '') === 'CATEGORY_REQUIRED', $r['raw']);
$r = call('POST', '/api/deliveries', $body, $nvTok);
$g = $r['json'];
$bd = json_decode((string)($g['priceBreakdown'] ?? ''), true);
check('publication par gabarit M : prix serveur 63 600, detail conserve', ($g['priceXAF'] ?? 0) === 63600 && $g['size'] === 'M' && ($bd['zone'] ?? '') === 'Grand Sud' && $bd['perKmXAF'] === 250, $r['raw']);
$old = call('POST', '/api/deliveries', ['pickupAddress' => 'Douala', 'dropoffAddress' => 'Yaoundé', 'weightKg' => 2, 'recipientName' => 'Ancien', 'recipientPhone' => '690000003'], $nvTok)['json'];
check('ancienne app (poids sans gabarit) : convertie en gabarit S', ($old['size'] ?? '') === 'S' && (float)$old['weightKg'] === 2.0, $old);
call('PATCH', "/api/deliveries/{$old['id']}/cancel", null, $nvTok);

echo "== Offres : filtres ville / quartier, vendeur-livreur, vehicule\n";
$all = call('GET', '/api/deliveries/available', null, $dTok)['json'];
$row = null;
foreach ($all as $x) {
    if ($x['id'] === $g['id']) {
        $row = $x;
    }
}
check('offre visible sans filtre, sans codes ni photo', $row !== null && !isset($row['collectCode'], $row['deliverCode'], $row['clientToken'], $row['photoPath']) && $row['vehicleOk'] === true, $row);
check('filtre ville : Douala', in_array($g['id'], array_column(call('GET', '/api/deliveries/available?city=Douala', null, $dTok)['json'], 'id'), true));
check('filtre ville : Garoua exclut', !in_array($g['id'], array_column(call('GET', '/api/deliveries/available?city=Garoua', null, $dTok)['json'], 'id'), true));
check('filtre quartier (lieu de collecte)', in_array($g['id'], array_column(call('GET', '/api/deliveries/available?quartier=Doual', null, $dTok)['json'], 'id'), true) && !in_array($g['id'], array_column(call('GET', '/api/deliveries/available?quartier=zzzz', null, $dTok)['json'], 'id'), true));
check('pagination : page 2 vide', call('GET', '/api/deliveries/available?page=2', null, $dTok)['json'] === []);

$own = call('POST', '/api/deliveries', ['pickupAddress' => 'Douala', 'dropoffAddress' => 'Yaoundé', 'fromCity' => 'Douala', 'size' => 'S', 'category' => 'CLOTHING', 'photo' => $png, 'recipientName' => 'X', 'recipientPhone' => '690000002', 'shopName' => 'Chez Marie'], $vTok)['json'];
$mDel = call('POST', '/api/auth/switch-role', ['role' => 'DELIVERER'], $vTok)['json']['accessToken'];
check('un vendeur ne voit pas ses propres livraisons dans les offres', !in_array($own['id'], array_column(call('GET', '/api/deliveries/available', null, $mDel)['json'], 'id'), true) && in_array($g['id'], array_column(call('GET', '/api/deliveries/available', null, $mDel)['json'], 'id'), true));
$r = call('PATCH', "/api/deliveries/{$own['id']}/accept", null, $mDel);
check('un vendeur ne peut pas accepter sa propre livraison', $r['code'] === 403 && ($r['json']['code'] ?? '') === 'SELF_DELIVERY', $r['raw']);
$o = call('POST', '/api/auth/otp/send', ['phone' => '+237699000333', 'name' => 'Livreur Neuf']);
call('POST', '/api/auth/otp/verify', ['phone' => '+237699000333', 'code' => $o['json']['devCode'] ?? '']);
$call = call('POST', '/api/auth/signup', ['name' => 'Livreur Neuf', 'phone' => '+237699000333', 'pin' => '1357', 'role' => 'DELIVERER']);
$newTok = $call['json']['accessToken'] ?? '';
call('POST', '/api/auth/accept-cgu', ['version' => $ver], $newTok);
$r = call('PATCH', "/api/deliveries/{$g['id']}/accept", null, $newTok);
check('livreur sans KYC valide : accepter refuse', $r['code'] === 403 && ($r['json']['code'] ?? '') === 'KYC_REQUIRED', $r['raw']);
call('PATCH', "/api/deliveries/{$own['id']}/cancel", null, $vTok);

$xl = call('POST', '/api/deliveries', ['size' => 'XL'] + $body, $nvTok)['json'];
$r = call('PATCH', "/api/deliveries/{$xl['id']}/accept", null, $dTok);
check('gabarit XL : une moto ne peut pas accepter', $r['code'] === 403 && ($r['json']['code'] ?? '') === 'VEHICLE_MISMATCH', $r['raw']);
check('vehicule invalide refuse', call('PATCH', '/api/user/profile', ['vehicleType' => 'FUSEE'], $dTok)['code'] === 400);
check('choix du vehicule : tricycle', call('PATCH', '/api/user/profile', ['vehicleType' => 'TRICYCLE'], $dTok)['json']['vehicleType'] === 'TRICYCLE');
check('tricycle accepte le gabarit XL', call('PATCH', "/api/deliveries/{$xl['id']}/accept", null, $dTok)['json']['status'] === 'ACCEPTE');
call('PATCH', '/api/user/profile', ['vehicleType' => 'MOTO'], $dTok);

echo "== Controle a la collecte : correction de gabarit\n";
check('livreur accepte (gabarit M, moto)', call('PATCH', "/api/deliveries/{$g['id']}/accept", null, $dTok)['json']['status'] === 'ACCEPTE');
check('correction sans photo refusee', (call('POST', "/api/deliveries/{$g['id']}/revision", ['size' => 'L'], $dTok)['json']['code'] ?? '') === 'PHOTO_REQUIRED');
check('correction vers le meme gabarit refusee', call('POST', "/api/deliveries/{$g['id']}/revision", ['size' => 'M', 'photo' => $png], $dTok)['code'] === 400);
check('correction vers XXL : sur devis', (call('POST', "/api/deliveries/{$g['id']}/revision", ['size' => 'XXL', 'photo' => $png], $dTok)['json']['code'] ?? '') === 'SIZE_ON_QUOTE');
$rv = call('POST', "/api/deliveries/{$g['id']}/revision", ['size' => 'L', 'photo' => $png], $dTok);
check('correction M -> L : 63 600 -> 64 500, en attente', ($rv['json']['newPriceXAF'] ?? 0) === 64500 && $rv['json']['oldPriceXAF'] === 63600 && $rv['json']['status'] === 'PENDING', $rv['raw']);
check('2e correction pendant l\'attente refusee', (call('POST', "/api/deliveries/{$g['id']}/revision", ['size' => 'XL', 'photo' => $png], $dTok)['json']['code'] ?? '') === 'REVISION_PENDING');
check('collecte bloquee tant que le vendeur n\'a pas repondu', (call('PATCH', "/api/deliveries/{$g['id']}/confirm-collect", ['collectCode' => $g['collectCode']], $dTok)['json']['code'] ?? '') === 'REVISION_PENDING');
check('le livreur ne peut pas repondre a sa propre correction', call('PATCH', "/api/deliveries/{$g['id']}/revision", ['accept' => true], $dTok)['code'] === 403);
$view = call('GET', "/api/deliveries/{$g['id']}", null, $nvTok)['json'];
check('le vendeur voit la correction (sans chemin de fichier)', ($view['revision']['status'] ?? '') === 'PENDING' && !isset($view['revision']['photoPath']) && !isset($view['photoPath']) && $view['hasPhoto'] === true, $view);
$ph = call('GET', "/api/deliveries/{$g['id']}/photo?kind=revision", null, $nvTok);
check('photo du livreur visible par le vendeur', $ph['code'] === 200 && str_starts_with($ph['raw'], "\x89PNG"));
check('photo refusee a un tiers', call('GET', "/api/deliveries/{$g['id']}/photo", null, $d2Tok)['code'] === 403);
$ok = call('PATCH', "/api/deliveries/{$g['id']}/revision", ['accept' => true], $nvTok)['json'];
check('vendeur accepte : prix 64 500, gabarit L, commission recalculee', ($ok['priceXAF'] ?? 0) === 64500 && $ok['size'] === 'L' && $ok['commissionXAF'] === (int)round(64500 * 0.03) && $ok['delivererEarning'] === 64500 - $ok['commissionXAF'], $ok);
check('escrow mis a jour', (int)sql('SELECT amountXAF AS a FROM EscrowEntry WHERE deliveryId = ?', [$g['id']])['a'] === 64500);
check('collecte possible apres reponse', call('PATCH', "/api/deliveries/{$g['id']}/confirm-collect", ['collectCode' => $g['collectCode']], $dTok)['json']['status'] === 'EN_ROUTE');
check('apres le depart : plus de correction possible', call('POST', "/api/deliveries/{$g['id']}/revision", ['size' => 'XL', 'photo' => $png], $dTok)['code'] === 409);

// Refus : la course est annulee, le livreur est dedommage, le vendeur sans solde est mis en dette.
$g2 = call('POST', '/api/deliveries', $body, $nvTok)['json'];
call('PATCH', "/api/deliveries/{$g2['id']}/accept", null, $dTok);
$dBefore = (int)sql('SELECT balanceXAF AS b FROM Wallet WHERE userId = ?', [$dId])['b'];
call('POST', "/api/deliveries/{$g2['id']}/revision", ['size' => 'L', 'photo' => $png], $dTok);
$ref = call('PATCH', "/api/deliveries/{$g2['id']}/revision", ['accept' => false], $nvTok)['json'];
check('vendeur refuse : course annulee', ($ref['status'] ?? '') === 'ANNULE', $ref);
check('livreur dedommage de 500 F', (int)sql('SELECT balanceXAF AS b FROM Wallet WHERE userId = ?', [$dId])['b'] === $dBefore + 500);
$nvW = sql('SELECT balanceXAF AS b, debtXAF AS d FROM Wallet WHERE userId = ?', [$nvId]);
check('vendeur sans solde : 500 F de dette, solde a zero', (int)$nvW['b'] === 0 && (int)$nvW['d'] === 500, $nvW);
check('historique du vendeur : frais en negatif', in_array(-500, array_column(call('GET', '/api/wallet', null, $nvTok)['json']['transactions'], 'amount'), true));

// Pas de reponse : annulation sans frais.
$g3 = call('POST', '/api/deliveries', $body, $nvTok)['json'];
call('PATCH', "/api/deliveries/{$g3['id']}/accept", null, $dTok);
call('POST', "/api/deliveries/{$g3['id']}/revision", ['size' => 'L', 'photo' => $png], $dTok);
sql("UPDATE GabaritRevision SET expiresAt = '2000-01-01 00:00:00' WHERE deliveryId = ?", [$g3['id']]);
$r = call('PATCH', "/api/deliveries/{$g3['id']}/confirm-collect", ['collectCode' => $g3['collectCode']], $dTok);
check('delai depasse : la collecte est refusee', $r['code'] >= 400, $r['raw']);
check('delai depasse : course annulee, sans frais', call('GET', "/api/deliveries/{$g3['id']}", null, $nvTok)['json']['status'] === 'ANNULE' && (int)sql('SELECT debtXAF AS d FROM Wallet WHERE userId = ?', [$nvId])['d'] === 500);
check('reponse tardive refusee', (call('PATCH', "/api/deliveries/{$g3['id']}/revision", ['accept' => true], $nvTok)['json']['code'] ?? '') === 'REVISION_EXPIRED');

// Annulation par le vendeur : gratuite juste apres l'acceptation, payante ensuite.
$g4 = call('POST', '/api/deliveries', $body, $nvTok)['json'];
call('PATCH', "/api/deliveries/{$g4['id']}/accept", null, $dTok);
call('PATCH', "/api/deliveries/{$g4['id']}/cancel", null, $nvTok);
check('annulation juste apres acceptation : gratuite', (int)sql('SELECT debtXAF AS d FROM Wallet WHERE userId = ?', [$nvId])['d'] === 500);
$g5 = call('POST', '/api/deliveries', $body, $nvTok)['json'];
call('PATCH', "/api/deliveries/{$g5['id']}/accept", null, $dTok);
sql("UPDATE Delivery SET updatedAt = '2000-01-01 00:00:00' WHERE id = ?", [$g5['id']]);
call('PATCH', "/api/deliveries/{$g5['id']}/cancel", null, $nvTok);
check('annulation course deja en route : 500 F de frais', (int)sql('SELECT debtXAF AS d FROM Wallet WHERE userId = ?', [$nvId])['d'] === 1000);

$st = call('GET', '/api/user/profile', null, $nvTok)['json']['strikes'];
check('ecarts du vendeur comptes (1 accepte + 1 refuse)', $st['count'] === 2 && $st['threshold'] === 3 && $st['enhancedControl'] === false, $st);

echo "== Dette de frais recuperee sur les gains + tarifs modifiables sans effet retroactif\n";
check('livraison de la course corrigee (code de reception)', call('PATCH', "/api/deliveries/{$g['id']}/confirm-deliver", ['deliverCode' => $g['deliverCode']], $dTok)['json']['status'] === 'LIVRE');
$cfg = call('GET', '/api/admin/pricing', null, $aTok)['json'];
$zones = $cfg['zones'];
foreach ($zones as &$zz) {
    if ($zz['name'] === 'Grand Sud') {
        $zz['perKm'] = 300;
    }
}
unset($zz);
$r = call('PATCH', '/api/admin/pricing', ['zones' => $zones, 'defaultZone' => $cfg['defaultZone'], 'cancelFeeXAF' => 700], $aTok);
check('admin : tarif de zone modifie', $r['code'] === 200, $r['raw']);
$q = call('GET', '/api/public/quote?from=Douala&to=Yaound%C3%A9&fromCity=Douala&size=M&type=TEMPORAIRE')['json'];
check('nouveau tarif applique aux nouveaux devis : 500 + 300 x 250 + 600', ($q['finalPrice'] ?? 0) === 75800 && ($q['cancelFeeXAF'] ?? 0) === 700, $q);
check('CGU : le montant des frais suit le reglage (700 F)', str_contains(json_encode(call('GET', '/api/public/cgu?lang=fr')['json'], JSON_UNESCAPED_UNICODE), '700 F CFA'));
check('livraison deja creee : prix inchange', (int)sql('SELECT priceXAF AS p FROM Delivery WHERE id = ?', [$g['id']])['p'] === 64500);
$inv = call('GET', "/api/deliveries/{$g['id']}/invoice/delivery", null, $dTok);
$labels = [];
foreach (($inv['json']['details'] ?? []) as $blk) {
    foreach ($blk['rows'] as $rw) {
        $labels[] = $rw['label'];
    }
}
check('facture deja emise : detail fige (250 F/km malgre le nouveau tarif)', in_array('Distance (250 km × 250)', $labels, true) && $inv['json']['total'] === $ok['delivererEarning'], $labels);
check('admin : zones vides refusees', call('PATCH', '/api/admin/pricing', ['zones' => []], $aTok)['code'] === 400);
check('admin : une region dans deux zones refusee', call('PATCH', '/api/admin/pricing', ['zones' => [['name' => 'A', 'regions' => ['Nord'], 'base' => 1, 'perKm' => 1], ['name' => 'B', 'regions' => ['Nord'], 'base' => 1, 'perKm' => 1]]], $aTok)['code'] === 400);
check('admin : commission hors bornes refusee', call('PATCH', '/api/admin/pricing', ['commissionRate' => 0.9], $aTok)['code'] === 400);
check('tarification : refusee a un non-admin', call('PATCH', '/api/admin/pricing', ['cancelFeeXAF' => 1], $vTok)['code'] === 403);
$zones = $cfg['zones'];
call('PATCH', '/api/admin/pricing', ['zones' => $zones, 'defaultZone' => $cfg['defaultZone'], 'cancelFeeXAF' => 500], $aTok);

echo "== CGU modifiables depuis le back-office\n";
$ac = call('GET', '/api/admin/cgu', null, $aTok)['json'];
check('admin : CGU francaises et anglaises en base', count($ac['fr']) >= 11 && count($ac['en']) >= 11 && $ac['version'] >= 1 && isset($ac['history'][0]));
check('CGU : refusees a un non-admin', call('GET', '/api/admin/cgu', null, $vTok)['code'] === 403);
check('CGU vides refusees', call('POST', '/api/admin/cgu', ['fr' => [], 'en' => []], $aTok)['code'] === 400);
$fr = $ac['fr'];
$fr[0]['body'] .= ' (texte modifie)';
$pub = call('POST', '/api/admin/cgu', ['fr' => $fr, 'en' => $ac['en']], $aTok)['json'];
check('admin publie la version suivante', ($pub['version'] ?? 0) === $ac['version'] + 1, $pub);
check('la version precedente reste consultable (preuve)', (int)sql('SELECT COUNT(*) AS n FROM CguVersion WHERE version = ?', [$ac['version']])['n'] === 2);
check('nouvelle version servie a l\'app', str_contains(call('GET', '/api/public/cgu?lang=fr')['raw'], 'texte modifie'));
check('nouvelle version : les vendeurs doivent la re-accepter', (call('POST', '/api/deliveries', $body, $nvTok)['json']['code'] ?? '') === 'CGU_REQUIRED');
call('POST', '/api/auth/accept-cgu', ['version' => $pub['version']], $nvTok);
check('apres acceptation, la publication repasse', (call('POST', '/api/deliveries', $body, $nvTok)['json']['id'] ?? null) !== null);

echo "== Un seul KYC pour les deux roles
";
$sw = call('POST', '/api/auth/switch-role', ['role' => 'DELIVERER'], $nvTok)['json'];
check('vendeur verifie qui devient livreur : aucun nouveau KYC', ($sw['user']['kycStatus'] ?? '') === 'VERIFIED' && $sw['user']['kycByRole']['DELIVERER'] === 'VERIFIED', $sw);
check('renvoi du dossier refuse (deja valide)', call('POST', '/api/auth/kyc', ['selfie' => $png], $sw['accessToken'])['code'] === 409);
$mOff = call('POST', '/api/deliveries', ['pickupAddress' => 'Douala', 'dropoffAddress' => 'Yaoundé', 'fromCity' => 'Douala', 'size' => 'S', 'category' => 'CLOTHING', 'photo' => $png, 'recipientName' => 'Y', 'recipientPhone' => '690000004', 'shopName' => 'Chez Marie'], $vTok)['json'];
check('le meme dossier permet de livrer', call('PATCH', "/api/deliveries/{$mOff['id']}/accept", null, $sw['accessToken'])['json']['status'] === 'ACCEPTE');
check('mais pas sa propre livraison', (call('PATCH', "/api/deliveries/{$xl['id']}/accept", null, $sw['accessToken'])['json']['code'] ?? '') === 'SELF_DELIVERY');

echo PHP_EOL . "Resultat : $pass ok, $fail echec(s)" . PHP_EOL;
exit($fail ? 1 : 0);
