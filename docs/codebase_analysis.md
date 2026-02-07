# Analyse complète du Codebase - Convention de Jonglerie

> Document mis à jour le 2026-02-07

## Table des matières

- [1. Vue d'ensemble du projet](#1-vue-densemble-du-projet)
- [2. Analyse détaillée de la structure des répertoires](#2-analyse-détaillée-de-la-structure-des-répertoires)
- [3. Analyse fichier par fichier](#3-analyse-fichier-par-fichier)
  - [3.1 Fichiers de configuration](#31-fichiers-de-configuration)
  - [3.2 Couche données (Prisma)](#32-couche-données-prisma)
  - [3.3 Frontend / UI](#33-frontend--ui)
  - [3.4 Backend / API](#34-backend--api)
  - [3.5 Tests](#35-tests)
  - [3.6 DevOps](#36-devops)
- [4. Analyse des endpoints API](#4-analyse-des-endpoints-api)
- [5. Plongée architecturale](#5-plongée-architecturale)
- [6. Analyse de l'environnement et du setup](#6-analyse-de-lenvironnement-et-du-setup)
- [7. Stack technologique](#7-stack-technologique)
- [8. Diagramme d'architecture](#8-diagramme-darchitecture)
- [9. Insights clés et recommandations](#9-insights-clés-et-recommandations)

---

## 1. Vue d'ensemble du projet

**Type :** Application web full-stack (SPA/SSR) de gestion et découverte de conventions de jonglerie.

**Architecture :** Monolithe Nuxt.js avec API REST intégrée (pattern "full-stack Nuxt"), utilisant Nitro comme moteur serveur et Prisma comme ORM.

**Langages :** TypeScript (100% du code applicatif), SQL (migrations Prisma).

**Stack principale :**

| Couche          | Technologie                 | Version |
| --------------- | --------------------------- | ------- |
| Framework       | Nuxt.js                     | 4.3.0   |
| Frontend        | Vue.js                      | 3.5.17  |
| UI Components   | Nuxt UI                     | 4.0.0   |
| CSS             | Tailwind CSS (via Nuxt UI)  | -       |
| State           | Pinia                       | 3.0.3   |
| i18n            | @nuxtjs/i18n                | 10.0.3  |
| ORM             | Prisma                      | 7.0.0   |
| Base de données | MySQL (via MariaDB adapter) | 8.0     |
| Auth            | nuxt-auth-utils (sessions)  | 0.5.23  |
| Tests           | Vitest + Nuxt Test Utils    | 3.2.4   |
| Runtime         | Node.js                     | >= 22   |

**Chiffres clés :**

| Métrique               | Valeur |
| ---------------------- | ------ |
| Fichiers de code       | ~2 815 |
| Composants Vue         | 131    |
| Pages                  | 71     |
| Endpoints API          | ~357   |
| Modèles Prisma         | 73     |
| Enums Prisma           | 20     |
| Fichiers schéma Prisma | 9      |
| Migrations             | 136    |
| Composables            | 48     |
| Fichiers de tests      | 183    |
| Langues supportées     | 13     |
| Clés de traduction     | ~3 072 |

---

## 2. Analyse détaillée de la structure des répertoires

```
convention-de-jonglerie/
├── app/                    # Frontend Nuxt (pages, composants, stores, composables)
│   ├── assets/             # CSS global et images statiques
│   │   ├── css/            # Styles Tailwind et overrides
│   │   └── img/            # Images intégrées (ex: HelloAsso)
│   ├── components/         # 131 composants Vue réutilisables
│   │   ├── admin/          # Composants d'administration (import, backup, users)
│   │   ├── artists/        # Gestion des artistes
│   │   ├── convention/     # Formulaires et modals de convention
│   │   ├── edition/        # Composants d'édition (le plus riche)
│   │   │   ├── carpool/    # Covoiturage (offres, demandes, commentaires)
│   │   │   ├── ticketing/  # Billetterie (HelloAsso integration)
│   │   │   ├── volunteer/  # Bénévoles (candidatures, planning, notifications)
│   │   │   │   ├── notifications/
│   │   │   │   └── planning/
│   │   │   └── zones/      # Zones et marqueurs de carte
│   │   ├── feedback/       # Modal de retour utilisateur
│   │   ├── management/     # Navigation et cards de gestion
│   │   ├── messenger/      # Messagerie temps réel
│   │   ├── notifications/  # Centre de notifications
│   │   ├── organizer/      # Champs de droits organisateur
│   │   ├── organizers/     # QR codes et objets consignés
│   │   ├── profile/        # Profil utilisateur
│   │   ├── show-application/ # Candidatures de spectacles
│   │   ├── shows/          # Gestion des spectacles
│   │   ├── ticketing/      # Billetterie (tiers, quotas, stats, QR)
│   │   │   └── stats/      # Graphiques Chart.js
│   │   ├── ui/             # Composants UI réutilisables (Avatar, DateTimePicker, ConfirmModal)
│   │   ├── volunteers/     # Composants publics bénévoles
│   │   └── workshops/      # Ateliers
│   ├── composables/        # 48 composables Vue (logique réutilisable)
│   ├── config/             # Configuration app (app.config.ts)
│   ├── layouts/            # 3 layouts (default, messenger, edition-dashboard)
│   ├── middleware/          # 6 middlewares de navigation
│   ├── pages/              # 71 pages (routes automatiques Nuxt)
│   │   ├── admin/          # Panel d'administration
│   │   ├── auth/           # Authentification (reset/forgot password)
│   │   ├── carpool-offers/ # [legacy]
│   │   ├── conventions/    # CRUD conventions
│   │   ├── editions/       # Pages d'éditions (le plus riche)
│   │   │   └── [id]/
│   │   │       ├── gestion/ # Dashboard de gestion (30+ pages)
│   │   │       │   ├── artists/
│   │   │       │   ├── meals/
│   │   │       │   ├── shows-call/
│   │   │       │   ├── ticketing/
│   │   │       │   ├── volunteers/
│   │   │       │   └── workshops/
│   │   │       ├── shows-call/
│   │   │       └── volunteers/
│   │   ├── shows-call/     # Appels à spectacles publics
│   │   └── welcome/        # Onboarding
│   ├── plugins/            # 6 plugins client-side
│   ├── stores/             # 5 stores Pinia
│   ├── types/              # Définitions TypeScript
│   └── utils/              # 20 utilitaires frontend
│       └── ticketing/      # Utils spécifiques billetterie
├── server/                 # Backend Nitro
│   ├── api/                # ~357 endpoints API REST
│   │   ├── admin/          # Routes d'administration
│   │   ├── auth/           # Authentification
│   │   ├── carpool-offers/ # Covoiturage
│   │   ├── conventions/    # Conventions CRUD
│   │   ├── editions/       # Éditions (le plus riche)
│   │   │   └── [id]/       # Sous-ressources d'une édition
│   │   ├── feedback/       # Retours utilisateurs
│   │   ├── files/          # Upload de fichiers
│   │   ├── messenger/      # Messagerie
│   │   ├── notifications/  # Notifications + FCM
│   │   ├── profile/        # Profil utilisateur
│   │   ├── session/        # Session courante
│   │   ├── show-applications/ # Candidatures spectacles
│   │   ├── shows-call/     # Appels à spectacles
│   │   ├── uploads/        # Serveur de fichiers
│   │   └── users/          # Gestion utilisateurs
│   ├── constants/          # Constantes serveur (public-routes, permissions)
│   ├── emails/             # Templates d'emails (vue-email)
│   ├── middleware/          # 3 middlewares serveur
│   ├── plugins/            # 4 plugins serveur (scheduler, error-logging, etc.)
│   ├── routes/             # Routes spéciales (OAuth, uploads)
│   ├── tasks/              # Tâches planifiées Nitro
│   ├── templates/          # Templates divers
│   ├── types/              # Types serveur
│   └── utils/              # ~81 utilitaires serveur
│       ├── editions/       # Utils spécifiques éditions
│       │   ├── ticketing/  # Logique billetterie
│       │   └── volunteers/ # Logique bénévoles
│       ├── permissions/    # Système de permissions granulaire
│       └── ticketing/      # Utils billetterie
├── prisma/                 # Base de données
│   ├── schema/             # Schéma multi-fichiers (9 fichiers, 1856 lignes, 73 modèles)
│   │   ├── schema.prisma   # Core (User, Convention, Edition, Organizers, Posts, Zones, Markers)
│   │   ├── ticketing.prisma # Billetterie (21 modèles)
│   │   ├── volunteer.prisma # Bénévoles (8 modèles)
│   │   ├── artists.prisma  # Artistes et spectacles (6 modèles)
│   │   ├── misc.prisma     # Divers (notifications, feedback, erreurs, objets trouvés)
│   │   ├── meals.prisma    # Repas (7 modèles)
│   │   ├── carpool.prisma  # Covoiturage (6 modèles)
│   │   ├── messenger.prisma # Messagerie (3 modèles)
│   │   └── workshops.prisma # Ateliers (3 modèles)
│   └── migrations/         # 136 migrations
├── shared/                 # Code partagé app ↔ server
│   └── utils/
│       └── zone-types.ts   # Types de zones (couleurs, icônes)
├── i18n/                   # Internationalisation
│   └── locales/            # 13 langues
│       ├── fr/             # 7 fichiers JSON (~3 494 lignes)
│       ├── en/             # 6 fichiers JSON
│       └── {cs,da,de,es,it,nl,pl,pt,ru,sv,uk}/
├── test/                   # 183 fichiers de tests
│   ├── unit/               # Tests unitaires (happy-dom)
│   ├── nuxt/               # Tests Nuxt (environnement complet)
│   ├── e2e/                # Tests end-to-end
│   ├── integration/        # Tests DB
│   └── __mocks__/          # Mocks partagés
├── docs/                   # Documentation technique
├── scripts/                # Scripts utilitaires
├── docker/                 # Configuration Docker
├── lib/                    # Bibliothèques partagées
│   └── schemas/            # Schémas Zod
├── public/                 # Assets statiques
└── types/                  # Déclarations TypeScript globales
```

---

## 3. Analyse fichier par fichier

### 3.1 Fichiers de configuration

| Fichier                   | Rôle                                                                       |
| ------------------------- | -------------------------------------------------------------------------- |
| `nuxt.config.ts`          | Config principale Nuxt : modules, i18n (13 locales), SEO, Vite, routeRules |
| `package.json`            | Dépendances + 65 scripts npm (dev, build, test, docker, i18n, admin)       |
| `tsconfig.json`           | Config TypeScript avec alias de chemins (`~/`, `@/`, `~/types`)            |
| `vitest.config.ts`        | 4 projets de test : unit, nuxt, e2e, integration                           |
| `eslint.config.mjs`       | Configuration ESLint (via `@nuxt/eslint`)                                  |
| `prisma.config.ts`        | Configuration Prisma                                                       |
| `app.config.ts`           | Configuration runtime de l'application                                     |
| `.env`                    | Variables d'environnement (DB, SMTP, Firebase, reCAPTCHA, AI)              |
| `docker-compose.dev.yml`  | Environnement de développement Docker (app + MySQL)                        |
| `docker-compose.prod.yml` | Environnement de production Docker                                         |
| `Dockerfile`              | Image de production multi-stage                                            |

### 3.2 Couche données (Prisma)

**Schéma multi-fichiers** : `prisma/schema/` (9 fichiers, 1 856 lignes total)

Le schéma Prisma a été refactorisé en une architecture multi-fichiers par domaine métier (Prisma GA depuis v6.7.0). Le fichier principal `schema.prisma` contient le generator, le datasource, et les modèles core (User, Convention, Edition). Les modèles de domaines spécialisés sont dans des fichiers dédiés. Les références entre fichiers sont résolues automatiquement par Prisma.

**73 modèles** organisés par domaine :

#### Utilisateurs et Authentification

- `User` — Modèle central avec email, pseudo, auth provider, rôles (isGlobalAdmin, isVolunteer, isArtist, isOrganizer)
- `PasswordResetToken` — Tokens de réinitialisation de mot de passe
- `FcmToken` — Tokens Firebase Cloud Messaging pour les push notifications

#### Conventions et Éditions

- `Convention` — Convention de jonglerie (nom, description, logo)
- `Edition` — Édition annuelle d'une convention (dates, lieu, services, ~80 champs boolean pour les features)
- `EditionPost` / `EditionPostComment` — Fil d'actualité par édition
- `EditionZone` / `EditionMarker` — Zones et points de repère sur la carte

#### Permissions et Organisation

- `ConventionOrganizer` — Organisateur avec droits granulaires (canEditConvention, canManageVolunteers, etc.)
- `EditionOrganizerPermission` — Permissions par édition (canEdit, canDelete, canManageVolunteers, etc.)
- `EditionOrganizer` — Lien organisateur ↔ édition avec QR code
- `OrganizerPermissionHistory` — Historique des changements de permissions

#### Bénévoles

- `EditionVolunteerApplication` — Candidatures bénévoles (statut, préférences, allergies, urgence)
- `VolunteerTeam` — Équipes de bénévoles
- `VolunteerTimeSlot` / `VolunteerAssignment` — Créneaux horaires et affectations
- `VolunteerNotificationGroup` / `VolunteerNotificationConfirmation` — Notifications groupées
- `VolunteerMeal` / `VolunteerMealSelection` — Repas bénévoles
- `VolunteerComment` — Commentaires sur les bénévoles
- `ApplicationTeamAssignment` — Affectation équipes aux candidatures

#### Billetterie

- `TicketingTier` — Tarifs (nom, prix, dates de validité)
- `TicketingOption` — Options additionnelles
- `TicketingQuota` — Quotas de places
- `TicketingOrder` / `TicketingOrderItem` — Commandes et items
- `TicketingReturnableItem` — Objets consignés
- `TicketingCounter` — Guichets de vente
- `TicketingTierCustomField` — Champs personnalisés
- `ExternalTicketing` / `HelloAssoConfig` — Intégrations externes
- Relations complexes : `TicketingTierQuota`, `TicketingTierReturnableItem`, `TicketingTierOption`, etc.

#### Covoiturage

- `CarpoolOffer` / `CarpoolRequest` — Offres et demandes
- `CarpoolBooking` / `CarpoolPassenger` — Réservations et passagers
- `CarpoolComment` / `CarpoolRequestComment` — Commentaires

#### Artistes et Spectacles

- `EditionArtist` — Profils artistes (paiement, hébergement, transport)
- `Show` / `ShowArtist` — Spectacles et artistes associés
- `ShowReturnableItem` — Objets consignés pour spectacles
- `EditionShowCall` / `ShowApplication` — Appels à candidatures

#### Ateliers

- `Workshop` / `WorkshopLocation` / `WorkshopFavorite` — Ateliers avec lieux et favoris

#### Messagerie

- `Conversation` / `ConversationParticipant` / `Message` — Système de messagerie

#### Divers

- `Notification` — Centre de notifications (14 types)
- `Feedback` — Retours utilisateurs
- `ApiErrorLog` — Logs d'erreurs API
- `LostFoundItem` / `LostFoundComment` — Objets trouvés
- `ConventionClaimRequest` — Revendications de conventions

**20 enums** : `EditionStatus` (OFFLINE, ONLINE, ARCHIVED), `VolunteerStatus`, `BookingStatus`, `ConversationType`, etc.

### 3.3 Frontend / UI

#### Pages (71 fichiers .vue)

| Route                                           | Description                           |
| ----------------------------------------------- | ------------------------------------- |
| `/`                                             | Accueil avec carte interactive        |
| `/login`, `/register`, `/verify-email`          | Authentification                      |
| `/auth/forgot-password`, `/auth/reset-password` | Récupération mot de passe             |
| `/welcome/categories`                           | Onboarding catégories utilisateur     |
| `/profile`                                      | Profil utilisateur                    |
| `/favorites`                                    | Éditions favorites avec carte         |
| `/my-conventions`                               | Mes conventions                       |
| `/my-volunteer-applications`                    | Mes candidatures bénévoles            |
| `/my-artist-applications`                       | Mes candidatures artistes             |
| `/messenger`                                    | Messagerie                            |
| `/notifications`                                | Centre de notifications               |
| `/conventions/add`, `/conventions/[id]/edit`    | Gestion de conventions                |
| `/editions/[id]`                                | Détail d'une édition                  |
| `/editions/[id]/map`                            | Carte interactive de l'édition        |
| `/editions/[id]/carpool`                        | Covoiturage                           |
| `/editions/[id]/commentaires`                   | Fil d'actualité                       |
| `/editions/[id]/lost-found`                     | Objets trouvés                        |
| `/editions/[id]/workshops`                      | Ateliers                              |
| `/editions/[id]/volunteers`                     | Inscription bénévole                  |
| `/editions/[id]/shows-call`                     | Appels à spectacles                   |
| `/editions/[id]/gestion/**`                     | Dashboard de gestion (30+ sous-pages) |
| `/admin/**`                                     | Panel d'administration global         |
| `/shows-call/open`                              | Appels à spectacles ouverts           |
| `/privacy-policy`                               | Politique de confidentialité          |

#### Composables (48)

| Composable                    | Rôle                                                 |
| ----------------------------- | ---------------------------------------------------- |
| `useApiAction`                | Actions API standardisées (loading, toast, erreur)   |
| `useMapMarkers`               | Carte Leaflet partagée (HomeMap, FavoritesMap)       |
| `useLeafletMap`               | Initialisation Leaflet (chargement CDN dynamique)    |
| `useLeafletEditable`          | Carte éditable (zones, marqueurs)                    |
| `useEditionZones`             | CRUD zones d'édition                                 |
| `useEditionMarkers`           | CRUD marqueurs d'édition                             |
| `useDateFormat`               | Formatage de dates (locale-aware)                    |
| `useDatetime`                 | Manipulation avancée de dates                        |
| `useDateTimePicker`           | Logique du composant DateTimePicker                  |
| `useCountries`                | Liste de pays avec traduction                        |
| `useCountryTranslation`       | Traduction des noms de pays                          |
| `useImageUrl`                 | Construction d'URLs d'images depuis noms de fichiers |
| `useModal`                    | Gestion de modals                                    |
| `useDebounce`                 | Debounce réactif                                     |
| `usePasswordStrength`         | Validation de force de mot de passe                  |
| `useUrlValidation`            | Validation d'URLs                                    |
| `useReturnTo`                 | Redirection post-login                               |
| `useProfileStats`             | Statistiques du profil                               |
| `useConventionServices`       | Services d'une convention (features boolean)         |
| `useOrganizerTitle`           | Titre dérivé des permissions                         |
| `useVolunteerSettings`        | Configuration bénévoles d'une édition                |
| `useVolunteerTeams`           | Gestion d'équipes de bénévoles                       |
| `useVolunteerTimeSlots`       | Créneaux horaires bénévoles                          |
| `useVolunteerSchedule`        | Planning bénévoles                                   |
| `useTicketingSettings`        | Configuration billetterie                            |
| `useTicketingCounter`         | Guichet de billetterie                               |
| `useParticipantTypes`         | Types de participants (tier, option)                 |
| `useMeals`                    | Gestion des repas                                    |
| `useCalendar`                 | Logique FullCalendar                                 |
| `useChartExport`              | Export de graphiques (PDF/PNG)                       |
| `useEditionStatus`            | Statut d'édition (online, offline, archived)         |
| `useTimezones`                | Sélection de fuseau horaire                          |
| `useMessenger`                | Messagerie (conversations, messages)                 |
| `useMessengerStream`          | SSE pour messagerie temps réel                       |
| `useNotificationStream`       | SSE pour notifications temps réel                    |
| `useFirebaseMessaging`        | Push notifications Firebase                          |
| `usePWA`                      | Progressive Web App (install prompt)                 |
| `usePushNotificationPromo`    | Promotion des notifications push                     |
| `useDeviceId`                 | Identifiant unique de device                         |
| `useTypingIndicator`          | Indicateur "en train d'écrire"                       |
| `useElapsedTimer`             | Minuterie écoulée                                    |
| `useRealtimeStats`            | Stats temps réel                                     |
| `useAccessControlPermissions` | Permissions contrôle d'accès                         |
| `useImportGeneration`         | Génération d'import IA                               |
| `useLazyI18n`                 | Chargement paresseux de traductions                  |
| `useI18nNavigation`           | Navigation i18n                                      |
| `useUserDeletion`             | Suppression de compte                                |
| `useCarpoolForm`              | Formulaire covoiturage                               |

#### Stores Pinia (5)

| Store               | Rôle                                           |
| ------------------- | ---------------------------------------------- |
| `auth`              | État d'authentification et session utilisateur |
| `editions`          | Cache des éditions chargées                    |
| `favoritesEditions` | Gestion des favoris (Map locale + API sync)    |
| `notifications`     | Compteur de notifications non lues             |
| `impersonation`     | Mode impersonation admin                       |

#### Middlewares Navigation (6)

| Middleware                 | Rôle                                      |
| -------------------------- | ----------------------------------------- |
| `authenticated`            | Redirige vers login si non connecté       |
| `auth-protected`           | Protection stricte des routes             |
| `guest-only`               | Redirige vers accueil si déjà connecté    |
| `super-admin`              | Accès réservé aux administrateurs globaux |
| `verify-email-access`      | Accès à la page de vérification email     |
| `load-translations.global` | Chargement dynamique des traductions i18n |

#### Plugins Client (6)

| Plugin                     | Rôle                                      |
| -------------------------- | ----------------------------------------- |
| `auth.client`              | Initialisation session au démarrage       |
| `firebase.client`          | Initialisation Firebase SDK               |
| `countries.client`         | Chargement i18n-iso-countries             |
| `admin-mode-header.client` | Header X-Admin-Mode pour impersonation    |
| `vue-json-viewer.client`   | Composant JSON viewer pour debug          |
| `router-api-ignore.client` | Ignore les routes /api dans le router Vue |

#### Layouts (3)

| Layout              | Utilisation                                           |
| ------------------- | ----------------------------------------------------- |
| `default`           | Header + contenu + footer (toutes les pages standard) |
| `messenger`         | Layout plein écran pour la messagerie                 |
| `edition-dashboard` | Sidebar de gestion + contenu (pages `/gestion/**`)    |

### 3.4 Backend / API

#### Middlewares Serveur (3)

| Middleware      | Rôle                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`       | Authentication gateway (44 lignes) : consomme la config déclarative `public-routes.ts`, hydratation de `event.context.user` |
| `cache-headers` | Headers de cache HTTP pour les assets statiques                                                                             |
| `noindex`       | Header `X-Robots-Tag: noindex` pour staging/release                                                                         |

#### Plugins Serveur (4)

| Plugin            | Rôle                                                      |
| ----------------- | --------------------------------------------------------- |
| `scheduler`       | Tâches cron (node-cron) : nettoyage tokens, notifications |
| `error-logging`   | Capture et log des erreurs non gérées                     |
| `countries`       | Chargement des données de pays côté serveur               |
| `recaptcha-debug` | Debug de la configuration reCAPTCHA                       |

#### Utilitaires Serveur (~81 fichiers)

**Core :**

- `prisma.ts` — Singleton Prisma Client avec MariaDB adapter
- `errors.ts` — Classes d'erreur standardisées (ApiError, BadRequestError, NotFoundError, etc.)
- `api-helpers.ts` — Wrappers API (wrapApiHandler, createSuccessResponse, createPaginatedResponse)
- `validation-schemas.ts` — Schémas de validation Zod
- `validation-helpers.ts` — Helpers de validation
- `prisma-helpers.ts` — Helpers Prisma
- `prisma-select-helpers.ts` — Sélections Prisma réutilisables

**Authentification & Sécurité :**

- `auth-utils.ts` — Utilitaires d'authentification
- `admin-auth.ts` — Vérification admin global
- `encryption.ts` — Chiffrement/déchiffrement
- `jwt.ts` — Gestion de tokens JWT
- `rate-limiter.ts` / `api-rate-limiter.ts` — Rate limiting
- `token-generator.ts` — Génération de tokens sécurisés

**Permissions :**

- `permissions/permissions.ts` — Vérification de permissions d'édition
- `permissions/convention-permissions.ts` — Permissions convention
- `permissions/edition-permissions.ts` — Permissions édition
- `permissions/volunteer-permissions.ts` — Permissions bénévoles
- `permissions/access-control-permissions.ts` — Contrôle d'accès
- `permissions/workshop-permissions.ts` — Permissions ateliers
- `permissions/meal-validation-permissions.ts` — Validation repas
- `permissions/types.ts` — Types de permissions

**Communication :**

- `emailService.ts` — Service d'envoi d'emails (nodemailer)
- `notification-service.ts` — Service de notifications
- `unified-push-service.ts` — Push notifications Firebase
- `sse-manager.ts` — Server-Sent Events manager
- `notification-stream-manager.ts` — Stream de notifications
- `messenger-helpers.ts` — Helpers messagerie
- `messenger-unread-service.ts` — Compteur de messages non lus
- `ticketing-counter-sse.ts` — SSE pour guichets billetterie
- `import-generation-sse.ts` — SSE pour import IA
- `typing-state.ts` — État d'écriture en temps réel
- `conversation-presence-service.ts` — Présence dans les conversations

**IA & Scraping :**

- `anthropic.ts` — Client Anthropic Claude
- `llm-client.ts` — Client LLM abstrait
- `ai-config.ts` / `ai-providers.ts` — Configuration multi-provider (Anthropic, Ollama, LM Studio)
- `facebook-event-scraper.ts` — Scraping événements Facebook
- `jugglingedge-scraper.ts` — Scraping du site JugglingEdge
- `web-content-extractor.ts` — Extraction de contenu web
- `web-content-cache.ts` — Cache de contenu web
- `edition-features-extractor.ts` — Extraction de features via IA
- `import-json-schema.ts` — Schéma JSON d'import
- `time-extraction-patterns.ts` — Patterns d'extraction de temps

**Données :**

- `geocoding.ts` — Géocodage via Nominatim
- `date-utils.ts` / `date-helpers.ts` — Utilitaires de dates
- `countries.ts` — Données pays
- `avatar-url.ts` — URLs Gravatar
- `email-hash.ts` — Hash MD5 d'email pour Gravatar
- `allergy-severity.ts` — Niveaux de sévérité d'allergies
- `zone-validation.ts` — Validation de zones géographiques

**Fichiers :**

- `file-helpers.ts` — Helpers de fichiers
- `move-temp-image.ts` — Déplacement d'images temporaires
- `image-deletion.ts` — Suppression d'images
- `copy-to-output.ts` — Copie vers le dossier de sortie

**Divers :**

- `logger.ts` — Logger serveur
- `error-logger.ts` — Logger d'erreurs API
- `cache-helpers.ts` — Helpers de cache
- `fetch-helpers.ts` — Helpers pour fetch
- `async-tasks.ts` — Tâches asynchrones
- `server-i18n.ts` — i18n côté serveur
- `impersonation-helpers.ts` — Helpers d'impersonation
- `volunteer-scheduler.ts` — Planification bénévoles
- `volunteer-application-diff.ts` — Diff de candidatures bénévoles
- `volunteer-meals.ts` — Logique repas bénévoles
- `organizer-management.ts` — Gestion des organisateurs
- `show-application-helpers.ts` — Helpers candidatures spectacles
- `commentsHandler.ts` — Handler générique de commentaires
- `notification-preferences.ts` — Préférences de notifications

### 3.5 Tests

**183 fichiers de tests** organisés en 4 projets Vitest :

| Projet        | Environnement | Fichiers | Description                                  |
| ------------- | ------------- | -------- | -------------------------------------------- |
| `unit`        | happy-dom     | ~20      | Tests unitaires (composables, utils, stores) |
| `nuxt`        | nuxt          | ~150     | Tests avec environnement Nuxt complet        |
| `e2e`         | nuxt          | ~5       | Tests end-to-end avec serveur                |
| `integration` | node          | ~8       | Tests avec base de données MySQL réelle      |

**Tests unitaires** (`test/unit/`) :

- `composables/` — Tests de composables
- `utils/` — Tests d'utilitaires (countries, avatar, markdown, mapMarkers, etc.)
- `stores/` — Tests de stores Pinia
- `security/` — Tests de sécurité
- `i18n/` — Tests de parité des clés de traduction

**Tests Nuxt** (`test/nuxt/`) :

- `components/` — Tests de composants Vue
- `pages/` — Tests de pages (~20 pages testées)
- `server/api/` — Tests d'endpoints API (le plus fourni, ~100 fichiers)
- `server/middleware/` — Tests de middlewares
- `server/utils/` — Tests d'utilitaires serveur
- `features/` — Tests de fonctionnalités complètes
- `middleware/` — Tests de middlewares de navigation

**Tests d'intégration** (`test/integration/`) :

- `auth.db.test.ts` — Flux d'authentification
- `conventions.db.test.ts` — CRUD conventions
- `volunteers.workflow.db.test.ts` — Workflow bénévoles
- `organizers.chain.db.test.ts` — Chaîne organisateurs
- `access-control-permissions.db.test.ts` — Permissions contrôle d'accès
- `lost-found.db.test.ts` — Objets trouvés
- `migrate-organizers.db.test.ts` — Migration organisateurs

### 3.6 DevOps

#### Docker

| Fichier                               | Rôle                         |
| ------------------------------------- | ---------------------------- |
| `Dockerfile`                          | Image production multi-stage |
| `Dockerfile.test`                     | Image pour les tests         |
| `docker-compose.dev.yml`              | Développement (app + MySQL)  |
| `docker-compose.prod.yml`             | Production                   |
| `docker-compose.release.yml`          | Release/staging              |
| `docker-compose.test.yml`             | Base de données de test      |
| `docker-compose.test-all.yml`         | Tous les tests               |
| `docker-compose.test-simple.yml`      | Tests unitaires seulement    |
| `docker-compose.test-integration.yml` | Tests d'intégration          |
| `docker-compose.test-ui.yml`          | Tests avec UI Vitest         |
| `docker-compose.dev-install.yml`      | Installation des dépendances |

#### CI/CD (GitHub Actions)

Le fichier `.github/workflows/tests.yml` définit un pipeline en 4 jobs :

1. **setup** — Installation, cache des dépendances, Prisma, Nuxt prepare
2. **lint** — ESLint (dépend de setup)
3. **build** — Build de production (dépend de setup)
4. **test** — 4 groupes en parallèle : unit, nuxt, e2e, database (dépend de setup + lint + build)

**Caractéristiques :** Cache agressif (deps, Prisma, Nuxt), MySQL conditionnel, fail-fast désactivé, timeouts adaptés.

---

## 4. Analyse des endpoints API

### Organisation des routes

Les endpoints suivent le pattern de file-system routing de Nitro :

- `server/api/{resource}/{action}.{method}.ts`
- Exemples : `editions/[id]/volunteers/applications.get.ts`

### Endpoints principaux

#### Authentification (`/api/auth/`)

| Méthode | Route                      | Description                        |
| ------- | -------------------------- | ---------------------------------- |
| POST    | `/register`                | Inscription                        |
| POST    | `/login`                   | Connexion                          |
| POST    | `/verify-email`            | Vérification code email            |
| POST    | `/resend-verification`     | Renvoi du code                     |
| POST    | `/request-password-reset`  | Demande de réinitialisation        |
| POST    | `/reset-password`          | Réinitialisation du mot de passe   |
| POST    | `/check-email`             | Vérification existence email       |
| POST    | `/set-password-and-verify` | Définir mot de passe + vérifier    |
| GET     | `/verify-reset-token`      | Vérifier token de réinitialisation |

#### Conventions (`/api/conventions/`)

| Méthode | Route              | Description                |
| ------- | ------------------ | -------------------------- |
| GET     | `/`                | Liste des conventions      |
| POST    | `/`                | Créer une convention       |
| GET     | `/[id]`            | Détail d'une convention    |
| PUT     | `/[id]`            | Modifier une convention    |
| DELETE  | `/[id]`            | Supprimer une convention   |
| GET     | `/[id]/organizers` | Liste des organisateurs    |
| POST    | `/[id]/organizers` | Ajouter un organisateur    |
| POST    | `/[id]/claim`      | Revendiquer une convention |

#### Éditions (`/api/editions/`)

| Méthode | Route              | Description            |
| ------- | ------------------ | ---------------------- |
| GET     | `/`                | Liste des éditions     |
| POST    | `/`                | Créer une édition      |
| GET     | `/[id]`            | Détail d'une édition   |
| PUT     | `/[id]`            | Modifier une édition   |
| DELETE  | `/[id]`            | Supprimer une édition  |
| GET     | `/[id]/export.kml` | Export KML de la carte |

#### Éditions > Bénévoles (`/api/editions/[id]/volunteers/`)

| Méthode | Route                               | Description                     |
| ------- | ----------------------------------- | ------------------------------- |
| GET     | `/info`                             | Infos bénévoles (public)        |
| GET     | `/settings`                         | Configuration (public)          |
| GET     | `/applications`                     | Liste des candidatures          |
| POST    | `/applications`                     | Soumettre une candidature       |
| PUT     | `/applications/[id]`                | Modifier une candidature        |
| PATCH   | `/applications/[id]`                | Changer le statut               |
| GET/PUT | `/applications/[id]/teams/[teamId]` | Gestion équipes candidature     |
| GET     | `/teams`                            | Liste des équipes               |
| POST    | `/teams`                            | Créer une équipe                |
| GET     | `/notification`                     | Historique notifications        |
| POST    | `/notification`                     | Créer un groupe de notification |
| GET     | `/catering`                         | Restauration bénévoles          |
| GET     | `/access-control`                   | Contrôle d'accès                |

#### Éditions > Billetterie (`/api/editions/[id]/ticketing/`)

| Méthode | Route               | Description                       |
| ------- | ------------------- | --------------------------------- |
| GET     | `/stats`            | Statistiques de vente             |
| GET     | `/tiers`            | Liste des tarifs                  |
| POST    | `/tiers`            | Créer un tarif                    |
| GET     | `/options`          | Liste des options                 |
| GET     | `/quotas`           | Quotas de places                  |
| GET     | `/orders`           | Commandes                         |
| POST    | `/orders`           | Créer une commande                |
| GET     | `/counters`         | Guichets                          |
| POST    | `/counters`         | Créer un guichet                  |
| GET     | `/custom-fields`    | Champs personnalisés              |
| GET     | `/returnable-items` | Objets consignés                  |
| POST    | `/external`         | Configuration billetterie externe |
| POST    | `/helloasso`        | Configuration HelloAsso           |

#### Éditions > Autres sous-ressources

| Préfixe                           | Description             |
| --------------------------------- | ----------------------- |
| `/api/editions/[id]/artists/`     | Gestion des artistes    |
| `/api/editions/[id]/shows/`       | Gestion des spectacles  |
| `/api/editions/[id]/shows-call/`  | Appels à candidatures   |
| `/api/editions/[id]/workshops/`   | Ateliers                |
| `/api/editions/[id]/meals/`       | Repas                   |
| `/api/editions/[id]/posts/`       | Fil d'actualité         |
| `/api/editions/[id]/carpool-*/`   | Covoiturage             |
| `/api/editions/[id]/lost-found/`  | Objets trouvés          |
| `/api/editions/[id]/zones/`       | Zones de carte          |
| `/api/editions/[id]/markers/`     | Marqueurs de carte      |
| `/api/editions/[id]/organizers/`  | Organisateurs d'édition |
| `/api/editions/[id]/permissions/` | Permissions d'édition   |

#### Messagerie (`/api/messenger/`)

| Méthode | Route                          | Description                 |
| ------- | ------------------------------ | --------------------------- |
| GET     | `/conversations`               | Liste des conversations     |
| POST    | `/conversations`               | Créer une conversation      |
| GET     | `/conversations/[id]`          | Détail conversation         |
| GET     | `/conversations/[id]/messages` | Messages d'une conversation |
| POST    | `/conversations/[id]/messages` | Envoyer un message          |

#### Administration (`/api/admin/`)

| Méthode | Route                   | Description                 |
| ------- | ----------------------- | --------------------------- |
| GET     | `/users`                | Liste des utilisateurs      |
| GET/PUT | `/users/[id]`           | Détail/modifier utilisateur |
| GET     | `/conventions`          | Toutes les conventions      |
| GET     | `/editions`             | Toutes les éditions         |
| GET     | `/error-logs`           | Logs d'erreurs              |
| GET     | `/feedback`             | Retours utilisateurs        |
| POST    | `/backup`               | Sauvegarde base de données  |
| POST    | `/impersonate`          | Impersonation               |
| GET     | `/tasks`                | Tâches planifiées           |
| GET     | `/notifications`        | Toutes les notifications    |
| POST    | `/generate-import-json` | Import IA d'édition         |

### Patterns d'authentification

Le middleware `auth.ts` utilise une **configuration déclarative** externalisée dans `server/constants/public-routes.ts`. Chaque route publique déclare un matcher (`path` exact, `pattern` regex, ou `prefix` startsWith), les méthodes HTTP autorisées, et un flag optionnel `hydrateSession`.

1. **Routes publiques** : déclarées dans `server/constants/public-routes.ts` (config typée avec union discriminée `PublicRoute`)
2. **Routes protégées** : toutes les routes `/api/*` non matchées requièrent une session (401)
3. **Routes admin** : vérifient `isGlobalAdmin` en plus de l'authentification
4. **Hydratation de session** (`hydrateSession: true`) : sur les routes publiques, la session est chargée sans bloquer pour permettre un rendu conditionnel (ex: détail édition, posts, covoiturage)

---

## 5. Plongée architecturale

### Cycle de vie d'une requête

```
Client (Vue/Nuxt)
  ├── middleware navigation (auth-protected, etc.)
  └── composable useApiAction / $fetch
        │
        ▼
Server Middleware Pipeline
  ├── cache-headers.ts    → Headers de cache
  ├── noindex.ts          → X-Robots-Tag pour staging
  └── auth.ts             → Authentication gateway (config déclarative)
        │                    ├── publicRoutes.find() → matcher (path/pattern/prefix)
        │                    ├── Route publique + hydrateSession → session optionnelle
        │                    ├── Route publique sans hydrateSession → pass-through
        │                    ├── Route protégée /api/* → session check → 401 si absent
        │                    └── Hydratation context.user
        ▼
API Handler (server/api/**/*.ts)
  ├── wrapApiHandler()     → Enveloppeur standardisé
  │   ├── try/catch global
  │   ├── ApiError → createError(status, message)
  │   ├── ZodError → handleValidationError(400)
  │   └── Generic → toApiError(500)
  ├── Permission check     → requireAuth() / requireGlobalAdmin() / permissions/*.ts
  ├── Validation Zod       → validation-schemas.ts
  ├── Prisma queries       → prisma.ts (singleton + select helpers)
  └── Response             → createSuccessResponse / createPaginatedResponse
```

### Système de permissions

Le système est basé sur des **droits granulaires** plutôt que des rôles :

```
Convention
  └── ConventionOrganizer (droits globaux)
        ├── canEditConvention
        ├── canDeleteConvention
        ├── canManageOrganizers
        ├── canAddEdition
        ├── canEditAllEditions
        ├── canDeleteAllEditions
        ├── canManageVolunteers
        ├── canManageArtists
        ├── canManageMeals
        └── canManageTicketing
        │
        └── EditionOrganizerPermission (droits par édition)
              ├── canEdit
              ├── canDelete
              ├── canManageVolunteers
              ├── canManageArtists
              ├── canManageMeals
              └── canManageTicketing
```

### Communication temps réel

L'application utilise **Server-Sent Events (SSE)** pour le temps réel :

- `notification-stream-manager.ts` — Flux de notifications push/in-app
- `sse-manager.ts` — Manager générique SSE
- `ticketing-counter-sse.ts` — Mise à jour en temps réel des guichets
- `import-generation-sse.ts` — Progression de l'import IA

Côté client, les composables `useNotificationStream` et `useMessengerStream` consomment ces flux.

### Internationalisation

- **13 langues** supportées (cs, da, de, en, es, fr, it, nl, pl, pt, ru, sv, uk)
- **Lazy loading** par domaine : common, notifications, components, app, public, feedback, gestion
- **Stratégie** : `no_prefix` (pas de préfixe de locale dans les URLs)
- **Détection** : cookie + langue du navigateur, fallback vers anglais
- **~3 072 clés** par langue

### Gestion d'état

```
Pinia Stores
  ├── auth        → Session, user, login/logout
  ├── editions    → Cache des éditions (map)
  ├── favorites   → Favoris (Map + sync API)
  ├── notifications → Compteur non lus
  └── impersonation → Mode admin
```

Les composables encapsulent la logique métier complexe et utilisent `$fetch` / `useApiAction` pour les appels API.

---

## 6. Analyse de l'environnement et du setup

### Variables d'environnement

| Variable                         | Obligatoire | Description                             |
| -------------------------------- | ----------- | --------------------------------------- |
| `DATABASE_URL`                   | Oui         | URL MySQL (mysql://user:pass@host/db)   |
| `NUXT_SESSION_PASSWORD`          | Oui (prod)  | Mot de passe session (32+ chars)        |
| `SEND_EMAILS`                    | Non         | Active l'envoi d'emails (false=dev)     |
| `SMTP_USER` / `SMTP_PASS`        | Si emails   | Identifiants SMTP (Gmail)               |
| `PRISMA_LOG_LEVEL`               | Non         | Niveau de log Prisma                    |
| `ANTHROPIC_API_KEY`              | Non         | Clé API Claude pour import IA           |
| `AI_PROVIDER`                    | Non         | Provider IA (anthropic/ollama/lmstudio) |
| `NUXT_RECAPTCHA_SECRET_KEY`      | Non         | Clé secrète reCAPTCHA v3                |
| `NUXT_PUBLIC_RECAPTCHA_SITE_KEY` | Non         | Clé publique reCAPTCHA                  |
| `NUXT_PUBLIC_FIREBASE_*`         | Non         | Configuration Firebase (push notifs)    |
| `BROWSERLESS_URL`                | Non         | URL du service Browserless (scraping)   |

### Processus de développement

1. **Installation** : `npm ci` + `npx prisma generate` + `npx nuxi prepare`
2. **Développement** : `docker compose -f docker-compose.dev.yml up --build` (app + MySQL)
3. **Tests** : `npm run test:unit:run` / `npm run test:nuxt:run` / `npm run test:all`
4. **Lint** : `npm run lint -- --fix` + `npm run format`
5. **Build** : `npm run build`

### Déploiement production

- Image Docker multi-stage (`Dockerfile`)
- Orchestration via `docker-compose.prod.yml`
- MySQL 8.0 comme base de données
- Migrations Prisma manuelles avant déploiement
- Assets compressés (gzip + brotli)
- Cache statique 30 jours

---

## 7. Stack technologique

### Runtime & Framework

| Technologie | Version | Rôle                          |
| ----------- | ------- | ----------------------------- |
| Node.js     | >= 22   | Runtime JavaScript/TypeScript |
| Nuxt.js     | 4.3.0   | Framework full-stack Vue SSR  |
| Vue.js      | 3.5.17  | Framework UI réactif          |
| Nitro       | (Nuxt)  | Moteur serveur                |
| TypeScript  | 5.8.3   | Typage statique               |

### UI & Design

| Technologie  | Version | Rôle                           |
| ------------ | ------- | ------------------------------ |
| Nuxt UI      | 4.0.0   | Composants UI (Tailwind-based) |
| Tailwind CSS | (UI)    | Styles utilitaires             |
| Chart.js     | 4.5.1   | Graphiques (stats billetterie) |
| FullCalendar | 6.1.15+ | Calendrier interactif          |
| Leaflet      | 1.9.4   | Cartes interactives (CDN)      |
| flag-icons   | 7.5.0   | Drapeaux de pays               |

### Base de données

| Technologie             | Version | Rôle                                     |
| ----------------------- | ------- | ---------------------------------------- |
| MySQL                   | 8.0     | SGBD relationnel                         |
| Prisma                  | 7.0.0   | ORM + migrations + schéma multi-fichiers |
| @prisma/adapter-mariadb | 7.0.0   | Adaptateur MariaDB driver                |

### Authentification & Sécurité

| Technologie     | Version | Rôle                        |
| --------------- | ------- | --------------------------- |
| nuxt-auth-utils | 0.5.23  | Sessions scellées (cookies) |
| bcryptjs        | 3.0.2   | Hachage mot de passe        |
| reCAPTCHA v3    | -       | Protection anti-bot         |
| Zod             | 4.1.9   | Validation de schémas       |

### Communication

| Technologie  | Version | Rôle                             |
| ------------ | ------- | -------------------------------- |
| nodemailer   | 7.0.5   | Envoi d'emails SMTP              |
| vue-email    | 0.0.21  | Templates d'emails Vue           |
| Firebase FCM | 12.6.0  | Push notifications               |
| SSE (natif)  | -       | Temps réel (notifications, chat) |

### IA & Scraping

| Technologie            | Version | Rôle                         |
| ---------------------- | ------- | ---------------------------- |
| @anthropic-ai/sdk      | 0.67.0  | API Claude pour import IA    |
| facebook-event-scraper | 0.2.6   | Scraping événements Facebook |
| sharp                  | 0.33.5  | Traitement d'images          |

### Outils de développement

| Technologie      | Version | Rôle               |
| ---------------- | ------- | ------------------ |
| Vitest           | 3.2.4   | Framework de tests |
| @nuxt/test-utils | 3.19.2  | Tests Nuxt         |
| ESLint           | 9.32.0  | Linter             |
| Prettier         | 3.3.3   | Formatage de code  |
| Docker           | -       | Conteneurisation   |
| GitHub Actions   | -       | CI/CD              |

---

## 8. Diagramme d'architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                    │
│                                                                                  │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │  Vue 3 +     │  │  Pinia Stores │  │ Leaflet  │  │  Firebase SDK          │ │
│  │  Nuxt UI 4   │  │  (5 stores)   │  │ Maps     │  │  (Push Notifications)  │ │
│  └──────┬───────┘  └───────┬───────┘  └────┬─────┘  └────────────┬───────────┘ │
│         │                  │               │                      │              │
│  ┌──────┴──────────────────┴───────────────┴──────────────────────┴──────────┐  │
│  │                    48 Composables (logique réutilisable)                   │  │
│  │  useApiAction │ useMapMarkers │ useLeafletEditable │ useMessenger │ ...    │  │
│  └──────┬────────────────────────────────────────────────────────────────────┘  │
│         │  $fetch / useApiAction                                                 │
└─────────┼────────────────────────────────────────────────────────────────────────┘
          │
          │ HTTP / SSE
          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SERVEUR (Nitro / Node.js)                              │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                    Server Middleware Pipeline                              │  │
│  │  cache-headers → noindex → auth (publicRoutes[] déclaratif)               │  │
│  └────────────────────────────────────┬──────────────────────────────────────┘  │
│                                       │                                          │
│  ┌────────────────────────────────────┴──────────────────────────────────────┐  │
│  │                        ~357 API Endpoints                                 │  │
│  │                                                                           │  │
│  │  /api/auth/*          │  /api/conventions/*    │  /api/editions/*         │  │
│  │  /api/admin/*         │  /api/messenger/*      │  /api/notifications/*    │  │
│  │  /api/carpool-*/*     │  /api/feedback/*       │  /api/files/*            │  │
│  │  /api/profile/*       │  /api/users/*          │  /api/show-*/*           │  │
│  └────────────────────────────────────┬──────────────────────────────────────┘  │
│                                       │                                          │
│  ┌────────────────────────────────────┴──────────────────────────────────────┐  │
│  │                      Server Utilities (~81)                               │  │
│  │                                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │  Permissions  │  │  API Helpers │  │  SSE Manager │  │  Email Svc   │ │  │
│  │  │  (8 fichiers) │  │  (validation)│  │  (temps réel)│  │  (nodemailer)│ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │  Error Mgmt  │  │  Rate Limit  │  │  IA Clients  │  │  Scraping    │ │  │
│  │  │  (classes)   │  │  (per-route) │  │  (multi-LLM) │  │  (FB, web)   │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                          │
│  ┌────────────────────────────────────┴──────────────────────────────────────┐  │
│  │                    Server Plugins (4)                                      │  │
│  │  scheduler (cron) │ error-logging │ countries │ recaptcha-debug            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────┬────────────────────────────────────────────────────────────────────────┘
          │
          │ Prisma ORM (MariaDB adapter)
          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            BASE DE DONNÉES (MySQL 8.0)                           │
│                                                                                  │
│  73 modèles │ 20 enums │ 136 migrations │ 1856 lignes de schéma (9 fichiers)    │
│                                                                                  │
│  Domaines: schema (core) │ ticketing (21) │ volunteer (8) │ artists (6)         │
│            meals (7)     │ carpool (6)    │ misc (6)      │ messenger (3)        │
│            workshops (3)                                                          │
└─────────────────────────────────────────────────────────────────────────────────┘

Services externes :
  ├── Firebase Cloud Messaging (push notifications)
  ├── Google reCAPTCHA v3 (anti-bot)
  ├── HelloAsso API (billetterie externe)
  ├── Nominatim / OpenStreetMap (géocodage + cartes)
  ├── Anthropic Claude / Ollama / LM Studio (import IA)
  ├── Gmail SMTP (emails)
  └── Browserless (scraping JavaScript)
```

---

## 9. Insights clés et recommandations

### Points forts

1. **Architecture cohérente** : Pattern full-stack Nuxt bien structuré, séparation claire entre app/ et server/, code 100% TypeScript
2. **Schéma Prisma multi-fichiers** : Refactorisation d'un monolithe de 1 821 lignes vers 9 fichiers de domaine (1 856 lignes), améliorant significativement la maintenabilité
3. **Routes publiques déclaratives** : Refactorisation du middleware auth (175 → 44 lignes) avec une configuration externalisée typée dans `server/constants/public-routes.ts`
4. **Système de permissions granulaire** : Modèle de droits flexible et extensible par convention et par édition, avec 8 fichiers de résolution de permissions
5. **Couverture de tests solide** : 183 fichiers de tests, ~1 950 tests, 4 niveaux (unit, nuxt, e2e, integration)
6. **i18n mature** : 13 langues, lazy loading par domaine, 15 fichiers de domaine (fr), outils de vérification et de traduction
7. **Sécurité** : Sessions scellées, rate limiting, reCAPTCHA v3, validation Zod, classes d'erreur standardisées, auth granulaire
8. **CI/CD** : Pipeline GitHub Actions avec cache agressif, tests parallélisés, MySQL conditionnel
9. **Patterns réutilisables** : 48 composables, Prisma select helpers (30+), `wrapApiHandler()`, `useApiAction`
10. **Temps réel** : SSE pour notifications, messagerie, billetterie et import IA
11. **IA multi-provider** : Support Anthropic Claude, Ollama et LM Studio pour l'import automatique d'éditions
12. **Leaflet en lazy loading CDN** : Chargement dynamique avec SRI (integrity hash), zéro impact bundle, types TypeScript manuels bien définis dans `leaflet-global.d.ts`

### Axes d'amélioration

1. **Taille du domaine billetterie** : 21 modèles Prisma dans `ticketing.prisma` (425 lignes) — c'est le domaine le plus complexe et potentiellement candidat à une subdivision
2. **Ratio code/tests des composants** : 131 composants vs tests limités dans `test/nuxt/components/` — les composants complexes (formulaires, plannings) bénéficieraient de plus de couverture
3. **Server utils volumeux** : ~81 fichiers utilitaires serveur — certains pourraient être regroupés dans des modules plus cohérents (la logique IA est déjà bien organisée)
4. **Nombre de migrations** : 136 migrations, ce qui peut ralentir les resets. Un squash périodique pourrait être envisagé
