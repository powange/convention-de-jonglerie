# Convention de Jonglerie - Analyse Complète du Projet

> Analyse complète de l'architecture, des systèmes et de la stack technique

## 📑 Table des Matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Architecture et structure](#2-architecture-et-structure)
3. [Structure détaillée des répertoires](#3-structure-détaillée-des-répertoires)
4. [Analyse des fichiers par catégorie](#4-analyse-des-fichiers-par-catégorie)
5. [Endpoints API](#5-endpoints-api)
6. [Architecture approfondie](#6-architecture-approfondie)
7. [Configuration et environnement](#7-configuration-et-environnement)
8. [Stack technique complète](#8-stack-technique-complète)
9. [Diagrammes d'architecture](#9-diagrammes-darchitecture)
10. [Insights et recommandations](#10-insights-et-recommandations)

---

## 1. Vue d'ensemble du projet

### Type de projet

**Application Web Full-Stack** de gestion et découverte de conventions de jonglerie avec architecture moderne SSR (Server-Side Rendering).

### Description

Plateforme collaborative permettant de :

- 📅 Consulter et gérer des conventions de jonglerie internationales
- 👥 Système de gestion des bénévoles avec équipes et créneaux horaires
- 🎫 Billetterie complète intégrée (HelloAsso, contrôle d'accès)
- 🚗 Covoiturage entre participants
- 🎭 Gestion d'artistes et de spectacles
- 🏪 Objets perdus et trouvés
- 💬 Système de commentaires et posts
- 🔔 Notifications temps réel avec push notifications
- 🌍 Support multilingue (13 langues)

### Architecture pattern

**Architecture Full-Stack Moderne** :

- **Frontend** : Vue.js 3 Composition API avec Nuxt 4
- **Backend** : Nitro Server (API RESTful intégrée)
- **Pattern** : SSR (Server-Side Rendering) avec hydratation côté client
- **State Management** : Pinia (store centralisé)
- **Database ORM** : Prisma avec MySQL
- **API Architecture** : RESTful avec wrappers de sécurité et permissions granulaires

### Langages et versions

- **TypeScript** : v5.8.3 (strict mode)
- **Node.js** : >=22 <23
- **Vue.js** : v3.5.17
- **Nuxt.js** : v4.2.0
- **Prisma** : v6.18.0
- **MySQL** : Latest (via Docker)

### Statistiques du projet

- **Taille totale** : 150 MB
- **Fichiers totaux** : 12,661
- **Fichiers de code** : 2,922
- **Tests** : ~100+ fichiers de test (unit, integration, nuxt, e2e)
- **Documentation** : 37 fichiers Markdown structurés

---

## 2. Architecture et structure

### Architecture générale

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                          │
│  - Vue 3 Components                                          │
│  - Pinia Stores                                              │
│  - Composables                                               │
│  - Nuxt UI Components                                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/SSE
┌─────────────────────▼───────────────────────────────────────┐
│              NUXT 4 APPLICATION LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pages      │  │  Middleware  │  │   Layouts    │      │
│  │   (routes)   │  │   (guards)   │  │  (templates) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Server API Routes (Nitro)                    │  │
│  │  - /api/editions/*                                   │  │
│  │  - /api/conventions/*                                │  │
│  │  - /api/auth/*                                       │  │
│  │  - /api/volunteers/*                                 │  │
│  │  - /api/admin/*                                      │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│               SERVER UTILITIES LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Permissions  │  │ Validation   │  │   API Utils  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Email Service│  │  Geocoding   │  │ Rate Limiter │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 PRISMA ORM LAYER                             │
│  - Type-safe database queries                                │
│  - Migrations management                                     │
│  - Schema definition                                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    MySQL DATABASE                            │
│  - 50+ tables                                                │
│  - Relations complexes                                       │
│  - Indexes optimisés                                         │
└─────────────────────────────────────────────────────────────┘
```

### Pattern d'architecture

L'application suit un **pattern en couches (Layered Architecture)** avec séparation claire des responsabilités :

1. **Présentation Layer** (app/) - Vue composants, pages, layouts
2. **API Layer** (server/api/) - Endpoints RESTful
3. **Business Logic Layer** (server/utils/) - Logique métier réutilisable
4. **Data Access Layer** (Prisma) - ORM et accès base de données

---

## 3. Structure détaillée des répertoires

### 📁 Répertoires principaux

```
convention-de-jonglerie/
├── app/                        # Application frontend Nuxt
│   ├── assets/                 # Fichiers statiques (CSS, images)
│   ├── components/             # Composants Vue réutilisables
│   ├── composables/            # Hooks Vue Composition API
│   ├── layouts/                # Templates de layout
│   ├── middleware/             # Guards de navigation
│   ├── pages/                  # Routes automatiques (file-based routing)
│   ├── plugins/                # Plugins Nuxt
│   ├── stores/                 # Stores Pinia (state management)
│   ├── types/                  # Définitions TypeScript
│   └── utils/                  # Utilitaires frontend
│
├── server/                     # Backend Nitro
│   ├── api/                    # Endpoints API
│   ├── emails/                 # Templates d'emails Vue
│   ├── middleware/             # Middleware serveur
│   ├── routes/                 # Routes serveur additionnelles
│   ├── tasks/                  # Tâches cron
│   ├── types/                  # Types serveur
│   └── utils/                  # Utilitaires serveur
│
├── prisma/                     # Prisma ORM
│   ├── migrations/             # Migrations de base de données
│   └── schema.prisma           # Schéma de base de données
│
├── i18n/                       # Internationalisation
│   └── locales/                # Traductions (13 langues)
│
├── docs/                       # Documentation technique
│   ├── system/                 # Systèmes core
│   ├── ticketing/              # Billetterie
│   ├── volunteers/             # Bénévoles
│   ├── integrations/           # Intégrations externes
│   └── optimization/           # Optimisations
│
├── test/                       # Tests
│   ├── unit/                   # Tests unitaires
│   ├── nuxt/                   # Tests Nuxt
│   ├── integration/            # Tests d'intégration DB
│   └── e2e/                    # Tests end-to-end
│
├── scripts/                    # Scripts utilitaires
│   └── translation/            # Scripts de traduction
│
├── public/                     # Assets publics statiques
│   ├── favicons/               # Favicons
│   ├── logos/                  # Logos
│   └── uploads/                # Uploads utilisateurs
│
└── [config files]              # Configuration root
```

### 📂 Détail des répertoires clés

#### `app/components/` - Composants Vue

Organisation par domaine fonctionnel :

```
components/
├── admin/                      # Composants d'administration
│   ├── ErrorLogDetailModal.vue
│   ├── FeedbackStatusBadge.vue
│   └── UserRoleToggle.vue
├── convention/                 # Gestion des conventions
│   ├── ConventionCard.vue
│   ├── ConventionForm.vue
│   └── ConventionOrganizerList.vue
├── edition/                    # Gestion des éditions
│   ├── EditionCard.vue
│   ├── EditionFilters.vue
│   ├── carpool/                # Covoiturage
│   ├── ticketing/              # Billetterie
│   └── volunteer/              # Bénévoles
├── notifications/              # Notifications
├── organizer/                  # Organisateurs
├── shows/                      # Spectacles
├── ui/                         # Composants UI génériques
└── [shared components]         # Composants partagés
```

**Patterns utilisés** :

- Atomic Design (atoms, molecules, organisms)
- Composants contrôlés vs non-contrôlés
- Props validation avec TypeScript
- Emits typés

#### `app/pages/` - Routes (File-Based Routing)

```
pages/
├── index.vue                   # Page d'accueil (liste éditions)
├── login.vue, register.vue     # Authentification
├── profile.vue                 # Profil utilisateur
├── favorites.vue               # Éditions favorites
├── conventions/
│   ├── add.vue                 # Créer convention
│   └── [id]/
│       ├── edit.vue            # Éditer convention
│       └── editions/add.vue    # Ajouter édition
├── editions/
│   ├── add.vue                 # Créer édition standalone
│   └── [id]/
│       ├── index.vue           # Détails édition
│       ├── edit.vue            # Éditer édition
│       ├── carpool.vue         # Covoiturage
│       ├── volunteers/         # Bénévolat
│       ├── workshops.vue       # Ateliers
│       ├── lost-found.vue      # Objets perdus
│       └── gestion/            # Zone de gestion (organisateurs)
│           ├── index.vue       # Dashboard gestion
│           ├── volunteers/     # Gestion bénévoles
│           ├── ticketing/      # Gestion billetterie
│           ├── artists/        # Gestion artistes
│           ├── meals/          # Gestion repas
│           ├── workshops/      # Gestion ateliers
│           └── organizers.vue  # Gestion organisateurs
└── admin/
    ├── index.vue               # Dashboard admin
    ├── users/                  # Gestion utilisateurs
    ├── conventions.vue         # Liste conventions
    ├── error-logs.vue          # Logs d'erreurs
    ├── feedback.vue            # Feedbacks
    ├── notifications.vue       # Notifications
    ├── backup.vue              # Sauvegardes
    └── crons.vue               # Tâches planifiées
```

**Conventions de nommage** :

- `[id].vue` : Route dynamique
- `index.vue` : Route par défaut du dossier
- `gestion/` : Préfixe pour routes protégées organisateurs

#### `server/api/` - API Endpoints

Organisation RESTful par ressource :

```
api/
├── auth/                       # Authentification
│   ├── login.post.ts
│   ├── register.post.ts
│   ├── logout.post.ts
│   ├── verify-email.post.ts
│   ├── request-password-reset.post.ts
│   └── reset-password.post.ts
├── conventions/
│   ├── [id]/
│   │   ├── index.get.ts        # GET /api/conventions/:id
│   │   ├── index.put.ts        # PUT /api/conventions/:id
│   │   ├── index.delete.ts     # DELETE /api/conventions/:id
│   │   ├── editions.get.ts     # GET /api/conventions/:id/editions
│   │   └── organizers/
│   │       ├── index.get.ts    # Lister organisateurs
│   │       ├── index.post.ts   # Ajouter organisateur
│   │       └── [organizerId].delete.ts
├── editions/
│   ├── [id]/
│   │   ├── index.get.ts
│   │   ├── index.put.ts
│   │   ├── index.delete.ts
│   │   ├── volunteers/         # Bénévoles
│   │   │   ├── applications/   # Candidatures
│   │   │   ├── teams/          # Équipes
│   │   │   ├── catering/       # Restauration
│   │   │   └── notification/   # Notifications
│   │   ├── ticketing/          # Billetterie
│   │   │   ├── tiers/          # Tarifs
│   │   │   ├── options/        # Options
│   │   │   ├── quotas/         # Quotas
│   │   │   ├── orders/         # Commandes
│   │   │   ├── counters/       # Contrôle d'accès
│   │   │   └── stats/          # Statistiques
│   │   ├── carpool-offers/     # Offres covoiturage
│   │   ├── carpool-requests/   # Demandes covoiturage
│   │   ├── lost-found/         # Objets perdus
│   │   ├── posts/              # Posts/commentaires
│   │   ├── artists/            # Artistes
│   │   ├── shows/              # Spectacles
│   │   ├── workshops/          # Ateliers
│   │   └── meals/              # Repas
├── notifications/              # Notifications utilisateur
│   ├── index.get.ts
│   ├── stream.get.ts           # SSE stream
│   ├── [id]/read.patch.ts
│   └── push/                   # Push notifications
├── profile/                    # Profil utilisateur
│   ├── update.put.ts
│   ├── stats.get.ts
│   └── notification-preferences.put.ts
├── admin/                      # Administration
│   ├── users/
│   ├── error-logs/
│   ├── feedback/
│   ├── backup/
│   ├── notifications/
│   └── tasks/
└── __sitemap__/                # Génération sitemap
    ├── editions.get.ts
    ├── carpool.get.ts
    └── volunteers.get.ts
```

**Conventions de nommage des fichiers API** :

- `[param]` : Paramètre dynamique
- `*.get.ts` : Endpoint GET
- `*.post.ts` : Endpoint POST
- `*.put.ts` : Endpoint PUT
- `*.patch.ts` : Endpoint PATCH
- `*.delete.ts` : Endpoint DELETE
- `index.*` : Route par défaut

#### `server/utils/` - Utilitaires serveur

```
utils/
├── permissions/                # Système de permissions
│   ├── convention-permissions.ts
│   ├── edition-permissions.ts
│   ├── volunteer-permissions.ts
│   ├── workshop-permissions.ts
│   └── access-control-permissions.ts
├── editions/                   # Logique éditions
│   ├── volunteers/
│   │   ├── applications.ts     # Candidatures bénévoles
│   │   └── teams.ts            # Équipes
│   └── ticketing/
│       ├── helloasso.ts        # Intégration HelloAsso
│       ├── tiers.ts            # Tarifs
│       ├── options.ts          # Options
│       └── returnable-items.ts # Consignes
├── api-helpers.ts              # Helpers API génériques
├── validation-helpers.ts       # Validation et sanitization
├── validation-schemas.ts       # Schémas Zod
├── auth-utils.ts               # Utilitaires auth
├── emailService.ts             # Service email
├── notification-service.ts     # Service notifications
├── push-notification-service.ts # Push notifications
├── error-logger.ts             # Logger d'erreurs
├── rate-limiter.ts             # Rate limiting
├── geocoding.ts                # Géocodage adresses
├── anthropic.ts                # Intégration IA Claude
├── prisma.ts                   # Client Prisma singleton
├── prisma-helpers.ts           # Helpers Prisma
└── [autres utilitaires...]
```

#### `app/composables/` - Hooks Vue

```
composables/
├── useAccessControlPermissions.ts  # Permissions contrôle accès
├── useCalendar.ts                  # Intégration FullCalendar
├── useCountries.ts                 # Liste pays
├── useDateFormat.ts                # Formatage dates i18n
├── useDatetime.ts                  # Manipulation dates Luxon
├── useDateTimePicker.ts            # Date picker
├── useDebounce.ts                  # Debounce
├── useEditionStatus.ts             # Statut édition (passé/cours/futur)
├── useI18nNavigation.ts            # Navigation i18n
├── useImageLoader.ts               # Lazy loading images
├── useImageUrl.ts                  # URLs images
├── useLeafletMap.ts                # Cartes Leaflet
├── useMeals.ts                     # Gestion repas
├── useModal.ts                     # Modals
├── useNotificationStream.ts        # SSE notifications
├── useOrganizerTitle.ts            # Titres organisateurs
├── usePasswordStrength.ts          # Force mot de passe
├── useProfileStats.ts              # Stats profil
├── usePushNotifications.ts         # Push notifications
├── usePWA.ts                       # Progressive Web App
├── useRealtimeStats.ts             # Stats temps réel
├── useReturnTo.ts                  # Redirection après login
├── useTicketingCounter.ts          # Compteur billetterie
├── useVolunteerSchedule.ts         # Planning bénévoles
├── useVolunteerSettings.ts         # Config bénévoles
├── useVolunteerTeams.ts            # Équipes bénévoles
├── useVolunteerTimeSlots.ts        # Créneaux horaires
└── [autres composables...]
```

#### `prisma/` - Base de données

```
prisma/
├── schema.prisma               # Schéma complet (50+ tables)
└── migrations/                 # ~60 migrations
    ├── 20250910191127_initial_schema/
    ├── 20251027115031_add_volunteer_meal_selection/
    ├── 20251106212514_rename_collaborator_to_organizer/
    └── [autres migrations...]
```

**Principaux modèles Prisma** :

- `User` : Utilisateurs (auth, profil)
- `Convention` : Conventions de jonglerie
- `Edition` : Éditions d'une convention
- `ConventionOrganizer` : Organisateurs avec permissions granulaires
- `EditionOrganizerPermission` : Permissions par édition
- `EditionVolunteerApplication` : Candidatures bénévoles
- `VolunteerTeam` : Équipes de bénévoles
- `VolunteerTimeSlot` : Créneaux horaires
- `VolunteerAssignment` : Assignations bénévoles
- `TicketingTier` : Tarifs billetterie
- `TicketingOrder` : Commandes
- `TicketingOption` : Options billetterie
- `TicketingReturnableItem` : Objets consignés
- `EditionArtist` : Artistes
- `Show` : Spectacles
- `Workshop` : Ateliers
- `LostFoundItem` : Objets perdus
- `CarpoolOffer/Request` : Covoiturage
- `Notification` : Notifications
- `PushSubscription` : Abonnements push
- `ApiErrorLog` : Logs d'erreurs
- `Feedback` : Feedbacks utilisateurs

#### `test/` - Tests

```
test/
├── unit/                       # Tests unitaires (Vitest)
│   ├── composables/
│   ├── stores/
│   ├── utils/
│   └── security/
├── nuxt/                       # Tests Nuxt (environnement Nuxt complet)
│   ├── components/
│   ├── pages/
│   ├── features/
│   └── server/
│       ├── api/
│       ├── middleware/
│       └── utils/
├── integration/                # Tests d'intégration DB
│   ├── auth.db.test.ts
│   ├── conventions.db.test.ts
│   ├── volunteers.workflow.db.test.ts
│   └── [autres tests DB...]
├── e2e/                        # Tests end-to-end (Playwright/Vitest)
├── __mocks__/                  # Mocks
├── setup.ts                    # Setup tests Nuxt
├── setup-common.ts             # Setup commun
└── setup-db.ts                 # Setup DB tests
```

**Frameworks de test** :

- **Vitest** : Runner de tests (4 projets)
- **@nuxt/test-utils** : Utilitaires tests Nuxt
- **@testing-library/vue** : Tests composants
- **happy-dom** : DOM virtuel

**Configuration Vitest** (vitest.config.ts) :

- **Projet "unit"** : Tests unitaires simples (happy-dom)
- **Projet "nuxt"** : Tests avec environnement Nuxt complet
- **Projet "e2e"** : Tests end-to-end avec serveur
- **Projet "integration"** : Tests DB avec MySQL

#### `i18n/` - Internationalisation

```
i18n/
├── i18n.config.ts              # Configuration i18n
└── locales/
    ├── cs/                     # Tchèque
    ├── da/                     # Danois
    ├── de/                     # Allemand
    ├── en/                     # Anglais
    ├── es/                     # Espagnol
    ├── fr/                     # Français (référence)
    ├── it/                     # Italien
    ├── nl/                     # Néerlandais
    ├── pl/                     # Polonais
    ├── pt/                     # Portugais
    ├── ru/                     # Russe
    ├── sv/                     # Suédois
    └── uk/                     # Ukrainien

Chaque locale contient :
├── common.json                 # Traductions communes
├── notifications.json          # Notifications
├── components.json             # Composants
├── app.json                    # Application
├── public.json                 # Pages publiques
├── feedback.json               # Feedbacks
└── gestion.json                # Gestion (fr uniquement)
```

**Système de traduction** :

- Lazy loading par domaine
- Détection automatique clés manquantes
- Script de synchronisation `npm run check-i18n`
- Marquage [TODO] pour traductions futures
- Traduction automatique via Anthropic Claude

#### `docs/` - Documentation

```
docs/
├── README.md                   # Index documentation
├── system/                     # Systèmes core (8 fichiers)
│   ├── AUTH_SESSIONS.md
│   ├── CRON_SYSTEM.md
│   ├── ERROR_LOGGING_SYSTEM.md
│   ├── NOTIFICATION_SYSTEM.md
│   ├── ORGANIZER_PERMISSIONS.md
│   ├── api-utils-refactoring.md
│   └── feedback.md
├── ticketing/                  # Billetterie (8 fichiers)
│   ├── README.md
│   ├── access-control.md
│   ├── external-integration.md
│   ├── options.md
│   ├── orders.md
│   ├── quotas.md
│   ├── returnable-items.md
│   └── tiers.md
├── volunteers/                 # Bénévoles (7 fichiers)
│   ├── allergy-severity-utility.md
│   ├── teams-utils.md
│   ├── volunteer-application-api-utility.md
│   ├── volunteer-application-diff-utility.md
│   ├── volunteer-application-edit-mode.md
│   ├── volunteer-auto-assignment-system.md
│   └── volunteer-returnable-items-by-team.md
├── integrations/               # Intégrations (3 fichiers)
│   ├── anthropic-integration.md
│   ├── backup-system.md
│   └── helloasso-integration.md
├── optimization/               # Optimisations (8 fichiers)
│   ├── cache-http-assets.md
│   ├── i18n-component-lazy-loading.md
│   ├── i18n-lazy-loading.md
│   ├── image-loading-cache.md
│   ├── lazy-loading-libraries.md
│   ├── notification-i18n.md
│   ├── prisma-log-configuration.md
│   └── push-notifications-browser-support.md
└── archive/                    # Archives (3 fichiers)
    ├── README.md
    ├── logs-erreur-api-ameliorations.md
    └── notification-i18n-migration-guide.md
```

---

## 4. Analyse des fichiers par catégorie

### 🎨 Core Application Files

#### Entry Points et Configuration

| Fichier            | Rôle                     | Description                                                               |
| ------------------ | ------------------------ | ------------------------------------------------------------------------- |
| `nuxt.config.ts`   | Configuration Nuxt       | Configuration complète : modules, i18n, SEO, runtimeConfig, optimisations |
| `app.vue`          | Root component           | Composant racine Vue, wrapper global                                      |
| `tsconfig.json`    | Configuration TypeScript | Références aux configs Nuxt générées, chemins personnalisés               |
| `vitest.config.ts` | Configuration tests      | 4 projets de test (unit, nuxt, e2e, integration)                          |

#### Configuration et Build Tools

| Fichier                           | Type          | Description                                      |
| --------------------------------- | ------------- | ------------------------------------------------ |
| `package.json`                    | Dépendances   | 59 dependencies, 24 devDependencies, scripts npm |
| `.eslintrc.cjs`                   | Linting       | ESLint avec @nuxt/eslint                         |
| `.prettierrc` (dans package.json) | Formatage     | Prettier : singleQuote, no semi, printWidth 100  |
| `.gitignore`                      | Git           | Ignore node_modules, .nuxt, .env, uploads, etc.  |
| `.env.example`                    | Environnement | Template variables d'environnement               |

### 🔧 Data Layer

#### Database & ORM

| Fichier                          | Rôle              | Lignes                                      |
| -------------------------------- | ----------------- | ------------------------------------------- |
| `prisma/schema.prisma`           | Schéma DB         | ~2000+ lignes, 50+ modèles                  |
| `server/utils/prisma.ts`         | Client Prisma     | Singleton avec config log                   |
| `server/utils/prisma-helpers.ts` | Helpers Prisma    | Utilitaires DB réutilisables                |
| `server/utils/prisma-selects.ts` | Selects optimisés | Queries optimisées avec selects spécifiques |

**Migrations** : 60+ migrations dans `prisma/migrations/`

### 🌐 Frontend/UI

#### Pages principales

| Route                    | Fichier                                     | Description                         |
| ------------------------ | ------------------------------------------- | ----------------------------------- |
| `/`                      | `app/pages/index.vue`                       | Page d'accueil - liste des éditions |
| `/login`                 | `app/pages/login.vue`                       | Connexion                           |
| `/register`              | `app/pages/register.vue`                    | Inscription                         |
| `/profile`               | `app/pages/profile.vue`                     | Profil utilisateur                  |
| `/favorites`             | `app/pages/favorites.vue`                   | Éditions favorites                  |
| `/my-conventions`        | `app/pages/my-conventions.vue`              | Mes conventions                     |
| `/conventions/add`       | `app/pages/conventions/add.vue`             | Créer convention                    |
| `/editions/add`          | `app/pages/editions/add.vue`                | Créer édition                       |
| `/editions/[id]`         | `app/pages/editions/[id]/index.vue`         | Détails édition                     |
| `/editions/[id]/gestion` | `app/pages/editions/[id]/gestion/index.vue` | Dashboard gestion                   |
| `/admin`                 | `app/pages/admin/index.vue`                 | Dashboard admin                     |

#### Composants clés

**Composants d'édition** :

- `EditionCard.vue` : Carte d'édition avec services
- `EditionFilters.vue` : Filtres de recherche
- `EditionMap.vue` : Carte Leaflet des éditions
- `EditionServicesDisplay.vue` : Affichage services

**Composants de convention** :

- `ConventionCard.vue` : Carte de convention
- `ConventionForm.vue` : Formulaire création/édition
- `ConventionOrganizerList.vue` : Liste organisateurs avec permissions

**Composants bénévoles** :

- `VolunteerApplicationForm.vue` : Formulaire candidature
- `VolunteerApplicationList.vue` : Liste candidatures
- `VolunteerTeamManager.vue` : Gestion équipes
- `VolunteerScheduleView.vue` : Vue planning

**Composants billetterie** :

- `TicketingTierManager.vue` : Gestion tarifs
- `TicketingOrderList.vue` : Liste commandes
- `TicketingAccessControl.vue` : Contrôle d'accès
- `TicketingCounterView.vue` : Interface comptoir

#### Styles

| Fichier                   | Description                             |
| ------------------------- | --------------------------------------- |
| `app/assets/css/main.css` | Styles globaux, imports Tailwind        |
| Tailwind classes          | Utility-first CSS framework             |
| Nuxt UI theming           | Thème personnalisable via app.config.ts |

### 🧪 Testing

#### Structure des tests

| Répertoire          | Type           | Framework                 | Nombre       |
| ------------------- | -------------- | ------------------------- | ------------ |
| `test/unit/`        | Unitaires      | Vitest + happy-dom        | ~20 fichiers |
| `test/nuxt/`        | Nuxt           | Vitest + @nuxt/test-utils | ~80 fichiers |
| `test/integration/` | Intégration DB | Vitest + MySQL Docker     | ~10 fichiers |
| `test/e2e/`         | End-to-end     | Vitest                    | ~5 fichiers  |

**Coverage** : Tests couvrent les composants critiques, API endpoints, et business logic

#### Fichiers de test importants

- `test/nuxt/server/api/conventions/organizers.*.test.ts` : Tests permissions
- `test/nuxt/server/api/editions/volunteers/applications/*.test.ts` : Tests bénévoles
- `test/integration/auth.db.test.ts` : Tests auth avec DB
- `test/unit/utils/convention-services.test.ts` : Tests utilitaires
- `test/nuxt/pages/*.page.nuxt.test.ts` : Tests pages

### 📚 Documentation

#### Documentation par thème

| Catégorie         | Fichiers | Focus                                                |
| ----------------- | -------- | ---------------------------------------------------- |
| **system/**       | 8        | Systèmes fondamentaux (auth, notifs, permissions)    |
| **ticketing/**    | 8        | Billetterie complète (tiers, orders, access-control) |
| **volunteers/**   | 7        | Gestion bénévoles (teams, applications, planning)    |
| **integrations/** | 3        | Services externes (HelloAsso, Anthropic, Backup)     |
| **optimization/** | 8        | Optimisations (i18n lazy loading, cache, perf)       |
| **archive/**      | 3        | Documentation historique                             |

**Qualité de la documentation** : Excellente, détaillée, avec exemples de code

### 🔐 DevOps

#### Docker

| Fichier                      | Usage                     |
| ---------------------------- | ------------------------- |
| `docker-compose.dev.yml`     | Dev avec MySQL + app      |
| `docker-compose.prod.yml`    | Production                |
| `docker-compose.release.yml` | Release staging           |
| `docker-compose.test-*.yml`  | Tests (4 configs)         |
| `Dockerfile`                 | Build production          |
| `Dockerfile.dev`             | Build dev avec hot reload |

#### CI/CD

| Fichier                       | CI/CD                         |
| ----------------------------- | ----------------------------- |
| `.github/workflows/tests.yml` | GitHub Actions : lint + tests |

#### Scripts utilitaires

| Script                            | Description                      |
| --------------------------------- | -------------------------------- |
| `scripts/run-geocoding.mjs`       | Géocodage adresses éditions      |
| `scripts/clean-expired-tokens.ts` | Nettoyage tokens expirés         |
| `scripts/manage-admin.ts`         | Gestion admins (add/remove/list) |
| `scripts/seed-dev.ts`             | Seed données de dev              |
| `scripts/translation/*.js`        | Scripts traduction i18n          |
| `scripts/generate-favicons.ts`    | Génération favicons              |

---

## 5. Endpoints API

### 📝 Convention des endpoints

**Format** : `[METHOD] /api/[resource]/[id?]/[action?]`

**Authentification** :

- Session cookies (nuxt-auth-utils)
- Middleware `requireUserSession()` pour routes protégées
- Permissions granulaires vérifiées par `wrapApiHandler()`

### 🔐 Authentication & Authorization

| Endpoint                            | Méthode | Description                 | Protection |
| ----------------------------------- | ------- | --------------------------- | ---------- |
| `/api/auth/register`                | POST    | Inscription utilisateur     | Public     |
| `/api/auth/verify-email`            | POST    | Vérification email          | Public     |
| `/api/auth/resend-verification`     | POST    | Renvoyer code vérif         | Public     |
| `/api/auth/login`                   | POST    | Connexion                   | Public     |
| `/api/auth/logout`                  | POST    | Déconnexion                 | Auth       |
| `/api/auth/request-password-reset`  | POST    | Demander reset password     | Public     |
| `/api/auth/verify-reset-token`      | GET     | Vérifier token reset        | Public     |
| `/api/auth/reset-password`          | POST    | Réinitialiser password      | Public     |
| `/api/auth/set-password-and-verify` | POST    | Définir password + vérifier | Public     |
| `/api/session`                      | GET     | Session actuelle            | Public     |

### 👤 User Profile

| Endpoint                                | Méthode | Description                  | Protection |
| --------------------------------------- | ------- | ---------------------------- | ---------- |
| `/api/profile/update`                   | PUT     | Mettre à jour profil         | Auth       |
| `/api/profile/stats`                    | GET     | Stats utilisateur            | Auth       |
| `/api/profile/auth-info`                | GET     | Infos authentification       | Auth       |
| `/api/profile/has-password`             | GET     | Check si mot de passe défini | Auth       |
| `/api/profile/change-password`          | POST    | Changer mot de passe         | Auth       |
| `/api/profile/notification-preferences` | GET/PUT | Préférences notifications    | Auth       |
| `/api/profile/delete-picture`           | DELETE  | Supprimer photo profil       | Auth       |
| `/api/files/profile`                    | POST    | Upload photo profil          | Auth       |
| `/api/users/search`                     | GET     | Rechercher utilisateurs      | Auth       |

### 🏛️ Conventions

| Endpoint                            | Méthode | Description               | Protection        |
| ----------------------------------- | ------- | ------------------------- | ----------------- |
| `/api/conventions`                  | POST    | Créer convention          | Auth              |
| `/api/conventions/:id`              | GET     | Détails convention        | Public            |
| `/api/conventions/:id`              | PUT     | Modifier convention       | Auth + Permission |
| `/api/conventions/:id`              | DELETE  | Supprimer convention      | Auth + Permission |
| `/api/conventions/:id/editions`     | GET     | Éditions de la convention | Public            |
| `/api/conventions/:id/delete-image` | DELETE  | Supprimer image           | Auth + Permission |
| `/api/conventions/:id/archive`      | PATCH   | Archiver convention       | Auth + Permission |

**Permissions conventions** :

- `canEditConvention` : Modifier métadonnées
- `canDeleteConvention` : Supprimer
- `canManageOrganizers` : Gérer organisateurs
- `canAddEdition` : Créer éditions

### 👥 Convention Organizers (Système de permissions granulaires)

| Endpoint                                       | Méthode | Description                  | Protection                 |
| ---------------------------------------------- | ------- | ---------------------------- | -------------------------- |
| `/api/conventions/:id/organizers`              | GET     | Liste organisateurs          | Auth                       |
| `/api/conventions/:id/organizers`              | POST    | Ajouter organisateur         | Auth + canManageOrganizers |
| `/api/conventions/:id/organizers/:organizerId` | PUT     | Modifier droits organisateur | Auth + canManageOrganizers |
| `/api/conventions/:id/organizers/:organizerId` | DELETE  | Retirer organisateur         | Auth + canManageOrganizers |

**Droits organisateurs** :

- `editConvention` : Modifier convention
- `deleteConvention` : Supprimer convention
- `manageOrganizers` : Gérer organisateurs
- `addEdition` : Créer éditions
- `editAllEditions` : Modifier toutes éditions
- `deleteAllEditions` : Supprimer toutes éditions
- `manageVolunteers` : Gérer bénévoles
- `manageArtists` : Gérer artistes
- `manageMeals` : Gérer repas
- `manageTicketing` : Gérer billetterie
- `perEdition[]` : Droits ciblés par édition (`canEdit`, `canDelete`, `canManageVolunteers`)

### 📅 Editions

| Endpoint                                                   | Méthode | Description                       | Protection        |
| ---------------------------------------------------------- | ------- | --------------------------------- | ----------------- |
| `/api/editions`                                            | POST    | Créer édition                     | Auth              |
| `/api/editions/favorites`                                  | GET     | Éditions favorites                | Auth              |
| `/api/editions/:id`                                        | GET     | Détails édition                   | Public            |
| `/api/editions/:id`                                        | PUT     | Modifier édition                  | Auth + Permission |
| `/api/editions/:id`                                        | DELETE  | Supprimer édition                 | Auth + Permission |
| `/api/editions/:id/attendance`                             | POST    | Marquer présence                  | Auth              |
| `/api/editions/:id/permissions/can-access-meal-validation` | GET     | Check permission validation repas | Auth              |

**Permissions éditions** :

- Via organisateur de la convention
- `editAllEditions` ou `perEdition[editionId].canEdit`
- `deleteAllEditions` ou `perEdition[editionId].canDelete`

### 🤝 Volunteers (Bénévoles)

#### Applications (Candidatures)

| Endpoint                                                          | Méthode | Description           | Protection                 |
| ----------------------------------------------------------------- | ------- | --------------------- | -------------------------- |
| `/api/editions/:id/volunteers/applications`                       | POST    | Candidater            | Auth                       |
| `/api/editions/:id/volunteers/applications`                       | GET     | Liste candidatures    | Auth + Permission          |
| `/api/editions/:id/volunteers/applications/:applicationId`        | GET     | Détails candidature   | Auth                       |
| `/api/editions/:id/volunteers/applications/:applicationId`        | PUT     | Modifier candidature  | Auth                       |
| `/api/editions/:id/volunteers/applications/:applicationId`        | DELETE  | Supprimer candidature | Auth                       |
| `/api/editions/:id/volunteers/applications/:applicationId/accept` | POST    | Accepter candidature  | Auth + canManageVolunteers |
| `/api/editions/:id/volunteers/applications/:applicationId/reject` | POST    | Rejeter candidature   | Auth + canManageVolunteers |

#### Teams (Équipes)

| Endpoint                                                                 | Méthode | Description       | Protection                 |
| ------------------------------------------------------------------------ | ------- | ----------------- | -------------------------- |
| `/api/editions/:id/volunteer-teams`                                      | GET     | Liste équipes     | Public                     |
| `/api/editions/:id/volunteer-teams`                                      | POST    | Créer équipe      | Auth + canManageVolunteers |
| `/api/editions/:id/volunteer-teams/:teamId`                              | PUT     | Modifier équipe   | Auth + canManageVolunteers |
| `/api/editions/:id/volunteer-teams/:teamId`                              | DELETE  | Supprimer équipe  | Auth + canManageVolunteers |
| `/api/editions/:id/volunteers/applications/:applicationId/teams/:teamId` | POST    | Assigner à équipe | Auth + canManageVolunteers |
| `/api/editions/:id/volunteers/applications/:applicationId/teams/:teamId` | DELETE  | Retirer d'équipe  | Auth + canManageVolunteers |

#### Time Slots (Créneaux horaires)

| Endpoint                                                                   | Méthode | Description         | Protection                 |
| -------------------------------------------------------------------------- | ------- | ------------------- | -------------------------- |
| `/api/editions/:id/volunteer-time-slots`                                   | GET     | Liste créneaux      | Public                     |
| `/api/editions/:id/volunteer-time-slots`                                   | POST    | Créer créneau       | Auth + canManageVolunteers |
| `/api/editions/:id/volunteer-time-slots/:slotId`                           | PUT     | Modifier créneau    | Auth + canManageVolunteers |
| `/api/editions/:id/volunteer-time-slots/:slotId`                           | DELETE  | Supprimer créneau   | Auth + canManageVolunteers |
| `/api/editions/:id/volunteer-time-slots/:slotId/assignments`               | POST    | Assigner bénévole   | Auth + canManageVolunteers |
| `/api/editions/:id/volunteer-time-slots/:slotId/assignments/:assignmentId` | DELETE  | Retirer assignation | Auth + canManageVolunteers |

#### Notifications

| Endpoint                                                     | Méthode | Description               | Protection                 |
| ------------------------------------------------------------ | ------- | ------------------------- | -------------------------- |
| `/api/editions/:id/volunteers/notification`                  | POST    | Créer groupe notification | Auth + canManageVolunteers |
| `/api/editions/:id/volunteers/notification`                  | GET     | Liste groupes             | Auth + canManageVolunteers |
| `/api/editions/:id/volunteers/notification/:groupId`         | GET     | Détails groupe            | Public                     |
| `/api/editions/:id/volunteers/notification/:groupId`         | DELETE  | Supprimer groupe          | Auth + canManageVolunteers |
| `/api/editions/:id/volunteers/notification/:groupId/confirm` | POST    | Confirmer réception       | Public (token)             |

#### Catering (Restauration)

| Endpoint                                | Méthode | Description          | Protection                 |
| --------------------------------------- | ------- | -------------------- | -------------------------- |
| `/api/editions/:id/volunteers/catering` | GET     | Besoins restauration | Auth + canManageVolunteers |

### 🎫 Ticketing (Billetterie)

#### Tiers (Tarifs)

| Endpoint                                    | Méthode | Description     | Protection                |
| ------------------------------------------- | ------- | --------------- | ------------------------- |
| `/api/editions/:id/ticketing/tiers`         | GET     | Liste tarifs    | Public                    |
| `/api/editions/:id/ticketing/tiers`         | POST    | Créer tarif     | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/tiers/:tierId` | PUT     | Modifier tarif  | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/tiers/:tierId` | DELETE  | Supprimer tarif | Auth + canManageTicketing |

#### Options

| Endpoint                                        | Méthode | Description      | Protection                |
| ----------------------------------------------- | ------- | ---------------- | ------------------------- |
| `/api/editions/:id/ticketing/options`           | GET     | Liste options    | Public                    |
| `/api/editions/:id/ticketing/options`           | POST    | Créer option     | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/options/:optionId` | PUT     | Modifier option  | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/options/:optionId` | DELETE  | Supprimer option | Auth + canManageTicketing |

#### Quotas

| Endpoint                                      | Méthode | Description     | Protection                |
| --------------------------------------------- | ------- | --------------- | ------------------------- |
| `/api/editions/:id/ticketing/quotas`          | GET     | Liste quotas    | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/quotas`          | POST    | Créer quota     | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/quotas/:quotaId` | PUT     | Modifier quota  | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/quotas/:quotaId` | DELETE  | Supprimer quota | Auth + canManageTicketing |

#### Orders (Commandes)

| Endpoint                                      | Méthode | Description       | Protection                |
| --------------------------------------------- | ------- | ----------------- | ------------------------- |
| `/api/editions/:id/ticketing/orders`          | GET     | Liste commandes   | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/orders/:orderId` | GET     | Détails commande  | Auth                      |
| `/api/editions/:id/ticketing/orders/:orderId` | PUT     | Modifier commande | Auth + canManageTicketing |

#### Returnable Items (Objets consignés)

| Endpoint                                               | Méthode | Description     | Protection                |
| ------------------------------------------------------ | ------- | --------------- | ------------------------- |
| `/api/editions/:id/ticketing/returnable-items`         | GET     | Liste objets    | Public                    |
| `/api/editions/:id/ticketing/returnable-items`         | POST    | Créer objet     | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/returnable-items/:itemId` | PUT     | Modifier objet  | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/returnable-items/:itemId` | DELETE  | Supprimer objet | Auth + canManageTicketing |

#### Access Control (Contrôle d'accès)

| Endpoint                                                   | Méthode | Description          | Protection                |
| ---------------------------------------------------------- | ------- | -------------------- | ------------------------- |
| `/api/editions/:id/ticketing/counters`                     | GET     | Liste comptoirs      | Auth + Permission         |
| `/api/editions/:id/ticketing/counters`                     | POST    | Créer comptoir       | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/counters/:counterId`          | GET     | Détails comptoir     | Auth + Permission         |
| `/api/editions/:id/ticketing/counters/:counterId`          | PUT     | Modifier comptoir    | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/counters/:counterId`          | DELETE  | Supprimer comptoir   | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/counters/:counterId/validate` | POST    | Valider entrée       | Auth + Permission         |
| `/api/editions/:id/ticketing/counters/:counterId/stream`   | GET     | SSE stats temps réel | Auth + Permission         |
| `/api/editions/:id/ticketing/counters/token/:token`        | GET     | Access via token     | Public (token)            |

#### Statistics

| Endpoint                            | Méthode | Description              | Protection                |
| ----------------------------------- | ------- | ------------------------ | ------------------------- |
| `/api/editions/:id/ticketing/stats` | GET     | Statistiques billetterie | Auth + canManageTicketing |

#### External Integration

| Endpoint                                        | Méthode | Description       | Protection                |
| ----------------------------------------------- | ------- | ----------------- | ------------------------- |
| `/api/editions/:id/ticketing/external`          | GET     | Config externe    | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/external`          | PUT     | Modifier config   | Auth + canManageTicketing |
| `/api/editions/:id/ticketing/helloasso/webhook` | POST    | Webhook HelloAsso | Public (signature)        |
| `/api/editions/:id/ticketing/helloasso/sync`    | POST    | Sync HelloAsso    | Auth + canManageTicketing |

### 🚗 Carpool (Covoiturage)

#### Offers (Offres)

| Endpoint                                      | Méthode  | Description          | Protection   |
| --------------------------------------------- | -------- | -------------------- | ------------ |
| `/api/editions/:id/carpool-offers`            | GET      | Liste offres         | Public       |
| `/api/editions/:id/carpool-offers`            | POST     | Créer offre          | Auth         |
| `/api/carpool-offers/:id`                     | GET      | Détails offre        | Public       |
| `/api/carpool-offers/:id`                     | PUT      | Modifier offre       | Auth + Owner |
| `/api/carpool-offers/:id`                     | DELETE   | Supprimer offre      | Auth + Owner |
| `/api/carpool-offers/:id/bookings`            | GET      | Liste réservations   | Auth         |
| `/api/carpool-offers/:id/bookings`            | POST     | Réserver place       | Auth         |
| `/api/carpool-offers/:id/bookings/:bookingId` | PUT      | Modifier réservation | Auth         |
| `/api/carpool-offers/:id/passengers`          | POST     | Ajouter passager     | Auth + Owner |
| `/api/carpool-offers/:id/passengers/:userId`  | DELETE   | Retirer passager     | Auth + Owner |
| `/api/carpool-offers/:id/comments`            | GET/POST | Commentaires         | Public/Auth  |

#### Requests (Demandes)

| Endpoint                             | Méthode  | Description       | Protection   |
| ------------------------------------ | -------- | ----------------- | ------------ |
| `/api/editions/:id/carpool-requests` | GET      | Liste demandes    | Public       |
| `/api/carpool-requests`              | POST     | Créer demande     | Auth         |
| `/api/carpool-requests/:id`          | GET      | Détails demande   | Public       |
| `/api/carpool-requests/:id`          | PUT      | Modifier demande  | Auth + Owner |
| `/api/carpool-requests/:id`          | DELETE   | Supprimer demande | Auth + Owner |
| `/api/carpool-requests/:id/comments` | GET/POST | Commentaires      | Public/Auth  |

### 🔔 Notifications

| Endpoint                              | Méthode | Description           | Protection |
| ------------------------------------- | ------- | --------------------- | ---------- |
| `/api/notifications`                  | GET     | Liste notifications   | Auth       |
| `/api/notifications/stats`            | GET     | Stats notifications   | Auth       |
| `/api/notifications/stream`           | GET     | SSE stream temps réel | Auth       |
| `/api/notifications/:id/read`         | PATCH   | Marquer comme lu      | Auth       |
| `/api/notifications/:id/unread`       | PATCH   | Marquer comme non lu  | Auth       |
| `/api/notifications/:id/delete`       | DELETE  | Supprimer             | Auth       |
| `/api/notifications/mark-all-read`    | PATCH   | Tout marquer lu       | Auth       |
| `/api/notifications/push/subscribe`   | POST    | S'abonner push        | Auth       |
| `/api/notifications/push/unsubscribe` | POST    | Se désabonner push    | Auth       |

### 🎭 Artists & Shows (Artistes & Spectacles)

| Endpoint                              | Méthode | Description         | Protection              |
| ------------------------------------- | ------- | ------------------- | ----------------------- |
| `/api/editions/:id/artists`           | GET     | Liste artistes      | Public                  |
| `/api/editions/:id/artists`           | POST    | Ajouter artiste     | Auth + canManageArtists |
| `/api/editions/:id/artists/:artistId` | GET     | Détails artiste     | Public                  |
| `/api/editions/:id/artists/:artistId` | PUT     | Modifier artiste    | Auth + canManageArtists |
| `/api/editions/:id/artists/:artistId` | DELETE  | Supprimer artiste   | Auth + canManageArtists |
| `/api/editions/:id/shows`             | GET     | Liste spectacles    | Public                  |
| `/api/editions/:id/shows`             | POST    | Créer spectacle     | Auth + canManageArtists |
| `/api/editions/:id/shows/:showId`     | PUT     | Modifier spectacle  | Auth + canManageArtists |
| `/api/editions/:id/shows/:showId`     | DELETE  | Supprimer spectacle | Auth + canManageArtists |

### 🎓 Workshops (Ateliers)

| Endpoint                                  | Méthode  | Description       | Protection        |
| ----------------------------------------- | -------- | ----------------- | ----------------- |
| `/api/editions/:id/workshops`             | GET      | Liste ateliers    | Public            |
| `/api/editions/:id/workshops`             | POST     | Créer atelier     | Auth              |
| `/api/editions/:id/workshops/:workshopId` | GET      | Détails atelier   | Public            |
| `/api/editions/:id/workshops/:workshopId` | PUT      | Modifier atelier  | Auth + Permission |
| `/api/editions/:id/workshops/:workshopId` | DELETE   | Supprimer atelier | Auth + Permission |
| `/api/editions/:id/workshops/locations`   | GET/POST | Lieux ateliers    | Public/Auth       |

### 🍽️ Meals (Repas)

| Endpoint                                   | Méthode | Description          | Protection            |
| ------------------------------------------ | ------- | -------------------- | --------------------- |
| `/api/editions/:id/meals`                  | GET     | Liste repas          | Auth + canManageMeals |
| `/api/editions/:id/meals/participants`     | GET     | Liste participants   | Auth + canManageMeals |
| `/api/editions/:id/meals/:mealId/validate` | POST    | Valider consommation | Auth + Permission     |
| `/api/editions/:id/meals/:mealId/stats`    | GET     | Stats repas          | Auth + canManageMeals |

### 📦 Lost & Found (Objets perdus)

| Endpoint                                        | Méthode  | Description     | Protection        |
| ----------------------------------------------- | -------- | --------------- | ----------------- |
| `/api/editions/:id/lost-found`                  | GET      | Liste objets    | Public            |
| `/api/editions/:id/lost-found`                  | POST     | Déclarer objet  | Auth              |
| `/api/editions/:id/lost-found/:itemId`          | GET      | Détails objet   | Public            |
| `/api/editions/:id/lost-found/:itemId`          | PUT      | Modifier objet  | Auth + Permission |
| `/api/editions/:id/lost-found/:itemId`          | DELETE   | Supprimer objet | Auth + Permission |
| `/api/editions/:id/lost-found/:itemId/found`    | PATCH    | Marquer trouvé  | Auth + Permission |
| `/api/editions/:id/lost-found/:itemId/comments` | GET/POST | Commentaires    | Public/Auth       |

### 💬 Posts & Comments (Posts & Commentaires)

| Endpoint                                              | Méthode | Description           | Protection         |
| ----------------------------------------------------- | ------- | --------------------- | ------------------ |
| `/api/editions/:id/posts`                             | GET     | Liste posts           | Public             |
| `/api/editions/:id/posts`                             | POST    | Créer post            | Auth               |
| `/api/editions/:id/posts/:postId`                     | GET     | Détails post          | Public             |
| `/api/editions/:id/posts/:postId`                     | PUT     | Modifier post         | Auth + Owner       |
| `/api/editions/:id/posts/:postId`                     | DELETE  | Supprimer post        | Auth + Owner/Admin |
| `/api/editions/:id/posts/:postId/comments`            | GET     | Liste commentaires    | Public             |
| `/api/editions/:id/posts/:postId/comments`            | POST    | Ajouter commentaire   | Auth               |
| `/api/editions/:id/posts/:postId/comments/:commentId` | DELETE  | Supprimer commentaire | Auth + Owner/Admin |

### 👑 Admin

#### Users

| Endpoint                               | Méthode | Description           | Protection  |
| -------------------------------------- | ------- | --------------------- | ----------- |
| `/api/admin/users`                     | GET     | Liste utilisateurs    | GlobalAdmin |
| `/api/admin/users/:id`                 | GET     | Détails utilisateur   | GlobalAdmin |
| `/api/admin/users/:id`                 | PUT     | Modifier utilisateur  | GlobalAdmin |
| `/api/admin/users/:id`                 | DELETE  | Supprimer utilisateur | GlobalAdmin |
| `/api/admin/users/:id/promote`         | PUT     | Promouvoir admin      | GlobalAdmin |
| `/api/admin/users/:id/profile-picture` | PUT     | Modifier photo        | GlobalAdmin |

#### Error Logs

| Endpoint                                | Méthode | Description         | Protection  |
| --------------------------------------- | ------- | ------------------- | ----------- |
| `/api/admin/error-logs`                 | GET     | Liste logs erreurs  | GlobalAdmin |
| `/api/admin/error-logs/:id`             | GET     | Détails erreur      | GlobalAdmin |
| `/api/admin/error-logs/:id/resolve`     | PATCH   | Résoudre erreur     | GlobalAdmin |
| `/api/admin/error-logs/resolve-similar` | POST    | Résoudre similaires | GlobalAdmin |
| `/api/admin/error-logs/cleanup-old`     | POST    | Nettoyer anciens    | GlobalAdmin |

#### Feedback

| Endpoint                          | Méthode | Description       | Protection  |
| --------------------------------- | ------- | ----------------- | ----------- |
| `/api/admin/feedback`             | GET     | Liste feedbacks   | GlobalAdmin |
| `/api/admin/feedback/:id/resolve` | PUT     | Résoudre feedback | GlobalAdmin |

#### Backup

| Endpoint                     | Méthode | Description            | Protection  |
| ---------------------------- | ------- | ---------------------- | ----------- |
| `/api/admin/backup/list`     | GET     | Liste sauvegardes      | GlobalAdmin |
| `/api/admin/backup/create`   | POST    | Créer sauvegarde       | GlobalAdmin |
| `/api/admin/backup/download` | GET     | Télécharger sauvegarde | GlobalAdmin |
| `/api/admin/backup/restore`  | POST    | Restaurer sauvegarde   | GlobalAdmin |
| `/api/admin/backup/delete`   | DELETE  | Supprimer sauvegarde   | GlobalAdmin |

#### System

| Endpoint                                  | Méthode | Description              | Protection  |
| ----------------------------------------- | ------- | ------------------------ | ----------- |
| `/api/admin/stats`                        | GET     | Statistiques globales    | GlobalAdmin |
| `/api/admin/config`                       | GET     | Configuration système    | GlobalAdmin |
| `/api/admin/tasks`                        | GET     | Liste tâches cron        | GlobalAdmin |
| `/api/admin/tasks/:taskName`              | POST    | Exécuter tâche           | GlobalAdmin |
| `/api/admin/import-edition`               | POST    | Importer édition         | GlobalAdmin |
| `/api/admin/assign-meals-volunteers`      | POST    | Assigner repas bénévoles | GlobalAdmin |
| `/api/admin/notifications/stats`          | GET     | Stats notifications      | GlobalAdmin |
| `/api/admin/notifications/test`           | POST    | Tester notifications     | GlobalAdmin |
| `/api/admin/notifications/send-reminders` | POST    | Envoyer rappels          | GlobalAdmin |

### 🗺️ Sitemap & SEO

| Endpoint                      | Méthode | Description         | Protection |
| ----------------------------- | ------- | ------------------- | ---------- |
| `/api/__sitemap__/editions`   | GET     | Sitemap éditions    | Public     |
| `/api/__sitemap__/carpool`    | GET     | Sitemap covoiturage | Public     |
| `/api/__sitemap__/volunteers` | GET     | Sitemap bénévoles   | Public     |
| `/api/site.webmanifest`       | GET     | PWA manifest        | Public     |

### 🔒 Sécurité API

#### Système de permissions

**Wrapper principal** : `wrapApiHandler()` dans `server/utils/api-helpers.ts`

Fonctionnalités :

- Validation automatique des IDs (convention, edition)
- Vérification des permissions granulaires
- Gestion d'erreurs standardisée
- Rate limiting
- Logging d'erreurs

**Vérifications de permissions** :

- `checkConventionPermission()` : Vérifie droits convention
- `checkEditionPermission()` : Vérifie droits édition
- `hasVolunteerManagementPermission()` : Droits gestion bénévoles
- `hasArtistManagementPermission()` : Droits gestion artistes
- `hasMealManagementPermission()` : Droits gestion repas
- `hasTicketingManagementPermission()` : Droits gestion billetterie

**Rate limiting** :

- Implémenté via `server/utils/rate-limiter.ts`
- Limite par IP et par utilisateur
- Configurable par endpoint

---

## 6. Architecture approfondie

### 🔄 Flux de données complet

#### 1. Requête utilisateur → Rendu page

```
┌──────────┐
│ Browser  │ → Requête URL (ex: /editions/123)
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Nuxt 4 SSR                             │
│  1. Routing (file-based)                │
│  2. Middleware exécuté                  │
│     - auth.global.ts (check session)    │
│     - edition-organizer.ts (permissions)│
│  3. Page component chargé               │
│     - app/pages/editions/[id]/index.vue │
│  4. Data fetching (useFetch, useAsyncData)│
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  API Route (Nitro)                      │
│  - server/api/editions/[id]/index.get.ts│
│  1. wrapApiHandler() wrapper            │
│  2. Validation ID + permissions         │
│  3. Prisma query                        │
│  4. Transform response                  │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Prisma ORM                             │
│  1. Type-safe query                     │
│  2. Relations incluses                  │
│  3. Données retournées                  │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  MySQL Database                         │
│  - Edition table + relations            │
│  - Indexes optimisés                    │
└─────────────────────────────────────────┘
```

#### 2. Mutation de données (exemple: créer candidature bénévole)

```
┌──────────┐
│ Browser  │ → Submit form (POST /api/editions/:id/volunteers/applications)
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Vue Component                          │
│  - VolunteerApplicationForm.vue         │
│  1. Validation client (Zod schema)      │
│  2. $fetch() vers API                   │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  API Endpoint                           │
│  - .../applications/index.post.ts       │
│  1. requireUserSession()                │
│  2. wrapApiHandler()                    │
│  3. Validation serveur (Zod)            │
│  4. Check candidature existante         │
│  5. Prisma create()                     │
│  6. Send notification email             │
│  7. Create in-app notification          │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Server Utils                           │
│  - emailService.ts                      │
│  - notification-service.ts              │
│  - error-logger.ts (si erreur)          │
└─────────────────────────────────────────┘
```

#### 3. Notifications temps réel (SSE)

```
┌──────────┐
│ Browser  │ → Connection SSE (/api/notifications/stream)
└────┬─────┘     EventSource()
     │
     │ ┌─────────────────────────────────┐
     └─┤  Nuxt Server (Nitro)            │
       │  - notification-stream-manager.ts│
       │  1. Store connection            │
       │  2. Send heartbeat every 30s    │
       └────┬────────────────────────────┘
            │
            │ Events
            │
       ┌────▼────────────────────────────┐
       │  Notification Service           │
       │  1. New notification created    │
       │  2. Find user connections       │
       │  3. Push event to SSE stream    │
       └─────────────────────────────────┘
```

### 🧩 Patterns d'architecture

#### 1. Repository Pattern (via Prisma)

```typescript
// server/utils/prisma.ts - Singleton
export const prisma = new PrismaClient({
  log: getLogLevels(),
})

// Utilisé dans les API routes
const edition = await prisma.edition.findUnique({
  where: { id },
  include: {
    convention: true,
    volunteerApplications: true,
  },
})
```

#### 2. Service Layer Pattern

```typescript
// server/utils/notification-service.ts
export async function createNotification(params) {
  // Logique métier centralisée
  const notification = await prisma.notification.create({...})

  // Push to SSE stream
  notificationStreamManager.pushNotification(userId, notification)

  // Push notification si abonné
  if (hasSubscription) {
    await sendPushNotification(...)
  }

  return notification
}
```

#### 3. API Wrapper Pattern

```typescript
// server/utils/api-helpers.ts
export function wrapApiHandler(handler, options) {
  return defineEventHandler(async (event) => {
    try {
      // 1. Validation automatique
      const validated = await validateParams(event, options)

      // 2. Check permissions
      await checkPermissions(validated, options.permission)

      // 3. Exécuter handler
      const result = await handler(event, validated)

      return result
    } catch (error) {
      // 4. Logging + error response
      await logError(error, event)
      throw createError({...})
    }
  })
}

// Utilisation
export default wrapApiHandler(
  async (event, { edition }) => {
    // Handler avec édition pré-validée
    return edition
  },
  {
    requireEdition: true,
    permission: 'canEdit'
  }
)
```

#### 4. Composable Pattern (Vue)

```typescript
// app/composables/useVolunteerSchedule.ts
export function useVolunteerSchedule(editionId: Ref<number>) {
  const timeSlots = ref([])
  const loading = ref(false)

  async function fetchTimeSlots() {
    loading.value = true
    const data = await $fetch(`/api/editions/${editionId.value}/volunteer-time-slots`)
    timeSlots.value = data
    loading.value = false
  }

  async function assignVolunteer(slotId, volunteerId) {
    await $fetch(`/api/editions/${editionId.value}/volunteer-time-slots/${slotId}/assignments`, {
      method: 'POST',
      body: { volunteerId },
    })
    await fetchTimeSlots() // Refresh
  }

  return {
    timeSlots,
    loading,
    fetchTimeSlots,
    assignVolunteer,
  }
}
```

#### 5. Store Pattern (Pinia)

```typescript
// app/stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => !!user.value)
  const isGlobalAdmin = computed(() => user.value?.isGlobalAdmin ?? false)

  async function fetchUser() {
    const data = await $fetch('/api/session')
    user.value = data.user
  }

  async function login(credentials) {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: credentials,
    })
    await fetchUser()
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return {
    user,
    isAuthenticated,
    isGlobalAdmin,
    fetchUser,
    login,
    logout,
  }
})
```

### 🔐 Système de permissions granulaires

#### Architecture des permissions

```
Convention
├── ConventionOrganizer (permissions globales)
│   ├── canEditConvention
│   ├── canDeleteConvention
│   ├── canManageOrganizers
│   ├── canAddEdition
│   ├── canEditAllEditions
│   ├── canDeleteAllEditions
│   ├── canManageVolunteers (global)
│   ├── canManageArtists (global)
│   ├── canManageMeals (global)
│   └── canManageTicketing (global)
│
└── EditionOrganizerPermission (permissions par édition)
    └── Pour chaque édition :
        ├── canEdit
        ├── canDelete
        ├── canManageVolunteers
        ├── canManageArtists
        ├── canManageMeals
        └── canManageTicketing
```

#### Résolution des permissions

```typescript
// server/utils/permissions/edition-permissions.ts
export async function checkEditionPermission(
  userId: number,
  editionId: number,
  requiredPermission: 'canEdit' | 'canDelete' | ...
) {
  // 1. Check global admin
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.isGlobalAdmin) return true

  // 2. Find organizer role
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          organizers: {
            where: { userId },
            include: { perEditionPermissions: true }
          }
        }
      }
    }
  })

  const organizer = edition.convention.organizers[0]
  if (!organizer) return false

  // 3. Check global permission (ex: canEditAllEditions)
  if (organizer[`${requiredPermission}All`]) return true

  // 4. Check per-edition permission
  const editionPerm = organizer.perEditionPermissions.find(
    p => p.editionId === editionId
  )

  return editionPerm?.[requiredPermission] ?? false
}
```

### 📡 Communication temps réel

#### SSE (Server-Sent Events)

**Notifications** :

```typescript
// server/utils/notification-stream-manager.ts
class NotificationStreamManager {
  private connections = new Map<number, Set<H3Event>>()

  addConnection(userId: number, event: H3Event) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set())
    }
    this.connections.get(userId)!.add(event)
  }

  pushNotification(userId: number, notification: Notification) {
    const userConnections = this.connections.get(userId)
    if (!userConnections) return

    for (const event of userConnections) {
      event.node.res.write(`data: ${JSON.stringify(notification)}\n\n`)
    }
  }
}
```

**Comptoir billetterie temps réel** :

```typescript
// server/utils/ticketing-counter-sse.ts
// Stream des validations en temps réel
export function createCounterStream(editionId: number, counterId: number) {
  return eventStream(event, async (send) => {
    // Send stats every second
    const interval = setInterval(async () => {
      const stats = await getCounterStats(counterId)
      await send('stats', stats)
    }, 1000)

    // Cleanup
    event.node.req.on('close', () => clearInterval(interval))
  })
}
```

### 🧪 Architecture des tests

#### 4 projets Vitest

1. **Unit** (environment: happy-dom)
   - Tests isolés sans Nuxt
   - Utils, composables purs
   - Rapide (~50ms par test)

2. **Nuxt** (environment: nuxt)
   - Tests avec environnement Nuxt complet
   - API endpoints, pages, components
   - Lent (~500ms par test)

3. **Integration** (environment: node)
   - Tests avec vraie base de données
   - Workflows complets (auth, volunteers)
   - Séquentiel (pas de parallélisation)

4. **E2E** (environment: nuxt)
   - Tests end-to-end avec serveur démarré
   - Scénarios utilisateur complets

#### Stratégie de mocking

```typescript
// test/__mocks__/app-manifest.ts
export default {
  // Mock du manifest Nuxt pour éviter erreurs en test
}

// test/setup.ts
vi.mock('#app-manifest', () => import('./__mocks__/app-manifest'))
```

---

## 7. Configuration et environnement

### 🔧 Variables d'environnement

#### Configuration principale (.env)

```bash
# Base de données
DATABASE_URL="mysql://user:password@host:port/database_name"

# Authentification (nuxt-auth-utils)
NUXT_SESSION_PASSWORD="secret_32_chars_min"  # Requis en production

# Email
SEND_EMAILS="false"                          # true pour envoi réel
SMTP_USER="email@example.com"                # Si SEND_EMAILS=true
SMTP_PASS="app_password"                     # Si SEND_EMAILS=true

# IA (Anthropic Claude)
ANTHROPIC_API_KEY="sk-ant-..."              # Pour features IA

# AI Provider Configuration
AI_PROVIDER="anthropic"                      # anthropic, ollama, ou lmstudio
OLLAMA_BASE_URL="http://localhost:11434"     # Si AI_PROVIDER=ollama
OLLAMA_MODEL="llava"                         # Modèle Ollama avec vision
LMSTUDIO_BASE_URL="http://localhost:1234"    # Si AI_PROVIDER=lmstudio
LMSTUDIO_MODEL="auto"                        # Modèle LM Studio

# reCAPTCHA (optionnel)
NUXT_PUBLIC_RECAPTCHA_SITE_KEY=""            # Site key v3
NUXT_RECAPTCHA_SECRET_KEY=""                 # Secret key serveur
NUXT_RECAPTCHA_MIN_SCORE="0.5"              # Seuil score (0-1)
NUXT_RECAPTCHA_EXPECTED_HOSTNAME=""          # Hostname attendu
NUXT_RECAPTCHA_DEV_BYPASS="true"            # Bypass en dev

# Push Notifications
NUXT_PUBLIC_VAPID_PUBLIC_KEY=""              # VAPID public key
VAPID_PRIVATE_KEY=""                         # VAPID private key

# Site
NUXT_PUBLIC_SITE_URL="http://localhost:3000" # URL base du site

# Docker MySQL (optionnel, defaults fournis)
MYSQL_ROOT_PASSWORD="rootpassword"
MYSQL_DATABASE="convention_db"
MYSQL_USER="convention_user"
MYSQL_PASSWORD="convention_password"

# Stockage fichiers
NUXT_FILE_STORAGE_MOUNT="/uploads"           # Point de montage uploads

# Prisma Logs (optionnel)
PRISMA_LOG_LEVEL="error,warn"                # error,warn,info,query

# Environnement
NODE_ENV="development"                       # development, production, test
NUXT_ENV="local"                            # local, staging, release, production
```

#### Génération de clés

**VAPID keys** (push notifications) :

```bash
npx web-push generate-vapid-keys
```

**Session password** :

```bash
openssl rand -base64 32
```

### 📦 Installation et setup

#### Installation standard

```bash
# 1. Cloner le repo
git clone <URL_DU_DEPOT>
cd convention-de-jonglerie

# 2. Installer dépendances
npm install

# 3. Configurer environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Setup base de données
# Démarrer MySQL (via Docker ou local)
docker compose -f docker-compose.dev.yml up -d db

# Appliquer migrations
npx prisma migrate deploy

# Générer client Prisma
npx prisma generate

# (Optionnel) Seed données de dev
npm run db:seed:dev

# 5. Lancer serveur de développement
npm run dev
```

#### Installation avec Docker

```bash
# Dev avec hot reload
npm run docker:dev

# Voir les logs
npm run docker:dev:logs

# Arrêter
npm run docker:dev:down

# Production
npm run docker:release:up
```

### 🏗️ Scripts disponibles

#### Développement

| Script             | Description                               |
| ------------------ | ----------------------------------------- |
| `npm run dev`      | Serveur de développement Nuxt (port 3000) |
| `npm run build`    | Build production                          |
| `npm run preview`  | Prévisualiser build production            |
| `npm run lint`     | Linter ESLint                             |
| `npm run lint:fix` | Linter + auto-fix                         |
| `npm run format`   | Prettier formatting                       |

#### Base de données

| Script                     | Description                           |
| -------------------------- | ------------------------------------- |
| `npm run db:seed:dev`      | Peupler DB avec données de dev        |
| `npm run db:seed:password` | Lister comptes seed                   |
| `npm run db:reset:dev`     | Reset DB (⚠️ perte données)           |
| `npm run db:clean-tokens`  | Nettoyer tokens expirés               |
| `npm run db:assign-meals`  | Assigner repas aux bénévoles acceptés |

#### Admin

| Script                 | Description          |
| ---------------------- | -------------------- |
| `npm run admin:add`    | Ajouter admin global |
| `npm run admin:remove` | Retirer admin global |
| `npm run admin:list`   | Lister admins        |

#### Tests

| Script                  | Description                |
| ----------------------- | -------------------------- |
| `npm test`              | Tous les tests             |
| `npm run test:unit`     | Tests unitaires (watch)    |
| `npm run test:unit:run` | Tests unitaires (run once) |
| `npm run test:nuxt`     | Tests Nuxt (watch)         |
| `npm run test:nuxt:run` | Tests Nuxt (run once)      |
| `npm run test:e2e`      | Tests e2e                  |
| `npm run test:all`      | Tous les tests (CI)        |
| `npm run test:ui`       | Interface UI Vitest        |

#### Docker

| Script                            | Description                   |
| --------------------------------- | ----------------------------- |
| `npm run docker:dev`              | Dev avec hot reload           |
| `npm run docker:dev:detached`     | Dev en arrière-plan           |
| `npm run docker:dev:down`         | Arrêter dev                   |
| `npm run docker:dev:logs`         | Voir logs app                 |
| `npm run docker:dev:exec`         | Shell dans conteneur          |
| `npm run docker:release:up`       | Production staging            |
| `npm run docker:test:unit`        | Tests unitaires dans Docker   |
| `npm run docker:test:integration` | Tests intégration dans Docker |

#### Traductions

| Script                       | Description                                       |
| ---------------------------- | ------------------------------------------------- |
| `npm run check-i18n`         | Analyser clés i18n (manquantes, dupliquées, etc.) |
| `npm run check-translations` | Comparer traductions entre langues                |
| `npm run i18n:add`           | Ajouter nouvelle clé de traduction                |
| `npm run i18n:mark-todo`     | Marquer clés modifiées comme [TODO]               |

#### Utilitaires

| Script                 | Description                |
| ---------------------- | -------------------------- |
| `npm run geocode`      | Géocoder adresses éditions |
| `npm run favicons`     | Générer favicons           |
| `npm run help`         | Afficher aide              |
| `npm run kill-servers` | Tuer serveurs orphelins    |

### 🐳 Configuration Docker

#### docker-compose.dev.yml (Développement)

```yaml
services:
  db:
    image: mysql:latest
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    ports:
      - '3306:3306'
    volumes:
      - mysql_data:/var/lib/mysql

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - '3000:3000'
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.nuxt
    environment:
      DATABASE_URL: mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@db:3306/${MYSQL_DATABASE}
    depends_on:
      - db
```

**Features** :

- Hot reload avec volumes montés
- MySQL dans conteneur séparé
- Port 3000 exposé
- Variables d'environnement injectées

#### Dockerfile.dev

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy app
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

#### Dockerfile (Production)

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/.output ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
```

### 🚀 Workflow de déploiement

#### Environnements

1. **Local** (`NODE_ENV=development`)
   - `npm run dev`
   - Hot reload
   - Sourcemaps activés
   - DevTools activés

2. **Staging** (`NUXT_ENV=staging`)
   - `npm run docker:release:up`
   - Build production
   - Base de données de test
   - Robots.txt désactivé

3. **Production** (`NODE_ENV=production`)
   - Docker compose avec reverse proxy
   - SSL/TLS
   - Monitoring
   - Backups automatiques

#### CI/CD GitHub Actions

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit:run
      - run: npm run build
```

---

## 8. Stack technique complète

### 🎯 Frontend Stack

#### Core Framework

| Technologie    | Version | Rôle                         |
| -------------- | ------- | ---------------------------- |
| **Vue.js**     | 3.5.17  | Framework JavaScript réactif |
| **Nuxt.js**    | 4.2.0   | Meta-framework Vue avec SSR  |
| **TypeScript** | 5.8.3   | Langage typé                 |

#### UI & Design

| Technologie      | Version     | Rôle                                                |
| ---------------- | ----------- | --------------------------------------------------- |
| **Nuxt UI**      | 4.0.0       | Bibliothèque de composants (Tailwind + Headless UI) |
| **Tailwind CSS** | via Nuxt UI | Framework CSS utility-first                         |
| **Nuxt Icon**    | -           | Icônes (Iconify)                                    |
| **Flag Icons**   | 7.5.0       | Drapeaux pays                                       |

#### State Management

| Technologie | Version | Rôle                                         |
| ----------- | ------- | -------------------------------------------- |
| **Pinia**   | 3.0.3   | Store Vuex-like pour Vue 3                   |
| **VueUse**  | 13.6.0  | Collection d'utilitaires Vue Composition API |

#### Internationalisation

| Technologie      | Version | Rôle                      |
| ---------------- | ------- | ------------------------- |
| **@nuxtjs/i18n** | 10.0.3  | i18n pour Nuxt (vue-i18n) |
| **@intlify/h3**  | -       | i18n côté serveur         |

#### Calendrier & Dates

| Technologie                 | Version | Rôle                                                |
| --------------------------- | ------- | --------------------------------------------------- |
| **FullCalendar**            | 6.1.15+ | Calendrier interactif (daygrid, timeline, resource) |
| **Luxon**                   | 3.5.0   | Manipulation de dates (alternative à moment.js)     |
| **@internationalized/date** | 3.8.2   | Dates internationalisées                            |

#### Visualisation & UI

| Technologie         | Version        | Rôle                         |
| ------------------- | -------------- | ---------------------------- |
| **Chart.js**        | 4.5.1          | Graphiques et visualisations |
| **vue-chartjs**     | 5.3.3          | Wrapper Vue pour Chart.js    |
| **Leaflet**         | via composable | Cartes interactives          |
| **html2canvas**     | 1.4.1          | Capture d'écran HTML         |
| **jsPDF**           | 3.0.3          | Génération PDF               |
| **jspdf-autotable** | 5.0.2          | Tables PDF                   |

#### QR Code & Scanning

| Technologie      | Version | Rôle                |
| ---------------- | ------- | ------------------- |
| **nuxt-qrcode**  | 0.4.8   | Génération QR codes |
| **html5-qrcode** | 2.3.8   | Scanner QR codes    |

#### Tables & Data

| Technologie               | Version | Rôle                   |
| ------------------------- | ------- | ---------------------- |
| **@tanstack/vue-table**   | -       | Tables avancées        |
| **@tanstack/vue-virtual** | -       | Virtualisation listes  |
| **Vaul Vue**              | -       | Drawer/Sheet composant |
| **Embla Carousel**        | -       | Carousel accessible    |

#### Markdown

| Technologie          | Version | Rôle                        |
| -------------------- | ------- | --------------------------- |
| **unified**          | 11.0.4  | Écosystème traitement texte |
| **remark-parse**     | 11.0.0  | Parser Markdown             |
| **remark-gfm**       | 4.0.0   | GitHub Flavored Markdown    |
| **remark-rehype**    | 11.1.0  | Markdown → HTML             |
| **rehype-sanitize**  | 6.0.0   | Sanitization HTML           |
| **rehype-stringify** | 10.0.0  | Stringify HTML              |

### ⚙️ Backend Stack

#### Core Server

| Technologie | Version   | Rôle                       |
| ----------- | --------- | -------------------------- |
| **Nitro**   | via Nuxt  | Moteur serveur universel   |
| **h3**      | via Nitro | Framework HTTP minimaliste |
| **Node.js** | >=22 <23  | Runtime JavaScript         |

#### Database & ORM

| Technologie        | Version | Rôle                          |
| ------------------ | ------- | ----------------------------- |
| **Prisma**         | 6.18.0  | ORM type-safe                 |
| **@prisma/client** | 6.18.0  | Client Prisma généré          |
| **@prisma/nuxt**   | 0.3.0   | Module Nuxt pour Prisma       |
| **MySQL**          | Latest  | Base de données relationnelle |

#### Authentication & Security

| Technologie         | Version | Rôle                                          |
| ------------------- | ------- | --------------------------------------------- |
| **nuxt-auth-utils** | 0.5.23  | Auth par sessions scellées (remplacement JWT) |
| **bcryptjs**        | 3.0.2   | Hachage mots de passe                         |
| **@adonisjs/hash**  | -       | Alternative hashing (scrypt, argon2)          |
| **Zod**             | 4.1.9   | Validation schémas TypeScript-first           |

#### Email

| Technologie               | Version | Rôle                       |
| ------------------------- | ------- | -------------------------- |
| **nodemailer**            | 7.0.5   | Envoi d'emails             |
| **@vue-email/components** | 0.0.21  | Composants Vue pour emails |
| **@vue-email/render**     | 0.0.9   | Rendu emails Vue en HTML   |

#### AI Integration

| Technologie           | Version | Rôle                                                |
| --------------------- | ------- | --------------------------------------------------- |
| **@anthropic-ai/sdk** | 0.67.0  | Intégration Claude API (traduction, analyse images) |

#### Push Notifications

| Technologie  | Version | Rôle                       |
| ------------ | ------- | -------------------------- |
| **web-push** | 3.6.7   | Push notifications serveur |

#### Scheduling

| Technologie   | Version | Rôle                          |
| ------------- | ------- | ----------------------------- |
| **node-cron** | 3.0.3   | Tâches planifiées (cron jobs) |

#### File Storage

| Technologie           | Version | Rôle                                 |
| --------------------- | ------- | ------------------------------------ |
| **nuxt-file-storage** | 0.3.0   | Gestion uploads fichiers             |
| **sharp**             | 0.33.5  | Traitement images (resize, compress) |

#### Utilities

| Technologie | Version | Rôle                |
| ----------- | ------- | ------------------- |
| **md5**     | 2.3.0   | Hash MD5 (Gravatar) |

### 🧪 Testing Stack

| Technologie              | Version | Rôle                            |
| ------------------------ | ------- | ------------------------------- |
| **Vitest**               | 3.2.4   | Test runner (compatible Vite)   |
| **@nuxt/test-utils**     | 3.19.2  | Utilitaires tests Nuxt          |
| **@vitest/ui**           | 3.2.4   | Interface web Vitest            |
| **@testing-library/vue** | 8.1.0   | Tests composants Vue            |
| **@vue/test-utils**      | 2.4.6   | Utilitaires tests Vue officiels |
| **happy-dom**            | 18.0.1  | DOM virtuel léger (tests unit)  |

### 🛠️ Build Tools & Dev

| Technologie             | Version  | Rôle                             |
| ----------------------- | -------- | -------------------------------- |
| **Vite**                | via Nuxt | Bundler rapide                   |
| **@vitejs/plugin-vue**  | 6.0.1    | Plugin Vue pour Vite             |
| **vite-tsconfig-paths** | 5.1.4    | Support tsconfig paths dans Vite |
| **Rollup**              | via Vite | Bundler production               |
| **tsx**                 | 4.19.1   | Exécuter TypeScript directement  |

### 🎨 Code Quality

| Technologie      | Version | Rôle                         |
| ---------------- | ------- | ---------------------------- |
| **ESLint**       | 9.32.0  | Linter JavaScript/TypeScript |
| **@nuxt/eslint** | 1.7.1   | Config ESLint pour Nuxt      |
| **Prettier**     | 3.3.3   | Formatage de code            |

### 🌐 SEO & Meta

| Technologie            | Version | Rôle                                  |
| ---------------------- | ------- | ------------------------------------- |
| **@nuxtjs/seo**        | 3.2.2   | Suite SEO (sitemap, robots, og-image) |
| **@unhead/vue**        | 2.0.12  | Gestion <head>                        |
| **@unhead/schema-org** | -       | Schema.org structuré                  |
| **@nuxt/scripts**      | 0.11.10 | Scripts tiers optimisés               |

### 🖼️ Image Optimization

| Technologie     | Version | Rôle                                    |
| --------------- | ------- | --------------------------------------- |
| **@nuxt/image** | 1.10.0  | Optimisation images (lazy load, resize) |
| **sharp**       | 0.33.5  | Traitement images serveur               |

### 🐳 DevOps & Infrastructure

| Technologie        | Version | Rôle                     |
| ------------------ | ------- | ------------------------ |
| **Docker**         | Latest  | Containerisation         |
| **docker-compose** | Latest  | Orchestration conteneurs |
| **GitHub Actions** | -       | CI/CD                    |

### 📦 Dépendances totales

- **Production** : 59 dépendances
- **Development** : 24 devDependencies
- **Total** : 83 packages
- **node_modules** : ~2000 packages (avec transitive deps)

---

## 9. Diagrammes d'architecture

### 🏗️ Architecture système complète

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER                                    │
│                                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │   Pages    │  │ Components │  │   Stores   │  │ Composables│          │
│  │  (Routes)  │  │   (Vue 3)  │  │  (Pinia)   │  │ (Hooks)    │          │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘          │
│        │                │                │                │                 │
│        └────────────────┴────────────────┴────────────────┘                 │
│                                  │                                          │
│                         ┌────────▼────────┐                                │
│                         │  Nuxt UI Theme  │                                │
│                         │  Tailwind CSS   │                                │
│                         └─────────────────┘                                │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  │ HTTP/HTTPS (REST API)
                                  │ SSE (Notifications)
                                  │ WebSocket (Future)
                                  │
┌─────────────────────────────────▼───────────────────────────────────────────┐
│                         NUXT 4 APPLICATION LAYER                            │
│                                                                             │
│  ┌──────────────────────┐      ┌──────────────────────┐                   │
│  │   SSR Rendering      │      │   Client Hydration   │                   │
│  │  - Pre-render pages  │      │  - Interactive Vue   │                   │
│  │  - SEO optimization  │      │  - Client-side nav   │                   │
│  └──────────────────────┘      └──────────────────────┘                   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐       │
│  │                     MIDDLEWARE LAYER                           │       │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │       │
│  │  │ auth.global  │  │ edition-org  │  │   admin      │        │       │
│  │  │  (Session)   │  │ (Permissions)│  │  (GlobalAdmin)│        │       │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │       │
│  └────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐       │
│  │                      NITRO SERVER (h3)                         │       │
│  │                                                                 │       │
│  │  ┌──────────────────────────────────────────────────────────┐ │       │
│  │  │              API ROUTES (/api/*)                         │ │       │
│  │  │                                                           │ │       │
│  │  │  /auth/*           - Authentication & sessions           │ │       │
│  │  │  /conventions/*    - Conventions CRUD                    │ │       │
│  │  │  /editions/*       - Editions + nested resources         │ │       │
│  │  │    ├─ /volunteers/*    - Bénévoles (applications, teams)│ │       │
│  │  │    ├─ /ticketing/*     - Billetterie (tiers, orders)    │ │       │
│  │  │    ├─ /carpool-*       - Covoiturage                    │ │       │
│  │  │    ├─ /artists/*       - Artistes                       │ │       │
│  │  │    ├─ /shows/*         - Spectacles                     │ │       │
│  │  │    ├─ /workshops/*     - Ateliers                       │ │       │
│  │  │    ├─ /meals/*         - Repas                          │ │       │
│  │  │    └─ /lost-found/*    - Objets perdus                  │ │       │
│  │  │  /notifications/*  - Notifications + SSE stream          │ │       │
│  │  │  /profile/*        - Profil utilisateur                  │ │       │
│  │  │  /admin/*          - Administration globale              │ │       │
│  │  │                                                           │ │       │
│  │  └───────────────────────────┬───────────────────────────────┘ │       │
│  │                              │                                  │       │
│  │                    ┌─────────▼─────────┐                       │       │
│  │                    │  wrapApiHandler() │                       │       │
│  │                    │  - Validation     │                       │       │
│  │                    │  - Permissions    │                       │       │
│  │                    │  - Error handling │                       │       │
│  │                    └───────────────────┘                       │       │
│  └────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                         SERVER UTILITIES LAYER                              │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Permissions  │  │  Validation  │  │  API Helpers │  │ Rate Limiter │  │
│  │   System     │  │   (Zod)      │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Email Service│  │  Notification│  │Push Notif    │  │ Error Logger │  │
│  │ (nodemailer) │  │   Service    │  │ (web-push)   │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Geocoding   │  │  Anthropic   │  │   Cron Jobs  │  │  SSE Manager │  │
│  │ (Nominatim)  │  │   (Claude)   │  │ (node-cron)  │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    Business Logic Modules                            │ │
│  │  - editions/volunteers/  (applications, teams, planning)             │ │
│  │  - editions/ticketing/   (helloasso, tiers, options, returnable)     │ │
│  │  - permissions/          (convention, edition, volunteer, access)    │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                           PRISMA ORM LAYER                                  │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐       │
│  │  Prisma Client (Type-safe queries)                             │       │
│  │  - Auto-generated types from schema                            │       │
│  │  - Relations handling                                          │       │
│  │  - Query optimization                                          │       │
│  └────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  Schema: 50+ models                                                        │
│  - User, Convention, Edition                                               │
│  - ConventionOrganizer (permissions)                                       │
│  - EditionVolunteerApplication, VolunteerTeam, VolunteerTimeSlot          │
│  - TicketingTier, TicketingOrder, TicketingOption                         │
│  - EditionArtist, Show, Workshop                                           │
│  - CarpoolOffer, CarpoolRequest                                            │
│  - LostFoundItem, Notification, PushSubscription                           │
│  - ApiErrorLog, Feedback                                                   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                          MYSQL DATABASE                                     │
│                                                                             │
│  - Relational data model                                                   │
│  - Indexes optimisés (id, conventionId, userId, etc.)                      │
│  - Foreign keys avec ON DELETE CASCADE                                     │
│  - ~60 migrations appliquées                                               │
│                                                                             │
│  Stratégie de backup :                                                     │
│  - mysqldump automatique quotidien                                         │
│  - Rétention 7 jours                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

                        EXTERNAL SERVICES

┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  HelloAsso   │  │  Anthropic   │  │  Nominatim   │  │   Gmail      │
│  (Payments)  │  │   Claude AI  │  │  (Geocoding) │  │   SMTP       │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### 🔐 Diagramme de flux d'authentification

```
┌────────┐                                                      ┌────────┐
│ Client │                                                      │ Server │
└───┬────┘                                                      └───┬────┘
    │                                                               │
    │  1. POST /api/auth/register                                  │
    │  { email, pseudo, password }                                 │
    ├─────────────────────────────────────────────────────────────>│
    │                                                               │
    │                                      2. Validate inputs (Zod)│
    │                                      3. Check email exists    │
    │                                      4. Hash password (bcrypt)│
    │                                      5. Create user (Prisma)  │
    │                                      6. Generate 6-digit code │
    │                                      7. Send email (nodemailer│
    │                                                               │
    │  { user, message: "Verification email sent" }                │
    │<─────────────────────────────────────────────────────────────┤
    │                                                               │
    │  8. User receives email with code                            │
    │                                                               │
    │  9. POST /api/auth/verify-email                              │
    │  { email, code }                                             │
    ├─────────────────────────────────────────────────────────────>│
    │                                                               │
    │                                      10. Validate code        │
    │                                      11. Mark email verified  │
    │                                      12. setUserSession()     │
    │                                                               │
    │  { user } + Set-Cookie: nuxt-session (sealed)                │
    │<─────────────────────────────────────────────────────────────┤
    │                                                               │
    │  13. Redirect to /profile                                    │
    │                                                               │
    │  14. Subsequent requests include session cookie              │
    │  GET /api/profile/stats                                      │
    │  Cookie: nuxt-session=...                                    │
    ├─────────────────────────────────────────────────────────────>│
    │                                                               │
    │                                      15. getUserSession()     │
    │                                      16. Validate session     │
    │                                      17. Fetch user data      │
    │                                                               │
    │  { stats: {...} }                                            │
    │<─────────────────────────────────────────────────────────────┤
    │                                                               │
    │  18. POST /api/auth/logout                                   │
    ├─────────────────────────────────────────────────────────────>│
    │                                                               │
    │                                      19. clearUserSession()   │
    │                                                               │
    │  { success: true } + Clear cookie                            │
    │<─────────────────────────────────────────────────────────────┤
    │                                                               │
```

### 🎫 Diagramme de flux billetterie

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TICKETING SYSTEM FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

1. CONFIGURATION (Organisateurs)

   Organisateur                                                        Database
       │                                                                   │
       │  Create Tiers (tarifs)                                           │
       ├─────────────────────────────────────────────────────────────────>│
       │  POST /api/editions/:id/ticketing/tiers                          │
       │  { name, price, description, maxQuantity }                       │
       │                                                                   │
       │  Create Options (suppléments)                                    │
       ├─────────────────────────────────────────────────────────────────>│
       │  POST /api/editions/:id/ticketing/options                        │
       │  { name, price, type, mandatory }                                │
       │                                                                   │
       │  Create Returnable Items (consignes)                             │
       ├─────────────────────────────────────────────────────────────────>│
       │  POST /api/editions/:id/ticketing/returnable-items               │
       │  { name, depositAmount, stock }                                  │
       │                                                                   │
       │  Configure External Ticketing (HelloAsso)                        │
       ├─────────────────────────────────────────────────────────────────>│
       │  PUT /api/editions/:id/ticketing/external                        │
       │  { provider: 'HELLOASSO', externalUrl, formSlug, syncEnabled }   │

2. PURCHASE EXTERNAL (HelloAsso)

   Client                  HelloAsso                 Webhook                 DB
     │                         │                         │                    │
     │  Purchase ticket        │                         │                    │
     ├────────────────────────>│                         │                    │
     │                         │                         │                    │
     │                         │  Webhook notification   │                    │
     │                         ├────────────────────────>│                    │
     │                         │  { order, payer, items }│                    │
     │                         │                         │                    │
     │                         │                         │  Create Order      │
     │                         │                         ├───────────────────>│
     │                         │                         │  TicketingOrder    │
     │                         │                         │  + OrderItems      │

3. ACCESS CONTROL (Comptoir d'entrée)

   Staff                                                           Participant
     │                                                                  │
     │  Open counter interface                                         │
     │  /editions/:id/gestion/ticketing/counter/:counterId             │
     │  (or via token: /editions/:id/ticketing/counters/token/:token)  │
     │                                                                  │
     │  <────────────────────────────────────────────────────────────  │
     │                         Participant shows QR code or email      │
     │                                                                  │
     │  Scan QR / Search email                                         │
     │                                                                  │
     │  POST /api/editions/:id/ticketing/counters/:counterId/validate  │
     │  { userEmail or qrCode }                                        │
     ├─────────────────────────────────────────────────────────────────>
     │                                                                  │
     │                              Validate order                     │
     │                              Check not already validated        │
     │                              Mark as validated                  │
     │                              Update returnable items status     │
     │                                                                  │
     │  <success + participant info + bracelet info>                   │
     │<─────────────────────────────────────────────────────────────────
     │                                                                  │
     │  Print bracelet or give physical ticket                         │
     │  ──────────────────────────────────────────────────────────────>│
     │                                                                  │

4. REAL-TIME STATS (SSE)

   Counter Interface                                          Server
         │                                                       │
         │  Open SSE connection                                 │
         │  GET /api/editions/:id/ticketing/counters/:counterId/stream
         ├──────────────────────────────────────────────────────>│
         │                                                       │
         │                         Every 1 second:               │
         │  <event: stats>                                       │
         │  { validated: 150, pending: 50, total: 200 }         │
         │<──────────────────────────────────────────────────────┤
         │                                                       │
         │  Update UI with real-time stats                      │
         │                                                       │

5. RETURNABLE ITEMS RETURN

   Participant               Staff                              Database
       │                       │                                    │
       │  Return item          │                                    │
       │  (bracelet, cup, etc) │                                    │
       ├──────────────────────>│                                    │
       │                       │                                    │
       │                       │  Verify item assigned              │
       │                       │  Mark as returned                  │
       │                       │  Update deposit status             │
       │                       ├───────────────────────────────────>│
       │                       │                                    │
       │  <── Deposit refunded │                                    │
       │<──────────────────────┤                                    │
```

### 👥 Diagramme de gestion des bénévoles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VOLUNTEER MANAGEMENT SYSTEM                            │
└─────────────────────────────────────────────────────────────────────────────┘

1. CONFIGURATION (Organisateurs)

   Organisateur                                                        Database
       │                                                                   │
       │  Enable volunteers                                               │
       │  PUT /api/editions/:id                                           │
       │  { volunteersOpen: true, volunteersMode: 'INTERNAL' }            │
       ├─────────────────────────────────────────────────────────────────>│
       │                                                                   │
       │  Create Teams                                                    │
       │  POST /api/editions/:id/volunteer-teams                          │
       │  { name, description, requiredCount }                            │
       ├─────────────────────────────────────────────────────────────────>│
       │                                                                   │
       │  Create Time Slots (planning)                                    │
       │  POST /api/editions/:id/volunteer-time-slots                     │
       │  { name, startTime, endTime, teamId, requiredVolunteers }        │
       ├─────────────────────────────────────────────────────────────────>│

2. APPLICATION (Bénévole)

   Volunteer                                                           Database
       │                                                                   │
       │  View volunteers page                                            │
       │  GET /editions/:id/volunteers                                    │
       │                                                                   │
       │  Fill application form                                           │
       │  POST /api/editions/:id/volunteers/applications                  │
       │  {                                                                │
       │    motivation, availability,                                     │
       │    dietaryRestrictions, allergies,                               │
       │    teamPreferences, skills, ...                                  │
       │  }                                                                │
       ├─────────────────────────────────────────────────────────────────>│
       │                                                                   │
       │                                         Create application        │
       │                                         Send confirmation email   │
       │                                         Notify organisateurs      │
       │                                                                   │
       │  <── Application submitted successfully                          │
       │<─────────────────────────────────────────────────────────────────┤

3. REVIEW (Organisateurs)

   Organisateur                                                        Database
       │                                                                   │
       │  View applications                                               │
       │  GET /api/editions/:id/volunteers/applications                   │
       │<─────────────────────────────────────────────────────────────────┤
       │                                                                   │
       │  Review application details                                      │
       │  GET /api/editions/:id/volunteers/applications/:applicationId    │
       │                                                                   │
       │  Accept application                                              │
       │  POST /api/.../applications/:applicationId/accept                │
       ├─────────────────────────────────────────────────────────────────>│
       │                                                                   │
       │                                         Update status: ACCEPTED   │
       │                                         Send acceptance email     │
       │                                         Create notification       │

4. TEAM ASSIGNMENT

   Organisateur                                                        Database
       │                                                                   │
       │  Assign to team(s)                                               │
       │  POST /api/editions/:id/volunteers/applications/                 │
       │       :applicationId/teams/:teamId                               │
       ├─────────────────────────────────────────────────────────────────>│
       │                                                                   │
       │                                         Create team assignment   │
       │                                         Update application        │

5. PLANNING (Time Slots Assignment)

   Organisateur                                                        Database
       │                                                                   │
       │  View planning                                                   │
       │  GET /editions/:id/gestion/volunteers/planning                   │
       │                                                                   │
       │  Drag & drop volunteer to time slot                              │
       │  POST /api/editions/:id/volunteer-time-slots/                    │
       │       :slotId/assignments                                        │
       │  { volunteerId, teamId }                                         │
       ├─────────────────────────────────────────────────────────────────>│
       │                                                                   │
       │                                         Create assignment         │
       │                                         Check availability        │
       │                                         Check conflicts           │

6. NOTIFICATIONS (Group Notifications)

   Organisateur                                                   Volunteers
       │                                                               │
       │  Create notification group                                   │
       │  POST /api/editions/:id/volunteers/notification              │
       │  {                                                            │
       │    title, message, confirmationRequired,                     │
       │    filters: { teams, status }                                │
       │  }                                                            │
       ├──────────────────────────────────────────────────────────────│
       │                                                               │
       │                              Send emails to filtered volunteers
       │                              With confirmation link           │
       │                              ──────────────────────────────────>
       │                                                               │
       │                                                               │
       │                              Volunteer clicks link            │
       │                              GET /editions/:id/volunteers/    │
       │                                  notification/:groupId/confirm│
       │                              <──────────────────────────────  │
       │                                                               │
       │                              Record confirmation              │

7. MEAL ASSIGNMENT (Auto)

   Organisateur                                                        System
       │                                                                   │
       │  Auto-assign meals to accepted volunteers                        │
       │  POST /api/admin/assign-meals-volunteers                         │
       ├─────────────────────────────────────────────────────────────────>│
       │                                                                   │
       │                                  Find all accepted volunteers    │
       │                                  with meal needs                 │
       │                                  Create meal assignments         │
       │                                  Update volunteer records        │

8. MEAL VALIDATION (On-site)

   Validator                  Volunteer                              Database
       │                         │                                       │
       │  Open validation page   │                                       │
       │  /editions/:id/gestion/meals/validate                           │
       │                         │                                       │
       │  <────────────────────  │                                       │
       │  Volunteer shows QR     │                                       │
       │                         │                                       │
       │  Scan QR or search      │                                       │
       │  POST /api/editions/:id/meals/:mealId/validate                  │
       │  { volunteerId }        │                                       │
       ├────────────────────────────────────────────────────────────────>│
       │                         │                                       │
       │                         │                Mark meal consumed     │
       │                         │                Update timestamp       │
       │                         │                                       │
       │  <success>              │                                       │
       │<────────────────────────────────────────────────────────────────┤
       │                         │                                       │
       │  Meal served            │                                       │
       │  ────────────────────────>                                      │
```

### 🔔 Diagramme du système de notifications

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       NOTIFICATION SYSTEM ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────────────┘

                        NOTIFICATION TYPES

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ In-App           │  │ Email            │  │ Push (Browser)   │
│ Notifications    │  │ Notifications    │  │ Notifications    │
│                  │  │                  │  │                  │
│ - Real-time SSE  │  │ - nodemailer     │  │ - web-push       │
│ - Persistent     │  │ - Vue templates  │  │ - Service Worker │
│ - Click actions  │  │ - HTML emails    │  │ - VAPID keys     │
└──────────────────┘  └──────────────────┘  └──────────────────┘

                    NOTIFICATION FLOW

Event Occurs                    Notification Service              Recipients
    │                                   │                              │
    │  1. Trigger event                 │                              │
    │  (ex: application accepted)       │                              │
    ├──────────────────────────────────>│                              │
    │                                   │                              │
    │                                   │  2. Create notification      │
    │                                   │  in database                 │
    │                                   │  (Prisma)                    │
    │                                   │                              │
    │                                   │  3. Check user preferences   │
    │                                   │  (email enabled? push?)      │
    │                                   │                              │
    │                                   │  4. Send in-app notification │
    │                                   │  (SSE push to active streams)│
    │                                   ├─────────────────────────────>│
    │                                   │                              │
    │                                   │  5. Send email (if enabled)  │
    │                                   │  emailService.sendNotification()
    │                                   ├─────────────────────────────>│
    │                                   │                              │
    │                                   │  6. Send push notif (if subscribed)
    │                                   │  sendPushNotification()      │
    │                                   ├─────────────────────────────>│
    │                                   │                              │
    │                                   │  7. Log notification         │
    │                                   │  (ApiErrorLog si erreur)     │

                    SSE STREAM ARCHITECTURE

Client (Browser)               SSE Manager                      Database
    │                              │                                │
    │  Open EventSource            │                                │
    │  /api/notifications/stream   │                                │
    ├─────────────────────────────>│                                │
    │                              │                                │
    │                              │  Register connection           │
    │                              │  Store in Map<userId, Set<H3Event>>
    │                              │                                │
    │  Heartbeat every 30s         │                                │
    │<─────────────────────────────┤                                │
    │  :keepalive                  │                                │
    │                              │                                │
    │  New notification created    │                                │
    │                              │<───────────────────────────────┤
    │                              │                                │
    │                              │  Push to SSE stream            │
    │                              │  event.node.res.write()        │
    │                              │                                │
    │  data: { notification }      │                                │
    │<─────────────────────────────┤                                │
    │                              │                                │
    │  Display notification        │                                │
    │  in UI (toast + list update) │                                │
    │                              │                                │
    │  Close connection            │                                │
    ├─────────────────────────────>│                                │
    │                              │  Remove from Map               │

                PUSH NOTIFICATION FLOW

User                Service Worker           Server (web-push)        Browser
 │                       │                         │                      │
 │  Enable push          │                         │                      │
 ├──────────────────────>│                         │                      │
 │                       │                         │                      │
 │                       │  Subscribe               │                      │
 │                       ├────────────────────────>│                      │
 │                       │                         │                      │
 │                       │  PushSubscription obj   │                      │
 │                       │<────────────────────────┤                      │
 │                       │                         │                      │
 │  Send subscription    │                         │                      │
 │  to server            │                         │                      │
 ├───────────────────────────────────────────────>│                      │
 │  POST /api/notifications/push/subscribe         │                      │
 │  { endpoint, keys }   │                         │                      │
 │                       │                         │                      │
 │                       │                         │  Store in DB         │
 │                       │                         │  (PushSubscription)  │
 │                       │                         │                      │
 │  ...later: event occurs that triggers notification                     │
 │                       │                         │                      │
 │                       │                         │  Send push           │
 │                       │                         │  web-push.sendNotification()
 │                       │                         │  (VAPID signature)   │
 │                       │                         ├─────────────────────>│
 │                       │                         │                      │
 │                       │  push event             │                      │
 │                       │<───────────────────────────────────────────────┤
 │                       │                         │                      │
 │                       │  Show notification      │                      │
 │                       │  self.registration      │                      │
 │                       │   .showNotification()   │                      │
 │                       │                         │                      │
 │  Notification visible │                         │                      │
 │<──────────────────────┤                         │                      │
```

---

## 10. Insights et recommandations

### ✅ Points forts du projet

#### 1. Architecture moderne et scalable

**Observations** :

- Stack technique à jour (Nuxt 4, Vue 3, Prisma 6)
- Architecture en couches claire
- Séparation frontend/backend bien définie
- SSR pour performances et SEO

**Impact positif** :

- Maintenabilité élevée
- Performance optimale
- SEO-friendly
- Developer experience excellente

#### 2. Système de permissions granulaires robuste

**Observations** :

- Permissions à plusieurs niveaux (convention, édition, module)
- Système `perEdition` pour droits ciblés
- Vérification systématique via `wrapApiHandler()`
- Documentation détaillée (docs/system/ORGANIZER_PERMISSIONS.md)

**Impact positif** :

- Sécurité renforcée
- Flexibilité pour organisateurs
- Pas de privilèges excessifs
- Auditabilité

#### 3. Internationalisation complète

**Observations** :

- 13 langues supportées
- Lazy loading par domaine
- Scripts de synchronisation automatique
- Traduction automatique via IA (Anthropic Claude)

**Impact positif** :

- Accessibilité internationale
- Maintenance simplifiée
- Détection automatique clés manquantes
- Performance (lazy loading)

#### 4. Tests complets

**Observations** :

- 4 types de tests (unit, nuxt, integration, e2e)
- Configuration Vitest multi-projets
- Tests d'intégration DB avec Docker
- ~100+ fichiers de test

**Impact positif** :

- Confiance dans le code
- Régression évitée
- Documentation vivante
- Refactoring sécurisé

#### 5. Documentation exceptionnelle

**Observations** :

- 37 fichiers Markdown structurés
- Documentation par système
- Exemples de code
- Guides de migration

**Impact positif** :

- Onboarding rapide
- Maintenabilité
- Décisions architecturales tracées
- Référence technique

#### 6. Temps réel (SSE)

**Observations** :

- Notifications en temps réel
- Stats comptoir billetterie live
- Gestion propre des connexions
- Heartbeat pour maintien connexion

**Impact positif** :

- UX améliorée
- Pas de polling coûteux
- Scalable (SSE > WebSocket pour one-way)

#### 7. Intégrations externes solides

**Observations** :

- HelloAsso (billetterie) avec webhooks
- Anthropic Claude (IA : traduction, analyse images)
- Nominatim (géocodage)
- Support multi-providers IA (Anthropic, Ollama, LM Studio)

**Impact positif** :

- Fonctionnalités avancées
- Automatisation
- Réduction charge organisateurs

### ⚠️ Points d'attention et recommandations

#### 1. 🔴 CRITIQUE : Gestion des erreurs et résilience

**Observations** :

- Système de logging d'erreurs présent (`ApiErrorLog`)
- Pas de retry automatique pour services externes
- Pas de circuit breaker pour intégrations externes
- Erreurs HelloAsso webhook peuvent bloquer sync

**Recommandations** :

```typescript
// Ajouter retry avec backoff exponentiel
import retry from 'async-retry'

async function syncHelloAssoOrders(editionId: number) {
  await retry(
    async (bail) => {
      try {
        const data = await $fetch('https://api.helloasso.com/...')
        return data
      } catch (error) {
        if (error.statusCode === 401) {
          // Erreur permanente, ne pas retry
          bail(error)
        }
        // Erreur temporaire, retry
        throw error
      }
    },
    {
      retries: 3,
      minTimeout: 1000,
      maxTimeout: 5000,
      onRetry: (error, attempt) => {
        console.log(`Retry ${attempt}/3 for HelloAsso sync:`, error.message)
      },
    }
  )
}

// Ajouter circuit breaker
import CircuitBreaker from 'opossum'

const helloAssoBreaker = new CircuitBreaker(syncHelloAssoOrders, {
  timeout: 10000, // 10s
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30s
})

helloAssoBreaker.fallback(() => {
  // Fallback : log error, send admin notification
  return { success: false, fallback: true }
})
```

**Priorité** : 🔴 Haute (peut causer perte de données)

#### 2. 🟡 Performance : N+1 queries

**Observations** :

- Certains endpoints chargent relations sans select optimisé
- Exemple : liste candidatures bénévoles charge tous les champs

**Recommandations** :

```typescript
// ❌ Avant : charge tout
const applications = await prisma.editionVolunteerApplication.findMany({
  where: { editionId },
  include: {
    user: true,
    teams: { include: { team: true } },
  },
})

// ✅ Après : select ciblé
const applications = await prisma.editionVolunteerApplication.findMany({
  where: { editionId },
  select: {
    id: true,
    status: true,
    motivation: true,
    createdAt: true,
    user: {
      select: {
        id: true,
        pseudo: true,
        emailHash: true,
        profilePicture: true,
      },
    },
    teams: {
      select: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
  },
})
```

**Utiliser `prisma-selects.ts`** existant pour standardiser.

**Priorité** : 🟡 Moyenne (impact performance)

#### 3. 🟢 Sécurité : Rate limiting

**Observations** :

- Rate limiter présent (`server/utils/rate-limiter.ts`)
- Pas appliqué systématiquement sur tous les endpoints publics
- Endpoints de recherche non protégés

**Recommandations** :

```typescript
// Ajouter rate limiting sur recherche publique
export default defineEventHandler(async (event) => {
  // Rate limit : 100 req/hour per IP
  await checkRateLimit(event, {
    key: getRequestIP(event),
    limit: 100,
    window: 3600,
  })

  // ... handler
})

// Endpoints prioritaires à protéger :
// - /api/users/search
// - /api/editions (liste)
// - /api/conventions (liste)
// - /api/auth/* (login, register)
```

**Priorité** : 🟢 Basse (pas de problème immédiat)

#### 4. 🟡 Scalabilité : SSE Connections

**Observations** :

- SSE stocke connexions en mémoire (`Map<userId, Set<H3Event>>`)
- Ne scale pas horizontalement (multi-instances)
- Pas de persistance des connexions

**Recommandations** :

- Utiliser Redis Pub/Sub pour multi-instances :

```typescript
import { createClient } from 'redis'

const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

// Publisher (notification-service.ts)
async function notifyUser(userId: number, notification: Notification) {
  await redis.publish(`notifications:${userId}`, JSON.stringify(notification))
}

// Subscriber (SSE route)
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const subscriber = redis.duplicate()
  await subscriber.connect()
  await subscriber.subscribe(`notifications:${session.user.id}`)

  subscriber.on('message', (channel, message) => {
    event.node.res.write(`data: ${message}\n\n`)
  })

  // Cleanup
  event.node.req.on('close', () => {
    subscriber.unsubscribe()
    subscriber.quit()
  })
})
```

**Priorité** : 🟡 Moyenne (pour scaling futur)

#### 5. 🟢 Monitoring et observabilité

**Observations** :

- Logs d'erreurs en DB (`ApiErrorLog`)
- Pas de monitoring temps réel
- Pas d'alerting automatique
- Pas de métriques (latence, throughput)

**Recommandations** :

- Intégrer **OpenTelemetry** pour traces et métriques :

```typescript
// server/plugins/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

const sdk = new NodeSDK({
  serviceName: 'convention-de-jonglerie',
  instrumentations: [getNodeAutoInstrumentations()],
})

sdk.start()
```

- Ajouter **Sentry** pour erreurs frontend :

```typescript
// app/plugins/sentry.client.ts
import * as Sentry from '@sentry/vue'

export default defineNuxtPlugin((nuxtApp) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      app: nuxtApp.vueApp,
      dsn: process.env.NUXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NUXT_ENV,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
    })
  }
})
```

**Priorité** : 🟢 Basse (amélioration continue)

#### 6. 🟡 Base de données : Indexes manquants

**Observations** :

- Indexes basiques présents (id, foreignKeys)
- Manque indexes composites pour requêtes fréquentes

**Recommandations** :

```prisma
// prisma/schema.prisma

model EditionVolunteerApplication {
  // ...

  @@index([editionId, status]) // Fréquent : filter par status
  @@index([userId, status])     // User's applications
  @@index([createdAt])          // Sort par date
}

model TicketingOrder {
  // ...

  @@index([editionId, status])        // Fréquent
  @@index([userEmail, editionId])     // Recherche email
  @@index([validatedAt])              // Stats validations
}

model Notification {
  // ...

  @@index([userId, read, createdAt])  // Liste notifications non-lues
  @@index([type, userId])             // Filter par type
}
```

**Analyser avec** :

```bash
# Prisma Studio : voir slow queries
npx prisma studio

# MySQL : EXPLAIN queries lentes
EXPLAIN SELECT * FROM EditionVolunteerApplication
WHERE editionId = 123 AND status = 'ACCEPTED';
```

**Priorité** : 🟡 Moyenne (amélioration perf)

#### 7. 🟢 Tests : Coverage manquant

**Observations** :

- Tests présents mais coverage non mesuré
- Composants UI peu testés
- Pas de tests e2e complets

**Recommandations** :

```json
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  }
})
```

```bash
# Générer coverage
npm run test:unit -- --coverage

# Target : 70% coverage minimum
```

**Priorité** : 🟢 Basse (quality of life)

#### 8. 🔴 Sécurité : Validation côté serveur

**Observations** :

- Zod utilisé pour validation
- Certains endpoints manquent de validation stricte
- Pas de sanitization HTML systématique

**Recommandations** :

```typescript
// Toujours valider côté serveur avec Zod
import { z } from 'zod'

const volunteerApplicationSchema = z.object({
  motivation: z.string().min(50).max(2000),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/),
  dietaryRestrictions: z.string().max(500).optional(),
  allergies: z
    .array(
      z.object({
        name: z.string().max(100),
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      })
    )
    .optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validation
  const validated = volunteerApplicationSchema.parse(body)

  // Sanitization HTML (si besoin)
  if (validated.motivation) {
    validated.motivation = sanitizeHtml(validated.motivation, {
      allowedTags: [], // Strip all HTML
      allowedAttributes: {},
    })
  }

  // ... create application
})
```

**Priorité** : 🔴 Haute (sécurité)

#### 9. 🟡 Performance : Cache HTTP

**Observations** :

- Cache assets statiques activé (Nitro config)
- Pas de cache API pour données publiques

**Recommandations** :

```typescript
// Cache les listes publiques (éditions, conventions)
export default cachedEventHandler(
  async (event) => {
    const editions = await prisma.edition.findMany({
      where: {
        /* ... */
      },
      select: {
        /* optimisé */
      },
    })

    return editions
  },
  {
    maxAge: 60 * 5, // 5 minutes
    getKey: (event) => {
      const query = getQuery(event)
      return `editions:${JSON.stringify(query)}`
    },
    swr: true, // Stale-while-revalidate
  }
)
```

**Priorité** : 🟡 Moyenne (amélioration perf)

#### 10. 🟢 DevOps : Health checks

**Observations** :

- Pas d'endpoint de health check
- Monitoring Docker basique

**Recommandations** :

```typescript
// server/api/health.get.ts
export default defineEventHandler(async (event) => {
  const checks = {
    database: false,
    redis: false,
    timestamp: new Date().toISOString(),
  }

  // Check DB
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch {}

  // Check Redis (si utilisé)
  try {
    await redis.ping()
    checks.redis = true
  } catch {}

  const healthy = checks.database // && checks.redis

  setResponseStatus(event, healthy ? 200 : 503)
  return {
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
  }
})
```

**Utiliser dans Docker Compose** :

```yaml
services:
  app:
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Priorité** : 🟢 Basse (DevOps)

### 📊 Tableau récapitulatif des recommandations

| #   | Recommandation                             | Priorité   | Impact            | Effort |
| --- | ------------------------------------------ | ---------- | ----------------- | ------ |
| 1   | Gestion erreurs + retry + circuit breaker  | 🔴 Haute   | Résilience +++    | Moyen  |
| 2   | Optimiser N+1 queries avec selects         | 🟡 Moyenne | Performance ++    | Faible |
| 3   | Rate limiting sur endpoints publics        | 🟢 Basse   | Sécurité +        | Faible |
| 4   | SSE avec Redis pour multi-instances        | 🟡 Moyenne | Scalabilité +++   | Élevé  |
| 5   | Monitoring (OpenTelemetry + Sentry)        | 🟢 Basse   | Observabilité +++ | Moyen  |
| 6   | Indexes composites base de données         | 🟡 Moyenne | Performance ++    | Faible |
| 7   | Test coverage à 70%                        | 🟢 Basse   | Qualité ++        | Moyen  |
| 8   | Validation Zod + sanitization systématique | 🔴 Haute   | Sécurité +++      | Faible |
| 9   | Cache HTTP pour API publiques              | 🟡 Moyenne | Performance ++    | Faible |
| 10  | Health checks + monitoring Docker          | 🟢 Basse   | DevOps ++         | Faible |

### 🎯 Roadmap suggérée

#### Phase 1 : Sécurité et stabilité (Sprint 1-2)

1. ✅ Validation Zod systématique (#8)
2. ✅ Gestion erreurs + retry (#1)
3. ✅ Rate limiting (#3)

#### Phase 2 : Performance (Sprint 3-4)

4. ✅ Optimiser N+1 queries (#2)
5. ✅ Indexes composites (#6)
6. ✅ Cache HTTP API (#9)

#### Phase 3 : Scalabilité (Sprint 5-6)

7. ✅ Redis Pub/Sub pour SSE (#4)
8. ✅ Health checks (#10)

#### Phase 4 : Observabilité (Sprint 7-8)

9. ✅ Monitoring OpenTelemetry (#5)
10. ✅ Test coverage 70% (#7)

### 🏆 Conclusion

**Le projet "Convention de Jonglerie" est un exemple d'excellence en architecture full-stack moderne.**

#### Points forts majeurs :

- ✅ Architecture propre et scalable
- ✅ Stack technique à jour et performante
- ✅ Système de permissions granulaires robuste
- ✅ Documentation exceptionnelle
- ✅ Tests bien structurés
- ✅ Internationalisation complète

#### Axes d'amélioration :

- 🔧 Résilience des intégrations externes
- 🔧 Performance queries base de données
- 🔧 Monitoring et observabilité
- 🔧 Scalabilité horizontale (SSE avec Redis)

**Évaluation globale : 8.5/10**

Le projet est **production-ready** avec quelques optimisations recommandées pour une utilisation à grande échelle.

---

**Document généré le** : 2025-01-13
**Version du projet** : Nuxt 4.2.0
**Auteur de l'analyse** : Claude (Anthropic)
