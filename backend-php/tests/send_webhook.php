<?php
// Simule le webhook signe de Sungku : php tests/send_webhook.php <reference> [STATUT] [BASE] [SECRET]
$ref = $argv[1] ?? '';
$status = $argv[2] ?? 'CONFIRMED';
$base = $argv[3] ?? 'http://127.0.0.1:3001';
$secret = $argv[4] ?? 'local_webhook_secret_for_tests';
$raw = json_encode(['event' => 'deposit.updated', 'data' => ['id' => 'dep_sim', 'reference' => $ref, 'status' => $status, 'type' => 'DEPOSIT']]);
$ts = (string)time();
$ch = curl_init($base . '/payments/webhook/sungku');
curl_setopt_array($ch, [
    CURLOPT_POST => true, CURLOPT_POSTFIELDS => $raw, CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', "X-Apisungku-Timestamp: $ts", 'X-Apisungku-Signature: sha256=' . hash_hmac('sha256', "$ts.$raw", $secret)],
]);
echo curl_exec($ch), ' (HTTP ', curl_getinfo($ch, CURLINFO_RESPONSE_CODE), ")\n";
