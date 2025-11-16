# Analyse des clés i18n dans les pages admin

## Objectif

Ce document recense toutes les clés de traduction i18n utilisées dans les pages admin qui ne proviennent **PAS** des domaines `admin.*` ou `common.*`.

Cette analyse permet de :

- Identifier les dépendances croisées entre domaines de traduction
- Faciliter les futures restructurations ou refactorisations
- Assurer la cohérence des traductions utilisées

## Pages analysées

### 1. `/app/pages/admin/conventions.vue`

**Fonction** : Page d'administration pour gérer les conventions

**Clés non-admin/common utilisées** :

| Domaine      | Clé               | Ligne(s) | Usage                          |
| ------------ | ----------------- | -------- | ------------------------------ |
| `navigation` | `breadcrumb`      | 4        | Navigation fil d'Ariane        |
| `edition`    | `online_status`   | 301, 557 | Statut en ligne de l'édition   |
| `edition`    | `offline_edition` | 560      | Édition hors ligne             |
| `errors`     | `loading_error`   | 117      | Message d'erreur de chargement |
| `errors`     | `server_error`    | 118      | Message d'erreur serveur       |

### 2. `/app/pages/admin/error-logs.vue`

**Fonction** : Page d'administration pour consulter et gérer les logs d'erreurs API

**Clés non-admin/common utilisées** :

| Domaine      | Clé               | Ligne(s) | Usage                          |
| ------------ | ----------------- | -------- | ------------------------------ |
| `navigation` | `breadcrumb`      | 4        | Navigation fil d'Ariane        |
| `errors`     | `loading_error`   | 117      | Message d'erreur de chargement |
| `log`        | `add_admin_notes` | 482      | Ajouter des notes admin        |
| `log`        | `full_url`        | 359      | URL complète du log            |
| `log`        | `ip`              | 362      | Adresse IP                     |
| `log`        | `method`          | 353      | Méthode HTTP                   |
| `log`        | `path`            | 356      | Chemin de la requête           |
| `log`        | `resolution`      | 465      | Résolution du log              |
| `log`        | `user`            | 365      | Utilisateur concerné           |

### 3. `/app/pages/admin/feedback.vue`

**Fonction** : Page d'administration pour gérer les retours utilisateurs

**Clés non-admin/common utilisées** :

| Domaine      | Clé          | Ligne(s) | Usage                   |
| ------------ | ------------ | -------- | ----------------------- |
| `navigation` | `breadcrumb` | 4        | Navigation fil d'Ariane |

**Note** : Cette page utilise principalement des clés `admin.*` comme attendu.

### 4. `/app/pages/admin/notifications.vue`

**Fonction** : Page d'administration pour envoyer et gérer les notifications

**Clés non-admin/common utilisées** :

| Domaine         | Clé          | Ligne(s) | Usage                   |
| --------------- | ------------ | -------- | ----------------------- |
| `navigation`    | `breadcrumb` | 4        | Navigation fil d'Ariane |
| `notifications` | `unread`     | 118      | Notifications non lues  |
| `calendar`      | `today`      | 132      | Référence à aujourd'hui |

### 5. `/app/pages/admin/index.vue`

**Fonction** : Tableau de bord principal de l'administration

**Clés non-admin/common utilisées** :

| Domaine      | Clé                         | Ligne(s) | Usage                      |
| ------------ | --------------------------- | -------- | -------------------------- |
| `admin_mode` | `admin_mode_disabled`       | 731      | Mode admin désactivé       |
| `admin_mode` | `admin_mode_disabled_desc`  | 732      | Description mode désactivé |
| `admin_mode` | `admin_mode_enabled`        | 730      | Mode admin activé          |
| `admin_mode` | `admin_mode_enabled_desc`   | 731      | Description mode activé    |
| `profile`    | `activate_admin_privileges` | 37       | Activer privilèges admin   |
| `profile`    | `admin_access_all`          | 36       | Accès admin complet        |
| `profile`    | `admin_active`              | 49       | Admin actif                |
| `profile`    | `admin_mode`                | 32       | Mode admin                 |
| `profile`    | `normal_active`             | 50       | Mode normal actif          |

### 6. `/app/pages/admin/users/[id].vue`

**Fonction** : Page d'administration pour consulter/modifier un profil utilisateur

**Clés non-admin/common utilisées** :

| Domaine      | Clé             | Ligne(s) | Usage                          |
| ------------ | --------------- | -------- | ------------------------------ |
| `navigation` | `breadcrumb`    | 4        | Navigation fil d'Ariane        |
| `auth`       | `first_name`    | 123      | Prénom                         |
| `auth`       | `last_name`     | 128      | Nom de famille                 |
| `auth`       | `username`      | 119, 156 | Nom d'utilisateur              |
| `errors`     | `loading_error` | 37       | Message d'erreur de chargement |
| `profile`    | `member_since`  | 139      | Membre depuis                  |
| `profile`    | `personal_info` | 107      | Informations personnelles      |
| `profile`    | `phone`         | 133, 176 | Téléphone                      |

### 7. `/app/pages/admin/import-edition.vue`

**Fonction** : Page d'administration pour importer des éditions de conventions

**Clés non-admin/common utilisées** :

| Domaine      | Clé          | Ligne(s) | Usage                   |
| ------------ | ------------ | -------- | ----------------------- |
| `navigation` | `breadcrumb` | 4        | Navigation fil d'Ariane |

**Note** : Cette page utilise principalement des clés `admin.import.*` comme attendu.

### 8. `/app/pages/admin/crons.vue`

**Fonction** : Page d'administration pour gérer les tâches planifiées (cron jobs)

**Clés non-admin/common utilisées** :

| Domaine      | Clé          | Ligne(s) | Usage                   |
| ------------ | ------------ | -------- | ----------------------- |
| `navigation` | `breadcrumb` | 4        | Navigation fil d'Ariane |

**Note** : Cette page utilise principalement des clés `admin.*` comme attendu.

### 9. `/app/pages/admin/backup.vue`

**Fonction** : Page d'administration pour gérer les sauvegardes et restaurations

**Clés non-admin/common utilisées** :

| Domaine      | Clé          | Ligne(s) | Usage                   |
| ------------ | ------------ | -------- | ----------------------- |
| `navigation` | `breadcrumb` | 4        | Navigation fil d'Ariane |

**Note** : Cette page utilise principalement des clés `admin.*` comme attendu.

### 10. `/app/pages/admin/users/index.vue`

**Fonction** : Page d'administration pour lister et gérer les utilisateurs

**Clés non-admin/common utilisées** :

| Domaine      | Clé          | Ligne(s) | Usage                   |
| ------------ | ------------ | -------- | ----------------------- |
| `navigation` | `breadcrumb` | 4        | Navigation fil d'Ariane |

**Note** : Cette page utilise principalement des clés `admin.*` comme attendu.

## Récapitulatif par domaine de traduction

### `navigation.*`

- **Utilisé dans** : 9 pages (conventions, error-logs, feedback, notifications, users/index, users/[id], import-edition, crons, backup)
- **Clé principale** : `breadcrumb`
- **Usage** : Fil d'Ariane de navigation
- **Note** : Seule la page `/admin/index.vue` (dashboard principal) n'utilise pas le breadcrumb car elle est le point de départ de la navigation admin

### `edition.*`

- **Utilisé dans** : conventions.vue
- **Clés** : `online_status`, `offline_edition`
- **Usage** : Statut des éditions

### `errors.*`

- **Utilisé dans** : 3 pages (conventions, error-logs, users/[id])
- **Clés** : `loading_error`, `server_error`
- **Usage** : Messages d'erreur génériques

### `log.*`

- **Utilisé dans** : error-logs.vue
- **Clés** : `add_admin_notes`, `full_url`, `ip`, `method`, `path`, `resolution`, `user`
- **Usage** : Détails des logs d'erreur

### `notifications.*`

- **Utilisé dans** : notifications.vue
- **Clé** : `unread`
- **Usage** : Compteur de notifications non lues

### `calendar.*`

- **Utilisé dans** : notifications.vue
- **Clé** : `today`
- **Usage** : Référence temporelle

### `admin_mode.*`

- **Utilisé dans** : index.vue
- **Clés** : `admin_mode_disabled`, `admin_mode_disabled_desc`, `admin_mode_enabled`, `admin_mode_enabled_desc`
- **Usage** : Basculement du mode admin

### `profile.*`

- **Utilisé dans** : index.vue, users/[id].vue
- **Clés** : `activate_admin_privileges`, `admin_access_all`, `admin_active`, `admin_mode`, `normal_active`, `member_since`, `personal_info`, `phone`
- **Usage** : Informations de profil utilisateur

### `auth.*`

- **Utilisé dans** : users/[id].vue
- **Clés** : `first_name`, `last_name`, `username`
- **Usage** : Champs d'authentification

## Recommandations

1. **Cohérence ✅** : Toutes les pages admin (sauf le dashboard principal) utilisent maintenant correctement `navigation.breadcrumb` pour le fil d'Ariane. Cette cohérence a été appliquée le 15 novembre 2025.
   - Pages avec breadcrumb : conventions, error-logs, feedback, notifications, users/index, users/[id], import-edition, crons, backup
   - Page sans breadcrumb : index (dashboard principal - point de départ de la navigation)

2. **Domaine `errors.*`** : Les messages d'erreur sont partagés entre plusieurs pages. Cela évite la duplication et est une bonne pratique.

3. **Domaine `profile.*` et `auth.*`** : Ces clés sont réutilisées dans différents contextes (admin et profil utilisateur), ce qui montre une bonne réutilisation des traductions.

4. **Domaine `admin_mode.*`** : Pourrait potentiellement être fusionné avec `admin.*` ou `profile.*` selon la stratégie de namespacing choisie.

5. **Domaine `log.*`** : Spécifique aux logs d'erreur, bien séparé du domaine `admin.*`.

## Date de création

Document créé le 15 novembre 2025

## Auteur

Analyse réalisée par Claude Code
