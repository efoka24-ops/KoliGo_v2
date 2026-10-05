<?php
// Prepare un colis EN_ROUTE sur le backend local pour le test sur emulateur.
//   php tests/e2e_setup.php            -> affiche la Ref et le code de reception
const BASE = 'http://127.0.0.1:3001';

function c(string $m, string $p, ?array $b = null, ?string $t = null): array
{
    $ch = curl_init(BASE . $p);
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
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $m, CURLOPT_HTTPHEADER => $h, CURLOPT_RETURNTRANSFER => true]);
    return json_decode((string)curl_exec($ch), true) ?? [];
}

$v = c('POST', '/api/auth/signin', ['phone' => '+237655111222', 'pin' => '1234'])['accessToken'];
$d = c('POST', '/api/auth/signin', ['phone' => '+237677234567', 'pin' => '1234'])['accessToken'];
$del = c('POST', '/api/deliveries', [
    'pickupAddress' => 'Akwa', 'dropoffAddress' => 'Bonamoussadi', 'weightKg' => 2, 'delivererType' => 'TEMPORAIRE',
    'description' => 'Robe wax', 'shopName' => 'Chez Marie', 'recipientName' => 'Aicha Test', 'recipientPhone' => '690000001',
], $v);
$id = $del['id'];
c('PATCH', "/api/deliveries/$id/accept", null, $d);
c('PATCH', "/api/deliveries/$id/confirm-collect", ['collectCode' => $del['collectCode']], $d);
c('POST', "/api/deliveries/$id/location", ['latitude' => 4.060, 'longitude' => 9.720], $d);
c('POST', "/api/deliveries/$id/messages", ['content' => 'Bonjour, je suis en route avec votre colis'], $d);
echo json_encode(['id' => $id, 'ref' => strtoupper(substr($id, -8)), 'deliverCode' => $del['deliverCode'], 'price' => $del['priceXAF']]), "\n";
