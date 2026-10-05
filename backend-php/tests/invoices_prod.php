<?php
// Cycle complet puis les 3 factures + la liste back-office, sur un serveur reel.
//   BASE=http://koligo.trugroup.cm ADMIN_PHONE=691227149 ADMIN_PIN=... php tests/invoices_prod.php
// Cree 2 comptes de test et 1 livraison (validee par code, sans paiement mobile money).
$U = getenv('BASE') ?: 'http://koligo.trugroup.cm';

function c(string $m, string $p, ?array $b = null, ?string $t = null): array
{
    global $U;
    $ch = curl_init($U . $p);
    $h = ['Accept: application/json'];
    if ($t) {
        $h[] = "Authorization: Bearer $t";
    }
    if (in_array($m, ['PATCH', 'PUT', 'DELETE'], true)) {
        $h[] = "X-HTTP-Method-Override: $m";
        $m = 'POST';
        $b ??= [];
    }
    if ($b !== null) {
        $h[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($b));
    }
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $m, CURLOPT_HTTPHEADER => $h, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60]);
    $o = (string)curl_exec($ch);
    return [curl_getinfo($ch, CURLINFO_RESPONSE_CODE), json_decode($o, true), $o];
}

function signup(string $phone, string $name, string $role): string
{
    $o = c('POST', '/api/auth/otp/send', ['phone' => $phone, 'name' => $name])[1];
    c('POST', '/api/auth/otp/verify', ['phone' => $phone, 'code' => $o['devCode']]);
    return c('POST', '/api/auth/signup', ['name' => $name, 'phone' => $phone, 'pin' => '1234', 'role' => $role])[1]['accessToken'];
}

$s = substr((string)time(), -5);
$vp = "+23769500$s";
$dp = "+23769501$s";
$v = signup($vp, 'Boutique Facture', 'VENDOR');
$d = signup($dp, 'Livreur Facture', 'DELIVERER');
echo "comptes de test : vendeur $vp / livreur $dp (PIN 1234)\n";

$del = c('POST', '/api/deliveries', ['pickupAddress' => 'Akwa', 'dropoffAddress' => 'Bonapriso', 'weightKg' => 1, 'shopName' => 'Chez Facture', 'description' => 'Robe wax', 'recipientName' => 'Aicha Test', 'recipientPhone' => '691221749', 'productPrice' => 5000], $v)[1];
$id = $del['id'];
echo "livraison : ref " . strtoupper(substr($id, -8)) . ", transport {$del['priceXAF']} XAF\n";
echo 'sale avant acceptation -> HTTP ', c('GET', "/api/deliveries/$id/invoice/sale", null, $v)[0], " (attendu 400)\n";
c('PATCH', "/api/deliveries/$id/accept", null, $d);
c('PATCH', "/api/deliveries/$id/confirm-collect", ['collectCode' => $del['collectCode']], $d);
echo 'sale (livreur trouve) -> HTTP ', c('GET', "/api/deliveries/$id/invoice/sale", null, $v)[0], "\n";
echo 'payment avant livraison -> HTTP ', c('GET', "/api/deliveries/$id/invoice/payment", null, $v)[0], " (attendu 400)\n";
c('PATCH', "/api/deliveries/$id/confirm-deliver", ['deliverCode' => $del['deliverCode']], $d);

foreach ([['sale', $v, 'vendeur'], ['payment', $v, 'vendeur'], ['delivery', $d, 'livreur']] as [$type, $tok, $who]) {
    [$code, $j] = c('GET', "/api/deliveries/$id/invoice/$type", null, $tok);
    echo sprintf("%-9s (%s) HTTP %d  n° %s  total %s XAF  lignes: %s\n", $type, $who, $code, $j['number'] ?? '?', $j['total'] ?? '?', json_encode(array_map(fn($l) => $l['label'] . '=' . $l['amountXAF'], $j['lines'] ?? []), JSON_UNESCAPED_UNICODE));
}
echo 'livreur -> facture de vente : HTTP ', c('GET', "/api/deliveries/$id/invoice/sale", null, $d)[0], " (attendu 403)\n";
$pub = c('GET', "/api/deliveries/$id/public-invoice");
echo 'facture de paiement publique (destinataire) : HTTP ', $pub[0], ', paiement=', $pub[1]['payment']['method'] ?? '?', ', tel dans la reponse: ', str_contains($pub[2], '+237') ? 'OUI (anormal)' : 'non', "\n";

$aPin = getenv('ADMIN_PIN');
if ($aPin) {
    $a = c('POST', '/api/auth/signin', ['phone' => getenv('ADMIN_PHONE') ?: '691227149', 'pin' => $aPin])[1]['accessToken'] ?? '';
    $list = c('GET', '/api/admin/invoices?q=' . strtoupper(substr($id, -8)), null, $a);
    $row = $list[1]['items'][0] ?? null;
    echo 'BACK-OFFICE liste : HTTP ', $list[0], ', ', $list[1]['total'] ?? '?', ' resultat(s), factures dispo: ', json_encode($row['invoices'] ?? null), "\n";
    echo 'BACK-OFFICE detail livraison : HTTP ', c('GET', "/api/admin/invoices/$id/delivery", null, $a)[0], "\n";
} else {
    echo "BACK-OFFICE : saute (ADMIN_PIN non fourni)\n";
}
