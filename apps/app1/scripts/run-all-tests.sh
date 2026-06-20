#!/bin/sh

sleep 5
mkdir -p /app/public/uploads

# Application des migrations avec gestion d'erreur visible
echo "🔄 Application des migrations..."
if ! npx prisma migrate deploy; then
  echo "❌ Échec des migrations - abandon des tests"
  exit 1
fi

# Vérifier la présence des dépendances critiques et installer si nécessaire
node -e "require.resolve('nuxt-auth-utils')" >/dev/null 2>&1 || {
  echo "nuxt-auth-utils manquant: exécution de npm ci..."
  npm ci
}

# Préparer Nuxt pour les tests
echo "🔧 Préparation de Nuxt..."
rm -rf /app/.nuxt || echo "Nettoyage .nuxt ignoré (volume monté)"
npx nuxt prepare || {
  echo "⚠️  Nuxt prepare a échoué, tentative de récupération..."
  mkdir -p /app/.nuxt
  touch /app/.nuxt/ui.css
}

echo "============================================="
echo "    Lancement de tous les tests"
echo "============================================="
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
# Script d'intégration unique (gère la présence/absence de Docker)
TEST_WITH_DB=true npm run test:db:run
echo ""

echo "==================================="
echo "    ✅ Tous les tests terminés     "
echo "==================================="