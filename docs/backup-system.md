# Système de Sauvegarde de Base de Données

Le système de sauvegarde permet aux super administrateurs de créer, gérer et restaurer des sauvegardes complètes de la base de données MySQL.

## Vue d'ensemble

Le système de sauvegarde utilise les outils natifs MySQL (`mysqldump` et `mysql`) intégrés dans le conteneur Docker de l'application pour assurer une compatibilité et une fiabilité maximales.

## Fonctionnalités

### 1. Création de sauvegarde

- **Format** : Fichiers SQL générés avec `mysqldump`
- **Contenu** : Sauvegarde complète incluant structure et données
- **Options** : `--single-transaction`, `--routines`, `--triggers`, `--events`
- **Nommage** : `backup-YYYY-MM-DDTHH-mm-ss-sssZ.sql`

### 2. Liste des sauvegardes

- Affichage de toutes les sauvegardes disponibles
- Informations : nom, date de création, taille
- Tri par date (plus récent en premier)

### 3. Restauration

- **Depuis fichier existant** : Sélection d'une sauvegarde stockée
- **Upload de fichier** : Import d'un fichier SQL externe
- **Validation** : Vérification du format .sql
- **Sécurité** : Utilisation de fichiers temporaires

### 4. Téléchargement

- Export local des fichiers de sauvegarde
- Headers HTTP appropriés pour le téléchargement

### 5. Suppression

- Suppression sécurisée des sauvegardes obsolètes
- Confirmation utilisateur requise

## Architecture technique

### APIs disponibles

#### `POST /api/admin/backup/create`

Crée une nouvelle sauvegarde de la base de données.

**Réponse :**

```json
{
  "success": true,
  "filename": "backup-2025-01-15T10-30-00-000Z.sql",
  "path": "/app/backup/backup-2025-01-15T10-30-00-000Z.sql",
  "size": 1024000
}
```

#### `GET /api/admin/backup/list`

Retourne la liste des sauvegardes disponibles.

**Réponse :**

```json
[
  {
    "filename": "backup-2025-01-15T10-30-00-000Z.sql",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "size": 1024000
  }
]
```

#### `POST /api/admin/backup/restore`

Restaure la base de données depuis une sauvegarde.

**Corps de la requête (fichier existant) :**

```json
{
  "filename": "backup-2025-01-15T10-30-00-000Z.sql"
}
```

**Corps de la requête (upload):** `multipart/form-data` avec fichier .sql

#### `GET /api/admin/backup/download?filename=xxx.sql`

Télécharge un fichier de sauvegarde.

#### `DELETE /api/admin/backup/delete`

Supprime un fichier de sauvegarde.

**Corps de la requête :**

```json
{
  "filename": "backup-2025-01-15T10-30-00-000Z.sql"
}
```

### Permissions

- **Accès** : Super administrateurs uniquement (`isGlobalAdmin = true`)
- **Vérification** : `requireGlobalAdminWithDbCheck()`
- **Middleware** : `['auth-protected', 'super-admin']`

### Stockage

- **Répertoire** : `/app/backup/` dans le conteneur
- **Volume Docker** : Persistance via volumes Docker
- **Format** : Fichiers .sql standard MySQL

## Configuration Docker

Le système nécessite l'installation de `default-mysql-client` dans le conteneur :

```dockerfile
RUN apt-get update && apt-get install -y curl openssl default-mysql-client && rm -rf /var/lib/apt/lists/*
```

Cette modification est appliquée aux stages `base` et `runtime` du Dockerfile.

## Interface utilisateur

### Page d'administration

- **URL** : `/admin/backup`
- **Accès** : Lien depuis `/admin`
- **Fonctionnalités** :
  - Bouton "Créer une sauvegarde"
  - Bouton "Importer une sauvegarde"
  - Liste des sauvegardes avec actions (Restaurer, Télécharger, Supprimer)
  - Modal de confirmation pour les restaurations

### Gestion des erreurs

- Validation des formats de fichiers
- Messages d'erreur explicites
- Gestion des timeouts et des erreurs de connexion
- Logs détaillés pour le debugging

## Sécurité

### Mesures de protection

- **Authentification** : Vérification super admin obligatoire
- **Validation** : Contrôle strict des formats de fichiers
- **Isolation** : Utilisation de fichiers temporaires
- **Nettoyage** : Suppression automatique des fichiers temporaires
- **Logs** : Traçabilité de toutes les opérations

### Bonnes pratiques

- Les mots de passe ne sont jamais exposés dans les logs
- Les fichiers temporaires sont supprimés après usage
- Les opérations sont atomiques via les outils MySQL natifs
- Gestion appropriée des erreurs et des timeouts

## Limitations

### Taille des sauvegardes

- **Buffer maximum** : 50MB pour la création, 100MB pour la restauration
- **Timeout** : Délais configurables selon la taille de la base

### Concurrence

- Une seule opération de sauvegarde/restauration à la fois recommandée
- Les opérations de lecture (liste, téléchargement) peuvent être simultanées

## Maintenance

### Nettoyage périodique

Il est recommandé de supprimer régulièrement les anciennes sauvegardes pour économiser l'espace de stockage.

### Monitoring

- Surveillance de l'espace disque disponible
- Vérification de l'intégrité des sauvegardes créées
- Logs des opérations de sauvegarde/restauration

## Dépannage

### Erreurs communes

#### "mysqldump: not found"

- **Cause** : Outils MySQL non installés dans le conteneur
- **Solution** : Reconstruire l'image Docker avec les modifications

#### "Access denied for user"

- **Cause** : Configuration de connexion incorrecte
- **Solution** : Vérifier la variable `DATABASE_URL`

#### "File too large"

- **Cause** : Sauvegarde dépassant la limite du buffer
- **Solution** : Augmenter `maxBuffer` dans les APIs

### Debugging

- Vérifier les logs du conteneur : `npm run docker:dev:logs`
- Tester la connexion MySQL : Accès via Adminer sur http://localhost:8080
- Vérifier les permissions des fichiers dans `/app/backup/`
