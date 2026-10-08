<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Env;

/**
 * Notifications sortantes : email (mail()) et WhatsApp (Infobip). Elles sont
 * best-effort : une panne ici ne doit jamais faire echouer l'operation metier.
 */
final class Notify
{
    /** @return bool vrai si l'agent de messagerie du serveur a accepte le message (pas une preuve de livraison) */
    public static function email(string $to, string $subject, string $bodyHtml): bool
    {
        if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL) || Env::bool('MAIL_DISABLED')) {
            return false;
        }
        $from = Env::get('MAIL_FROM', 'noreply@trugroup.cm');
        $html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">'
            . '<h2 style="color:#178A3C">KoliGo</h2>' . $bodyHtml
            . '<p style="color:#888;font-size:12px">KoliGo · La livraison collaborative au Cameroun</p></div>';
        // SMTP authentifie quand il est configure (fiable) ; sinon repli sur mail() de l'hebergeur.
        if (Smtp::configured()) {
            $ok = Smtp::send($to, $subject, $html, (string)$from);
            if (!$ok) {
                error_log('[mail] SMTP : ' . Smtp::$lastError);
            }
            return $ok;
        }
        $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: KoliGo <$from>\r\n";
        try {
            $ok = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $html, $headers);
            error_log('[mail] mail() ' . ($ok ? 'accepte' : 'REFUSE') . ' pour ' . preg_replace('/^(.).*(@.*)$/', '$1***$2', $to)
                . ' from=' . $from . ' sendmail_path=' . (string)ini_get('sendmail_path') . ' smtp=' . (string)ini_get('SMTP'));
            return (bool)$ok;
        } catch (\Throwable $e) {
            error_log('[mail] ' . $e->getMessage());
            return false;
        }
    }

    public static function whatsapp(string $phone, string $text): bool
    {
        $base = Env::get('INFOBIP_BASE_URL', '');
        $key = Env::get('INFOBIP_API_KEY', '');
        $from = Env::get('INFOBIP_WHATSAPP_FROM', '');
        if (!$base || !$key || !$from) {
            return false;
        }
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if (!str_starts_with($digits, '237') && strlen($digits) === 9 && $digits[0] === '6') {
            $digits = '237' . $digits;
        }
        $ch = curl_init("https://$base/whatsapp/1/message/text");
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['from' => $from, 'to' => $digits, 'content' => ['text' => $text]]),
            CURLOPT_HTTPHEADER => ["Authorization: App $key", 'Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
        ]);
        curl_exec($ch);
        $ok = curl_getinfo($ch, CURLINFO_RESPONSE_CODE) < 300 && curl_errno($ch) === 0;
        curl_close($ch);
        return $ok;
    }

    public static function otp(string $phone, ?string $email, string $code, ?string $name): bool
    {
        $hello = $name ? "Bonjour $name ! " : '';
        if ($email) {
            self::email($email, "[KoliGo] Code de verification : $code",
                '<p>' . htmlspecialchars($hello) . 'Votre code : <b style="font-size:28px;letter-spacing:6px">' . $code . '</b></p><p>Valide 5 minutes.</p>');
        }
        return self::whatsapp($phone, "{$hello}Votre code de verification *KoliGo* : *$code*\n\nValide 5 minutes. Ne le partagez a personne.");
    }

    public static function xaf(int $n): string
    {
        return number_format($n, 0, ',', ' ');
    }
}
