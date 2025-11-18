# Convention de Jonglerie - Analyse Complète du Projet

> **Dernière mise à jour** : 17 Novembre 2025
> **Version du projet** : Nuxt 4.2.0
> **Statut** : Production-ready

---

## 📑 Table des Matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Stack technologique détaillée](#2-stack-technologique-détaillée)
3. [Architecture du projet](#3-architecture-du-projet)
4. [Structure des répertoires](#4-structure-des-répertoires)
5. [Analyse fichier par fichier](#5-analyse-fichier-par-fichier)
6. [Endpoints API](#6-endpoints-api)
7. [Architecture approfondie](#7-architecture-approfondie)
8. [Environnement et configuration](#8-environnement-et-configuration)
9. [Diagramme d'architecture](#9-diagramme-darchitecture)
10. [Insights et recommandations](#10-insights-et-recommandations)

---

## 1. Vue d'ensemble du projet

### 1.1 Type de projet

**Application Web Full-Stack** - Plateforme collaborative pour la gestion et la découverte de conventions de jonglerie internationales.

### 1.2 Description

Convention de Jonglerie est une application web complète permettant aux jongleurs et organisateurs d'événements de :

- **Découvrir** des conventions de jonglerie à travers le monde
- **Gérer** des événements avec système de permissions granulaires
- **Collaborer** avec d'autres organisateurs
- **Recruter** des bénévoles avec système de planning
- **Vendre** des billets via intégration HelloAsso
- **Communiquer** via système de messagerie intégré
- **Organiser** du covoiturage entre participants
- **Gérer** des objets trouvés, workshops, et artistes

### 1.3 Caractéristiques principales

- **🌍 Multilingue** : Support de 13 langues (Français, Anglais, Allemand, Espagnol, Italien, etc.)
- **🔐 Auth moderne** : Sessions scellées via `nuxt-auth-utils` (pas de JWT)
- **📱 PWA Ready** : Notifications push, mode hors-ligne
- **🎨 UI moderne** : Nuxt UI 4.0 avec Tailwind CSS
- **🐳 Dockerisé** : Environnements dev, test et production
- **✅ Tests complets** : 1235+ tests (unit, integration, e2e)
- **🔍 SEO optimisé** : Sitemap, robots.txt, Schema.org
- **♿ Accessible** : Support WCAG 2.1

### 1.4 Stack technique

```
Frontend:  Nuxt.js 4.2.0 + Vue 3.5.17 + TypeScript 5.8.3
Backend:   Nitro (Nuxt Server Engine) + Prisma ORM
Database:  MySQL 8.0
UI:        Nuxt UI 4.0 + Tailwind CSS + Headless UI
Auth:      nuxt-auth-utils (sessions scellées)
i18n:      @nuxtjs/i18n 10.0.3 (lazy loading)
State:     Pinia 3.0.3
Testing:   Vitest 3.2.4 + @nuxt/test-utils
DevOps:    Docker + Docker Compose + GitHub Actions
```

### 1.5 Architecture Pattern

**Architecture Full-Stack Nuxt** avec :

- **SSR (Server-Side Rendering)** pour SEO et performances
- **API RESTful** via Nitro server routes
- **File-based routing** pour pages et API
- **Convention over Configuration**
- **Permissions granulaires** (pas de rôles globaux)

---

## 2. Stack technologique détaillée

### 2.1 Frontend Core

| Technologie    | Version | Rôle                                |
| -------------- | ------- | ----------------------------------- |
| **Nuxt.js**    | 4.2.0   | Framework Vue.js universel avec SSR |
| **Vue.js**     | 3.5.17  | Framework JavaScript réactif        |
| **TypeScript** | 5.8.3   | Typage statique pour JavaScript     |
| **Pinia**      | 3.0.3   | State management (remplace Vuex)    |
| **VueUse**     | 13.6.0  | Collection de composables Vue       |

### 2.2 UI & Styling

| Technologie      | Version | Rôle                                      |
| ---------------- | ------- | ----------------------------------------- |
| **Nuxt UI**      | 4.0.0   | Composants UI avec Tailwind + Headless UI |
| **Tailwind CSS** | -       | Framework CSS utilitaire (via Nuxt UI)    |
| **Nuxt Icon**    | -       | Icônes vectorielles (Iconify)             |
| **Chart.js**     | 4.5.1   | Graphiques et visualisations              |
| **FullCalendar** | 6.1.15+ | Planning et calendrier interactif         |
| **Leaflet**      | -       | Cartes interactives (via nuxt-leaflet)    |
| **flag-icons**   | 7.5.0   | Drapeaux de pays                          |

### 2.3 Backend & Database

| Technologie      | Version  | Rôle                            |
| ---------------- | -------- | ------------------------------- |
| **Nitro**        | (Nuxt 4) | Moteur serveur universel        |
| **Prisma**       | 6.18.0   | ORM (Object-Relational Mapping) |
| **MySQL**        | 8.0      | Base de données relationnelle   |
| **@prisma/nuxt** | 0.3.0    | Intégration Prisma pour Nuxt    |

### 2.4 Authentification & Sécurité

| Technologie         | Version | Rôle                                        |
| ------------------- | ------- | ------------------------------------------- |
| **nuxt-auth-utils** | 0.5.23  | Auth par sessions scellées (sealed cookies) |
| **bcryptjs**        | 3.0.2   | Hachage de mots de passe                    |
| **md5**             | 2.3.0   | Hash email pour Gravatar                    |
| **zod**             | 4.1.9   | Validation de schémas TypeScript            |

### 2.5 Fonctionnalités & Intégrations

| Technologie           | Version | Rôle                              |
| --------------------- | ------- | --------------------------------- |
| **@nuxtjs/i18n**      | 10.0.3  | Internationalisation (13 langues) |
| **@nuxtjs/seo**       | 3.2.2   | SEO (sitemap, robots, meta tags)  |
| **nuxt-qrcode**       | 0.4.8   | Génération de QR codes            |
| **web-push**          | 3.6.7   | Notifications push Web            |
| **@anthropic-ai/sdk** | 0.67.0  | IA pour extraction de workshops   |
| **nodemailer**        | 7.0.5   | Envoi d'emails SMTP               |
| **node-cron**         | 3.0.3   | Tâches planifiées (cron jobs)     |
| **@vue-email**        | 0.0.21  | Templates d'emails en Vue         |

### 2.6 Build & Dev Tools

| Technologie          | Version  | Rôle                           |
| -------------------- | -------- | ------------------------------ |
| **Vite**             | (Nuxt 4) | Build tool rapide              |
| **ESLint**           | 9.32.0   | Linter JavaScript/TypeScript   |
| **Prettier**         | 3.3.3    | Formatage de code              |
| **Vitest**           | 3.2.4    | Framework de tests unitaires   |
| **@nuxt/test-utils** | 3.19.2   | Utilitaires de tests pour Nuxt |
| **happy-dom**        | 18.0.1   | DOM virtuel pour tests         |
| **tsx**              | 4.19.1   | Exécution TypeScript directe   |

### 2.7 DevOps & Déploiement

| Technologie        | Version | Rôle                           |
| ------------------ | ------- | ------------------------------ |
| **Docker**         | 20.10+  | Conteneurisation               |
| **Docker Compose** | v2.0+   | Orchestration multi-conteneurs |
| **GitHub Actions** | -       | CI/CD automatisé               |
| **Node.js**        | 22      | Runtime JavaScript             |
| **Sharp**          | 0.33.5  | Optimisation d'images          |

### 2.8 Dépendances système

```json
{
  "engines": {
    "node": ">=22 <23"
  }
}
```

**Prérequis** :

- Node.js 22.x (strictement)
- MySQL 8.0+
- Docker Engine 20.10+ (pour Docker)
- 2GB RAM minimum (4GB recommandé)
- 5GB espace disque

---

## 3. Architecture du projet

### 3.1 Pattern architectural global

**Nuxt Full-Stack Architecture** avec séparation claire :

```
┌─────────────────────────────────────────────────────────────────┐
│                      NUXT APPLICATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐      ┌────────────────┐      ┌───────────┐ │
│  │   Frontend    │◄────►│   API Routes   │◄────►│  Database │ │
│  │   (app/)      │      │   (server/api/)│      │  (Prisma) │ │
│  └───────────────┘      └────────────────┘      └───────────┘ │
│         ▲                       ▲                      ▲       │
│         │                       │                      │       │
│         ▼                       ▼                      ▼       │
│  ┌───────────────┐      ┌────────────────┐      ┌───────────┐ │
│  │  Composables  │      │  Middleware    │      │   Utils   │ │
│  │  useAuth()    │      │  auth.ts       │      │  helpers  │ │
│  └───────────────┘      └────────────────┘      └───────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Layers d'architecture

#### Layer 1 : Présentation (Frontend)

- **Pages** : Routes file-based (`app/pages/*.vue`)
- **Composants** : Composants Vue réutilisables (`app/components/`)
- **Layouts** : Mises en page (`app/layouts/`)
- **Stores** : State management Pinia (`app/stores/`)

#### Layer 2 : Business Logic

- **Composables** : Logique réutilisable (`app/composables/`)
- **Utils** : Fonctions utilitaires (`app/utils/`, `server/utils/`)
- **Middleware** : Guards de navigation (`app/middleware/`, `server/middleware/`)

#### Layer 3 : API & Server

- **API Routes** : Endpoints RESTful (`server/api/`)
- **Server Utils** : Helpers serveur (`server/utils/`)
- **Tasks** : Tâches planifiées cron (`server/tasks/`)

#### Layer 4 : Data Access

- **Prisma Schema** : Modèles de données (`prisma/schema.prisma`)
- **Migrations** : Historique DB (`prisma/migrations/`)
- **Seed** : Données de test (`scripts/seed-dev.ts`)

### 3.3 Pattern de permissions

**Système de permissions granulaires** (pas de rôles globaux) :

```typescript
// Convention Organizer Rights
{
  canEditConvention: boolean
  canDeleteConvention: boolean
  canManageOrganizers: boolean
  canAddEdition: boolean
  canEditAllEditions: boolean
  canDeleteAllEditions: boolean
}

// Edition-specific permissions (via EditionOrganizerPermission)
{
  editionId: number
  canEdit: boolean
  canDelete: boolean
}
```

**Avantages** :

- Flexibilité maximale
- Pas de hiérarchie rigide
- Droits par édition si nécessaire
- Audit trail complet (OrganizerPermissionHistory)

### 3.4 Flow de données typique

#### Exemple : Création d'une convention

```
1. USER ACTION (Frontend)
   └─> app/pages/conventions/add.vue
       └─> Submit form with convention data

2. API CALL (Composable)
   └─> app/composables/useConventions.ts
       └─> $fetch('/api/conventions', { method: 'POST', body })

3. SERVER MIDDLEWARE (Auth check)
   └─> server/middleware/auth.ts
       └─> Verify user session

4. API HANDLER (Business logic)
   └─> server/api/conventions/index.post.ts
       └─> Validate input with Zod
       └─> Create convention in DB
       └─> Set creator as organizer with all rights

5. DATABASE (Prisma ORM)
   └─> prisma.convention.create()
       └─> MySQL INSERT

6. RESPONSE (Success)
   └─> Return new convention with ID
       └─> Frontend updates store
       └─> Redirect to convention page
```

### 3.5 Authentication Flow

**Session-based auth** (nuxt-auth-utils) :

```
┌─────────────┐         ┌──────────────┐         ┌──────────┐
│   Browser   │         │  Nuxt Server │         │  MySQL   │
└──────┬──────┘         └───────┬──────┘         └────┬─────┘
       │                        │                     │
       │  POST /api/auth/login  │                     │
       ├───────────────────────►│                     │
       │  { email, password }   │                     │
       │                        │  SELECT user        │
       │                        ├────────────────────►│
       │                        │  WHERE email = ?    │
       │                        │◄────────────────────┤
       │                        │  user data          │
       │                        │                     │
       │                        │  bcrypt.compare()   │
       │                        │  ✓ Valid            │
       │                        │                     │
       │                        │  setUserSession()   │
       │                        │  → Sealed cookie    │
       │◄───────────────────────┤                     │
       │  Set-Cookie: nuxt-session=<encrypted>       │
       │                        │                     │
       │  GET /api/profile      │                     │
       ├───────────────────────►│                     │
       │  Cookie: nuxt-session  │                     │
       │                        │  getUserSession()   │
       │                        │  → Decrypt cookie   │
       │                        │  ✓ Valid session    │
       │◄───────────────────────┤                     │
       │  { user: {...} }       │                     │
```

**Caractéristiques** :

- **Pas de JWT** : Cookies scellés (sealed cookies)
- **Server-side sessions** : Données en cookie chiffré
- **CSRF protection** : Cookies SameSite=Lax
- **Session persistence** : 30 jours par défaut
- **Remember me** : Extension à 90 jours

---

## 4. Structure des répertoires

### 4.1 Vue d'ensemble

```
convention-de-jonglerie/
├── app/                    # Frontend Nuxt (pages, composants, stores)
├── server/                 # Backend API et middleware
├── prisma/                 # Schéma DB et migrations
├── i18n/                   # Traductions (13 langues)
├── test/                   # Tests (unit, integration, e2e)
├── scripts/                # Scripts utilitaires
├── docs/                   # Documentation projet
├── public/                 # Assets statiques
├── .nuxt/                  # Build Nuxt (généré)
├── .output/                # Build production (généré)
├── node_modules/           # Dépendances npm
├── nuxt.config.ts          # Configuration Nuxt
├── prisma/schema.prisma    # Schéma base de données
└── package.json            # Dépendances et scripts
```

### 4.2 Répertoire `app/` (Frontend)

```
app/
├── assets/                 # Assets compilés (CSS, images)
│   └── css/
│       └── main.css       # Styles globaux Tailwind
│
├── components/             # Composants Vue réutilisables
│   ├── admin/             # Composants admin
│   ├── convention/        # Gestion conventions
│   ├── edition/           # Gestion éditions
│   │   ├── carpool/      # Covoiturage
│   │   ├── ticketing/    # Billetterie
│   │   └── volunteer/    # Bénévoles
│   ├── notifications/     # Système notifications
│   ├── ui/               # Composants UI génériques
│   └── ...
│
├── composables/           # Logique réutilisable Vue
│   ├── useAuth.ts        # Authentification
│   ├── useConventions.ts # CRUD conventions
│   ├── useEditions.ts    # CRUD éditions
│   ├── useI18n.ts        # i18n helpers
│   ├── useMessenger.ts   # Messagerie
│   └── ...
│
├── layouts/               # Mises en page
│   ├── default.vue       # Layout principal
│   ├── admin.vue         # Layout admin
│   └── edition-dashboard.vue
│
├── middleware/            # Navigation guards (client)
│   ├── admin.ts          # Protège routes admin
│   ├── auth.ts           # Protège routes authentifiées
│   └── guest.ts          # Redirige si connecté
│
├── pages/                 # Routes file-based
│   ├── index.vue         # Page d'accueil
│   ├── login.vue         # Connexion
│   ├── register.vue      # Inscription
│   ├── conventions/      # Routes conventions
│   ├── editions/         # Routes éditions
│   ├── admin/            # Panel admin
│   └── ...
│
├── stores/                # Pinia stores
│   ├── auth.ts           # State authentification
│   ├── editions.ts       # State éditions
│   ├── notifications.ts  # State notifications
│   └── favoritesEditions.ts
│
├── types/                 # Types TypeScript frontend
│   └── index.d.ts
│
└── utils/                 # Utilitaires frontend
    ├── countries.ts      # Liste pays
    ├── dates.ts          # Helpers dates
    └── ...
```

**Points clés** :

- **File-based routing** : Chaque `.vue` dans `pages/` = route
- **Auto-import** : Composants/composables importés automatiquement
- **Type-safe** : TypeScript strict avec Zod pour validation

### 4.3 Répertoire `server/` (Backend)

```
server/
├── api/                   # API RESTful routes
│   ├── auth/             # Authentification
│   │   ├── login.post.ts
│   │   ├── register.post.ts
│   │   ├── logout.post.ts
│   │   └── verify-email.post.ts
│   │
│   ├── conventions/       # CRUD conventions
│   │   ├── index.get.ts   # Liste conventions
│   │   ├── index.post.ts  # Créer convention
│   │   └── [id]/          # Routes dynamiques
│   │       ├── index.get.ts
│   │       ├── index.put.ts
│   │       ├── index.delete.ts
│   │       ├── organizers.get.ts
│   │       └── editions.get.ts
│   │
│   ├── editions/          # CRUD éditions
│   │   └── [id]/
│   │       ├── volunteers/    # Gestion bénévoles
│   │       ├── ticketing/     # Billetterie
│   │       ├── carpool/       # Covoiturage
│   │       ├── workshops/     # Ateliers
│   │       └── lost-found/    # Objets trouvés
│   │
│   ├── admin/             # Routes admin
│   │   ├── users/
│   │   ├── feedback/
│   │   ├── error-logs/
│   │   └── notifications/
│   │
│   ├── profile/           # Profil utilisateur
│   ├── notifications/     # Notifications
│   └── messenger/         # Messagerie
│
├── middleware/            # Middleware server
│   ├── auth.ts           # Vérification session
│   ├── cache-headers.ts  # En-têtes cache
│   └── noindex.ts        # SEO staging
│
├── tasks/                 # Tâches cron
│   ├── cleanup-tokens.ts
│   └── send-notifications.ts
│
├── utils/                 # Utilitaires serveur
│   ├── api/              # Helpers API
│   ├── auth/             # Helpers auth
│   ├── email/            # Envoi emails
│   ├── permissions/      # Vérification droits
│   └── validators/       # Validateurs Zod
│
├── emails/                # Templates emails Vue
│   ├── verification-code.vue
│   └── password-reset.vue
│
└── routes/                # Routes serveur custom
    └── auth/             # OAuth (Google, Facebook)
```

**Points clés** :

- **Convention de nommage** : `[id]` = paramètre dynamique
- **HTTP methods** : `.get.ts`, `.post.ts`, `.put.ts`, `.delete.ts`
- **Auto-import** : `~/server/utils` importé automatiquement
- **Type-safe API** : Validation Zod + types générés

### 4.4 Répertoire `prisma/`

```
prisma/
├── schema.prisma          # Schéma base de données
│   ├── models            # 50+ modèles
│   │   ├── User
│   │   ├── Convention
│   │   ├── Edition
│   │   ├── ConventionOrganizer
│   │   ├── EditionVolunteerApplication
│   │   └── ...
│   └── relations         # Relations entre modèles
│
└── migrations/            # Historique migrations
    ├── 20250910191127_initial_schema/
    ├── 20251106212514_rename_collaborator_to_organizer/
    ├── 20251116180314_add_messaging_system/
    └── ...
```

**Modèles principaux** :

- **User** : Utilisateurs (auth, profil, préférences)
- **Convention** : Conventions (métadonnées, localisation)
- **Edition** : Éditions annuelles d'une convention
- **ConventionOrganizer** : Organisateurs avec droits granulaires
- **EditionVolunteerApplication** : Candidatures bénévoles
- **VolunteerTeam** : Équipes de bénévoles
- **VolunteerTimeSlot** : Créneaux horaires
- **Order** : Commandes billetterie (HelloAsso)
- **Workshop** : Ateliers et spectacles
- **Conversation** : Système de messagerie
- **LostFoundItem** : Objets trouvés

### 4.5 Répertoire `i18n/`

```
i18n/
├── i18n.config.ts         # Configuration i18n
├── messages.ts            # Loader de messages
└── locales/               # Traductions par langue
    ├── fr/               # Français (langue source)
    │   ├── common.json   # Commun (boutons, labels)
    │   ├── app.json      # Application
    │   ├── public.json   # Pages publiques
    │   ├── gestion.json  # Gestion événements
    │   ├── components.json
    │   ├── notifications.json
    │   └── feedback.json
    ├── en/               # Anglais
    ├── de/               # Allemand
    ├── es/               # Espagnol
    ├── it/               # Italien
    ├── nl/               # Néerlandais
    ├── pl/               # Polonais
    ├── pt/               # Portugais
    ├── ru/               # Russe
    ├── sv/               # Suédois
    ├── uk/               # Ukrainien
    ├── cs/               # Tchèque
    └── da/               # Danois
```

**Système i18n** :

- **Lazy loading** : Chargement à la demande par domaine
- **13 langues** : Français langue source, autres traduites
- **Fallback intelligent** : EN si traduction manquante
- **Scripts de vérification** : `npm run check-i18n`
- **Marquage [TODO]** : Traductions à faire

### 4.6 Répertoire `test/`

```
test/
├── unit/                  # Tests unitaires
│   ├── composables/      # Tests composables
│   ├── stores/           # Tests Pinia stores
│   ├── utils/            # Tests utilitaires
│   └── security/         # Tests sécurité
│
├── nuxt/                  # Tests Nuxt (composants + API)
│   ├── components/       # Tests composants Vue
│   ├── pages/            # Tests pages
│   └── server/           # Tests API endpoints
│       ├── api/
│       ├── middleware/
│       └── utils/
│
├── integration/           # Tests intégration DB
│   ├── auth.db.test.ts
│   ├── conventions.db.test.ts
│   ├── volunteers.workflow.db.test.ts
│   └── ...
│
├── e2e/                   # Tests end-to-end (Playwright)
│
├── __mocks__/             # Mocks (Prisma, fetch, etc.)
├── setup-db.ts            # Setup DB test
└── vitest.config.ts       # Config Vitest
```

**Statistiques tests** :

- **Total** : 1235+ tests
- **Unit** : ~273 tests
- **Nuxt** : ~962 tests
- **Integration** : ~7 tests
- **E2E** : ~3 tests (skippés en CI)

### 4.7 Répertoire `scripts/`

```
scripts/
├── translation/           # Scripts traduction i18n
│   ├── mark-todo.js      # Marquer clés [TODO]
│   ├── apply-translations.js
│   └── list-todo-keys.js
│
├── check-i18n.js         # Vérification clés i18n
├── check-i18n-translations.js
├── add-translation.js
├── seed-dev.ts           # Peupler DB de dev
├── list-seed-accounts.ts
├── manage-admin.ts       # Gérer admins globaux
├── clean-expired-tokens.ts
├── run-geocoding.mjs     # Géocoder adresses
├── show-help.mjs         # Aide CLI
└── test-db-run.js        # Lancer tests DB
```

### 4.8 Répertoire `docs/`

```
docs/
├── system/               # Documentation système
│   ├── api-utils-refactoring.md
│   └── i18n-lazy-loading.md
│
├── volunteers/           # Documentation bénévoles
│   ├── volunteer-application-api-utility.md
│   └── volunteer-permissions.md
│
├── integrations/         # Intégrations externes
│   ├── helloasso-api.md
│   └── ai-providers.md
│
├── ticketing/            # Billetterie
│   └── ticketing-system.md
│
├── AUTH_SESSIONS.md      # Système auth
├── ORGANIZER_PERMISSIONS.md
├── DOCKER.md             # Guide Docker
├── DOCKER-WINDOWS.md
├── README.tests.md       # Guide tests
└── codebase_analysis.md  # Ce fichier
```

---

## 5. Analyse fichier par fichier

### 5.1 Fichiers de configuration racine

#### `nuxt.config.ts` (447 lignes)

**Rôle** : Configuration principale de Nuxt

**Sections clés** :

```typescript
export default defineNuxtConfig({
  // Modules Nuxt activés
  modules: [
    '@nuxt/eslint',        // Linting
    '@nuxt/ui',            // Composants UI
    '@pinia/nuxt',         // State management
    '@prisma/nuxt',        // ORM
    'nuxt-auth-utils',     // Auth
    '@nuxtjs/i18n',        // i18n
    '@nuxtjs/seo',         // SEO
    // ... 12 modules au total
  ],

  // Configuration i18n (13 langues)
  i18n: {
    lazy: true,          // Lazy loading
    defaultLocale: 'en',
    locales: [
      { code: 'fr', name: 'Français', files: [...] },
      { code: 'en', name: 'English', files: [...] },
      // ... 11 autres langues
    ],
  },

  // Runtime config (env vars)
  runtimeConfig: {
    // Server-side only
    sessionPassword: process.env.NUXT_SESSION_PASSWORD,
    emailEnabled: process.env.SEND_EMAILS,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,

    public: {
      // Client + Server
      recaptchaSiteKey: process.env.NUXT_PUBLIC_RECAPTCHA_SITE_KEY,
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL,
    },
  },

  // Optimisations Vite
  vite: {
    server: {
      watch: {
        usePolling: true,  // Pour Docker Windows
        interval: 1000,
      },
    },
  },

  // SEO
  robots: {
    disallow: process.env.NUXT_ENV === 'staging' ? ['/'] : [],
  },
  sitemap: {
    enabled: process.env.NODE_ENV === 'production',
    exclude: ['/admin/**', '/profile', '/api/**'],
  },
})
```

**Points notables** :

- **Icon server bundle** : Mode `remote` pour réduire la taille
- **Hot reload Docker** : Polling activé pour Windows
- **SEO conditionnel** : Sitemap uniquement en prod
- **Lazy hydration** : Experimental feature activée

#### `prisma/schema.prisma` (2000+ lignes)

**Rôle** : Schéma complet de la base de données

**Modèles principaux** (50+ au total) :

```prisma
// Utilisateur
model User {
  id                Int       @id @default(autoincrement())
  email             String    @unique
  emailHash         String    // MD5 pour Gravatar
  pseudo            String    @unique
  password          String?   // Null si OAuth
  authProvider      String    @default("email")
  isGlobalAdmin     Boolean   @default(false)
  preferredLanguage String    @default("fr")
  // Relations (20+ collections)
  createdConventions        Convention[]
  organizations             ConventionOrganizer[]
  volunteerApplications     EditionVolunteerApplication[]
  notifications             Notification[]
  pushSubscriptions         PushSubscription[]
  conversationParticipants  ConversationParticipant[]
  // ...
}

// Convention (événement récurrent)
model Convention {
  id          Int      @id @default(autoincrement())
  name        String
  description String?  @db.Text
  creatorId   Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  imageUrl    String?
  websiteUrl  String?
  isArchived  Boolean  @default(false)
  // Relations
  creator     User?    @relation(fields: [creatorId])
  editions    Edition[]
  organizers  ConventionOrganizer[]
}

// Organisateur avec permissions granulaires
model ConventionOrganizer {
  id                   Int       @id @default(autoincrement())
  userId               Int
  conventionId         Int
  addedAt              DateTime  @default(now())
  addedById            Int?
  title                String?   // "Créateur", "Coordinateur", etc.

  // Permissions granulaires
  canEditConvention    Boolean   @default(false)
  canDeleteConvention  Boolean   @default(false)
  canManageOrganizers  Boolean   @default(false)
  canAddEdition        Boolean   @default(false)
  canEditAllEditions   Boolean   @default(false)
  canDeleteAllEditions Boolean   @default(false)

  // Relations
  user        User       @relation(fields: [userId])
  convention  Convention @relation(fields: [conventionId])
  addedBy     User?      @relation("AddedOrganizers", fields: [addedById])

  @@unique([userId, conventionId])
}

// Édition annuelle d'une convention
model Edition {
  id           Int       @id @default(autoincrement())
  name         String?
  description  String?   @db.Text
  startDate    DateTime
  endDate      DateTime
  conventionId Int
  creatorId    Int?

  // Adresse complète
  addressLine1 String
  city         String
  country      String
  postalCode   String
  latitude     Float?
  longitude    Float?

  // Services disponibles
  hasFoodTrucks     Boolean @default(false)
  hasKidsZone       Boolean @default(false)
  hasTentCamping    Boolean @default(false)
  acceptsPets       Boolean @default(false)
  hasAccessibility  Boolean @default(false)

  // Relations massives
  convention           Convention  @relation(fields: [conventionId])
  creator              User?       @relation("CreatedEditions", fields: [creatorId])
  volunteerApplications EditionVolunteerApplication[]
  volunteerTeams        VolunteerTeam[]
  volunteerTimeSlots    VolunteerTimeSlot[]
  workshops             Workshop[]
  posts                 EditionPost[]
  lostFoundItems        LostFoundItem[]
  carpoolOffers         CarpoolOffer[]
  orders                Order[]
  // ... 30+ relations
}

// Candidature bénévole
model EditionVolunteerApplication {
  id                Int       @id @default(autoincrement())
  userId            Int
  editionId         Int
  status            String    @default("PENDING") // PENDING, ACCEPTED, REJECTED, CANCELLED
  motivation        String?   @db.Text
  skills            String?   @db.Text
  availability      Json?     // Créneaux dispos
  dietaryNeeds      String?
  emergencyContact  String?
  createdAt         DateTime  @default(now())

  // Relations
  user      User      @relation(fields: [userId])
  edition   Edition   @relation(fields: [editionId])
  teamAssignments ApplicationTeamAssignment[]

  @@unique([userId, editionId])
}

// Système de messagerie
model Conversation {
  id            String   @id @default(uuid())
  type          String   // TEAM_GROUP, TEAM_LEADER_PRIVATE, DIRECT
  editionId     Int?
  teamId        String?
  createdAt     DateTime @default(now())

  // Relations
  edition       Edition?  @relation(fields: [editionId])
  team          VolunteerTeam? @relation(fields: [teamId])
  participants  ConversationParticipant[]
  messages      Message[]
}

// ... 45+ autres modèles
```

**Statistiques** :

- **50+ modèles** (User, Convention, Edition, Volunteer, etc.)
- **200+ champs** au total
- **Relations complexes** : Many-to-many, cascades
- **Indexes** : Optimisation requêtes fréquentes
- **Contraintes** : Unicité, foreign keys

#### `package.json` (162 lignes)

**Scripts principaux** :

```json
{
  "scripts": {
    // Développement
    "dev": "nuxt dev",
    "build": "NODE_OPTIONS='--max-old-space-size=4096' nuxt build",

    // Linting
    "lint": "[ -d .nuxt ] || npx nuxt prepare; eslint .",
    "lint:fix": "[ -d .nuxt ] || npx nuxt prepare; eslint . --fix",
    "format": "prettier -w \"**/*.{js,ts,vue,json,md,yml,yaml}\"",

    // Tests
    "test": "vitest --project unit",
    "test:unit:run": "vitest run --project unit --silent",
    "test:nuxt:run": "vitest run --project nuxt --silent",
    "test:db:run": "node scripts/test-db-run.js",
    "test:all": "npm run test:unit:run && npm run test:nuxt:run && npm run test:e2e:run",

    // Docker
    "docker:dev": "docker compose -f docker-compose.dev.yml up --build",
    "docker:dev:logs": "docker compose -f docker-compose.dev.yml logs -f app",

    // i18n
    "check-i18n": "node scripts/check-i18n.js",
    "check-translations": "node scripts/check-i18n-translations.js",

    // Admin
    "admin:add": "npx tsx scripts/manage-admin.ts add",
    "admin:list": "npx tsx scripts/manage-admin.ts list",

    // Utilitaires
    "geocode": "node scripts/run-geocoding.mjs",
    "db:seed:dev": "npx tsx scripts/seed-dev.ts"
  }
}
```

#### `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "~/types": ["./app/types/index.d.ts"],
      "~/utils/*": ["./app/utils/*"]
    }
  }
}
```

**Note** : Nuxt génère automatiquement les configs TypeScript dans `.nuxt/`

#### `.gitignore`

**Fichiers ignorés** :

```
# Build
.output
.nuxt
.cache
dist

# Deps
node_modules

# Env
.env
.env.*
!.env.example

# Uploads
public/uploads/
!public/uploads/.gitkeep

# Backups
/backups/*
```

### 5.2 Fichiers Docker

#### `docker-compose.dev.yml`

**Services** :

- **database** : MySQL 8.0 (port 3306)
- **app** : Nuxt dev server (port 3000 + 24678 HMR)

**Caractéristiques** :

- Hot reload avec polling (Docker Windows)
- Volumes pour code source (cached)
- Variables d'env complètes
- Health checks pour database

#### `docker-compose.test.yml`

**Services** :

- **test-db** : MySQL 8.0 (port 3308)
- **test-runner** : Vitest (ephemeral)

**Usage** : Tests d'intégration avec DB réelle

#### `docker-compose.release.yml`

**Services** :

- **database** : MySQL 8.0 production
- **app** : Build Nuxt optimisé

**Caractéristiques** :

- Multi-stage build
- Compression Brotli/Gzip
- Restart policies
- Network externe pour reverse proxy

#### `Dockerfile`

**Multi-stage build** :

```dockerfile
# Stage 1: Dependencies
FROM node:22-slim AS deps
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:22-slim AS builder
COPY . .
RUN npm ci
RUN npx prisma generate
RUN npm run build

# Stage 3: Runtime
FROM node:22-slim
COPY --from=builder /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

---

## 6. Endpoints API

### 6.1 Structure des endpoints

**Convention de nommage** :

```
/api/{resource}/[{id}]/{action}.{method}.ts
```

**Exemples** :

- `GET /api/conventions` → `server/api/conventions/index.get.ts`
- `POST /api/conventions` → `server/api/conventions/index.post.ts`
- `GET /api/conventions/:id` → `server/api/conventions/[id]/index.get.ts`
- `PUT /api/conventions/:id` → `server/api/conventions/[id]/index.put.ts`
- `DELETE /api/conventions/:id` → `server/api/conventions/[id]/index.delete.ts`

### 6.2 Authentification

#### POST /api/auth/register

**Body** :

```typescript
{
  email: string
  pseudo: string
  password: string
  recaptchaToken?: string
}
```

**Response** :

```typescript
{
  user: {
    id: number
    email: string
    pseudo: string
    isEmailVerified: false
  }
}
```

#### POST /api/auth/login

**Body** :

```typescript
{
  identifier: string  // email ou pseudo
  password: string
  rememberMe?: boolean
}
```

**Response** :

```typescript
{
  user: {
    id: number
    email: string
    pseudo: string
    isGlobalAdmin: boolean
  }
}
```

#### POST /api/auth/verify-email

**Body** :

```typescript
{
  code: string // Code à 6 chiffres
}
```

#### POST /api/auth/logout

**Response** : 200 OK (clears session)

#### POST /api/auth/forgot-password

**Body** :

```typescript
{
  email: string
}
```

#### POST /api/auth/reset-password

**Body** :

```typescript
{
  token: string
  newPassword: string
}
```

### 6.3 Conventions

#### GET /api/conventions

**Query params** :

```typescript
{
  search?: string
  archived?: boolean
  limit?: number
  offset?: number
}
```

**Response** :

```typescript
{
  conventions: Convention[]
  total: number
}
```

#### POST /api/conventions

**Auth** : Required
**Body** :

```typescript
{
  name: string
  description?: string
  websiteUrl?: string
  imageUrl?: string
}
```

**Response** :

```typescript
{
  convention: Convention
}
```

#### GET /api/conventions/:id

**Response** :

```typescript
{
  id: number
  name: string
  description: string
  imageUrl: string
  createdAt: string
  editions: Edition[]
  organizers: ConventionOrganizer[]
  userRole?: {
    isOrganizer: boolean
    rights: Rights
  }
}
```

#### PUT /api/conventions/:id

**Auth** : Required + `canEditConvention`
**Body** :

```typescript
{
  name?: string
  description?: string
  websiteUrl?: string
}
```

#### DELETE /api/conventions/:id

**Auth** : Required + `canDeleteConvention`

#### GET /api/conventions/:id/organizers

**Auth** : Required
**Response** :

```typescript
{
  organizers: {
    id: number
    addedAt: string
    title: string
    rights: {
      editConvention: boolean
      deleteConvention: boolean
      manageOrganizers: boolean
      addEdition: boolean
      editAllEditions: boolean
      deleteAllEditions: boolean
    }
    user: {
      id: number
      pseudo: string
      emailHash: string
    }
    addedBy: {
      id: number
      pseudo: string
    }
  }
  ;[]
}
```

#### POST /api/conventions/:id/organizers

**Auth** : Required + `canManageOrganizers`
**Body** :

```typescript
{
  userIdentifier?: string  // email ou pseudo (search user)
  userId?: number         // ou direct user ID
  title?: string
  rights?: {
    editConvention?: boolean
    deleteConvention?: boolean
    manageOrganizers?: boolean
    addEdition?: boolean
    editAllEditions?: boolean
    deleteAllEditions?: boolean
  }
}
```

#### PUT /api/conventions/:id/organizers/:organizerId

**Auth** : Required + `canManageOrganizers`
**Body** :

```typescript
{
  title?: string
  rights?: Rights
}
```

#### DELETE /api/conventions/:id/organizers/:organizerId

**Auth** : Required + `canManageOrganizers`

### 6.4 Éditions

#### GET /api/editions

**Query params** :

```typescript
{
  search?: string
  country?: string
  startDate?: string  // ISO date
  endDate?: string
  services?: string[]  // ['food', 'camping', 'pets']
  limit?: number
  offset?: number
}
```

#### POST /api/editions

**Auth** : Required + `canAddEdition` sur convention
**Body** :

```typescript
{
  conventionId: number
  name?: string
  description?: string
  startDate: string
  endDate: string
  addressLine1: string
  city: string
  country: string
  postalCode: string
  // + 20+ champs optionnels (services, URLs, etc.)
}
```

#### GET /api/editions/:id

**Response** : Édition complète avec:

- Détails édition
- Convention parent
- Permissions utilisateur
- Stats (nombre bénévoles, billets vendus)

#### PUT /api/editions/:id

**Auth** : Required + `canEdit` sur édition

#### DELETE /api/editions/:id

**Auth** : Required + `canDelete` sur édition

### 6.5 Bénévoles

#### GET /api/editions/:id/volunteers/applications

**Auth** : Required (organizer)
**Response** :

```typescript
{
  applications: {
    id: number
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
    motivation: string
    skills: string
    availability: object
    dietaryNeeds: string
    emergencyContact: string
    createdAt: string
    user: {
      id: number
      pseudo: string
      email: string
    }
    teamAssignments: {
      teamId: string
      teamName: string
      isLeader: boolean
    }
    ;[]
  }
  ;[]
}
```

#### POST /api/editions/:id/volunteers/applications

**Auth** : Required
**Body** :

```typescript
{
  motivation?: string
  skills?: string
  availability?: object
  dietaryNeeds?: string
  emergencyContact?: string
}
```

#### PUT /api/editions/:id/volunteers/applications/:applicationId

**Auth** : Required (owner ou organizer)
**Body** :

```typescript
{
  status?: 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
  motivation?: string
  // ...
}
```

#### GET /api/editions/:id/volunteers/teams

**Response** :

```typescript
{
  teams: {
    id: string
    name: string
    description: string
    color: string
    memberCount: number
    leaders: User[]
  }[]
}
```

#### POST /api/editions/:id/volunteers/teams

**Auth** : Required (organizer)
**Body** :

```typescript
{
  name: string
  description?: string
  color?: string
}
```

#### POST /api/editions/:id/volunteers/applications/:applicationId/teams/:teamId

**Auth** : Required (organizer)
**Body** :

```typescript
{
  isLeader?: boolean
}
```

**Action** : Assigner bénévole à équipe

### 6.6 Planning bénévoles

#### GET /api/editions/:id/volunteer-time-slots

**Response** :

```typescript
{
  slots: {
    id: number
    name: string
    description: string
    startTime: string
    endTime: string
    requiredCount: number
    teamId: string
    assignments: {
      userId: number
      userName: string
      status: 'ASSIGNED' | 'CONFIRMED' | 'CANCELLED'
    }
    ;[]
  }
  ;[]
}
```

#### POST /api/editions/:id/volunteer-time-slots

**Auth** : Required (organizer)
**Body** :

```typescript
{
  name: string
  description?: string
  startTime: string  // ISO datetime
  endTime: string
  requiredCount: number
  teamId: string
}
```

#### POST /api/editions/:id/volunteer-time-slots/:slotId/assignments

**Auth** : Required (organizer)
**Body** :

```typescript
{
  userId: number
}
```

### 6.7 Billetterie

#### GET /api/editions/:id/ticketing

**Response** :

```typescript
{
  tiers: {
    id: number
    name: string
    price: number
    capacity: number
    sold: number
    available: number
  }
  ;[]
  options: {
    id: number
    name: string
    price: number
    type: 'ADDON' | 'MEAL'
  }
  ;[]
  stats: {
    totalRevenue: number
    totalSold: number
    totalCapacity: number
  }
}
```

#### POST /api/editions/:id/ticketing/tiers

**Auth** : Required (organizer)
**Body** :

```typescript
{
  name: string
  description?: string
  price: number
  capacity: number
  startDate?: string
  endDate?: string
}
```

#### GET /api/editions/:id/ticketing/orders

**Auth** : Required (organizer)
**Query** :

```typescript
{
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  search?: string
}
```

### 6.8 Covoiturage

#### GET /api/editions/:id/carpool-offers

**Response** :

```typescript
{
  offers: {
    id: number
    departure: string
    destination: string
    departureDate: string
    availableSeats: number
    price?: number
    driver: {
      id: number
      pseudo: string
    }
    passengers: User[]
  }[]
}
```

#### POST /api/carpool-offers

**Auth** : Required
**Body** :

```typescript
{
  editionId: number
  departure: string
  destination: string
  departureDate: string
  availableSeats: number
  price?: number
  description?: string
}
```

#### POST /api/carpool-offers/:id/bookings

**Auth** : Required
**Body** :

```typescript
{
  seats: number
  message?: string
}
```

### 6.9 Workshops

#### GET /api/editions/:id/workshops

**Response** :

```typescript
{
  workshops: {
    id: number
    title: string
    description: string
    startTime: string
    endTime: string
    location: string
    capacity: number
    instructor: {
      id: number
      pseudo: string
    }
    participants: number
  }
  ;[]
}
```

#### POST /api/editions/:id/workshops

**Auth** : Required
**Body** :

```typescript
{
  title: string
  description?: string
  startTime: string
  endTime: string
  locationId?: number
  capacity?: number
}
```

### 6.10 Messagerie

#### GET /api/messenger/conversations

**Auth** : Required
**Response** :

```typescript
{
  conversations: {
    id: string
    type: 'TEAM_GROUP' | 'TEAM_LEADER_PRIVATE' | 'DIRECT'
    teamId?: string
    teamName?: string
    participants: User[]
    lastMessage?: {
      content: string
      createdAt: string
      author: User
    }
    unreadCount: number
  }[]
}
```

#### POST /api/messenger/conversations/:conversationId/messages

**Auth** : Required
**Body** :

```typescript
{
  content: string
}
```

#### GET /api/messenger/conversations/:conversationId/messages

**Auth** : Required
**Query** :

```typescript
{
  limit?: number
  before?: string  // Message ID cursor
}
```

### 6.11 Admin

#### GET /api/admin/users

**Auth** : Required (isGlobalAdmin)
**Response** :

```typescript
{
  users: User[]
  total: number
}
```

#### GET /api/admin/error-logs

**Auth** : Required (isGlobalAdmin)
**Response** :

```typescript
{
  logs: {
    id: number
    message: string
    stack: string
    userId?: number
    createdAt: string
  }[]
}
```

#### POST /api/admin/notifications/test

**Auth** : Required (isGlobalAdmin)
**Body** :

```typescript
{
  userId: number
  title: string
  message: string
}
```

### 6.12 Profil & Notifications

#### GET /api/profile

**Auth** : Required
**Response** :

```typescript
{
  id: number
  email: string
  pseudo: string
  preferredLanguage: string
  profilePicture?: string
  notificationPreferences?: object
}
```

#### PUT /api/profile

**Auth** : Required
**Body** :

```typescript
{
  pseudo?: string
  preferredLanguage?: string
  phone?: string
  notificationPreferences?: object
}
```

#### GET /api/notifications

**Auth** : Required
**Response** :

```typescript
{
  notifications: {
    id: number
    title: string
    message: string
    type: string
    isRead: boolean
    createdAt: string
  }
  ;[]
  unreadCount: number
}
```

#### PATCH /api/notifications/:id/unread

**Auth** : Required
**Action** : Marquer comme lu

---

## 7. Architecture approfondie

### 7.1 Cycle de vie d'une requête

#### Exemple complet : Création d'une édition

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. USER ACTION (Frontend)                                       │
├──────────────────────────────────────────────────────────────────┤
│ File: app/pages/conventions/[id]/editions/add.vue               │
│                                                                  │
│ const form = {                                                   │
│   name: "EJC 2026",                                             │
│   startDate: "2026-08-01",                                      │
│   addressLine1: "Rue de la Jongle 42",                         │
│   city: "Bruxelles",                                            │
│   country: "BE",                                                │
│   // ...                                                        │
│ }                                                               │
│                                                                  │
│ await $fetch('/api/editions', {                                 │
│   method: 'POST',                                               │
│   body: form                                                    │
│ })                                                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. SERVER MIDDLEWARE (Auth verification)                        │
├──────────────────────────────────────────────────────────────────┤
│ File: server/middleware/auth.ts                                 │
│                                                                  │
│ export default defineEventHandler(async (event) => {            │
│   const session = await getUserSession(event)                   │
│   if (!session?.user) {                                         │
│     throw createError({ statusCode: 401 })                      │
│   }                                                             │
│   event.context.user = session.user                            │
│ })                                                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. API HANDLER (Validation + Business logic)                    │
├──────────────────────────────────────────────────────────────────┤
│ File: server/api/editions/index.post.ts                         │
│                                                                  │
│ // 1. Validate input with Zod                                   │
│ const schema = z.object({                                       │
│   name: z.string().min(1).max(200),                            │
│   startDate: z.string().datetime(),                            │
│   conventionId: z.number(),                                     │
│   // ...                                                        │
│ })                                                              │
│                                                                  │
│ const body = await readValidatedBody(event, schema.parse)      │
│                                                                  │
│ // 2. Check permissions                                         │
│ const hasPermission = await canUserAddEdition(                 │
│   event.context.user.id,                                       │
│   body.conventionId                                            │
│ )                                                               │
│                                                                  │
│ if (!hasPermission) {                                           │
│   throw createError({ statusCode: 403 })                       │
│ }                                                               │
│                                                                  │
│ // 3. Create edition in DB                                      │
│ const edition = await prisma.edition.create({                  │
│   data: {                                                       │
│     ...body,                                                    │
│     creatorId: event.context.user.id                           │
│   }                                                             │
│ })                                                              │
│                                                                  │
│ // 4. Geocode address (async, non-blocking)                    │
│ geocodeEditionAddress(edition.id).catch(console.error)         │
│                                                                  │
│ return { edition }                                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. DATABASE (Prisma ORM → MySQL)                                │
├──────────────────────────────────────────────────────────────────┤
│ INSERT INTO Edition (                                            │
│   name, startDate, endDate, conventionId, creatorId,            │
│   addressLine1, city, country, postalCode                       │
│ ) VALUES (                                                       │
│   'EJC 2026', '2026-08-01', '2026-08-10', 5, 123,              │
│   'Rue de la Jongle 42', 'Bruxelles', 'BE', '1000'             │
│ )                                                               │
│                                                                  │
│ → Returns: { id: 456, ... }                                     │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. RESPONSE (Success)                                            │
├──────────────────────────────────────────────────────────────────┤
│ HTTP/1.1 200 OK                                                  │
│ Content-Type: application/json                                   │
│                                                                  │
│ {                                                                │
│   "edition": {                                                   │
│     "id": 456,                                                   │
│     "name": "EJC 2026",                                         │
│     "startDate": "2026-08-01T00:00:00.000Z",                   │
│     "conventionId": 5,                                          │
│     // ...                                                      │
│   }                                                             │
│ }                                                               │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. FRONTEND UPDATE (State management)                           │
├──────────────────────────────────────────────────────────────────┤
│ File: app/composables/useEditions.ts                            │
│                                                                  │
│ const editionsStore = useEditionsStore()                        │
│ editionsStore.addEdition(edition)                               │
│                                                                  │
│ // Redirect to edition page                                     │
│ await navigateTo(`/editions/${edition.id}`)                     │
│                                                                  │
│ // Show success toast                                           │
│ toast.add({                                                     │
│   title: t('edition.created'),                                 │
│   color: 'green'                                                │
│ })                                                              │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Système de permissions en détail

#### Architecture des permissions

```
Convention
├── ConventionOrganizer (table)
│   ├── userId
│   ├── conventionId
│   ├── title (string, optionnel)
│   └── Rights (6 booléens)
│       ├── canEditConvention
│       ├── canDeleteConvention
│       ├── canManageOrganizers
│       ├── canAddEdition
│       ├── canEditAllEditions
│       └── canDeleteAllEditions
│
└── Editions
    └── EditionOrganizerPermission (table)
        ├── organizerId
        ├── editionId
        ├── canEdit (boolean)
        └── canDelete (boolean)
```

#### Logique de vérification

**Fichier** : `server/utils/permissions/edition-permissions.ts`

```typescript
export async function canUserEditEdition(userId: number, editionId: number): Promise<boolean> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          organizers: {
            where: { userId },
          },
        },
      },
    },
  })

  if (!edition) return false

  const organizer = edition.convention.organizers[0]
  if (!organizer) return false

  // 1. Check global right
  if (organizer.canEditAllEditions) return true

  // 2. Check if user created this edition
  if (edition.creatorId === userId) return true

  // 3. Check edition-specific permission
  const editionPerm = await prisma.editionOrganizerPermission.findFirst({
    where: {
      organizerId: organizer.id,
      editionId,
      canEdit: true,
    },
  })

  return !!editionPerm
}
```

#### Matrice de permissions

| Action                             | Droit requis                                             |
| ---------------------------------- | -------------------------------------------------------- |
| Modifier convention                | `canEditConvention`                                      |
| Supprimer convention               | `canDeleteConvention`                                    |
| Ajouter/retirer organisateurs      | `canManageOrganizers`                                    |
| Modifier droits organisateurs      | `canManageOrganizers`                                    |
| Créer édition                      | `canAddEdition`                                          |
| Modifier n'importe quelle édition  | `canEditAllEditions`                                     |
| Modifier édition spécifique        | `EditionOrganizerPermission.canEdit` OU créateur édition |
| Supprimer n'importe quelle édition | `canDeleteAllEditions`                                   |
| Supprimer édition spécifique       | `EditionOrganizerPermission.canDelete`                   |
| Gérer bénévoles                    | Droit édition (edit)                                     |
| Gérer billetterie                  | Droit édition (edit)                                     |
| Gérer workshops                    | Droit édition (edit)                                     |

#### Audit trail

**Table** : `OrganizerPermissionHistory`

Enregistre automatiquement :

- Ajout d'organisateur
- Modification de droits
- Retrait d'organisateur
- Qui a fait l'action (`actorId`)
- Quand (`createdAt`)
- Changements (`previousRights`, `newRights`)

### 7.3 Gestion de l'état (Pinia)

#### Store `auth.ts`

```typescript
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    isLoading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isGlobalAdmin: (state) => state.user?.isGlobalAdmin || false,
  },

  actions: {
    async login(identifier: string, password: string, rememberMe = false) {
      this.isLoading = true
      try {
        const { user } = await $fetch('/api/auth/login', {
          method: 'POST',
          body: { identifier, password, rememberMe },
        })
        this.user = user
        return user
      } finally {
        this.isLoading = false
      }
    },

    async logout() {
      await $fetch('/api/auth/logout', { method: 'POST' })
      this.user = null
      navigateTo('/login')
    },

    async fetchUser() {
      const { user } = await $fetch('/api/session')
      this.user = user
    },
  },
})
```

#### Store `editions.ts`

```typescript
export const useEditionsStore = defineStore('editions', {
  state: () => ({
    editions: [] as Edition[],
    currentEdition: null as Edition | null,
    filters: {
      search: '',
      country: '',
      services: [],
    },
  }),

  getters: {
    filteredEditions: (state) => {
      return state.editions.filter((e) => {
        if (state.filters.search && !e.name.includes(state.filters.search)) {
          return false
        }
        if (state.filters.country && e.country !== state.filters.country) {
          return false
        }
        return true
      })
    },
  },

  actions: {
    async fetchEditions(params?: any) {
      const data = await $fetch('/api/editions', { query: params })
      this.editions = data.editions
    },

    async fetchEdition(id: number) {
      const edition = await $fetch(`/api/editions/${id}`)
      this.currentEdition = edition
      return edition
    },
  },
})
```

### 7.4 Système i18n (Internationalisation)

#### Configuration lazy loading

**Fichier** : `i18n/i18n.config.ts`

```typescript
export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {}, // Messages chargés dynamiquement
}))
```

#### Structure des traductions

```
i18n/locales/{langue}/
├── common.json        # Boutons, labels communs
├── app.json          # Application (menu, footer)
├── public.json       # Pages publiques
├── gestion.json      # Gestion événements (admin)
├── components.json   # Composants réutilisables
├── notifications.json # Notifications système
└── feedback.json     # Formulaire feedback
```

#### Utilisation dans composants

```vue
<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <h1>{{ t('common.welcome') }}</h1>
  <p>{{ t('edition.volunteers.count', { count: 42 }) }}</p>
</template>
```

#### Scripts de gestion

```bash
# Vérifier clés manquantes/dupliquées
npm run check-i18n

# Comparer traductions entre langues
npm run check-translations

# Marquer clés comme [TODO]
npm run i18n:mark-todo "edition.new_key"
```

### 7.5 Système de notifications

#### Types de notifications

```typescript
enum NotificationType {
  VOLUNTEER_APPLICATION_ACCEPTED = 'volunteer_application_accepted',
  VOLUNTEER_APPLICATION_REJECTED = 'volunteer_application_rejected',
  VOLUNTEER_TEAM_ASSIGNED = 'volunteer_team_assigned',
  VOLUNTEER_SHIFT_ASSIGNED = 'volunteer_shift_assigned',
  ORDER_CONFIRMED = 'order_confirmed',
  ORDER_CANCELLED = 'order_cancelled',
  MESSAGE_RECEIVED = 'message_received',
  EDITION_UPDATED = 'edition_updated',
  // ...
}
```

#### Envoi de notification

**Fichier** : `server/utils/notifications/send-notification.ts`

```typescript
export async function sendNotification(
  userId: number,
  type: NotificationType,
  data: {
    title: string
    message: string
    actionUrl?: string
    metadata?: any
  }
) {
  // 1. Créer notification en DB
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title: data.title,
      message: data.message,
      actionUrl: data.actionUrl,
      metadata: data.metadata,
    },
  })

  // 2. Envoyer push notification si souscription active
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  for (const sub of subscriptions) {
    await sendPushNotification(sub, {
      title: data.title,
      body: data.message,
      url: data.actionUrl,
    })
  }

  // 3. Envoyer email si préférence activée
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, notificationPreferences: true },
  })

  if (user.notificationPreferences?.emailNotifications) {
    await sendEmailNotification(user.email, data)
  }

  return notification
}
```

#### Push notifications Web (VAPID)

**Configuration** :

```env
NUXT_PUBLIC_VAPID_PUBLIC_KEY=BN...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

**Souscription client** :

```typescript
// app/composables/usePushNotifications.ts
export function usePushNotifications() {
  const subscribe = async () => {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    await $fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      body: { subscription },
    })
  }

  return { subscribe }
}
```

### 7.6 Système de billetterie (HelloAsso)

#### Flux de synchronisation

```
1. Webhook HelloAsso
   ↓
2. POST /api/editions/:id/ticketing/helloasso/webhook
   ↓
3. Validation signature HMAC
   ↓
4. Parse événement (Order.Created, Order.Paid, etc.)
   ↓
5. Créer/Mettre à jour Order dans DB
   ↓
6. Mettre à jour stats billetterie
   ↓
7. Envoyer notification à l'acheteur
```

#### Modèle de données

```prisma
model Order {
  id                Int      @id @default(autoincrement())
  helloAssoOrderId  String   @unique  // ID HelloAsso
  editionId         Int
  userId            Int?
  buyerEmail        String
  buyerName         String
  totalAmount       Float
  status            String   // PENDING, CONFIRMED, CANCELLED
  paidAt            DateTime?
  createdAt         DateTime @default(now())

  // Relations
  edition           Edition  @relation(fields: [editionId])
  items             OrderItem[]
}

model OrderItem {
  id        Int    @id @default(autoincrement())
  orderId   Int
  tierId    Int?
  optionId  Int?
  quantity  Int
  price     Float

  order     Order  @relation(fields: [orderId])
  tier      TicketingTier?   @relation(fields: [tierId])
  option    TicketingOption? @relation(fields: [optionId])
}
```

### 7.7 Système de messagerie

#### Types de conversations

```typescript
enum ConversationType {
  TEAM_GROUP = 'TEAM_GROUP', // Groupe entier équipe
  TEAM_LEADER_PRIVATE = 'TEAM_LEADER_PRIVATE', // Leader ↔ Membre
  DIRECT = 'DIRECT', // 1 à 1
}
```

#### Création automatique de conversations

Quand un bénévole est assigné à une équipe :

```typescript
// 1. Conversation de groupe (toute l'équipe)
const groupConv = await prisma.conversation.create({
  data: {
    type: 'TEAM_GROUP',
    editionId,
    teamId,
    participants: {
      create: teamMembers.map((m) => ({ userId: m.userId })),
    },
  },
})

// 2. Conversations privées (leader ↔ chaque membre)
for (const member of nonLeaders) {
  await prisma.conversation.create({
    data: {
      type: 'TEAM_LEADER_PRIVATE',
      editionId,
      teamId,
      participants: {
        create: [{ userId: member.userId }, ...leaders.map((l) => ({ userId: l.userId }))],
      },
    },
  })
}
```

#### Envoi de message

```typescript
// POST /api/messenger/conversations/:id/messages
export default defineEventHandler(async (event) => {
  const conversationId = getRouterParam(event, 'id')
  const { content } = await readBody(event)
  const userId = event.context.user.id

  // Vérifier que l'utilisateur est participant
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId,
      leftAt: null,
    },
  })

  if (!participant) {
    throw createError({ statusCode: 403 })
  }

  // Créer message
  const message = await prisma.message.create({
    data: {
      conversationId,
      authorId: userId,
      content,
    },
  })

  // Envoyer notifications push aux autres participants
  await notifyConversationParticipants(conversationId, userId, message)

  return { message }
})
```

---

## 8. Environnement et configuration

### 8.1 Variables d'environnement

#### Fichier `.env` (exemple complet)

```env
# ===== DATABASE =====
DATABASE_URL="mysql://convention_user:password@localhost:3306/convention_db"

# ===== AUTHENTICATION =====
# OBLIGATOIRE en production (32+ caractères)
NUXT_SESSION_PASSWORD="super-secret-session-password-at-least-32-chars"

# ===== EMAIL =====
SEND_EMAILS=false                    # true = envoi réel, false = simulation
SMTP_USER="your-email@gmail.com"     # Requis si SEND_EMAILS=true
SMTP_PASS="app-specific-password"    # Mot de passe application Gmail

# ===== RECAPTCHA =====
NUXT_PUBLIC_RECAPTCHA_SITE_KEY="6Lc..."  # Clé publique
NUXT_RECAPTCHA_SECRET_KEY="6Lc..."       # Clé secrète
NUXT_RECAPTCHA_MIN_SCORE="0.5"           # Score minimum v3 (0-1)
NUXT_RECAPTCHA_DEV_BYPASS="true"         # Bypass en dev

# ===== PUSH NOTIFICATIONS =====
NUXT_PUBLIC_VAPID_PUBLIC_KEY="BN..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:admin@juggling-convention.com"

# ===== AI PROVIDERS =====
AI_PROVIDER="anthropic"  # anthropic | ollama | lmstudio

# Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-..."

# Ollama (local)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llava"

# LM Studio (local)
LMSTUDIO_BASE_URL="http://localhost:1234"
LMSTUDIO_MODEL="auto"

# ===== SITE =====
NUXT_PUBLIC_SITE_URL="http://localhost:3000"

# ===== SECURITY =====
# Pour chiffrement données sensibles (HelloAsso client secrets)
ENCRYPTION_SECRET="change-this-to-a-strong-random-secret-key-min-32-chars"
ENCRYPTION_SALT="change-this-salt-to-random-value"

# ===== HELLOASSO =====
HELLOASSO_API_URL="https://api.helloasso.com"  # Prod
# HELLOASSO_API_URL="https://www.helloasso-sandbox.com"  # Sandbox

# ===== DOCKER =====
MYSQL_ROOT_PASSWORD="rootpassword"
MYSQL_DATABASE="convention_db"
MYSQL_USER="convention_user"
MYSQL_PASSWORD="convention_password"

# ===== CRON =====
ENABLE_CRON="true"  # Activer tâches planifiées

# ===== LOGS =====
PRISMA_LOG_LEVEL="error,warn"  # error,warn,info,query
```

### 8.2 Configuration Docker

#### docker-compose.dev.yml

**Services** :

- **database** : MySQL 8.0
  - Port : 3306
  - Volume : `mysql_data`
  - Health check : `mysqladmin ping`

- **app** : Nuxt dev server
  - Port : 3000 (app), 24678 (HMR)
  - Hot reload : Polling activé (Windows)
  - Volumes : Code source + node_modules
  - Command : `npm run dev`

**Volumes** :

```yaml
volumes:
  mysql_data: # Données MySQL persistantes
  uploads_data: # Fichiers uploadés
  node_modules: # Dépendances npm (partagées hôte/conteneur)
```

**Network** :

- Default bridge network
- Communication inter-services par nom

#### docker-compose.test.yml

**Différences** :

- Port MySQL : **3308** (évite conflit avec dev)
- Pas de volume node_modules (build fresh)
- Commande : `npm run test:db:run`

#### docker-compose.release.yml

**Optimisations production** :

- Multi-stage build (dependencies → builder → runtime)
- Image finale : `node:22-slim` (minimale)
- Compression assets : Brotli + Gzip
- Restart policy : `unless-stopped`
- External network : `proxy-network` (pour reverse proxy)

**Variables d'env requises** :

- `NUXT_SESSION_PASSWORD` (obligatoire)
- `DATABASE_URL`
- Autres selon fonctionnalités activées

### 8.3 Installation et setup

#### Développement local (sans Docker)

```bash
# 1. Cloner le repo
git clone <url>
cd convention-de-jonglerie

# 2. Installer dépendances
npm install

# 3. Configurer .env
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Créer base de données MySQL
mysql -u root -p
CREATE DATABASE convention_db;
CREATE USER 'convention_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON convention_db.* TO 'convention_user'@'localhost';

# 5. Appliquer migrations Prisma
npx prisma migrate dev

# 6. Générer client Prisma
npx prisma generate

# 7. (Optionnel) Peupler DB avec données de test
npm run db:seed:dev

# 8. Lancer serveur dev
npm run dev
```

#### Développement avec Docker

```bash
# 1. Cloner le repo
git clone <url>
cd convention-de-jonglerie

# 2. Configurer .env
cp .env.example .env

# 3. Installer dépendances (sur hôte pour IDE)
npm install

# 4. Lancer Docker Compose
npm run docker:dev

# 5. Voir les logs
npm run docker:dev:logs

# 6. Accéder à l'app
# → http://localhost:3000
```

**Commandes utiles** :

```bash
# Ouvrir shell dans conteneur
npm run docker:dev:exec

# Exécuter migrations
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev

# Peupler DB
docker compose -f docker-compose.dev.yml exec app npm run db:seed:dev

# Arrêter services
npm run docker:dev:down
```

#### Production (Docker)

```bash
# 1. Configurer .env.production
cp .env.portainer.example .env.production
# Éditer avec valeurs production

# 2. Build image
docker build -t convention-app:latest .

# 3. Lancer avec docker-compose
docker compose -f docker-compose.release.yml up -d

# 4. Appliquer migrations
docker compose -f docker-compose.release.yml exec app npx prisma migrate deploy

# 5. Vérifier logs
docker compose -f docker-compose.release.yml logs -f app
```

### 8.4 Scripts disponibles

#### Développement

```bash
npm run dev              # Serveur dev Nuxt
npm run build            # Build production
npm run preview          # Preview build local
```

#### Tests

```bash
npm run test             # Tests unit (watch mode)
npm run test:unit:run    # Tests unit (run once)
npm run test:nuxt:run    # Tests Nuxt (composants + API)
npm run test:db:run      # Tests intégration DB
npm run test:all         # Tous les tests
```

#### Linting & Formatting

```bash
npm run lint             # Vérifier ESLint
npm run lint:fix         # Fix auto + ESLint
npm run format           # Prettier write
npm run format:check     # Prettier check
```

#### i18n

```bash
npm run check-i18n            # Vérifier clés
npm run check-translations    # Comparer traductions
npm run i18n:mark-todo        # Marquer clés [TODO]
```

#### Base de données

```bash
npm run db:seed:dev           # Peupler DB dev
npm run db:seed:password      # Afficher mots de passe seed
npm run db:reset:dev          # Reset DB dev
npm run db:clean-tokens       # Nettoyer tokens expirés
```

#### Admin

```bash
npm run admin:add             # Ajouter admin global
npm run admin:remove          # Retirer admin global
npm run admin:list            # Lister admins
```

#### Utilitaires

```bash
npm run geocode               # Géocoder adresses éditions
npm run help                  # Aide CLI
npm run kill-servers          # Tuer serveurs orphelins
```

#### Docker

```bash
npm run docker:dev            # Dev (build + up)
npm run docker:dev:detached   # Dev en background
npm run docker:dev:down       # Arrêter dev
npm run docker:dev:logs       # Voir logs app
npm run docker:dev:exec       # Shell dans conteneur

npm run docker:release:up     # Production up
npm run docker:release:down   # Production down

npm run docker:test           # Tests all (Docker)
npm run docker:test:unit      # Tests unit (Docker)
npm run docker:test:integration  # Tests integration (Docker)
npm run docker:test:clean     # Nettoyer volumes test
```

### 8.5 Workflow de développement

#### Workflow typique

```bash
# 1. Créer branche feature
git checkout -b feature/messaging-system

# 2. Développer en local
npm run dev
# Coder...

# 3. Modifier schéma DB si nécessaire
# Éditer prisma/schema.prisma
npx prisma migrate dev --name add_messaging_system

# 4. Linter + formatter
npm run lint:fix
npm run format

# 5. Écrire tests
# test/nuxt/server/api/messenger/...

# 6. Lancer tests
npm run test:all

# 7. Commit
git add .
git commit -m "feat(messenger): add messaging system"

# 8. Push
git push origin feature/messaging-system

# 9. Créer Pull Request
# GitHub → New Pull Request
```

#### Workflow traduction

```bash
# 1. Ajouter clés en français
# i18n/locales/fr/gestion.json
{
  "messenger": {
    "new_message": "Nouveau message",
    "send": "Envoyer"
  }
}

# 2. Vérifier clés manquantes
npm run check-i18n
# → Détecte clés manquantes dans autres langues

# 3. Les autres langues reçoivent automatiquement [TODO]
# i18n/locales/en/gestion.json
{
  "messenger": {
    "new_message": "[TODO] Nouveau message",
    "send": "[TODO] Envoyer"
  }
}

# 4. Traduire avec commande dédiée
npm run i18n:add
# Ou manuellement éditer les fichiers

# 5. Vérifier cohérence
npm run check-translations
```

---

## 9. Diagramme d'architecture

### 9.1 Architecture système global

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         JUGGLING CONVENTION PLATFORM                        │
└────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Browser    │  │    Mobile    │  │     PWA      │  │   Tablet     │  │
│  │  (Desktop)   │  │   (Safari)   │  │ (Standalone) │  │    (iPad)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │                  │          │
│         └──────────────────┴──────────────────┴──────────────────┘          │
│                                    │                                        │
│                         HTTPS / HTTP/2 / WebSocket                         │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NUXT APPLICATION (SSR)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        FRONTEND (app/)                                │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                       │ │
│  │  Vue 3.5.17 + TypeScript 5.8.3 + Nuxt UI 4.0                        │ │
│  │                                                                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │ │
│  │  │   Pages     │  │ Components  │  │  Layouts    │  │  Plugins   │ │ │
│  │  │ (Routing)   │  │   (Vue)     │  │  (Default,  │  │  (i18n,    │ │ │
│  │  │             │  │             │  │   Admin)    │  │   etc.)    │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │ │
│  │  │ Composables │  │   Stores    │  │ Middleware  │                 │ │
│  │  │  (useAuth,  │  │   (Pinia)   │  │ (auth.ts,   │                 │ │
│  │  │   useI18n)  │  │             │  │  admin.ts)  │                 │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      BACKEND (server/)                                │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                       │ │
│  │  Nitro Server Engine + h3 HTTP Framework                            │ │
│  │                                                                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │ │
│  │  │  API Routes │  │  Middleware │  │    Utils    │  │   Tasks    │ │ │
│  │  │ (/api/...)  │  │   (auth,    │  │ (validators,│  │  (cron)    │ │ │
│  │  │             │  │   cache)    │  │  emails)    │  │            │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │ │
│  │                                                                       │ │
│  │  ┌───────────────────────────────────────────────────────────────┐  │ │
│  │  │                    API ENDPOINTS                              │  │ │
│  │  ├───────────────────────────────────────────────────────────────┤  │ │
│  │  │  /api/auth          → Login, Register, Verify                │  │ │
│  │  │  /api/conventions   → CRUD Conventions                       │  │ │
│  │  │  /api/editions      → CRUD Éditions                          │  │ │
│  │  │  /api/volunteers    → Gestion bénévoles                      │  │ │
│  │  │  /api/ticketing     → Billetterie                            │  │ │
│  │  │  /api/messenger     → Messagerie                             │  │ │
│  │  │  /api/workshops     → Ateliers                               │  │ │
│  │  │  /api/carpool       → Covoiturage                            │  │ │
│  │  │  /api/notifications → Notifications                          │  │ │
│  │  │  /api/admin         → Panel admin                            │  │ │
│  │  └───────────────────────────────────────────────────────────────┘  │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA ACCESS LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      Prisma ORM 6.18.0                                │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                       │ │
│  │  • Type-safe database client                                         │ │
│  │  • Auto-generated types from schema                                  │ │
│  │  • Query builder                                                     │ │
│  │  • Migrations management                                             │ │
│  │  • Connection pooling                                                │ │
│  │                                                                       │ │
│  │  Models: User, Convention, Edition, Volunteer, Order, Message...    │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                          MySQL 8.0                                    │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                       │ │
│  │  Tables (50+):                                                       │ │
│  │  ├─ User (auth, profile)                                             │ │
│  │  ├─ Convention (recurring events)                                    │ │
│  │  ├─ Edition (annual instances)                                       │ │
│  │  ├─ ConventionOrganizer (permissions)                                │ │
│  │  ├─ EditionVolunteerApplication                                      │ │
│  │  ├─ VolunteerTeam, VolunteerTimeSlot                                 │ │
│  │  ├─ Order, OrderItem (ticketing)                                     │ │
│  │  ├─ Workshop, WorkshopFavorite                                       │ │
│  │  ├─ Conversation, Message                                            │ │
│  │  ├─ Notification, PushSubscription                                   │ │
│  │  └─ ... (45+ autres tables)                                          │ │
│  │                                                                       │ │
│  │  Indexes: Optimized for frequent queries                            │ │
│  │  Constraints: Foreign keys, unique constraints                      │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL INTEGRATIONS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  HelloAsso   │  │   Google     │  │   Nominatim  │  │  Anthropic   │  │
│  │  (Ticketing) │  │   (OAuth)    │  │  (Geocoding) │  │  Claude AI   │  │
│  │              │  │              │  │              │  │              │  │
│  │  Webhooks    │  │  OAuth 2.0   │  │  REST API    │  │  SDK         │  │
│  │  HMAC Auth   │  │              │  │              │  │  Vision API  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │   Facebook   │  │   Nodemailer │  │   Web Push   │                    │
│  │   (OAuth)    │  │   (SMTP)     │  │   (VAPID)    │                    │
│  │              │  │              │  │              │                    │
│  │  OAuth 2.0   │  │  Gmail SMTP  │  │  Notifications│                    │
│  └──────────────┘  └──────────────┘  └──────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Architecture des fichiers

```
convention-de-jonglerie/
│
├─── Frontend (app/)
│    ├─ pages/             → File-based routing
│    ├─ components/        → Vue components
│    ├─ composables/       → Reusable logic
│    ├─ layouts/           → Page layouts
│    ├─ stores/            → Pinia state
│    ├─ middleware/        → Nav guards
│    └─ assets/            → Static assets
│
├─── Backend (server/)
│    ├─ api/               → REST endpoints
│    │  ├─ auth/
│    │  ├─ conventions/
│    │  ├─ editions/
│    │  ├─ volunteers/
│    │  └─ ...
│    ├─ middleware/        → Server middleware
│    ├─ utils/             → Server utilities
│    ├─ tasks/             → Cron jobs
│    └─ emails/            → Email templates
│
├─── Database (prisma/)
│    ├─ schema.prisma      → DB schema (50+ models)
│    └─ migrations/        → Migration history
│
├─── i18n (i18n/)
│    ├─ i18n.config.ts
│    └─ locales/           → 13 languages
│       ├─ fr/
│       ├─ en/
│       └─ ...
│
├─── Tests (test/)
│    ├─ unit/
│    ├─ nuxt/
│    ├─ integration/
│    └─ e2e/
│
├─── Scripts (scripts/)
│    ├─ translation/
│    ├─ seed-dev.ts
│    └─ ...
│
├─── Docs (docs/)
│    ├─ system/
│    ├─ volunteers/
│    └─ ...
│
├─── Config (root)
│    ├─ nuxt.config.ts     → Nuxt config
│    ├─ tsconfig.json      → TypeScript
│    ├─ package.json       → Dependencies
│    ├─ .env.example       → Env template
│    ├─ docker-compose.*.yml
│    └─ Dockerfile
│
└─── Build output
     ├─ .nuxt/             → Dev build
     └─ .output/           → Prod build
```

### 9.3 Flow de données complet

```
┌─────────────────────────────────────────────────────────────────┐
│                   USER INTERACTION FLOW                         │
└─────────────────────────────────────────────────────────────────┘

1. User clicks "Create Edition"
   │
   ├─→ app/pages/conventions/[id]/editions/add.vue
   │   └─→ Form validation (client-side)
   │       └─→ Submit via $fetch()
   │
2. HTTP POST /api/editions
   │
   ├─→ server/middleware/auth.ts
   │   └─→ Verify session cookie
   │       └─→ Decrypt user session
   │           └─→ Set event.context.user
   │
3. server/api/editions/index.post.ts
   │
   ├─→ Validate body with Zod schema
   ├─→ Check permissions (canAddEdition)
   ├─→ prisma.edition.create()
   │   └─→ MySQL INSERT
   │       └─→ Return edition with ID
   ├─→ Trigger geocoding (async)
   └─→ Return response
   │
4. Frontend receives response
   │
   ├─→ Update Pinia store (editionsStore)
   ├─→ Navigate to edition page
   ├─→ Show success toast
   └─→ User sees new edition
```

### 9.4 Architecture de sécurité

```
┌────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Layer 1: Network                                              │
│  ├─ HTTPS/TLS (production)                                     │
│  ├─ CORS configuration                                         │
│  └─ Rate limiting (to implement)                               │
│                                                                │
│  Layer 2: Authentication                                       │
│  ├─ Sealed session cookies (nuxt-auth-utils)                   │
│  ├─ Password hashing (bcrypt, 10 rounds)                       │
│  ├─ Email verification (6-digit code)                          │
│  ├─ OAuth providers (Google, Facebook)                         │
│  └─ Session expiration (30 days default)                       │
│                                                                │
│  Layer 3: Authorization                                        │
│  ├─ Granular permissions (6 convention rights)                 │
│  ├─ Edition-specific permissions                               │
│  ├─ Middleware guards (server + client)                        │
│  └─ API endpoint protection                                    │
│                                                                │
│  Layer 4: Input Validation                                     │
│  ├─ Zod schemas (all API endpoints)                            │
│  ├─ Type safety (TypeScript)                                   │
│  ├─ reCAPTCHA v3 (registration, forms)                         │
│  └─ XSS prevention (escapeHtml: false but sanitized)           │
│                                                                │
│  Layer 5: Data Protection                                      │
│  ├─ Encryption (sensitive data like HelloAsso secrets)         │
│  ├─ HMAC verification (webhooks)                               │
│  ├─ SQL injection prevention (Prisma parameterized queries)    │
│  └─ CSRF protection (SameSite cookies)                         │
│                                                                │
│  Layer 6: Audit & Monitoring                                   │
│  ├─ Permission history (OrganizerPermissionHistory)            │
│  ├─ Error logging (ApiErrorLog)                                │
│  └─ Activity tracking (lastLoginAt, updatedAt)                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 10. Insights et recommandations

### 10.1 Points forts du projet

#### ✅ Architecture solide

- **Full-Stack moderne** : Nuxt 4 avec SSR, API routes intégrées
- **Type-safety complet** : TypeScript + Prisma + Zod à tous les niveaux
- **Convention over Configuration** : File-based routing, auto-imports
- **Séparation des préoccupations** : Frontend/Backend/Data bien séparés

#### ✅ Qualité du code

- **Tests complets** : 1235+ tests (unit, integration, e2e)
- **Linting strict** : ESLint + Prettier configurés
- **Standards** : Conventional commits, semantic versioning
- **Documentation** : README détaillés, commentaires inline

#### ✅ Fonctionnalités avancées

- **Système de permissions granulaires** : Très flexible, pas de rôles rigides
- **Internationalisation** : 13 langues avec lazy loading
- **Messagerie intégrée** : Conversations de groupe et privées
- **Billetterie** : Intégration HelloAsso complète
- **Planning bénévoles** : Gestion créneaux horaires avec confirmations
- **Notifications multi-canal** : In-app, push, email

#### ✅ DevOps & Déploiement

- **Dockerisé** : Environnements dev, test, prod isolés
- **CI/CD** : GitHub Actions pour tests automatisés
- **Hot reload** : Fonctionne même sous Docker Windows
- **Scripts utilitaires** : Gestion admin, i18n, geocoding

### 10.2 Axes d'amélioration

#### 🔸 Performance

**Recommandations** :

1. **Database Indexing** :

   ```sql
   -- Ajouter indexes sur colonnes fréquemment recherchées
   CREATE INDEX idx_edition_dates ON Edition(startDate, endDate);
   CREATE INDEX idx_edition_country ON Edition(country);
   CREATE INDEX idx_volunteer_status ON EditionVolunteerApplication(status);
   ```

2. **Caching Redis** :
   - Implémenter cache Redis pour requêtes fréquentes (liste conventions, stats)
   - TTL adaptatif selon fréquence de changement

3. **Pagination améliorée** :
   - Cursor-based pagination pour grandes listes
   - Lazy loading composants lourds (FullCalendar)

4. **Image optimization** :
   - WebP format par défaut
   - Responsive images avec srcset
   - CDN pour assets statiques

#### 🔸 Sécurité

**Recommandations** :

1. **Rate Limiting** :

   ```typescript
   // server/middleware/rate-limit.ts
   import { defineEventHandler, createError } from 'h3'
   import { RateLimiterMemory } from 'rate-limiter-flexible'

   const rateLimiter = new RateLimiterMemory({
     points: 10, // 10 requests
     duration: 60, // per 60 seconds
   })

   export default defineEventHandler(async (event) => {
     const ip = getRequestIP(event)
     try {
       await rateLimiter.consume(ip)
     } catch {
       throw createError({ statusCode: 429, message: 'Too Many Requests' })
     }
   })
   ```

2. **CSP Headers** :

   ```typescript
   // nuxt.config.ts
   nitro: {
     routeRules: {
       '/**': {
         headers: {
           'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; ..."
         }
       }
     }
   }
   ```

3. **Audit de dépendances** :

   ```bash
   npm audit
   npm audit fix
   ```

4. **Secrets management** :
   - Utiliser HashiCorp Vault ou AWS Secrets Manager en prod
   - Rotation automatique des secrets

#### 🔸 Scalabilité

**Recommandations** :

1. **Database Sharding** (si > 1M users) :
   - Sharding par pays ou région
   - Read replicas pour requêtes lourdes

2. **Queue système** (RabbitMQ, Bull) :
   - Jobs asynchrones (emails, geocoding, notifications)
   - Retry logic pour échecs temporaires

3. **Microservices** (si croissance massive) :
   - Service dédié billetterie
   - Service dédié messagerie
   - Service dédié notifications

#### 🔸 Observabilité

**Recommandations** :

1. **Monitoring** :
   - Prometheus + Grafana pour métriques
   - Sentry pour error tracking
   - New Relic ou DataDog pour APM

2. **Logging structuré** :

   ```typescript
   // server/utils/logger.ts
   import pino from 'pino'

   export const logger = pino({
     level: process.env.LOG_LEVEL || 'info',
     formatters: {
       level: (label) => ({ level: label }),
     },
   })
   ```

3. **Health checks** :

   ```typescript
   // server/api/health.get.ts
   export default defineEventHandler(async () => {
     const dbStatus = await checkDatabaseConnection()
     const redisStatus = await checkRedisConnection()

     return {
       status: dbStatus && redisStatus ? 'healthy' : 'unhealthy',
       timestamp: new Date().toISOString(),
       services: {
         database: dbStatus ? 'up' : 'down',
         redis: redisStatus ? 'up' : 'down',
       },
     }
   })
   ```

#### 🔸 UX/UI

**Recommandations** :

1. **Skeleton loaders** :
   - Afficher placeholders pendant chargement
   - Éviter flash de contenu

2. **Offline mode** :
   - Service Worker pour cache offline
   - Sync en arrière-plan quand connexion revient

3. **Accessibilité** (WCAG 2.1) :
   - Audit avec axe-core ou Lighthouse
   - Support clavier complet
   - ARIA labels appropriés

4. **Mobile-first** :
   - Touch gestures (swipe, long-press)
   - Bottom navigation sur mobile

### 10.3 Opportunités futures

#### 🚀 Fonctionnalités potentielles

1. **Matching algorithmique** :
   - Recommandation de conventions selon profil utilisateur
   - Matching bénévoles/compétences requises

2. **Gamification** :
   - Badges pour bénévoles actifs
   - Leaderboard par convention
   - Achievements déblocables

3. **Intégration calendrier** :
   - Export iCal (.ics)
   - Sync Google Calendar
   - Rappels automatiques

4. **Réseau social** :
   - Profils publics jongleurs
   - Système d'amis
   - Feed d'activités

5. **Marketplace** :
   - Vente de matériel de jongle
   - Annonces hébergement
   - Services entre jongleurs

6. **Analytics avancées** :
   - Dashboard organisateur avec KPIs
   - Prédictions affluence (ML)
   - A/B testing intégré

### 10.4 Métriques de qualité

#### Code Quality

| Métrique              | Valeur actuelle | Cible  |
| --------------------- | --------------- | ------ |
| **Test coverage**     | ~70%            | 80%+   |
| **Tests passing**     | 1235/1235       | 100%   |
| **TypeScript strict** | ✅ Oui          | ✅     |
| **ESLint errors**     | 0               | 0      |
| **Bundle size**       | ~800KB          | <500KB |
| **Lighthouse Score**  | -               | 90+    |

#### Performance (à mesurer)

| Métrique | Cible  |
| -------- | ------ |
| **TTFB** | <200ms |
| **FCP**  | <1.8s  |
| **LCP**  | <2.5s  |
| **TTI**  | <3.8s  |
| **CLS**  | <0.1   |

#### Sécurité

| Aspect            | Status                |
| ----------------- | --------------------- |
| **HTTPS**         | ✅ Production         |
| **HSTS**          | ⚠️ À implémenter      |
| **CSP**           | ⚠️ À implémenter      |
| **Rate limiting** | ❌ À implémenter      |
| **2FA**           | ❌ Opportunité future |

### 10.5 Checklist pré-production

#### Avant déploiement production

- [ ] Variables d'env toutes définies (`.env.production`)
- [ ] `NUXT_SESSION_PASSWORD` robuste (32+ chars random)
- [ ] Migrations DB appliquées (`npx prisma migrate deploy`)
- [ ] Seeds admin créés (`npm run admin:add`)
- [ ] HTTPS configuré (certificat SSL valide)
- [ ] Domain DNS pointé correctement
- [ ] Reverse proxy configuré (Nginx/Traefik)
- [ ] Backups DB automatisés (daily)
- [ ] Monitoring activé (Sentry, etc.)
- [ ] Logs centralisés
- [ ] Rate limiting activé
- [ ] CDN configuré pour assets
- [ ] SEO vérifié (sitemap.xml, robots.txt)
- [ ] Analytics configuré (Google Analytics, Plausible)
- [ ] GDPR conforme (banner cookies, privacy policy)
- [ ] Tests e2e passés
- [ ] Performance test (load testing avec k6 ou Artillery)
- [ ] Security audit (npm audit, OWASP ZAP)

### 10.6 Conclusion

**Convention de Jonglerie** est un projet **très bien architecturé** qui démontre :

✅ **Maîtrise des technologies modernes** (Nuxt 4, Prisma, TypeScript)
✅ **Architecture scalable** (permissions granulaires, modular design)
✅ **Code quality** (tests, linting, documentation)
✅ **DevOps mature** (Docker, CI/CD, multi-env)

**Points d'excellence** :

- Système de permissions le plus flexible possible (granular rights)
- Internationalisation professionnelle (13 langues)
- Stack full-stack cohérente et moderne
- Tests automatisés complets

**Opportunités d'amélioration** :

- Performance (caching Redis, CDN)
- Sécurité (rate limiting, CSP headers)
- Observabilité (monitoring, structured logging)

**Prêt pour production** : Oui, avec implémentation des recommandations sécurité critiques.

---

## Métadonnées du document

**Auteur** : Claude Code (Anthropic)
**Date de création** : 17 Novembre 2025
**Dernière mise à jour** : 17 Novembre 2025
**Version du projet analysé** : Nuxt 4.2.0
**Lignes de code analysées** : ~50,000+
**Fichiers analysés** : 2,968 fichiers de code

---

**Fin de l'analyse complète**

Pour toute question ou clarification sur cette documentation, consultez les fichiers sources ou les mainteneurs du projet.
