<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;

/**
 * KYC : un seul dossier par personne, valable pour les rôles Vendeur et Livreur.
 * Sans dossier VERIFIE par le back-office, on ne peut ni publier (Vendeur) ni livrer (Livreur).
 * Le statut vit dans User.kycStatus ; passer d'un rôle à l'autre ne redemande rien.
 */
final class Kyc
{
    public const ROLES = ['VENDOR', 'DELIVERER'];

    public static function status(array $user, ?string $role = null): string
    {
        return (string)($user['kycStatus'] ?? 'NONE');
    }

    /** @return array{VENDOR:string,DELIVERER:string} même statut pour les deux rôles */
    public static function byRole(array $user): array
    {
        $s = self::status($user);
        return ['VENDOR' => $s, 'DELIVERER' => $s];
    }

    public static function set(string $userId, string $status, ?string $reason = null): void
    {
        Db::update('User', $userId, [
            'kycStatus' => $status,
            'kycRejectionReason' => $status === 'REJECTED' ? $reason : null,
            'updatedAt' => Db::now(),
        ]);
    }
}
