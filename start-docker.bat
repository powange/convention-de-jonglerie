@echo off
echo 🚀 Démarrage Convention de Jonglerie
echo.

echo 🏗️  Construction et démarrage...
docker-compose up -d --build

echo.
echo ✅ Démarrage terminé !
echo.
echo 📍 Application : http://localhost:3000
echo 📍 Adminer : http://localhost:8080
echo.
echo 📋 Voir les logs : docker-compose logs -f app
echo.
pause