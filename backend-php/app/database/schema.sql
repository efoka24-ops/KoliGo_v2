-- Schema KoliGo. Portable MySQL 8 / SQLite : {{OPTS}} est remplace par
-- "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ..." cote MySQL et par rien cote SQLite.
-- Les enums sont des VARCHAR valides par l'application :
--   Role: VENDOR | DELIVERER | ADMIN
--   KycStatus: NONE | PENDING | VERIFIED | REJECTED
--   DeliveryStatus: EN_ATTENTE | ACCEPTE | EN_ROUTE | LIVRE | ANNULE
-- Les dates sont en UTC.

CREATE TABLE IF NOT EXISTS `User` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `phone` VARCHAR(30) NOT NULL UNIQUE,
  `email` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `pinHash` VARCHAR(100) NOT NULL,
  `roles` VARCHAR(100) NOT NULL DEFAULT '["VENDOR"]',
  `activeRole` VARCHAR(20) NOT NULL DEFAULT 'VENDOR',
  `kycStatus` VARCHAR(20) NOT NULL DEFAULT 'NONE',
  `kycRejectionReason` TEXT NULL,
  `gender` VARCHAR(10) NULL,
  `shopName` VARCHAR(191) NULL,
  `biometryEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `language` VARCHAR(10) NOT NULL DEFAULT 'fr',
  `theme` VARCHAR(10) NOT NULL DEFAULT 'light',
  `isBlocked` TINYINT(1) NOT NULL DEFAULT 0,
  `isOnline` TINYINT(1) NOT NULL DEFAULT 0,
  `expoPushToken` VARCHAR(255) NULL,
  `cniNumber` VARCHAR(50) NULL,
  `quartier` VARCHAR(191) NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `KycDocument` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `userId` VARCHAR(40) NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `filePath` VARCHAR(500) NOT NULL,
  `createdAt` DATETIME NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `Delivery` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `vendorId` VARCHAR(40) NOT NULL,
  `delivererId` VARCHAR(40) NULL,
  `pickupAddress` VARCHAR(500) NOT NULL,
  `dropoffAddress` VARCHAR(500) NOT NULL,
  `weightKg` DOUBLE NOT NULL,
  `distanceKm` DOUBLE NULL,
  `description` TEXT NULL,
  `delivererType` VARCHAR(20) NOT NULL DEFAULT 'TEMPORAIRE',
  `status` VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE',
  `collectCode` VARCHAR(10) NOT NULL,
  `deliverCode` VARCHAR(10) NOT NULL,
  `clientToken` VARCHAR(500) NOT NULL UNIQUE,
  `priceXAF` INT NOT NULL,
  `commissionXAF` INT NOT NULL,
  `delivererEarning` INT NOT NULL,
  `momoRef` VARCHAR(191) NULL,
  `shopName` VARCHAR(191) NULL,
  `recipientName` VARCHAR(191) NULL,
  `recipientPhone` VARCHAR(30) NULL,
  `productPriceXAF` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  FOREIGN KEY (`vendorId`) REFERENCES `User`(`id`),
  FOREIGN KEY (`delivererId`) REFERENCES `User`(`id`)
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `Message` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `deliveryId` VARCHAR(40) NOT NULL,
  `senderId` VARCHAR(40) NULL,
  `senderName` VARCHAR(191) NOT NULL,
  `senderRole` VARCHAR(20) NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME NOT NULL,
  FOREIGN KEY (`deliveryId`) REFERENCES `Delivery`(`id`) ON DELETE CASCADE
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `EscrowEntry` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `deliveryId` VARCHAR(40) NOT NULL UNIQUE,
  `amountXAF` INT NOT NULL,
  `lockedAt` DATETIME NOT NULL,
  `releasedAt` DATETIME NULL,
  FOREIGN KEY (`deliveryId`) REFERENCES `Delivery`(`id`)
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `GpsLocation` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `deliveryId` VARCHAR(40) NOT NULL,
  `latitude` DOUBLE NOT NULL,
  `longitude` DOUBLE NOT NULL,
  `createdAt` DATETIME NOT NULL,
  FOREIGN KEY (`deliveryId`) REFERENCES `Delivery`(`id`)
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `Wallet` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `userId` VARCHAR(40) NOT NULL UNIQUE,
  `balanceXAF` INT NOT NULL DEFAULT 0,
  `paymentProvider` VARCHAR(20) NOT NULL DEFAULT 'MTN',
  `paymentPhone` VARCHAR(30) NULL,
  `updatedAt` DATETIME NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `Transaction` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `walletId` VARCHAR(40) NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `amountXAF` INT NOT NULL,
  `description` VARCHAR(500) NULL,
  `deliveryId` VARCHAR(40) NULL,
  `createdAt` DATETIME NOT NULL,
  FOREIGN KEY (`walletId`) REFERENCES `Wallet`(`id`)
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `Withdrawal` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `walletId` VARCHAR(40) NOT NULL,
  `amountXAF` INT NOT NULL,
  `provider` VARCHAR(20) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `externalRef` VARCHAR(191) NULL UNIQUE,
  `paymentId` VARCHAR(191) NULL,
  `createdAt` DATETIME NOT NULL,
  FOREIGN KEY (`walletId`) REFERENCES `Wallet`(`id`)
) {{OPTS}};

-- Rechargement mobile money. Le solde n'est credite qu'au webhook ; l'unicite
-- de externalRef + le filtre status='PENDING' rendent un rejeu sans effet.
CREATE TABLE IF NOT EXISTS `TopUp` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `walletId` VARCHAR(40) NOT NULL,
  `amountXAF` INT NOT NULL,
  `provider` VARCHAR(20) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `externalRef` VARCHAR(191) NOT NULL UNIQUE,
  `paymentId` VARCHAR(191) NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  FOREIGN KEY (`walletId`) REFERENCES `Wallet`(`id`)
) {{OPTS}};

-- Paiement d'une livraison par le destinataire (depot mobile money).
CREATE TABLE IF NOT EXISTS `DeliveryPayment` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `deliveryId` VARCHAR(40) NOT NULL,
  `amountXAF` INT NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `externalRef` VARCHAR(191) NOT NULL UNIQUE,
  `paymentId` VARCHAR(191) NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  FOREIGN KEY (`deliveryId`) REFERENCES `Delivery`(`id`)
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `Rating` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `deliveryId` VARCHAR(40) NOT NULL,
  `fromUserId` VARCHAR(40) NOT NULL,
  `toUserId` VARCHAR(40) NOT NULL,
  `score` INT NOT NULL,
  `tags` TEXT NULL,
  `comment` TEXT NULL,
  `createdAt` DATETIME NOT NULL,
  FOREIGN KEY (`deliveryId`) REFERENCES `Delivery`(`id`),
  FOREIGN KEY (`fromUserId`) REFERENCES `User`(`id`),
  FOREIGN KEY (`toUserId`) REFERENCES `User`(`id`)
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `Issue` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `deliveryId` VARCHAR(40) NOT NULL,
  `userId` VARCHAR(40) NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `description` TEXT NULL,
  `photoPaths` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  `createdAt` DATETIME NOT NULL,
  FOREIGN KEY (`deliveryId`) REFERENCES `Delivery`(`id`),
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `OtpCode` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `phone` VARCHAR(30) NOT NULL,
  `code` VARCHAR(10) NOT NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `expiresAt` DATETIME NOT NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `PlatformSetting` (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL,
  `updatedAt` DATETIME NOT NULL
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `City` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL UNIQUE,
  `region` VARCHAR(100) NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `Neighborhood` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `cityId` VARCHAR(40) NOT NULL,
  `latitude` DOUBLE NULL,
  `longitude` DOUBLE NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL,
  UNIQUE (`name`, `cityId`),
  FOREIGN KEY (`cityId`) REFERENCES `City`(`id`)
) {{OPTS}};

CREATE TABLE IF NOT EXISTS `DbArchive` (
  `id` VARCHAR(40) NOT NULL PRIMARY KEY,
  `label` VARCHAR(255) NOT NULL,
  `archivedAt` DATETIME NOT NULL,
  `snapshotJson` LONGTEXT NOT NULL,
  `archivedBy` VARCHAR(40) NULL
) {{OPTS}};

-- Limiteur de debit : protege signin / OTP du brute-force (PIN a 4 chiffres).
CREATE TABLE IF NOT EXISTS `RateLimit` (
  `bucket` VARCHAR(191) NOT NULL PRIMARY KEY,
  `hits` INT NOT NULL,
  `resetAt` DATETIME NOT NULL
) {{OPTS}};
