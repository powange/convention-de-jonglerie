#!/bin/sh

sleep 5
mkdir -p /app/public/uploads
npx prisma migrate deploy >/dev/null 2>&1 || true

echo "==================================="
echo "     Lancement de tous les tests    "
echo "==================================="
echo ""

# Tests unitaires simples
echo "==================================="
echo "    1. Tests unitaires simples     "
echo "==================================="
npm run test:run
echo ""

# Tests Nuxt
echo "==================================="
echo "    2. Tests Nuxt                  "
echo "==================================="
npm run test:nuxt:run
echo ""

# Tests avec base de données
echo "==================================="
echo "    3. Tests avec base de données  "
echo "==================================="
# Dans Docker, utiliser le script adapté
if [ -f scripts/test-db-run-docker.js ]; then
  node scripts/test-db-run-docker.js
else
  TEST_WITH_DB=true npm run test:db:run
fi
echo ""

echo "==================================="
echo "    ✅ Tous les tests terminés     "
echo "==================================="