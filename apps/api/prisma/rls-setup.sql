-- Cria o role de runtime da aplicação, NÃO-superuser, sujeito ao RLS.
-- Execute UMA vez por banco, como superusuário (role "pdv").
--   psql "$DATABASE_URL" -f prisma/rls-setup.sql
--
-- Depois configure no .env:
--   APP_DATABASE_URL="postgresql://pdv_app:pdv_app@localhost:5432/pdv?schema=public"
--
-- Observação: sem APP_DATABASE_URL (conectando como superusuário), o Postgres
-- IGNORA o RLS.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pdv_app') THEN
    CREATE ROLE pdv_app LOGIN PASSWORD 'pdv_app' NOSUPERUSER CREATEDB;
  END IF;
END $$;

GRANT ALL ON SCHEMA public TO pdv_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO pdv_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO pdv_app;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO pdv_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pdv_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pdv_app;
