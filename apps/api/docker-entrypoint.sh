#!/bin/sh
set -e

echo "Aplicando migrations..."
npx prisma migrate deploy

echo "Configurando RLS (role de runtime)..."
npx prisma db execute --file prisma/rls-setup.sql || true

# rls-setup.sql cria a role pdv_app com uma senha padrão (documentado para uso
# manual/local). Em deploy via Docker, sincroniza com a senha real do
# APP_DATABASE_URL (APP_DB_PASSWORD), senão a API não autentica na role.
if [ -n "$APP_DB_PASSWORD" ]; then
  echo "Sincronizando senha da role de runtime..."
  escaped_password=$(printf '%s' "$APP_DB_PASSWORD" | sed "s/'/''/g")
  printf "ALTER ROLE %s WITH PASSWORD '%s';" "${APP_DB_USER:-pdv_app}" "$escaped_password" \
    | npx prisma db execute --stdin
fi

echo "Iniciando API..."
node dist/main.js
