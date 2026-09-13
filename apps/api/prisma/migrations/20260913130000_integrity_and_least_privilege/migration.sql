-- Evita dois caixas abertos para a mesma loja, inclusive sob requisições concorrentes.
CREATE UNIQUE INDEX "CashRegister_one_open_per_store"
  ON "CashRegister" ("storeId")
  WHERE "status" = 'OPEN';

-- Contador atômico da numeração de vendas. Inicializa bancos já existentes.
ALTER TABLE "Store" ADD COLUMN "lastSaleNumber" INTEGER NOT NULL DEFAULT 0;
UPDATE "Store" AS store
SET "lastSaleNumber" = COALESCE((
  SELECT MAX(sale."number") FROM "Sale" AS sale WHERE sale."storeId" = store.id
), 0);

-- A credencial de runtime não precisa criar bancos.
ALTER ROLE pdv_app NOCREATEDB;
