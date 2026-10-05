<?php
declare(strict_types=1);

namespace Koligo\Controllers;

use Koligo\Auth;
use Koligo\Ctx;
use Koligo\Db;
use Koligo\HttpError;
use Koligo\RateLimit;
use Koligo\Rel;
use Koligo\Services\Deliveries;
use Koligo\Services\Invoices;
use Koligo\Services\Payments;

final class DeliveryController
{
    public static function create(Ctx $c): array
    {
        $b = $c->body();
        $p = [
            'pickupAddress' => trim((string)($b['pickupAddress'] ?? $b['fromQuartier'] ?? $b['from'] ?? '')),
            'dropoffAddress' => trim((string)($b['dropoffAddress'] ?? $b['toQuartier'] ?? $b['to'] ?? '')),
            'weightKg' => $b['weightKg'] ?? $b['weight'] ?? 1,
            'description' => $b['description'] ?? $b['parcelDesc'] ?? null,
            'delivererType' => $b['delivererType'] ?? $b['courierType'] ?? 'TEMPORAIRE',
            'distanceKm' => $b['distanceKm'] ?? $b['distance'] ?? 2,
            'shopName' => $b['shopName'] ?? null,
            'recipientName' => $b['recipientName'] ?? null,
            'recipientPhone' => $b['recipientPhone'] ?? null,
            'productPriceXAF' => $b['productPrice'] ?? $b['productPriceXAF'] ?? 0,
        ];
        if ($p['pickupAddress'] === '' || $p['dropoffAddress'] === '') {
            throw new HttpError('fromQuartier et toQuartier requis');
        }
        return Deliveries::create($c->user['userId'], $p);
    }

    public static function list(Ctx $c): array
    {
        $uid = $c->user['userId'];
        $page = max(1, (int)($_GET['page'] ?? 1));
        $where = '(vendorId = ? OR delivererId = ?)';
        $args = [$uid, $uid];
        if (!empty($_GET['status']) && is_string($_GET['status'])) {
            $where .= ' AND status = ?';
            $args[] = $_GET['status'];
        }
        $rows = Db::all("SELECT * FROM `Delivery` WHERE $where ORDER BY createdAt DESC LIMIT 20 OFFSET " . (($page - 1) * 20), $args);
        $rows = Rel::user($rows, 'vendorId', 'vendor', ['name']);
        return Rel::user($rows, 'delivererId', 'deliverer', ['name', 'phone']);
    }

    public static function listAvailable(Ctx $c): array
    {
        $rows = Db::all("SELECT * FROM `Delivery` WHERE status = 'EN_ATTENTE' AND delivererId IS NULL ORDER BY createdAt DESC LIMIT 20");
        return Rel::user($rows, 'vendorId', 'vendor', ['name']);
    }

    /** Une livraison n'est lisible que par ses parties ; l'admin voit tout. */
    public static function getById(Ctx $c): array
    {
        $d = Deliveries::find($c->param('id'));
        self::assertParty($c, $d);
        return $d;
    }

    public static function accept(Ctx $c): array
    {
        return Deliveries::accept($c->param('id'), $c->user['userId']);
    }

    public static function cancel(Ctx $c): array
    {
        return Deliveries::cancel($c->param('id'), $c->user['userId']);
    }

    public static function confirmCollect(Ctx $c): array
    {
        return Deliveries::confirmCollect($c->param('id'), $c->user['userId'], (string)$c->input('collectCode', ''));
    }

    public static function confirmDeliver(Ctx $c): array
    {
        return Deliveries::confirmDeliver($c->param('id'), $c->user['userId'], (string)$c->input('deliverCode', ''), $c->input('momoRef'));
    }

    // ── GPS (table GpsLocation : pas de Redis sur l'hebergement) ─────────────

    public static function postLocation(Ctx $c): array
    {
        $d = Deliveries::find($c->param('id'));
        if ($d['delivererId'] !== $c->user['userId']) {
            throw new HttpError('Forbidden', 403);
        }
        $lat = $c->input('latitude');
        $lng = $c->input('longitude');
        if (!is_numeric($lat) || !is_numeric($lng) || abs((float)$lat) > 90 || abs((float)$lng) > 180) {
            throw new HttpError('Coordonnees invalides');
        }
        Db::insert('GpsLocation', ['id' => Db::id(), 'deliveryId' => $d['id'], 'latitude' => (float)$lat, 'longitude' => (float)$lng, 'createdAt' => Db::now()]);
        // Purge : l'historique n'est utile que pour l'admin, on borne sa taille.
        Db::exec('DELETE FROM `GpsLocation` WHERE deliveryId = ? AND createdAt < ?', [$d['id'], gmdate('Y-m-d H:i:s', time() - 86400)]);
        return ['ok' => true];
    }

    /** Derniere position, ou null si elle date de plus de 30 s (comme l'ancien cache Redis). */
    public static function getLocation(Ctx $c): ?array
    {
        $d = Deliveries::find($c->param('id'));
        self::assertParty($c, $d);
        $row = Db::one(
            'SELECT latitude, longitude, createdAt FROM `GpsLocation` WHERE deliveryId = ? AND createdAt > ? ORDER BY createdAt DESC LIMIT 1',
            [$d['id'], gmdate('Y-m-d H:i:s', time() - 30)]
        );
        return $row ? ['lat' => $row['latitude'], 'lng' => $row['longitude'], 'ts' => strtotime($row['createdAt'] . ' UTC') * 1000] : null;
    }

    // ── Suivi / actions du destinataire (sans compte) ────────────────────────

    /** Resout un clientToken (JWT) ou un id brut vers une livraison. */
    public static function fromClientToken(string $token): array
    {
        try {
            $payload = Auth::verifyAccess($token);
        } catch (\Throwable) {
            throw new HttpError('Lien de suivi invalide ou expiré');
        }
        return Deliveries::find((string)($payload['deliveryId'] ?? ''));
    }

    /**
     * GET /deliveries/by-ref/:ref — le destinataire (sans compte) retrouve son colis
     * avec la Ref affichee au vendeur (8 derniers caracteres de l'identifiant).
     * Ne renvoie jamais les codes de collecte / reception ni de numero de telephone.
     */
    public static function byRef(Ctx $c): array
    {
        // Seules les Ref inconnues comptent : une Ref valide ne consomme rien, donc le suivi
        // n'est jamais bloque, alors que deviner des Ref l'est vite.
        $bucket = 'ref:ip:' . RateLimit::ip();
        RateLimit::assertBelow($bucket, 20);
        $ref = strtolower(preg_replace('/[^A-Za-z0-9]/', '', $c->param('ref')) ?? '');
        if (strlen($ref) < 6 || strlen($ref) > 25) {
            RateLimit::hit($bucket, 20, 600);
            throw new HttpError('Référence invalide');
        }
        $rows = Db::all('SELECT * FROM `Delivery` WHERE id LIKE ? ORDER BY createdAt DESC LIMIT 2', ['%' . $ref]);
        if (count($rows) !== 1) {
            RateLimit::hit($bucket, 20, 600);
            throw new HttpError('Référence introuvable. Vérifiez-la auprès du vendeur.', 404);
        }
        return self::publicView($rows[0]);
    }

    /** GET /deliveries/:id/public — rafraichissement du suivi par identifiant (non devinable, sans limite). */
    public static function publicById(Ctx $c): array
    {
        return self::publicView(Deliveries::find($c->param('id')));
    }

    /** Vue publique d'une livraison, pour la page / l'ecran de suivi du destinataire. */
    public static function publicView(array $d): array
    {
        $dl = $d['delivererId'] ? Db::one('SELECT name, quartier FROM `User` WHERE id = ?', [$d['delivererId']]) : null;
        $out = array_intersect_key($d, array_flip([
            'id', 'status', 'pickupAddress', 'dropoffAddress', 'description', 'shopName',
            'recipientName', 'priceXAF', 'productPriceXAF', 'weightKg', 'distanceKm', 'createdAt',
        ]));
        return $out + ['ref' => strtoupper(substr($d['id'], -8)), 'deliverer' => $dl];
    }

    /** GET /deliveries/:id/invoice/:type — facture de vente / paiement (vendeur) ou de livraison (livreur). */
    public static function invoice(Ctx $c): array
    {
        $type = $c->param('type');
        $role = $c->user['activeRole'];
        if (!Invoices::allowedFor($type, $role)) {
            throw new HttpError('Accès refusé', 403);
        }
        $d = Deliveries::find($c->param('id'));
        $uid = $c->user['userId'];
        if (($role === 'VENDOR' && $d['vendorId'] !== $uid) || ($role === 'DELIVERER' && $d['delivererId'] !== $uid)) {
            throw new HttpError('Accès refusé', 403);
        }
        return Invoices::build($d['id'], $type);
    }

    /** GET /deliveries/:id/public-invoice — facture de paiement du destinataire (sans compte, par identifiant). */
    public static function publicInvoice(Ctx $c): array
    {
        $inv = Invoices::build($c->param('id'), 'payment');
        // Public : aucun numero de telephone des autres parties (la forme issuer / billedTo les porte).
        foreach (['issuer', 'billedTo'] as $k) {
            if (isset($inv[$k]['phone'])) {
                $inv[$k]['phone'] = null;
            }
        }
        return $inv;
    }

    /** GET /deliveries/:id/public-location — position du livreur, seulement pendant la course. */
    public static function publicLocation(Ctx $c): ?array
    {
        $d = Deliveries::find($c->param('id'));
        if (!in_array($d['status'], ['ACCEPTE', 'EN_ROUTE'], true)) {
            return null;
        }
        $row = Db::one(
            'SELECT latitude, longitude, createdAt FROM `GpsLocation` WHERE deliveryId = ? AND createdAt > ? ORDER BY createdAt DESC LIMIT 1',
            [$d['id'], gmdate('Y-m-d H:i:s', time() - 120)]
        );
        return $row ? ['lat' => $row['latitude'], 'lng' => $row['longitude'], 'ts' => strtotime($row['createdAt'] . ' UTC') * 1000] : null;
    }

    public static function trackByClientToken(Ctx $c): array
    {
        $d = self::fromClientToken($c->param('clientToken'));
        $out = array_intersect_key($d, array_flip(['id', 'status', 'pickupAddress', 'dropoffAddress', 'deliverCode', 'priceXAF', 'productPriceXAF', 'shopName', 'recipientName']));
        $dl = $d['delivererId'] ? Db::one('SELECT name, phone, cniNumber, quartier FROM `User` WHERE id = ?', [$d['delivererId']]) : null;
        return $out + ['deliverer' => $dl];
    }

    public static function trustInvoice(Ctx $c): array
    {
        $d = Deliveries::find($c->param('id'));
        if ($d['vendorId'] !== $c->user['userId']) {
            throw new HttpError('Forbidden');
        }
        $dl = $d['delivererId'] ? Db::one('SELECT id, name, phone, cniNumber, quartier, kycStatus FROM `User` WHERE id = ?', [$d['delivererId']]) : null;
        if (!$dl) {
            throw new HttpError("Aucun livreur assigné pour l'instant");
        }
        return [
            'deliveryId' => $d['id'], 'pickupAddress' => $d['pickupAddress'], 'dropoffAddress' => $d['dropoffAddress'],
            'priceXAF' => $d['priceXAF'], 'status' => $d['status'],
            'recipientName' => $d['recipientName'], 'recipientPhone' => $d['recipientPhone'], 'recipientAddress' => $d['dropoffAddress'],
            'deliverer' => [
                'id' => $dl['id'], 'name' => $dl['name'], 'phone' => $dl['phone'],
                'cniNumber' => $dl['cniNumber'] ?? 'Non renseigné', 'quartier' => $dl['quartier'] ?? 'Non renseigné',
                'kycStatus' => $dl['kycStatus'] ?? 'NONE',
            ],
        ];
    }

    private static function validMomo(string $raw): string
    {
        $phone = preg_replace('/\s/', '', $raw) ?? '';
        if (!preg_match('/^6\d{8}$/', $phone)) {
            throw new HttpError('Numéro MoMo invalide (format: 6XXXXXXXX)');
        }
        return $phone;
    }

    /** POST /deliveries/client-pay */
    public static function clientPay(Ctx $c): array
    {
        $token = (string)$c->input('clientToken', '');
        $code = (string)$c->input('deliverCode', '');
        $momo = (string)$c->input('momoPhone', '');
        if ($token === '' || $code === '' || $momo === '') {
            throw new HttpError('clientToken, deliverCode et momoPhone requis');
        }
        $phone = self::validMomo($momo);
        $d = self::fromClientToken($token);
        return self::pay($d, $code, $phone);
    }

    /** POST /deliveries/:id/client-confirm */
    public static function clientConfirm(Ctx $c): array
    {
        $code = (string)$c->input('code', '');
        if ($code === '') {
            throw new HttpError('code requis');
        }
        $d = Deliveries::find($c->param('id'));
        $phone = preg_replace('/\s/', '', (string)($c->input('momoPhone') ?: $c->input('paymentNumber', ''))) ?? '';

        if (Payments::mock()) {
            if (!hash_equals((string)$d['deliverCode'], $code)) {
                throw new HttpError('Code de réception invalide');
            }
            if ($d['status'] !== 'EN_ROUTE') {
                throw new HttpError('Statut incorrect: ' . $d['status']);
            }
            Deliveries::confirmDeliverByPayment($d['id'], 'MOCK-CLIENT-' . time());
            return [
                'ok' => true, 'delivererName' => null, 'delivererId' => $d['delivererId'],
                'vendorName' => $d['shopName'], 'parcelDesc' => $d['description'],
                'productPrice' => $d['productPriceXAF'], 'price' => $d['priceXAF'],
            ];
        }
        if ($phone === '') {
            throw new HttpError('Numéro de paiement MoMo requis');
        }
        $res = self::pay($d, $code, self::validMomo($phone));
        return ['ok' => true, 'transactionId' => $res['transactionId'], 'pending' => true] + (isset($res['message']) ? ['message' => $res['message']] : []);
    }

    /** Verifie le code de reception puis lance le depot mobile money. */
    private static function pay(array $d, string $code, string $phone): array
    {
        if (!hash_equals((string)$d['deliverCode'], $code)) {
            throw new HttpError('Code de réception invalide');
        }
        if ($d['status'] !== 'EN_ROUTE') {
            throw new HttpError("La livraison ne peut pas être payée en statut {$d['status']}");
        }
        return Payments::startDeliveryPayment($d, $phone);
    }

    /**
     * GET /deliveries/client-payment-status?transactionId=&clientToken=
     * Lit l'etat local, alimente par le webhook : la passerelle n'est pas interrogee.
     */
    public static function clientPaymentStatus(Ctx $c): array
    {
        $tx = (string)($_GET['transactionId'] ?? '');
        $token = (string)($_GET['clientToken'] ?? '');
        if ($tx === '' || $token === '') {
            throw new HttpError('transactionId et clientToken requis');
        }
        $d = self::fromClientToken($token);

        if (Payments::mock() && str_starts_with($tx, 'MOCK-')) {
            // Mode test : auto-confirme apres 5 s, comme avant.
            $created = Db::val('SELECT createdAt FROM `DeliveryPayment` WHERE deliveryId = ? ORDER BY createdAt DESC LIMIT 1', [$d['id']]);
            $age = $created ? time() - strtotime($created . ' UTC') : PHP_INT_MAX;
            if ($age > 5 || !$created) {
                try {
                    Deliveries::confirmDeliverByPayment($d['id'], $tx);
                } catch (\Throwable) {
                }
                return self::paymentResult(Deliveries::find($d['id']), true);
            }
            return ['status' => 'pending', 'mock' => true];
        }

        $p = Db::one('SELECT * FROM `DeliveryPayment` WHERE deliveryId = ? AND (externalRef = ? OR paymentId = ?) LIMIT 1', [$d['id'], $tx, $tx]);
        if ($p && $p['status'] === 'SUCCESS') {
            return self::paymentResult(Deliveries::find($d['id']), false, (int)$p['amountXAF']);
        }
        return ['status' => $p && $p['status'] === 'FAILED' ? 'failed' : 'pending'];
    }

    private static function paymentResult(array $d, bool $mock, ?int $amount = null): array
    {
        $d = Rel::user([$d], 'delivererId', 'deliverer', ['name', 'phone'])[0];
        $d = Rel::user([$d], 'vendorId', 'vendor', ['name'])[0];
        return ['status' => 'success', 'amount' => $amount ?? (int)$d['priceXAF'], 'delivery' => $d] + ($mock ? ['mock' => true] : []);
    }

    public static function clientRate(Ctx $c): array
    {
        $score = $c->input('score');
        if (!$c->input('clientToken') || !$score) {
            throw new HttpError('clientToken et score requis');
        }
        $d = self::fromClientToken((string)$c->input('clientToken'));
        if (!$d['delivererId']) {
            throw new HttpError('Aucun livreur assigné');
        }
        if ($d['status'] !== 'LIVRE') {
            throw new HttpError("La livraison n'est pas encore terminée");
        }
        if (Db::one('SELECT id FROM `Rating` WHERE deliveryId = ? AND fromUserId = ?', [$d['id'], $d['vendorId']])) {
            return ['ok' => true, 'alreadyRated' => true];
        }
        $tags = $c->input('tags');
        Db::insert('Rating', [
            'id' => Db::id(), 'deliveryId' => $d['id'], 'fromUserId' => $d['vendorId'], 'toUserId' => $d['delivererId'],
            'score' => min(5, max(1, (int)$score)), 'tags' => $tags ? json_encode($tags) : null,
            'comment' => $c->input('comment'), 'createdAt' => Db::now(),
        ]);
        return ['ok' => true];
    }

    public static function clientReport(Ctx $c): array
    {
        if (!$c->input('clientToken') || !$c->input('type')) {
            throw new HttpError('clientToken et type requis');
        }
        $d = self::fromClientToken((string)$c->input('clientToken'));
        Db::insert('Issue', [
            'id' => Db::id(), 'deliveryId' => $d['id'], 'userId' => $d['vendorId'],
            'type' => (string)$c->input('type'), 'description' => $c->input('description'), 'createdAt' => Db::now(),
        ]);
        return ['ok' => true];
    }

    // ── Messagerie ───────────────────────────────────────────────────────────

    public static function listMessagesPublic(Ctx $c): array
    {
        return Db::all('SELECT id, senderName, senderRole, content, createdAt FROM `Message` WHERE deliveryId = ? ORDER BY createdAt ASC', [$c->param('id')]);
    }

    public static function listMessages(Ctx $c): array
    {
        $d = Deliveries::find($c->param('id'));
        $uid = $c->user['userId'];
        if ($d['vendorId'] !== $uid && $d['delivererId'] !== $uid) {
            throw new HttpError('Accès refusé');
        }
        return Db::all('SELECT id, senderId, senderName, senderRole, content, createdAt FROM `Message` WHERE deliveryId = ? ORDER BY createdAt ASC', [$d['id']]);
    }

    public static function sendMessage(Ctx $c): array
    {
        $content = trim((string)$c->input('content', ''));
        if ($content === '') {
            throw new HttpError('Message vide');
        }
        $d = Deliveries::find($c->param('id'));
        $uid = $c->user['userId'];
        $isVendor = $d['vendorId'] === $uid;
        if (!$isVendor && $d['delivererId'] !== $uid) {
            throw new HttpError('Accès refusé');
        }
        $name = Db::val('SELECT name FROM `User` WHERE id = ?', [$uid]) ?: ($isVendor ? 'Vendeur' : 'Livreur');
        return self::addMessage($d['id'], $uid, (string)$name, $isVendor ? 'vendor' : 'deliverer', $content);
    }

    public static function sendRecipientMessage(Ctx $c): array
    {
        $content = trim((string)$c->input('content', ''));
        if ($content === '') {
            throw new HttpError('Message vide');
        }
        $d = Deliveries::find($c->param('id'));
        if (in_array($d['status'], ['EN_ATTENTE', 'ANNULE'], true)) {
            throw new HttpError("La livraison n'est pas encore en cours");
        }
        $name = trim((string)$c->input('recipientName', '')) ?: ($d['recipientName'] ?: 'Destinataire');
        return self::addMessage($d['id'], null, $name, 'recipient', $content);
    }

    private static function addMessage(string $deliveryId, ?string $senderId, string $name, string $role, string $content): array
    {
        $id = Db::id();
        Db::insert('Message', [
            'id' => $id, 'deliveryId' => $deliveryId, 'senderId' => $senderId, 'senderName' => $name,
            'senderRole' => $role, 'content' => mb_substr($content, 0, 1000), 'createdAt' => Db::now(),
        ]);
        return Db::one('SELECT id, senderId, senderName, senderRole, content, createdAt FROM `Message` WHERE id = ?', [$id]);
    }

    private static function assertParty(Ctx $c, array $d): void
    {
        $uid = $c->user['userId'];
        if ($d['vendorId'] === $uid || $d['delivererId'] === $uid || $c->user['activeRole'] === 'ADMIN') {
            return;
        }
        // Un livreur peut consulter une offre ouverte avant de l'accepter.
        if ($c->user['activeRole'] === 'DELIVERER' && $d['status'] === 'EN_ATTENTE') {
            return;
        }
        throw new HttpError('Accès refusé', 403);
    }
}
