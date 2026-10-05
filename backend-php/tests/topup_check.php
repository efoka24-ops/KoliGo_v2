<?php
// Recharge de portefeuille reelle (Sungku) : BASE=... PAY_PHONE=691221749 AMOUNT=100 php tests/topup_check.php
// Declenche une VRAIE demande de paiement mobile money sur PAY_PHONE.
$U = getenv('BASE') ?: 'http://koligo.trugroup.cm';
$phone = getenv('PAY_PHONE') ?: '';
$amount = (int)(getenv('AMOUNT') ?: 100);
if ($phone === '') {
    exit("PAY_PHONE requis\n");
}

function c(string $m, string $p, ?array $b = null, ?string $t = null): array
{
    global $U;
    $ch = curl_init($U . $p);
    $h = ['Accept: application/json'];
    if ($t) {
        $h[] = "Authorization: Bearer $t";
    }
    if ($b !== null) {
        $h[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($b));
    }
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $m, CURLOPT_HTTPHEADER => $h, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60]);
    $o = (string)curl_exec($ch);
    return [curl_getinfo($ch, CURLINFO_RESPONSE_CODE), json_decode($o, true), $o];
}

$ph = '+2376960' . substr((string)time(), -5);
$o = c('POST', '/api/auth/otp/send', ['phone' => $ph, 'name' => 'Test Recharge'])[1];
c('POST', '/api/auth/otp/verify', ['phone' => $ph, 'code' => $o['devCode']]);
$tok = c('POST', '/api/auth/signup', ['name' => 'Test Recharge', 'phone' => $ph, 'pin' => '1234', 'role' => 'VENDOR'])[1]['accessToken'];
echo "compte de test : $ph\n";
$r = c('POST', '/api/wallet/topup', ['amount' => $amount, 'phone' => $phone], $tok);
echo "recharge $amount XAF -> $phone : HTTP {$r[0]} {$r[2]}\n";
echo 'solde avant confirmation (doit rester 0) : ', c('GET', '/api/wallet', null, $tok)[1]['balance'], "\n";
echo "token=$tok\n";
