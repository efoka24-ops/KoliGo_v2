-- Regularise une derive : ces objets existaient dans schema.prisma sans
-- migration correspondante. Sans cette migration, une base creee par
-- `migrate deploy` sortait incomplete et l'application echouait a l'execution.
--
-- Sur une base existante qui possede deja ces colonnes (creee par
-- `prisma db push`), marquer cette migration comme appliquee plutot que de
-- la rejouer :
--   npx prisma migrate resolve --applied 20260813235900_sync_schema_drift

ALTER TABLE "Delivery" ADD COLUMN "distanceKm" REAL;

ALTER TABLE "User" ADD COLUMN "gender" TEXT;
ALTER TABLE "User" ADD COLUMN "kycRejectionReason" TEXT;

CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
