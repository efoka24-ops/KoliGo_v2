<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Ctx;
use Koligo\Db;
use Koligo\Env;
use Koligo\HttpError;
use Koligo\Services\Payments;
use Koligo\Services\Sungku;

final class WalletController
{
    private static function wallet(string $userId): array
    {
        $w = Db::one('SELECT * FROM `Wallet` WHERE userId = ?', [$userId]);
        if (!$w) {
            throw new HttpError('Portefeuille introuvable', 404);
        }
        return $w;
    }

    private static function tx(array $t): array
    {
        return [
            'id' => $t['id'], 'type' => $t['type'],
            'amount' => $t['type'] === 'WITHDRAWAL' ? -$t['amountXAF'] : $t['amountXAF'],
            'label' => $t['description'] ?? $t['type'], 'reference' => $t['id'], 'createdAt' => $t['createdAt'],
        ];
    }

    private static function recent(string $walletId): array
    {
        return array_map([self::class, 'tx'], Db::all('SELECT * FROM `Transaction` WHERE walletId = ? ORDER BY createdAt DESC LIMIT 30', [$walletId]));
    }

    public static function balance(Ctx $c): array
    {
        $w = self::wallet($c->user['userId']);
        return [
            'balance' => (int)$w['balanceXAF'], 'paymentProvider' => $w['paymentProvider'], 'paymentPhone' => $w['paymentPhone'],
            'transactions' => self::recent($w['id']),
        ];
    }

    public static function transactions(Ctx $c): array
    {
        return self::recent(self::wallet($c->user['userId'])['id']);
    }

    /** Rechargement : le solde n'est credite qu'a la reception du webhook confirme. */
    public static function topUp(Ctx $c): array
    {
        $amount = $c->input('amount') ?? $c->input('amountXAF');
        $phone = trim((string)($c->input('phone') ?? $c->input('phoneNumber', '')));
        if (!is_numeric($amount) || (float)$amount < 100) {
            throw new HttpError('Montant minimum 100 XAF');
        }
        if ($phone === '') {
            throw new HttpError('Numero de telephone requis');
        }
        if ((float)$amount > 2_000_000) {
            throw new HttpError('Montant maximum 2 000 000 XAF');
        }
        return Payments::startTopUp(self::wallet($c->user['userId']), (int)round((float)$amount), $phone);
    }

    public static function withdraw(Ctx $c): array
    {
        $amount = $c->input('amount') ?? $c->input('amountXAF');
        $provider = (string)$c->input('provider', '');
        $phone = trim((string)($c->input('phone') ?? $c->input('phoneNumber', '')));
        if (!is_numeric($amount) || (float)$amount < 500) {
            throw new HttpError('Montant minimum 500 XAF');
        }
        $amount = (int)round((float)$amount);
        if (!in_array($provider, ['MTN', 'ORANGE'], true)) {
            throw new HttpError('Operateur invalide');
        }
        if ($phone === '') {
            throw new HttpError('Numero de telephone requis');
        }
        $w = self::wallet($c->user['userId']);
        $ref = Sungku::reference('WITHDRAW', $w['id']);
        $wid = Db::id();

        // Debit atomique et conditionnel : deux retraits simultanes ne peuvent
        // pas tous deux passer le controle de solde.
        Db::tx(function () use ($w, $amount, $provider, $phone, $ref, $wid) {
            $now = Db::now();
            $ok = Db::exec('UPDATE `Wallet` SET balanceXAF = balanceXAF - ?, updatedAt = ? WHERE id = ? AND balanceXAF >= ?', [$amount, $now, $w['id'], $amount]);
            if ($ok !== 1) {
                throw new HttpError('Solde insuffisant');
            }
            Db::insert('Withdrawal', ['id' => $wid, 'walletId' => $w['id'], 'amountXAF' => $amount, 'provider' => $provider, 'phone' => $phone, 'externalRef' => $ref, 'createdAt' => $now]);
            Db::insert('Transaction', ['id' => Db::id(), 'walletId' => $w['id'], 'type' => 'WITHDRAWAL', 'amountXAF' => $amount, 'description' => "Retrait $provider", 'createdAt' => $now]);
        });

        // Sungku ne documente que les depots : le versement reste PENDING et est
        // regle par un administrateur (PATCH /admin/withdrawals/:id/pay).
        return ['ok' => true, 'withdrawalId' => $wid, 'status' => 'PENDING'];
    }

    // ── Notes et incidents ───────────────────────────────────────────────────

    public static function postRating(Ctx $c): array
    {
        $deliveryId = (string)$c->input('deliveryId', '');
        $score = (int)$c->input('score', 0);
        if ($score < 1 || $score > 5) {
            throw new HttpError('Note invalide (1 a 5)');
        }
        $d = Db::one('SELECT * FROM `Delivery` WHERE id = ?', [$deliveryId]);
        if (!$d) {
            throw new HttpError('Livraison introuvable', 404);
        }
        $uid = $c->user['userId'];
        if ($d['vendorId'] !== $uid && $d['delivererId'] !== $uid) {
            throw new HttpError('Accès refusé', 403);
        }
        $to = $d['vendorId'] === $uid ? $d['delivererId'] : $d['vendorId'];
        if (!$to) {
            throw new HttpError('Aucun livreur assigné');
        }
        $id = Db::id();
        Db::insert('Rating', [
            'id' => $id, 'deliveryId' => $deliveryId, 'fromUserId' => $uid, 'toUserId' => $to, 'score' => $score,
            'tags' => json_encode($c->input('tags', [])), 'comment' => $c->input('comment'), 'createdAt' => Db::now(),
        ]);
        http_response_code(201);
        return Db::one('SELECT * FROM `Rating` WHERE id = ?', [$id]);
    }

    /** POST /issues — signalement d'un probleme sur une livraison. */
    public static function postIssue(Ctx $c): array
    {
        $deliveryId = (string)($_POST['deliveryId'] ?? $c->input('deliveryId', ''));
        $type = (string)($_POST['type'] ?? $c->input('type', ''));
        $desc = $_POST['description'] ?? $c->input('description');
        if ($deliveryId === '' || $type === '') {
            // Contrat historique : l'ancienne route repondait 201 sans rien enregistrer.
            http_response_code(201);
            return ['ok' => true];
        }
        $d = Db::one('SELECT vendorId, delivererId FROM `Delivery` WHERE id = ?', [$deliveryId]);
        $uid = $c->user['userId'];
        if (!$d || ($d['vendorId'] !== $uid && $d['delivererId'] !== $uid)) {
            throw new HttpError('Accès refusé', 403);
        }
        Db::insert('Issue', ['id' => Db::id(), 'deliveryId' => $deliveryId, 'userId' => $uid, 'type' => $type, 'description' => $desc, 'createdAt' => Db::now()]);
        http_response_code(201);
        return ['ok' => true];
    }
}
