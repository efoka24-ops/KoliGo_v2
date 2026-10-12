<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\HttpError;

/**
 * Incidents de declaration d'un colis (poids, taille, valeur, contenu interdit ou dangereux).
 *
 * Cycle : OPEN -> CONFIRMED (compte dans le compteur du vendeur) | CLEARED (annule par l'administrateur) | EXPIRED.
 * Une correction de gabarit acceptee ou refusee par le vendeur confirme l'incident automatiquement ; un contenu
 * interdit, dangereux ou une valeur incoherente attendent la decision de l'administrateur.
 * Au seuil d'incidents confirmes, le compte vendeur est suspendu (il garde l'acces a son historique et au recours).
 */
final class Incidents
{
    public const KINDS = ['POIDS', 'TAILLE', 'VALEUR', 'INTERDIT', 'DANGEREUX'];

    public const LABELS = [
        'POIDS' => 'poids non conforme',
        'TAILLE' => 'taille non conforme',
        'VALEUR' => 'valeur déclarée incohérente',
        'INTERDIT' => 'contenu interdit',
        'DANGEREUX' => 'contenu dangereux',
    ];

    /** Ouvre un incident ; renvoie son identifiant. */
    public static function open(array $delivery, string $kind, string $comment, ?string $photoPath, ?float $measuredKg = null, ?string $revisionId = null): string
    {
        if (!in_array($kind, self::KINDS, true)) {
            throw new HttpError('Motif invalide', 400, 'INCIDENT_KIND_INVALID');
        }
        $id = Db::id();
        Db::insert('Incident', [
            'id' => $id, 'deliveryId' => $delivery['id'], 'vendorId' => $delivery['vendorId'], 'delivererId' => $delivery['delivererId'] ?? null,
            'revisionId' => $revisionId, 'kind' => $kind, 'comment' => $comment !== '' ? mb_substr($comment, 0, 500) : null,
            'photoPath' => $photoPath, 'measuredWeightKg' => $measuredKg, 'status' => 'OPEN', 'createdAt' => Db::now(),
        ]);
        return $id;
    }

    /** La correction de gabarit liee a l'incident a recu sa reponse : CONFIRMED (vendeur a repondu) ou EXPIRED (sans reponse). */
    public static function resolveRevision(string $revisionId, string $status): void
    {
        $inc = Db::one("SELECT id, vendorId FROM `Incident` WHERE revisionId = ? AND status = 'OPEN'", [$revisionId]);
        if (!$inc) {
            return;
        }
        Db::exec("UPDATE `Incident` SET status = ?, decidedAt = ?, decisionNote = ? WHERE id = ?", [
            $status, Db::now(), $status === 'CONFIRMED' ? 'Réponse du vendeur à la correction' : 'Sans réponse du vendeur', $inc['id'],
        ]);
        if ($status === 'CONFIRMED') {
            self::afterConfirm((string)$inc['vendorId']);
        }
    }

    /** Incidents confirmes du vendeur (sur la fenetre configuree ; 0 = toute la duree de vie du compte). */
    public static function confirmedCount(string $vendorId): int
    {
        $days = Pricing::config()['strikeWindowDays'];
        if ($days > 0) {
            return (int)Db::val("SELECT COUNT(*) FROM `Incident` WHERE vendorId = ? AND status = 'CONFIRMED' AND createdAt >= ?", [$vendorId, gmdate('Y-m-d H:i:s', time() - $days * 86400)]);
        }
        return (int)Db::val("SELECT COUNT(*) FROM `Incident` WHERE vendorId = ? AND status = 'CONFIRMED'", [$vendorId]);
    }

    /** Avertissement a l'avant-dernier incident, suspension au seuil. */
    public static function afterConfirm(string $vendorId): void
    {
        $t = Pricing::config()['strikeThreshold'];
        $n = self::confirmedCount($vendorId);
        if ($n >= $t) {
            self::suspend($vendorId, "$n incidents de déclaration confirmés");
        } elseif ($t > 1 && $n === $t - 1) {
            Notifier::send($vendorId, 'INCIDENT_WARNING', 'Avertissement', "Attention : $n incident(s) de déclaration non conforme confirmé(s). Un incident de plus entraînera la suspension de votre compte vendeur.");
        }
    }

    public static function suspend(string $vendorId, string $reason): void
    {
        $won = Db::exec('UPDATE `User` SET suspendedAt = ?, suspendReason = ?, updatedAt = ? WHERE id = ? AND suspendedAt IS NULL', [Db::now(), mb_substr($reason, 0, 255), Db::now(), $vendorId]);
        if ($won === 1) {
            Notifier::send($vendorId, 'ACCOUNT_SUSPENDED', 'Compte vendeur suspendu', 'Votre compte vendeur est suspendu : vous ne pouvez plus publier de livraison. Vous pouvez contester depuis l\'application ou contacter KoliGo.');
        }
    }

    public static function unsuspend(string $vendorId, string $adminId): void
    {
        Db::exec('UPDATE `User` SET suspendedAt = NULL, suspendReason = NULL, updatedAt = ? WHERE id = ?', [Db::now(), $vendorId]);
        self::audit($adminId, $vendorId, 'UNSUSPEND');
        Notifier::send($vendorId, 'ACCOUNT_RESTORED', 'Compte réactivé', 'Votre compte vendeur est de nouveau actif. Merci de bien déclarer vos colis.');
    }

    /** Decision de l'administrateur : action = confirm | clear. */
    public static function decide(string $incidentId, string $adminId, string $action, string $note): array
    {
        $inc = Db::one('SELECT * FROM `Incident` WHERE id = ?', [$incidentId]);
        if (!$inc) {
            throw new HttpError('Incident introuvable', 404);
        }
        $note = mb_substr(trim($note), 0, 255);
        if ($action === 'confirm') {
            if ($inc['status'] === 'CONFIRMED') {
                throw new HttpError('Incident déjà confirmé', 409);
            }
            $status = 'CONFIRMED';
        } elseif ($action === 'clear') {
            if ($inc['status'] === 'CLEARED') {
                throw new HttpError('Incident déjà annulé', 409);
            }
            $status = 'CLEARED';
        } else {
            throw new HttpError('Action invalide', 400);
        }
        Db::exec('UPDATE `Incident` SET status = ?, decidedBy = ?, decidedAt = ?, decisionNote = ? WHERE id = ?', [$status, $adminId, Db::now(), $note !== '' ? $note : null, $incidentId]);
        self::audit($adminId, (string)$inc['vendorId'], $status === 'CONFIRMED' ? 'INCIDENT_CONFIRM' : 'INCIDENT_CLEAR');
        $vendorId = (string)$inc['vendorId'];
        if ($status === 'CONFIRMED') {
            Notifier::send($vendorId, 'INCIDENT', 'Incident confirmé', 'KoliGo a confirmé un incident de déclaration (' . self::LABELS[$inc['kind']] . ').');
            self::afterConfirm($vendorId);
        } else {
            Notifier::send($vendorId, 'INCIDENT', 'Incident annulé', 'KoliGo a annulé un incident enregistré sur votre compte' . ($note !== '' ? " : $note" : '.'));
        }
        $suspended = (bool)Db::val('SELECT suspendedAt FROM `User` WHERE id = ?', [$vendorId]);
        // Apres une annulation, le compte reste suspendu tant qu'un administrateur ne le leve pas : on lui signale qu'il peut le faire.
        return ['status' => $status, 'vendorSuspended' => $suspended, 'canUnsuspend' => $suspended && $status === 'CLEARED' && self::confirmedCount($vendorId) < Pricing::config()['strikeThreshold']];
    }

    /** Recours du vendeur : un seul par incident. */
    public static function appeal(string $incidentId, string $vendorId, string $text): array
    {
        $text = trim($text);
        if (mb_strlen($text) < 10) {
            throw new HttpError('Expliquez votre recours en quelques phrases (10 caractères minimum).', 400, 'APPEAL_TOO_SHORT');
        }
        $inc = Db::one('SELECT * FROM `Incident` WHERE id = ? AND vendorId = ?', [$incidentId, $vendorId]);
        if (!$inc) {
            throw new HttpError('Incident introuvable', 404);
        }
        if (!in_array($inc['status'], ['OPEN', 'CONFIRMED'], true)) {
            throw new HttpError('Cet incident ne peut plus être contesté.', 409);
        }
        if ($inc['appealAt'] !== null) {
            throw new HttpError('Vous avez déjà contesté cet incident.', 409, 'APPEAL_DONE');
        }
        Db::exec('UPDATE `Incident` SET appealText = ?, appealAt = ? WHERE id = ?', [mb_substr($text, 0, 500), Db::now(), $incidentId]);
        return self::vendorView(Db::one('SELECT * FROM `Incident` WHERE id = ?', [$incidentId]));
    }

    /** Incidents du vendeur, avec le trajet concerne. */
    public static function forVendor(string $vendorId): array
    {
        $rows = Db::all(
            'SELECT i.*, d.pickupAddress, d.dropoffAddress FROM `Incident` i JOIN `Delivery` d ON d.id = i.deliveryId WHERE i.vendorId = ? ORDER BY i.createdAt DESC LIMIT 50',
            [$vendorId]
        );
        return array_map([self::class, 'vendorView'], $rows);
    }

    private static function vendorView(array $r): array
    {
        return [
            'id' => $r['id'], 'deliveryId' => $r['deliveryId'], 'kind' => $r['kind'], 'label' => self::LABELS[$r['kind']] ?? $r['kind'],
            'status' => $r['status'], 'comment' => $r['comment'], 'measuredWeightKg' => $r['measuredWeightKg'],
            'decisionNote' => $r['decisionNote'], 'appealText' => $r['appealText'], 'appealAt' => $r['appealAt'],
            'canAppeal' => in_array($r['status'], ['OPEN', 'CONFIRMED'], true) && $r['appealAt'] === null,
            'pickupAddress' => $r['pickupAddress'] ?? null, 'dropoffAddress' => $r['dropoffAddress'] ?? null, 'createdAt' => $r['createdAt'],
        ];
    }

    private static function audit(string $adminId, string $userId, string $action): void
    {
        Db::insert('AdminAction', ['id' => Db::id(), 'adminId' => $adminId, 'userId' => $userId, 'action' => $action, 'createdAt' => Db::now()]);
    }
}
