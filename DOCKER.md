# Documentation Docker - Convention de Jonglerie

## Vue d'ensemble

Ce projet utilise Docker et Docker Compose pour simplifier le déploiement et le développement. Trois configurations sont disponibles :

- **Développement** (`docker-compose.dev.yml`) : Pour le développement local avec rechargement à chaud
- **Test** (`docker-compose.test.yml`) : Pour les tests automatisés
- **Production** (`docker-compose.release.yml`) : Pour le déploiement en production

## Architecture des services

### Services communs

- **database** : MySQL 8.0 pour stocker les données
- **app** : Application Nuxt.js (Node.js 22 Alpine)
- **adminer** : Interface web pour administrer la base de données

### Volumes persistants

- **mysql_data** : Données de la base MySQL
- **uploads_data** : Fichiers uploadés par les utilisateurs

## Prérequis

- Docker Engine 20.10+
- Docker Compose v2.0+
- 2GB de RAM minimum disponible
- 5GB d'espace disque libre

## Installation et utilisation

### 1. Configuration initiale

Créer un fichier `.env` à la racine du projet :

```bash
# Base de données
MYSQL_ROOT_PASSWORD=votre_mot_de_passe_root
MYSQL_DATABASE=convention_db
MYSQL_USER=convention_user
MYSQL_PASSWORD=votre_mot_de_passe_db

# Application
NUXT_SESSION_PASSWORD=votre_super_mot_de_passe_de_session_tres_long

# Email (optionnel)
SEND_EMAILS=false
SMTP_USER=
SMTP_PASS=
```

### 2. Environnement de développement

#### Installation initiale des dépendances

**Option 1 : Depuis l'hôte (recommandé)**

```bash
# Installation directe sur votre machine
npm install
```

**Option 2 : Via Docker**

```bash
# Utiliser le service dédié pour l'installation
docker compose -f docker-compose.dev-install.yml run --rm npm-install
```

#### Démarrer les services

```bash
# Les node_modules doivent déjà être installés
docker compose -f docker-compose.dev.yml up -d
```

**Note importante** : Le `docker-compose.dev.yml` a été optimisé pour ne plus faire `npm install` à chaque démarrage. Les `node_modules` sont partagés avec l'hôte (via un volume Docker), ce qui permet :

- Démarrage plus rapide des conteneurs
- Installation des dépendances une seule fois
- Possibilité d'utiliser les outils de développement locaux (VSCode, etc.)

#### Caractéristiques

- **Hot reload** activé sur le code source (avec polling pour Windows)
- **Port 3000** : Application Nuxt
- **Port 8080** : Adminer (interface DB)
- **Port 24678** : WebSocket pour le rechargement à chaud
- Volumes montés pour synchronisation du code
- **node_modules** partagés avec l'hôte
- **File watching** : Utilise le polling sur Windows pour détecter les changements

#### Commandes utiles

```bash
# Voir les logs
docker compose -f docker-compose.dev.yml logs -f app

# Redémarrer l'application
docker compose -f docker-compose.dev.yml restart app

# Exécuter des commandes dans le conteneur
docker compose -f docker-compose.dev.yml exec app sh

# Installer de nouvelles dépendances (depuis l'hôte)
npm install <package>

# Ou via Docker
docker compose -f docker-compose.dev-install.yml run --rm npm-install

# Exécuter les migrations Prisma
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev

# Générer le client Prisma
docker compose -f docker-compose.dev.yml exec app npx prisma generate
```

### 3. Environnement de test

#### Lancer les tests

```bash
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```

#### Caractéristiques

- Base de données dédiée aux tests
- Environnement isolé
- Arrêt automatique après les tests

### 4. Environnement de production

#### Construire l'image

```bash
docker build -t convention-app:latest .
```

#### Déployer en production

```bash
# Créer le réseau externe si vous utilisez un reverse proxy
docker network create proxy-network || true
docker compose -f docker-compose.release.yml up -d
```

#### Caractéristiques

- Image optimisée (Node Alpine)
- Build de production Nuxt
- Restart automatique en cas de crash
- Network externe pour reverse proxy

#### Configuration avec reverse proxy (Nginx/Traefik)

Exemple avec Traefik :

```yaml
labels:
  - 'traefik.enable=true'
  - 'traefik.http.routers.convention.rule=Host(`convention.example.com`)'
  - 'traefik.http.services.convention.loadbalancer.server.port=3000'
```

## Gestion de la base de données

### Connexion depuis un logiciel externe (DBeaver, TablePlus, MySQL Workbench, etc.)

Le port MySQL est exposé sur votre machine locale. Utilisez ces paramètres (développement) :

- **Hôte** : `localhost` ou `127.0.0.1`
- **Port** : `3306`
- **Base de données** : `convention_db`
- **Utilisateur** : `convention_user` (ou celui défini dans .env)
- **Mot de passe** : celui défini dans .env (par défaut : `convention_password`)

#### Exemples de connexion :

**MySQL Workbench / DBeaver :**

```
Hostname: localhost
Port: 3306
Username: convention_user
Password: convention_password
Database: convention_db
```

**Ligne de commande MySQL (développement) :**

```bash
mysql -h localhost -P 3306 -u convention_user -p convention_db
```

**URL de connexion (développement) :**

```
mysql://convention_user:convention_password@localhost:3306/convention_db
```

Pour l'environnement de tests (docker-compose.test.yml), MySQL est exposé sur le port 3307 pour éviter les conflits locaux :

- **Port** : `3307`
- **URL** : `mysql://convention_user:convention_password@localhost:3307/convention_db`

### Accès via Adminer (interface web)

1. Naviguer vers http://localhost:8080
2. Connexion :
   - Serveur : `database`
   - Utilisateur : `convention_user` (ou celui défini dans .env)
   - Mot de passe : depuis le .env
   - Base de données : `convention_db`

### Migrations Prisma

```bash
# Créer une nouvelle migration
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev --name nom_migration

# Appliquer les migrations en production
docker compose -f docker-compose.release.yml exec app npx prisma migrate deploy

# Réinitialiser la base de données (DEV uniquement)
docker compose -f docker-compose.dev.yml exec app npx prisma migrate reset

# Visualiser le schéma
docker compose -f docker-compose.dev.yml exec app npx prisma studio
```

## Sauvegarde et restauration

### Sauvegarder la base de données

```bash
# Créer une sauvegarde
docker compose -f docker-compose.release.yml exec database \
  mysqldump -u convention_user -p convention_db > backup_$(date +%Y%m%d).sql

# Sauvegarder les uploads
docker run --rm -v convention-de-jonglerie_uploads_data:/data \
  -v $(pwd):/backup alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz -C /data .
```

### Restaurer depuis une sauvegarde

```bash
# Restaurer la base de données
docker compose -f docker-compose.release.yml exec -T database \
  mysql -u convention_user -p convention_db < backup_20240101.sql

# Restaurer les uploads
docker run --rm -v convention-de-jonglerie_uploads_data:/data \
  -v $(pwd):/backup alpine tar xzf /backup/uploads_20240101.tar.gz -C /data
```

## Monitoring et logs

### Consulter les logs

```bash
# Tous les services
docker compose -f docker-compose.dev.yml logs -f

# Service spécifique
docker compose -f docker-compose.dev.yml logs -f app

# Dernières 100 lignes
docker compose -f docker-compose.dev.yml logs --tail=100 app
```

### Monitoring des ressources

```bash
# Utilisation des ressources
docker stats

# État des conteneurs
docker compose -f docker-compose.dev.yml ps

# Santé des services
docker compose -f docker-compose.dev.yml exec database mysqladmin ping
```

## Dépannage

### Problèmes courants

#### 0. Hot reload ne fonctionne pas sur Windows

Le hot reload est configuré pour utiliser le polling sur Windows. Si cela ne fonctionne toujours pas :

```bash
# Redémarrer le conteneur de l'application
docker compose -f docker-compose.dev.yml restart app

# Vérifier que les variables d'environnement sont bien définies
docker compose -f docker-compose.dev.yml exec app env | grep CHOKIDAR

# Si le problème persiste, reconstruire l'image
docker compose -f docker-compose.dev.yml up -d --build app
```

**Note** : Le polling peut augmenter légèrement l'utilisation CPU. C'est normal sur Windows avec Docker.

#### 1. Erreur de connexion à la base de données

```bash
# Vérifier que la base est bien démarrée
docker compose -f docker-compose.dev.yml ps database

# Vérifier les logs
docker compose -f docker-compose.dev.yml logs database

# Recréer le conteneur
docker compose -f docker-compose.dev.yml up -d --force-recreate database
```

#### 2. Port déjà utilisé

```bash
# Identifier le processus utilisant le port
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows

# Modifier le port dans docker-compose
ports:
  - "3001:3000"  # Utiliser le port 3001 à la place
```

#### 3. Problèmes de permissions sur les volumes

```bash
# Réparer les permissions
docker compose -f docker-compose.dev.yml exec app chown -R node:node /app
```

#### 4. Espace disque insuffisant

```bash
# Nettoyer les images et conteneurs inutilisés
docker system prune -a

# Nettoyer les volumes non utilisés
docker volume prune
```

### Reset complet

```bash
# Arrêter tous les services
docker compose -f docker-compose.dev.yml down

# Supprimer les volumes (ATTENTION : supprime les données)
docker compose -f docker-compose.dev.yml down -v

# Reconstruire et redémarrer
docker compose -f docker-compose.dev.yml up -d --build
```

## Optimisation

### Build multi-stage pour production

Le Dockerfile utilise une approche simplifiée. Pour une optimisation maximale en production :

```dockerfile
# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

### Cache des dépendances

Pour accélérer les builds :

```bash
# Utiliser BuildKit
DOCKER_BUILDKIT=1 docker build -t convention-app:latest .

# Avec docker-compose
COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1 docker compose build
```

## Sécurité

### Bonnes pratiques

1. **Jamais** committer le fichier `.env` dans Git
2. Utiliser des mots de passe forts et uniques
3. Limiter l'accès aux ports (firewall)
4. Mettre à jour régulièrement les images Docker
5. Scanner les vulnérabilités : `docker scan convention-app:latest`

### Variables d'environnement sensibles

En production, utiliser des secrets Docker ou un gestionnaire de secrets :

```bash
# Créer un secret
echo "mon_password" | docker secret create db_password -

# Utiliser dans docker-compose
secrets:
  db_password:
    external: true
```

## Support et ressources

- [Documentation Docker](https://docs.docker.com/)
- [Documentation Docker Compose](https://docs.docker.com/compose/)
- [Documentation Nuxt](https://nuxt.com/docs)
- [Documentation Prisma](https://www.prisma.io/docs)
