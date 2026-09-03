#!/usr/bin/env bash
# Déclenche le webhook Portainer de production (redéploiement).
# Lit PORTAINER_PROD_WEBHOOK_URL dans apps/app1/.env. Lançable depuis n'importe quel dossier. N'affiche jamais l'URL (secret),
# uniquement le code HTTP. Sortie : "HTTP <code>".
set -euo pipefail

# Chemins résolus depuis l'emplacement du script, et non depuis le dossier courant : ce script
# vit dans apps/app1/scripts/ tandis que `.env` est dans apps/app1/ et `.claude/` à la racine du
# dépôt. Se fier au dossier courant obligeait à le lancer depuis un endroit précis — et différent
# selon le script, ce qui a déjà coûté deux appels en échec.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(cd "$APP_DIR/../.." && pwd)

URL=$(grep -E '^PORTAINER_PROD_WEBHOOK_URL=' "$APP_DIR/.env" | cut -d= -f2-)
# Retire d'éventuels guillemets entourant la valeur dans .env (".../"" ou '.../')
URL="${URL%\"}"; URL="${URL#\"}"
URL="${URL%\'}"; URL="${URL#\'}"

if [ -z "$URL" ]; then echo "MISSING_WEBHOOK_URL" >&2; exit 3; fi

curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$URL"
