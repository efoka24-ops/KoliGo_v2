-- Rechargement de portefeuille par mobile money.
-- La ligne est creee des l'initiation pour retrouver le portefeuille au
-- webhook ; le solde n'est credite qu'au statut final.
CREATE TABLE "TopUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "amountXAF" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "externalRef" TEXT NOT NULL,
    "paymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopUp_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Identifiant de la transaction cote passerelle, pour le rapprochement.
ALTER TABLE "Withdrawal" ADD COLUMN "paymentId" TEXT;

-- L'unicite de la reference est ce qui rend un rejeu de webhook sans effet :
-- sans elle, un meme evenement livre deux fois crediterait deux fois.
CREATE UNIQUE INDEX "TopUp_externalRef_key" ON "TopUp"("externalRef");
CREATE UNIQUE INDEX "Withdrawal_externalRef_key" ON "Withdrawal"("externalRef");
