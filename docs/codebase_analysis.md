# Analyse complète du codebase — Convention de Jonglerie

> **Dernière mise à jour** : 27 février 2026
> **Taille du projet** : ~195 Mo | ~2 836 fichiers de code | ~6 845 fichiers au total

## Table des matières

- [1. Vue d'ensemble du projet](#1-vue-densemble-du-projet)
- [2. Architecture technique](#2-architecture-technique)
- [3. Structure des répertoires](#3-structure-des-répertoires)
- [4. Couche données (Prisma)](#4-couche-données-prisma)
- [5. Backend — API et serveur](#5-backend--api-et-serveur)
- [6. Frontend — Pages, composants et stores](#6-frontend--pages-composants-et-stores)
- [7. Internationalisation (i18n)](#7-internationalisation-i18n)
- [8. Tests](#8-tests)
- [9. CI/CD et déploiement](#9-cicd-et-déploiement)
- [10. Stack technologique](#10-stack-technologique)
- [11. Diagramme d'architecture](#11-diagramme-darchitecture)
- [12. Points clés et recommandations](#12-points-clés-et-recommandations)

---

## 1. Vue d'ensemble du projet

**Convention de Jonglerie** est une application web full-stack pour la gestion et la découverte de conventions de jonglerie. Elle permet de :

- Consulter, créer et gérer des conventions et leurs éditions annuelles
- Gérer la billetterie (tiers, options, quotas, commandes, contrôle d'accès)
- Organiser le bénévolat (candidatures, équipes, créneaux, planning)
- Gérer les artistes (shows, appels à spectacles, hébergement, repas)
- Proposer du covoiturage (offres, demandes, réservations)
- Communiquer via une messagerie temps réel
- Gérer les ateliers (workshops)
- Publier des posts et des objets trouvés/perdus
- Administrer le système (logs, notifications, backup, import)

| Métrique | Valeur |
|----------|--------|
| Type | Application web full-stack (SSR) |
| Langage | TypeScript |
| Framework | Nuxt 4 (Vue 3 + Nitro) |
| Base de données | MySQL 8.0 via Prisma ORM |
| Endpoints API | 366 |
| Modèles Prisma | 73 |
| Pages Vue | 98 |
| Composants Vue | 137 |
| Composables | 48 |
| Langues supportées | 13 |
| Tests | 1981 (367 unit + 1614 Nuxt) |

---

## 2. Architecture technique

### Pattern architectural

L'application suit une architecture **monolithique full-stack** avec Nuxt 4, combinant le frontend Vue 3 et le backend Nitro dans un seul projet. La séparation est assurée par la structure de répertoires :

- `app/` — Frontend (pages, composants, stores, composables)
- `server/` — Backend (API REST, middleware, utils, plugins)
- `prisma/` — Couche données (schéma, migrations)
- `shared/` — Types et utilitaires partagés client/serveur

### Flux de requête

```
Client (Vue 3 + Pinia)
    │
    ├── useApiAction() ──── Smart unwrap automatique
    │   ou $fetch direct
    │
    ▼
Nitro Server
    │
    ├── Middleware (auth, cache-headers, noindex)
    │
    ├── wrapApiHandler() ──── Gestion d'erreurs standardisée
    │   ├── requireAuth() ──── Vérification session
    │   ├── Zod validation ──── Validation des données
    │   ├── Permission checks ──── Contrôle d'accès
    │   └── Prisma queries ──── Accès base de données
    │
    ├── createSuccessResponse() ──── Format { success, data, message? }
    │   ou createPaginatedResponse() ──── + pagination metadata
    │
    ▼
MySQL 8.0 (via Prisma ORM)
```

### Authentification

- **Session-based** avec cookies scellés (nuxt-auth-utils)
- OAuth : Google et Facebook
- Auth manuelle : email/password avec bcrypt
- Vérification email par token
- Réinitialisation de mot de passe
- Mode admin avec impersonation

### Patterns clés

| Pattern | Implémentation |
|---------|---------------|
| API wrapper | `wrapApiHandler()` — 366/366 endpoints (100%) |
| Réponse standardisée | `createSuccessResponse()` — 246/366 endpoints (67%) |
| Smart unwrap frontend | `unwrapApiResponse()` dans `useApiAction` |
| Helpers Prisma | `prisma-select-helpers.ts` — sélections réutilisables |
| Permissions | 6 fichiers dédiés dans `server/utils/permissions/` |
| Validation | Zod schemas pour toutes les entrées |

---

## 3. Structure des répertoires

```
convention-de-jonglerie/
│
├── app/                          # Frontend Nuxt
│   ├── assets/                   #   CSS, images
│   ├── components/               #   137 composants Vue (26 sous-dossiers)
│   ├── composables/              #   48 composables TypeScript
│   ├── config/                   #   Configuration Firebase
│   ├── layouts/                  #   4 layouts (default, edition-dashboard, guide, messenger)
│   ├── middleware/               #   6 middleware client (auth, guest, admin, i18n)
│   ├── pages/                    #   98 pages Vue
│   ├── plugins/                  #   7 plugins (auth, firebase, countries, etc.)
│   ├── stores/                   #   5 stores Pinia (auth, editions, favorites, notifications, impersonation)
│   ├── types/                    #   6 fichiers de types TypeScript
│   └── utils/                    #   22 utilitaires (+ ticketing/)
│
├── server/                       # Backend Nitro
│   ├── api/                      #   366 endpoints REST (19 domaines)
│   ├── constants/                #   Permissions, routes publiques
│   ├── emails/                   #   6 templates d'email Vue
│   ├── generated/prisma/         #   Client Prisma généré
│   ├── middleware/               #   3 middleware serveur (auth, cache, noindex)
│   ├── plugins/                  #   4 plugins (countries, error-logging, scheduler, recaptcha)
│   ├── routes/                   #   Routes spéciales (auth OAuth, uploads, service worker)
│   ├── tasks/                    #   5 tâches CRON
│   ├── types/                    #   Types API et Prisma
│   └── utils/                    #   69+ utilitaires (+ permissions/, ticketing/, editions/)
│
├── prisma/                       # Couche données
│   ├── schema/                   #   9 fichiers .prisma modulaires (73 modèles)
│   └── migrations/               #   144 migrations
│
├── i18n/locales/                 # Traductions
│   ├── fr/                       #   15 fichiers domaine (référence)
│   ├── en/                       #   15 fichiers domaine
│   └── [11 autres langues]/      #   cs, da, de, es, it, nl, pl, pt, ru, sv, uk
│
├── test/                         # Tests
│   ├── unit/                     #   18 fichiers (367 tests)
│   ├── nuxt/                     #   160 fichiers (1614 tests)
│   ├── integration/              #   7 fichiers (tests DB)
│   └── e2e/                      #   Tests end-to-end
│
├── docs/                         # Documentation
│   ├── system/                   #   Architecture et systèmes internes
│   ├── ticketing/                #   Documentation billetterie
│   ├── volunteers/               #   Documentation bénévolat
│   ├── docker/                   #   Guides Docker
│   ├── integrations/             #   Intégrations externes
│   └── optimization/             #   Guides d'optimisation
│
├── lib/schemas/                  # Schémas de validation partagés
├── scripts/                      # Scripts utilitaires (seed, admin, i18n)
├── docker/                       # Configuration Docker
└── public/                       # Assets statiques (logos, favicons, uploads)
```

---

## 4. Couche données (Prisma)

### Organisation du schéma

Le schéma Prisma est divisé en **9 fichiers modulaires** dans `prisma/schema/` :

| Fichier | Modèles | Description |
|---------|---------|-------------|
| `schema.prisma` | User, Convention, Edition, ConventionOrganizer, EditionOrganizer, etc. | Modèles principaux |
| `ticketing.prisma` | TicketingTier, TicketingOption, TicketingQuota, Order, OrderItem, etc. | Système de billetterie (16 modèles) |
| `volunteer.prisma` | VolunteerApplication, VolunteerTeam, VolunteerTimeSlot, VolunteerAssignment, etc. | Gestion des bénévoles (9 modèles) |
| `carpool.prisma` | CarpoolOffer, CarpoolRequest, CarpoolBooking, CarpoolPassenger, etc. | Covoiturage (7 modèles) |
| `meals.prisma` | VolunteerMeal, ArtistMealSelection, MealValidation, etc. | Gestion des repas (6 modèles) |
| `messenger.prisma` | Conversation, Message, ConversationParticipant | Messagerie (3 modèles) |
| `workshops.prisma` | Workshop, WorkshopLocation, WorkshopFavorite | Ateliers (3 modèles) |
| `artists.prisma` | EditionArtist, EditionShowCall, ShowApplication | Artistes et spectacles |
| `misc.prisma` | Feedback, ApiErrorLog, PushSubscription, etc. | Modèles utilitaires |

**Total : 73 modèles** — **144 migrations** depuis septembre 2025

### Base de données

- **MySQL 8.0** avec adaptateur MariaDB pour Prisma
- Client généré dans `server/generated/prisma/`
- Helpers de sélection dans `server/utils/prisma-select-helpers.ts` (600+ lignes)

### Helpers Prisma Select

Patterns réutilisables pour éviter la duplication de sélections :

```typescript
// Exemples de helpers
export const userBasicSelect = { id: true, pseudo: true } satisfies Prisma.UserSelect
export const userWithProfileSelect = { ...userBasicSelect, profilePicture: true }
export const userWithNameSelect = { ...userBasicSelect, nom: true, prenom: true }
// ... 20+ helpers couvrant tous les modèles
```

---

## 5. Backend — API et serveur

### Vue d'ensemble des endpoints

**366 endpoints** organisés en **19 domaines** :

| Domaine | Endpoints | % | Description |
|---------|-----------|---|-------------|
| `editions/` | 214 | 58% | Gestion complète des éditions |
| `admin/` | 51 | 14% | Administration système |
| `conventions/` | 20 | 5% | CRUD conventions |
| `messenger/` | 16 | 4% | Messagerie temps réel |
| `notifications/` | 12 | 3% | Notifications push/in-app |
| `auth/` | 10 | 3% | Authentification |
| `profile/` | 9 | 2% | Profil utilisateur |
| `carpool-offers/` | 9 | 2% | Offres covoiturage |
| `files/` | 6 | 2% | Upload de fichiers |
| `carpool-requests/` | 4 | 1% | Demandes covoiturage |
| Autres | 15 | 4% | sitemap, users, feedback, etc. |

### Répartition par méthode HTTP

| Méthode | Nombre | % |
|---------|--------|---|
| GET | 151 | 41% |
| POST | 104 | 28% |
| PUT | 42 | 11% |
| DELETE | 42 | 11% |
| PATCH | 27 | 7% |

### Helpers API (`server/utils/api-helpers.ts`)

| Fonction | Rôle |
|----------|------|
| `wrapApiHandler()` | Wrapper standardisé pour tous les endpoints (gestion erreurs Zod, Prisma, ApiError) |
| `handlePrismaError()` | Conversion des erreurs Prisma en erreurs HTTP (P2002→409, P2025→404, P2003→400) |
| `createSuccessResponse<T>()` | Format `{ success: true, data: T, message?: string }` |
| `createPaginatedResponse<T>()` | Format paginé avec metadata (page, limit, totalCount, totalPages) |

### Authentification et permissions (`server/utils/auth-utils.ts`)

| Fonction | Rôle |
|----------|------|
| `requireAuth()` | Exige une session authentifiée |
| `requireGlobalAdmin()` | Exige le rôle admin global |
| `optionalAuth()` | Auth optionnelle (retourne null si non connecté) |
| `requireResourceOwner()` | Vérifie la propriété d'une ressource |
| `requireUserOrGlobalAdmin()` | Propriétaire ou admin |

### Système de permissions (`server/utils/permissions/`)

6 fichiers de permissions spécialisés :

| Fichier | Fonctions clés |
|---------|---------------|
| `edition-permissions.ts` | `canEditEdition`, `canDeleteEdition`, `canManageArtists`, `canManageMeals`, `canManageTicketing` |
| `convention-permissions.ts` | Permissions au niveau convention |
| `volunteer-permissions.ts` | Permissions bénévolat |
| `workshop-permissions.ts` | Permissions ateliers |
| `access-control-permissions.ts` | Contrôle d'accès billetterie |
| `meal-validation-permissions.ts` | Validation des repas |

### Utilitaires serveur (69+ fichiers)

**Catégories principales :**

- **API et réponses** : api-helpers, validation-helpers, validation-schemas, prisma-helpers
- **Auth et sécurité** : auth-utils, encryption, rate-limiter, api-rate-limiter
- **Notifications** : notification-service, notification-preferences, notification-stream-manager, unified-push-service
- **Bénévolat** : volunteer-scheduler (24KB), volunteer-application-diff, volunteer-meals
- **Messagerie** : messenger-helpers (16KB), messenger-unread-service
- **Fichiers** : file-helpers, move-temp-image, image-deletion
- **IA** : ai-config, ai-providers, llm-client (intégration Anthropic, Ollama, LM Studio)
- **Import** : jugglingedge-scraper, facebook-event-scraper, web-content-extractor, web-content-cache
- **Email** : emailService (SMTP configurable)

### Tâches CRON (`server/tasks/`)

| Tâche | Description |
|-------|-------------|
| `cleanup-empty-conversations.ts` | Supprime les conversations vides |
| `cleanup-expired-tokens.ts` | Supprime les tokens expirés |
| `cleanup-resolved-error-logs.ts` | Archive les logs d'erreur résolus |
| `convention-favorites-reminders.ts` | Rappels pour les conventions favorites |
| `volunteer-reminders.ts` | Rappels pour les créneaux bénévoles |

### Templates email (`server/emails/`)

6 composants Vue pour les emails : BaseEmail, VerificationEmail, PasswordResetEmail, NotificationEmail, AccountDeletionEmail, VolunteerScheduleEmail

---

## 6. Frontend — Pages, composants et stores

### Pages (98 fichiers Vue)

**Structure des routes :**

| Section | Pages | Description |
|---------|-------|-------------|
| Auth | 8 | Login, register, verify-email, forgot/reset password, complete-profile, logout |
| Accueil et navigation | 4 | Index, favorites, notifications, messenger |
| Conventions | 5 | CRUD conventions, mes conventions |
| Éditions — public | 10 | Détail, carpool, commentaires, lost-found, map, workshops, artist-space |
| Éditions — gestion | 30+ | Dashboard complet : artistes, bénévoles, billetterie, repas, ateliers, shows, map, organisateurs |
| Admin | 11 | Dashboard, conventions, users, backup, crons, logs, notifications, feedback, import |
| Guide | 12 | Guides utilisateur, artiste, bénévole, organisateur (8 sous-pages) |
| Profil | 3 | Profile, mes candidatures artiste/bénévole |
| Autres | 5 | Privacy policy, welcome/categories, shows-call |

**Arborescence des routes principales :**

```
/                                    # Accueil (carte + agenda)
├── /login, /register, /logout       # Authentification
├── /verify-email                    # Vérification email
├── /auth/forgot-password, /auth/reset-password
├── /auth/complete-profile
│
├── /favorites                       # Conventions favorites
├── /notifications                   # Centre de notifications
├── /messenger                       # Messagerie
├── /profile                         # Profil utilisateur
├── /my-conventions                  # Mes conventions
├── /my-artist-applications          # Mes candidatures artiste
├── /my-volunteer-applications       # Mes candidatures bénévole
│
├── /conventions/add                 # Créer une convention
├── /conventions/[id]/edit           # Modifier une convention
├── /conventions/[id]/editions/add   # Ajouter une édition
│
├── /editions/add                    # Créer une édition
├── /editions/[id]/                  # Détail d'une édition
├── /editions/[id]/edit              # Modifier une édition
├── /editions/[id]/carpool           # Covoiturage
├── /editions/[id]/workshops         # Ateliers
├── /editions/[id]/map               # Carte interactive
├── /editions/[id]/gestion/          # Dashboard de gestion
│   ├── artists/                     #   Artistes et shows
│   ├── volunteers/                  #   Bénévolat (config, form, teams, planning, etc.)
│   ├── ticketing/                   #   Billetterie (tiers, options, orders, stats, etc.)
│   ├── meals/                       #   Repas (list, validate)
│   ├── workshops/                   #   Ateliers
│   ├── shows-call/                  #   Appels à spectacles
│   ├── organizers                   #   Organisateurs
│   └── map                          #   Gestion de la carte
│
├── /admin/                          # Administration
│   ├── conventions, users/, feedback
│   ├── error-logs, notifications
│   ├── backup, crons, system-config
│   └── import-edition
│
└── /guide/                          # Guide d'aide
    ├── user, artist, volunteer
    └── organizer/ (conventions, artists, volunteers, ticketing, meals, map, organizers, others)
```

### Composants (137 fichiers Vue, 26 dossiers)

**Organisation par domaine fonctionnel :**

| Dossier | Nb | Exemples clés |
|---------|----|---------------|
| `ticketing/` | 25 | TierModal, OptionModal, QrCodeScanner, PaymentMethodSelector, stats/* |
| `ui/` | 13 | ConfirmModal, DateTimePicker, ImageUpload, UserAvatar, SelectLanguage |
| `volunteers/` | 10 | VolunteerCard, ApplicationDetailsModal, TimeSlotsList, MealsModal |
| `convention/` | 8 | Form, Details, Selector, ClaimModal, OrganizersSection |
| `edition/carpool/` | 8 | OfferForm, RequestForm, OfferCard, BookingsList, CommentsModal |
| `edition/volunteer/planning/` | 8 | PlanningCard, SlotModal, AssignmentsModal, TeamManagement |
| `edition/volunteer/` | 8 | Table, ApplicationModal, MealsCard, MySlotsCard |
| `edition/` | 7 | Form, Header, ManageButton, Post |
| `admin/` | 8 | ImportGenerationProgress, UserDeletionModal |
| `edition/volunteer/notifications/` | 5 | Manager, Modal, History, ConfirmationsModal |
| `artists/` | 4 | ArtistModal, AccommodationModal, MealsModal |
| `notifications/` | 4 | Center, PushPromoModal, PushDevicesModal |
| `edition/zones/` | 3 | ZonesLegend, ZoneModal, MarkerModal |
| `messenger/` | 3 | HeaderButton, MessageBubble, TypingIndicator |
| Autres | 23 | feedback, guide, management, organizers, profile, shows, workshops |

### Composables (48 fichiers TypeScript)

**Par catégorie :**

| Catégorie | Composables |
|-----------|-------------|
| API et formulaires | `useApiAction`, `useModal`, `useDebounce`, `useReturnTo` |
| Cartes et géolocation | `useLeafletMap`, `useLeafletEditable`, `useEditionMarkers`, `useEditionZones`, `useMapMarkers` |
| Date et heure | `useDatetime`, `useDateFormat`, `useDateTimePicker`, `useTimezones`, `useCalendar`, `useElapsedTimer` |
| Bénévolat | `useVolunteerSchedule`, `useVolunteerTeams`, `useVolunteerTimeSlots`, `useVolunteerSettings` |
| Billetterie | `useTicketingCounter`, `useTicketingSettings` |
| Temps réel | `useMessenger`, `useMessengerStream`, `useNotificationStream`, `useRealtimeStats`, `useTypingIndicator` |
| Firebase et push | `useFirebaseMessaging`, `usePushNotificationPromo`, `usePWA` |
| i18n | `useLazyI18n`, `useI18nNavigation` |
| Utilitaires | `useCountries`, `useImageUrl`, `usePasswordStrength`, `useUrlValidation`, `useDeviceId` |
| Données | `useCarpoolForm`, `useConventionServices`, `useParticipantTypes`, `useMeals`, `useProfileStats` |

### Stores Pinia (5 fichiers)

| Store | Rôle | Méthode d'appel API |
|-------|------|---------------------|
| `auth.ts` | Session, user, login/register, adminMode | `$fetch` direct |
| `editions.ts` | Liste et CRUD des éditions | `$fetch` direct |
| `favoritesEditions.ts` | Gestion des favoris | `$fetch` direct |
| `notifications.ts` | Notifications en temps réel | `$fetch` direct |
| `impersonation.ts` | Impersonation admin | `$fetch` direct |

### Middleware client (6 fichiers)

| Middleware | Description |
|-----------|-------------|
| `authenticated.ts` | Vérifie l'authentification |
| `auth-protected.ts` | Routes protégées |
| `guest-only.ts` | Accessible uniquement aux non-connectés |
| `super-admin.ts` | Réservé aux admins globaux |
| `verify-email-access.ts` | Accès vérification email |
| `load-translations.global.ts` | Chargement i18n global |

### Layouts (4 fichiers)

- `default.vue` — Layout principal (header, footer, navigation)
- `edition-dashboard.vue` — Dashboard de gestion d'édition
- `guide.vue` — Pages de guide/aide
- `messenger.vue` — Interface de messagerie

### Plugins (7 fichiers)

| Plugin | Côté | Rôle |
|--------|------|------|
| `auth.client.ts` | Client | Initialisation de l'authentification |
| `countries.client.ts` | Client | Chargement des données pays |
| `firebase.client.ts` | Client | Configuration Firebase/FCM |
| `admin-mode-header.client.ts` | Client | Header mode admin |
| `router-api-ignore.client.ts` | Client | Filtrage routes API |
| `vue-json-viewer.client.ts` | Client | Composant JSON viewer |
| `env-flags.server.ts` | Serveur | Feature flags environnement |

---

## 7. Internationalisation (i18n)

### Langues supportées (13)

| Code | Langue | Statut |
|------|--------|--------|
| `fr` | Français | Langue de référence |
| `en` | Anglais | Traduction complète |
| `de` | Allemand | Traduction en cours |
| `es` | Espagnol | Traduction en cours |
| `it` | Italien | Traduction en cours |
| `nl` | Néerlandais | Traduction en cours |
| `pt` | Portugais | Traduction en cours |
| `pl` | Polonais | Traduction en cours |
| `cs` | Tchèque | Traduction en cours |
| `da` | Danois | Traduction en cours |
| `ru` | Russe | Traduction en cours |
| `sv` | Suédois | Traduction en cours |
| `uk` | Ukrainien | Traduction en cours |

### Domaines de traduction (15 fichiers par langue)

| Domaine | Description |
|---------|-------------|
| `common.json` | Termes partagés (boutons, labels, validation) |
| `app.json` | Chaînes spécifiques à l'application |
| `admin.json` | Panneau d'administration |
| `auth.json` | Flux d'authentification |
| `artists.json` | Gestion des artistes |
| `components.json` | Labels de composants |
| `edition.json` | Éditions et événements |
| `gestion.json` | Interface de gestion |
| `messenger.json` | Messagerie |
| `notifications.json` | Notifications |
| `permissions.json` | Permissions et rôles |
| `public.json` | Contenu public |
| `feedback.json` | Système de feedback |
| `ticketing.json` | Billetterie |
| `workshops.json` | Ateliers |

**Total : ~195 fichiers JSON** (13 langues × 15 domaines)

### Stratégie

- **Lazy loading** par domaine avec chargement automatique selon les routes
- **Stratégie URL** : `no_prefix` (pas de /fr/, /en/ dans les URLs)
- **Détection** : langue du navigateur avec persistance par cookie
- **Scripts de maintenance** : `check-i18n`, `check-translations`, `i18n:mark-todo`

---

## 8. Tests

### Vue d'ensemble

| Type | Fichiers | Tests | Framework |
|------|----------|-------|-----------|
| Unit | 18 | 367 | Vitest + happy-dom |
| Nuxt | 160 | 1614 | Vitest + @nuxt/test-utils |
| Integration | 7 | — | Vitest + MySQL réel |
| E2E | — | — | Vitest + Nuxt env |
| **Total** | **185+** | **1981+** | — |

### Tests unitaires (`test/unit/`)

- **Utils** : avatar, countries, editionName, gravatar, mapMarkers, markdownToHtml, convention-services
- **Composables** : useApiAction, useEditionMarkers, useEditionZones, useMessenger, useProfileStats
- **Stores** : auth, editions, notifications
- **Sécurité** : brute-force
- **i18n** : keys-parity (vérifie la cohérence entre langues)

### Tests Nuxt (`test/nuxt/`)

- **Server API** : 117 fichiers testant les endpoints (auth, conventions, editions, carpool, volunteers, ticketing, messenger, etc.)
- **Pages** : 19 fichiers testant les pages (login, register, admin, editions, profile, etc.)
- **Middleware** : 3 fichiers (auth, super-admin, authenticated)
- **Components** : 15 fichiers testant les composants
- **Features** : 6 tests d'intégration fonctionnelle
- **Utils** : Permissions, helpers, validation

### Tests d'intégration (`test/integration/`)

Tests avec base MySQL réelle (Docker) :

- `auth.db.test.ts` — Flux d'authentification complet
- `conventions.db.test.ts` — CRUD conventions
- `volunteers.workflow.db.test.ts` — Workflow complet bénévolat
- `organizers.chain.db.test.ts` — Chaîne de permissions organisateurs
- `access-control-permissions.db.test.ts` — Contrôle d'accès
- `lost-found.db.test.ts` — Objets trouvés/perdus
- `migrate-organizers.db.test.ts` — Migration des organisateurs

### Configuration Vitest

4 projets configurés dans `vitest.config.ts` :

| Projet | Environnement | Timeout | Particularités |
|--------|--------------|---------|----------------|
| unit | happy-dom | défaut | Globals activés |
| nuxt | nuxt | 20s | Mocks Firebase, IntersectionObserver |
| e2e | nuxt | 60s | — |
| integration | node | 30s | Pool forks, max 1 worker, séquentiel |

### Infrastructure de mocks

- **`test/setup.ts`** : Mocks globaux H3, Prisma, Firebase, `createSuccessResponse`, `useRuntimeConfig`
- **`test/setup-mocks.ts`** : Mocks `#app` et `#imports` (navigateTo, useRouter, useState, etc.)
- **`test/setup-common.ts`** : Fallbacks partagés pour Prisma et H3

---

## 9. CI/CD et déploiement

### GitHub Actions (`.github/workflows/tests.yml`)

Pipeline en 4 jobs :

```
setup (10 min) ──┬── lint (5 min) ──┬── test (15 min, matrix)
                 └── build (10 min) ─┘     ├── unit
                                           ├── nuxt
                                           ├── e2e
                                           └── database (+ MySQL service)
```

**Caching** : node_modules, Prisma client et build Nuxt mis en cache entre jobs.

### Docker

**5 configurations Docker Compose :**

| Fichier | Usage |
|---------|-------|
| `docker-compose.dev.yml` | Développement local (MySQL + app avec HMR) |
| `docker-compose.prod.yml` | Production |
| `docker-compose.release.yml` | Release/staging |
| `docker-compose.test-*.yml` | Tests (4 variantes : all, simple, integration, UI) |

**Dockerfile multi-stage :**

1. **base** — Node.js slim + outils système
2. **builder** — npm ci, Prisma generate, Nuxt build (6GB RAM)
3. **runtime** — Image de production minimale (port 3000)
4. **dev** — Image de développement avec HMR (ports 3000 + 24678)

### Variables d'environnement requises

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion MySQL |
| `NUXT_SESSION_PASSWORD` | Clé de chiffrement des sessions (32+ chars) |
| `NUXT_PUBLIC_SITE_URL` | URL publique du site |
| `SEND_EMAILS` | Activer/désactiver l'envoi d'emails |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Configuration SMTP |
| `ENCRYPTION_SECRET`, `ENCRYPTION_SALT` | Chiffrement des données sensibles |
| `NUXT_OAUTH_GOOGLE_*` | OAuth Google (client ID, secret, redirect) |
| `NUXT_OAUTH_FACEBOOK_*` | OAuth Facebook |
| `NUXT_PUBLIC_FIREBASE_*` | Firebase configuration (push notifications) |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY` | Intégration IA (optionnel) |
| `ENABLE_CRON` | Activer les tâches CRON |
| `PRISMA_LOG_LEVEL` | Niveau de log Prisma (`error,warn` par défaut) |

---

## 10. Stack technologique

### Frontend

| Technologie | Version | Rôle |
|-------------|---------|------|
| Nuxt | 4.3.1 | Framework full-stack |
| Vue.js | 3.x | Framework réactif |
| Nuxt UI | 4.4.0 | Composants UI + Tailwind CSS |
| Pinia | 3.0.4 | Gestion d'état |
| TypeScript | 5.9.3 | Typage statique |
| @nuxtjs/i18n | 10.2.3 | Internationalisation |
| VueUse | 14.2.1 | Utilitaires Vue |
| FullCalendar | 6.1.20 | Calendrier interactif |
| Chart.js | 4.5.1 | Graphiques et statistiques |
| Leaflet | via composables | Cartes interactives |

### Backend

| Technologie | Version | Rôle |
|-------------|---------|------|
| Nitro | intégré Nuxt | Moteur serveur |
| Prisma | 7.4.1 | ORM base de données |
| MySQL | 8.0 | Base de données relationnelle |
| Zod | 4.3.6 | Validation de données |
| nuxt-auth-utils | 0.5.29 | Auth par session |
| bcryptjs | 3.0.3 | Hachage de mots de passe |
| Nodemailer | 8.0.1 | Envoi d'emails |
| Firebase Admin | 13.6.1 | Notifications push |
| cron | 4.4.0 | Tâches planifiées |
| Anthropic SDK | 0.78.0 | Intégration IA |

### Outils de développement

| Outil | Version | Rôle |
|-------|---------|------|
| Vitest | 4.0.18 | Framework de tests |
| ESLint | 10.0.2 | Linting |
| Prettier | 3.8.1 | Formatage de code |
| Docker | multi-stage | Conteneurisation |
| GitHub Actions | — | CI/CD |

---

## 11. Diagramme d'architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Vue 3)                            │
│                                                                     │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Pages   │  │Components│  │  Composables  │  │  Pinia Stores  │  │
│  │  (98)    │  │  (137)   │  │    (48)       │  │     (5)        │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  └───────┬────────┘  │
│       │              │               │                  │           │
│       └──────────────┴───────────────┴──────────────────┘           │
│                              │                                      │
│                    useApiAction / $fetch                             │
│                    (smart unwrap)                                    │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                          HTTP/HTTPS
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                        SERVEUR (Nitro)                              │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────────────┐  │
│  │              Middleware (auth, cache, noindex)                 │  │
│  └───────────────────────────┼───────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────────────┐  │
│  │                   wrapApiHandler()                             │  │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ requireAuth()   │  │ Zod validate │  │ Permission check│  │  │
│  │  └─────────────────┘  └──────────────┘  └─────────────────┘  │  │
│  └───────────────────────────┼───────────────────────────────────┘  │
│                              │                                      │
│  ┌──────────┐  ┌─────────┐  │  ┌──────────┐  ┌──────────────────┐ │
│  │ Emails   │  │  Tasks  │  │  │ AI/LLM   │  │  Notifications   │ │
│  │ (6 tpl)  │  │ (5 cron)│  │  │ Providers│  │  (push/in-app)   │ │
│  └──────────┘  └─────────┘  │  └──────────┘  └──────────────────┘ │
│                              │                                      │
│              createSuccessResponse() / createPaginatedResponse()    │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                          Prisma ORM
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                        MySQL 8.0                                    │
│                                                                     │
│   73 modèles  •  9 fichiers schema  •  144 migrations              │
│                                                                     │
│   Domaines : Users, Conventions, Editions, Ticketing, Volunteers,  │
│              Carpool, Meals, Messenger, Workshops, Artists, Shows   │
└─────────────────────────────────────────────────────────────────────┘

                     Services externes
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Firebase │  │  Google   │  │ Facebook │  │ HelloAsso│
│   FCM    │  │  OAuth    │  │  OAuth   │  │  API     │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## 12. Points clés et recommandations

### Forces du projet

- **Architecture cohérente** : 100% des endpoints utilisent `wrapApiHandler()`, assurant une gestion d'erreurs uniforme
- **Réponses standardisées** : 67% des endpoints utilisent `createSuccessResponse()` avec smart unwrap côté client
- **Couverture de tests solide** : 1981 tests couvrant API, composants, pages et intégration
- **i18n mature** : 13 langues avec lazy loading par domaine
- **Sécurité** : Validation Zod systématique, auth par session, rate limiting, permissions granulaires sur 6 niveaux
- **Modularité Prisma** : Schéma découpé en 9 fichiers thématiques pour une meilleure maintenabilité
- **Documentation complète** : 50+ fichiers de documentation couvrant tous les systèmes
- **CI/CD robuste** : Pipeline GitHub Actions avec lint, build, et 4 types de tests en parallèle

### Points d'attention

- **Stores Pinia** : Les 5 stores utilisent `$fetch` direct au lieu de `useApiAction`, ce qui ne bénéficie pas du smart unwrap
- **Taille du domaine `editions/`** : 214 endpoints (58% de l'API) — le domaine principal est très dense
- **Tests E2E** : La configuration existe mais aucun test E2E n'est encore écrit
- **Helpers Prisma** : Le fichier `prisma-select-helpers.ts` (600+ lignes) pourrait être divisé par domaine

### Métriques de santé

| Indicateur | Valeur | Statut |
|------------|--------|--------|
| Endpoints avec wrapApiHandler | 366/366 (100%) | Excellent |
| Endpoints avec createSuccessResponse | 246/366 (67%) | Bon (GETs bruts intentionnels) |
| Couverture tests API | 117/366 endpoints testés | En progression |
| Langues supportées | 13 | Excellent |
| Documentation | 50+ fichiers | Complète |
