#!/bin/sh
set -e

# Entrypoint runtime (prod/release) de Flowvent : applique les migrations Prisma
# puis démarre le serveur Nitro. Idempotent.

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

# nuxt-auth-utils exige un secret >= 32 caractères en production : échouer tôt et clairement
# plutôt que de laisser toutes les routes de session casser au premier appel.
if [ -z "$NUXT_SESSION_PASSWORD" ]; then
  echo "ERROR: NUXT_SESSION_PASSWORD is not set (>= 32 caracteres requis, cf. stack.env)"
  exit 1
fi

echo "Generating Prisma client (safe if already present)..."
npx prisma generate >/dev/null 2>&1 || true

echo "Running Prisma migrations (deploy)..."
npx prisma migrate deploy

echo "Starting Nuxt server..."
exec node .output/server/index.mjs
