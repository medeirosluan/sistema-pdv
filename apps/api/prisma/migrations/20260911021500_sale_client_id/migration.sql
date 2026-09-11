-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_clientId_key" ON "Sale"("tenantId", "clientId");
