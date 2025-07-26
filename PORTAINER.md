# 🐳 Déploiement avec Portainer

## Méthode 1: Via Git Repository (Recommandé)

1. **Accédez à Portainer** → Stacks → Add stack
2. **Sélectionnez "Git Repository"**
3. **Configurez :**
   - **Name** : `convention-de-jonglerie`
   - **Repository URL** : `https://github.com/powange/convention-de-jonglerie`
   - **Repository reference** : `main`
   - **Compose path** : `portainer-stack.yml`

4. **Variables d'environnement** :
   ```
   MYSQL_ROOT_PASSWORD=votre_mot_de_passe_root_secure
   MYSQL_DATABASE=convention_db
   MYSQL_USER=convention_user
   MYSQL_PASSWORD=votre_mot_de_passe_user_secure
   JWT_SECRET=votre-cle-jwt-super-secrete-32-caracteres-minimum
   APP_URL=http://votre-domaine.com
   ```

5. **Déployez** la stack

## Méthode 2: Upload du fichier

1. **Accédez à Portainer** → Stacks → Add stack
2. **Sélectionnez "Upload"**
3. **Uploadez** `docker-compose.yml` ou `portainer-stack.yml`
4. **Ajoutez les variables d'environnement** (voir ci-dessus)
5. **Déployez** la stack

## Configuration des variables

### Variables obligatoires
- `MYSQL_ROOT_PASSWORD` : Mot de passe root MySQL
- `MYSQL_PASSWORD` : Mot de passe utilisateur MySQL
- `JWT_SECRET` : Clé secrète JWT (32+ caractères)

### Variables optionnelles
- `APP_PORT` : Port de l'application (défaut: 3000)
- `DB_PORT` : Port MySQL (défaut: 3306)
- `ADMINER_PORT` : Port Adminer (défaut: 8080)
- `APP_URL` : URL publique de l'application

## Accès aux services

Une fois déployé :
- **Application** : http://your-server:3000
- **Adminer** : http://your-server:8080
  - Serveur : `database`
  - Utilisateur : `convention_user`
  - Base : `convention_db`

## Gestion des volumes

Les données sont persistées dans des volumes Docker :
- `mysql_data` : Base de données
- `uploads_data` : Fichiers uploadés

## Mise à jour

Pour mettre à jour l'application :
1. Dans Portainer → Stacks → convention-de-jonglerie
2. Cliquez sur "Update the stack"
3. Pull la nouvelle image si nécessaire

## Logs et monitoring

- **Logs** : Portainer → Containers → Sélectionnez le container → Logs
- **Stats** : Portainer → Containers → Sélectionnez le container → Stats

## Sécurité

⚠️ **Avant la mise en production :**

1. **Changez tous les mots de passe par défaut**
2. **Configurez un reverse proxy** (Traefik/nginx)
3. **Activez HTTPS**
4. **Limitez l'exposition des ports**