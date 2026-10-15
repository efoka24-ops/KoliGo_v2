<?php
declare(strict_types=1);

namespace Koligo\Services;

use Koligo\Db;
use Koligo\HttpError;

/**
 * Versions de l'application mobile. Une seule version est « active » : tout telephone dont le numero de build
 * differe (plus ancien, ou plus recent en cas de retour arriere) est invite a installer celle-ci, et bloque si la mise a jour est obligatoire.
 */
final class AppVersions
{
    public static function current(): ?array
    {
        $r = Db::one('SELECT * FROM `AppVersion` WHERE isCurrent = 1 ORDER BY activatedAt DESC LIMIT 1');
        return $r ?: null;
    }

    /** Reponse du controle fait par le telephone au demarrage. */
    public static function check(int $clientCode): array
    {
        $cur = self::current();
        if (!$cur) {
            return ['mustUpdate' => false];
        }
        $differs = $clientCode > 0 && $clientCode !== (int)$cur['versionCode'];
        return [
            'mustUpdate' => $differs && (int)$cur['forceUpdate'] === 1,
            'updateAvailable' => $differs,
            'downgrade' => $differs && $clientCode > (int)$cur['versionCode'],
            'version' => $cur['version'], 'versionCode' => (int)$cur['versionCode'],
            'downloadUrl' => $cur['downloadUrl'], 'notes' => $cur['notes'],
        ];
    }

    public static function all(): array
    {
        return Db::all('SELECT * FROM `AppVersion` ORDER BY versionCode DESC, createdAt DESC');
    }

    public static function create(array $b, string $adminId): array
    {
        $version = trim((string)($b['version'] ?? ''));
        $code = (int)($b['versionCode'] ?? 0);
        $url = trim((string)($b['downloadUrl'] ?? ''));
        if (!preg_match('/^\d+(\.\d+){1,3}$/', $version)) {
            throw new HttpError('Numéro de version invalide (ex. 1.0.22)');
        }
        if ($code < 1) {
            throw new HttpError('Numéro de build (versionCode) invalide');
        }
        if (!preg_match('#^(https://|/)#', $url)) {
            throw new HttpError('Lien de téléchargement invalide (https://… ou /landing/…)');
        }
        if (Db::one('SELECT id FROM `AppVersion` WHERE versionCode = ?', [$code])) {
            throw new HttpError('Ce numéro de build existe déjà');
        }
        $id = Db::id();
        Db::insert('AppVersion', [
            'id' => $id, 'version' => $version, 'versionCode' => $code, 'downloadUrl' => $url,
            'notes' => isset($b['notes']) ? mb_substr(trim((string)$b['notes']), 0, 1000) : null,
            'forceUpdate' => array_key_exists('forceUpdate', $b) ? (empty($b['forceUpdate']) ? 0 : 1) : 1,
            'isCurrent' => 0, 'createdBy' => $adminId, 'createdAt' => Db::now(),
        ]);
        if (!empty($b['activate'])) {
            self::activate($id);
        }
        return Db::one('SELECT * FROM `AppVersion` WHERE id = ?', [$id]);
    }

    /** Rend cette version active (mise a jour ou retour arriere) : effet immediat pour les telephones et la page de telechargement. */
    public static function activate(string $id): array
    {
        if (!Db::one('SELECT id FROM `AppVersion` WHERE id = ?', [$id])) {
            throw new HttpError('Version introuvable', 404);
        }
        Db::exec('UPDATE `AppVersion` SET isCurrent = 0 WHERE isCurrent = 1');
        Db::exec('UPDATE `AppVersion` SET isCurrent = 1, activatedAt = ? WHERE id = ?', [Db::now(), $id]);
        return Db::one('SELECT * FROM `AppVersion` WHERE id = ?', [$id]);
    }

    public static function update(string $id, array $b): array
    {
        if (!Db::one('SELECT id FROM `AppVersion` WHERE id = ?', [$id])) {
            throw new HttpError('Version introuvable', 404);
        }
        $set = [];
        if (array_key_exists('notes', $b)) {
            $set['notes'] = mb_substr(trim((string)$b['notes']), 0, 1000);
        }
        if (array_key_exists('forceUpdate', $b)) {
            $set['forceUpdate'] = empty($b['forceUpdate']) ? 0 : 1;
        }
        if (!empty($b['downloadUrl'])) {
            if (!preg_match('#^(https://|/)#', (string)$b['downloadUrl'])) {
                throw new HttpError('Lien de téléchargement invalide');
            }
            $set['downloadUrl'] = trim((string)$b['downloadUrl']);
        }
        if ($set) {
            Db::update('AppVersion', $id, $set);
        }
        return Db::one('SELECT * FROM `AppVersion` WHERE id = ?', [$id]);
    }

    public static function delete(string $id): void
    {
        $row = Db::one('SELECT isCurrent FROM `AppVersion` WHERE id = ?', [$id]);
        if (!$row) {
            throw new HttpError('Version introuvable', 404);
        }
        if ((int)$row['isCurrent'] === 1) {
            throw new HttpError('Impossible de supprimer la version active');
        }
        Db::exec('DELETE FROM `AppVersion` WHERE id = ?', [$id]);
    }
}
