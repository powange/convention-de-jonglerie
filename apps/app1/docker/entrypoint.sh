#!/bin/sh
set -e

# Attendre éventuellement la DB si nécessaire (compose gère déjà la santé)
# echo "Waiting for database ..."
# sleep 2

# ⚠️ CONSTRUIRE DATABASE_URL ICI, à partir des valeurs BRUTES, plutôt que de l'interpoler dans le
# compose.
#
# Le compose écrivait :
#   DATABASE_URL: 'mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@database:3306/${MYSQL_DATABASE}'
#
# Le mot de passe y était inséré TEL QUEL. Un mot de passe contenant « @ », « / », « : » ou « # »
# produisait donc une URL que `new URL()` découpe de travers : avec « p@ss », le « @ » supplémentaire
# fait croire à un second séparateur d'autorité, et l'hôte lu n'est plus le bon. L'application
# échouait au démarrage sur « Access denied » ou sur un hôte introuvable — sans qu'aucun message ne
# désigne le vrai coupable, à savoir la ponctuation du mot de passe.
#
# `encodeURIComponent` règle cela à la source. L'exploitant ne renseigne que MYSQL_USER,
# MYSQL_PASSWORD et MYSQL_DATABASE, en clair, dans un seul endroit — et `server/utils/prisma.ts`
# décode symétriquement ce que l'URL transporte.
#
# DATABASE_URL fournie explicitement (autre hôte, service géré, réplique) a la priorité : on ne la
# reconstruit pas.
if [ -z "$DATABASE_URL" ]; then
  if [ -z "$MYSQL_PASSWORD" ] || [ -z "$MYSQL_USER" ]; then
    echo "ERROR: DATABASE_URL is not set, and MYSQL_USER / MYSQL_PASSWORD are missing to build it"
    exit 1
  fi

  DATABASE_HOST="${DATABASE_HOST:-database}"
  DATABASE_PORT="${DATABASE_PORT:-3306}"
  MYSQL_DATABASE="${MYSQL_DATABASE:-convention_db}"

  # `node -e` plutôt qu'un échappement en shell : l'encodage pour URL a des règles précises, et les
  # reproduire en `sed` serait s'exposer à en oublier une — le genre d'erreur qui ne se voit qu'avec
  # le caractère qu'on a manqué.
  DATABASE_URL=$(
    MYSQL_USER="$MYSQL_USER" \
    MYSQL_PASSWORD="$MYSQL_PASSWORD" \
    MYSQL_DATABASE="$MYSQL_DATABASE" \
    DATABASE_HOST="$DATABASE_HOST" \
    DATABASE_PORT="$DATABASE_PORT" \
    node -e 'const e = encodeURIComponent; const v = process.env; process.stdout.write(`mysql://${e(v.MYSQL_USER)}:${e(v.MYSQL_PASSWORD)}@${v.DATABASE_HOST}:${v.DATABASE_PORT}/${e(v.MYSQL_DATABASE)}`)'
  )
  export DATABASE_URL

  # Jamais l'URL complète dans les journaux : elle contient le mot de passe.
  echo "DATABASE_URL built from MYSQL_USER/MYSQL_PASSWORD (host: $DATABASE_HOST:$DATABASE_PORT)"
fi

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
