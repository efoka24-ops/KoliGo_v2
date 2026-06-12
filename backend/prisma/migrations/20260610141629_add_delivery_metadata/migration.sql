-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "delivererId" TEXT,
    "pickupAddress" TEXT NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "weightKg" REAL NOT NULL,
    "description" TEXT,
    "delivererType" TEXT NOT NULL DEFAULT 'TEMPORAIRE',
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "collectCode" TEXT NOT NULL,
    "deliverCode" TEXT NOT NULL,
    "clientToken" TEXT NOT NULL,
    "priceXAF" INTEGER NOT NULL,
    "commissionXAF" INTEGER NOT NULL,
    "delivererEarning" INTEGER NOT NULL,
    "momoRef" TEXT,
    "shopName" TEXT,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "productPriceXAF" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Delivery_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Delivery" ("clientToken", "collectCode", "commissionXAF", "createdAt", "deliverCode", "delivererEarning", "delivererId", "delivererType", "description", "dropoffAddress", "id", "momoRef", "pickupAddress", "priceXAF", "status", "updatedAt", "vendorId", "weightKg") SELECT "clientToken", "collectCode", "commissionXAF", "createdAt", "deliverCode", "delivererEarning", "delivererId", "delivererType", "description", "dropoffAddress", "id", "momoRef", "pickupAddress", "priceXAF", "status", "updatedAt", "vendorId", "weightKg" FROM "Delivery";
DROP TABLE "Delivery";
ALTER TABLE "new_Delivery" RENAME TO "Delivery";
CREATE UNIQUE INDEX "Delivery_clientToken_key" ON "Delivery"("clientToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
