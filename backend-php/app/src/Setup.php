<?php
declare(strict_types=1);

namespace Koligo;

use Koligo\Services\Accounts;
use Koligo\Services\Cgu;
use Koligo\Services\Pricing;

/** Creation du schema et des donnees de reference. Idempotent : peut etre rejoue. */
final class Setup
{
    private const INDEXES = [
        'idx_otp_phone' => ['OtpCode', 'phone'],
        'idx_notif_user' => ['Notification', 'userId'],
        'idx_decline_user' => ['OfferDecline', 'userId'],
        'idx_delivery_status' => ['Delivery', 'status'],
        'idx_delivery_vendor' => ['Delivery', 'vendorId'],
        'idx_delivery_deliverer' => ['Delivery', 'delivererId'],
        'idx_message_delivery' => ['Message', 'deliveryId'],
        'idx_gps_delivery' => ['GpsLocation', 'deliveryId'],
        'idx_tx_wallet' => ['Transaction', 'walletId'],
        'idx_dpay_delivery' => ['DeliveryPayment', 'deliveryId'],
    ];

    /** Colonnes ajoutees apres la premiere version du schema : CREATE TABLE IF NOT EXISTS ne les ajoute pas aux bases existantes. */
    private const COLUMNS = [
        ['Delivery', 'size', 'VARCHAR(5) NULL'],
        ['Delivery', 'category', 'VARCHAR(40) NULL'],
        ['Delivery', 'photoPath', 'VARCHAR(500) NULL'],
        ['Delivery', 'priceBreakdown', 'TEXT NULL'],
        ['Delivery', 'fromCity', 'VARCHAR(100) NULL'],
        ['Wallet', 'debtXAF', 'INT NOT NULL DEFAULT 0'],
        ['Wallet', 'paymentName', 'VARCHAR(191) NULL'],
        ['KycDocument', 'role', 'VARCHAR(20) NULL'],
        ['User', 'vehicleType', 'VARCHAR(20) NULL'],
        ['User', 'vehiclePlate', 'VARCHAR(20) NULL'],
        ['Message', 'flagged', 'INT NOT NULL DEFAULT 0'],
        ['Message', 'flagReason', 'VARCHAR(160) NULL'],
        ['User', 'adminPinSetAt', 'DATETIME NULL'],
        ['User', 'cguVersion', 'INT NULL'],
        ['User', 'cguAcceptedAt', 'DATETIME NULL'],
    ];

    /** A incrementer quand le schema ou les reglages de reference changent : declenche une migration au prochain appel. */
    public const SCHEMA_VERSION = 8;

    /**
     * Migration automatique et rejouable : evite d'avoir a relancer _setup.php (dont le jeton est supprime apres
     * l'installation) a chaque deploiement. Un seul SELECT par requete quand le schema est a jour.
     */
    public static function ensureSchema(): void
    {
        try {
            $v = null;
            try {
                $v = Db::val("SELECT `value` FROM `PlatformSetting` WHERE `key` = 'schema_version'");
            } catch (\Throwable) {
                // table absente : premiere installation
            }
            if ((int)$v >= self::SCHEMA_VERSION) {
                return;
            }
            self::migrate();
            self::seedReference();
            $now = Db::now();
            if (Db::exec("UPDATE `PlatformSetting` SET `value` = ?, updatedAt = ? WHERE `key` = 'schema_version'", [(string)self::SCHEMA_VERSION, $now]) === 0
                && !Db::one("SELECT `key` FROM `PlatformSetting` WHERE `key` = 'schema_version'")) {
                Db::exec("INSERT INTO `PlatformSetting` (`key`, `value`, updatedAt) VALUES ('schema_version', ?, ?)", [(string)self::SCHEMA_VERSION, $now]);
            }
        } catch (\Throwable $e) {
            // Une migration concurrente peut echouer sur une ligne deja inseree : la requete continue, la suivante verifie a nouveau.
            error_log('[schema] ' . $e->getMessage());
        }
    }

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

        $added = 0;
        foreach (self::COLUMNS as [$table, $col, $def]) {
            try {
                Db::pdo()->exec("ALTER TABLE `$table` ADD COLUMN `$col` $def");
                $added++;
            } catch (\PDOException) {
                // colonne deja presente
            }
        }
        $log[] = "$added colonnes ajoutees";

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
            'pricing_zones' => json_encode(Pricing::DEFAULT_ZONES, JSON_UNESCAPED_UNICODE),
            'pricing_gabarits' => json_encode(Pricing::DEFAULT_GABARITS, JSON_UNESCAPED_UNICODE),
            'pricing_default_zone' => 'Grand Sud', 'pricing_min_xaf' => '1000', 'cancel_fee_xaf' => '500',
            'moderation_keywords' => implode("\n", \Koligo\Services\Moderation::DEFAULT_KEYWORDS),
            'revision_timeout_min' => '10', 'cancel_grace_min' => '2', 'strike_window_days' => '30', 'strike_threshold' => '3',
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
        Cgu::ensureSeeded();
        return ["reglages OK", "$cities villes et $quartiers quartiers ajoutes", 'CGU v' . Cgu::latestVersion()];
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
        Cgu::ensureSeeded();
        $cguVersion = Cgu::latestVersion();
        foreach ($demo as [$phone, $name, $role, $bal]) {
            if (Db::one('SELECT id FROM `User` WHERE phone = ?', [$phone])) {
                continue;
            }
            $id = Db::id();
            Db::insert('User', [
                'id' => $id, 'phone' => $phone, 'name' => $name, 'pinHash' => Accounts::hashPin('1234'),
                'roles' => json_encode([$role]), 'activeRole' => $role, 'kycStatus' => 'VERIFIED',
                'cguVersion' => $cguVersion, 'cguAcceptedAt' => $now,
                'createdAt' => $now, 'updatedAt' => $now,
            ]);
            Db::insert('Wallet', ['id' => Db::id(), 'userId' => $id, 'balanceXAF' => $bal, 'updatedAt' => $now]);
            $out[] = "$role $phone / PIN 1234";
        }
        return $out ?: ['comptes demo deja presents'];
    }
}
