#!/bin/bash

# Script de démarrage pour Docker avec gestion des permissions
echo "Starting app initialization..."

# Créer les dossiers avec les bonnes permissions si nécessaire
mkdir -p .nuxt .output node_modules/.prisma

# Installer/mettre à jour les dépendances si nécessaire
echo "Checking dependencies..."
if [ -f package-lock.json ]; then
  echo "Using npm ci for reproducible install..."
  npm ci
else
  echo "No package-lock.json found, using npm install..."
  npm install
fi

# Exécuter les migrations Prisma
echo "Generating Prisma client..."
npx prisma generate
echo "Running migrations..."
npx prisma migrate deploy

echo "Ready! Starting Nuxt..."
npm run dev
