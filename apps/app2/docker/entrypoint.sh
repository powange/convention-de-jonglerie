#!/bin/sh
set -e

# Entrypoint runtime (release/prod) de Flowvent : construit DATABASE_URL, applique les migrations
# Prisma puis démarre le serveur Nitro. Idempotent.

# DATABASE_URL construite ICI à partir des valeurs brutes, et non interpolée dans le compose : un
# mot de passe contenant « @ », « / », « : » ou « # » produisait une URL mal découpée, et l'app
# échouait au démarrage sans désigner la ponctuation du mot de passe (même correctif que app1,
# cf. apps/app1/docker/entrypoint.sh). `server/utils/prisma.ts` décode symétriquement.
#
# Une DATABASE_URL fournie explicitement a la priorité.
if [ -z "$DATABASE_URL" ]; then
  if [ -z "$MYSQL_PASSWORD" ] || [ -z "$MYSQL_USER" ]; then
    echo "ERROR: DATABASE_URL is not set, and MYSQL_USER / MYSQL_PASSWORD are missing to build it"
    exit 1
  fi

  DATABASE_HOST="${DATABASE_HOST:-flowvent-db}"
  DATABASE_PORT="${DATABASE_PORT:-3306}"
  MYSQL_DATABASE="${MYSQL_DATABASE:-flowvent_db}"

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

# nuxt-auth-utils exige un secret >= 32 caractères en production : échouer tôt et clairement
# plutôt que de laisser toutes les routes de session casser au premier appel.
if [ ${#NUXT_SESSION_PASSWORD} -lt 32 ]; then
  echo "ERROR: NUXT_SESSION_PASSWORD is missing or shorter than 32 characters (cf. stack.env)"
  exit 1
fi

echo "Generating Prisma client (safe if already present)..."
npx prisma generate >/dev/null 2>&1 || true

echo "Running Prisma migrations (deploy)..."
npx prisma migrate deploy

echo "Starting Nuxt server..."
exec node .output/server/index.mjs
