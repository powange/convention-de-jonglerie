#!/usr/bin/env bash
# Interroge l'endpoint public /api/public/error-logs en production.
# Usage : scripts/check-error-logs.sh <since-ISO8601> [limit]
# Lit MONITORING_PROD_URL et MONITORING_ERROR_LOGS_TOKEN dans .env.
# N'affiche jamais le token. Sortie : ligne "HTTP_CODE=<code>" puis le corps JSON.
set -euo pipefail

SINCE="${1:-}"
LIMIT="${2:-500}"

if [ -z "$SINCE" ]; then
  echo "USAGE: scripts/check-error-logs.sh <since-ISO8601> [limit]" >&2
  exit 2
fi

PROD_URL=$(grep -E '^MONITORING_PROD_URL=' .env | cut -d= -f2-)
TOKEN=$(grep -E '^MONITORING_ERROR_LOGS_TOKEN=' .env | cut -d= -f2-)

if [ -z "$PROD_URL" ]; then echo "MISSING_PROD_URL" >&2; exit 3; fi
if [ -z "$TOKEN" ]; then echo "MISSING_TOKEN" >&2; exit 3; fi

curl -s -w "\nHTTP_CODE=%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$PROD_URL/api/public/error-logs?since=$SINCE&limit=$LIMIT"
