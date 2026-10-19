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
    /**
     * @param string $bodyHtml fragment HTML du message (voir MailTemplate : paragraph, code, note, button) ; la mise en page,
     *                         l'en-tete et la version texte sont ajoutes ici
     * @return bool vrai si l'agent de messagerie du serveur a accepte le message (pas une preuve de livraison)
     */
    public static function email(string $to, string $subject, string $bodyHtml, ?string $preheader = null, ?string $title = null): bool
    {
        if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL) || Env::bool('MAIL_DISABLED')) {
            return false;
        }
        $from = Env::get('MAIL_FROM', 'noreply@trugroup.cm');
        $title ??= preg_replace('/^\[KoliGo\]\s*/u', '', $subject) ?? $subject;
        $html = MailTemplate::wrap($title, $bodyHtml, $preheader);
        $text = MailTemplate::plainText($title, $bodyHtml);
        // SMTP authentifie quand il est configure (fiable) ; sinon repli sur mail() de l'hebergeur.
        if (Smtp::configured()) {
            $ok = Smtp::send($to, $subject, $html, (string)$from, 'KoliGo', $text);
            if (!$ok) {
                error_log('[mail] SMTP : ' . Smtp::$lastError);
            }
            return $ok;
        }
        [$ctype, $body] = MailTemplate::multipart($html, $text);
        $headers = "MIME-Version: 1.0\r\nContent-Type: $ctype\r\nFrom: KoliGo <$from>\r\nAuto-Submitted: auto-generated\r\n";
        try {
            $ok = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
            error_log('[mail] mail() ' . ($ok ? 'accepte' : 'REFUSE') . ' pour ' . preg_replace('/^(.).*(@.*)$/', '$1***$2', $to)
                . ' from=' . $from . ' sendmail_path=' . (string)ini_get('sendmail_path') . ' smtp=' . (string)ini_get('SMTP'));
            return (bool)$ok;
        } catch (\Throwable $e) {
            error_log('[mail] ' . $e->getMessage());
            return false;
        }
    }

    /** E-mail du code de verification : le code est la premiere chose que l'on voit, y compris dans l'apercu de la messagerie. */
    public static function codeEmail(string $to, string $code, ?string $name, int $minutes, string $title = 'Votre code de vérification'): bool
    {
        $body = ($name ? MailTemplate::paragraph("Bonjour $name,") : '')
            . MailTemplate::paragraph('Voici votre code de vérification KoliGo :')
            . MailTemplate::code($code)
            . MailTemplate::paragraph("Il est valable $minutes minutes.")
            . MailTemplate::note("Ne le partagez avec personne : l'équipe KoliGo ne vous le demandera jamais.")
            . MailTemplate::note("Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.");
        return self::email($to, "$code est votre code KoliGo", $body, "Votre code de vérification : $code (valable $minutes minutes)", $title);
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

    /** Envoie un SMS via teeeotp (voir Sms). Vrai si la passerelle a accepte le message (pas une preuve de livraison). */
    public static function sms(string $phone, string $text): bool
    {
        return Sms::send($phone, $text, 'SMS')['ok'];
    }

    /**
     * @param list<string>|null $only canaux a utiliser parmi email, sms, whatsApp (null = tous)
     * @return array{email: bool, whatsApp: bool, sms: bool, errors: array<string,string>} statut de chaque canal, best-effort ;
     *         errors['sms'] = code d'erreur de la passerelle quand l'envoi SMS a ete tente et a echoue
     */
    public static function otp(string $phone, ?string $email, string $code, ?string $name, ?array $only = null, ?string $userId = null, ?string $by = null): array
    {
        $use = static fn(string $ch): bool => $only === null || in_array($ch, $only, true);
        $hello = $name ? "Bonjour $name ! " : '';
        $viaEmail = false;
        if ($email && $use('email')) {
            $viaEmail = self::codeEmail($email, $code, $name, 5);
        }
        $errors = [];
        $viaSms = false;
        if ($use('sms')) {
            // Texte court, sans accent : un seul SMS facture. La validite est celle du code : un code expire n'arrive jamais en retard.
            $r = Sms::send($phone, "KoliGo : votre code est $code. Valable 5 min. Ne le partagez a personne.", 'OTP', 300, $userId, $by);
            $viaSms = $r['ok'];
            if (!$r['ok'] && $r['error']) {
                $errors['sms'] = $r['error'];
            }
        }
        $text = "{$hello}Votre code de verification *KoliGo* : *$code*\n\nValide 5 minutes. Ne le partagez a personne.";
        return [
            'email' => $viaEmail,
            'sms' => $viaSms,
            'whatsApp' => $use('whatsApp') && self::whatsapp($phone, $text),
            'errors' => $errors,
        ];
    }

    public static function xaf(int $n): string
    {
        return number_format($n, 0, ',', ' ');
    }
}
