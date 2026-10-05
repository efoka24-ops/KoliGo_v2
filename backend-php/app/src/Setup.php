<?php
declare(strict_types=1);

namespace Koligo;

use Koligo\Services\Accounts;

/** Creation du schema et des donnees de reference. Idempotent : peut etre rejoue. */
final class Setup
{
    private const INDEXES = [
        'idx_otp_phone' => ['OtpCode', 'phone'],
        'idx_delivery_status' => ['Delivery', 'status'],
        'idx_delivery_vendor' => ['Delivery', 'vendorId'],
        'idx_delivery_deliverer' => ['Delivery', 'delivererId'],
        'idx_message_delivery' => ['Message', 'deliveryId'],
        'idx_gps_delivery' => ['GpsLocation', 'deliveryId'],
        'idx_tx_wallet' => ['Transaction', 'walletId'],
        'idx_dpay_delivery' => ['DeliveryPayment', 'deliveryId'],
    ];

    /** @return string[] journal des etapes */
    public static function migrate(): array
    {
        $log = [];
        $sql = (string)file_get_contents(__DIR__ . '/../database/schema.sql');
        $opts = Db::isSqlite() ? '' : 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        $sql = str_replace('{{OPTS}}', $opts, $sql);
        $sql = preg_replace('/^--.*$/m', '', $sql) ?? $sql;

        $n = 0;
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
            Db::pdo()->exec($stmt);
            $n++;
        }
        $log[] = "$n tables verifiees/creees";

        foreach (self::INDEXES as $name => [$table, $col]) {
            try {
                Db::pdo()->exec("CREATE INDEX `$name` ON `$table` (`$col`)");
            } catch (\PDOException) {
                // existe deja (MySQL n'a pas CREATE INDEX IF NOT EXISTS)
            }
        }
        $log[] = count(self::INDEXES) . ' index verifies';
        return $log;
    }

    public static function seedReference(): array
    {
        $now = Db::now();
        $settings = [
            'commission_rate' => '0.03', 'base_rate_xaf' => '500', 'per_km_rate_xaf' => '150',
            'weight_surcharge_xaf' => '100', 'maintenance_mode' => 'false', 'min_withdrawal_xaf' => '1000',
            'gps_interval_ms' => '8000', 'otp_ttl_minutes' => '5', 'otp_max_attempts' => '3',
            'sms_notifications' => 'true',
        ];
        foreach ($settings as $k => $v) {
            if (!Db::one('SELECT `key` FROM `PlatformSetting` WHERE `key` = ?', [$k])) {
                Db::exec('INSERT INTO `PlatformSetting` (`key`, `value`, updatedAt) VALUES (?, ?, ?)', [$k, $v, $now]);
            }
        }

        $geo = json_decode((string)file_get_contents(__DIR__ . '/../database/geo.json'), true) ?: [];
        $cities = 0;
        $quartiers = 0;
        foreach ($geo as $c) {
            $row = Db::one('SELECT id FROM `City` WHERE name = ?', [$c['name']]);
            if ($row) {
                $cityId = $row['id'];
            } else {
                $cityId = Db::id();
                Db::insert('City', ['id' => $cityId, 'name' => $c['name'], 'region' => $c['region'], 'createdAt' => $now]);
                $cities++;
            }
            foreach ($c['neighborhoods'] as $n) {
                if (!Db::one('SELECT id FROM `Neighborhood` WHERE name = ? AND cityId = ?', [$n, $cityId])) {
                    Db::insert('Neighborhood', ['id' => Db::id(), 'name' => $n, 'cityId' => $cityId, 'createdAt' => $now]);
                    $quartiers++;
                }
            }
        }
        return ["reglages OK", "$cities villes et $quartiers quartiers ajoutes"];
    }

    /** Cree l'administrateur s'il n'existe pas ; ne touche jamais a un compte existant. */
    public static function ensureAdmin(string $phone, string $pin, string $name = 'Admin KoliGo'): string
    {
        if (Db::one('SELECT id FROM `User` WHERE phone = ?', [$phone])) {
            return "admin $phone deja present (inchange)";
        }
        $id = Db::id();
        $now = Db::now();
        Db::tx(function () use ($id, $now, $phone, $pin, $name) {
            Db::insert('User', [
                'id' => $id, 'phone' => $phone, 'name' => $name, 'pinHash' => Accounts::hashPin($pin),
                'roles' => json_encode(['ADMIN']), 'activeRole' => 'ADMIN', 'kycStatus' => 'VERIFIED',
                'createdAt' => $now, 'updatedAt' => $now,
            ]);
            Db::insert('Wallet', ['id' => Db::id(), 'userId' => $id, 'balanceXAF' => 0, 'updatedAt' => $now]);
        });
        return "admin $phone cree";
    }

    /** Comptes de demonstration (PIN 1234) : pour le developpement local uniquement. */
    public static function seedDemo(): array
    {
        $out = [];
        $demo = [
            ['+237655111222', 'Marie Ngono', 'VENDOR', 15000],
            ['+237677333444', 'Cécile Biya', 'VENDOR', 8200],
            ['+237677234567', 'Hervé Nkouamba', 'DELIVERER', 12500],
            ['+237655456789', 'Marc Tchioffo', 'DELIVERER', 8750],
        ];
        $now = Db::now();
        foreach ($demo as [$phone, $name, $role, $bal]) {
            if (Db::one('SELECT id FROM `User` WHERE phone = ?', [$phone])) {
                continue;
            }
            $id = Db::id();
            Db::insert('User', [
                'id' => $id, 'phone' => $phone, 'name' => $name, 'pinHash' => Accounts::hashPin('1234'),
                'roles' => json_encode([$role]), 'activeRole' => $role, 'kycStatus' => 'VERIFIED',
                'createdAt' => $now, 'updatedAt' => $now,
            ]);
            Db::insert('Wallet', ['id' => Db::id(), 'userId' => $id, 'balanceXAF' => $bal, 'updatedAt' => $now]);
            $out[] = "$role $phone / PIN 1234";
        }
        return $out ?: ['comptes demo deja presents'];
    }
}
