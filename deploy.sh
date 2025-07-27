#!/bin/bash
# Script de déploiement simple

echo "🚀 Déploiement Convention de Jonglerie"

# Vérifier si le dossier existe
if [ -d "convention-de-jonglerie" ]; then
    echo "📁 Mise à jour du projet..."
    cd convention-de-jonglerie
    git pull
else
    echo "📥 Clonage du projet..."
    git clone https://github.com/powange/convention-de-jonglerie.git
    cd convention-de-jonglerie
fi

# Créer le fichier .env.docker si nécessaire
if [ ! -f .env.docker ]; then
    echo "📝 Configuration de l'environnement..."
    cp .env.docker.example .env.docker
    echo "⚠️  Éditez .env.docker avec vos valeurs !"
    echo "Puis relancez ce script."
    exit 1
fi

echo "🏗️  Construction et démarrage..."
docker-compose down
docker-compose up -d --build

echo "✅ Déploiement terminé !"
echo "📍 Application : http://$(hostname -I | awk '{print $1}'):3000"
echo "📍 Adminer : http://$(hostname -I | awk '{print $1}'):8080"