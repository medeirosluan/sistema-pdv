-- AlterTable
ALTER TABLE "CashRegister" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "closeClientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CashRegister_clientId_key" ON "CashRegister"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CashRegister_closeClientId_key" ON "CashRegister"("closeClientId");
