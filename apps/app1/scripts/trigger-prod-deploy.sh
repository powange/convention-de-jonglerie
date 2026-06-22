#!/usr/bin/env bash
# Déclenche le webhook Portainer de production (redéploiement).
# Lit PORTAINER_PROD_WEBHOOK_URL dans .env. N'affiche jamais l'URL (secret),
# uniquement le code HTTP. Sortie : "HTTP <code>".
set -euo pipefail

URL=$(grep -E '^PORTAINER_PROD_WEBHOOK_URL=' .env | cut -d= -f2-)
# Retire d'éventuels guillemets entourant la valeur dans .env (".../"" ou '.../')
URL="${URL%\"}"; URL="${URL#\"}"
URL="${URL%\'}"; URL="${URL#\'}"

if [ -z "$URL" ]; then echo "MISSING_WEBHOOK_URL" >&2; exit 3; fi

curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$URL"
