#!/usr/bin/env bash
set -euo pipefail

echo "[deps:reset] Suppression des dossiers et fichiers de dépendances..."
rm -rf node_modules package-lock.json .pnpm-lock.yaml

if [ -d .nuxt ]; then
  echo "[deps:reset] Nettoyage Nuxt (.nuxt/.output)..."
  rm -rf .nuxt .output
fi

echo "[deps:reset] nuxt cleanup (purge caches)"
npx nuxt cleanup || true
echo "[deps:reset] (nuxt prepare sera appelé automatiquement par npm install via postinstall)"

echo "[deps:reset] Installation fraîche des dépendances..."
if [ -f package-lock.json ]; then
  echo "[deps:reset] (Lock déjà régénéré)"
fi
npm install

echo "[deps:reset] Terminé. Vous pouvez relancer: npm run dev"
