#!/bin/bash

# Script de démarrage pour Docker avec gestion des permissions
echo "Starting app initialization..."

# Créer les dossiers avec les bonnes permissions si nécessaire
mkdir -p .nuxt .output node_modules/.prisma

# Vérifier si les dépendances doivent être mises à jour.
#
# La comparaison portait sur les DATES : `package.json -nt node_modules`. C'est fragile ici, parce
# que `node_modules` est un volume Docker dont le contenu est recopié depuis l'image au premier
# démarrage — les dates qui en sortent n'ont pas de rapport avec celles des fichiers montés depuis
# l'hôte. Selon l'ordre, le script pouvait réinstaller ce que l'image venait d'installer, ou sauter
# une mise à jour réelle.
#
# On compare désormais une EMPREINTE du verrou, écrite après chaque installation réussie. Elle dit
# ce qui est réellement installé, sans dépendre d'une horloge.
if [ -f package-lock.json ]; then
  VERROU=package-lock.json
else
  VERROU=package.json
fi
EMPREINTE_ATTENDUE=$(md5sum "$VERROU" | cut -d' ' -f1)
MARQUEUR=node_modules/.empreinte-installation

echo "Checking dependencies..."
if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  RAISON="node_modules absent"
elif [ ! -f "$MARQUEUR" ]; then
  # L'image inscrit ce marqueur juste après son `npm ci`, et il voyage avec node_modules quand
  # Docker le recopie dans le volume. Son absence signale donc des dépendances d'origine inconnue.
  RAISON="empreinte absente"
elif [ "$(cat "$MARQUEUR")" != "$EMPREINTE_ATTENDUE" ]; then
  RAISON="$VERROU a changé"
else
  RAISON=""
fi

if [ -n "$RAISON" ]; then
  echo "Installing dependencies ($RAISON)..."
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  echo "$EMPREINTE_ATTENDUE" > "$MARQUEUR"
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
