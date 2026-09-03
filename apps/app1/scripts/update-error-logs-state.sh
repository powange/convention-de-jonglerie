#!/usr/bin/env bash
# Met à jour l'état du monitoring des logs d'erreur (.claude/error-logs-monitor.json).
# Usage : bash apps/app1/scripts/update-error-logs-state.sh <lastCheckedAt-ISO8601|now> [empreintes...]
# Lançable depuis n'importe quel dossier.
#   - lastCheckedAt : nouvelle borne `since`. Utiliser le littéral "now" (ou omettre)
#     pour que le script calcule lui-même l'instant courant (évite toute substitution
#     de commande $(date …) au point d'appel, qui casserait l'autorisation par préfixe).
#   - empreintes : empreintes "errorType|method|path|message" à ajouter à `dismissed`
#     (ignorées si déjà présentes). Aucune n'est jamais retirée par ce script.
set -euo pipefail

# Chemins résolus depuis l'emplacement du script, et non depuis le dossier courant : ce script
# vit dans apps/app1/scripts/ tandis que `.env` est dans apps/app1/ et `.claude/` à la racine du
# dépôt. Se fier au dossier courant obligeait à le lancer depuis un endroit précis — et différent
# selon le script, ce qui a déjà coûté deux appels en échec.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(cd "$APP_DIR/../.." && pwd)

STATE_FILE="$REPO_ROOT/.claude/error-logs-monitor.json"
# Défaut : "now" -> le timestamp est calculé dans node (pas de $(date) au point d'appel).
LAST_CHECKED="${1:-now}"
shift || true

node - "$STATE_FILE" "$LAST_CHECKED" "$@" <<'EOF'
const fs = require('fs')
let [file, lastChecked, ...dismissed] = process.argv.slice(2)
// "now" (ou vide) -> instant courant en ISO8601, calculé ici pour rester autonome.
if (!lastChecked || lastChecked === 'now') {
  lastChecked = new Date().toISOString()
}
let state = { lastCheckedAt: null, dismissed: [] }
try {
  state = JSON.parse(fs.readFileSync(file, 'utf8'))
} catch {
  /* fichier absent ou invalide : on repart d'un état vierge */
}
state.lastCheckedAt = lastChecked
if (!Array.isArray(state.dismissed)) state.dismissed = []
for (const d of dismissed) {
  if (d && !state.dismissed.includes(d)) state.dismissed.push(d)
}
fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n')
console.log(`STATE_UPDATED lastCheckedAt=${state.lastCheckedAt} dismissed=${state.dismissed.length}`)
EOF
