# Convention de Jonglerie - Application Web

![CI Tests](https://github.com/powange/convention-de-jonglerie/actions/workflows/test.yml/badge.svg)

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
  - [Nuxt 4](https://nuxt.com/) (v4.4.2+) : Framework Vue.js (Vue 3) universel
  - [Nuxt UI 4](https://ui.nuxt.com/) (v4.5.1+) : Bibliothèque de composants UI basée sur Tailwind CSS
  - [Pinia](https://pinia.vuejs.org/) (v3.x) : Gestion d'état pour Vue.js
  - [@nuxtjs/i18n](https://i18n.nuxtjs.org/) : Internationalisation (12 langues, lazy loading par domaine)
  - [Chart.js](https://www.chartjs.org/), [FullCalendar](https://fullcalendar.io/), [Leaflet](https://leafletjs.com/)
- **Backend :**
  - [Nitro](https://nitro.unjs.io/) : Moteur de serveur de Nuxt pour la création d'API RESTful
- **Base de Données :**
  - MySQL / MariaDB
  - [Prisma](https://www.prisma.io/) (v7.x) : ORM
- **Langage :**
  - [TypeScript](https://www.typescriptlang.org/) (v5.x)
- **Authentification :**
  - Sessions scellées par cookie via [nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils). Voir [`docs/system/AUTH_SESSIONS.md`](docs/system/AUTH_SESSIONS.md).
- **Tests :**
  - [Vitest](https://vitest.dev/) (unit + Nuxt) et [Playwright](https://playwright.dev/) (e2e)

## Fonctionnalités Clés

### Gestion des utilisateurs

- Inscription avec vérification email par code à 6 chiffres
- Connexion / déconnexion / réinitialisation de mot de passe
- Profil utilisateur (avatar Gravatar, préférences notifications)

### Conventions & éditions

- **CRUD complet** sur conventions et éditions
- **Métadonnées riches** : adresse, dates, fuseau horaire, liens externes (billetterie, réseaux sociaux), services (restauration, zone enfants, camping, gym, etc.)
- **Géocodage automatique** des adresses (Nominatim/OpenStreetMap)
- **Favoris** par utilisateur
- **Statuts** : `PLANNED`, `PUBLISHED`, `OFFLINE`, `CANCELLED`

### Modules optionnels (activables par édition)

- **Bénévoles** ([`docs/volunteers/`](docs/volunteers/)) — Candidatures, équipes, créneaux, planning, notifications, mode interne ou externe
- **Artistes & Spectacles** ([`docs/shows-call.md`](docs/shows-call.md)) — Appels à spectacles, candidatures, sondage de notation
- **Repas** ([`docs/meals.md`](docs/meals.md)) — Configuration, sélections bénévoles/artistes, validation à l'entrée du buffet, intégration billetterie
- **Tâches** ([`docs/tasks.md`](docs/tasks.md)) — Organisation interne du travail par groupes (liste + kanban)
- **Workshops** ([`docs/workshops.md`](docs/workshops.md)) — Ateliers proposés par les participants avec favoris
- **Billetterie** ([`docs/ticketing/`](docs/ticketing/)) — Tarifs, options, quotas, commandes, contrôle d'accès, intégrations HelloAsso/SumUp
- **Carte du site** — Plan interactif des éditions avec zones et marqueurs
- **Covoiturage** ([`docs/carpool.md`](docs/carpool.md)) — Offres / demandes / réservations entre participants
- **Objets trouvés** ([`docs/lost-found.md`](docs/lost-found.md)) — Signalement et restitution d'objets

### Interactivité

- **Notifications** ([`docs/system/NOTIFICATION_SYSTEM.md`](docs/system/NOTIFICATION_SYSTEM.md)) — In-app, email et push web (Firebase)
- **Cartes interactives** — Leaflet pour les éditions favorites et la page d'accueil
- **Calendrier** — FullCalendar pour le planning bénévoles et le calendrier des éditions
- **Messagerie** ([`docs/messenger.md`](docs/messenger.md)) — Conversations privées, groupes d'équipes, organisateurs, artistes (temps réel via SSE)
- **Toasts** et **modales** Nuxt UI pour les actions
- **i18n** — 12 langues synchronisées avec lazy loading par domaine

### Modèle de Permissions Organisateurs

Le système repose sur un ensemble de droits granulaires appliqués aux organisateurs d'une convention (pas de rôles).

Champs de droits stockés sur `ConventionOrganizer` :

| Droit             | Colonne              | Description                                                  |
| ----------------- | -------------------- | ------------------------------------------------------------ |
| editConvention    | canEditConvention    | Modifier les métadonnées de la convention                    |
| deleteConvention  | canDeleteConvention  | Supprimer la convention                                      |
| manageOrganizers  | canManageOrganizers  | Ajouter / retirer des organisateurs et modifier leurs droits |
| addEdition        | canAddEdition        | Créer de nouvelles éditions                                  |
| editAllEditions   | canEditAllEditions   | Modifier toutes les éditions de la convention                |
| deleteAllEditions | canDeleteAllEditions | Supprimer toutes les éditions de la convention               |
| manageVolunteers  | canManageVolunteers  | Gérer les bénévoles de toutes les éditions                   |
| manageArtists     | canManageArtists     | Gérer les artistes de toutes les éditions                    |
| manageMeals       | canManageMeals       | Gérer les repas de toutes les éditions                       |
| manageTicketing   | canManageTicketing   | Gérer la billetterie de toutes les éditions                  |
| manageTasks       | canManageTasks       | Gérer les tâches internes de toutes les éditions             |

La table `EditionOrganizerPermission` permet d'accorder ces droits **per-édition** lorsqu'un organisateur ne possède pas les droits globaux (`canEdit`, `canDelete`, `canManageVolunteers`, `canManageArtists`, `canManageMeals`, `canManageTicketing`, `canManageTasks` sur une édition précise).

Format d'un organisateur retourné par l'API (détails étendus dans [`docs/system/ORGANIZER_PERMISSIONS.md`](docs/system/ORGANIZER_PERMISSIONS.md)) :

```jsonc
{
  "id": 12,
  "addedAt": "2025-08-23T10:11:12.000Z",
  "title": "Créateur",
  "rights": {
    "editConvention": true,
    "deleteConvention": true,
    "manageOrganizers": true,
    "addEdition": true,
    "editAllEditions": true,
    "deleteAllEditions": true,
  },
  "user": { "id": 5, "pseudo": "alice", "emailHash": "..." },
  "addedBy": { "id": 5, "pseudo": "alice" },
}
```

Endpoints principaux (extraits) :

- `POST /api/conventions/:id/organizers` body : `{ userIdentifier | userId, rights?: { ... }, title?: string }`
- `PUT /api/conventions/:id/organizers/:organizerId` body : `{ rights?: { ... }, title?: string }`

Les handlers ignorent désormais tout champ `role` legacy. Les tests garantissent l'absence de régression. Pour l'affichage, un titre synthétique peut être dérivé côté frontend via un composable (`useOrganizerTitle`) qui mappe la densité des droits vers des labels i18n (`permissions.admin`, `permissions.manager`, etc.).

## Structure du Projet

- `app/` — Frontend Nuxt
  - `components/` — Composants Vue (PascalCase)
  - `pages/` — Pages et routing
  - `stores/` — Stores Pinia
  - `composables/` — Composables réutilisables (ex: `useApiAction`)
  - `middleware/` — Middlewares Nuxt (`auth-protected`, `guest-only`, `super-admin`, `verify-email-access`)
  - `layouts/` — Layouts (par défaut, dashboard édition, etc.)
  - `types/` — Types TypeScript globaux
- `server/` — Backend Nitro
  - `api/` — Endpoints REST (organisés par ressource)
  - `utils/` — Helpers serveur (auth, prisma, permissions, notifications, etc.)
  - `middleware/` — Middlewares Nitro (CSRF, etc.)
  - `constants/` — Constantes (permissions, etc.)
  - `emails/` — Templates d'emails Vue
- `prisma/` — Schéma multi-fichiers et migrations
  - `schema/*.prisma` — Schéma découpé par domaine (artists, carpool, meals, messenger, tasks, ticketing, volunteer, workshops, etc.)
  - `migrations/` — Migrations versionnées
- `i18n/locales/` — Traductions (12 langues, organisées par domaine : `common`, `admin`, `edition`, `auth`, `gestion`, etc.)
- `docs/` — Documentation technique ([`docs/README.md`](docs/README.md) sert d'index)
- `tests/` — Tests Vitest (unit + Nuxt) et Playwright (e2e)
- `public/` — Fichiers statiques (favicon, etc.)
- `scripts/` — Scripts utilitaires (géocodage, gestion admin, traduction i18n, etc.)

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
npm run geocode
```

Ce script utilise l'API Nominatim (OpenStreetMap) avec une stratégie de fallback pour maximiser le taux de succès.

## 📚 Documentation

- **[`docs/README.md`](docs/README.md)** — Index complet de la documentation technique
- **[`CLAUDE.md`](CLAUDE.md)** — Conventions et règles pour les assistants IA (Claude)
- **[`SCRIPTS.md`](SCRIPTS.md)** — Documentation des scripts utilitaires
- **[`README.tests.md`](README.tests.md)** — Guide des tests
- **[`docs/docker/`](docs/docker/)** — Documentation Docker
