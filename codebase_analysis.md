# Analyse Complète du Codebase - Convention de Jonglerie

## Table des Matières

1. [Vue d'ensemble du Projet](#vue-densemble-du-projet)
2. [Stack Technique](#stack-technique)
3. [Architecture Globale](#architecture-globale)
4. [Structure des Répertoires](#structure-des-répertoires)
5. [Schéma de Base de Données](#schéma-de-base-de-données)
6. [Endpoints API](#endpoints-api)
7. [Système d'Authentification](#système-dauthentification)
8. [Système de Permissions](#système-de-permissions)
9. [Système de Notifications](#système-de-notifications)
10. [Internationalisation](#internationalisation)
11. [Tests](#tests)
12. [Docker et Déploiement](#docker-et-déploiement)
13. [Intégrations Externes](#intégrations-externes)
14. [Recommandations](#recommandations)

---

## Vue d'ensemble du Projet

**Type:** Application web full-stack pour la gestion et découverte de conventions de jonglerie

**Objectif:** Plateforme collaborative permettant aux jongleurs et organisateurs d'événements de :
- Consulter et découvrir des conventions
- Gérer des éditions d'événements
- Gérer les bénévoles, artistes, ateliers
- Système de billetterie intégré ou externe
- Covoiturage, objets trouvés, messagerie
- Notifications multi-canal (in-app, push, email)

**Version Node:** >= 22 < 26

---

## Stack Technique

### Frontend
- **Nuxt.js** 4.2.0 - Framework Vue.js universel
- **Vue.js** 3.5.17 - Framework JavaScript réactif
- **Nuxt UI** 4.0.0 - Composants UI avec Tailwind CSS
- **Pinia** 3.0.3 - Gestion d'état
- **TypeScript** 5.8.3
- **VueUse** 13.6.0 - Composables Vue
- **Nuxt i18n** 10.0.3 - 13 langues supportées

### Backend
- **Nitro** (intégré Nuxt) - Moteur serveur
- **Prisma** 7.0.0 - ORM
- **MySQL/MariaDB** - Base de données
- **nuxt-auth-utils** 0.5.23 - Sessions scellées
- **bcryptjs** 3.0.2 - Hachage mots de passe

### Visualisation & UI
- **FullCalendar** 6.1.15+ - Calendrier interactif
- **Chart.js** 4.5.1 - Graphiques
- **html5-qrcode** 2.3.8 - Scanner QR
- **jspdf** 3.0.3 - Génération PDF

### Communication
- **Firebase Cloud Messaging** - Push notifications
- **Server-Sent Events** - Notifications temps réel
- **Nodemailer** 7.0.5 - Emails
- **Vue Email** 0.0.21 - Templates email

### Tests
- **Vitest** 3.2.4 - 4 projets de test
- **@nuxt/test-utils** 3.19.2
- **happy-dom** 18.0.1
- **@testing-library/vue** 8.1.0

### Autres
- **Anthropic Claude API** - Analyse IA d'images
- **Luxon** 3.5.0 - Manipulation dates
- **Zod** 4.1.9 - Validation schémas

---

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Vue 3 Pages  │  │ Composables  │  │ Pinia Stores │          │
│  │ Nuxt UI      │  │ useAuth      │  │ auth.ts      │          │
│  │ Components   │  │ useNotif...  │  │ notifications│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                  │
│                            │                                     │
│                    ┌───────▼────────┐                           │
│                    │ SSE Stream     │◄────┐                     │
│                    │ FCM Push       │     │                     │
│                    └────────────────┘     │                     │
└─────────────────────────────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   NUXT 4 SSR    │
                    └────────┬────────┘
                             │
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Nitro)                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Endpoints (314)                    │  │
│  │  /api/auth/*  /api/conventions/*  /api/editions/*        │  │
│  │  /api/admin/*  /api/notifications/*  /api/messenger/*    │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐  │
│  │              Server Utils & Services                      │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐      │  │
│  │  │ Permissions │ │ Notification │ │ Email Service│      │  │
│  │  │ Helpers     │ │ Service      │ │              │      │  │
│  │  └─────────────┘ └──────────────┘ └──────────────┘      │  │
│  │  ┌─────────────┐ ┌──────────────┐                        │  │
│  │  │ SSE Stream  │ │ Firebase     │                        │  │
│  │  │ Manager     │ │ Admin        │                        │  │
│  │  └─────────────┘ └──────────────┘                        │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐  │
│  │                  Prisma ORM                               │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                ┌─────────▼──────────┐
                │  MySQL/MariaDB     │
                │  50+ Tables        │
                └────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ HelloAsso    │  │ Firebase FCM │  │ Anthropic AI │          │
│  │ Ticketing    │  │ Push Notifs  │  │ Image OCR    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Structure des Répertoires

```
convention-de-jonglerie/
├── app/                          # Frontend Nuxt
│   ├── assets/                   # CSS, fonts (22 fichiers)
│   ├── components/               # Composants Vue réutilisables
│   │   ├── edition/              # Composants spécifiques éditions
│   │   ├── admin/                # Composants admin
│   │   └── ui/                   # Composants UI génériques
│   ├── composables/              # Hooks Vue (37 composables)
│   │   ├── useAuth.ts
│   │   ├── useNotificationStream.ts
│   │   ├── useFirebaseMessaging.ts
│   │   ├── useMessenger.ts
│   │   └── ...
│   ├── layouts/                  # Layouts Nuxt (5 layouts)
│   ├── middleware/               # Middlewares de route (2 middlewares)
│   ├── pages/                    # Pages Vue (57 pages)
│   │   ├── admin/                # Pages admin
│   │   ├── gestion/              # Pages gestion événements
│   │   ├── my-editions/          # Pages utilisateur
│   │   └── ...
│   ├── plugins/                  # Plugins Nuxt (1 plugin)
│   ├── stores/                   # Stores Pinia (5 stores)
│   │   ├── auth.ts
│   │   ├── notifications.ts
│   │   ├── editions.ts
│   │   ├── favoritesEditions.ts
│   │   └── impersonation.ts
│   └── utils/                    # Utilitaires client (6 fichiers)
│
├── server/                       # Backend Nitro
│   ├── api/                      # Endpoints API (314 fichiers)
│   │   ├── admin/                # Routes admin
│   │   ├── auth/                 # Authentification
│   │   ├── conventions/          # CRUD conventions
│   │   ├── editions/             # CRUD éditions + ressources
│   │   ├── notifications/        # Système notifications
│   │   ├── messenger/            # Messagerie
│   │   ├── carpool-*/            # Covoiturage
│   │   └── ...
│   ├── middleware/               # Middlewares serveur (1 middleware)
│   ├── routes/                   # Routes serveur SSE (1 route)
│   ├── tasks/                    # Tâches Nitro cron (6 tâches)
│   └── utils/                    # Utilitaires serveur (56 fichiers)
│       ├── notification-service.ts
│       ├── notification-stream-manager.ts
│       ├── firebase-admin.ts
│       ├── emailService.ts
│       ├── prisma.ts
│       ├── permissions/          # Helpers permissions
│       └── editions/ticketing/   # Logique billetterie
│
├── prisma/                       # Prisma ORM
│   ├── schema.prisma             # Schéma DB (50+ modèles)
│   ├── migrations/               # Migrations DB
│   └── seed.ts                   # Données de seed
│
├── i18n/                         # Internationalisation
│   ├── i18n.config.ts
│   └── locales/                  # 13 langues × 6 domaines
│       ├── en/, fr/, de/, es/...
│       └── {lang}/{domain}.json
│
├── docs/                         # Documentation (37 fichiers)
│   ├── README.md
│   ├── system/                   # Documentation système
│   ├── ticketing/                # Documentation billetterie
│   ├── volunteers/               # Documentation bénévoles
│   └── ...
│
├── scripts/                      # Scripts Node.js (25 scripts)
│   ├── translation/              # Scripts i18n
│   ├── seed-dev.ts               # Seed développement
│   └── ...
│
├── tests/                        # Tests (17 fichiers)
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── public/                       # Assets statiques
│   ├── logos/
│   ├── favicons/
│   └── ...
│
├── docker-compose.*.yml          # Configurations Docker (7 fichiers)
├── nuxt.config.ts                # Configuration Nuxt
├── vitest.config.ts              # Configuration tests
├── tsconfig.json                 # Configuration TypeScript
├── package.json                  # Dépendances et scripts
└── .env                          # Variables d'environnement
```

---

## Schéma de Base de Données

### Modèles Principaux (50+ tables)

#### Utilisateurs & Auth
- **User** - Utilisateurs (email hashé, langue préférée, providers auth)
- **AuthSession** - Sessions authentification
- **PasswordResetToken** - Tokens reset mot de passe
- **VerificationToken** - Tokens vérification email

#### Conventions & Éditions
- **Convention** - Conventions de jonglerie
- **Edition** - Éditions annuelles
- **ConventionOrganizer** - Organisateurs avec permissions granulaires
- **EditionOrganizerPermission** - Surcharges permissions par édition

#### Billetterie
- **TicketingTier** - Paliers tarifaires
- **TicketingOption** - Options de billetterie
- **TicketingOrder** - Commandes
- **ExternalTicketing** - Billetterie externe
- **HelloAssoConfig** - Configuration HelloAsso

#### Bénévoles
- **EditionVolunteerApplication** - Candidatures
- **VolunteerTeam** - Équipes
- **VolunteerTimeSlot** - Créneaux horaires
- **VolunteerAssignment** - Affectations
- **VolunteerMeal** - Repas bénévoles

#### Artistes & Spectacles
- **EditionArtist** - Artistes invités
- **Show** - Spectacles
- **ShowArtist** - Relation artistes/spectacles
- **ArtistMealSelection** - Repas artistes

#### Ateliers
- **Workshop** - Ateliers
- **WorkshopLocation** - Lieux
- **WorkshopFavorite** - Favoris utilisateurs

#### Notifications & Messagerie
- **Notification** - Notifications persistées
- **FcmToken** - Tokens Firebase
- **Conversation** - Conversations
- **Message** - Messages
- **ConversationParticipant** - Participants

#### Autres Fonctionnalités
- **CarpoolOffer** / **CarpoolRequest** - Covoiturage
- **LostFoundItem** - Objets trouvés
- **ApiErrorLog** - Logs erreurs
- **Feedback** - Retours utilisateurs
- **EditionImage** - Images éditions

### Relations Clés

```
Convention 1──N Edition
    │
    └──N ConventionOrganizer
           │
           └──N EditionOrganizerPermission

Edition 1──N EditionVolunteerApplication
    │
    ├──N VolunteerTeam 1──N VolunteerTimeSlot 1──N VolunteerAssignment
    ├──N Workshop
    ├──N EditionArtist
    ├──N Show
    ├──N TicketingTier 1──N TicketingOption 1──N TicketingOrder
    └──1 HelloAssoConfig

User 1──N Notification
    │
    ├──N FcmToken
    ├──N ConversationParticipant N──1 Conversation 1──N Message
    ├──N WorkshopFavorite
    └──N CarpoolOffer / CarpoolRequest
```

---

## Endpoints API

### Statistiques
- **Total:** 314 fichiers d'endpoints
- **Modules:** 12 (admin, auth, conventions, editions, notifications, etc.)

### Principaux Modules

#### `/api/auth/*` - Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `POST /api/auth/logout` - Déconnexion
- `POST /api/auth/forgot-password` - Mot de passe oublié
- `POST /api/auth/reset-password` - Réinitialisation
- `POST /api/auth/verify-email` - Vérification email
- `GET /api/auth/check-session` - Vérifier session

#### `/api/admin/*` - Administration (26 endpoints)
- Gestion utilisateurs, logs erreurs, feedback
- Statistiques, sauvegardes, notifications push test
- Impersonation utilisateurs

#### `/api/conventions/*` - Conventions (47 endpoints)
- CRUD conventions
- Gestion organisateurs avec permissions granulaires
- Gestion éditions associées

#### `/api/editions/*` - Éditions (185+ endpoints)
- CRUD éditions
- **Bénévoles:** Candidatures, équipes, affectations, repas
- **Billetterie:** Tiers, options, commandes, HelloAsso sync
- **Ateliers:** CRUD, favoris, planification
- **Artistes:** CRUD, spectacles, repas
- **Objets trouvés:** CRUD, recherche
- **Images:** Upload, suppression

#### `/api/notifications/*` - Notifications (8 endpoints)
- Liste, marquer comme lues, supprimer
- Préférences utilisateur (13 types)
- Statistiques

#### `/api/messenger/*` - Messagerie (12 endpoints)
- Conversations, messages
- SSE temps réel pour présence/messages

#### `/api/carpool-*` - Covoiturage (18 endpoints)
- Offres et demandes
- Recherche, filtrage

### Format Standard Endpoint

```typescript
// Exemple: /api/conventions/[id]/organizers/index.post.ts
export default defineEventHandler(async (event) => {
  const user = await requireUserSession(event)
  const conventionId = getRouterParam(event, 'id')!

  // Validation permissions
  await requireConventionPermission(event, conventionId, 'manageOrganizers')

  // Validation body
  const body = await readBody(event)
  const validated = organizerSchema.parse(body)

  // Business logic
  const organizer = await prisma.conventionOrganizer.create({
    data: validated,
    include: organizerInclude
  })

  return { success: true, data: organizer }
})
```

---

## Système d'Authentification

### Stratégie: Sessions Scellées (nuxt-auth-utils)

- **PAS de JWT** - Sessions côté serveur
- **Cookies scellés** - Chiffrement AES-256-GCM
- **Durée:** 30 jours par défaut (configurable avec "remember me")
- **Secret:** Variable `NUXT_SESSION_PASSWORD` (32+ caractères)

### Helpers Disponibles

```typescript
// Serveur (server/api/*)
const session = await getUserSession(event)       // Optionnel
const session = await requireUserSession(event)   // Requis
await setUserSession(event, { user: { id, email, ... } })
await clearUserSession(event)

// Client (app/composables/useAuth.ts)
const { loggedIn, user, session, fetch, clear } = useUserSession()
```

### Structure Session

```typescript
interface UserSession {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    isAdmin: boolean
    preferredLanguage: string
  }
}
```

### Providers Auth Supportés

- **Email/Password** - Principal
- **Google OAuth** - Futur
- **GitHub OAuth** - Futur

### Protection Routes

```typescript
// Middleware: server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  const path = event.path

  // Routes publiques
  if (path.startsWith('/api/public/')) return

  // Routes protégées
  if (path.startsWith('/api/admin/')) {
    const session = await requireUserSession(event)
    if (!session.user.isAdmin) {
      throw createError({ statusCode: 403, message: 'Admin only' })
    }
  }
})
```

---

## Système de Permissions

### Permissions Granulaires Organisateurs

Documenté dans `docs/system/ORGANIZER_PERMISSIONS.md`

#### 7 Types de Droits

**Globaux (6):**
1. `editConvention` - Modifier convention
2. `deleteConvention` - Supprimer convention
3. `manageOrganizers` - Gérer organisateurs
4. `addEdition` - Ajouter éditions
5. `editAllEditions` - Modifier toutes éditions
6. `deleteAllEditions` - Supprimer toutes éditions

**Par Édition:**
7. `perEdition[].{canEdit, canDelete, canManageVolunteers}` - Surcharges spécifiques

#### Format API

```typescript
// GET /api/conventions/[id]/organizers
{
  "organizers": [
    {
      "id": "123",
      "userId": "user-456",
      "user": { "firstName": "John", "lastName": "Doe" },
      "rights": {
        "editConvention": true,
        "deleteConvention": false,
        "manageOrganizers": true,
        "addEdition": true,
        "editAllEditions": false,
        "deleteAllEditions": false
      },
      "perEdition": [
        {
          "editionId": "ed-789",
          "canEdit": true,
          "canDelete": false,
          "canManageVolunteers": true
        }
      ]
    }
  ]
}
```

#### Helpers Permissions

```typescript
// server/utils/permissions/convention-permissions.ts
await requireConventionPermission(event, conventionId, 'editConvention')
await requireConventionOwnerOrPermission(event, conventionId, 'manageOrganizers')

// server/utils/permissions/edition-permissions.ts
await requireEditionPermission(event, editionId, 'canEdit')
```

---

## Système de Notifications

### Architecture Multi-Canal

Documenté dans `docs/system/NOTIFICATION_SYSTEM.md` (1314 lignes)

#### 4 Canaux de Livraison

1. **Base de Données** - Persistance (table `Notification`)
2. **SSE (Server-Sent Events)** - Temps réel in-app
3. **FCM (Firebase Cloud Messaging)** - Push notifications
4. **Email** - Templates Vue Email

#### 13 Types de Notifications

```typescript
enum NotificationType {
  // Bénévoles
  VOLUNTEER_APPLICATION_STATUS_CHANGED
  VOLUNTEER_ASSIGNMENT_CHANGED
  VOLUNTEER_TEAM_ANNOUNCEMENT

  // Covoiturage
  CARPOOL_REQUEST_RECEIVED
  CARPOOL_REQUEST_ACCEPTED
  CARPOOL_REQUEST_REJECTED
  CARPOOL_OFFER_MATCHED

  // Messagerie
  NEW_MESSAGE

  // Éditions
  EDITION_UPDATE
  WORKSHOP_FAVORITED_CHANGED

  // Admin
  NEW_FEEDBACK
  NEW_ERROR_LOG
  SYSTEM_ANNOUNCEMENT
}
```

#### Préférences Utilisateur

Chaque type configurable indépendamment pour chaque canal:
- In-app (toujours activé)
- Push (opt-in)
- Email (opt-in)

#### Flux de Notification

```
1. Event déclenché
   │
2. notification-service.ts
   ├─► Créer en DB
   ├─► Envoyer SSE (si connecté)
   ├─► Envoyer FCM (si tokens + préf activée)
   └─► Envoyer Email (si préf activée)

3. Client reçoit
   ├─► SSE stream (temps réel)
   ├─► FCM push (background/foreground)
   └─► Email (async)
```

#### SSE Stream Manager

```typescript
// server/utils/notification-stream-manager.ts
class NotificationStreamManager {
  private streams = new Map<string, H3Event>()

  addStream(userId: string, event: H3Event)
  removeStream(userId: string)
  sendToUser(userId: string, notification: Notification)
  sendToMultipleUsers(userIds: string[], notification: Notification)
}

// Route: /api/notifications/stream
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  notificationStreamManager.addStream(session.user.id, event)

  // Cleanup on disconnect
  event.node.req.on('close', () => {
    notificationStreamManager.removeStream(session.user.id)
  })
})
```

#### Client SSE

```typescript
// app/composables/useNotificationStream.ts
export function useNotificationStream() {
  const notificationsStore = useNotificationsStore()
  let eventSource: EventSource | null = null

  const connect = () => {
    eventSource = new EventSource('/api/notifications/stream')

    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data)
      notificationsStore.addNotification(notification)
    }

    eventSource.onerror = () => {
      eventSource?.close()
      setTimeout(connect, 5000) // Reconnect
    }
  }

  onUnmounted(() => eventSource?.close())

  return { connect }
}
```

---

## Internationalisation

### 13 Langues Supportées

Tchèque (cs), Danois (da), Allemand (de), **Anglais (en)**, Espagnol (es), **Français (fr)**, Italien (it), Néerlandais (nl), Polonais (pl), Portugais (pt), Russe (ru), Suédois (sv), Ukrainien (uk)

### Structure Lazy Loading

```
i18n/locales/
├── en/
│   ├── common.json        # Commun (boutons, erreurs)
│   ├── notifications.json # Notifications
│   ├── components.json    # Composants UI
│   ├── app.json          # Application
│   ├── public.json       # Pages publiques
│   └── feedback.json     # Feedback
├── fr/
│   ├── common.json
│   ├── notifications.json
│   ├── components.json
│   ├── app.json
│   ├── public.json
│   ├── feedback.json
│   └── gestion.json      # Spécifique FR (exemple)
└── de/, es/, ...
```

### Configuration Nuxt i18n

```typescript
// nuxt.config.ts
i18n: {
  lazy: true,
  defaultLocale: 'en',
  strategy: 'no_prefix',
  detectBrowserLanguage: {
    useCookie: true,
    cookieKey: 'i18n_redirected',
    fallbackLocale: 'en',
  },
  bundle: {
    compositionOnly: true,
    runtimeOnly: false,
    fullInstall: false,
    dropMessageCompiler: false, // Garder pour SSR
  },
}
```

### Utilisation

```vue
<template>
  <UButton>{{ $t('common.save') }}</UButton>
  <p>{{ $t('notifications.volunteer_accepted', { name: 'John' }) }}</p>
</template>

<script setup>
const { t, locale } = useI18n()

const message = computed(() => t('app.welcome'))
locale.value = 'fr' // Changer langue
</script>
```

### Scripts i18n

```bash
npm run check-i18n              # Clés manquantes/inutilisées
npm run check-translations      # Comparer locales
npm run i18n:mark-todo          # Marquer clés [TODO]
```

---

## Tests

### Configuration Multi-Projet Vitest

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        name: 'unit',
        environment: 'happy-dom',
        include: ['tests/unit/**/*.test.ts'],
      },
      {
        name: 'nuxt',
        environment: 'nuxt',
        include: ['tests/**/*.nuxt.test.ts'],
      },
      {
        name: 'e2e',
        environment: 'happy-dom',
        include: ['tests/e2e/**/*.test.ts'],
      },
      {
        name: 'integration',
        environment: 'node',
        include: ['tests/integration/**/*.test.ts'],
      },
    ],
  },
})
```

### Scripts Tests

```bash
npm run test:unit         # Tests unitaires (watch)
npm run test:unit:run     # Tests unitaires (CI)
npm run test:nuxt         # Tests Nuxt (watch)
npm run test:nuxt:run     # Tests Nuxt (CI)
npm run test:e2e          # Tests E2E (watch)
npm run test:e2e:run      # Tests E2E (CI)
npm run test:db           # Tests intégration DB
npm run test:ui           # Interface Vitest UI
npm run test:all          # Tous les tests
```

### Exemple Test Nuxt

```typescript
// tests/composables/useAuth.nuxt.test.ts
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

describe('useAuth', () => {
  it('should login user', async () => {
    const { $fetch } = useNuxtApp()

    const result = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'password' },
    })

    expect(result.success).toBe(true)
  })
})
```

---

## Docker et Déploiement

### Environnements Docker

```bash
# Développement (hot reload, volumes)
npm run docker:dev
npm run docker:dev:detached
npm run docker:dev:logs

# Tests
npm run docker:test              # Tous tests
npm run docker:test:unit         # Tests unitaires
npm run docker:test:integration  # Tests DB

# Release (staging/prod)
npm run docker:release:up
```

### Configuration Docker Compose

```yaml
# docker-compose.dev.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    ports:
      - "3000:3000"
    depends_on:
      - db

  db:
    image: mariadb:11
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: convention
    volumes:
      - db_data:/var/lib/mysql
    ports:
      - "3306:3306"
```

### Variables d'Environnement

Voir `.env.portainer.example` pour template complet

**Essentielles:**
- `DATABASE_URL` - MySQL connection
- `NUXT_SESSION_PASSWORD` - Sessions (32+ chars)
- `SMTP_USER`, `SMTP_PASS` - Emails
- `NUXT_PUBLIC_FIREBASE_*` - Firebase config
- `FIREBASE_ADMIN_*` - Firebase Admin SDK
- `ANTHROPIC_API_KEY` - API Claude (optionnel)
- `NUXT_PUBLIC_RECAPTCHA_*` - reCAPTCHA

---

## Intégrations Externes

### HelloAsso - Billetterie Externe

- Synchronisation commandes via API
- Webhook pour événements temps réel
- Configuration chiffrée (`HELLOASSO_ENCRYPTION_SECRET`)
- Mapping options ↔ tarifs HelloAsso

### Firebase Cloud Messaging

- Push notifications web/mobile
- Tokens multi-appareils par utilisateur
- Service worker client
- Firebase Admin SDK serveur

### Anthropic Claude API

- Analyse OCR d'images
- Extraction infos billetterie HelloAsso
- Fallback providers: Ollama, LM Studio
- Configurable via `AI_PROVIDER`

### SMTP Email

- Nodemailer pour envoi
- Templates Vue Email
- Configuration: `SMTP_USER`, `SMTP_PASS`
- Flag: `SEND_EMAILS=true/false`

---

## Recommandations

### 🎯 Points Forts

1. **Architecture Moderne** - Nuxt 4, TypeScript, Prisma ORM
2. **Permissions Granulaires** - Système flexible et extensible
3. **Multi-Canal Notifications** - SSE + Push + Email
4. **Tests Structurés** - 4 projets Vitest distincts
5. **i18n Lazy Loading** - 13 langues, bundles optimisés
6. **Docker Dev** - Environnement reproductible

### ⚠️ Points d'Attention

#### Sécurité

- ✅ Validation Zod généralisée
- ⚠️ Vérifier rate limiting API (notamment auth)
- ⚠️ Audit permissions endpoints admin
- ✅ Emails hashés en DB (confidentialité)

#### Performance

- ⚠️ **314 endpoints** - Considérer code splitting
- ⚠️ SSE connections - Limiter nombre/utilisateur
- ✅ Nuxt UI serverBundle: 'remote' (optimisé)
- ⚠️ Prisma queries - Vérifier N+1 avec includes

#### Maintenabilité

- ✅ Documentation exhaustive (37 fichiers)
- ⚠️ Helpers Prisma select - Étendre usage (`docs/prisma-select-helpers.md`)
- ⚠️ Tests coverage - Augmenter couverture E2E
- ✅ Scripts i18n automatisés

#### Scalabilité

- ⚠️ SSE Stream Manager - Considérer Redis pour multi-instance
- ⚠️ Notifications - Queue system (Bull/BullMQ) pour volume élevé
- ✅ Database indexes - Vérifier couverture

### 🚀 Améliorations Suggérées

1. **Rate Limiting**
   ```typescript
   // server/middleware/rate-limit.ts
   import { createRateLimiter } from 'h3-rate-limiter'

   export default defineEventHandler(async (event) => {
     if (event.path.startsWith('/api/auth/')) {
       await createRateLimiter({ max: 5, window: 60000 })(event)
     }
   })
   ```

2. **Monitoring**
   - Intégrer Sentry pour tracking erreurs
   - Métriques Prometheus pour performances
   - Logs structurés (Winston/Pino)

3. **Cache**
   ```typescript
   // Cache conventions publiques
   const conventions = await cachedEventHandler(
     async () => prisma.convention.findMany({ where: { isPublic: true } }),
     { maxAge: 60 * 5 } // 5 minutes
   )
   ```

4. **Tests E2E**
   - Augmenter couverture parcours utilisateurs critiques
   - Playwright pour tests navigateur complets

5. **Documentation API**
   - Générer docs OpenAPI/Swagger
   - Exemples requêtes avec Postman/Insomnia

### 📊 Métriques Projet

| Métrique | Valeur |
|----------|--------|
| Fichiers TypeScript | ~500+ |
| Endpoints API | 314 |
| Composables | 37 |
| Pages Vue | 57 |
| Stores Pinia | 5 |
| Modèles Prisma | 50+ |
| Langues i18n | 13 |
| Fichiers docs | 37 |
| Scripts npm | 65+ |

---

## Conclusion

**Convention de Jonglerie** est une application full-stack moderne et bien architecturée, avec des fonctionnalités avancées (notifications multi-canal, permissions granulaires, i18n lazy loading) et une base de code maintenable. Les points d'amélioration identifiés concernent principalement la scalabilité (SSE multi-instance, queue notifications) et le monitoring (logs, métriques).

Le projet bénéficie d'une documentation exhaustive et de patterns cohérents, facilitant l'onboarding de nouveaux développeurs.

---

**Généré le:** 2025-11-27
**Version Nuxt:** 4.2.0
**Version Node:** >= 22 < 26
