# 🐳 Convention de Jonglerie - Docker Setup

## Installation et démarrage rapide

### Prérequis
- Docker et Docker Compose installés
- Ports 3000, 3306, et 8080 disponibles

### 🚀 Démarrage en production

1. **Cloner le projet**
```bash
git clone https://github.com/powange/convention-de-jonglerie.git
cd convention-de-jonglerie
```

2. **Configurer l'environnement**
```bash
cp .env.docker.example .env.docker
# Éditez .env.docker avec vos valeurs
```

3. **Lancer l'application**
```bash
docker-compose up -d
```

4. **Accéder à l'application**
- Application : http://localhost:3000
- Adminer (BDD) : http://localhost:8080

### 🛠️ Développement

```bash
# Lancer en mode développement
docker-compose -f docker-compose.dev.yml up -d

# Accès en développement
# Application : http://localhost:3001
# Adminer : http://localhost:8081
```

## Services disponibles

| Service | Production | Développement | Description |
|---------|------------|---------------|-------------|
| App | :3000 | :3001 | Application Nuxt.js |
| MySQL | :3306 | :3307 | Base de données |
| Adminer | :8080 | :8081 | Interface BDD |

## Commandes utiles

### Gestion des conteneurs
```bash
# Démarrer tous les services
docker-compose up -d

# Arrêter tous les services
docker-compose down

# Voir les logs
docker-compose logs -f app

# Redémarrer un service
docker-compose restart app
```

### Base de données
```bash
# Exécuter les migrations
docker-compose exec app npx prisma migrate deploy

# Réinitialiser la base de données
docker-compose exec app npx prisma migrate reset

# Accéder à MySQL directement
docker-compose exec database mysql -u convention_user -p convention_db
```

### Développement
```bash
# Construire uniquement l'image
docker-compose build app

# Entrer dans le conteneur
docker-compose exec app sh

# Installer de nouvelles dépendances
docker-compose exec app npm install package-name
```

## Structure Docker

```
.
├── Dockerfile                 # Image de l'application
├── docker-compose.yml         # Production
├── docker-compose.dev.yml     # Développement
├── .dockerignore              # Fichiers ignorés
├── .env.docker.example        # Variables d'environnement
└── docker/
    └── mysql/
        └── init/
            └── 01-init.sql    # Initialisation BDD
```

## Variables d'environnement importantes

### Production (obligatoires)
- `JWT_SECRET` : Clé secrète JWT (32+ caractères)
- `DATABASE_URL` : URL de connexion MySQL
- `NODE_ENV=production`

### Optionnelles
- `APP_URL` : URL publique de l'application
- `UPLOAD_PATH` : Chemin des uploads

## Sécurité

⚠️ **Avant la mise en production :**

1. **Changez les mots de passe par défaut**
   - `MYSQL_ROOT_PASSWORD`
   - `MYSQL_PASSWORD` 
   - `JWT_SECRET`

2. **Configurez un reverse proxy** (nginx/traefik)

3. **Activez HTTPS**

4. **Limitez l'exposition des ports**

## Dépannage

### Problèmes courants

**Port déjà utilisé :**
```bash
# Changer le port dans docker-compose.yml
ports:
  - "3001:3000"  # Au lieu de 3000:3000
```

**Erreur de connexion à la base :**
```bash
# Vérifier que la BDD est prête
docker-compose logs database

# Redémarrer l'application
docker-compose restart app
```

**Permissions uploads :**
```bash
# Fixer les permissions
sudo chown -R 1001:1001 ./public/uploads
```

### Logs et debugging
```bash
# Logs de tous les services
docker-compose logs

# Logs d'un service spécifique
docker-compose logs -f app

# État des conteneurs
docker-compose ps

# Utilisation des ressources
docker stats
```

## Production deployment

### Avec Docker Swarm
```bash
docker stack deploy -c docker-compose.yml convention
```

### Avec Kubernetes
Convertir avec kompose :
```bash
kompose convert -f docker-compose.yml
```

## Sauvegarde des données

```bash
# Sauvegarde MySQL
docker-compose exec database mysqldump -u root -p convention_db > backup.sql

# Sauvegarde des uploads
tar -czf uploads-backup.tar.gz ./public/uploads
```

---

🚀 **Votre application Convention de Jonglerie est maintenant dockerisée !**