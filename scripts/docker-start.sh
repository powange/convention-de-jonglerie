#!/bin/bash

# Script de démarrage pour Docker avec gestion des permissions
echo "Starting app initialization..."

# Créer les dossiers avec les bonnes permissions si nécessaire
mkdir -p .nuxt .output
chown -R node:node .nuxt .output 2>/dev/null || true

# Exécuter les migrations Prisma
npx prisma generate
npx prisma migrate deploy

echo "Ready! Starting Nuxt..."
npm run dev