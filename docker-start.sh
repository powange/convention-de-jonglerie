#!/bin/bash

# Script de démarrage rapide pour Convention de Jonglerie
echo "🎪 Convention de Jonglerie - Démarrage Docker"

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier si Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Créer le fichier .env.docker s'il n'existe pas
if [ ! -f .env.docker ]; then
    echo "📋 Création du fichier .env.docker..."
    cp .env.docker.example .env.docker
    echo "✅ Fichier .env.docker créé. Vous pouvez le modifier si nécessaire."
fi

# Créer le dossier uploads s'il n'existe pas
mkdir -p public/uploads

echo "🏗️  Construction des images Docker..."
docker-compose build

echo "🚀 Démarrage des services..."
docker-compose up -d

echo "⏳ Attente que les services soient prêts..."
sleep 10

# Vérifier que les services sont démarrés
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services démarrés avec succès !"
    echo ""
    echo "🌐 Application disponible sur : http://localhost:3000"
    echo "🗄️  Interface base de données : http://localhost:8080"
    echo "   - Serveur: database"
    echo "   - Utilisateur: convention_user"
    echo "   - Mot de passe: convention_password"
    echo "   - Base: convention_db"
    echo ""
    echo "📋 Commandes utiles :"
    echo "   docker-compose logs -f app     # Voir les logs"
    echo "   docker-compose down            # Arrêter les services"
    echo "   docker-compose restart app     # Redémarrer l'app"
else
    echo "❌ Erreur lors du démarrage. Vérifiez les logs :"
    echo "   docker-compose logs"
fi