#!/usr/bin/env bash
# Interroge l'endpoint public /api/public/error-logs en production.
# Usage : bash apps/app1/scripts/check-error-logs.sh <since-ISO8601> [limit]
# Lançable depuis n'importe quel dossier.
# Lit MONITORING_PROD_URL et MONITORING_ERROR_LOGS_TOKEN dans .env.
# N'affiche jamais le token. Sortie : ligne "HTTP_CODE=<code>" puis le corps JSON.
set -euo pipefail

# Chemins résolus depuis l'emplacement du script, et non depuis le dossier courant : ce script
# vit dans apps/app1/scripts/ tandis que `.env` est dans apps/app1/ et `.claude/` à la racine du
# dépôt. Se fier au dossier courant obligeait à le lancer depuis un endroit précis — et différent
# selon le script, ce qui a déjà coûté deux appels en échec.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(cd "$APP_DIR/../.." && pwd)

SINCE="${1:-}"
LIMIT="${2:-500}"

if [ -z "$SINCE" ]; then
  echo "USAGE: bash apps/app1/scripts/check-error-logs.sh <since-ISO8601> [limit]" >&2
  exit 2
fi

PROD_URL=$(grep -E '^MONITORING_PROD_URL=' "$APP_DIR/.env" | cut -d= -f2-)
TOKEN=$(grep -E '^MONITORING_ERROR_LOGS_TOKEN=' "$APP_DIR/.env" | cut -d= -f2-)

if [ -z "$PROD_URL" ]; then echo "MISSING_PROD_URL" >&2; exit 3; fi
if [ -z "$TOKEN" ]; then echo "MISSING_TOKEN" >&2; exit 3; fi

curl -s -w "\nHTTP_CODE=%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$PROD_URL/api/public/error-logs?since=$SINCE&limit=$LIMIT"
