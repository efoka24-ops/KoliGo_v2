<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Env;

/** Sungku a refuse clairement la demande (4xx hors 429) : l'echec est prouve. */
final class SungkuRejected extends \RuntimeException {}

/**
 * Echec non prouve : timeout, 5xx, 429, coupure reseau. L'argent a peut-etre
 * bouge, donc la transaction reste PENDING et on ne conclut jamais a un echec.
 */
final class SungkuUnavailable extends \RuntimeException {}

/**
 * Client de la passerelle Sungku (relais vers pawaPay pour Orange Money / MTN MoMo).
 *
 * KoliGo ne parle jamais a pawaPay : uniquement a Sungku, avec une cle API et un
 * webhook signe en HMAC pour la confirmation.
 */
final class Sungku
{
    /**
     * Statuts finaux, apres normalisation par Sungku. Le vocabulaire reel est
     * CONFIRMED (et non COMPLETED) ; COMPLETED est tolere par prudence.
     * Tout autre statut est traite comme "pas encore final".
     */
    private const SETTLED = ['CONFIRMED', 'COMPLETED', 'SUCCESS', 'SUCCESSFUL'];
    private const FAILED = ['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED', 'EXPIRED'];

    /** Derniere reponse de Sungku (statut HTTP + extrait du corps), pour le diagnostic admin. Jamais la cle API. */
    public static ?array $last = null;

    public static function baseUrl(): string
    {
        $url = rtrim(Env::get('SUNGKU_BASE_URL', 'https://sungku.trugroup.cm') ?? '', '/');
        // La cle API ne doit jamais voyager en clair : hors machine locale (tests), on impose HTTPS.
        // Sans cela, Sungku repond 301 vers https et la demande n'est jamais creee.
        if (str_starts_with($url, 'http://') && !preg_match('#^http://(localhost|127\.0\.0\.1)(:|/|$)#', $url)) {
            $url = 'https://' . substr($url, 7);
        }
        return $url;
    }

    public static function isConfigured(): bool
    {
        return (Env::get('SUNGKU_API_KEY', '') ?? '') !== '';
    }

    /**
     * POST {base}/api/partners/deposits
     *
     * @param array{amount:int|string,currency:string,phoneNumber:string,reference:string,description?:string,customerMessage?:string,metadata?:array} $body
     * @return array<string,mixed> reponse de Sungku
     * @throws SungkuRejected|SungkuUnavailable
     */
    public static function initiateDeposit(array $body): array
    {
        $ch = curl_init(self::baseUrl() . '/api/partners/deposits');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'X-Api-Key: ' . (Env::get('SUNGKU_API_KEY', '') ?? ''),
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_CONNECTTIMEOUT => 8,
        ]);
        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        self::$last = ['httpStatus' => $status, 'curlError' => $err ?: null, 'body' => is_string($raw) ? mb_substr($raw, 0, 600) : null];
        error_log('[sungku] deposit ref ' . ($body['reference'] ?? '?') . ' -> HTTP ' . $status . ' ' . ($err ?: '') . ' ' . (is_string($raw) ? mb_substr(preg_replace('/\s+/', ' ', $raw), 0, 400) : ''));

        if ($raw === false || $status === 0) {
            throw new SungkuUnavailable('Sungku injoignable : ' . ($err ?: 'pas de reponse'));
        }
        $data = json_decode((string)$raw, true);
        $data = is_array($data) ? $data : [];

        // Une redirection n'est pas un succes : un POST redirige n'a rien cree chez Sungku.
        if ($status >= 300 && $status < 400) {
            throw new SungkuUnavailable("Sungku a redirige la demande (HTTP $status) : verifiez SUNGKU_BASE_URL (https)");
        }
        if ($status === 429 || $status >= 500) {
            throw new SungkuUnavailable("Sungku indisponible (HTTP $status)");
        }
        if ($status >= 400) {
            $msg = $data['error']['message'] ?? $data['message'] ?? (is_string($data['error'] ?? null) ? $data['error'] : null);
            throw new SungkuRejected($msg ?: "Sungku a refuse la demande (HTTP $status)");
        }
        return $data;
    }

    /**
     * Verifie la signature d'un webhook : sha256=HMAC(secret, "$timestamp.$rawBody").
     * Comparaison en temps constant. Sans cette verification, quiconque connait
     * l'URL pourrait annoncer un paiement reussi.
     */
    public static function verifySignature(string $rawBody, ?string $timestamp, ?string $signature): bool
    {
        $secret = Env::get('SUNGKU_WEBHOOK_SECRET', '') ?? '';
        if ($secret === '' || !$timestamp || !$signature) {
            return false;
        }
        $expected = 'sha256=' . hash_hmac('sha256', "$timestamp.$rawBody", $secret);
        return hash_equals($expected, $signature);
    }

    public static function isSettled(string $status): bool
    {
        return in_array(strtoupper($status), self::SETTLED, true);
    }

    public static function isFailed(string $status): bool
    {
        return in_array(strtoupper($status), self::FAILED, true);
    }

    /** Numero au format MSISDN attendu : 237XXXXXXXXX, sans + ni espaces. */
    public static function msisdn(string $phone): string
    {
        $d = preg_replace('/\D/', '', $phone) ?? '';
        if (str_starts_with($d, '237')) {
            return $d;
        }
        return '237' . ltrim($d, '0');
    }

    /**
     * Texte libre envoye a Sungku : lettres, chiffres et espaces uniquement (les
     * accents sont translitteres, tout le reste supprime). Sungku refuse sinon avec
     * "Customer message can have only alphanumeric and space characters".
     */
    public static function alnum(string $text, int $max): string
    {
        $t = strtr($text, [
            "à" => "a", "â" => "a", "ä" => "a", "á" => "a", "é" => "e", "è" => "e", "ê" => "e", "ë" => "e",
            "î" => "i", "ï" => "i", "ô" => "o", "ö" => "o", "ù" => "u", "û" => "u", "ü" => "u", "ç" => "c",
            "À" => "A", "Â" => "A", "É" => "E", "È" => "E", "Ê" => "E", "Î" => "I", "Ô" => "O", "Ù" => "U", "Û" => "U", "Ç" => "C",
        ]);
        $t = trim(preg_replace("/\s+/", " ", preg_replace("/[^A-Za-z0-9 ]/", " ", $t) ?? "") ?? "");
        return rtrim(substr($t, 0, $max));
    }

    /** Libelle affiche au payeur sur l invite PIN : 4 a 22 caracteres alphanumeriques. */
    public static function customerMessage(string $text): string
    {
        $t = self::alnum($text, 22);
        return strlen($t) < 4 ? "KoliGo" : $t;
    }

    /** Reference unique par operation : notre cle de rapprochement et d'idempotence. */
    public static function reference(string $prefix, string $id): string
    {
        return sprintf('KOLIGO-%s-%s-%s', $prefix, substr($id, -8), bin2hex(random_bytes(4)));
    }
}
