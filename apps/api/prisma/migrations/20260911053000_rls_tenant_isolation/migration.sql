-- RLS: isolamento por tenant no banco (defesa em profundidade).
-- A aplicação define app.tenant_id (e app.bypass para o admin da plataforma)
-- dentro de uma transação por requisição.

-- Tabelas com tenantId direto
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Product','Category','Customer','Sale','CashRegister','StockMovement']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_setting(''app.tenant_id'', true) OR current_setting(''app.bypass'', true) = ''on'') WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true) OR current_setting(''app.bypass'', true) = ''on'')',
      t
    );
  END LOOP;
END $$;

-- SaleItem / Payment: isolamento via Sale
ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SaleItem"
  USING (EXISTS (
    SELECT 1 FROM "Sale" s
    WHERE s.id = "SaleItem"."saleId"
      AND (s."tenantId" = current_setting('app.tenant_id', true)
           OR current_setting('app.bypass', true) = 'on')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Sale" s
    WHERE s.id = "SaleItem"."saleId"
      AND (s."tenantId" = current_setting('app.tenant_id', true)
           OR current_setting('app.bypass', true) = 'on')
  ));

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Payment"
  USING (EXISTS (
    SELECT 1 FROM "Sale" s
    WHERE s.id = "Payment"."saleId"
      AND (s."tenantId" = current_setting('app.tenant_id', true)
           OR current_setting('app.bypass', true) = 'on')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Sale" s
    WHERE s.id = "Payment"."saleId"
      AND (s."tenantId" = current_setting('app.tenant_id', true)
           OR current_setting('app.bypass', true) = 'on')
  ));

-- CashMovement: isolamento via CashRegister
ALTER TABLE "CashMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CashMovement"
  USING (EXISTS (
    SELECT 1 FROM "CashRegister" r
    WHERE r.id = "CashMovement"."cashRegisterId"
      AND (r."tenantId" = current_setting('app.tenant_id', true)
           OR current_setting('app.bypass', true) = 'on')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "CashRegister" r
    WHERE r.id = "CashMovement"."cashRegisterId"
      AND (r."tenantId" = current_setting('app.tenant_id', true)
           OR current_setting('app.bypass', true) = 'on')
  ));
