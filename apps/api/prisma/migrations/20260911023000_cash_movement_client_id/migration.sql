-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_clientId_key" ON "CashMovement"("clientId");
