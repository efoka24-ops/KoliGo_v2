<?php
// Verifie sur un serveur reel : chat 3 parties + creation du paiement du destinataire.
//   BASE=http://koligo.trugroup.cm php tests/chat_check.php
// Cree 2 comptes de test. Le paiement vise un numero de test : si Sungku l'accepte,
// une invite MoMo peut etre envoyee a ce numero (CHECK_PAY_PHONE, defaut : aucune invite, etape sautee).
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

$s = substr((string)time(), -6);
$v = signup("+2376970$s", 'Vendeur Chat', 'VENDOR');
$d = signup("+2376971$s", 'Livreur Chat', 'DELIVERER');
echo "livreur de test : +2376971$s (PIN 1234)
";
$del = c('POST', '/api/deliveries', ['pickupAddress' => 'Akwa', 'dropoffAddress' => 'Bonapriso', 'weightKg' => 1, 'recipientName' => 'Paul', 'recipientPhone' => '690000001'], $v)[1];
$id = $del['id'];

echo "livraison de test : id=$id ref=" . strtoupper(substr($id, -8)) . " prix={$del['priceXAF']} XAF code_reception={$del['deliverCode']}
";
echo 'destinataire avant acceptation : ', c('POST', "/api/deliveries/$id/recipient-message", ['content' => 'salut'])[2], "\n";
c('PATCH', "/api/deliveries/$id/accept", null, $d);
c('PATCH', "/api/deliveries/$id/confirm-collect", ['collectCode' => $del['collectCode']], $d);
echo 'destinataire -> HTTP ', c('POST', "/api/deliveries/$id/recipient-message", ['content' => 'Je suis a la maison', 'recipientName' => 'Paul'])[0], "\n";
echo 'livreur      -> HTTP ', c('POST', "/api/deliveries/$id/messages", ['content' => "J'arrive dans 5 min"], $d)[0], "\n";
echo 'vendeur      -> HTTP ', c('POST', "/api/deliveries/$id/messages", ['content' => 'Merci'], $v)[0], "\n";
$m = c('GET', "/api/deliveries/$id/messages", null, $v)[1];
echo 'vendeur lit ', count($m), ' messages : ', implode(' | ', array_map(fn($x) => $x['senderRole'] . ':' . $x['content'], $m)), "\n";
echo 'livreur lit ', count(c('GET', "/api/deliveries/$id/messages", null, $d)[1]), " messages\n";
echo 'page destinataire lit ', count(c('GET', "/api/deliveries/$id/messages-public")[1]), " messages\n";
echo 'inbox vendeur : ', count(c('GET', '/api/deliveries', null, $v)[1]), " livraison(s)\n";

$phone = getenv('CHECK_PAY_PHONE');
if ($phone) {
    $r = c('POST', "/api/deliveries/$id/client-confirm", ['code' => $del['deliverCode'], 'momoPhone' => $phone]);
    echo "paiement Sungku ($phone) -> HTTP {$r[0]} " . substr($r[2], 0, 250) . "\n";
} else {
    echo "paiement Sungku : saute (definir CHECK_PAY_PHONE pour tester avec un vrai numero)\n";
}
