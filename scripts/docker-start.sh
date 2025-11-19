#!/bin/bash

# Script de démarrage pour Docker avec gestion des permissions
echo "Starting app initialization..."

# Créer les dossiers avec les bonnes permissions si nécessaire
mkdir -p .nuxt .output node_modules/.prisma

# Vérifier si les dépendances doivent être mises à jour
echo "Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "node_modules not found, installing dependencies..."
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
elif [ package.json -nt node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "Dependencies changed, updating..."
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
else
  echo "Dependencies up to date, skipping install"
fi

# Préparer Nuxt pour générer les fichiers TypeScript nécessaires
echo "Preparing Nuxt..."
npx nuxt prepare

# Exécuter les migrations Prisma
echo "Generating Prisma client..."
npx prisma generate
echo "Running migrations..."
npx prisma migrate deploy

echo "Ready! Starting Nuxt..."
npm run dev
