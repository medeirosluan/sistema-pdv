-- Suporte multi-loja: cria a tabela Store, uma loja "principal" por tenant
-- existente, escopa User/Customer/Sale/CashRegister/StockMovement por loja e
-- move o estoque de Product para uma tabela por loja (ProductStock).

-- CreateTable Store
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Store_tenantId_slug_key" ON "Store"("tenantId", "slug");
CREATE INDEX "Store_tenantId_idx" ON "Store"("tenantId");

ALTER TABLE "Store" ADD CONSTRAINT "Store_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: 1 loja "principal" por tenant existente
INSERT INTO "Store" ("id", "tenantId", "name", "slug", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'Loja principal', 'principal', true, now(), now()
FROM "Tenant";

-- AlterTable: adiciona storeId (nullable por ora) nas tabelas escopadas por loja
ALTER TABLE "User" ADD COLUMN "storeId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "storeId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "storeId" TEXT;
ALTER TABLE "CashRegister" ADD COLUMN "storeId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "storeId" TEXT;

-- Backfill: aponta cada linha existente para a loja "principal" do seu tenant
UPDATE "User" u SET "storeId" = s."id" FROM "Store" s WHERE s."tenantId" = u."tenantId";
UPDATE "Customer" c SET "storeId" = s."id" FROM "Store" s WHERE s."tenantId" = c."tenantId";
UPDATE "Sale" sa SET "storeId" = s."id" FROM "Store" s WHERE s."tenantId" = sa."tenantId";
UPDATE "CashRegister" cr SET "storeId" = s."id" FROM "Store" s WHERE s."tenantId" = cr."tenantId";
UPDATE "StockMovement" sm SET "storeId" = s."id" FROM "Store" s WHERE s."tenantId" = sm."tenantId";

-- CreateTable ProductStock (estoque por loja, substitui Product.stock/minStock)
CREATE TABLE "ProductStock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductStock_storeId_productId_key" ON "ProductStock"("storeId", "productId");
CREATE INDEX "ProductStock_tenantId_idx" ON "ProductStock"("tenantId");
CREATE INDEX "ProductStock_storeId_idx" ON "ProductStock"("storeId");

ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ProductStock" ("id", "tenantId", "storeId", "productId", "stock", "minStock", "updatedAt")
SELECT gen_random_uuid(), p."tenantId", s."id", p."id", p."stock", p."minStock", now()
FROM "Product" p
JOIN "Store" s ON s."tenantId" = p."tenantId";

ALTER TABLE "Product" DROP COLUMN "stock";
ALTER TABLE "Product" DROP COLUMN "minStock";

-- Torna storeId obrigatório agora que o backfill terminou
ALTER TABLE "User" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "CashRegister" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "storeId" SET NOT NULL;

-- Sale: numeração e clientId passam a ser únicos por loja (não mais por tenant)
DROP INDEX IF EXISTS "Sale_tenantId_number_key";
DROP INDEX IF EXISTS "Sale_tenantId_clientId_key";
CREATE UNIQUE INDEX "Sale_storeId_number_key" ON "Sale"("storeId", "number");
CREATE UNIQUE INDEX "Sale_storeId_clientId_key" ON "Sale"("storeId", "clientId");

-- Customer: índice por nome passa a ser por loja
DROP INDEX IF EXISTS "Customer_tenantId_name_idx";
CREATE INDEX "Customer_storeId_idx" ON "Customer"("storeId");
CREATE INDEX "Customer_storeId_name_idx" ON "Customer"("storeId", "name");

-- CashRegister: índice de status por loja
DROP INDEX IF EXISTS "CashRegister_tenantId_status_idx";
CREATE INDEX "CashRegister_storeId_status_idx" ON "CashRegister"("storeId", "status");

-- StockMovement: índice por data passa a ser por loja
DROP INDEX IF EXISTS "StockMovement_tenantId_createdAt_idx";
CREATE INDEX "StockMovement_storeId_createdAt_idx" ON "StockMovement"("storeId", "createdAt");

-- Foreign keys de storeId
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "User_storeId_idx" ON "User"("storeId");
