# Analyse complète de la base de code — Convention de Jonglerie

> Rapport généré automatiquement par la skill `/analyze-codebase` le 2026-05-24.
> Cible : application full-stack Nuxt 4 + Nitro + Prisma 7 + MariaDB/MySQL, ~1 119 fichiers de code, ~82 Mo.

---

## Sommaire

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Analyse détaillée de l'arborescence](#2-analyse-détaillée-de-larborescence)
3. [Décomposition fichier-par-fichier](#3-décomposition-fichier-par-fichier)
4. [Analyse des endpoints API](#4-analyse-des-endpoints-api)
5. [Architecture en profondeur](#5-architecture-en-profondeur)
6. [Environnement & mise en place](#6-environnement--mise-en-place)
7. [Stack technique détaillée](#7-stack-technique-détaillée)
8. [Diagrammes d'architecture](#8-diagrammes-darchitecture)
9. [Constats & recommandations](#9-constats--recommandations)

---

## 1. Vue d'ensemble du projet

### Type & finalité

Application web **full-stack monolithique modulaire** dédiée à la gestion et à la découverte de **conventions de jonglerie**. Elle adresse trois personas :

- **Participants** : découverte, favoris, covoiturage, candidatures bénévoles/artistes, billetterie.
- **Organisateurs** : CRUD conventions/éditions, gestion bénévoles, artistes, repas, billetterie, tâches, stock, FAQ, workshops.
- **Admin global** : modération, logs d'erreur, feedback, gestion utilisateurs, IA d'import, project-costs.

### Pattern architectural

- **Monolithe Nuxt 4 SSR** avec backend Nitro intégré (mêmes routes / build / déploiement).
- **Architecture en modules métier optionnels** activables par édition : volunteers, artists, meals, tasks, workshops, stock, ticketing, carpool, lost-found, messenger, map.
- **Permissions granulaires** (pas de rôles) au niveau convention + per-édition.
- **API REST** par ressource, organisée par dossiers (`server/api/<ressource>/<verbe>`).
- **i18n par domaine + lazy-loading** (13 langues, fichiers JSON segmentés).

### Stack résumée

| Couche    | Tech                                                        |
| --------- | ----------------------------------------------------------- |
| Frontend  | Nuxt 4.4, Vue 3.5, Nuxt UI 4, Pinia 3, Tailwind via Nuxt UI |
| Backend   | Nitro (intégré Nuxt), Node ≥ 22 < 26                        |
| ORM / DB  | Prisma 7.8 (multi-schema) + MariaDB/MySQL                   |
| Auth      | nuxt-auth-utils 0.5 (sessions scellées cookie) + bcryptjs   |
| Tests     | Vitest 4 (unit/nuxt/integration/e2e) + Playwright 1.58      |
| Real-time | SSE (notifications, messagerie, présence) + WebSocket Nitro |
| IA        | Anthropic SDK + provider Ollama/LMStudio + Vue Email        |
| Paiement  | Stripe + intégrations HelloAsso / SumUp / Infomaniak        |
| Push      | Firebase Admin + FCM côté client                            |

### Langage et versions

- **TypeScript** 5.9.3 (mode bundler resolution Nuxt 5)
- **Node** 22–25
- **Compatibility date** : `2026-03-02` (Nuxt 5 ready : `compatibilityVersion: 5`)

---

## 2. Analyse détaillée de l'arborescence

### Frontend — `app/`

| Sous-dossier                            | Rôle                                                                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [app/components/](../app/components/)   | Composants Vue organisés par domaine (admin, artists, edition, meals, ticketing, volunteers, workshops, messenger, organizers, tasks, stock, shows, survey, faq, feedback, profile, ui).  |
| [app/pages/](../app/pages/)             | Routing file-based Nuxt. Hiérarchie centrée sur `/editions/[id]/...` avec deux espaces : public (`/editions/[id]/...`) et back-office (`/editions/[id]/gestion/...`).                     |
| [app/stores/](../app/stores/)           | Pinia : `auth`, `editions`, `favoritesEditions`, `impersonation`, `notifications`.                                                                                                        |
| [app/composables/](../app/composables/) | ~55 composables réutilisables : `useApiAction` (wrapper fetch standardisé), `useNotificationStream`, `useMessenger`, `useLeafletMap`, `useFirebaseMessaging`, `useTicketingCounter`, etc. |
| [app/middleware/](../app/middleware/)   | `auth-protected`, `guest-only`, `super-admin`, `verify-email-access`, `load-translations.global`.                                                                                         |
| [app/layouts/](../app/layouts/)         | Layouts : `default`, `edition-dashboard` (gestion), variantes admin.                                                                                                                      |
| [app/plugins/](../app/plugins/)         | Plugins Vue (Firebase, dayjs, error-handler, etc.).                                                                                                                                       |
| [app/types/](../app/types/)             | Types globaux (`index.d.ts`).                                                                                                                                                             |
| [app/utils/](../app/utils/)             | Helpers client (formatters, ticketing).                                                                                                                                                   |
| [app/assets/](../app/assets/)           | CSS principal + logos partenaires (helloasso, infomaniak).                                                                                                                                |

### Backend — `server/`

| Sous-dossier                                            | Rôle                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [server/api/](../server/api/)                           | Endpoints REST, **organisés par ressource** : `auth/`, `conventions/`, `editions/[id]/...` (artists, carpool-offers, faq, lost-found, meals, organizers, posts, shows-call, stock, tasks, ticketing, volunteers, workshops, zones, markers), `messenger/`, `notifications/`, `admin/`, `survey/`, `feedback/`, `uploads/`, `files/`, etc. |
| [server/middleware/](../server/middleware/)             | `00.csrf.ts` (protection CSRF prioritaire), `auth.ts`, `cache-headers.ts`, `noindex.ts`.                                                                                                                                                                                                                                                  |
| [server/plugins/](../server/plugins/)                   | Plugins Nitro (init Prisma, cron, etc.).                                                                                                                                                                                                                                                                                                  |
| [server/routes/](../server/routes/)                     | Routes hors `/api` : `_ws.ts` (WebSocket), `firebase-messaging-sw.js.ts`, `auth/`, `uploads/`.                                                                                                                                                                                                                                            |
| [server/utils/](../server/utils/)                       | **Cœur métier** : `prisma.ts`, `prisma-select-helpers.ts`, `permissions/`, `notification-service.ts`, `emailService.ts`, `csrf.ts`, `auth-utils.ts`, `geocoding.ts`, `firebase-admin.ts`, `llm-client.ts`, `notification-stream-manager.ts`, `messenger-helpers.ts`, etc. ~60 utilitaires.                                                |
| [server/emails/](../server/emails/)                     | Templates `@vue-email/components`.                                                                                                                                                                                                                                                                                                        |
| [server/constants/](../server/constants/)               | Constantes serveur (permissions, etc.).                                                                                                                                                                                                                                                                                                   |
| [server/tasks/](../server/tasks/)                       | Tâches planifiées Nitro (`experimental.tasks: true`).                                                                                                                                                                                                                                                                                     |
| [server/lib/](../server/lib/)                           | Bibliothèques internes.                                                                                                                                                                                                                                                                                                                   |
| [server/prompts/](../server/prompts/)                   | Prompts IA (import, etc.).                                                                                                                                                                                                                                                                                                                |
| [server/generated/prisma/](../server/generated/prisma/) | Client Prisma généré (ignoré par git).                                                                                                                                                                                                                                                                                                    |
| [server/types/](../server/types/)                       | Types serveur.                                                                                                                                                                                                                                                                                                                            |

### Données — `prisma/`

Schéma **multi-fichiers** (13 fichiers, 2 350 lignes au total) :

| Fichier                                                       | Lignes | Domaine                                                                    |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| [schema.prisma](../prisma/schema/schema.prisma)               | 488    | User, Edition, Convention, ConventionOrganizer, permissions, favoris, FCM. |
| [ticketing.prisma](../prisma/schema/ticketing.prisma)         | 462    | Tarifs, options, quotas, commandes, contrôle d'accès, intégrations.        |
| [artists.prisma](../prisma/schema/artists.prisma)             | 282    | EditionArtist, ShowCall, ShowApplication, ShowPreset, sondage.             |
| [misc.prisma](../prisma/schema/misc.prisma)                   | 220    | Feedback, ApiErrorLog, LostFound, Notifications, PasswordReset.            |
| [volunteer.prisma](../prisma/schema/volunteer.prisma)         | 219    | Application, Team, TimeSlot, Assignment, NotificationGroup.                |
| [meals.prisma](../prisma/schema/meals.prisma)                 | 138    | Meals, sélections, validations buffet.                                     |
| [carpool.prisma](../prisma/schema/carpool.prisma)             | 123    | Offer, Request, Booking, Passenger, Comments.                              |
| [stock.prisma](../prisma/schema/stock.prisma)                 | 92     | StockItem, Group, Reservation, locations.                                  |
| [project-costs.prisma](../prisma/schema/project-costs.prisma) | 91     | Coûts et tarifs du projet.                                                 |
| [tasks.prisma](../prisma/schema/tasks.prisma)                 | 79     | Task, Assignment, Comment, TaskGroup.                                      |
| [messenger.prisma](../prisma/schema/messenger.prisma)         | 76     | Conversation, Participant, Message.                                        |
| [workshops.prisma](../prisma/schema/workshops.prisma)         | 60     | Workshop, Favorite, locations.                                             |
| [faq.prisma](../prisma/schema/faq.prisma)                     | 20     | FAQ par édition.                                                           |

**24 migrations** versionnées (`0_init` → `20260523120000_rename_returnable_to_handout`). Provider : MySQL via `@prisma/adapter-mariadb`.

### Internationalisation — `i18n/locales/`

13 langues × 6–7 domaines = ~85 fichiers JSON :

- Domaines : `common`, `notifications`, `components`, `app`, `public`, `feedback` (toutes langues) + `gestion`, `admin`, `artists`, `auth`, `edition`, `messenger`, `permissions`, `profil`, `project-costs`, `survey`, `ticketing`, `workshops` (FR maître).
- Langues : `cs, da, de, en, es, fr, it, nl, pl, pt, ru, sv, uk` (+ `en` par défaut).
- **Lazy loading** activé (`i18n.lazy: true`), chargement par fichier selon la route.
- Backups historiques dans [i18n/locales-backup/](../i18n/locales-backup/) (10 snapshots).

### Tests — `test/`

| Sous-dossier                              | Type                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| [test/unit/](../test/unit/)               | Vitest projet `unit` (composables, stores, utils, security, i18n).             |
| [test/nuxt/](../test/nuxt/)               | Vitest projet `nuxt` (composants, middleware, server/api, server/utils).       |
| [test/integration/](../test/integration/) | Tests intégration DB (`TEST_WITH_DB=true`).                                    |
| [test/e2e/](../test/e2e/)                 | API e2e Vitest + Playwright (`authenticated`, `edition-management`, `public`). |
| [test/**mocks**/](../test/__mocks__/)     | Mocks partagés.                                                                |
| [test/setup-db.ts](../test/setup-db.ts)   | Bootstrap base de test.                                                        |

Configurations Docker dédiées : `docker-compose.test*.yml` (`-simple`, `-integration`, `-ui`, `-all`).

### DevOps — racine

- **Docker** : `Dockerfile`, `Dockerfile.test`, 8 compose files (dev / prod / release / test variants), [backup/Dockerfile](../backup/Dockerfile).
- **CI** : [.github/workflows/tests.yml](../.github/workflows/tests.yml), [.github/workflows/playwright.yml](../.github/workflows/playwright.yml).
- **Scripts** : [scripts/](../scripts/) (40+ scripts utilitaires : géocodage, admin, i18n, seed, backup, etc.).

### Documentation — `docs/`

~30 documents techniques (français) : modules métier (volunteers, ticketing, meals, tasks, stock, workshops, carpool, lost-found, messenger, shows-call, project-costs), système (auth, notifications, permissions, feedback), intégrations (firebase, helloasso, sumup, infomaniak), docker, sécurité, optimisation.

---

## 3. Décomposition fichier-par-fichier

### Core applicatif

| Fichier                                                                           | Rôle                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [nuxt.config.ts](../nuxt.config.ts)                                               | Configuration Nuxt 4 (623 lignes) : modules, i18n 13 langues, CSP/security, Nitro preset `node-server`, runtimeConfig (session, SMTP, Anthropic, reCAPTCHA, Firebase, Stripe), routeRules (SSR off pour `/admin` et `/editions/*/gestion`), expérimental (lazyHydration, viewTransition, buildCache, crossOriginPrefetch). |
| [app/app.vue](../app/app.vue)                                                     | Composant racine.                                                                                                                                                                                                                                                                                                          |
| [app/pages/index.vue](../app/pages/index.vue)                                     | Page d'accueil (carte des favoris, agenda).                                                                                                                                                                                                                                                                                |
| [server/utils/prisma.ts](../server/utils/prisma.ts)                               | Singleton client Prisma.                                                                                                                                                                                                                                                                                                   |
| [server/utils/prisma-select-helpers.ts](../server/utils/prisma-select-helpers.ts) | Helpers de sélection standardisés (`userBasicSelect`, `carpoolOfferInclude`, `editionListInclude`…).                                                                                                                                                                                                                       |
| [server/utils/permissions/](../server/utils/permissions/)                         | Vérification droits convention/édition.                                                                                                                                                                                                                                                                                    |
| [server/middleware/00.csrf.ts](../server/middleware/00.csrf.ts)                   | CSRF prioritaire (préfixe `00.`).                                                                                                                                                                                                                                                                                          |

### Configuration

| Fichier                                         | Rôle                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [package.json](../package.json)                 | 80+ scripts (dev, docker, tests, i18n, db, prod). 140 dépendances.                                                 |
| [tsconfig.json](../tsconfig.json)               | Réfère 4 sub-configs Nuxt (`tsconfig.app`, `.server`, `.shared`, `.node`). Path aliases : `@/*`, `~/*`, `~/types`. |
| [vitest.config.ts](../vitest.config.ts)         | 4 projets Vitest (unit / nuxt / integration / e2e).                                                                |
| [playwright.config.ts](../playwright.config.ts) | Configuration tests E2E navigateur.                                                                                |
| `.env / .env.*.example`                         | Variables sensibles (NUXT_SESSION_PASSWORD, DATABASE_URL, SMTP, ANTHROPIC, Firebase, Stripe).                      |

### Couche données

| Élément                                                                                    | Description                                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `prisma/schema/*.prisma`                                                                   | Schéma découpé en 13 domaines, exporte vers `server/generated/prisma`.          |
| `prisma/migrations/`                                                                       | 24 migrations chronologiques (depuis `0_init` jusqu'à ajout d'événements 2026). |
| [server/utils/prisma.ts](../server/utils/prisma.ts)                                        | Instanciation client avec niveau de log piloté par `PRISMA_LOG_LEVEL`.          |
| Scripts : `db:seed:dev`, `db:reset:dev`, `db:clean-tokens`, `db:assign-meals`, `db:e2e:*`. |

### Frontend / UI

- **Pages publiques** : `/`, `/conventions`, `/editions/[id]`, `/editions/[id]/shows-call/[showCallId]`, `/editions/[id]/carpool/...`, `/editions/[id]/volunteers/notification/[groupId]`, `/survey/[token]`, `/welcome/...`.
- **Espace authentifié** : `/profile/*`, `/favorites`, `/notifications`, `/messenger`, `/project-costs`.
- **Back-office édition** (`/editions/[id]/gestion/`) : artists, faq, meals, shows-call, stock, tasks, ticketing (avec counter), volunteers, workshops.
- **Admin** (`/admin/*`) : users, conventions, editions, error-logs, feedback, project-costs, IA tools.

Composants notables : [HomeAgenda.vue](../app/components/HomeAgenda.vue), [FavoritesMap.vue](../app/components/FavoritesMap.vue), [ConventionsFeaturesModal.vue](../app/components/ConventionsFeaturesModal.vue), [MarkdownEditor.vue](../app/components/MarkdownEditor.vue), [CountryMultiSelect.vue](../app/components/CountryMultiSelect.vue), [UserSelector.vue](../app/components/UserSelector.vue), [LoadingLogo.vue](../app/components/LoadingLogo.vue).

### Tests

- Configuration multi-projets Vitest avec `--silent=true` par défaut.
- Helpers : [test/setup-db.ts](../test/setup-db.ts), [test/**mocks**/](../test/__mocks__/), [test/e2e/playwright/](../test/e2e/playwright/) (authenticated + edition-management + public).
- CI : workflows séparés pour `tests` et `playwright`.

### Documentation

- [docs/README.md](./README.md) sert d'index.
- [CLAUDE.md](../CLAUDE.md) — règles assistants IA.
- [README.tests.md](../README.tests.md) — guide tests.
- [SCRIPTS.md](../SCRIPTS.md) — scripts utilitaires.

### DevOps & scripts

- Workflows GitHub : `tests.yml` (unit + nuxt + integration), `playwright.yml` (E2E).
- Compose : `dev`, `dev-install`, `prod`, `release`, plus 5 variantes test.
- Scripts notables : `manage-admin.ts`, `seed-dev.ts`, `clean-expired-tokens.ts`, `run-geocoding.mjs`, `check-i18n.js`, `translation/mark-todo.js`, `generate-favicons.ts`, `reset-deps.sh`, `kill-servers.js`.

---

## 4. Analyse des endpoints API

### Conventions

- **Préfixe** : `/api/` (Nitro file-based routing).
- **Verbes** : suffixes `.get.ts`, `.post.ts`, `.put.ts`, `.patch.ts`, `.delete.ts`.
- **Authentification** : sessions scellées via cookie (`nuxt-auth-utils`). Helpers `requireUserSession` / `getUserSession`.
- **CSRF** : middleware global prioritaire ([server/middleware/00.csrf.ts](../server/middleware/00.csrf.ts)).
- **Permissions** : vérifiées via helpers [server/utils/permissions/](../server/utils/permissions/) (granularité convention + per-édition).
- **Rate limiting** : `api-rate-limiter.ts` + `rate-limiter.ts`.
- **Validation** : `zod` côté serveur, schémas dans [lib/schemas/](../lib/schemas/) et inline.

### Cartographie

| Groupe              | Endpoints clés                                                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**            | `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/session/*`                                                                                                                  |
| **Profil**          | `/api/profile/*`, `/api/profile/show-presets`, `/api/user/*`                                                                                                                                                                                                                      |
| **Conventions**     | `/api/conventions[/.../:id]/{claim,organizers,volunteers}`                                                                                                                                                                                                                        |
| **Éditions**        | `/api/editions/[id]/{artists,carpool-offers,carpool-requests,faq,lost-found,markers,meals,organizers,permissions,posts,shows,shows-call,stock-groups,stock-items,stock-reservations,task-groups,tasks,ticketing,volunteer-teams,volunteer-time-slots,volunteers,workshops,zones}` |
| **Billetterie**     | `/api/editions/[id]/ticketing/{counters,custom-fields,external,handout-items,helloasso,infomaniak,options,orders,organizers,quotas,stats,sumup,tiers,volunteers}`                                                                                                                 |
| **Bénévoles**       | applications, teams, time-slots, assignments, catering, notifications, access-control                                                                                                                                                                                             |
| **Messenger**       | `/api/messenger/conversations[/conversationId][/messages]` + SSE flux                                                                                                                                                                                                             |
| **Notifications**   | `/api/notifications/[id]`, `/api/notifications/fcm/devices` (token FCM)                                                                                                                                                                                                           |
| **Carpool**         | offers, requests, bookings, passengers, comments                                                                                                                                                                                                                                  |
| **Admin**           | `/api/admin/{users,conventions,editions,error-logs,feedback,project-costs,tasks,notifications,impersonate,backup,ai/models,generate-import-json,generate-import-json-agent}`                                                                                                      |
| **Survey**          | `/api/survey/[token]` (sondage public via token)                                                                                                                                                                                                                                  |
| **Sitemap**         | `/api/__sitemap__/{editions,carpool,volunteers}`                                                                                                                                                                                                                                  |
| **Uploads / Files** | `/api/files/**`, `/api/uploads/*`                                                                                                                                                                                                                                                 |

### Formats request/response

- Entrée : JSON, validation `zod` puis appel Prisma via helpers.
- Sortie : JSON typé (utilisation de `prisma-select-helpers` pour éviter sur-fetching).
- Erreurs : `createError({ statusCode, statusMessage, data })` standardisé.
- Logs erreurs API : table `ApiErrorLog` ([server/utils/error-logger.ts](../server/utils/error-logger.ts)).

### Versioning

Pas de versioning d'URL (`/api/v1/`). Monolithe interne : breaking changes gérés via migrations Prisma + i18n + déploiement coordonné front/back.

---

## 5. Architecture en profondeur

### Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│ Client (navigateur)                                              │
│  • Pages Nuxt SSR (publiques) / SPA (gestion + admin)            │
│  • Pinia stores · Composables · Nuxt UI · Tailwind               │
│  • SSE + WebSocket (notifications, messagerie, présence)         │
│  • Firebase Cloud Messaging (push web)                           │
└───────────────┬──────────────────────────────────────────────────┘
                │ HTTPS / WSS / SSE
                ▼
┌──────────────────────────────────────────────────────────────────┐
│ Nuxt 4 / Nitro (Node ≥22)                                        │
│  • Middlewares : CSRF (00) → Auth → Cache-headers → noindex      │
│  • API REST modulaire (file-based)                               │
│  • SSR + routeRules (ssr:false sur /admin et /gestion/**)        │
│  • Sécurité : nuxt-security (CSP nonce, SRI, requestSizeLimiter) │
│  • Tâches planifiées (Nitro experimental.tasks)                  │
│  • i18n lazy par locale × domaine                                │
└──────┬───────────────────────┬──────────────────────┬────────────┘
       │ Prisma 7              │ SMTP / IA / 3rd p.   │ Storage
       ▼                       ▼                      ▼
┌──────────────┐   ┌─────────────────────┐   ┌──────────────────┐
│ MariaDB /    │   │ Anthropic Claude    │   │ public/uploads/  │
│ MySQL        │   │ Ollama / LMStudio   │   │ (nuxt-file-      │
│ (13 schemas) │   │ Stripe              │   │  storage)        │
└──────────────┘   │ Firebase Admin/FCM  │   └──────────────────┘
                   │ Nominatim (geocode) │
                   │ HelloAsso / SumUp / │
                   │ Infomaniak          │
                   │ JugglingEdge / FB   │
                   │ SMTP (Gmail)        │
                   └─────────────────────┘
```

### Cycle d'une requête type

1. **Client** appelle `useApiAction('/api/editions/42/volunteers/applications', { method: 'POST', body })`.
2. **Nitro** reçoit, exécute :
   - `00.csrf.ts` → vérifie le token CSRF.
   - `auth.ts` → résout la session (cookie scellé) et hydrate `event.context.user`.
   - `cache-headers.ts` → applique politique cache.
3. **Handler** (`server/api/editions/[id]/volunteers/applications/index.post.ts`) :
   - Valide le body via `zod`.
   - Vérifie permissions via [server/utils/permissions/](../server/utils/permissions/) (combinaison `canManageVolunteers` + per-édition).
   - Appelle `prisma` avec un helper de sélection.
   - Déclenche notification via `notification-service.ts` (in-app + email + FCM).
4. **Réponse** JSON typée → côté client `useApiAction` gère toast/loading/erreur.

### Patterns clés

- **Modules optionnels par édition** : un drapeau booléen sur `Edition` active chaque module → routes/pages conditionnelles.
- **Permissions sans rôles** : matrice de booléens sur `ConventionOrganizer` + override per-édition via `EditionOrganizerPermission`. Voir [docs/system/ORGANIZER_PERMISSIONS.md](./system/ORGANIZER_PERMISSIONS.md).
- **Sessions scellées** : pas de table session côté DB, le cookie contient l'état signé/chiffré (`NUXT_SESSION_PASSWORD`).
- **`useApiAction` composable** : centralise loading/toast/erreur côté front (cf. [docs/migration-fetch-to-useApiAction.md](./migration-fetch-to-useApiAction.md)).
- **Helpers Prisma `select/include`** : factorisation des projections (cf. [docs/prisma-select-helpers.md](./prisma-select-helpers.md)).
- **Real-time** :
  - Notifications/messagerie : SSE (`notification-stream-manager.ts`, `useNotificationStream`, `useMessengerStream`).
  - Présence : `conversation-presence-service.ts`.
  - Push : Firebase Admin (server) + FCM tokens (client).
- **CSP stricte avec nonces** + SRI activés.
- **Géocodage** : Nominatim avec stratégie fallback ([server/utils/geocoding.ts](../server/utils/geocoding.ts)).
- **IA d'import** : abstraction multi-providers (`llm-client.ts` → anthropic / ollama / lmstudio).
- **Tâches Nitro** : `experimental.tasks: true` (planification interne, alternative à node-cron).

---

## 6. Environnement & mise en place

### Variables d'environnement clés

```env
# DB
DATABASE_URL="mysql://user:pass@host:3306/db"

# Sessions (nuxt-auth-utils) — OBLIGATOIRE en prod, ≥ 32 chars
NUXT_SESSION_PASSWORD="..."

# Emails
SEND_EMAILS=false                # true en prod
SMTP_USER="..."
SMTP_PASS="..."
SMTP_FROM="notifications@..."

# IA
AI_PROVIDER=anthropic            # ou ollama / lmstudio
ANTHROPIC_API_KEY="..."
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llava"

# reCAPTCHA v3
NUXT_RECAPTCHA_SECRET_KEY="..."
NUXT_PUBLIC_RECAPTCHA_SITE_KEY="..."

# Firebase (push)
NUXT_PUBLIC_FIREBASE_API_KEY="..."
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NUXT_PUBLIC_FIREBASE_PROJECT_ID="..."
# ... + storageBucket / messagingSenderId / appId / vapidKey

# Browserless (scraping JS)
BROWSERLESS_URL=""

# Divers
NUXT_PUBLIC_SITE_URL="https://juggling-convention.com"
NUXT_ENV=                        # production / staging / release
PRISMA_LOG_LEVEL="error,warn"    # query,info pour debug
NUXT_FILE_STORAGE_MOUNT="/uploads"
```

### Installation

```bash
git clone <repo>
cd convention-de-jonglerie
npm install
cp .env.example .env             # à remplir
npx prisma migrate dev
npx prisma generate
npm run dev                      # http://localhost:3000
```

Ou via Docker dev : `npm run docker:dev:detached` puis `npm run docker:dev:logs`.

### Workflow développement

- **Convention de commit** : pilotée par les skills `/quality-check` → `/commit-push`. Ne JAMAIS exécuter `npm run dev` (déjà lancé) ni `npx prisma migrate` (utilisateur s'en charge).
- **Lint + format** : `/lint-fix` (ESLint --fix + Prettier).
- **Tests** : `/run-tests` (unit puis nuxt). Intégration DB : `npm run test:db`.
- **i18n** : modifier uniquement `fr/` de soi-même ; `npm run i18n:mark-todo` quand un libellé FR change.

### Déploiement production

- Build : `npm run build` (Nitro preset `node-server`, `--max-old-space-size=8192`).
- Compose prod : [docker-compose.prod.yml](../docker-compose.prod.yml).
- Compose release (pré-prod) : [docker-compose.release.yml](../docker-compose.release.yml).
- Variables noindex via `NUXT_ENV=staging|release` (sitemap désactivé, robots disallow).

---

## 7. Stack technique détaillée

### Runtime & langage

- **Node.js** ≥22 <26 (engines).
- **TypeScript** 5.9 strict (bundler resolution, references vers tsconfigs Nuxt).
- **ESM only** (`"type": "module"`).

### Frontend

- **Nuxt 4.4.6** (compat date `2026-03-02`, `compatibilityVersion: 5`).
- **Vue 3.5** avec `propsDestructure: true`.
- **Nuxt UI 4.7** (Tailwind intégré).
- **@nuxt/image** 2 (WebP/AVIF qualité 80).
- **@nuxtjs/i18n** 10.2 (13 locales, lazy par fichier).
- **@nuxtjs/seo** 3.4 (ogImage, schemaOrg, robots, sitemap, linkChecker).
- **@pinia/nuxt** 0.11 + Pinia 3.
- **@vueuse/nuxt** 14.
- **@fullcalendar/\*** 6.1 (vue3 + daygrid/list/interaction/resource/resource-timeline/timeline).
- **chart.js** 4.5 + vue-chartjs 5.3.
- **Leaflet** (via composables `useLeafletMap`).
- **html2canvas** 1.4 + **jspdf** 4.2 + jspdf-autotable 5 (exports).
- **html5-qrcode** + **nuxt-qrcode** (billetterie).
- **flag-icons** + **i18n-iso-countries** 7.14.
- **libphonenumber-js** 1.12.
- **luxon** 3.7 (date/timezone) + `@vvo/tzdb` 6.198 + `@internationalized/date` 3.12.
- **vue3-json-viewer** 2.4.

### Backend / Nitro

- **Nitro** (intégré Nuxt), preset `node-server`, `experimental.tasks: true`, rollup vue plugin.
- **@prisma/client** 7.8 + **@prisma/adapter-mariadb** 7.5.
- **bcryptjs** 3 (hash mots de passe).
- **zod** 4.3 (validation).
- **nodemailer** 8 (SMTP).
- **@vue-email/components** 0.0.21 + render 0.0.9 (templates emails).
- **@anthropic-ai/sdk** 0.78 + provider Ollama/LMStudio via `llm-client.ts`.
- **firebase-admin** 13.6 (server) + **firebase** 12.9 (client).
- **stripe** 20.4.
- **cron** 4.4 (planification).
- **ua-parser-js** 2 (analytics device).
- **md5** 3 (emailHash → Gravatar).
- **sharp** 0.34 (image processing).
- **facebook-event-scraper** 0.2 (import auto).
- **html parsing** : rehype-sanitize/stringify + remark-gfm/parse/rehype + unified.

### Sécurité

- **nuxt-security** 2.5 (CSP nonce + SRI + permissionsPolicy camera + crossOriginEmbedderPolicy:false + requestSizeLimiter par route).
- **nuxt-auth-utils** 0.5 (sessions scellées).
- **CSRF** custom ([server/middleware/00.csrf.ts](../server/middleware/00.csrf.ts) + [server/utils/csrf.ts](../server/utils/csrf.ts)).
- **Rate limiting** ([server/utils/api-rate-limiter.ts](../server/utils/api-rate-limiter.ts)).
- **reCAPTCHA v3** (seuil configurable, bypass dev).
- **Encryption** ([server/utils/encryption.ts](../server/utils/encryption.ts)) pour les secrets stockés (HelloAsso/SumUp tokens).
- **Documentation sécurité** : [docs/security/](./security/).

### Tests

- **Vitest** 4 (4 projets : unit / nuxt / integration / e2e).
- **@nuxt/test-utils** 4 + **@vue/test-utils** 2.4 + **@testing-library/vue** 8.1.
- **happy-dom** 20 (DOM léger).
- **@playwright/test** 1.58 (E2E navigateur).
- **wait-on** 9 (orchestration).
- **cross-env** 10 (variables OS-agnostic).

### Outils dev

- **ESLint** 10 + `@nuxt/eslint` 1.15.
- **Prettier** 3.8 (singleQuote, semi:false, printWidth:100, trailingComma:es5).
- **tsx** 4.21 (exécution scripts TS).
- **dotenv** 17.
- **glob** 13.
- **vite-tsconfig-paths** 6.1.

### Build / déploiement

- **Vite** (Nuxt) avec `chunkSizeWarningLimit:800`, pure `console.log/debug` retirés en prod.
- **Compression** : gzip + brotli sur public assets.
- **Cache** : public assets 30 jours.
- **Source maps** : désactivées en prod côté serveur.
- **Docker** : 12 fichiers Compose pour dev/prod/release/test, image `Dockerfile` multi-stage.

### Intégrations externes

| Service           | Usage                                          |
| ----------------- | ---------------------------------------------- |
| Firebase FCM      | Notifications push web                         |
| Stripe            | Paiements (dont produit "Café pour le projet") |
| HelloAsso         | Import commandes billetterie (token chiffré)   |
| SumUp             | Caisse / billetterie (config par édition)      |
| Infomaniak        | Billetterie alternative                        |
| Anthropic Claude  | IA import + génération assistée                |
| Ollama / LMStudio | Provider IA local (alternative)                |
| Browserless       | Scraping pages avec JS rendu                   |
| Nominatim         | Géocodage adresses                             |
| JugglingEdge      | Import éditions externes                       |
| Facebook          | Scraping événements                            |
| Gmail SMTP        | Envoi emails transactionnels                   |

---

## 8. Diagrammes d'architecture

### Architecture haut niveau (Mermaid)

```mermaid
flowchart LR
    subgraph Client
        UI["Nuxt 4 SSR / SPA<br/>Vue 3 · Pinia · Nuxt UI"]
        SW["Service Worker<br/>(Firebase Messaging)"]
    end

    subgraph Nuxt_Nitro["Nuxt 4 + Nitro"]
        MW["Middlewares<br/>00.csrf → auth → cache → noindex"]
        API["API REST file-based<br/>/api/**"]
        Tasks["Nitro Tasks<br/>(experimental)"]
        SSE["SSE streams<br/>notifications / messenger / presence"]
        WS["WebSocket /_ws"]
    end

    subgraph Data
        DB[("MariaDB / MySQL<br/>13 schémas Prisma")]
        FS["public/uploads/<br/>nuxt-file-storage"]
    end

    subgraph External["Services externes"]
        Anthropic
        Ollama
        Stripe
        FB["Firebase Admin + FCM"]
        SMTP["SMTP Gmail"]
        Geo["Nominatim"]
        HA["HelloAsso"]
        SU["SumUp"]
        IM["Infomaniak"]
        JE["JugglingEdge"]
    end

    UI <--> MW
    UI <--> SSE
    UI <--> WS
    SW <-- push --> FB
    MW --> API
    API --> DB
    API --> FS
    API --> Anthropic
    API --> Ollama
    API --> Stripe
    API --> FB
    API --> SMTP
    API --> Geo
    API --> HA
    API --> SU
    API --> IM
    API --> JE
    Tasks --> DB
    Tasks --> SMTP
```

### Schéma de données (résumé)

```mermaid
erDiagram
    User ||--o{ Convention : "creates"
    User ||--o{ ConventionOrganizer : "is organizer"
    Convention ||--o{ ConventionOrganizer : "has"
    Convention ||--o{ Edition : "has"
    Edition ||--o{ EditionOrganizerPermission : "per-edition overrides"
    Edition ||--o{ EditionVolunteerApplication : "volunteers"
    Edition ||--o{ EditionArtist : "artists"
    Edition ||--o{ ShowCall : "show calls"
    ShowCall ||--o{ ShowApplication : "applications"
    Edition ||--o{ Meal : "meals"
    Edition ||--o{ Task : "tasks"
    Edition ||--o{ Workshop : "workshops"
    Edition ||--o{ StockItem : "stock"
    Edition ||--o{ TicketingTier : "tiers"
    Edition ||--o{ TicketingOrder : "orders"
    Edition ||--o{ CarpoolOffer : "carpool"
    Edition ||--o{ LostFoundItem : "lost & found"
    Edition ||--o{ FaqEntry : "FAQ"
    User ||--o{ Notification : ""
    User ||--o{ FcmToken : ""
    User ||--o{ ConversationParticipant : ""
    Conversation ||--o{ ConversationParticipant : ""
    Conversation ||--o{ Message : ""
```

### Hiérarchie de fichiers (résumé)

```
convention-de-jonglerie/
├── app/                       # Frontend Nuxt
│   ├── components/  (20+ sous-domaines)
│   ├── pages/       (public + /gestion + /admin)
│   ├── stores/      (5 stores Pinia)
│   ├── composables/ (~55)
│   ├── middleware/  (5)
│   ├── layouts/
│   ├── plugins/
│   ├── types/
│   ├── assets/
│   └── utils/
├── server/                    # Backend Nitro
│   ├── api/         (REST file-based)
│   ├── middleware/  (CSRF, auth, cache, noindex)
│   ├── plugins/
│   ├── routes/      (WS + uploads + SW Firebase)
│   ├── utils/       (~60 helpers)
│   ├── emails/      (Vue Email)
│   ├── constants/
│   ├── tasks/
│   ├── lib/
│   ├── prompts/     (IA)
│   ├── generated/prisma/ (ignored)
│   └── types/
├── prisma/
│   ├── schema/      (13 .prisma)
│   └── migrations/  (24)
├── i18n/locales/    (13 langues × 6+ domaines)
├── lib/schemas/     (zod schemas partagés)
├── shared/          (types/utils partagés client/serveur)
├── docs/            (~30 docs FR)
├── test/            (unit + nuxt + integration + e2e)
├── scripts/         (~40 utilitaires)
├── docker/          (init MySQL)
├── public/          (favicons, logos, uploads)
└── (configs racine : nuxt.config, tsconfig, vitest, playwright,
   eslint, prettier, package.json, 12 docker-compose…)
```

---

## 9. Constats & recommandations

### Forces

- **Découpage modulaire exemplaire** : schéma Prisma multi-fichiers, i18n par domaine, composables nombreux et ciblés, helpers Prisma standardisés (`prisma-select-helpers`) — la base accueille de nouveaux modules sans fragiliser l'existant.
- **Sécurité solide en profondeur** : CSP nonce + SRI + CSRF prioritaire + sessions scellées + reCAPTCHA v3 + rate limiting + encryption des secrets tiers + permissions granulaires sans rôles.
- **Tests pluricouches** : unit + nuxt + integration DB + e2e API + Playwright UI, avec compose Docker dédiés. Couverture CI sur deux workflows séparés.
- **Internationalisation industrielle** : 13 langues × 6+ domaines en lazy loading, scripts de synchronisation (`check-i18n`, `mark-todo`, `add-translation`).
- **Performance** : SSR désactivé sur back-office et admin, lazyHydration, compression brotli/gzip, image WebP/AVIF, prefetch via Speculation Rules, sourcemaps serveur off en prod.
- **Conventions documentées** : [CLAUDE.md](../CLAUDE.md), [docs/README.md](./README.md), guides par module, helpers documentés.

### Points d'attention

- **Volume de configuration** : `nuxt.config.ts` 623 lignes — un découpage par préoccupations (security, i18n, nitro, vite) via modules locaux Nuxt pourrait clarifier.
- **13 fichiers `docker-compose.*.yml`** à la racine — un dossier `docker/compose/` pourrait réduire le bruit.
- **Sauvegardes i18n historiques** dans [i18n/locales-backup/](../i18n/locales-backup/) (10 snapshots) : à archiver hors repo ou purger.
- **`server/generated/prisma/`** doit rester dans `.gitignore` (déjà fait) — vérifier qu'aucune ré-exposition accidentelle ne fuit en CI.
- **Endpoints admin IA** (`generate-import-json`, `generate-import-json-agent`) : surveiller les timeouts et coûts (header `X-Accel-Buffering: no` déjà en place).
- **`useFetch` vs `useApiAction`** : la doc encourage `useApiAction`, mais un audit `grep` côté front pourrait révéler des appels `$fetch`/`useFetch` legacy à migrer.
- **Pas de versioning d'API** : acceptable pour un monolithe interne, mais à anticiper si une app mobile native s'y connecte un jour.

### Sécurité — pistes complémentaires

- **CSP** : `'unsafe-inline'` autorisé sur `script-src` et `style-src` — combiné à `'strict-dynamic'` et nonces, c'est cohérent mais à réévaluer après audit des dépendances inline restantes.
- **Sessions** : `maxAge` 30 jours par défaut — proposer un toggle "remember me" plus court pour les sessions sensibles (déjà mentionné dans le commentaire).
- **Webhooks Stripe/HelloAsso** : vérifier signature stricte et idempotence.
- **Logs d'erreur API** stockés en DB (`ApiErrorLog`) : prévoir rotation/purge automatique pour éviter croissance.

### Performance — pistes complémentaires

- **N+1 Prisma** : déjà mitigé via `prisma-select-helpers`, mais profiter de `PRISMA_LOG_LEVEL=query` ponctuellement pour traquer les requêtes lentes.
- **Cache HTTP** : `cache-headers.ts` global — envisager `routeRules` Nitro avec `swr` sur certaines pages publiques fortement consultées (liste d'éditions).
- **Images** : passer les uploads via `sharp` (déjà dépendance) pour pré-générer variantes WebP/AVIF + thumbnails au lieu de servir à chaque requête.
- **SSE** : surveiller le nombre de connexions concurrentes (Nitro Node) — préparer plan B (WebSocket unique multiplexé) si croissance.

### Maintenabilité — pistes

- **Adopter `eslint-plugin-import` (ordre + cycles)** et **`vitest-coverage-c8`** pour visualiser la couverture par module.
- **Centraliser les schémas zod** dans `lib/schemas/` (déjà commencé via [lib/schemas/import-edition.ts](../lib/schemas/import-edition.ts)) pour partage client/serveur strict.
- **Suite Playwright** : marquer `retry1` n'apparaisse plus parmi les artefacts (`test-results/.../-retry1`) → cibler les flaky tests `edition-management-volunteers`.
- **Doc auto** : ajouter un script de génération d'index des endpoints API à partir des fichiers `server/api/**` pour synchroniser [docs/README.md](./README.md).
- **Migration Nuxt 5** : `compatibilityVersion: 5` déjà actif → préparer la migration progressive (Vue Router 5, breaking imports).

### Quick wins (≤1 jour chacun)

1. Purger [i18n/locales-backup/](../i18n/locales-backup/) et déplacer hors repo.
2. Déplacer les `docker-compose.*.yml` dans `docker/compose/` avec un Makefile/alias.
3. Activer un job CI dédié pour `check-i18n` + `check-translations` (échec si désynchro).
4. Ajouter un cron de purge `ApiErrorLog` > 90 jours via [server/tasks/](../server/tasks/).
5. Documenter explicitement dans `README` la matrice "module édition ↔ permission" pour les nouveaux contributeurs.

---

> Pour explorer la base : commencez par [README.md](../README.md) → [CLAUDE.md](../CLAUDE.md) → [docs/README.md](./README.md) → [prisma/schema/](../prisma/schema/) → [server/api/editions/[id]/](../server/api/editions/[id]/).
