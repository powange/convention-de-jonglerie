# Convention de Jonglerie - Application Web

![CI Tests](https://github.com/powange/convention-de-jonglerie/actions/workflows/tests.yml/badge.svg)

Ce projet est une application web complète (full-stack) dédiée à la gestion et à la découverte de conventions de jonglerie.

## Objectif du Projet

L'application permet aux utilisateurs de :

- Consulter une liste de conventions de jonglerie.
- Ajouter de nouvelles conventions avec des détails complets.
- Modifier et supprimer les conventions qu'ils ont créées.
- Marquer des conventions comme favorites.
- Gérer leur profil utilisateur (inscription, connexion, déconnexion).

## Technologies Utilisées

- **Frontend :**
  - [Nuxt.js](https://nuxt.com/) (v4.0.1) : Framework Vue.js pour le développement d'applications universelles.
  - [Nuxt UI](https://ui.nuxt.com/) (v3.3.0) : Bibliothèque de composants UI basée sur Tailwind CSS et Headless UI.
  - [Pinia](https://pinia.vuejs.org/) : Solution de gestion d'état pour Vue.js.
- **Backend :**
  - [Nitro](https://nitro.unjs.io/) : Moteur de serveur de Nuxt.js pour la création d'API RESTful.
- **Base de Données :**
  - MySQL : Système de gestion de base de données relationnelle.
  - [Prisma](https://www.prisma.io/) : ORM (Object-Relational Mapper) pour interagir avec la base de données.
- **Langage :**
  - [TypeScript](https://www.typescriptlang.org/) : Langage de programmation typé pour une meilleure maintenabilité.
- **Authentification :**
  - Sessions scellées via nuxt-auth-utils (remplace JWT). Voir `docs/AUTH_SESSIONS.md`.

## Fonctionnalités Clés

- **Gestion des Utilisateurs :**
  - Inscription avec vérification email par code à 6 chiffres
  - Connexion, déconnexion, et gestion des profils
  - Système de renvoi de code de vérification
- **Gestion des Conventions :**
  - **CRUD complet :** Création, lecture, mise à jour et suppression de conventions.
  - **Détails riches :** Nom, description, dates, adresse complète, liens externes (billetterie, réseaux sociaux), et services disponibles (restauration, zone enfants, animaux, camping, salle de sport).
  - **Filtrage :** Recherche et filtrage des conventions par nom et dates.
  - **Géolocalisation :** Géocodage automatique des adresses pour affichage sur carte.
- **Favoris :** Possibilité pour les utilisateurs authentifiés de marquer des conventions comme favorites.
- **Cartes Interactives :**
  - Visualisation géographique des éditions favorites à venir avec Leaflet
  - Carte des éditions filtrées sur la page d'accueil
  - Marqueurs colorés selon le statut temporel (passé/en cours/à venir)
- **Interface Utilisateur :** Navigation intuitive et réactive, notifications via toasts.
- **Sécurité :** Middleware d'authentification pour protéger les routes et les API.

### Modèle de Permissions Collaborateurs

Le système ne repose plus sur des rôles (ex: ADMINISTRATOR / MODERATOR) mais sur un ensemble de droits granulaires appliqués aux collaborateurs d'une convention.

Champs de droits stockés sur `ConventionCollaborator` :

| Droit               | Colonne                | Description                                                                                  |
| ------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| editConvention      | canEditConvention      | Modifier les métadonnées de la convention                                                    |
| deleteConvention    | canDeleteConvention    | Supprimer la convention                                                                      |
| manageCollaborators | canManageCollaborators | Ajouter / retirer des collaborateurs et modifier leurs droits                                |
| addEdition          | canAddEdition          | Créer de nouvelles éditions                                                                  |
| editAllEditions     | canEditAllEditions     | Modifier n'importe quelle édition (sinon seulement celles créées ou permissions spécifiques) |
| deleteAllEditions   | canDeleteAllEditions   | Supprimer n'importe quelle édition                                                           |

Une permission par édition (table `EditionCollaboratorPermission`) permet d'accorder `canEdit` / `canDelete` sur une édition précise lorsqu'un collaborateur ne possède pas les droits globaux.

Format d'un collaborateur retourné par l'API :

```jsonc
{
  "id": 12,
  "addedAt": "2025-08-23T10:11:12.000Z",
  "title": "Créateur",
  "rights": {
    "editConvention": true,
    "deleteConvention": true,
    "manageCollaborators": true,
    "addEdition": true,
    "editAllEditions": true,
    "deleteAllEditions": true,
  },
  "user": { "id": 5, "pseudo": "alice", "emailHash": "..." },
  "addedBy": { "id": 5, "pseudo": "alice" },
}
```

Endpoints principaux (extraits) :

- `POST /api/conventions/:id/collaborators` body : `{ userIdentifier | userId, rights?: { ... }, title?: string }`
- `PUT /api/conventions/:id/collaborators/:collaboratorId` body : `{ rights?: { ... }, title?: string }`

Les handlers ignorent désormais tout champ `role` legacy. Les tests garantissent l'absence de régression. Pour l'affichage, un titre synthétique peut être dérivé côté frontend via un composable (`useCollaboratorTitle`) qui mappe la densité des droits vers des labels i18n (`permissions.admin`, `permissions.manager`, etc.).

## Structure du Projet

- `app/` : Contient le code source du frontend Nuxt.js (pages, composants, stores Pinia, middleware).
- `server/api/` : Définit les points de terminaison de l'API backend pour l'authentification et la gestion des conventions.
- `prisma/` : Contient le schéma de base de données Prisma (`schema.prisma`) et les migrations.
- `public/` : Fichiers statiques (ex: favicon).

## Démarrage Rapide

Assurez-vous d'avoir Node.js, npm (ou pnpm, yarn, bun) et MySQL installés.

1.  **Cloner le dépôt :**

    ```bash
    git clone <URL_DU_DEPOT>
    cd convention-de-jonglerie
    ```

2.  **Installation des dépendances :**

    ```bash
    npm install
    # ou pnpm install / yarn install / bun install
    ```

3.  **Configuration de l'environnement :**
    - Créez un fichier `.env` à la racine du projet et configurez les variables suivantes :
      ```env
      # Base de données
      DATABASE_URL="mysql://user:password@host:port/database_name"

      ```

    # Authentification par session (nuxt-auth-utils)

    # Obligatoire en prod: mot de passe de session robuste (32+ chars)

    NUXT_SESSION_PASSWORD="change_me_very_secret_32_chars_min"

        # Configuration des emails
        SEND_EMAILS=false                    # true pour envoi réel, false pour simulation
        SMTP_USER="votre.email@gmail.com"   # Requis si SEND_EMAILS=true
        SMTP_PASS="mot_de_passe_application" # Requis si SEND_EMAILS=true

        # Variables Docker (optionnelles, valeurs par défaut fournies)
        MYSQL_ROOT_PASSWORD="rootpassword"
        MYSQL_DATABASE="convention_db"
        MYSQL_USER="convention_user"
        MYSQL_PASSWORD="convention_password"
        ```

    - Appliquez les migrations Prisma pour créer la base de données et les tables :
      ```bash
      npx prisma migrate dev
      ```
    - Générez le client Prisma :
      ```bash
      npx prisma generate
      ```

4.  **Lancer le serveur de développement :**
    ```bash
    npm run dev
    # ou pnpm dev / yarn dev / bun run dev
    ```
    L'application sera accessible sur `http://localhost:3000`.

## Build pour la Production

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

## Prévisualisation de la Production (localement)

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Pour plus d'informations sur le déploiement, consultez la [documentation Nuxt](https://nuxt.com/docs/getting-started/deployment).

## Configuration des Emails

L'application dispose d'un système de vérification email lors de l'inscription. Deux modes sont disponibles :

### Mode Simulation (Développement)

```env
SEND_EMAILS=false
```

- Les emails ne sont pas envoyés réellement
- Le code de vérification s'affiche dans la console du serveur
- Idéal pour le développement et les tests

### Mode Envoi Réel (Production)

```env
SEND_EMAILS=true
SMTP_USER="votre.email@gmail.com"
SMTP_PASS="mot_de_passe_application_gmail"
```

- Les emails sont envoyés via Gmail SMTP
- Nécessite un mot de passe d'application Gmail (pas votre mot de passe principal)
- Pour générer un mot de passe d'application : [Guide Google](https://support.google.com/accounts/answer/185833)

### Géocodage des Adresses

L'application dispose d'un script pour géocoder automatiquement les adresses des éditions :

```bash
# Géocoder toutes les éditions sans coordonnées
node scripts/geocode-existing-editions.js
```

Ce script utilise l'API Nominatim (OpenStreetMap) avec une stratégie de fallback pour maximiser le taux de succès.
