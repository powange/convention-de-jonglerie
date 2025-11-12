# Convention de Jonglerie - Analyse Complète du Codebase

## Table des Matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Analyse détaillée de la structure des répertoires](#2-analyse-détaillée-de-la-structure-des-répertoires)
3. [Analyse fichier par fichier](#3-analyse-fichier-par-fichier)
4. [Analyse des endpoints API](#4-analyse-des-endpoints-api)
5. [Architecture approfondie](#5-architecture-approfondie)
6. [Analyse de l'environnement et de la configuration](#6-analyse-de-lenvironnement-et-de-la-configuration)
7. [Détail de la stack technologique](#7-détail-de-la-stack-technologique)
8. [Diagrammes d'architecture](#8-diagrammes-darchitecture)
9. [Insights clés et recommandations](#9-insights-clés-et-recommandations)

---

## 1. Vue d'ensemble du projet

### Type de projet

Application web full-stack dédiée à la gestion et à la découverte de conventions de jonglerie avec fonctionnalités complètes de gestion d'événements.

### Tech Stack Principal

- **Framework**: Nuxt.js 4.2.0 (Vue.js 3.5.17)
- **Backend**: Nitro (intégré à Nuxt)
- **Base de données**: MySQL avec Prisma ORM 6.18.0
- **Langage**: TypeScript 5.8.3
- **UI**: Nuxt UI 4.0.0 avec Tailwind CSS
- **Authentification**: nuxt-auth-utils 0.5.23 (sessions scellées)

### Pattern d'architecture

- **Modèle**: Architecture full-stack monolithique avec SSR (Server-Side Rendering)
- **API**: RESTful API avec Nitro
- **État**: Gestion d'état avec Pinia 3.0.3
- **Permissions**: Système de permissions granulaires basé sur les droits (non plus sur les rôles)

### Versions et compatibilité

- **Node.js**: >= 22 < 23
- **Prisma**: 6.18.0
- **Environnement de développement**: Docker-based avec hot-reload

---

## 2. Analyse détaillée de la structure des répertoires

### `/app` - Frontend Nuxt.js

**Rôle**: Contient toute la logique frontend de l'application.

#### `/app/pages`

- **Purpose**: Définit les routes de l'application via le système de routing file-based de Nuxt
- **Connexions**: Utilise les composables, stores et composants
- **Fichiers clés**:
  - `index.vue`: Page d'accueil avec liste des conventions
  - `auth/`: Pages d'authentification (login, register, forgot-password, reset-password)
  - `conventions/[id]/`: Pages de gestion des conventions
  - `editions/[id]/`: Pages de détail et gestion des éditions
  - `editions/[id]/gestion/`: Dashboard de gestion pour organisateurs
  - `admin/`: Interface d'administration globale

#### `/app/components`

- **Purpose**: Composants Vue réutilisables organisés par domaine
- **Structure**:
  - `admin/`: Composants d'administration (impersonation, user management)
  - `edition/`: Composants spécifiques aux éditions (carpool, ticketing, volunteers)
  - `convention/`: Composants de gestion des conventions
  - `ui/`: Composants UI génériques (modals, cards, banners)
  - `organizer/`: Composants de gestion des organisateurs
  - `ticketing/`: Système de billeterie
  - `shows/`: Gestion des spectacles

#### `/app/composables`

- **Purpose**: Fonctions réutilisables pour la logique métier côté client
- **Exemples**:
  - `useAuth()`: Gestion de l'authentification
  - `usePermissions()`: Vérification des permissions
  - `useOrganizerTitle()`: Mapping des droits vers des titres i18n

#### `/app/stores`

- **Purpose**: Gestion d'état globale avec Pinia
- **Stores principaux**:
  - `authStore`: État d'authentification utilisateur
  - `conventionStore`: État des conventions
  - `editionStore`: État des éditions

#### `/app/middleware`

- **Purpose**: Middleware de routing pour protéger les routes
- **Fichiers**:
  - `auth.ts`: Protection des routes authentifiées
  - `admin.ts`: Protection des routes admin

### `/server` - Backend Nitro

**Rôle**: API backend, logique métier serveur, et gestion des données.

#### `/server/api`

- **Purpose**: Endpoints API RESTful organisés par ressource
- **Structure**:
  - `auth/`: Authentification (login, register, verify, reset-password)
  - `conventions/[id]/`: CRUD conventions et organisateurs
  - `editions/[id]/`: CRUD éditions avec sous-ressources:
    - `ticketing/`: Billeterie (tiers, options, orders, stats)
    - `volunteers/`: Gestion bénévoles (applications, teams, planning)
    - `artists/`: Gestion artistes invités
    - `shows/`: Gestion spectacles
    - `workshops/`: Gestion ateliers
    - `lost-found/`: Objets trouvés
    - `posts/`: Forum/commentaires
    - `carpool-offers/`: Covoiturage
  - `admin/`: Administration globale (users, impersonation, backup)
  - `profile/`: Gestion profil utilisateur
  - `session/`: Endpoints de session

#### `/server/utils`

- **Purpose**: Utilitaires serveur réutilisables
- **Fichiers clés**:
  - `api-helpers.ts`: Wrapper `wrapApiHandler` pour gestion d'erreurs
  - `prisma.ts`: Instance Prisma partagée
  - `prisma-helpers.ts`: Helpers pour requêtes Prisma
  - `auth-helpers.ts`: Helpers d'authentification
  - `impersonation-helpers.ts`: Gestion cookie d'impersonation
  - `permissions/`: Système de permissions granulaires
  - `editions/`: Helpers spécifiques aux éditions

#### `/server/middleware`

- **Purpose**: Middleware HTTP global
- **Fichiers**:
  - `error-handler.ts`: Gestion centralisée des erreurs

#### `/server/emails`

- **Purpose**: Templates d'emails avec @vue-email
- **Exemples**: Vérification email, réinitialisation mot de passe

### `/prisma` - Base de données

**Rôle**: Schéma de base de données et migrations.

#### Fichiers clés:

- `schema.prisma`: Définition complète du modèle de données
- `migrations/`: Historique des migrations avec SQL

#### Modèles principaux:

- `User`: Utilisateurs
- `Convention`: Conventions de jonglerie
- `Edition`: Éditions d'une convention
- `ConventionOrganizer`: Organisateurs avec droits granulaires
- `EditionOrganizerPermission`: Permissions par édition
- `VolunteerApplication`: Candidatures bénévoles
- `VolunteerTeam`: Équipes de bénévoles
- `Order` / `OrderItem`: Commandes billeterie
- `Artist`: Artistes invités
- `Show`: Spectacles
- `Workshop`: Ateliers

### `/i18n` - Internationalisation

**Rôle**: Traductions multilingues avec lazy loading.

#### Structure:

- `locales/{langue}/{domaine}.json`
- **Langues supportées**: fr, en, es, de, it, pt, nl, pl, cs, da, sv, ru, uk
- **Domaines**: common, admin, edition, auth, public, components, app, gestion, artists

#### Système de traduction:

- Mapping intelligent basé sur la structure française
- Lazy loading automatique selon les routes
- Scripts de vérification et synchronisation

### `/test` - Tests

**Rôle**: Suite de tests complète.

#### Structure:

- `unit/`: Tests unitaires (composables, utils, stores)
- `nuxt/`: Tests d'intégration Nuxt (pages, components, API)
- `integration/`: Tests d'intégration base de données
- `__mocks__/`: Mocks pour les tests

#### Framework:

- Vitest 3.2.4
- @nuxt/test-utils 3.19.2
- Happy-dom 18.0.1

### `/docs` - Documentation

**Rôle**: Documentation technique du projet.

#### Fichiers clés:

- `AUTH_SESSIONS.md`: Documentation authentification
- `ORGANIZER_PERMISSIONS.md`: Système de permissions
- `api-utils-refactoring.md`: Refactoring des utils API
- `i18n-lazy-loading.md`: Système i18n
- `ticketing/`: Documentation billeterie
- `volunteers/`: Documentation bénévoles

### `/scripts` - Scripts utilitaires

**Rôle**: Scripts de maintenance et d'administration.

#### Scripts principaux:

- `check-i18n.js`: Vérification clés i18n
- `check-i18n-translations.js`: Comparaison traductions
- `translation/`: Scripts de traduction automatique
- `seed-dev.ts`: Peuplement base de données
- `manage-admin.ts`: Gestion admins globaux
- `run-geocoding.mjs`: Géocodage adresses

### `/public` - Assets statiques

**Rôle**: Fichiers statiques accessibles publiquement.

#### Contenu:

- `logos/`: Logos de l'application
- `favicons/`: Favicons générés
- `uploads/`: Fichiers uploadés par utilisateurs (gitignored)

---

## 3. Analyse fichier par fichier

### Core Application Files

#### Configuration racine

**`nuxt.config.ts`**

- Configuration centrale de Nuxt
- Modules activés: i18n, UI, auth-utils, prisma, seo, image
- Configuration SSR, routing, et optimisations
- TitleTemplate global pour SEO

**`package.json`**

- 128 dépendances (71 prod + 57 dev)
- Scripts npm organisés par catégorie
- Engine restriction: Node >= 22 < 23
- Prettier config intégré

**`tsconfig.json`**

- Configuration TypeScript strict
- Paths aliases: `@@/` pour root, `@/` pour app
- Target: ESNext
- Module: ESNext

**`.env` (gitignored)**

```env
DATABASE_URL=mysql://...
NUXT_SESSION_PASSWORD=...
SEND_EMAILS=true/false
SMTP_USER=...
SMTP_PASS=...
```

#### Entry Points Frontend

**`app/app.vue`**

- Point d'entrée principal de l'application
- Contient le `<NuxtPage />` pour le routing
- Gestion des notifications toast globales

**`app/pages/index.vue`**

- Page d'accueil
- Liste des conventions avec filtres
- Carte interactive des éditions
- SEO: `useHead({ titleTemplate: '%s' })` pour override du suffix

#### Entry Points Backend

**`server/api/session/me.get.ts`**

- Endpoint critique pour récupérer la session actuelle
- Gère l'impersonation via cookie séparé
- Retourne user + impersonation data

**`server/utils/api-helpers.ts`**

- Wrapper `wrapApiHandler` pour tous les endpoints
- Gestion centralisée des erreurs
- Logging automatique des opérations

### Configuration Files

#### Build & Dev Tools

**`eslint.config.mjs`**

- Configuration ESLint avec @nuxt/eslint
- Rules personnalisées pour Vue
- Support TypeScript

**`.prettierrc` (dans package.json)**

```json
{
  "singleQuote": true,
  "semi": false,
  "printWidth": 100,
  "trailingComma": "es5"
}
```

**`vitest.config.ts`**

- Configuration multi-projets: unit, nuxt, integration, e2e
- Coverage avec Istanbul
- Environnement: happy-dom

#### Docker

**`docker-compose.dev.yml`**

- Service `app`: Application Nuxt en dev mode
- Service `db`: MySQL 8.0
- Hot reload avec volumes
- Ports: 3000 (app), 3306 (db)

**`Dockerfile.dev`**

- Base image: node:22-alpine
- Installation dépendances
- Génération Prisma client
- CMD: `npm run dev`

**`docker-compose.release.yml`**

- Build production
- Variables d'environnement Portainer
- Healthchecks configurés

### Data Layer

#### Prisma Schema

**`prisma/schema.prisma`**

- 40+ modèles définis
- Relations complexes avec cascades
- Indexes optimisés pour performances
- Types: String, Int, DateTime, Boolean, Json, Decimal

**Modèles clés avec relations**:

```prisma
model User {
  id                    Int       @id @default(autoincrement())
  email                 String    @unique
  pseudo                String    @unique
  passwordHash          String?
  isGlobalAdmin         Boolean   @default(false)
  preferredLanguage     String    @default("fr")
  conventions           Convention[]
  organizerOf           ConventionOrganizer[]
  // ... + 20 autres relations
}

model Convention {
  id                    Int       @id @default(autoincrement())
  name                  String
  description           String?   @db.Text
  creatorId             Int
  creator               User      @relation(...)
  editions              Edition[]
  organizers            ConventionOrganizer[]
}

model ConventionOrganizer {
  id                    Int       @id @default(autoincrement())
  userId                Int
  conventionId          Int
  title                 String?
  // Droits granulaires
  canEditConvention     Boolean   @default(false)
  canDeleteConvention   Boolean   @default(false)
  canManageOrganizers   Boolean   @default(false)
  canAddEdition         Boolean   @default(false)
  canEditAllEditions    Boolean   @default(false)
  canDeleteAllEditions  Boolean   @default(false)
  canManageArtists      Boolean   @default(false)
}
```

#### Migrations notables

- `20251106212514_rename_collaborator_to_organizer`: Refonte terminologie
- `20251028111115_add_artist_management_rights`: Ajout droits artistes
- `20251030080823_add_meal_validation`: Système validation repas
- `20251027115031_add_volunteer_meal_selection`: Sélection repas bénévoles

### Frontend/UI

#### Composants UI critiques

**`app/components/ui/ImpersonationBanner.vue`**

- Bannière d'avertissement en mode impersonation
- Action "Retour à mon compte" avec reload complet
- Utilise `window.location.href` pour forcer rechargement

**`app/components/edition/ticketing/ParticipantDetailsModal.vue`**

- Modal détaillée d'un participant
- Affichage tickets, options, items à restituer
- Validation d'entrée et historique

**`app/components/organizer/OrganizerDetailsCard.vue`**

- Affichage nouveau composant pour organisateurs
- Badges pour droits actifs
- Gestion titre personnalisé

#### Pages complexes

**`app/pages/editions/[id]/gestion/ticketing/stats.vue`**

- Dashboard statistiques billeterie
- Graphiques Chart.js pour validations d'entrée
- Filtres par période, type, granularité
- Sources de commandes (manuel vs HelloAsso)

**`app/pages/editions/[id]/gestion/volunteers/applications.vue`**

- Gestion candidatures bénévoles
- Tableau avec filtres et tri
- Actions: accepter, refuser, commenter
- Assignation équipes et repas

### Testing

#### Tests unitaires

**`test/unit/utils/markdownToHtml.test.ts`**

- Test conversion Markdown → HTML
- Vérification sanitization (rehype-sanitize)
- Couverture complète des cas

**`test/unit/composables/usePermissions.test.ts`**

- Test système de permissions
- Vérification hiérarchie des droits

#### Tests d'intégration

**`test/integration/organizers.chain.db.test.ts`**

- Test workflow complet organisateurs
- Ajout, modification droits, suppression
- Vérification permissions en cascade

**`test/nuxt/server/api/conventions/organizers.post.test.ts`**

- Test endpoint POST organisateur
- Vérification validation des droits
- Test cas d'erreur

### Documentation

**`docs/ORGANIZER_PERMISSIONS.md`**

- Documentation complète du système de permissions
- Exemples de requêtes API
- Mapping droits → titres
- Format de réponse API

**`docs/i18n-lazy-loading.md`**

- Explication système lazy loading
- Structure par domaines
- Scripts de synchronisation

**`CLAUDE.md`**

- Instructions pour Claude Code
- Règles importantes (pas de npm run dev, etc.)
- Commandes personnalisées (/lint-fix, /run-tests, /quality-check)
- Structure i18n et règles de traduction

### DevOps

**`.github/workflows/tests.yml`**

- CI/CD avec GitHub Actions
- Jobs: lint, unit tests, nuxt tests
- Badge dans README

**`docker-compose.test-all.yml`**

- Suite de tests complète en Docker
- Service test-runner avec all tests
- Service test-db pour intégration

---

## 4. Analyse des endpoints API

### Authentification (`/api/auth`)

| Endpoint                    | Méthode | Description                           | Auth |
| --------------------------- | ------- | ------------------------------------- | ---- |
| `/api/auth/register`        | POST    | Inscription avec vérification email   | Non  |
| `/api/auth/verify-email`    | POST    | Vérification code à 6 chiffres        | Non  |
| `/api/auth/login`           | POST    | Connexion (email/username + password) | Non  |
| `/api/auth/logout`          | POST    | Déconnexion                           | Oui  |
| `/api/auth/forgot-password` | POST    | Demande reset password                | Non  |
| `/api/auth/reset-password`  | POST    | Reset password avec token             | Non  |
| `/api/auth/google`          | GET     | OAuth Google                          | Non  |

**Format requête `POST /api/auth/register`**:

```json
{
  "email": "user@example.com",
  "pseudo": "username",
  "prenom": "John",
  "nom": "Doe",
  "password": "SecurePass123"
}
```

**Format réponse**:

```json
{
  "message": "Code de vérification envoyé",
  "userId": 42
}
```

### Session (`/api/session`)

| Endpoint          | Méthode | Description                      | Auth |
| ----------------- | ------- | -------------------------------- | ---- |
| `/api/session/me` | GET     | Récupère session + impersonation | Oui  |

**Format réponse `GET /api/session/me`**:

```json
{
  "user": {
    "id": 42,
    "email": "user@example.com",
    "pseudo": "username",
    "isGlobalAdmin": false,
    "preferredLanguage": "fr"
  },
  "impersonation": {
    "active": true,
    "originalUserId": 1,
    "targetUserId": 42,
    "startedAt": "2025-01-12T10:00:00Z"
  }
}
```

### Conventions (`/api/conventions`)

| Endpoint                                         | Méthode | Description            | Auth | Permissions         |
| ------------------------------------------------ | ------- | ---------------------- | ---- | ------------------- |
| `/api/conventions`                               | GET     | Liste conventions      | Non  | -                   |
| `/api/conventions`                               | POST    | Créer convention       | Oui  | -                   |
| `/api/conventions/[id]`                          | GET     | Détail convention      | Non  | -                   |
| `/api/conventions/[id]`                          | PUT     | Modifier convention    | Oui  | canEditConvention   |
| `/api/conventions/[id]`                          | DELETE  | Supprimer convention   | Oui  | canDeleteConvention |
| `/api/conventions/[id]/organizers`               | GET     | Liste organisateurs    | Oui  | Organisateur        |
| `/api/conventions/[id]/organizers`               | POST    | Ajouter organisateur   | Oui  | canManageOrganizers |
| `/api/conventions/[id]/organizers/[organizerId]` | PUT     | Modifier organisateur  | Oui  | canManageOrganizers |
| `/api/conventions/[id]/organizers/[organizerId]` | DELETE  | Supprimer organisateur | Oui  | canManageOrganizers |

**Format requête `POST /api/conventions/[id]/organizers`**:

```json
{
  "userIdentifier": "username@email.com",
  "title": "Responsable logistique",
  "rights": {
    "editConvention": false,
    "deleteConvention": false,
    "manageOrganizers": false,
    "addEdition": true,
    "editAllEditions": false,
    "deleteAllEditions": false,
    "manageArtists": false
  }
}
```

### Éditions (`/api/editions`)

| Endpoint                         | Méthode | Description             | Auth | Permissions   |
| -------------------------------- | ------- | ----------------------- | ---- | ------------- |
| `/api/editions`                  | GET     | Liste éditions          | Non  | -             |
| `/api/editions`                  | POST    | Créer édition           | Oui  | canAddEdition |
| `/api/editions/[id]`             | GET     | Détail édition          | Non  | -             |
| `/api/editions/[id]`             | PUT     | Modifier édition        | Oui  | canEdit       |
| `/api/editions/[id]`             | DELETE  | Supprimer édition       | Oui  | canDelete     |
| `/api/editions/[id]/permissions` | GET     | Permissions utilisateur | Oui  | -             |

**Pagination**: Tous les endpoints de liste supportent `?page=1&limit=20`

**Format réponse pagination**:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 150,
    "totalPages": 8
  }
}
```

### Billeterie (`/api/editions/[id]/ticketing`)

| Endpoint                               | Méthode | Description      | Auth | Permissions  |
| -------------------------------------- | ------- | ---------------- | ---- | ------------ |
| `/api/editions/[id]/ticketing/tiers`   | GET     | Liste tarifs     | Non  | -            |
| `/api/editions/[id]/ticketing/tiers`   | POST    | Créer tarif      | Oui  | Organisateur |
| `/api/editions/[id]/ticketing/options` | GET     | Liste options    | Non  | -            |
| `/api/editions/[id]/ticketing/options` | POST    | Créer option     | Oui  | Organisateur |
| `/api/editions/[id]/ticketing/orders`  | GET     | Liste commandes  | Oui  | Organisateur |
| `/api/editions/[id]/ticketing/orders`  | POST    | Créer commande   | Oui  | -            |
| `/api/editions/[id]/ticketing/stats`   | GET     | Statistiques     | Oui  | Organisateur |
| `/api/editions/[id]/validate-entry`    | POST    | Valider entrée   | Oui  | Organisateur |
| `/api/editions/[id]/invalidate-entry`  | POST    | Invalider entrée | Oui  | Organisateur |

### Bénévoles (`/api/editions/[id]/volunteers`)

| Endpoint                                                            | Méthode | Description          | Auth | Permissions  |
| ------------------------------------------------------------------- | ------- | -------------------- | ---- | ------------ |
| `/api/editions/[id]/volunteers/applications`                        | GET     | Liste candidatures   | Oui  | Organisateur |
| `/api/editions/[id]/volunteers/applications`                        | POST    | Candidater           | Oui  | -            |
| `/api/editions/[id]/volunteers/applications/[applicationId]`        | PUT     | Modifier candidature | Oui  | Organisateur |
| `/api/editions/[id]/volunteers/applications/[applicationId]/accept` | POST    | Accepter             | Oui  | Organisateur |
| `/api/editions/[id]/volunteers/applications/[applicationId]/reject` | POST    | Refuser              | Oui  | Organisateur |
| `/api/editions/[id]/volunteers/teams`                               | GET     | Liste équipes        | Oui  | Organisateur |
| `/api/editions/[id]/volunteers/teams`                               | POST    | Créer équipe         | Oui  | Organisateur |

### Administration (`/api/admin`)

| Endpoint                            | Méthode | Description           | Auth | Permissions |
| ----------------------------------- | ------- | --------------------- | ---- | ----------- |
| `/api/admin/users`                  | GET     | Liste utilisateurs    | Oui  | GlobalAdmin |
| `/api/admin/users/[id]`             | GET     | Détail utilisateur    | Oui  | GlobalAdmin |
| `/api/admin/users/[id]/impersonate` | POST    | Impersonner           | Oui  | GlobalAdmin |
| `/api/admin/impersonate/stop`       | POST    | Arrêter impersonation | Oui  | -           |
| `/api/admin/feedback`               | GET     | Liste feedback        | Oui  | GlobalAdmin |
| `/api/admin/error-logs`             | GET     | Logs d'erreur         | Oui  | GlobalAdmin |
| `/api/admin/backup/restore`         | POST    | Restaurer backup      | Oui  | GlobalAdmin |

### Patterns d'authentification

**Session-based avec cookies scellés**:

- Utilise `nuxt-auth-utils`
- Cookies HTTP-only, secure en prod
- Durée de session: 7 jours par défaut
- Renouvellement automatique

**Impersonation**:

- Cookie séparé `impersonation` (HTTP-only)
- Durée: 24h
- Stocke: originalUserId, targetUserId, startedAt
- Restauration propre de la session originale

**Middleware de protection**:

```typescript
// server/utils/api-helpers.ts
export const wrapApiHandler = (handler, options) => {
  return defineEventHandler(async (event) => {
    try {
      // Vérification session si requireAuth: true
      // Vérification permissions si required
      // Exécution handler
      // Gestion erreurs
    } catch (error) {
      // Logging centralisé
      // Retour erreur formatée
    }
  })
}
```

---

## 5. Architecture approfondie

### Architecture globale

**Pattern**: Monolithe modulaire full-stack avec SSR

```
┌─────────────────────────────────────────────────────────────┐
│                         NUXT.JS 4                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              FRONTEND (Vue 3 + SSR)                   │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │  │
│  │  │ Pages   │  │Components│  │ Stores  │  │Composables│ │
│  │  │ (Routes)│  │   (UI)   │  │ (Pinia) │  │ (Logic) │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↕                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               BACKEND (Nitro)                         │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │  │
│  │  │   API   │  │  Utils  │  │  Auth   │  │ Emails  │  │  │
│  │  │Endpoints│  │ Helpers │  │ Session │  │Templates│  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
              ┌─────────────────────────┐
              │    PRISMA ORM           │
              └─────────────────────────┘
                            ↕
              ┌─────────────────────────┐
              │    MySQL Database       │
              └─────────────────────────┘
```

### Data Flow - Requête typique

**Exemple: Ajout d'un organisateur**

```
1. USER ACTION
   └─→ Click "Ajouter organisateur" dans UI
       └─→ Modal s'ouvre (OrganizerForm.vue)

2. FORM SUBMISSION
   └─→ Validation côté client (Zod schema)
       └─→ $fetch('/api/conventions/123/organizers', {
             method: 'POST',
             body: { userIdentifier, title, rights }
           })

3. ROUTING (Nitro)
   └─→ Match endpoint: server/api/conventions/[id]/organizers.post.ts

4. API HANDLER (wrapApiHandler)
   └─→ Extraction session (requireAuth: true)
   └─→ Vérification permission canManageOrganizers
   └─→ Validation body avec Zod
   └─→ Exécution logique métier:
       ├─→ Recherche utilisateur (email/pseudo/userId)
       ├─→ Vérification duplicata
       ├─→ Création ConventionOrganizer dans DB (Prisma)
       └─→ Log action dans DB

5. DATABASE (Prisma → MySQL)
   └─→ INSERT INTO ConventionOrganizer
   └─→ Transaction si nécessaire

6. RESPONSE
   └─→ Success: 201 + { organizer: {...} }
   └─→ Error: 400/403/404/500 + { message, statusCode }

7. CLIENT UPDATE
   └─→ Toast de succès
   └─→ Refresh liste organisateurs
   └─→ Fermeture modal
```

### Système de permissions granulaires

**Architecture 3 niveaux**:

1. **Niveau Global**: `User.isGlobalAdmin`
   - Accès total à toute la plateforme
   - Administration globale

2. **Niveau Convention**: `ConventionOrganizer.can*`
   - 7 droits granulaires par convention
   - Héritage possible vers éditions

3. **Niveau Édition**: `EditionOrganizerPermission`
   - Permissions spécifiques par édition
   - Override des droits globaux

**Algorithme de vérification**:

```typescript
async function canEditEdition(userId: number, editionId: number): Promise<boolean> {
  // 1. Check global admin
  if (user.isGlobalAdmin) return true

  // 2. Check convention-level permission
  const organizer = await getConventionOrganizer(userId, edition.conventionId)
  if (organizer?.canEditAllEditions) return true

  // 3. Check edition-specific permission
  const editionPerm = await getEditionPermission(organizerId, editionId)
  if (editionPerm?.canEdit) return true

  // 4. Check if creator
  if (edition.createdById === userId) return true

  return false
}
```

**Helpers de permissions** (`server/utils/permissions/`):

- `convention-permissions.ts`: Vérification droits convention
- `edition-permissions.ts`: Vérification droits édition
- `validateConventionId()`: Validation + vérification existence

### Design Patterns utilisés

#### 1. **Wrapper Pattern** (api-helpers)

```typescript
// Encapsulation logique commune
export const wrapApiHandler = (handler, options) => {
  return defineEventHandler(async (event) => {
    // Prétraitement commun
    // Exécution handler
    // Post-traitement commun
  })
}
```

#### 2. **Repository Pattern** (Prisma)

```typescript
// Abstraction de la couche données
export const prisma = new PrismaClient()

// Helpers réutilisables
export async function fetchResourceOrFail(model, id, options) {
  const resource = await model.findUnique({ where: { id } })
  if (!resource) throw createError({ statusCode: 404, ... })
  return resource
}
```

#### 3. **Composable Pattern** (Vue)

```typescript
// Logique réutilisable côté client
export const useAuth = () => {
  const user = useState('user')
  const isAuthenticated = computed(() => !!user.value)

  const login = async (credentials) => { ... }
  const logout = async () => { ... }

  return { user, isAuthenticated, login, logout }
}
```

#### 4. **Strategy Pattern** (Permissions)

```typescript
// Stratégies de vérification selon le contexte
interface PermissionStrategy {
  canEdit(userId: number, resourceId: number): Promise<boolean>
  canDelete(userId: number, resourceId: number): Promise<boolean>
}

class ConventionPermissionStrategy implements PermissionStrategy { ... }
class EditionPermissionStrategy implements PermissionStrategy { ... }
```

#### 5. **Middleware Chain** (Nuxt)

```typescript
// Chaîne de middleware pour routing
defineNuxtRouteMiddleware((to, from) => {
  // Middleware 1: auth
  // Middleware 2: permissions
  // Middleware 3: logging
})
```

### Modules et dépendances

**Graphe de dépendances simplifié**:

```
nuxt 4.2.0
├── vue 3.5.17
├── nitro (intégré)
├── @nuxt/ui 4.0.0
│   ├── tailwindcss
│   └── headlessui
├── @nuxtjs/i18n 10.0.3
│   └── @intlify/core
├── pinia 3.0.3
├── @prisma/client 6.18.0
├── nuxt-auth-utils 0.5.23
│   └── h3 (sessions)
└── typescript 5.8.3

External Services:
├── MySQL 8.0
├── Nominatim API (géocodage)
├── HelloAsso API (billeterie)
└── SMTP (emails)
```

### État global (Pinia)

**Structure des stores**:

```typescript
// authStore
{
  user: User | null,
  isAuthenticated: boolean,
  impersonation: ImpersonationData | null,

  actions: {
    login(),
    logout(),
    refreshSession(),
    checkAuth()
  }
}

// conventionStore
{
  conventions: Convention[],
  currentConvention: Convention | null,

  actions: {
    fetchConventions(),
    createConvention(),
    updateConvention(),
    deleteConvention()
  }
}

// editionStore
{
  editions: Edition[],
  currentEdition: Edition | null,

  actions: {
    fetchEditions(),
    createEdition(),
    updateEdition(),
    deleteEdition()
  }
}
```

---

## 6. Analyse de l'environnement et de la configuration

### Variables d'environnement requises

#### Production (obligatoires)

```env
# Database
DATABASE_URL="mysql://user:pass@host:3306/database"

# Session Security (32+ chars minimum)
NUXT_SESSION_PASSWORD="very_long_secure_random_string_32_chars_min"

# Email
SEND_EMAILS=true
SMTP_USER="your.email@gmail.com"
SMTP_PASS="app_specific_password"
SMTP_FROM="noreply@convention-jonglerie.com"
```

#### Développement (optionnelles)

```env
# Prisma Logging
PRISMA_LOG_LEVEL="error,warn"  # ou "query,error,warn,info" pour verbose

# Email Mode (simulation)
SEND_EMAILS=false  # Codes affichés dans la console

# Base URL
NUXT_PUBLIC_BASE_URL="http://localhost:3000"

# Docker MySQL
MYSQL_ROOT_PASSWORD="rootpassword"
MYSQL_DATABASE="convention_db"
MYSQL_USER="convention_user"
MYSQL_PASSWORD="convention_password"
```

#### Fichiers d'environnement

- `.env`: Configuration locale (gitignored)
- `.env.test`: Configuration pour tests
- `.env.example`: Template pour développement
- `.env.docker.example`: Template pour Docker
- `.env.portainer.example`: Template pour Portainer

### Processus d'installation et setup

#### Installation standard

```bash
# 1. Clone repository
git clone <url>
cd convention-de-jonglerie

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Setup database
npx prisma migrate dev
npx prisma generate

# 5. Seed database (optionnel)
npm run db:seed:dev

# 6. Start dev server
npm run dev
```

#### Installation Docker (recommandé)

```bash
# 1. Configure environment
cp .env.docker.example .env
# Éditer .env si nécessaire

# 2. Start services
npm run docker:dev

# Services démarrés:
# - app: http://localhost:3000 (avec hot-reload)
# - db: MySQL sur port 3306

# 3. Logs
npm run docker:dev:logs

# 4. Execute commands in container
npm run docker:dev:exec
# Puis dans le container:
npx prisma migrate dev
npm run db:seed:dev

# 5. Stop services
npm run docker:dev:down
```

### Workflow de développement

#### Développement quotidien

```bash
# Option 1: Local (nécessite MySQL local)
npm run dev

# Option 2: Docker (recommandé)
npm run docker:dev:detached  # En arrière-plan
npm run docker:dev:logs      # Voir les logs

# Hot-reload automatique sur:
# - Modifications fichiers app/
# - Modifications fichiers server/
# - Modifications fichiers i18n/
```

#### Avant commit

```bash
# 1. Lint + Fix
npm run lint:fix
# ou
/lint-fix  # Commande Claude

# 2. Format code
npm run format

# 3. Run tests
npm run test:unit:run
npm run test:nuxt:run
# ou
/run-tests  # Commande Claude

# 4. Quality check complet
/quality-check  # Lint + Tests + Commit + Push
```

#### Gestion i18n

```bash
# 1. Vérifier clés manquantes/inutilisées
npm run check-i18n

# 2. Comparer traductions entre locales
npm run check-translations

# 3. Marquer clés modifiées comme [TODO]
npm run i18n:mark-todo  # Mode auto (git diff)
npm run i18n:mark-todo "key1" "key2"  # Mode manuel

# 4. Traduire les [TODO] (commande Claude)
/translate-todos
```

#### Gestion base de données

```bash
# Créer une migration
npx prisma migrate dev --name description_migration

# Générer le client Prisma
npx prisma generate

# Reset database (⚠️ perte de données)
npm run db:reset:dev

# Seed database
npm run db:seed:dev

# Voir les comptes seed
npm run db:seed:password

# Studio Prisma (GUI)
npx prisma studio
```

### Stratégie de déploiement production

#### Build production

```bash
# Build avec optimisations
npm run build

# Preview locally
npm run preview

# Output dans .output/
# - .output/public/: Assets statiques
# - .output/server/: Code serveur
```

#### Docker production

```bash
# 1. Build image
docker compose -f docker-compose.release.yml build

# 2. Run production
docker compose -f docker-compose.release.yml up -d

# 3. Health check
curl http://localhost:3000/api/health

# 4. Logs
docker compose -f docker-compose.release.yml logs -f

# 5. Backup database
npm run admin:backup
```

#### Checklist pré-déploiement

- [ ] Variables d'environnement configurées
- [ ] `NUXT_SESSION_PASSWORD` robuste (32+ chars)
- [ ] `SEND_EMAILS=true` avec SMTP configuré
- [ ] Base de données migrée (`prisma migrate deploy`)
- [ ] Tests passent en CI/CD
- [ ] Build production réussit
- [ ] Health checks configurés
- [ ] Monitoring et logs configurés
- [ ] Backup database configuré
- [ ] SSL/TLS configuré (HTTPS)

#### Environnements

1. **Développement**: Docker local avec hot-reload
2. **Test**: CI/CD GitHub Actions
3. **Staging**: Docker Compose sur serveur dédié
4. **Production**: Docker avec reverse proxy (Nginx/Traefik)

---

## 7. Détail de la stack technologique

### Runtime & Framework

#### Node.js 22.x

- **Pourquoi**: Version LTS récente avec performances améliorées
- **Restriction**: `>= 22 < 23` dans package.json
- **Features utilisées**: ESM, async/await, top-level await

#### Nuxt.js 4.2.0

- **Type**: Meta-framework Vue.js pour SSR/SSG
- **Avantages**:
  - Routing file-based automatique
  - Server-Side Rendering intégré
  - API routes avec Nitro
  - Auto-imports composants/composables
  - Optimisations performances
- **Configuration**: `nuxt.config.ts`

#### Vue.js 3.5.17

- **Type**: Framework JavaScript réactif
- **Features utilisées**:
  - Composition API
  - `<script setup>`
  - Reactivity avec `ref`, `computed`, `watch`
  - Lifecycle hooks
- **Ecosystem**: Vue Router 4.5.1

### Backend

#### Nitro

- **Type**: Moteur serveur universel
- **Rôle**:
  - Serveur API RESTful
  - SSR
  - Prérendering
  - Déploiement universel
- **Features**:
  - Hot Module Replacement (HMR)
  - Optimisations automatiques
  - API routes avec h3

#### Prisma 6.18.0

- **Type**: ORM next-generation
- **Avantages**:
  - Type-safety complète avec TypeScript
  - Migrations déclaratives
  - Query builder intuitif
  - Prisma Studio (GUI)
- **Database**: MySQL 8.0
- **Client**: Auto-généré après chaque migration

### Base de données

#### MySQL 8.0

- **Type**: SGBDR relationnel
- **Choix**:
  - Relations complexes
  - Transactions ACID
  - Performances éprouvées
- **Docker**: Image officielle `mysql:8.0`
- **Stockage**: Volumes Docker persistants

### UI & Styling

#### Nuxt UI 4.0.0

- **Type**: Bibliothèque composants pour Nuxt
- **Base**: Headless UI + Tailwind CSS
- **Composants utilisés**:
  - UButton, UCard, UModal, UInput
  - USelect, UTextarea, UFormField
  - UBadge, UPagination, UDropdownMenu
  - UTable, UToast, UFieldGroup
- **Thème**: Personnalisable via `app.config.ts`

#### Tailwind CSS 3.x

- **Type**: Framework CSS utility-first
- **Avantages**:
  - Styling rapide
  - PurgeCSS intégré
  - Responsive design
  - Dark mode support
- **Configuration**: `tailwind.config.js`

### State Management

#### Pinia 3.0.3

- **Type**: Store centralisé pour Vue
- **Avantages** vs Vuex:
  - API plus simple
  - TypeScript natif
  - DevTools intégré
  - Modularité
- **Stores**: auth, convention, edition

### Internationalisation

#### Nuxt i18n 10.0.3

- **Type**: Module i18n pour Nuxt
- **Base**: @intlify/core
- **Features**:
  - 13 langues supportées
  - Lazy loading par route
  - Détection locale automatique
  - Pluralization et formatage
- **Structure**: `i18n/locales/{lang}/{domain}.json`

### Authentification

#### nuxt-auth-utils 0.5.23

- **Type**: Module auth pour Nuxt
- **Méthode**: Sessions scellées (sealed sessions)
- **Base**: h3 sessions
- **Avantages** vs JWT:
  - Stockage serveur
  - Révocation immédiate
  - Pas de token à gérer côté client
- **Cookie**: HTTP-only, secure, sameSite

#### bcryptjs 3.0.2

- **Type**: Bibliothèque de hashing
- **Usage**: Hashing mots de passe
- **Rounds**: 10 par défaut

### Utilitaires

#### VueUse 13.6.0

- **Type**: Collection d'utilitaires Vue
- **Composables utilisés**:
  - `useDebounce`: Debouncing inputs
  - `useLocalStorage`: Stockage local
  - `useEventListener`: Event listeners
  - `useIntersectionObserver`: Lazy loading

#### Luxon 3.5.0

- **Type**: Bibliothèque dates/temps
- **Usage**: Manipulation et formatage dates
- **Avantages** vs Moment.js:
  - Immutable
  - Plus léger
  - Support intégré i18n

### Visualisation

#### Chart.js 4.5.1

- **Type**: Bibliothèque de graphiques
- **Usage**: Dashboard statistiques billeterie
- **Wrapper**: vue-chartjs 5.3.3
- **Charts utilisés**: Line, Bar, Doughnut

#### FullCalendar 6.1.15

- **Type**: Calendrier interactif
- **Usage**: Planning bénévoles, agenda éditions
- **Modules**: daygrid, list, timeline, resource
- **Wrapper**: @fullcalendar/vue3

### Génération de documents

#### jsPDF 3.0.3

- **Type**: Génération PDF côté client
- **Usage**: Export listes, badges
- **Extension**: jspdf-autotable 5.0.2 pour tableaux

#### html2canvas 1.4.1

- **Type**: Capture HTML → Canvas
- **Usage**: Screenshots, export visuels

### QR Codes

#### nuxt-qrcode 0.4.8

- **Type**: Génération QR codes
- **Usage**:
  - Pass bénévoles
  - Pass artistes
  - Billets d'entrée
- **Features**: Customisation couleurs, logo

### Emails

#### Nodemailer 7.0.5

- **Type**: Envoi d'emails
- **SMTP**: Gmail (configurable)
- **Usage**:
  - Vérification email
  - Reset password
  - Notifications

#### @vue-email 0.0.21

- **Type**: Templates emails avec Vue
- **Avantages**:
  - Composants Vue pour emails
  - Responsive
  - Preview en dev

### Build & Dev Tools

#### TypeScript 5.8.3

- **Type**: Superset JavaScript typé
- **Configuration**: `tsconfig.json`
- **Strict mode**: Activé
- **Benefits**:
  - Type safety
  - IntelliSense
  - Refactoring

#### ESLint 9.32.0

- **Type**: Linter JavaScript/TypeScript
- **Config**: @nuxt/eslint 1.7.1
- **Rules**: Standard + custom pour Vue
- **Auto-fix**: `npm run lint:fix`

#### Prettier 3.3.3

- **Type**: Formatteur de code
- **Config** (dans package.json):
  ```json
  {
    "singleQuote": true,
    "semi": false,
    "printWidth": 100,
    "trailingComma": "es5"
  }
  ```

### Testing

#### Vitest 3.2.4

- **Type**: Framework de tests ultra-rapide
- **Base**: Vite
- **Features**:
  - ESM natif
  - TypeScript support
  - Watch mode
  - Coverage (Istanbul)
- **Projects**: unit, nuxt, integration, e2e

#### @nuxt/test-utils 3.19.2

- **Type**: Utilitaires tests Nuxt
- **Features**:
  - `mountSuspended()`: Mount composants
  - `$fetch()`: Test API
  - `mockNuxtImport()`: Mock imports

#### Happy-dom 18.0.1

- **Type**: DOM virtuel pour tests
- **Avantages** vs jsdom:
  - Plus rapide
  - Plus léger
  - Meilleure compatibilité

### DevOps

#### Docker

- **Images utilisées**:
  - `node:22-alpine`: Base légère
  - `mysql:8.0`: Database
- **Compose files**: dev, test, release, prod

#### GitHub Actions

- **Workflow**: `.github/workflows/tests.yml`
- **Jobs**:
  - Lint
  - Unit tests
  - Nuxt tests
  - Build check

### Monitoring & Logs

#### Console personnalisés

```typescript
console.log('[IMPERSONATE] Session restaurée...')
console.log('[AUTH] Vérification email...')
```

#### Error logging

- Table `ErrorLog` dans DB
- Capture automatique avec `wrapApiHandler`
- Admin panel pour consultation

---

## 8. Diagrammes d'architecture

### 1. Architecture système globale

```
┌───────────────────────────────────────────────────────────────────────┐
│                          UTILISATEURS                                 │
│                                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Public   │  │Organisateur│  │ Bénévole │  │  Admin   │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓ HTTPS
┌───────────────────────────────────────────────────────────────────────┐
│                         REVERSE PROXY (Nginx/Traefik)                 │
│                              SSL/TLS Termination                      │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌───────────────────────────────────────────────────────────────────────┐
│                          NUXT.JS APPLICATION                          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                      FRONTEND (SSR)                             │ │
│  │                                                                 │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐         │ │
│  │  │  Pages  │  │Components│  │ Layouts │  │Middleware│         │ │
│  │  │         │  │          │  │         │  │          │         │ │
│  │  │ .vue    │←→│   .vue   │←→│  .vue   │←→│   .ts    │         │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └──────────┘         │ │
│  │                            ↕                                    │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐         │ │
│  │  │ Stores  │  │Composables│  │  i18n   │  │  Assets  │         │ │
│  │  │(Pinia)  │  │  (Logic) │  │(Locales)│  │   (CSS)  │         │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └──────────┘         │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                    ↕                                   │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    BACKEND (Nitro)                              │ │
│  │                                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │               API LAYER                                 │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │ │
│  │  │  │   Auth   │  │Convention│  │ Edition  │             │   │ │
│  │  │  │ /api/auth│  │/api/conv │  │/api/ed   │   ...       │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘             │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  │                            ↕                                    │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │              BUSINESS LOGIC LAYER                       │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │ │
│  │  │  │  Utils   │  │ Permissions│  │  Email   │             │   │ │
│  │  │  │ Helpers  │  │  Checker  │  │Templates │   ...       │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘             │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
                                    ↕
            ┌───────────────────────────────────────┐
            │         PRISMA ORM                    │
            │  ┌──────────┐  ┌──────────┐           │
            │  │ Client   │  │Migrations│           │
            │  │Generated │  │  Schema  │           │
            │  └──────────┘  └──────────┘           │
            └───────────────────────────────────────┘
                                    ↕
            ┌───────────────────────────────────────┐
            │         MySQL DATABASE                │
            │  ┌──────────────────────────────────┐ │
            │  │  40+ Tables                      │ │
            │  │  - User                          │ │
            │  │  - Convention                    │ │
            │  │  - Edition                       │ │
            │  │  - ConventionOrganizer           │ │
            │  │  - VolunteerApplication          │ │
            │  │  - Order / OrderItem             │ │
            │  │  - ...                           │ │
            │  └──────────────────────────────────┘ │
            └───────────────────────────────────────┘

SERVICES EXTERNES:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Gmail SMTP   │  │  Nominatim   │  │  HelloAsso   │  │   GitHub     │
│ (Emails)     │  │ (Géocodage)  │  │ (Billeterie) │  │   (Auth)     │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### 2. Flow d'authentification

```
┌─────────────┐
│   Browser   │
└─────────────┘
      │
      │ 1. POST /api/auth/register
      │    { email, pseudo, password, ... }
      ↓
┌─────────────────────────────────────────┐
│  Server: /api/auth/register.post.ts     │
│  ┌────────────────────────────────────┐ │
│  │ 1. Validate input (Zod)            │ │
│  │ 2. Check email/pseudo uniqueness   │ │
│  │ 3. Hash password (bcrypt)          │ │
│  │ 4. Generate 6-digit code           │ │
│  │ 5. Save user + VerificationToken   │ │
│  │ 6. Send email (nodemailer)         │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
      │
      │ 2. Response: { message, userId }
      ↓
┌─────────────┐
│   Browser   │ → Redirect to /auth/verify-email
└─────────────┘
      │
      │ 3. POST /api/auth/verify-email
      │    { userId, code: "123456" }
      ↓
┌─────────────────────────────────────────┐
│  Server: /api/auth/verify-email.post.ts │
│  ┌────────────────────────────────────┐ │
│  │ 1. Find VerificationToken          │ │
│  │ 2. Check code matches              │ │
│  │ 3. Check not expired               │ │
│  │ 4. Mark user as verified           │ │
│  │ 5. Delete token                    │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
      │
      │ 4. Response: { success: true }
      ↓
┌─────────────┐
│   Browser   │ → Redirect to /auth/create-password
└─────────────┘
      │
      │ 5. POST /api/auth/create-password
      │    { userId, password }
      ↓
┌──────────────────────────────────────────┐
│ Server: /api/auth/create-password.post.ts│
│  ┌────────────────────────────────────┐ │
│  │ 1. Validate userId & password      │ │
│  │ 2. Hash new password               │ │
│  │ 3. Update user                     │ │
│  │ 4. Create session (setUserSession) │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
      │
      │ 6. Response: { user, message }
      │    + Set-Cookie: h3:session (sealed)
      ↓
┌─────────────┐
│   Browser   │ → Redirect to /profile
│  (Authenticated)                        │
└─────────────┘
```

### 3. Architecture de permissions

```
┌────────────────────────────────────────────────────────────────────┐
│                    PERMISSION HIERARCHY                            │
└────────────────────────────────────────────────────────────────────┘

Level 1: GLOBAL ADMIN
┌────────────────────────────────────┐
│  User.isGlobalAdmin = true         │
│                                    │
│  ✓ Full access to entire platform │
│  ✓ User management                 │
│  ✓ Impersonation                   │
│  ✓ System settings                 │
│  ✓ Error logs & feedback           │
└────────────────────────────────────┘
              │
              │ Can do everything
              │
              ↓
┌────────────────────────────────────────────────────────────────────┐

Level 2: CONVENTION ORGANIZER
┌────────────────────────────────────┐
│  ConventionOrganizer               │
│                                    │
│  Rights (boolean flags):           │
│  ┌──────────────────────────────┐  │
│  │ canEditConvention            │  │──→ Modify convention metadata
│  │ canDeleteConvention          │  │──→ Delete entire convention
│  │ canManageOrganizers          │  │──→ Add/remove organizers
│  │ canAddEdition                │  │──→ Create new editions
│  │ canEditAllEditions           │  │──→ Edit any edition
│  │ canDeleteAllEditions         │  │──→ Delete any edition
│  │ canManageArtists             │  │──→ Manage invited artists
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
              │
              │ If NOT canEditAllEditions
              │    OR canDeleteAllEditions
              ↓
┌────────────────────────────────────────────────────────────────────┐

Level 3: EDITION-SPECIFIC PERMISSION
┌────────────────────────────────────┐
│  EditionOrganizerPermission        │
│                                    │
│  Specific to one edition:          │
│  ┌──────────────────────────────┐  │
│  │ organizerId (FK)             │  │
│  │ editionId (FK)               │  │
│  │ canEdit: boolean             │  │──→ Edit this edition
│  │ canDelete: boolean           │  │──→ Delete this edition
│  └──────────────────────────────┘  │
└────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    PERMISSION CHECKER ALGORITHM                    │
└────────────────────────────────────────────────────────────────────┘

async function canEditEdition(userId, editionId) {

  // Step 1: Check Global Admin
  const user = await getUser(userId)
  if (user.isGlobalAdmin) {
    return true  // ✓ Global admin can do anything
  }

  // Step 2: Get edition + convention
  const edition = await getEdition(editionId)

  // Step 3: Check if creator
  if (edition.createdById === userId) {
    return true  // ✓ Creator can edit own edition
  }

  // Step 4: Check convention-level permission
  const organizer = await getConventionOrganizer(userId, edition.conventionId)
  if (!organizer) {
    return false  // ✗ Not an organizer
  }

  if (organizer.canEditAllEditions) {
    return true  // ✓ Can edit all editions of convention
  }

  // Step 5: Check edition-specific permission
  const editionPerm = await getEditionPermission(organizer.id, editionId)
  if (editionPerm?.canEdit) {
    return true  // ✓ Has specific permission for this edition
  }

  // Step 6: No permission found
  return false  // ✗ Access denied
}
```

### 4. Architecture billeterie

```
┌────────────────────────────────────────────────────────────────────┐
│                      TICKETING SYSTEM                              │
└────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         TIERS (Tarifs)                          │
│                                                                 │
│  TicketingTier {                                                │
│    id, name, price, description                                 │
│    isVolunteer, isOrganizer, isArtist                           │
│    entryValidation: boolean                                     │
│  }                                                              │
│                                                                 │
│  Examples:                                                      │
│  - "Pass Weekend"     (50€)                                     │
│  - "Pass Journée"     (25€)                                     │
│  - "Bénévole"         (0€, isVolunteer=true)                    │
│  - "Organisateur"     (0€, isOrganizer=true)                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ 1:N
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    TIER QUOTAS (optional)                       │
│                                                                 │
│  TicketingTierQuota {                                           │
│    tierId, maxQuantity, currentQuantity                         │
│  }                                                              │
│                                                                 │
│  Example: "Pass Weekend" → Max 500 billets                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      OPTIONS (Add-ons)                          │
│                                                                 │
│  TicketingOption {                                              │
│    id, name, price, description                                 │
│    allowMultiple: boolean                                       │
│  }                                                              │
│                                                                 │
│  Examples:                                                      │
│  - "T-Shirt"          (15€, allowMultiple=true)                 │
│  - "Repas Samedi"     (10€, allowMultiple=false)                │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ 1:N
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   OPTION QUOTAS (optional)                      │
│                                                                 │
│  TicketingOptionQuota {                                         │
│    optionId, maxQuantity, currentQuantity                       │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  RETURNABLE ITEMS (Items à restituer)           │
│                                                                 │
│  TicketingReturnableItem {                                      │
│    id, name, description                                        │
│  }                                                              │
│                                                                 │
│  Examples:                                                      │
│  - "Badge Pass"                                                 │
│  - "Bracelet"                                                   │
│  - "Gobelet réutilisable"                                       │
│                                                                 │
│  Linked to:                                                     │
│  - Tiers (TicketingTierReturnableItem)                          │
│  - Options (TicketingOptionReturnableItem)                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         ORDERS                                  │
│                                                                 │
│  Order {                                                        │
│    id, userId, editionId                                        │
│    totalAmount, isPaid                                          │
│    source: "MANUAL" | "HELLOASSO"                               │
│    helloAssoCheckoutIntentId (if external)                      │
│  }                                                              │
│                                                                 │
│  Flow:                                                          │
│  1. User selects tiers + options                                │
│  2. Order created                                               │
│  3. Payment (manual or HelloAsso redirect)                      │
│  4. Order confirmed → OrderItems created                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ 1:N
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                       ORDER ITEMS                               │
│                                                                 │
│  OrderItem {                                                    │
│    id, orderId                                                  │
│    tierId, optionId (one of them)                               │
│    quantity, unitPrice                                          │
│    userId (participant)                                         │
│  }                                                              │
│                                                                 │
│  Each item = 1 ticket for 1 participant                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ 1:N
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ENTRY VALIDATIONS                            │
│                                                                 │
│  EntryValidation {                                              │
│    orderItemId                                                  │
│    validatedAt, validatedById                                   │
│  }                                                              │
│                                                                 │
│  Process:                                                       │
│  1. Scan QR code at entrance                                    │
│  2. Find OrderItem                                              │
│  3. Create EntryValidation record                               │
│  4. Allow entry (or show "Already validated")                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ACCESS CONTROL FLOW                          │
└─────────────────────────────────────────────────────────────────┘

User arrives at entrance
        │
        ↓
┌─────────────────┐
│ Scan QR Code    │
│ (OrderItem ID)  │
└─────────────────┘
        │
        ↓
POST /api/editions/[id]/ticketing/validate-entry
{ orderItemId: 123 }
        │
        ↓
┌──────────────────────────────────────────┐
│ Server checks:                           │
│ 1. OrderItem exists                      │
│ 2. Belongs to this edition               │
│ 3. Tier has entryValidation enabled      │
│ 4. Not already validated                 │
└──────────────────────────────────────────┘
        │
        ├─→ Already validated
        │   └→ Error: "Entrée déjà validée le [date]"
        │
        └─→ Valid
            └→ Create EntryValidation
            └→ Success: "Entrée validée pour [participant]"
```

### 5. Hiérarchie des composants Vue

```
App.vue
│
├─── layouts/
│    ├─── default.vue
│    │    ├─── UHeader
│    │    ├─── <slot /> (page content)
│    │    └─── UFooter
│    │
│    └─── edition-dashboard.vue
│         ├─── EditionDashboardHeader
│         ├─── EditionDashboardSidebar
│         └─── <slot />
│
├─── pages/
│    ├─── index.vue (Homepage)
│    │    ├─── ConventionList
│    │    │    └─── ConventionCard (v-for)
│    │    │         ├─── UCard
│    │    │         ├─── UBadge (favorites count)
│    │    │         └─── UButton (actions)
│    │    │
│    │    └─── EditionMap
│    │         └─── Leaflet Map + Markers
│    │
│    ├─── auth/
│    │    ├─── login.vue
│    │    │    └─── LoginForm
│    │    │         ├─── UFormField (email)
│    │    │         ├─── UFormField (password)
│    │    │         └─── UButton (submit)
│    │    │
│    │    └─── register.vue
│    │         └─── RegisterForm
│    │              ├─── UFormField (email)
│    │              ├─── UFormField (pseudo)
│    │              ├─── UFormField (password)
│    │              └─── UButton (submit)
│    │
│    ├─── conventions/[id]/
│    │    └─── index.vue
│    │         ├─── ConventionHeader
│    │         │    ├─── ConventionImage
│    │         │    └─── ConventionActions
│    │         │
│    │         ├─── ConventionInfo
│    │         │    ├─── Description
│    │         │    ├─── Location
│    │         │    └─── Services
│    │         │
│    │         └─── EditionList
│    │              └─── EditionCard (v-for)
│    │
│    └─── editions/[id]/
│         │
│         ├─── index.vue (Edition detail)
│         │    ├─── EditionHeader
│         │    ├─── EditionDescription
│         │    ├─── EditionCalendar
│         │    │    └─── FullCalendar
│         │    └─── EditionActions
│         │
│         └─── gestion/ (layout: edition-dashboard)
│              │
│              ├─── index.vue (Dashboard overview)
│              │    ├─── StatsCards
│              │    └─── QuickActions
│              │
│              ├─── ticketing/
│              │    ├─── index.vue
│              │    │    └─── TicketingMenu
│              │    │
│              │    ├─── orders.vue
│              │    │    ├─── OrdersTable
│              │    │    │    └─── UTable
│              │    │    └─── OrderDetailsModal
│              │    │         ├─── ParticipantDetailsCard (v-for)
│              │    │         └─── UButton (actions)
│              │    │
│              │    ├─── access-control.vue
│              │    │    ├─── QRScanner
│              │    │    │    └─── html5-qrcode
│              │    │    └─── ValidationResult
│              │    │
│              │    └─── stats.vue
│              │         ├─── StatsFilters
│              │         ├─── ValidationChart
│              │         │    └─── vue-chartjs (Line)
│              │         └─── SourcesChart
│              │              └─── vue-chartjs (Doughnut)
│              │
│              ├─── volunteers/
│              │    ├─── applications.vue
│              │    │    ├─── ApplicationsTable
│              │    │    │    └─── UTable
│              │    │    └─── ApplicationDetailsModal
│              │    │         ├─── VolunteerInfo
│              │    │         ├─── TeamAssignment
│              │    │         └─── MealSelection
│              │    │
│              │    └─── planning.vue
│              │         └─── VolunteerCalendar
│              │              └─── FullCalendar (timeline)
│              │
│              ├─── artists/
│              │    └─── index.vue
│              │         ├─── ArtistsTable
│              │         └─── ArtistDetailsModal
│              │              ├─── ArtistInfo
│              │              ├─── ArtistShows
│              │              └─── ArtistMeals
│              │
│              └─── organizers/
│                   └─── index.vue
│                        ├─── OrganizersTable
│                        └─── OrganizerFormModal
│                             ├─── UserSearch
│                             ├─── RightsCheckboxes
│                             └─── UButton (save)
│
└─── components/
     ├─── ui/ (Generic UI)
     │    ├─── ImpersonationBanner.vue
     │    ├─── ErrorBoundary.vue
     │    └─── LoadingSpinner.vue
     │
     ├─── edition/
     │    ├─── ticketing/
     │    │    ├─── ParticipantDetailsModal.vue
     │    │    ├─── OrganizerDetailsCard.vue
     │    │    └─── ValidationButton.vue
     │    │
     │    └─── volunteer/
     │         ├─── ApplicationCard.vue
     │         └─── TeamBadge.vue
     │
     └─── organizer/
          └─── OrganizerRightsForm.vue
```

---

## 9. Insights clés et recommandations

### Points forts du projet

#### 1. **Architecture solide**

- ✅ Séparation claire frontend/backend dans un monolithe
- ✅ Système de permissions granulaires bien pensé
- ✅ Wrapper `wrapApiHandler` pour gestion centralisée des erreurs
- ✅ Utilisation cohérente de Prisma pour la couche données
- ✅ Tests complets (273 unit + 931 nuxt = 1204 tests)

#### 2. **Stack moderne et performante**

- ✅ Nuxt 4 avec SSR pour SEO et performances
- ✅ TypeScript pour type safety
- ✅ Prisma pour DX et migrations
- ✅ Docker pour environnements reproductibles
- ✅ Vitest pour tests rapides

#### 3. **Internationalisation robuste**

- ✅ 13 langues supportées
- ✅ Lazy loading par domaine
- ✅ Scripts de synchronisation et vérification
- ✅ Workflow de traduction automatique

#### 4. **Fonctionnalités complètes**

- ✅ Billeterie avec validation d'entrée
- ✅ Gestion bénévoles avec planning
- ✅ Système d'objets trouvés
- ✅ Covoiturage
- ✅ Forum/commentaires
- ✅ Gestion artistes et spectacles

### Qualité du code

#### Forces

- **Type Safety**: TypeScript strict activé
- **Linting**: ESLint avec règles Nuxt
- **Formatting**: Prettier configuré
- **Tests**: Couverture étendue (1204 tests)
- **Documentation**: README complet + docs techniques

#### Améliorations possibles

**1. Coverage des tests**

```bash
# Activer coverage
npm run test:unit:run -- --coverage
npm run test:nuxt:run -- --coverage

# Objectif: >80% coverage
```

**2. Types Prisma optimisés**

```typescript
// Créer types helpers pour requêtes fréquentes
type UserWithOrganizer = Prisma.UserGetPayload<{
  include: { organizerOf: true }
}>

type EditionWithTicketing = Prisma.EditionGetPayload<{
  include: {
    ticketingTiers: true
    ticketingOptions: true
  }
}>
```

**3. Composables réutilisables**

```typescript
// Créer composables manquants
export const useEditionPermissions = (editionId: Ref<number>) => {
  const can = computed(() => ({
    edit: ...,
    delete: ...,
    manageTicketing: ...,
    manageVolunteers: ...
  }))

  return { can }
}
```

### Considérations de sécurité

#### ✅ Bonnes pratiques en place

- Sessions scellées HTTP-only
- Hashing bcrypt des mots de passe
- Middleware d'authentification
- Vérification permissions côté serveur
- Sanitization HTML (rehype-sanitize)
- CORS configuré

#### ⚠️ Points d'attention

**1. Impersonation**

```typescript
// ✅ Actuellement: Cookie séparé avec durée limitée (24h)
// Recommandation: Ajouter audit log
await prisma.impersonationLog.create({
  data: {
    adminId: session.user.id,
    targetUserId,
    startedAt: new Date(),
    ipAddress: getRequestIP(event),
    userAgent: getRequestHeader(event, 'user-agent'),
  },
})
```

**2. Rate limiting**

```typescript
// Recommandation: Ajouter rate limiting sur endpoints sensibles
import { defineRateLimiter } from 'nuxt-rate-limit' // À installer

export const authRateLimiter = defineRateLimiter({
  tokensPerInterval: 5,
  interval: 'minute',
  routes: ['/api/auth/login', '/api/auth/register'],
})
```

**3. Input validation**

```typescript
// ✅ Utilisation de Zod
// Recommandation: Centraliser schémas Zod
// server/schemas/auth.ts
export const RegisterSchema = z.object({
  email: z.string().email().max(255),
  pseudo: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).regex(/^(?=.*[A-Z])(?=.*\d)/),
  ...
})
```

**4. SQL Injection**

```typescript
// ✅ Prisma protège automatiquement
// ⚠️ Attention aux raw queries
await prisma.$queryRaw`SELECT * FROM User WHERE id = ${userId}` // OK
await prisma.$executeRawUnsafe(`SELECT * FROM User WHERE id = ${userId}`) // ⚠️ Dangereux
```

### Optimisations de performances

#### 1. **Database queries**

```typescript
// ❌ N+1 query problem
const editions = await prisma.edition.findMany()
for (const edition of editions) {
  const orders = await prisma.order.findMany({
    where: { editionId: edition.id },
  })
}

// ✅ Solution: include ou groupBy
const editions = await prisma.edition.findMany({
  include: {
    orders: {
      select: { id: true, totalAmount: true },
    },
  },
})
```

#### 2. **Indexes database**

```prisma
// Recommandation: Ajouter indexes sur colonnes fréquemment filtrées
model Order {
  // ...
  editionId Int
  userId    Int
  isPaid    Boolean
  createdAt DateTime @default(now())

  @@index([editionId, isPaid]) // Recherches filtrées
  @@index([userId])            // Recherches par user
  @@index([createdAt(sort: Desc)]) // Tri par date
}
```

#### 3. **Lazy loading images**

```vue
<!-- Utiliser Nuxt Image pour optimisation automatique -->
<NuxtImg
  :src="edition.coverImageUrl"
  loading="lazy"
  format="webp"
  :sizes="{ sm: '100vw', md: '50vw', lg: '33vw' }"
  :placeholder="[50, 50, 75, 5]"
/>
```

#### 4. **SSR vs CSR**

```typescript
// Recommandation: Utiliser SSR pour contenu public, CSR pour dashboards
// pages/index.vue (public) - SSR
definePageMeta({
  ssr: true, // Par défaut
})

// pages/editions/[id]/gestion/**.vue (dashboard) - CSR
definePageMeta({
  ssr: false, // Plus interactif, pas besoin SEO
})
```

#### 5. **Caching**

```typescript
// Recommandation: Ajouter cache pour données rarement modifiées
// composables/useServices.ts
export const useServices = () => {
  const services = useState('services', () => null)

  if (!services.value) {
    services.value = await $fetch('/api/services') // Cache côté client
  }

  return services
}

// server/api/services.get.ts
export default defineEventHandler(async (event) => {
  // Cache côté serveur (Redis recommandé en prod)
  const cached = await cacheStorage.getItem('services')
  if (cached) return cached

  const services = await prisma.service.findMany()
  await cacheStorage.setItem('services', services, { ttl: 3600 }) // 1h
  return services
})
```

### Maintenabilité

#### Points forts

- ✅ Structure organisée par domaines
- ✅ Nommage cohérent et explicite
- ✅ Documentation inline (JSDoc)
- ✅ Scripts utilitaires pour tâches courantes

#### Suggestions

**1. Types partagés**

```typescript
// server/types/index.ts
export interface ApiResponse<T> {
  data?: T
  error?: string
  pagination?: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

export interface ApiError {
  statusCode: number
  message: string
  operationName?: string
}
```

**2. Constants centralisées**

```typescript
// server/constants/permissions.ts
export const ORGANIZER_RIGHTS = {
  EDIT_CONVENTION: 'canEditConvention',
  DELETE_CONVENTION: 'canDeleteConvention',
  MANAGE_ORGANIZERS: 'canManageOrganizers',
  ADD_EDITION: 'canAddEdition',
  EDIT_ALL_EDITIONS: 'canEditAllEditions',
  DELETE_ALL_EDITIONS: 'canDeleteAllEditions',
  MANAGE_ARTISTS: 'canManageArtists',
} as const

export type OrganizerRight = (typeof ORGANIZER_RIGHTS)[keyof typeof ORGANIZER_RIGHTS]
```

**3. Error handling standardisé**

```typescript
// server/utils/errors.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public operationName?: string
  ) {
    super(message)
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} non trouvé(e)`)
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Action non autorisée') {
    super(403, message)
  }
}
```

### Évolutions futures recommandées

#### 1. **Système de cache Redis**

```typescript
// Installer redis
npm install ioredis

// server/utils/cache.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

export async function cached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached)

  const data = await fetcher()
  await redis.setex(key, ttl, JSON.stringify(data))
  return data
}
```

#### 2. **WebSockets pour temps réel**

```typescript
// Pour:
// - Notifications temps réel
// - Compteurs billeterie live
// - Chat entre organisateurs

// Installer socket.io
npm install socket.io socket.io-client

// server/plugins/socket.ts
export default defineNitroPlugin((nitroApp) => {
  const io = new Server(nitroApp.server)

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('subscribe-edition', (editionId) => {
      socket.join(`edition-${editionId}`)
    })
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    // Émettre événements après mutations
    if (event.path.includes('/ticketing/orders') && event.method === 'POST') {
      io.to(`edition-${editionId}`).emit('new-order', { ... })
    }
  })
})
```

#### 3. **Progressive Web App (PWA)**

```typescript
// Installer @vite-pwa/nuxt
npm install @vite-pwa/nuxt

// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@vite-pwa/nuxt'],

  pwa: {
    manifest: {
      name: 'Convention de Jonglerie',
      short_name: 'ConvJongle',
      description: 'Plateforme de gestion de conventions',
      theme_color: '#3b82f6',
      icons: [...]
    },
    workbox: {
      navigateFallback: '/',
      runtimeCaching: [...]
    }
  }
})
```

#### 4. **Background jobs**

```typescript
// Pour:
// - Envoi emails en masse
// - Géocodage batch
// - Synchronisation HelloAsso
// - Cleanup tokens expirés

// Installer bullmq
npm install bullmq

// server/queues/email.queue.ts
import { Queue, Worker } from 'bullmq'

export const emailQueue = new Queue('emails')

export const emailWorker = new Worker('emails', async (job) => {
  const { to, subject, html } = job.data
  await sendEmail({ to, subject, html })
})
```

#### 5. **Monitoring et observabilité**

```typescript
// Installer @nuxt/monitoring (ou custom)
npm install @sentry/vue

// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@sentry/nuxt/module'],

  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0
  }
})

// Ajouter metrics personnalisées
import * as Sentry from '@sentry/nuxt'

Sentry.metrics.increment('order.created', 1, {
  tags: { edition: editionId }
})
```

### Conclusion

Ce projet est une application full-stack **mature et bien architecturée** avec:

- ✅ Une base solide (Nuxt 4, Prisma, TypeScript)
- ✅ Des fonctionnalités complètes et cohérentes
- ✅ Un système de permissions granulaires élégant
- ✅ Une bonne couverture de tests
- ✅ Une documentation technique exhaustive

**Axes d'amélioration prioritaires**:

1. Cache (Redis) pour performances
2. Rate limiting pour sécurité
3. Monitoring et logs structurés
4. WebSockets pour temps réel (nice-to-have)
5. PWA pour expérience mobile (nice-to-have)

Le projet est **production-ready** avec quelques améliorations recommandées pour scale et monitoring en environnement production.

---

_Document généré le 2025-01-12_
_Dernière mise à jour du projet: Convention de Jonglerie v1.0_
_Taille du projet: 150MB, 12648 fichiers, 2916 fichiers de code_
