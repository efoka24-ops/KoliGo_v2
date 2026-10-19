<?php
declare(strict_types=1);

namespace Koligo\Services;

/**
 * Mise en page commune des e-mails KoliGo.
 *
 * Mise en page en tableaux et styles en ligne : c'est la seule qui s'affiche partout (Gmail, Outlook, applications mobiles).
 * Chaque message part aussi en version texte (multipart/alternative) : un message HTML seul est un signal de spam pour les
 * messageries, et certains lecteurs n'affichent que le texte.
 */
final class MailTemplate
{
    private const GREEN = '#178A3C';
    private const GREEN_SOFT = '#EAF6EC';
    private const DARK = '#0E2116';
    private const PAGE = '#F4F1E8';
    private const MUTED = '#5E6B62';
    private const ORANGE = '#C4611A';
    private const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    private static function e(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /** Paragraphe de texte simple (echappe). */
    public static function paragraph(string $text): string
    {
        return '<p style="margin:0 0 16px;font:400 16px/1.6 ' . self::FONT . ';color:' . self::DARK . ';">' . self::e($text) . '</p>';
    }

    /** Code de verification mis en avant. */
    public static function code(string $code): string
    {
        return '<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:8px auto 24px;"><tr>'
            . '<td style="background:' . self::GREEN_SOFT . ';border:2px solid ' . self::GREEN . ';border-radius:14px;padding:16px 28px;'
            . "font:800 40px/1 'Courier New',Courier,monospace;letter-spacing:12px;text-indent:12px;color:" . self::DARK . ';text-align:center;">'
            . self::e($code) . '</td></tr></table>';
    }

    /** Note discrete sous le contenu. */
    public static function note(string $text): string
    {
        return '<p style="margin:0 0 8px;font:400 13px/1.6 ' . self::FONT . ';color:' . self::MUTED . ';">' . self::e($text) . '</p>';
    }

    public static function button(string $url, string $label): string
    {
        return '<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:8px auto 24px;"><tr>'
            . '<td style="background:' . self::GREEN . ';border-radius:12px;"><a href="' . self::e($url) . '" style="display:inline-block;padding:14px 28px;'
            . 'font:700 16px ' . self::FONT . ';color:#ffffff;text-decoration:none;">' . self::e($label) . '</a></td></tr></table>';
    }

    /**
     * Page complete. $contentHtml est un fragment HTML deja sur (paragraph(), code(), note(), ou du HTML maitrise).
     * $preheader : l'apercu affiche par la messagerie a cote de l'objet.
     */
    public static function wrap(string $title, string $contentHtml, ?string $preheader = null): string
    {
        $pre = $preheader !== null && $preheader !== ''
            ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">' . self::e($preheader) . str_repeat('&nbsp;&zwnj;', 30) . '</div>'
            : '';
        $stripe = '';
        foreach (['#C4611A', '#178A3C', '#E8B923', '#7BD389'] as $c) {
            $stripe .= '<td width="25%" height="5" style="background:' . $c . ';font-size:0;line-height:0;">&nbsp;</td>';
        }
        $F = self::FONT;
        return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>' . self::e($title) . '</title></head>'
            . '<body style="margin:0;padding:0;background:' . self::PAGE . ';">' . $pre
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' . self::PAGE . ';"><tr><td align="center" style="padding:24px 12px;">'
            . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">'
            // En-tete
            . '<tr><td style="background:' . self::DARK . ';border-radius:16px 16px 0 0;padding:26px 32px;">'
            . '<div style="font:800 30px/1 ' . $F . ';color:#ffffff;letter-spacing:-0.5px;">Koli<span style="color:#7BD389;">Go</span></div>'
            . '<div style="font:400 13px/1.4 ' . $F . ';color:#A9BDB0;margin-top:6px;">La livraison collaborative au Cameroun</div></td></tr>'
            . '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' . $stripe . '</tr></table></td></tr>'
            // Contenu
            . '<tr><td style="background:#ffffff;padding:32px 32px 16px;">'
            . '<h1 style="margin:0 0 20px;font:800 24px/1.25 ' . $F . ';color:' . self::DARK . ';">' . self::e($title) . '</h1>'
            . $contentHtml . '</td></tr>'
            // Pied
            . '<tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:8px 32px 28px;">'
            . '<div style="border-top:1px solid #E5E7E0;padding-top:16px;font:400 12px/1.6 ' . $F . ';color:' . self::MUTED . ';">'
            . 'Ce message est automatique, merci de ne pas y répondre.<br>KoliGo · Douala, Cameroun</div></td></tr>'
            . '</table></td></tr></table></body></html>';
    }

    /** Version texte du message : meme contenu, sans mise en forme. */
    public static function plainText(string $title, string $contentHtml): string
    {
        $t = preg_replace('#</(p|div|tr|h1)>|<br\s*/?>#i', "\n", $contentHtml) ?? $contentHtml;
        $t = preg_replace('#</td>#i', ' ', $t) ?? $t;
        $t = html_entity_decode(strip_tags($t), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $t = preg_replace("/[ \t]+/", ' ', $t) ?? $t;
        $t = trim(preg_replace("/\n{3,}/", "\n\n", preg_replace("/ *\n */", "\n", $t) ?? $t) ?? $t);
        return "KoliGo — $title\n\n$t\n\n--\nCe message est automatique, merci de ne pas y répondre.\nKoliGo · Douala, Cameroun\n";
    }

    /**
     * Corps multipart/alternative (texte + HTML, en base64).
     *
     * @return array{0:string,1:string} [valeur de l'en-tete Content-Type, corps]
     */
    public static function multipart(string $html, string $text): array
    {
        $b = 'kg' . bin2hex(random_bytes(12));
        $part = static fn(string $type, string $content): string => "--$b\r\nContent-Type: $type; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($content), 76, "\r\n");
        return ["multipart/alternative; boundary=\"$b\"", $part('text/plain', $text) . $part('text/html', $html) . "--$b--\r\n"];
    }
}
