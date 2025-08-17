# 🐳 Docker - Convention de Jonglerie

## Installation rapide

1. **Démarrer l'application**
   ```bash
   docker compose up -d
   ```

2. **Accéder aux services**
   - Application : http://localhost:3000
   - Adminer (BDD) : http://localhost:8080

## Configuration

Pour changer les mots de passe et configurations, modifiez directement `docker-compose.yml` avant de lancer.

## Commandes utiles

```bash
# Voir les logs
docker compose logs -f app

# Redémarrer
docker compose restart app

# Arrêter tout
docker compose down

# Reconstruire après changements
docker compose up -d --build
```

## Portainer

Pour utiliser avec Portainer :
1. Copiez le contenu de `docker-compose.yml`
2. Dans Portainer : Stacks → Add stack → Web editor
3. Collez le contenu et déployez

## Dépannage

Si erreur JWT :
- Vérifiez que `JWT_SECRET` est bien défini dans `docker-compose.yml`
- Reconstruisez : `docker compose up -d --build`