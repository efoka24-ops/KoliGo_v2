<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Env;

/**
 * Envoi d'e-mail par un vrai serveur SMTP authentifie (sans bibliotheque externe).
 *
 * Configuration (fichier .env.php du serveur) :
 *   SMTP_HOST=smtp.exemple.com   SMTP_PORT=587   SMTP_SECURE=tls   (tls = STARTTLS, ssl = connexion chiffree des l'ouverture, none)
 *   SMTP_USER=noreply@trugroup.cm   SMTP_PASS=...   MAIL_FROM=noreply@trugroup.cm
 *
 * La mise en œuvre de mail() de l'hebergeur n'authentifie pas l'expediteur : Gmail rejette ou classe en spam.
 * Avec SMTP, le certificat du serveur est verifie et le message est signe par le compte d'envoi.
 */
final class Smtp
{
    /** Derniere erreur, pour le diagnostic (jamais le mot de passe). */
    public static ?string $lastError = null;

    public static function configured(): bool
    {
        return (Env::get('SMTP_HOST', '') ?? '') !== '' && (Env::get('SMTP_USER', '') ?? '') !== '';
    }

    private static function clean(string $v): string
    {
        return trim(str_replace(["\r", "\n", "\0"], '', $v));
    }

    /** @return bool vrai si le serveur SMTP a accepte le message */
    public static function send(string $to, string $subject, string $html, string $from, ?string $fromName = 'KoliGo'): bool
    {
        self::$lastError = null;
        $to = self::clean($to);
        $from = self::clean($from);
        $host = self::clean((string)Env::get('SMTP_HOST', ''));
        $port = (int)(Env::get('SMTP_PORT', '587') ?? 587);
        $secure = strtolower((string)(Env::get('SMTP_SECURE', $port === 465 ? 'ssl' : 'tls') ?? 'tls'));
        $user = (string)Env::get('SMTP_USER', '');
        $pass = (string)Env::get('SMTP_PASS', '');
        if (!filter_var($to, FILTER_VALIDATE_EMAIL) || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
            self::$lastError = 'adresse invalide';
            return false;
        }

        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true, 'peer_name' => $host]]);
        $errno = 0;
        $errstr = '';
        $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $errstr, 12, STREAM_CLIENT_CONNECT, $ctx);
        if (!$fp) {
            self::$lastError = "connexion impossible a $host:$port ($errstr)";
            return false;
        }
        stream_set_timeout($fp, 15);

        try {
            self::expect($fp, [220]);
            $ehlo = self::clean((string)(parse_url('//' . substr($from, (int)strrpos($from, '@') + 1), PHP_URL_HOST) ?: 'localhost'));
            self::cmd($fp, "EHLO $ehlo", [250]);
            if ($secure === 'tls') {
                self::cmd($fp, 'STARTTLS', [220]);
                if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new \RuntimeException('echec du chiffrement STARTTLS (certificat du serveur non valide ?)');
                }
                self::cmd($fp, "EHLO $ehlo", [250]);
            }
            if ($user !== '') {
                self::cmd($fp, 'AUTH LOGIN', [334]);
                self::cmd($fp, base64_encode($user), [334]);
                self::cmd($fp, base64_encode($pass), [235]);
            }
            self::cmd($fp, "MAIL FROM:<$from>", [250]);
            self::cmd($fp, "RCPT TO:<$to>", [250, 251]);
            self::cmd($fp, 'DATA', [354]);

            $name = self::clean((string)$fromName);
            $headers = [
                'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
                'From: =?UTF-8?B?' . base64_encode($name) . "?= <$from>",
                "To: <$to>",
                'Subject: =?UTF-8?B?' . base64_encode(self::clean($subject)) . '?=',
                'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $ehlo . '>',
                'MIME-Version: 1.0',
                'Content-Type: text/html; charset=UTF-8',
                'Content-Transfer-Encoding: base64',
            ];
            // Corps en base64 : pas de ligne commencant par un point, pas de caractere special a echapper.
            $msg = implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($html), 76, "\r\n") . "\r\n.\r\n";
            fwrite($fp, $msg);
            self::expect($fp, [250]);
            @fwrite($fp, "QUIT\r\n");
            fclose($fp);
            return true;
        } catch (\Throwable $e) {
            self::$lastError = $e->getMessage();
            @fclose($fp);
            return false;
        }
    }

    private static function cmd($fp, string $line, array $ok): string
    {
        fwrite($fp, $line . "\r\n");
        return self::expect($fp, $ok);
    }

    /** Lit une reponse (eventuellement sur plusieurs lignes) et verifie son code. */
    private static function expect($fp, array $ok): string
    {
        $resp = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $resp .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }
        $code = (int)substr($resp, 0, 3);
        if (!in_array($code, $ok, true)) {
            // On ne renvoie que le code et la 1re ligne : jamais de donnees d'authentification.
            throw new \RuntimeException('reponse SMTP inattendue : ' . trim(strtok($resp, "\n") ?: 'aucune reponse'));
        }
        return $resp;
    }
}
