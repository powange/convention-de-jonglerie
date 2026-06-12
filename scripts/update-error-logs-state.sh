#!/usr/bin/env bash
# Met à jour l'état du monitoring des logs d'erreur (.claude/error-logs-monitor.json).
# Usage : scripts/update-error-logs-state.sh <lastCheckedAt-ISO8601> [empreinte_dismissed...]
#   - lastCheckedAt : nouvelle borne `since` (obligatoire).
#   - empreintes : empreintes "errorType|method|path|message" à ajouter à `dismissed`
#     (ignorées si déjà présentes). Aucune n'est jamais retirée par ce script.
set -euo pipefail

STATE_FILE=".claude/error-logs-monitor.json"
LAST_CHECKED="${1:-}"

if [ -z "$LAST_CHECKED" ]; then
  echo "USAGE: scripts/update-error-logs-state.sh <lastCheckedAt-ISO8601> [empreinte...]" >&2
  exit 2
fi
shift

node - "$STATE_FILE" "$LAST_CHECKED" "$@" <<'EOF'
const fs = require('fs')
const [file, lastChecked, ...dismissed] = process.argv.slice(2)
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
