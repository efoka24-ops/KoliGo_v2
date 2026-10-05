<?php
// Faux Sungku pour les tests locaux : php -S 127.0.0.1:8099 tests/fake_sungku.php
// Numeros speciaux : 237600000000 -> 422 (refus), 237600000500 -> 503 (indisponible).
$log = __DIR__ . '/.fake_sungku.log';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($path === '/__log') {
    header('Content-Type: application/json');
    echo '[' . implode(',', is_file($log) ? file($log, FILE_IGNORE_NEW_LINES) : []) . ']';
    return;
}
if ($path === '/__reset') {
    @unlink($log);
    echo 'ok';
    return;
}
if ($path === '/api/partners/deposits' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    file_put_contents($log, json_encode(['key' => $_SERVER['HTTP_X_API_KEY'] ?? null, 'body' => $body]) . "\n", FILE_APPEND);
    if (($_SERVER['HTTP_X_API_KEY'] ?? '') !== 'sk_local_test_key') {
        http_response_code(401);
        echo json_encode(['error' => ['message' => 'Cle API invalide']]);
        return;
    }
    $phone = $body['phoneNumber'] ?? '';
    if (!is_array($body) || !isset($body['reference'], $body['amount']) || !preg_match('/^237\d{9}$/', $phone)) {
        http_response_code(422);
        echo json_encode(['error' => ['message' => 'Corps invalide']]);
        return;
    }
    if ($phone === '237600000000') {
        http_response_code(422);
        echo json_encode(['error' => ['message' => 'Numéro non éligible']]);
        return;
    }
    if ($phone === '237600000500') {
        http_response_code(503);
        echo json_encode(['error' => 'maintenance']);
        return;
    }
    http_response_code(201);
    echo json_encode(['id' => 'dep_' . bin2hex(random_bytes(4)), 'status' => 'PENDING', 'reference' => $body['reference']]);
    return;
}
http_response_code(404);
echo '{}';
