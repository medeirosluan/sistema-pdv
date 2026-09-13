-- RLS: estende o isolamento para o nível de loja (Store), além do tenant.
-- A aplicação passa a definir também app.store_id na transação por requisição.

-- Store: SEM RLS, no mesmo padrão de Tenant/User — é consultada/criada no
-- registro de conta (POST /auth/register) antes de existir contexto de
-- tenant autenticado (app.tenant_id ainda não foi definido), então uma
-- policy aqui bloquearia o próprio cadastro de loja nova. O isolamento por
-- tenant já é garantido pelas queries da aplicação (sempre filtram por
-- tenantId explicitamente).

-- ProductStock: isolamento por tenantId + storeId
ALTER TABLE "ProductStock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductStock" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ProductStock"
  USING (
    ("tenantId" = current_setting('app.tenant_id', true) AND "storeId" = current_setting('app.store_id', true))
    OR current_setting('app.bypass', true) = 'on'
  )
  WITH CHECK (
    ("tenantId" = current_setting('app.tenant_id', true) AND "storeId" = current_setting('app.store_id', true))
    OR current_setting('app.bypass', true) = 'on'
  );

-- Customer, Sale, CashRegister, StockMovement: a policy antiga só checava
-- tenantId; recriamos exigindo tenantId E storeId (uma única policy com AND —
-- duas policies permissivas se combinariam com OR e afrouxariam o isolamento).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Customer','Sale','CashRegister','StockMovement']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (("tenantId" = current_setting(''app.tenant_id'', true) AND "storeId" = current_setting(''app.store_id'', true)) OR current_setting(''app.bypass'', true) = ''on'') WITH CHECK (("tenantId" = current_setting(''app.tenant_id'', true) AND "storeId" = current_setting(''app.store_id'', true)) OR current_setting(''app.bypass'', true) = ''on'')',
      t
    );
  END LOOP;
END $$;

-- SaleItem / Payment: isolamento via Sale (agora também checando storeId)
DROP POLICY IF EXISTS tenant_isolation ON "SaleItem";
CREATE POLICY tenant_isolation ON "SaleItem"
  USING (EXISTS (
    SELECT 1 FROM "Sale" s
    WHERE s.id = "SaleItem"."saleId"
      AND ((s."tenantId" = current_setting('app.tenant_id', true) AND s."storeId" = current_setting('app.store_id', true))
           OR current_setting('app.bypass', true) = 'on')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Sale" s
    WHERE s.id = "SaleItem"."saleId"
      AND ((s."tenantId" = current_setting('app.tenant_id', true) AND s."storeId" = current_setting('app.store_id', true))
           OR current_setting('app.bypass', true) = 'on')
  ));

DROP POLICY IF EXISTS tenant_isolation ON "Payment";
CREATE POLICY tenant_isolation ON "Payment"
  USING (EXISTS (
    SELECT 1 FROM "Sale" s
    WHERE s.id = "Payment"."saleId"
      AND ((s."tenantId" = current_setting('app.tenant_id', true) AND s."storeId" = current_setting('app.store_id', true))
           OR current_setting('app.bypass', true) = 'on')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Sale" s
    WHERE s.id = "Payment"."saleId"
      AND ((s."tenantId" = current_setting('app.tenant_id', true) AND s."storeId" = current_setting('app.store_id', true))
           OR current_setting('app.bypass', true) = 'on')
  ));

-- CashMovement: isolamento via CashRegister (agora também checando storeId)
DROP POLICY IF EXISTS tenant_isolation ON "CashMovement";
CREATE POLICY tenant_isolation ON "CashMovement"
  USING (EXISTS (
    SELECT 1 FROM "CashRegister" r
    WHERE r.id = "CashMovement"."cashRegisterId"
      AND ((r."tenantId" = current_setting('app.tenant_id', true) AND r."storeId" = current_setting('app.store_id', true))
           OR current_setting('app.bypass', true) = 'on')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "CashRegister" r
    WHERE r.id = "CashMovement"."cashRegisterId"
      AND ((r."tenantId" = current_setting('app.tenant_id', true) AND r."storeId" = current_setting('app.store_id', true))
           OR current_setting('app.bypass', true) = 'on')
  ));
