# 🐳 Docker - Convention de Jonglerie

## Installation rapide

1. **Démarrer l'application**
   ```bash
   # Développement (iso release)
   docker compose -f docker-compose.dev.yml up -d

   # OU Production locale (build + run optimisés)
   # docker compose -f docker-compose.release.yml up -d --build
   ```

2. **Accéder aux services**
   - Application : http://localhost:3000
   - Adminer (BDD) : http://localhost:8080

## Configuration

Pour changer les mots de passe et configurations, modifiez les fichiers correspondants selon le contexte :
- `docker-compose.dev.yml` pour le développement
- `docker-compose.release.yml` pour la production

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
1. Copiez le contenu du fichier de votre choix (`docker-compose.dev.yml` ou `docker-compose.release.yml`)
2. Dans Portainer : Stacks → Add stack → Web editor
3. Collez le contenu et déployez

## Dépannage

Si erreur JWT :
- Configurez `NUXT_SESSION_PASSWORD` (en prod) pour sécuriser les sessions côté serveur dans les fichiers Compose
- Reconstruisez : `docker compose up -d --build`