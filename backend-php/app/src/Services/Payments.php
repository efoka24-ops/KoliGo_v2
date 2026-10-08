<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\Env;
use Koligo\HttpError;

/**
 * Paiements mobile money via Sungku.
 *
 * Regles :
 *  - le montant vient toujours de la base, jamais du client ;
 *  - une ligne PENDING est ecrite AVANT l'appel sortant ;
 *  - un paiement n'est JAMAIS marque reussi a l'initiation : seul le webhook signe confirme ;
 *  - refus clair (SungkuRejected) => FAILED ; doute (SungkuUnavailable) => reste PENDING.
 */
final class Payments
{
    public static function mock(): bool
    {
        return Env::bool('PAYMENT_MOCK');
    }

    /** Recharge de portefeuille. Le solde n'est credite qu'au webhook. */
    public static function startTopUp(array $wallet, int $amount, string $phone): array
    {
        $ref = Sungku::reference('TOPUP', $wallet['id']);
        $id = Db::id();
        $now = Db::now();
        Db::insert('TopUp', [
            'id' => $id, 'walletId' => $wallet['id'], 'amountXAF' => $amount,
            'provider' => $wallet['paymentProvider'], 'phone' => $phone, 'externalRef' => $ref,
            'createdAt' => $now, 'updatedAt' => $now,
        ]);

        $out = self::deposit('TopUp', $id, $ref, $amount, $phone, 'Rechargement KoliGo', ['walletId' => $wallet['id'], 'topUpId' => $id]);
        return ['topUpId' => $id] + $out;
    }

    /** Paiement du transport par le destinataire a la livraison. */
    public static function startDeliveryPayment(array $d, string $phone): array
    {
        // Un paiement deja en cours pour cette livraison est repris tel quel :
        // lancer une 2e demande ferait payer le destinataire deux fois.
        $open = Db::one(
            "SELECT * FROM `DeliveryPayment` WHERE deliveryId = ? AND status = 'PENDING' AND createdAt > ? ORDER BY createdAt DESC LIMIT 1",
            [$d['id'], gmdate('Y-m-d H:i:s', time() - 300)]
        );
        if ($open) {
            return ['transactionId' => $open['paymentId'] ?: $open['externalRef'], 'extRef' => $open['externalRef'], 'status' => 'PENDING', 'amount' => (int)$open['amountXAF'], 'pending' => true];
        }

        $ref = Sungku::reference('DELIV', $d['id']);
        $id = Db::id();
        $now = Db::now();
        Db::insert('DeliveryPayment', [
            'id' => $id, 'deliveryId' => $d['id'], 'amountXAF' => (int)$d['priceXAF'], 'phone' => $phone,
            'externalRef' => $ref, 'createdAt' => $now, 'updatedAt' => $now,
        ]);
        Db::exec('UPDATE `Delivery` SET momoRef = ?, updatedAt = ? WHERE id = ?', [$ref, $now, $d['id']]);

        $desc = 'KoliGo livraison ' . substr($d['id'], -6);
        $out = self::deposit('DeliveryPayment', $id, $ref, (int)$d['priceXAF'], $phone, $desc, ['deliveryId' => $d['id']]);
        return ['transactionId' => $out['paymentId'] ?: $ref, 'extRef' => $ref, 'amount' => (int)$d['priceXAF'], 'pending' => true] + $out;
    }

    /** Appel Sungku + application de la regle prouve/non prouve. */
    private static function deposit(string $table, string $rowId, string $ref, int $amount, string $phone, string $desc, array $meta): array
    {
        if (self::mock()) {
            return ['paymentId' => 'MOCK-' . $ref, 'status' => 'PENDING', 'mock' => true,
                'message' => 'Validez le paiement sur votre telephone.'];
        }
        if (!Sungku::isConfigured()) {
            Db::exec("UPDATE `$table` SET status = 'FAILED', updatedAt = ? WHERE id = ?", [Db::now(), $rowId]);
            throw new HttpError('Passerelle de paiement non configurée');
        }
        try {
            $res = Sungku::initiateDeposit([
                // Le XAF n'a pas de decimales : on envoie un entier.
                'amount' => $amount,
                'currency' => 'XAF',
                'phoneNumber' => Sungku::msisdn($phone),
                'reference' => $ref,
                'description' => Sungku::alnum($desc, 60),
                'customerMessage' => Sungku::customerMessage($desc),
                'metadata' => $meta,
            ]);
        } catch (SungkuRejected $e) {
            Db::exec("UPDATE `$table` SET status = 'FAILED', updatedAt = ? WHERE id = ?", [Db::now(), $rowId]);
            throw new HttpError($e->getMessage());
        } catch (SungkuUnavailable $e) {
            error_log("[payment] $table $rowId ref $ref : " . $e->getMessage());
            // L'argent a peut-etre bouge : on laisse PENDING, le webhook tranchera.
            return ['paymentId' => '', 'status' => 'PENDING', 'unverified' => true,
                'message' => 'Paiement en cours de vérification. Consultez votre historique dans un instant.'];
        }

        $data = $res['data'] ?? $res;
        $paymentId = (string)($data['id'] ?? $data['transactionId'] ?? $data['depositId'] ?? '');
        $status = (string)($data['status'] ?? 'PENDING');
        Db::exec("UPDATE `$table` SET paymentId = ?, updatedAt = ? WHERE id = ?", [$paymentId ?: null, Db::now(), $rowId]);
        if (Sungku::isFailed($status)) {
            Db::exec("UPDATE `$table` SET status = 'FAILED', updatedAt = ? WHERE id = ? AND status = 'PENDING'", [Db::now(), $rowId]);
        }
        // Sans identifiant de paiement, Sungku n'a rien cree que l'on puisse suivre : ne pas promettre une demande sur le telephone.
        if ($paymentId === '') {
            error_log("[payment] $table $rowId ref $ref : reponse Sungku sans identifiant de paiement");
            return ['paymentId' => '', 'status' => 'PENDING', 'unverified' => true,
                'message' => "Réponse inattendue de la passerelle de paiement : aucune demande n'est confirmée. Réessayez ou contactez le support."];
        }
        // Meme si Sungku repond deja "confirme", on attend le webhook signe.
        return ['paymentId' => $paymentId, 'status' => Sungku::isFailed($status) ? 'FAILED' : 'PENDING',
            'message' => 'Validez le paiement sur votre telephone.'];
    }

    /**
     * Traite un webhook deja authentifie. Idempotent : chaque transition est un
     * UPDATE ... WHERE status='PENDING', un rejeu ne trouve plus rien a faire.
     */
    public static function handleWebhook(array $payload): void
    {
        $d = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : $payload;
        $status = (string)($d['status'] ?? '');
        $paymentId = (string)($d['id'] ?? $d['transactionId'] ?? $d['depositId'] ?? '');
        $ref = self::resolveReference($d, $paymentId);
        if ($ref === '') {
            error_log("[payment] webhook sans reference retrouvable (id '$paymentId', statut '$status') — ignore");
            return;
        }

        $settled = Sungku::isSettled($status);
        $failed = Sungku::isFailed($status);
        if (!$settled && !$failed) {
            // Statut non final ou inconnu : on n'invente rien, une personne verifie.
            if (!in_array(strtoupper($status), ['PENDING', 'PROCESSING', 'ACCEPTED', 'SUBMITTED'], true)) {
                error_log("[payment] webhook ref $ref statut inconnu '$status' — a verifier avec Sungku");
            }
            return;
        }

        if (str_starts_with($ref, 'KOLIGO-TOPUP-')) {
            self::settleTopUp($ref, $settled, $paymentId);
        } elseif (str_starts_with($ref, 'KOLIGO-WITHDRAW-')) {
            self::settleWithdrawal($ref, $settled);
        } elseif (str_starts_with($ref, 'KOLIGO-DELIV-')) {
            self::settleDelivery($ref, $settled, $paymentId);
        }
    }

    /**
     * Retrouve notre reference (KOLIGO-...) depuis une confirmation de Sungku. Sungku ne renvoie pas toujours la
     * reference envoyee (client_reference_id peut etre vide) : on retombe alors sur l'identifiant du paiement
     * enregistre a l'initiation, puis sur les metadonnees (topUpId, deliveryId).
     */
    private static function resolveReference(array $d, string $paymentId): string
    {
        foreach (['reference', 'externalReference', 'depositReference', 'client_reference_id', 'clientReferenceId'] as $k) {
            if (!empty($d[$k]) && is_string($d[$k]) && str_starts_with($d[$k], 'KOLIGO-')) {
                return $d[$k];
            }
        }
        if ($paymentId !== '') {
            foreach (['TopUp', 'DeliveryPayment', 'Withdrawal'] as $t) {
                $r = Db::val("SELECT externalRef FROM `$t` WHERE paymentId = ?", [$paymentId]);
                if ($r) {
                    return (string)$r;
                }
            }
        }
        $meta = $d['metadata'] ?? null;
        if (is_string($meta)) {
            $meta = json_decode($meta, true);
        }
        if (is_array($meta)) {
            if (!empty($meta['topUpId'])) {
                $r = Db::val('SELECT externalRef FROM `TopUp` WHERE id = ?', [(string)$meta['topUpId']]);
            } elseif (!empty($meta['deliveryId'])) {
                $r = Db::val("SELECT externalRef FROM `DeliveryPayment` WHERE deliveryId = ? ORDER BY createdAt DESC LIMIT 1", [(string)$meta['deliveryId']]);
            }
            if (!empty($r)) {
                return (string)$r;
            }
        }
        return '';
    }

    /**
     * Interroge Sungku sur un paiement encore en attente (le webhook peut ne jamais arriver) et applique le resultat
     * par le meme chemin que le webhook. Ne change rien si Sungku repond « en attente » ou ne repond pas.
     */
    public static function reconcile(string $table, array $row): void
    {
        if (self::mock() || ($row['status'] ?? '') !== 'PENDING' || empty($row['paymentId'])
            || strtotime(($row['createdAt'] ?? 'now') . ' UTC') > time() - 15) {
            return;
        }
        try {
            $res = Sungku::fetchDeposit((string)$row['paymentId']);
        } catch (\Throwable $e) {
            error_log("[payment] verification $table {$row['id']} : " . $e->getMessage());
            return;
        }
        $data = $res['data'] ?? $res;
        $status = (string)($data['status'] ?? '');
        if (Sungku::isSettled($status) || Sungku::isFailed($status)) {
            self::handleWebhook(['id' => $row['paymentId'], 'status' => $status, 'reference' => $row['externalRef']]);
        }
    }

    private static function settleTopUp(string $ref, bool $settled, string $paymentId): void
    {
        $t = Db::one('SELECT * FROM `TopUp` WHERE externalRef = ?', [$ref]);
        if (!$t || $t['status'] !== 'PENDING') {
            return;
        }
        $now = Db::now();
        if (!$settled) {
            Db::exec("UPDATE `TopUp` SET status = 'FAILED', updatedAt = ? WHERE id = ? AND status = 'PENDING'", [$now, $t['id']]);
            return;
        }
        Db::tx(function () use ($t, $paymentId, $now) {
            $won = Db::exec(
                "UPDATE `TopUp` SET status = 'SUCCESS', paymentId = COALESCE(?, paymentId), updatedAt = ? WHERE id = ? AND status = 'PENDING'",
                [$paymentId ?: null, $now, $t['id']]
            );
            if ($won !== 1) {
                return;
            }
            Db::exec('UPDATE `Wallet` SET balanceXAF = balanceXAF + ?, updatedAt = ? WHERE id = ?', [$t['amountXAF'], $now, $t['walletId']]);
            Db::insert('Transaction', [
                'id' => Db::id(), 'walletId' => $t['walletId'], 'type' => 'TOPUP', 'amountXAF' => $t['amountXAF'],
                'description' => 'Rechargement mobile money', 'createdAt' => $now,
            ]);
        });
    }

    /** Le solde a ete debite a l'initiation : un echec doit le rendre. */
    private static function settleWithdrawal(string $ref, bool $settled): void
    {
        $w = Db::one('SELECT * FROM `Withdrawal` WHERE externalRef = ?', [$ref]);
        if (!$w || $w['status'] !== 'PENDING') {
            return;
        }
        if ($settled) {
            Db::exec("UPDATE `Withdrawal` SET status = 'SUCCESS' WHERE id = ? AND status = 'PENDING'", [$w['id']]);
            return;
        }
        Db::tx(function () use ($w) {
            if (Db::exec("UPDATE `Withdrawal` SET status = 'FAILED' WHERE id = ? AND status = 'PENDING'", [$w['id']]) !== 1) {
                return;
            }
            $now = Db::now();
            Db::exec('UPDATE `Wallet` SET balanceXAF = balanceXAF + ?, updatedAt = ? WHERE id = ?', [$w['amountXAF'], $now, $w['walletId']]);
            Db::insert('Transaction', [
                'id' => Db::id(), 'walletId' => $w['walletId'], 'type' => 'REFUND', 'amountXAF' => $w['amountXAF'],
                'description' => 'Retrait echoue — solde restitue', 'createdAt' => $now,
            ]);
        });
    }

    private static function settleDelivery(string $ref, bool $settled, string $paymentId): void
    {
        $p = Db::one('SELECT * FROM `DeliveryPayment` WHERE externalRef = ?', [$ref]);
        if (!$p || $p['status'] !== 'PENDING') {
            return;
        }
        $now = Db::now();
        if (!$settled) {
            Db::exec("UPDATE `DeliveryPayment` SET status = 'FAILED', updatedAt = ? WHERE id = ? AND status = 'PENDING'", [$now, $p['id']]);
            return;
        }
        $won = Db::exec(
            "UPDATE `DeliveryPayment` SET status = 'SUCCESS', paymentId = COALESCE(?, paymentId), updatedAt = ? WHERE id = ? AND status = 'PENDING'",
            [$paymentId ?: null, $now, $p['id']]
        );
        if ($won !== 1) {
            return;
        }
        $d = Db::one('SELECT status FROM `Delivery` WHERE id = ?', [$p['deliveryId']]);
        if ($d && $d['status'] === 'EN_ROUTE') {
            Deliveries::confirmDeliverByPayment($p['deliveryId'], $ref);
        } else {
            // Argent encaisse alors que la livraison n'est plus EN_ROUTE (annulee ?) : a traiter a la main.
            error_log("[payment] ATTENTION paiement {$p['externalRef']} encaisse pour la livraison {$p['deliveryId']} au statut " . ($d['status'] ?? '?'));
        }
    }
}
