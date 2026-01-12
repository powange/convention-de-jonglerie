# Analyse Complète du Codebase - Convention de Jonglerie

## Table des Matières

- [1. Vue d'ensemble du projet](#1-vue-densemble-du-projet)
- [2. Architecture technique](#2-architecture-technique)
- [3. Structure des dossiers](#3-structure-des-dossiers)
- [4. Base de données et modèles Prisma](#4-base-de-données-et-modèles-prisma)
- [5. API Backend](#5-api-backend)
- [6. Frontend et composants](#6-frontend-et-composants)
- [7. Système d'authentification](#7-système-dauthentification)
- [8. Internationalisation (i18n)](#8-internationalisation-i18n)
- [9. Tests](#9-tests)
- [10. Intégrations externes](#10-intégrations-externes)
- [11. Gestion des fichiers et uploads](#11-gestion-des-fichiers-et-uploads)
- [12. Conventions de code](#12-conventions-de-code)
- [13. Scripts et outils de développement](#13-scripts-et-outils-de-développement)

---

## 1. Vue d'ensemble du projet

### Description

**Convention de Jonglerie** est une application web full-stack permettant de gérer et découvrir des conventions de jonglerie. Elle offre des fonctionnalités complètes pour :

- **Découverte** : Consultation des conventions avec filtres, carte interactive, calendrier
- **Gestion** : Création, modification et administration des éditions de conventions
- **Billetterie** : Système de tickets intégré avec support HelloAsso
- **Bénévolat** : Gestion des équipes de bénévoles et des créneaux
- **Covoiturage** : Système d'offres et demandes de covoiturage
- **Communication** : Notifications push, emails, gestion des contacts

### Stack technologique

| Catégorie           | Technologies                  |
| ------------------- | ----------------------------- |
| **Framework**       | Nuxt 4.2.0, Vue 3.5.17        |
| **UI**              | Nuxt UI 4.0.0, Tailwind CSS   |
| **État**            | Pinia 3.0.3                   |
| **Backend**         | Nitro (intégré à Nuxt)        |
| **ORM**             | Prisma 6.18.0                 |
| **Base de données** | MySQL                         |
| **Auth**            | nuxt-auth-utils 0.5.23        |
| **i18n**            | Nuxt i18n 10.0.3 (13 langues) |
| **Tests**           | Vitest 3.2.4 (1262+ tests)    |

---

## 2. Architecture technique

### Architecture globale

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │ Composants  │  │     Stores Pinia    │  │
│  │  (Vue SFC)  │  │  (Vue SFC)  │  │  (État global)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Serveur Nitro                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    API Routes                         │   │
│  │  /api/auth/*  /api/editions/*  /api/users/*  etc.    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                     Middleware                        │   │
│  │   Auth, Permissions, Rate Limiting, Validation       │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Prisma Client                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        MySQL                                 │
│                   (50+ tables)                               │
└─────────────────────────────────────────────────────────────┘
```

### Patterns architecturaux

1. **API RESTful** : Endpoints organisés par ressource
2. **Helpers Prisma standardisés** : Sélections réutilisables (`userBasicSelect`, `editionListInclude`)
3. **Composables Vue** : Logique réutilisable (`useApi`, `useAuth`, `useEdition`)
4. **Stores Pinia** : État global typé
5. **Middleware serveur** : Authentification et permissions centralisées

---

## 3. Structure des dossiers

```
convention-de-jonglerie/
├── app/                          # Frontend Nuxt
│   ├── assets/                   # Assets statiques (CSS, images)
│   ├── components/               # Composants Vue réutilisables
│   │   ├── auth/                 # Composants d'authentification
│   │   ├── edition/              # Composants liés aux éditions
│   │   ├── layout/               # Header, Footer, Navigation
│   │   ├── map/                  # Carte Leaflet
│   │   └── ui/                   # Composants UI génériques
│   ├── composables/              # Composables Vue (useApi, useAuth...)
│   ├── layouts/                  # Layouts Nuxt
│   ├── middleware/               # Middleware de navigation
│   ├── pages/                    # Pages de l'application
│   │   ├── admin/                # Administration globale
│   │   ├── auth/                 # Authentification
│   │   ├── editions/             # Gestion des éditions
│   │   └── ...
│   ├── plugins/                  # Plugins Nuxt
│   ├── stores/                   # Stores Pinia
│   └── utils/                    # Utilitaires frontend
│
├── server/                       # Backend Nitro
│   ├── api/                      # Routes API (323+ endpoints)
│   │   ├── admin/                # API admin
│   │   ├── auth/                 # API authentification
│   │   ├── editions/             # API éditions
│   │   ├── notifications/        # API notifications
│   │   └── users/                # API utilisateurs
│   ├── middleware/               # Middleware serveur
│   ├── plugins/                  # Plugins serveur
│   ├── tasks/                    # Tâches planifiées (Nitro Tasks)
│   └── utils/                    # Utilitaires serveur
│       ├── permissions/          # Système de permissions
│       ├── email/                # Service d'emails
│       └── ...
│
├── prisma/                       # Configuration Prisma
│   ├── schema.prisma             # Schéma de base de données
│   ├── migrations/               # Migrations DB
│   └── seed-dev.ts               # Données de seed
│
├── i18n/                         # Internationalisation
│   └── locales/                  # Fichiers de traduction (13 langues)
│       ├── fr/                   # Français (langue de référence)
│       ├── en/                   # Anglais
│       └── ...
│
├── test/                         # Tests
│   ├── unit/                     # Tests unitaires
│   └── nuxt/                     # Tests Nuxt/API
│
├── scripts/                      # Scripts utilitaires
│   ├── check-i18n.js             # Vérification i18n
│   └── translation/              # Outils de traduction
│
├── docs/                         # Documentation
│
└── public/                       # Fichiers publics
    └── uploads/                  # Fichiers uploadés
```

---

## 4. Base de données et modèles Prisma

### Vue d'ensemble

Le schéma Prisma contient **50+ modèles** organisés en domaines fonctionnels.

### Modèles principaux

#### Utilisateurs et authentification

```prisma
model User {
  id                    Int       @id @default(autoincrement())
  email                 String    @unique
  password              String?
  pseudo                String?
  prenom                String?
  nom                   String?
  profilePicture        String?
  emailHash             String?
  role                  UserRole  @default(USER)
  firebaseToken         String?   // Notifications push

  // Relations
  editionsCreated       Edition[]
  organizedEditions     EditionOrganizer[]
  favorites             Favorite[]
  carpoolOffers         CarpoolOffer[]
  // ...
}

enum UserRole {
  USER
  ADMIN
}
```

#### Conventions et éditions

```prisma
model Convention {
  id          Int       @id @default(autoincrement())
  name        String    @unique
  slug        String    @unique
  description String?   @db.Text
  logo        String?
  website     String?

  editions    Edition[]
  contacts    ConventionContact[]
  followers   ConventionFollower[]
}

model Edition {
  id              Int       @id @default(autoincrement())
  conventionId    Int
  name            String
  slug            String
  startDate       DateTime
  endDate         DateTime
  status          EditionStatus @default(DRAFT)
  isPublic        Boolean   @default(false)

  // Localisation
  address         String?
  city            String?
  country         String?
  latitude        Float?
  longitude       Float?

  // Relations
  convention      Convention @relation(...)
  organizers      EditionOrganizer[]
  tickets         TicketType[]
  activities      Activity[]
  volunteers      VolunteerAssignment[]
  // ...
}

enum EditionStatus {
  DRAFT
  PUBLISHED
  CANCELLED
  COMPLETED
}
```

#### Billetterie

```prisma
model TicketType {
  id          String    @id @default(uuid())
  editionId   Int
  name        String
  price       Float
  quantity    Int?
  description String?   @db.Text

  tickets     Ticket[]
}

model TicketingOrder {
  id                  Int       @id @default(autoincrement())
  editionId           Int
  payerEmail          String
  payerFirstName      String?
  payerLastName       String?
  amount              Int       // En centimes
  status              String
  helloAssoOrderId    Int?      // Référence HelloAsso

  tickets             Ticket[]
}

model Ticket {
  id            String    @id @default(uuid())
  orderId       Int
  ticketTypeId  String
  firstName     String
  lastName      String
  email         String
  checkedIn     Boolean   @default(false)
  checkedInAt   DateTime?
  qrCode        String    @unique
}
```

#### Bénévolat

```prisma
model VolunteerSlot {
  id          String    @id @default(uuid())
  editionId   Int
  name        String
  description String?   @db.Text
  startTime   DateTime
  endTime     DateTime
  maxVolunteers Int     @default(1)

  assignments VolunteerAssignment[]
}

model VolunteerAssignment {
  id          String    @id @default(uuid())
  slotId      String
  userId      Int?
  editionId   Int
  firstName   String?
  lastName    String?
  email       String?
  status      VolunteerStatus @default(PENDING)
}
```

#### Covoiturage

```prisma
model CarpoolOffer {
  id              String    @id @default(uuid())
  editionId       Int
  userId          Int?
  driverName      String
  driverEmail     String?
  departureCity   String
  departureDate   DateTime
  availableSeats  Int
  price           Float?
  description     String?   @db.Text
  isReturn        Boolean   @default(false)

  requests        CarpoolRequest[]
}

model CarpoolRequest {
  id          String    @id @default(uuid())
  offerId     String
  userId      Int?
  name        String
  email       String
  message     String?   @db.Text
  status      CarpoolRequestStatus @default(PENDING)
}
```

### Helpers Prisma (`server/utils/prisma-select-helpers.ts`)

```typescript
// Sélections standardisées pour éviter la duplication
export const userBasicSelect = {
  id: true,
  pseudo: true,
  prenom: true,
  nom: true,
  email: true,
  emailHash: true,
  profilePicture: true,
}

export const editionListInclude = {
  convention: { select: { name: true, slug: true, logo: true } },
  organizers: { include: { user: { select: userBasicSelect } } },
  _count: { select: { tickets: true, activities: true } },
}

export const carpoolOfferInclude = {
  user: { select: userBasicSelect },
  requests: { include: { user: { select: userBasicSelect } } },
}
```

---

## 5. API Backend

### Organisation des endpoints

L'API compte **323+ endpoints** organisés par domaine :

```
/api/
├── auth/                         # Authentification
│   ├── login.post.ts
│   ├── register.post.ts
│   ├── logout.post.ts
│   ├── me.get.ts
│   ├── forgot-password.post.ts
│   └── reset-password.post.ts
│
├── admin/                        # Administration
│   ├── users/                    # Gestion utilisateurs
│   ├── conventions/              # Gestion conventions
│   └── stats.get.ts              # Statistiques
│
├── editions/                     # Éditions
│   ├── [id]/
│   │   ├── index.get.ts
│   │   ├── index.put.ts
│   │   ├── index.delete.ts
│   │   ├── organizers/           # Organisateurs
│   │   ├── volunteers/           # Bénévoles
│   │   ├── ticketing/            # Billetterie
│   │   │   ├── orders/
│   │   │   ├── tickets/
│   │   │   └── stats.get.ts
│   │   ├── activities/           # Activités
│   │   ├── carpool/              # Covoiturage
│   │   └── schedule/             # Planning
│   └── index.get.ts              # Liste
│
├── conventions/                  # Conventions
│   ├── [slug]/
│   │   ├── index.get.ts
│   │   ├── editions.get.ts
│   │   └── follow.post.ts
│   └── index.get.ts
│
├── users/                        # Utilisateurs
│   ├── search.get.ts             # Recherche par email
│   ├── [id]/
│   │   ├── index.get.ts
│   │   └── index.put.ts
│   └── me/
│       ├── index.get.ts
│       ├── index.put.ts
│       └── favorites.get.ts
│
└── notifications/                # Notifications
    ├── subscribe.post.ts
    └── send.post.ts
```

### Pattern de handler API

```typescript
// server/api/editions/[id]/index.get.ts
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { z } from 'zod'

export default wrapApiHandler(
  async (event) => {
    const { id } = getRouterParams(event)
    const editionId = parseInt(id)

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: editionDetailInclude,
    })

    if (!edition) {
      throw createError({ statusCode: 404, message: 'Édition non trouvée' })
    }

    return edition
  },
  { operationName: 'GetEdition' }
)
```

### Système de permissions

```typescript
// server/utils/permissions/edition-permissions.ts
export async function canAccessEditionData(event: H3Event, editionId: number): Promise<boolean> {
  const user = await getUserFromSession(event)
  if (!user) return false

  // Admin a toujours accès
  if (user.role === 'ADMIN') return true

  // Vérifier si l'utilisateur est organisateur
  const organizer = await prisma.editionOrganizer.findFirst({
    where: { editionId, userId: user.id },
  })

  return !!organizer
}

export async function requireEditionAccess(event: H3Event, editionId: number): Promise<void> {
  const hasAccess = await canAccessEditionData(event, editionId)
  if (!hasAccess) {
    throw createError({ statusCode: 403, message: 'Accès refusé' })
  }
}
```

### Validation avec Zod

```typescript
// Schémas de validation réutilisables
const createEditionSchema = z.object({
  conventionId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  description: z.string().optional(),
})

// Utilisation
const body = await readBody(event)
const data = createEditionSchema.parse(body)
```

---

## 6. Frontend et composants

### Pages principales (60+)

```
app/pages/
├── index.vue                     # Page d'accueil
├── conventions/
│   ├── index.vue                 # Liste des conventions
│   └── [slug].vue                # Détail convention
├── editions/
│   ├── index.vue                 # Liste des éditions
│   ├── map.vue                   # Carte interactive
│   ├── calendar.vue              # Vue calendrier
│   └── [id]/
│       ├── index.vue             # Détail édition
│       ├── tickets.vue           # Achat tickets
│       ├── volunteers.vue        # Inscription bénévoles
│       ├── carpool.vue           # Covoiturage
│       └── gestion/              # Administration
│           ├── index.vue         # Dashboard
│           ├── organizers.vue    # Organisateurs
│           ├── volunteers.vue    # Bénévoles
│           ├── ticketing.vue     # Billetterie
│           ├── activities.vue    # Activités
│           └── schedule.vue      # Planning
├── my-conventions.vue            # Mes conventions
├── favorites.vue                 # Favoris
├── auth/
│   ├── login.vue
│   ├── register.vue
│   └── forgot-password.vue
├── profile/
│   └── index.vue
└── admin/
    ├── index.vue                 # Dashboard admin
    ├── users/                    # Gestion utilisateurs
    └── conventions/              # Gestion conventions
```

### Composants réutilisables

#### Composants d'édition

```vue
<!-- app/components/edition/EditionCard.vue -->
<template>
  <UCard class="hover:shadow-lg transition-shadow">
    <template #header>
      <img :src="edition.banner || defaultBanner" :alt="edition.name" />
    </template>

    <h3 class="text-lg font-semibold">{{ edition.name }}</h3>
    <p class="text-gray-500">{{ formatDateRange(edition.startDate, edition.endDate) }}</p>
    <p class="text-sm">{{ edition.city }}, {{ edition.country }}</p>

    <template #footer>
      <div class="flex justify-between items-center">
        <UBadge :color="statusColor">{{ $t(`status.${edition.status}`) }}</UBadge>
        <FavoriteButton :edition-id="edition.id" />
      </div>
    </template>
  </UCard>
</template>
```

#### Composant UserSelector

```vue
<!-- app/components/UserSelector.vue -->
<template>
  <div>
    <UInput
      v-model="searchQuery"
      :placeholder="$t('common.search_by_email')"
      @input="debouncedSearch"
    />

    <div v-if="searchResults.length" class="mt-2 border rounded-md">
      <div
        v-for="user in searchResults"
        :key="user.id"
        class="p-2 hover:bg-gray-100 cursor-pointer"
        @click="selectUser(user)"
      >
        <div class="flex items-center gap-2">
          <UserAvatar :user="user" size="sm" />
          <div>
            <p class="font-medium">{{ user.pseudo }}</p>
            <p class="text-sm text-gray-500">{{ user.email }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

### Composables

```typescript
// app/composables/useApi.ts
export function useApi() {
  const { $fetch } = useNuxtApp()

  async function get<T>(url: string, options?: FetchOptions): Promise<T> {
    return $fetch<T>(url, { method: 'GET', ...options })
  }

  async function post<T>(url: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return $fetch<T>(url, { method: 'POST', body, ...options })
  }

  // ... put, delete, etc.

  return { get, post, put, delete: del }
}

// app/composables/useEdition.ts
export function useEdition(editionId: MaybeRef<number>) {
  const id = toRef(editionId)
  const api = useApi()

  const {
    data: edition,
    pending,
    refresh,
  } = useAsyncData(`edition-${unref(id)}`, () => api.get(`/api/editions/${unref(id)}`))

  const isOrganizer = computed(() => {
    const user = useAuth().user.value
    return edition.value?.organizers.some((o) => o.userId === user?.id)
  })

  return { edition, pending, refresh, isOrganizer }
}
```

### Stores Pinia

```typescript
// app/stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  async function login(email: string, password: string) {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = response.user
    return response
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    navigateTo('/auth/login')
  }

  async function fetchUser() {
    try {
      const response = await $fetch('/api/auth/me')
      user.value = response.user
    } catch {
      user.value = null
    }
  }

  return { user, isAuthenticated, isAdmin, login, logout, fetchUser }
})
```

---

## 7. Système d'authentification

### Architecture

Le système utilise **nuxt-auth-utils** avec des cookies de session sécurisés (sealed cookies).

```typescript
// server/api/auth/login.post.ts
export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (!user || !user.password) {
    throw createError({ statusCode: 401, message: 'Identifiants invalides' })
  }

  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) {
    throw createError({ statusCode: 401, message: 'Identifiants invalides' })
  }

  // Créer la session avec nuxt-auth-utils
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      pseudo: user.pseudo,
      role: user.role,
    },
  })

  return { user: sanitizeUser(user) }
})
```

### Middleware d'authentification

```typescript
// app/middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuthStore()

  // Charger l'utilisateur si pas encore fait
  if (!user.value) {
    await fetchUser()
  }

  // Vérifier les routes protégées
  if (to.meta.requiresAuth && !user.value) {
    return navigateTo('/auth/login')
  }

  if (to.meta.requiresAdmin && user.value?.role !== 'ADMIN') {
    return navigateTo('/')
  }
})
```

### Utilitaires serveur

```typescript
// server/utils/auth-utils.ts
export async function requireAuth(event: H3Event): Promise<User> {
  const session = await getUserSession(event)

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Non authentifié' })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user) {
    throw createError({ statusCode: 401, message: 'Utilisateur non trouvé' })
  }

  return user
}

export async function requireAdmin(event: H3Event): Promise<User> {
  const user = await requireAuth(event)

  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Accès admin requis' })
  }

  return user
}
```

---

## 8. Internationalisation (i18n)

### Configuration

Le projet supporte **13 langues** avec un système de lazy loading par domaine.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  i18n: {
    locales: [
      { code: 'fr', name: 'Français', file: 'fr/' },
      { code: 'en', name: 'English', file: 'en/' },
      { code: 'de', name: 'Deutsch', file: 'de/' },
      { code: 'es', name: 'Español', file: 'es/' },
      { code: 'it', name: 'Italiano', file: 'it/' },
      { code: 'pt', name: 'Português', file: 'pt/' },
      { code: 'nl', name: 'Nederlands', file: 'nl/' },
      { code: 'pl', name: 'Polski', file: 'pl/' },
      { code: 'cs', name: 'Čeština', file: 'cs/' },
      { code: 'ru', name: 'Русский', file: 'ru/' },
      { code: 'ja', name: '日本語', file: 'ja/' },
      { code: 'zh', name: '中文', file: 'zh/' },
      { code: 'ko', name: '한국어', file: 'ko/' },
    ],
    defaultLocale: 'fr',
    lazy: true,
    langDir: 'i18n/locales',
    strategy: 'no_prefix',
  },
})
```

### Structure des fichiers

```
i18n/locales/
├── fr/                           # Langue de référence
│   ├── common.json               # Termes généraux
│   ├── auth.json                 # Authentification
│   ├── edition.json              # Éditions
│   ├── admin.json                # Administration
│   ├── public.json               # Pages publiques
│   ├── components.json           # Composants
│   └── app.json                  # Application
├── en/
│   └── ... (même structure)
└── ... (autres langues)
```

### Exemple de fichier de traduction

```json
// i18n/locales/fr/edition.json
{
  "title": "Édition",
  "list": "Liste des éditions",
  "create": "Créer une édition",
  "edit": "Modifier l'édition",
  "delete": "Supprimer l'édition",
  "status": {
    "DRAFT": "Brouillon",
    "PUBLISHED": "Publiée",
    "CANCELLED": "Annulée",
    "COMPLETED": "Terminée"
  },
  "fields": {
    "name": "Nom",
    "startDate": "Date de début",
    "endDate": "Date de fin",
    "location": "Lieu"
  }
}
```

### Scripts de gestion i18n

```bash
# Vérifier les clés manquantes/inutilisées
npm run check-i18n

# Comparer les traductions entre langues
npm run check-translations

# Marquer les clés modifiées comme [TODO]
npm run i18n:mark-todo
```

---

## 9. Tests

### Configuration

Le projet utilise **Vitest** avec **1262+ tests** répartis en deux catégories.

```typescript
// vitest.config.ts (tests unitaires)
export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['test/setup-common.ts'],
  },
})

// vitest.config.nuxt.ts (tests Nuxt)
export default defineConfig({
  test: {
    include: ['test/nuxt/**/*.test.ts'],
    environment: 'nuxt',
    setupFiles: ['test/setup-common.ts'],
  },
})
```

### Structure des tests

```
test/
├── setup-common.ts               # Setup global (mocks Prisma)
├── unit/                         # Tests unitaires
│   ├── utils/                    # Tests utilitaires
│   └── components/               # Tests composants
└── nuxt/                         # Tests API/intégration
    └── server/
        └── api/
            ├── auth/
            │   ├── login.test.ts
            │   └── register.test.ts
            ├── editions/
            │   ├── create.test.ts
            │   ├── update.test.ts
            │   └── ticketing/
            │       └── orders/
            │           └── delete.test.ts
            └── ...
```

### Exemple de test API

```typescript
// test/nuxt/server/api/editions/ticketing/orders/delete.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import handler from '../../../../../../../server/api/editions/[id]/ticketing/orders/[orderId]/index.delete'

const prismaMock = (globalThis as any).prisma

vi.mock('@@/server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: vi.fn().mockResolvedValue(true),
}))

describe('DELETE /api/editions/[id]/ticketing/orders/[orderId]', () => {
  beforeEach(() => {
    prismaMock.ticketingOrder.findUnique.mockReset()
    prismaMock.ticketingOrder.delete.mockReset()
  })

  it('devrait supprimer une commande manuelle', async () => {
    const mockOrder = {
      id: 1,
      editionId: 1,
      status: 'Refunded',
      // ...
    }

    prismaMock.ticketingOrder.findUnique.mockResolvedValue(mockOrder)
    prismaMock.ticketingOrder.delete.mockResolvedValue(mockOrder)

    const result = await handler(mockEvent(1, 1) as any)

    expect(result.success).toBe(true)
    expect(prismaMock.ticketingOrder.delete).toHaveBeenCalled()
  })
})
```

### Commandes de test

```bash
# Tests unitaires
npm run test:unit           # Mode watch
npm run test:unit:run       # Exécution unique

# Tests Nuxt
npm run test:nuxt           # Mode watch
npm run test:nuxt:run       # Exécution unique

# Tous les tests
npm run test                # Mode watch
npm run test:run            # Exécution unique
```

---

## 10. Intégrations externes

### HelloAsso (Billetterie)

Intégration pour la synchronisation des commandes et tickets.

```typescript
// server/utils/helloasso.ts
export class HelloAssoClient {
  private baseUrl = 'https://api.helloasso.com/v5'
  private accessToken: string | null = null

  async authenticate(clientId: string, clientSecret: string) {
    const response = await $fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    this.accessToken = response.access_token
  }

  async getOrders(organizationSlug: string, formSlug: string) {
    return $fetch(
      `${this.baseUrl}/organizations/${organizationSlug}/forms/event/${formSlug}/orders`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    )
  }

  async syncOrders(editionId: number, ticketingConfig: ExternalTicketing) {
    const orders = await this.getOrders(ticketingConfig.organizationSlug, ticketingConfig.formSlug)

    for (const order of orders) {
      await prisma.ticketingOrder.upsert({
        where: { helloAssoOrderId: order.id },
        create: {
          /* ... */
        },
        update: {
          /* ... */
        },
      })
    }
  }
}
```

### Firebase (Notifications Push)

```typescript
// server/utils/firebase.ts
import * as admin from 'firebase-admin'

export async function sendPushNotification(
  userIds: number[],
  notification: { title: string; body: string; data?: Record<string, string> }
) {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, firebaseToken: { not: null } },
    select: { firebaseToken: true },
  })

  const tokens = users.map((u) => u.firebaseToken!).filter(Boolean)

  if (tokens.length === 0) return

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data,
  })
}
```

### Service d'emails

```typescript
// server/utils/email/email-service.ts
export async function sendEmail(options: {
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
}) {
  const html = await renderEmailTemplate(options.template, options.data)

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html,
  })
}

// Templates disponibles
const templates = {
  welcome: 'Bienvenue sur Convention de Jonglerie',
  'reset-password': 'Réinitialisation de mot de passe',
  'ticket-confirmation': 'Confirmation de commande',
  'volunteer-assignment': 'Attribution de créneau bénévole',
  'carpool-request': 'Nouvelle demande de covoiturage',
}
```

---

## 11. Gestion des fichiers et uploads

### Configuration

```typescript
// server/api/uploads/index.post.ts
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const formData = await readMultipartFormData(event)

  const file = formData?.find((f) => f.name === 'file')
  if (!file) {
    throw createError({ statusCode: 400, message: 'Fichier requis' })
  }

  // Validation du type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type || '')) {
    throw createError({ statusCode: 400, message: 'Type de fichier non autorisé' })
  }

  // Génération du nom unique
  const ext = file.filename?.split('.').pop() || 'jpg'
  const filename = `${Date.now()}-${randomUUID()}.${ext}`
  const filepath = `public/uploads/${filename}`

  // Sauvegarde
  await writeFile(filepath, file.data)

  return { url: `/uploads/${filename}` }
})
```

### Types de fichiers gérés

- **Images de profil** : JPEG, PNG, WebP (max 5MB)
- **Logos de convention** : JPEG, PNG, WebP, SVG (max 2MB)
- **Bannières d'édition** : JPEG, PNG, WebP (max 10MB)
- **Documents** : PDF (max 20MB)

---

## 12. Conventions de code

### Style TypeScript

```typescript
// Typage explicite pour les retours de fonction
function calculatePrice(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

// Interfaces pour les objets complexes
interface CreateEditionInput {
  conventionId: number
  name: string
  startDate: Date
  endDate: Date
  location?: LocationInput
}

// Enums pour les valeurs finies
enum OrderStatus {
  Pending = 'Pending',
  Processed = 'Processed',
  Refunded = 'Refunded',
  Cancelled = 'Cancelled',
}
```

### Convention de nommage

| Type                | Convention        | Exemple              |
| ------------------- | ----------------- | -------------------- |
| Fichiers composants | PascalCase        | `UserSelector.vue`   |
| Fichiers pages      | kebab-case        | `my-conventions.vue` |
| Fichiers API        | kebab-case.method | `index.get.ts`       |
| Variables           | camelCase         | `isLoading`          |
| Constantes          | SCREAMING_SNAKE   | `MAX_FILE_SIZE`      |
| Types/Interfaces    | PascalCase        | `UserProfile`        |

### Structure des composants Vue

```vue
<script setup lang="ts">
// 1. Imports
import { ref, computed } from 'vue'

// 2. Props et emits
const props = defineProps<{
  editionId: number
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', value: Edition): void
  (e: 'delete'): void
}>()

// 3. Composables et stores
const { t } = useI18n()
const api = useApi()

// 4. État réactif
const isLoading = ref(false)
const edition = ref<Edition | null>(null)

// 5. Computed
const canEdit = computed(() => !props.readonly && edition.value?.status === 'DRAFT')

// 6. Méthodes
async function loadEdition() {
  isLoading.value = true
  try {
    edition.value = await api.get(`/api/editions/${props.editionId}`)
  } finally {
    isLoading.value = false
  }
}

// 7. Lifecycle
onMounted(loadEdition)
</script>

<template>
  <!-- Template -->
</template>

<style scoped>
/* Styles scoped */
</style>
```

---

## 13. Scripts et outils de développement

### Scripts npm principaux

```json
{
  "scripts": {
    // Développement
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",

    // Linting et formatage
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",

    // Tests
    "test": "vitest",
    "test:run": "vitest run",
    "test:unit": "vitest --config vitest.config.ts",
    "test:unit:run": "vitest run --config vitest.config.ts",
    "test:nuxt": "vitest --config vitest.config.nuxt.ts",
    "test:nuxt:run": "vitest run --config vitest.config.nuxt.ts",

    // Base de données
    "db:seed:dev": "npx tsx prisma/seed-dev.ts",
    "db:studio": "npx prisma studio",

    // i18n
    "check-i18n": "node scripts/check-i18n.js",
    "check-translations": "node scripts/check-translations.js",
    "i18n:mark-todo": "node scripts/i18n-mark-todo.js",

    // Docker
    "docker:dev": "docker-compose -f docker-compose.dev.yml up --build",
    "docker:dev:detached": "docker-compose -f docker-compose.dev.yml up -d --build",
    "docker:dev:down": "docker-compose -f docker-compose.dev.yml down",
    "docker:dev:logs": "docker-compose -f docker-compose.dev.yml logs -f app"
  }
}
```

### ESLint Configuration

```javascript
// eslint.config.js
import nuxt from '@nuxt/eslint-config'

export default [
  ...nuxt,
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
```

### Prettier Configuration

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100
}
```

---

## Annexes

### Variables d'environnement requises

```bash
# Base de données
DATABASE_URL="mysql://user:password@localhost:3306/convention_jonglerie"

# Session
NUXT_SESSION_PASSWORD="min-32-characters-secret-key"

# Email
EMAIL_HOST="smtp.example.com"
EMAIL_PORT="587"
EMAIL_USER="user@example.com"
EMAIL_PASSWORD="password"
EMAIL_FROM="noreply@example.com"

# HelloAsso (optionnel)
HELLOASSO_CLIENT_ID="your-client-id"
HELLOASSO_CLIENT_SECRET="your-client-secret"

# Firebase (optionnel)
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL="your-client-email"

# Prisma (optionnel)
PRISMA_LOG_LEVEL="error,warn"
```

### Ressources de documentation

- [Documentation Nuxt 4.x](https://nuxt.com/docs/4.x/getting-started/introduction)
- [Documentation Nuxt UI](https://ui.nuxt.com/getting-started)
- [Documentation Prisma](https://www.prisma.io/docs)
- [Documentation Vue 3](https://vuejs.org/guide/introduction.html)
- [Documentation Pinia](https://pinia.vuejs.org/)
- [Documentation Vitest](https://vitest.dev/guide/)

---

_Document généré le 2026-01-09_
