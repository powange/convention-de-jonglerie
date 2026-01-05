# Analyse Complete du Codebase - Juggling Convention

## Table des matieres

1. [Vue d'ensemble](#vue-densemble)
2. [Structure des repertoires](#structure-des-repertoires)
3. [Architecture technique](#architecture-technique)
4. [Modele de donnees](#modele-de-donnees)
5. [API Endpoints](#api-endpoints)
6. [Frontend - Pages et composants](#frontend---pages-et-composants)
7. [Gestion d'etat (Pinia Stores)](#gestion-detat-pinia-stores)
8. [Systeme d'authentification](#systeme-dauthentification)
9. [Internationalisation (i18n)](#internationalisation-i18n)
10. [Tests](#tests)
11. [Patterns et conventions](#patterns-et-conventions)
12. [Diagrammes d'architecture](#diagrammes-darchitecture)
13. [Recommandations](#recommandations)

---

## Vue d'ensemble

### Description du projet

**Juggling Convention** est une application web full-stack permettant de gerer et decouvrir des conventions de jonglerie. La plateforme offre :

- Consultation et gestion de conventions et editions
- Systeme de favoris
- Gestion des benevoles avec planning
- Covoiturage collaboratif
- Billetterie integree (HelloAsso)
- Gestion des artistes et spectacles
- Messagerie interne
- Workshops et ateliers
- Objets perdus/trouves

### Stack technologique

| Categorie | Technologies |
|-----------|-------------|
| **Framework** | Nuxt.js 4.2.0 / Vue.js 3.5.17 |
| **UI** | Nuxt UI 4.0.0 / Tailwind CSS |
| **State Management** | Pinia 3.0.3 |
| **Backend** | Nitro (integre a Nuxt) |
| **ORM** | Prisma 7.0.0 |
| **Base de donnees** | MySQL |
| **Authentification** | nuxt-auth-utils 0.5.23 (sessions/cookies) |
| **i18n** | @nuxtjs/i18n 10.0.3 (13 langues) |
| **Tests** | Vitest 3.2.4 / Nuxt Test Utils |
| **Validation** | Zod 4.1.9 |
| **Calendrier** | FullCalendar 6.1.15 |
| **Graphiques** | Chart.js 4.5.1 |
| **Notifications** | Firebase Cloud Messaging |

### Contraintes techniques

- Node.js >= 22 < 26
- Application PWA installable
- Support de 13 langues
- Deploiement Docker

---

## Structure des repertoires

```
convention-de-jonglerie/
├── app/                          # Frontend Nuxt
│   ├── assets/                   # Ressources statiques (CSS, images)
│   ├── components/               # Composants Vue reutilisables (~100+)
│   │   ├── admin/                # Composants administration
│   │   ├── artists/              # Gestion des artistes
│   │   ├── convention/           # Composants convention
│   │   ├── edition/              # Composants edition
│   │   │   ├── carpool/          # Covoiturage
│   │   │   ├── ticketing/        # Billetterie
│   │   │   └── volunteer/        # Benevoles
│   │   ├── feedback/             # Retours utilisateurs
│   │   ├── management/           # Gestion
│   │   ├── notifications/        # Centre de notifications
│   │   ├── organizer/            # Organisateurs
│   │   ├── organizers/           # Gestion organisateurs
│   │   ├── shows/                # Spectacles
│   │   ├── ticketing/            # Billetterie
│   │   ├── ui/                   # Composants UI generiques
│   │   ├── volunteers/           # Benevoles
│   │   └── workshops/            # Ateliers
│   ├── composables/              # Hooks Vue reutilisables (~40)
│   ├── layouts/                  # Layouts Nuxt (3)
│   │   ├── default.vue           # Layout principal
│   │   ├── edition-dashboard.vue # Dashboard edition
│   │   └── messenger.vue         # Layout messagerie
│   ├── middleware/               # Middlewares client (6)
│   ├── pages/                    # Pages de l'application (~60)
│   │   ├── admin/                # Pages admin
│   │   ├── auth/                 # Authentification
│   │   ├── conventions/          # Conventions
│   │   └── editions/             # Editions et gestion
│   ├── plugins/                  # Plugins Nuxt (5)
│   ├── stores/                   # Stores Pinia (5)
│   └── types/                    # Types TypeScript
├── server/                       # Backend Nitro
│   ├── api/                      # Endpoints API (~150+)
│   │   ├── admin/                # API administration
│   │   ├── auth/                 # Authentification
│   │   ├── carpool-offers/       # Offres covoiturage
│   │   ├── carpool-requests/     # Demandes covoiturage
│   │   ├── conventions/          # Conventions
│   │   ├── editions/             # Editions
│   │   │   └── [id]/             # Operations par edition
│   │   │       ├── ticketing/    # Billetterie
│   │   │       ├── volunteers/   # Benevoles
│   │   │       └── workshops/    # Ateliers
│   │   ├── feedback/             # Retours
│   │   ├── files/                # Upload fichiers
│   │   ├── messenger/            # Messagerie
│   │   ├── notifications/        # Notifications
│   │   ├── profile/              # Profil utilisateur
│   │   └── users/                # Utilisateurs
│   ├── generated/                # Client Prisma genere
│   ├── middleware/               # Middlewares serveur (3)
│   ├── types/                    # Types API
│   └── utils/                    # Utilitaires serveur (~70)
│       ├── editions/             # Utilitaires editions
│       │   ├── ticketing/        # Billetterie
│       │   └── volunteers/       # Benevoles
│       └── permissions/          # Gestion permissions
├── prisma/                       # Base de donnees
│   ├── schema.prisma             # Schema (1662 lignes, ~60 modeles)
│   └── migrations/               # Migrations
├── i18n/                         # Internationalisation
│   ├── i18n.config.ts            # Configuration i18n
│   └── locales/                  # Fichiers de traduction (13 langues)
│       ├── fr/                   # Francais (reference)
│       ├── en/                   # Anglais
│       ├── de/                   # Allemand
│       └── ...                   # Autres langues
├── test/                         # Tests
│   ├── unit/                     # Tests unitaires
│   ├── nuxt/                     # Tests Nuxt
│   ├── integration/              # Tests d'integration
│   └── e2e/                      # Tests end-to-end
├── scripts/                      # Scripts utilitaires
├── public/                       # Fichiers statiques publics
└── docs/                         # Documentation
```

---

## Architecture technique

### Diagramme d'architecture globale

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Vue.js    │  │  Pinia      │  │  Nuxt UI    │  │  i18n       │ │
│  │   Pages     │  │  Stores     │  │  Components │  │  13 langs   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                           │                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Nuxt Middleware (Client)                      ││
│  │  auth-protected | guest-only | super-admin | load-translations   ││
│  └─────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────┬────────────────────────────────┘
                                     │ HTTP/SSE
┌────────────────────────────────────┴────────────────────────────────┐
│                           SERVER (Nitro)                             │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Server Middleware                             ││
│  │           auth | cache-headers | noindex                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                           │                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      API Handlers                                ││
│  │  /api/auth/*  /api/editions/*  /api/conventions/*  /api/admin/* ││
│  │  /api/carpool-*  /api/notifications/*  /api/messenger/*         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                           │                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     Utils & Services                             ││
│  │  prisma | permissions | auth-utils | email | notifications      ││
│  │  rate-limiter | validation | SSE managers | error-logger        ││
│  └─────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────┬────────────────────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────┐
│                           DATABASE                                   │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                        MySQL + Prisma                            ││
│  │   ~60 modeles | Relations complexes | Indexes optimises          ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘

                    EXTERNAL SERVICES
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Firebase FCM  │  │   HelloAsso     │  │   SMTP Email    │
│   Push Notifs   │  │   Ticketing     │  │   Nodemailer    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Flux d'authentification

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │   Server    │     │  Database   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  POST /api/auth/login                 │
       │  {identifier, password}               │
       │──────────────────>│                   │
       │                   │  Verify user      │
       │                   │──────────────────>│
       │                   │<──────────────────│
       │                   │                   │
       │                   │  bcrypt.compare() │
       │                   │  setUserSession() │
       │                   │  (sealed cookie)  │
       │                   │                   │
       │  Set-Cookie: session=...             │
       │<──────────────────│                   │
       │                   │                   │
       │  Subsequent requests with cookie      │
       │──────────────────>│                   │
       │                   │  getUserSession() │
       │                   │  (validate cookie)│
       │                   │                   │
```

---

## Modele de donnees

### Entites principales

Le schema Prisma definit ~60 modeles. Voici les principales entites :

#### Utilisateurs et authentification

```prisma
model User {
  id                Int       @id @default(autoincrement())
  email             String    @unique
  emailHash         String    // MD5 pour Gravatar
  pseudo            String    @unique
  nom               String?
  prenom            String?
  password          String?
  authProvider      String    @default("email")  // email, google, facebook, MANUAL
  isGlobalAdmin     Boolean   @default(false)
  isEmailVerified   Boolean   @default(false)
  preferredLanguage String    @default("fr")
  // ... relations
}
```

#### Conventions et editions

```prisma
model Convention {
  id          Int       @id @default(autoincrement())
  name        String
  description String?   @db.Text
  logo        String?
  authorId    Int?      // Nullable pour imports
  isArchived  Boolean   @default(false)
  editions    Edition[]
  organizers  ConventionOrganizer[]
}

model Edition {
  id                Int       @id @default(autoincrement())
  name              String?
  conventionId      Int
  startDate         DateTime
  endDate           DateTime
  city              String
  country           String
  // ~50 champs de services (hasGym, hasCantine, etc.)
  volunteersOpen    Boolean   @default(false)
  workshopsEnabled  Boolean   @default(false)
  // ... relations
}
```

#### Systeme de permissions

```prisma
model ConventionOrganizer {
  id                  Int     @id @default(autoincrement())
  conventionId        Int
  userId              Int
  canEditConvention   Boolean @default(false)
  canDeleteConvention Boolean @default(false)
  canManageOrganizers Boolean @default(false)
  canManageVolunteers Boolean @default(false)
  canManageArtists    Boolean @default(false)
  canManageTicketing  Boolean @default(false)
  // Permissions par edition
  perEditionPermissions EditionOrganizerPermission[]
}

model EditionOrganizerPermission {
  organizerId         Int
  editionId           Int
  canEdit             Boolean @default(false)
  canDelete           Boolean @default(false)
  canManageVolunteers Boolean @default(false)
  canManageArtists    Boolean @default(false)
  canManageMeals      Boolean @default(false)
  canManageTicketing  Boolean @default(false)
}
```

### Diagramme ER simplifie

```
┌─────────────┐       ┌─────────────────────┐       ┌─────────────┐
│    User     │───────│ ConventionOrganizer │───────│ Convention  │
└─────────────┘  N:M  └─────────────────────┘  N:1  └─────────────┘
       │                        │                         │
       │                        │                         │ 1:N
       │                ┌───────┴───────┐                │
       │                │ EditionOrg.   │         ┌─────────────┐
       │                │ Permission    │─────────│   Edition   │
       │                └───────────────┘   N:1   └─────────────┘
       │                                                 │
       │                                          ┌──────┼──────┐
       │                                          │      │      │
       │                                    ┌─────┴──┐┌──┴───┐┌─┴────┐
       │                                    │Carpool ││Volun-││Ticket│
       │                                    │Offer   ││teer  ││Order │
       └────────────────────────────────────┴────────┘└──────┘└──────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Modules principaux                                │
├─────────────────────┬─────────────────────┬─────────────────────────┤
│ Covoiturage         │ Benevoles           │ Billetterie             │
├─────────────────────┼─────────────────────┼─────────────────────────┤
│ CarpoolOffer        │ VolunteerApplication│ TicketingOrder          │
│ CarpoolRequest      │ VolunteerTeam       │ TicketingOrderItem      │
│ CarpoolBooking      │ VolunteerTimeSlot   │ TicketingTier           │
│ CarpoolComment      │ VolunteerAssignment │ TicketingOption         │
│ CarpoolPassenger    │ VolunteerMeal       │ TicketingQuota          │
└─────────────────────┴─────────────────────┴─────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Autres modules                                    │
├─────────────────────┬─────────────────────┬─────────────────────────┤
│ Ateliers            │ Artistes/Spectacles │ Messagerie              │
├─────────────────────┼─────────────────────┼─────────────────────────┤
│ Workshop            │ EditionArtist       │ Conversation            │
│ WorkshopLocation    │ Show                │ ConversationParticipant │
│ WorkshopFavorite    │ ShowArtist          │ Message                 │
└─────────────────────┴─────────────────────┴─────────────────────────┘
```

---

## API Endpoints

### Vue d'ensemble des routes API

L'application expose ~150+ endpoints organises par domaine :

#### Authentification (`/api/auth/`)

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Connexion utilisateur |
| POST | `/api/auth/logout` | Deconnexion |
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/verify-email` | Verification email |
| POST | `/api/auth/resend-verification` | Renvoyer code |
| POST | `/api/auth/request-password-reset` | Demande reset MDP |
| POST | `/api/auth/reset-password` | Reset MDP |
| GET | `/api/auth/verify-reset-token` | Verifier token reset |
| POST | `/api/auth/check-email` | Verifier disponibilite email |

#### Conventions (`/api/conventions/`)

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/conventions/[id]` | Detail convention |
| POST | `/api/conventions` | Creer convention |
| DELETE | `/api/conventions/[id]` | Supprimer convention |
| PATCH | `/api/conventions/[id]/archive` | Archiver convention |
| GET | `/api/conventions/my-conventions` | Mes conventions |
| GET | `/api/conventions/[id]/editions` | Editions d'une convention |
| GET | `/api/conventions/[id]/organizers` | Organisateurs |
| POST | `/api/conventions/[id]/claim` | Revendiquer convention |

#### Editions (`/api/editions/`)

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/editions` | Liste editions (paginee, filtree) |
| GET | `/api/editions/[id]` | Detail edition |
| POST | `/api/editions` | Creer edition |
| PUT | `/api/editions/[id]` | Modifier edition |
| DELETE | `/api/editions/[id]` | Supprimer edition |

#### Benevoles (`/api/editions/[id]/volunteers/`)

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/volunteers/applications` | Liste candidatures |
| POST | `/volunteers/applications` | Postuler |
| PATCH | `/volunteers/applications/[appId]/status` | Accepter/Refuser |
| GET | `/volunteers/teams` | Equipes benevoles |
| POST | `/volunteers/teams` | Creer equipe |
| GET | `/volunteers/time-slots` | Creneaux planning |
| POST | `/volunteers/assignments` | Assigner benevole |

#### Billetterie (`/api/editions/[id]/ticketing/`)

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/ticketing/tiers` | Tarifs disponibles |
| POST | `/ticketing/orders` | Creer commande |
| GET | `/ticketing/orders` | Liste commandes |
| POST | `/ticketing/verify-qrcode` | Valider QR code |
| GET | `/ticketing/stats` | Statistiques |
| POST | `/ticketing/helloasso/orders` | Sync HelloAsso |

#### Covoiturage (`/api/carpool-offers/`, `/api/carpool-requests/`)

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/carpool-offers` | Creer offre |
| GET | `/carpool-offers/[id]` | Detail offre |
| POST | `/carpool-offers/[id]/bookings` | Reserver places |
| PUT | `/carpool-offers/[id]/bookings/[bId]` | Accepter/Refuser |
| POST | `/carpool-offers/[id]/comments` | Commenter |
| POST | `/carpool-requests` | Creer demande |

#### Notifications (`/api/notifications/`)

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/notifications` | Liste notifications |
| GET | `/notifications/stats` | Statistiques |
| PATCH | `/notifications/[id]/read` | Marquer comme lu |
| PATCH | `/notifications/mark-all-read` | Tout marquer lu |
| DELETE | `/notifications/[id]/delete` | Supprimer |
| GET | `/notifications/stream` | SSE temps reel |

#### Administration (`/api/admin/`)

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/admin/users` | Liste utilisateurs |
| GET | `/admin/users/[id]` | Detail utilisateur |
| PUT | `/admin/users/[id]` | Modifier utilisateur |
| DELETE | `/admin/users/[id]` | Supprimer utilisateur |
| POST | `/admin/users/[id]/impersonate` | Se faire passer pour |
| GET | `/admin/feedback` | Retours utilisateurs |
| GET | `/admin/error-logs` | Logs d'erreurs |
| POST | `/admin/backup/create` | Creer backup |

### Pattern des handlers API

Tous les handlers utilisent le wrapper `wrapApiHandler` :

```typescript
// server/api/auth/login.post.ts
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { authRateLimiter } from '@@/server/utils/rate-limiter'
import { z } from 'zod'

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
})

export default wrapApiHandler(
  async (event) => {
    await authRateLimiter(event)
    const body = await readBody(event)
    const { identifier, password, rememberMe } = loginSchema.parse(body)

    // ... logique metier

    await setUserSession(event, { user: { ... } }, sessionConfig)
    return { user: { ... } }
  },
  { operationName: 'Login' }
)
```

---

## Frontend - Pages et composants

### Pages principales (~60)

#### Pages publiques

| Route | Fichier | Description |
|-------|---------|-------------|
| `/` | `pages/index.vue` | Accueil avec carte et agenda |
| `/login` | `pages/login.vue` | Connexion |
| `/register` | `pages/register.vue` | Inscription |
| `/verify-email` | `pages/verify-email.vue` | Verification email |
| `/privacy-policy` | `pages/privacy-policy.vue` | Politique confidentialite |
| `/editions/[id]` | `pages/editions/[id]/index.vue` | Detail edition |
| `/editions/[id]/carpool` | `pages/editions/[id]/carpool.vue` | Covoiturage |
| `/editions/[id]/workshops` | `pages/editions/[id]/workshops.vue` | Ateliers |
| `/editions/[id]/volunteers` | `pages/editions/[id]/volunteers/index.vue` | Benevoles |

#### Pages authentifiees

| Route | Fichier | Description |
|-------|---------|-------------|
| `/profile` | `pages/profile.vue` | Profil utilisateur |
| `/favorites` | `pages/favorites.vue` | Mes favoris |
| `/notifications` | `pages/notifications.vue` | Notifications |
| `/messenger` | `pages/messenger.vue` | Messagerie |
| `/my-conventions` | `pages/my-conventions.vue` | Mes conventions |
| `/my-volunteer-applications` | `pages/my-volunteer-applications.vue` | Mes candidatures |

#### Pages de gestion (organisateurs)

| Route | Fichier | Description |
|-------|---------|-------------|
| `/editions/[id]/gestion` | `pages/editions/[id]/gestion/index.vue` | Dashboard gestion |
| `/editions/[id]/gestion/organizers` | `pages/editions/[id]/gestion/organizers.vue` | Organisateurs |
| `/editions/[id]/gestion/volunteers/*` | `pages/editions/[id]/gestion/volunteers/*.vue` | Gestion benevoles |
| `/editions/[id]/gestion/ticketing/*` | `pages/editions/[id]/gestion/ticketing/*.vue` | Gestion billetterie |
| `/editions/[id]/gestion/artists/*` | `pages/editions/[id]/gestion/artists/*.vue` | Gestion artistes |
| `/editions/[id]/gestion/meals/*` | `pages/editions/[id]/gestion/meals/*.vue` | Gestion repas |

#### Pages administration

| Route | Fichier | Description |
|-------|---------|-------------|
| `/admin` | `pages/admin/index.vue` | Dashboard admin |
| `/admin/users` | `pages/admin/users/index.vue` | Gestion utilisateurs |
| `/admin/conventions` | `pages/admin/conventions.vue` | Gestion conventions |
| `/admin/feedback` | `pages/admin/feedback.vue` | Retours utilisateurs |
| `/admin/error-logs` | `pages/admin/error-logs.vue` | Logs d'erreurs |
| `/admin/crons` | `pages/admin/crons.vue` | Taches planifiees |
| `/admin/backup` | `pages/admin/backup.vue` | Sauvegardes |

### Composants principaux (~100+)

#### Composants UI generiques (`app/components/ui/`)

- `ConfirmModal.vue` - Modale de confirmation
- `DateTimePicker.vue` - Selecteur date/heure
- `ImageUpload.vue` - Upload d'images
- `SelectLanguage.vue` - Selecteur de langue
- `UserDisplay.vue` - Affichage utilisateur
- `LazyFullCalendar.vue` - Calendrier FullCalendar

#### Composants metier

- `EditionCard.vue` - Carte d'edition
- `FiltersPanel.vue` - Panneau de filtres
- `HomeMap.vue` - Carte des conventions
- `HomeAgenda.vue` - Agenda des conventions
- `FavoritesMap.vue` - Carte des favoris
- `UserSelector.vue` - Selecteur d'utilisateur
- `CountryMultiSelect.vue` - Selection multi-pays
- `MinimalMarkdownEditor.vue` - Editeur Markdown

#### Composants benevoles (`app/components/edition/volunteer/`)

- `ApplicationModal.vue` - Modale candidature
- `Table.vue` - Tableau benevoles
- `planning/PlanningCard.vue` - Planning
- `planning/SlotModal.vue` - Edition creneaux
- `notifications/Manager.vue` - Gestionnaire notifs

#### Composants billetterie (`app/components/ticketing/`)

- `QrCodeScanner.vue` - Scanner QR
- `CustomFieldsList.vue` - Champs personnalises
- `QuotasList.vue` - Gestion quotas
- `stats/*.vue` - Graphiques statistiques

### Layouts

```vue
<!-- app/layouts/default.vue -->
<template>
  <div>
    <AppHeader />
    <UMain>
      <UPage>
        <UPageBody>
          <UContainer>
            <slot />
          </UContainer>
        </UPageBody>
      </UPage>
    </UMain>
    <AppFooter />
  </div>
</template>
```

---

## Gestion d'etat (Pinia Stores)

### Stores disponibles

| Store | Fichier | Description |
|-------|---------|-------------|
| `auth` | `stores/auth.ts` | Authentification et session |
| `editions` | `stores/editions.ts` | Gestion des editions |
| `favoritesEditions` | `stores/favoritesEditions.ts` | Editions favorites |
| `notifications` | `stores/notifications.ts` | Notifications |
| `impersonation` | `stores/impersonation.ts` | Mode impersonation admin |

### Store Auth

```typescript
// app/stores/auth.ts
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    rememberMe: false,
    adminMode: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    isGlobalAdmin: (state) => state.user?.isGlobalAdmin || false,
    isAdminModeActive: (state) => state.user?.isGlobalAdmin && state.adminMode,
  },
  actions: {
    async register(email, password, pseudo, nom, prenom) { ... },
    async login(identifier, password, rememberMe = false) { ... },
    async logout() { ... },
    initializeAuth() { ... },
    updateUser(updatedUser: Partial<User>) { ... },
    enableAdminMode() { ... },
    disableAdminMode() { ... },
  },
})
```

### Store Editions

```typescript
// app/stores/editions.ts
export const useEditionStore = defineStore('editions', {
  state: () => ({
    editions: [] as Edition[],
    loading: false,
    error: null as string | null,
    pagination: { total: 0, page: 1, limit: 12, totalPages: 0 },
    allEditions: [] as Edition[], // Pour l'agenda
  }),
  getters: {
    getEditionById: (state) => (id: number) =>
      state.editions.find((edition) => edition.id === id),
  },
  actions: {
    async fetchEditions(filters?: EditionFilters) { ... },
    async fetchEditionById(id: number, opts?) { ... },
    async addEdition(editionData) { ... },
    async updateEdition(id, editionData) { ... },
    async deleteEdition(id) { ... },
    // Methodes de permissions
    canEditEdition(edition, userId): boolean { ... },
    canDeleteEdition(edition, userId): boolean { ... },
    canManageVolunteers(edition, userId): boolean { ... },
    canManageArtists(edition, userId): boolean { ... },
    isOrganizer(edition, userId): boolean { ... },
  },
})
```

### Store Notifications

```typescript
// app/stores/notifications.ts
export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    notifications: [] as Notification[],
    unreadCount: 0,
    loading: false,
    realTimeEnabled: false,
    // ...
  }),
  getters: {
    unreadNotifications: (state) => state.notifications.filter(n => !n.isRead),
    notificationsByCategory: (state) => { ... },
    recentNotifications: (state) => state.notifications.filter(n => !n.isRead).slice(0, 5),
  },
  actions: {
    async fetchNotifications(filters, append = false) { ... },
    async markAsRead(notificationId) { ... },
    async markAllAsRead(category?) { ... },
    addRealTimeNotification(notification) { ... }, // Via SSE
    // ...
  },
})
```

---

## Systeme d'authentification

### Vue d'ensemble

L'authentification utilise `nuxt-auth-utils` avec des sessions basees sur des cookies scelles (sealed cookies).

### Flux de connexion

1. **Client** : Envoie identifiant/mot de passe via `POST /api/auth/login`
2. **Serveur** :
   - Valide les credentials avec bcrypt
   - Verifie que l'email est confirme
   - Cree une session avec `setUserSession()`
   - Retourne un cookie scelle
3. **Client** :
   - Stocke les infos user dans le store
   - Les requetes suivantes incluent automatiquement le cookie

### Middlewares client

```typescript
// app/middleware/auth-protected.ts
export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return

  const authStore = useAuthStore()

  // Hydratation depuis localStorage/sessionStorage
  if (!authStore.user) {
    const stored = localStorage.getItem('authUser') || sessionStorage.getItem('authUser')
    if (stored) authStore.user = JSON.parse(stored)
  }

  // Fallback: fetch session depuis serveur
  if (!authStore.user) {
    try {
      const { user } = await $fetch('/api/session/me')
      authStore.user = user
    } catch { /* ignore */ }
  }

  // Redirection si non authentifie
  if (!authStore.user) {
    const { buildLoginUrl } = useReturnTo()
    return navigateTo(buildLoginUrl(to.fullPath))
  }
})
```

### Middlewares disponibles

| Middleware | Description |
|------------|-------------|
| `auth-protected.ts` | Pages necessitant authentification |
| `guest-only.ts` | Pages pour non-connectes (login, register) |
| `super-admin.ts` | Pages admin uniquement |
| `authenticated.ts` | Variante auth-protected |
| `verify-email-access.ts` | Acces page verification email |
| `load-translations.global.ts` | Chargement traductions |

### Plugin d'initialisation

```typescript
// app/plugins/auth.client.ts
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    const authStore = useAuthStore()
    authStore.initializeAuth() // Hydrate depuis session serveur
  }
})
```

---

## Internationalisation (i18n)

### Configuration

```typescript
// nuxt.config.ts
i18n: {
  lazy: true,  // Lazy loading des traductions
  defaultLocale: 'en',
  locales: [
    { code: 'fr', language: 'fr', name: 'Francais', files: ['fr/common.json', ...] },
    { code: 'en', language: 'en', name: 'English', files: ['en/common.json', ...] },
    { code: 'de', language: 'de', name: 'Deutsch', files: ['de/common.json', ...] },
    // ... 13 langues au total
  ],
  langDir: 'locales/',
  strategy: 'no_prefix',  // Pas de prefixe URL
  detectBrowserLanguage: {
    useCookie: true,
    cookieKey: 'i18n_redirected',
    redirectOn: 'root',
    fallbackLocale: 'en',
  },
}
```

### Langues supportees

| Code | Langue | Statut |
|------|--------|--------|
| `fr` | Francais | Reference |
| `en` | English | Complete |
| `de` | Deutsch | Complete |
| `es` | Espanol | Complete |
| `it` | Italiano | Complete |
| `nl` | Nederlands | Complete |
| `pl` | Polski | Complete |
| `pt` | Portugues | Complete |
| `ru` | Russky | Complete |
| `sv` | Svenska | Complete |
| `cs` | Cestina | Complete |
| `da` | Dansk | Complete |
| `uk` | Ukrainska | Complete |

### Structure des fichiers de traduction

```
i18n/locales/
├── fr/                    # Langue de reference
│   ├── common.json        # Traductions communes
│   ├── notifications.json # Notifications
│   ├── components.json    # Composants UI
│   ├── app.json          # Application generale
│   ├── public.json       # Pages publiques
│   ├── feedback.json     # Retours utilisateurs
│   └── gestion.json      # Gestion (FR uniquement)
├── en/
│   └── ...
└── ...
```

### Scripts i18n

```bash
npm run check-i18n        # Analyse cles manquantes/inutilisees
npm run check-translations # Compare traductions entre locales
npm run i18n:add          # Ajouter une traduction
npm run i18n:mark-todo    # Marquer cles modifiees comme [TODO]
```

---

## Tests

### Configuration

Le projet utilise Vitest avec plusieurs configurations :

```typescript
// vitest.config.ts (simplifie)
export default {
  projects: [
    { name: 'unit', ... },        // Tests unitaires
    { name: 'nuxt', ... },        // Tests Nuxt
    { name: 'integration', ... }, // Tests DB
    { name: 'e2e', ... },         // Tests E2E
  ]
}
```

### Structure des tests

```
test/
├── unit/                     # Tests unitaires (~15 fichiers)
│   ├── composables/          # Tests composables
│   ├── stores/               # Tests Pinia stores
│   ├── utils/                # Tests utilitaires
│   ├── i18n/                 # Tests traductions
│   └── security/             # Tests securite
├── nuxt/                     # Tests Nuxt (~50 fichiers)
│   ├── components/           # Tests composants
│   ├── features/             # Tests fonctionnalites
│   ├── middleware/           # Tests middlewares
│   ├── pages/                # Tests pages
│   └── server/               # Tests API
│       ├── api/              # Tests endpoints
│       └── utils/            # Tests utils serveur
├── integration/              # Tests integration DB (~7 fichiers)
└── e2e/                      # Tests end-to-end
```

### Commandes de test

```bash
npm run test              # Tests unitaires (watch)
npm run test:unit:run     # Tests unitaires (run)
npm run test:nuxt:run     # Tests Nuxt
npm run test:all          # Tous les tests
npm run test:db:run       # Tests integration DB
npm run docker:test       # Tests dans Docker
```

### Exemple de test

```typescript
// test/nuxt/server/api/conventions/create.test.ts
import { describe, it, expect, vi } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'

describe('POST /api/conventions', () => {
  it('should create a convention for authenticated user', async () => {
    // Mock Prisma
    const mockConvention = { id: 1, name: 'Test' }
    vi.mocked(prisma.convention.create).mockResolvedValue(mockConvention)

    // Call endpoint
    const result = await $fetch('/api/conventions', {
      method: 'POST',
      body: { name: 'Test', description: 'Description' }
    })

    expect(result).toMatchObject({ id: 1, name: 'Test' })
  })
})
```

---

## Patterns et conventions

### API Handlers

**Pattern `wrapApiHandler`** : Tous les handlers utilisent ce wrapper pour :
- Gestion centralisee des erreurs
- Transformation des erreurs Zod en 400
- Transformation des erreurs Prisma
- Logging des erreurs

```typescript
export default wrapApiHandler(
  async (event) => {
    // Validation
    const body = schema.parse(await readBody(event))

    // Logique metier
    const result = await prisma.model.create({ data: body })

    return result
  },
  { operationName: 'CreateResource' }
)
```

### Helpers Prisma Select

Pour eviter la duplication des selections de champs :

```typescript
// server/utils/prisma-select-helpers.ts
export const userBasicSelect = { id: true, pseudo: true }
export const userWithProfileSelect = { id: true, pseudo: true, profilePicture: true }
export const carpoolUserSelect = userWithProfileAndGravatarSelect

// Utilisation
const users = await prisma.user.findMany({
  select: userBasicSelect
})
```

### Composables

**Pattern des composables** :
- Prefixe `use` (ex: `useDateFormat`, `useLeafletMap`)
- Retourne des refs reactives et des fonctions
- Gere le cleanup automatiquement

```typescript
// app/composables/useDateFormat.ts
export function useDateFormat() {
  const { locale } = useI18n()

  const formatDate = (date: string | Date, format = 'long') => {
    // ...
  }

  return { formatDate }
}
```

### Permissions

**Systeme de permissions granulaire** :
- Permissions globales sur la convention
- Permissions specifiques par edition
- Verification cote client ET serveur

```typescript
// Client (store)
const canEdit = editionStore.canEditEdition(edition, userId)

// Serveur (utils)
const hasPermission = await hasEditionEditPermission(userId, editionId)
if (!hasPermission) throw createError({ statusCode: 403 })
```

### Validation

**Zod pour validation** :
- Schemas reutilisables
- Messages d'erreur i18n
- Transformation automatique des erreurs

```typescript
const editionSchema = z.object({
  name: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  city: z.string().min(1),
  country: z.string().length(2),
  // ...
})
```

### Notifications temps reel

**SSE (Server-Sent Events)** pour :
- Notifications utilisateur
- Stats billetterie en temps reel
- Compteurs de caisse
- Indicateurs de frappe messagerie

```typescript
// Serveur
export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/event-stream')
  const stream = createStream()
  // ...
})

// Client (composable)
const { connect, disconnect } = useNotificationStream()
```

---

## Diagrammes d'architecture

### Flux de donnees - Page Edition

```
┌─────────────────────────────────────────────────────────────────┐
│                    Page editions/[id]/index.vue                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        v                       v                       v
┌───────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ useAsyncData  │   │   EditionStore    │   │  FavoritesStore   │
│ fetch edition │   │  getEditionById   │   │   isFavorite      │
└───────┬───────┘   └─────────┬─────────┘   └─────────┬─────────┘
        │                     │                       │
        │                     v                       │
        │           ┌───────────────────┐             │
        │           │    Composables    │             │
        │           │ useEditionStatus  │             │
        │           │ useOrganizerTitle │             │
        │           │   useDateFormat   │             │
        │           └─────────┬─────────┘             │
        │                     │                       │
        v                     v                       v
┌─────────────────────────────────────────────────────────────────┐
│                        Vue Template                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ EditionCard │  │  Services   │  │  Actions    │              │
│  │   Header    │  │   Icons     │  │  Buttons    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture des permissions

```
┌─────────────────────────────────────────────────────────────────┐
│                    Verification Permission                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    v                       v
          ┌─────────────────┐     ┌─────────────────┐
          │   Global Admin  │     │  Non-Admin User │
          │   isGlobalAdmin │     │                 │
          └────────┬────────┘     └────────┬────────┘
                   │                       │
          (acces total)              ┌─────┴─────┐
                                     v           v
                           ┌───────────────┐ ┌───────────────┐
                           │    Auteur     │ │  Organisateur │
                           │ authorId ==   │ │  Convention   │
                           │   userId      │ └───────┬───────┘
                           └───────────────┘         │
                                               ┌─────┴─────┐
                                               v           v
                                    ┌───────────────┐ ┌───────────────┐
                                    │   Droits      │ │   Droits      │
                                    │   Globaux     │ │   Par Edition │
                                    │ canEditConv.. │ │ perEdition... │
                                    └───────────────┘ └───────────────┘
```

### Cycle de vie d'une commande de billetterie

```
┌─────────────────────────────────────────────────────────────────┐
│                   Flux Billetterie                               │
└─────────────────────────────────────────────────────────────────┘

  HelloAsso                       Application
     │                                │
     │  Webhook notification          │
     │──────────────────────────────>│
     │                                │
     │              ┌─────────────────┴─────────────────┐
     │              v                                   │
     │    ┌─────────────────┐                          │
     │    │ Parse HelloAsso │                          │
     │    │     payload     │                          │
     │    └────────┬────────┘                          │
     │             │                                   │
     │             v                                   │
     │    ┌─────────────────┐     ┌─────────────────┐ │
     │    │  Upsert Order   │────>│  Upsert Items   │ │
     │    └────────┬────────┘     └────────┬────────┘ │
     │             │                       │          │
     │             v                       v          │
     │    ┌─────────────────┐     ┌─────────────────┐ │
     │    │  Match Tiers    │     │ Process Custom  │ │
     │    │   & Options     │     │    Fields       │ │
     │    └────────┬────────┘     └────────┬────────┘ │
     │             │                       │          │
     │             └───────────┬───────────┘          │
     │                         │                      │
     │                         v                      │
     │              ┌─────────────────┐               │
     │              │ Update Quotas   │               │
     │              │  if configured  │               │
     │              └────────┬────────┘               │
     │                       │                        │
     │                       v                        │
     │              ┌─────────────────┐               │
     │              │ Broadcast SSE   │               │
     │              │   stats update  │               │
     │              └─────────────────┘               │
     │                                                │
```

---

## Recommandations

### Points forts

1. **Architecture modulaire** : Separation claire frontend/backend avec Nuxt
2. **Typage fort** : TypeScript partout, schemas Zod pour validation
3. **Permissions granulaires** : Systeme flexible et scalable
4. **Internationalisation** : Support de 13 langues avec lazy loading
5. **Tests complets** : Unit, integration, E2E
6. **Helpers reutilisables** : prisma-select-helpers, api-helpers
7. **Documentation inline** : Commentaires detailles dans le code
8. **PWA** : Application installable

### Points d'amelioration suggeres

1. **Couverture de tests** : Augmenter la couverture des tests E2E
2. **Documentation API** : Ajouter OpenAPI/Swagger pour l'API
3. **Monitoring** : Integrer des outils de monitoring (Sentry, etc.)
4. **Cache** : Implementer un cache Redis pour les donnees frequentes
5. **Rate limiting** : Etendre aux endpoints critiques
6. **Audit logs** : Journaliser les actions admin sensibles

### Securite

- [x] Mots de passe hashes (bcrypt)
- [x] Sessions scellees (cookies signes)
- [x] Rate limiting sur authentification
- [x] Validation des entrees (Zod)
- [x] Verification email obligatoire
- [x] Permissions verifiees cote serveur
- [ ] CSP headers (a verifier)
- [ ] Audit de securite complet

### Performance

- [x] Lazy loading des traductions
- [x] Pagination des listes
- [x] Indexes Prisma optimises
- [x] Compression des assets (gzip/brotli)
- [x] Icons en mode remote (reduit la taille du bundle)
- [ ] Cache HTTP (a optimiser)
- [ ] Optimisation des queries N+1

---

## Conclusion

Le projet **Juggling Convention** est une application mature et bien structuree, suivant les meilleures pratiques modernes du developpement web full-stack. L'architecture modulaire, le typage fort, et le systeme de permissions granulaire en font une base solide pour l'evolution future.

Les principaux domaines fonctionnels (conventions, benevoles, billetterie, covoiturage, messagerie) sont bien implementes avec une attention particuliere portee a l'experience utilisateur et a l'internationalisation.

---

*Document genere le 5 janvier 2026*
*Version du codebase analysee : main (commit 59ccbcdf)*
