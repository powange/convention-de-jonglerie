#!/bin/bash
# Remet la convention à zéro puis capture. Usage : ./run.sh [etape1,etape2]
set -e
cd "$(dirname "$0")"
(cd ../../../../apps/app1 && npx tsx scripts/seed-tuto-controle-acces.ts) | sed -n '/^{/,/^}/p' > seed.json
cat seed.json
node capture.mjs "$@"
