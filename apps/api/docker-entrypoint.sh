#!/bin/sh
set -e

echo "Aplicando migrations..."
npx prisma migrate deploy

echo "Configurando RLS (role de runtime)..."
npx prisma db execute --file prisma/rls-setup.sql || true

echo "Iniciando API..."
node dist/main.js
