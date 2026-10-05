<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Ctx;
use Koligo\Db;
use Koligo\Http;
use Koligo\HttpError;
use Koligo\Services\Deliveries;
use Koligo\Services\Payments;
use Koligo\Services\Sungku;

final class PaymentController
{
    /**
     * POST /payments/webhook/sungku — statut final d'un paiement.
     * Pas de JWT : l'appel est authentifie par signature HMAC sur le corps brut.
     */
    public static function webhook(Ctx $c): array
    {
        $raw = Http::rawBody();
        $ok = Sungku::verifySignature(
            $raw,
            Http::header('X-Apisungku-Timestamp'),
            Http::header('X-Apisungku-Signature')
        );
        if (!$ok) {
            // Trace utile au diagnostic (aucun secret, aucune signature n'est journalisee).
            error_log(sprintf('[payment] webhook REFUSE signature invalide : timestamp=%s signature=%s taille=%d',
                Http::header('X-Apisungku-Timestamp') ? 'oui' : 'absent', Http::header('X-Apisungku-Signature') ? 'oui' : 'absent', strlen($raw)));
            throw new HttpError('Invalid signature', 401);
        }
        error_log('[payment] webhook recu et authentifie : ' . substr($raw, 0, 400));
        $payload = json_decode($raw, true);
        try {
            if (is_array($payload)) {
                Payments::handleWebhook($payload);
            }
        } catch (\Throwable $e) {
            // Jamais de 5xx apres authentification : Sungku rejouerait en boucle un evenement deja recu.
            // L'erreur est tracee et les transitions etant idempotentes, un rejeu manuel reste sur.
            error_log('[payment] webhook sungku : ' . $e->getMessage());
        }
        return ['ok' => true];
    }

    /** POST /payment/cashout — le vendeur regle lui-meme une livraison. */
    public static function cashout(Ctx $c): array
    {
        $deliveryId = (string)$c->input('deliveryId', '');
        $phone = (string)$c->input('phone', '');
        if ($deliveryId === '' || $phone === '') {
            throw new HttpError('deliveryId et phone requis');
        }
        $d = Deliveries::find($deliveryId);
        if ($d['vendorId'] !== $c->user['userId']) {
            throw new HttpError('Forbidden', 403);
        }
        // Le montant est celui de la base ; un champ "amount" du client est ignore.
        $r = Payments::startDeliveryPayment($d, $phone);
        return ['transactionId' => $r['transactionId'], 'extRef' => $r['extRef'], 'status' => $r['status'] ?? 'PENDING'];
    }

    /** GET /payment/verify/:ref — etat local (alimente par le webhook). */
    public static function verify(Ctx $c): array
    {
        $ref = $c->param('id');
        foreach (['DeliveryPayment', 'TopUp', 'Withdrawal'] as $table) {
            $row = Db::one("SELECT status, amountXAF, paymentId, externalRef FROM `$table` WHERE externalRef = ? OR paymentId = ? LIMIT 1", [$ref, $ref]);
            if ($row) {
                return ['transactionId' => $row['paymentId'] ?: $row['externalRef'], 'status' => $row['status'], 'amount' => (int)$row['amountXAF']];
            }
        }
        throw new HttpError('Transaction introuvable', 404);
    }

    public static function successPage(): never
    {
        Http::html('<h2 style="font-family:sans-serif;color:#178A3C;">✅ Paiement confirmé. Revenez dans l\'application KoliGo.</h2>');
    }

    public static function cancelPage(): never
    {
        Http::html('<h2 style="font-family:sans-serif;color:#E8551C;">❌ Paiement annulé. Revenez dans l\'application KoliGo.</h2>');
    }
}
