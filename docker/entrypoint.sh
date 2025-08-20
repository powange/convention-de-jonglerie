#!/bin/sh
set -e

# Attendre éventuellement la DB si nécessaire (compose gère déjà la santé)
# echo "Waiting for database ..."
# sleep 2

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

echo "Running Prisma migrations (deploy)..."
# Génère le client Prisma (sécuritaire si déjà présent)
npx prisma generate >/dev/null 2>&1 || true
# Applique les migrations en production (idempotent)
npx prisma migrate deploy

echo "Starting Nuxt server..."
exec node .output/server/index.mjs
