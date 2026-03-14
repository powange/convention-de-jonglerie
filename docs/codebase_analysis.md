# Analyse complete du codebase -- Convention de Jonglerie

> **Derniere mise a jour** : 3 mars 2026
> **Taille du projet** : ~191 Mo | ~2 827 fichiers de code
> **Version Node.js** : >=22 <26

## Table des matieres

- [1. Vue d'ensemble du projet](#1-vue-densemble-du-projet)
- [2. Architecture technique](#2-architecture-technique)
- [3. Structure des repertoires](#3-structure-des-repertoires)
- [4. Stack technique](#4-stack-technique)
- [5. Base de donnees (Prisma)](#5-base-de-donnees-prisma)
- [6. Backend -- API et serveur](#6-backend----api-et-serveur)
- [7. Frontend -- Pages, composants et stores](#7-frontend----pages-composants-et-stores)
- [8. Internationalisation (i18n)](#8-internationalisation-i18n)
- [9. Tests](#9-tests)
- [10. DevOps et deploiement](#10-devops-et-deploiement)
- [11. Patterns de code](#11-patterns-de-code)
- [12. Diagramme d'architecture](#12-diagramme-darchitecture)
- [13. Recommandations](#13-recommandations)

---

## 1. Vue d'ensemble du projet

**Convention de Jonglerie** est une application web full-stack pour la gestion et la decouverte de conventions de jonglerie. Elle permet de :

- Consulter, creer et gerer des conventions et leurs editions annuelles
- Gerer la billetterie (tarifs, options, quotas, commandes, controle d'acces par QR code)
- Organiser le benevolat (candidatures, equipes, creneaux, planning, repas)
- Gerer les artistes (profils, spectacles, appels a candidatures, hebergement, defraiement)
- Proposer du covoiturage (offres, demandes, reservations, commentaires)
- Communiquer via une messagerie temps reel (SSE, equipes, conversations privees)
- Gerer les ateliers (workshops avec lieux et horaires)
- Publier des posts et gerer les objets trouves/perdus
- Afficher des cartes interactives (Leaflet) avec zones et points de repere
- Administrer le systeme (logs d'erreurs, notifications push, backup, import IA)

### Metriques cles

| Metrique           | Valeur                           |
| ------------------ | -------------------------------- |
| Type               | Application web full-stack (SSR) |
| Langage            | TypeScript 5.9                   |
| Framework          | Nuxt 4.3 (Vue 3.5 + Nitro)       |
| Base de donnees    | MySQL 8.0 via Prisma 7.4 ORM     |
| Endpoints API      | 367                              |
| Modeles Prisma     | 55+ (9 fichiers schema)          |
| Pages Vue          | 91                               |
| Composants Vue     | 137                              |
| Composables        | 48                               |
| Stores Pinia       | 5                                |
| Langues supportees | 13                               |
| Fichiers de test   | 187                              |
| Migrations Prisma  | 143                              |

---

## 2. Architecture technique

### Pattern architectural

L'application suit une architecture **monolithique full-stack** avec Nuxt 4, combinant le frontend Vue 3 et le backend Nitro dans un seul projet. La separation est assuree par la structure de repertoires :

- `app/` -- Frontend (pages, composants, stores, composables)
- `server/` -- Backend (API REST, middleware, utils, plugins, taches CRON)
- `prisma/` -- Couche donnees (schema modulaire, migrations)
- `shared/` -- Types et utilitaires partages client/serveur
- `i18n/` -- Traductions (13 langues, lazy loading par domaine)

### Flux de requete

```
Client (Vue 3 + Pinia)
    |
    +-- useApiAction() ---- Smart unwrap automatique
    |   ou $fetch direct
    |
    v
Nitro Server
    |
    +-- Server Middleware (auth, cache-headers, noindex)
    |
    +-- wrapApiHandler() ---- Gestion d'erreurs standardisee
    |   +-- requireAuth() / optionalAuth()
    |   +-- Zod validation
    |   +-- Permission checks (6 modules)
    |   +-- Prisma queries (select helpers)
    |
    +-- createSuccessResponse() ---- Format { success, data, message? }
    |   ou createPaginatedResponse() ---- + pagination metadata
    |
    v
MySQL 8.0 (via Prisma ORM + adaptateur MariaDB)
```

### Authentification

Le systeme d'authentification repose sur **nuxt-auth-utils** avec cookies scelles :

- **Auth email/password** : inscription, login, verification email, reset password, hashage bcrypt
- **OAuth** : Google et Facebook (via `server/routes/auth/`)
- **Session serveur** : cookies scelles (durée configurable, 30 jours par defaut)
- **Middleware serveur** (`server/middleware/auth.ts`) : intercepte toutes les requetes `/api/*`, hydrate `event.context.user` depuis la session, retourne 401 si non authentifie (sauf routes publiques declarees dans `server/constants/public-routes.ts`)
- **Mode admin** : toggle dans le store Pinia, fonctionnalite d'impersonation
- **Profil complet** : page de completion de profil apres OAuth

### Systeme de permissions

L'application dispose d'un systeme de permissions granulaire a plusieurs niveaux, gere par 6 fichiers dans `server/utils/permissions/` :

| Fichier                          | Portee                                                    |
| -------------------------------- | --------------------------------------------------------- |
| `convention-permissions.ts`      | Droits au niveau convention (edit, delete, manage orgas)  |
| `edition-permissions.ts`         | Droits par edition (edit, delete, artists, meals, ticket) |
| `volunteer-permissions.ts`       | Gestion du benevolat                                      |
| `workshop-permissions.ts`        | Gestion des ateliers                                      |
| `access-control-permissions.ts`  | Controle d'acces (billetterie, QR code)                   |
| `meal-validation-permissions.ts` | Validation des repas (benevoles, artistes, participants)  |

Les droits sont definis par convention (`ConventionOrganizer`) et peuvent etre affines par edition (`EditionOrganizerPermission`) : `canEdit`, `canDelete`, `canManageVolunteers`, `canManageArtists`, `canManageMeals`, `canManageTicketing`.

---

## 3. Structure des repertoires

```
convention-de-jonglerie/
|
+-- app/                          # Frontend Nuxt
|   +-- assets/                   #   CSS (Tailwind), images
|   +-- components/               #   137 composants Vue (20 sous-dossiers)
|   +-- composables/              #   48 composables TypeScript
|   +-- config/                   #   Configuration Firebase
|   +-- layouts/                  #   4 layouts (default, edition-dashboard, guide, messenger)
|   +-- middleware/               #   6 middleware client (auth, guest, admin, i18n, email)
|   +-- pages/                    #   91 pages Vue
|   +-- plugins/                  #   7 plugins (auth, firebase, countries, etc.)
|   +-- stores/                   #   5 stores Pinia (auth, editions, favorites, notifications, impersonation)
|   +-- types/                    #   Types TypeScript frontend
|   +-- utils/                    #   Utilitaires frontend (+ ticketing/)
|   +-- app.vue                   #   Point d'entree avec UApp, loading screen, PWA, impersonation
|
+-- server/                       # Backend Nitro
|   +-- api/                      #   367 endpoints REST (20+ domaines)
|   +-- constants/                #   Permissions, routes publiques
|   +-- emails/                   #   6 templates d'email Vue
|   +-- generated/prisma/         #   Client Prisma genere
|   +-- middleware/               #   3 middleware serveur (auth, cache-headers, noindex)
|   +-- plugins/                  #   Plugins serveur (countries, error-logging, scheduler, recaptcha)
|   +-- routes/                   #   Routes speciales (OAuth Google/Facebook, uploads, service worker)
|   +-- tasks/                    #   5 taches CRON
|   +-- types/                    #   Types API et serveur
|   +-- utils/                    #   69+ utilitaires (+ permissions/, ticketing/, editions/)
|
+-- prisma/                       # Couche donnees
|   +-- schema/                   #   9 fichiers .prisma modulaires
|   +-- migrations/               #   143 migrations
|   +-- seed.ts                   #   Script de seed
|
+-- i18n/                         # Internationalisation
|   +-- i18n.config.ts            #   Configuration Vue I18n
|   +-- locales/                  #   13 langues, 15 domaines chacune
|       +-- fr/                   #   Langue de reference (15 fichiers JSON)
|       +-- en/, de/, es/, ...    #   Traductions par langue
|
+-- test/                         # Tests
|   +-- unit/                     #   18 fichiers (tests isolés, happy-dom)
|   +-- nuxt/                     #   161 fichiers (environnement Nuxt complet)
|   +-- e2e/                      #   1 fichier (tests end-to-end)
|   +-- integration/              #   7 fichiers (tests avec MySQL reel)
|   +-- __mocks__/                #   Mocks Firebase, app-manifest
|   +-- setup.ts, setup-mocks.ts  #   Configuration des mocks globaux
|
+-- shared/                       # Code partage client/serveur
|   +-- types/                    #   api.ts (ApiSuccessResponse), zone-types.ts
|   +-- utils/                    #   Utilitaires partages
|
+-- docs/                         # Documentation (francais)
|   +-- system/                   #   Architecture et systemes internes
|   +-- ticketing/                #   Documentation billetterie
|   +-- volunteers/               #   Documentation benevolat
|   +-- docker/                   #   Guides Docker
|   +-- integrations/             #   Integrations externes
|   +-- optimization/             #   Guides d'optimisation
|
+-- scripts/                      # Scripts utilitaires
|   +-- seed-dev.ts               #   Donnees de dev
|   +-- manage-admin.ts           #   Gestion admins CLI
|   +-- check-i18n.js             #   Analyse i18n
|   +-- translation/              #   Outils de traduction
|   +-- docker-start.sh           #   Script de demarrage Docker
|
+-- docker/                       # Configuration Docker
|   +-- entrypoint.sh             #   Script d'entree production
|
+-- public/                       # Assets statiques
|   +-- logos/                    #   Logos et icones
|   +-- favicons/                 #   Favicons multi-taille
|   +-- uploads/                  #   Fichiers uploades (images)
|
+-- Dockerfile                    # Multi-stage (base, builder, runtime, dev)
+-- docker-compose.dev.yml        # Dev local (MySQL + app HMR)
+-- docker-compose.prod.yml       # Production
+-- docker-compose.release.yml    # Release/staging
+-- docker-compose.test-*.yml     # Tests (4 variantes)
+-- nuxt.config.ts                # Configuration Nuxt (470 lignes)
+-- vitest.config.ts              # Configuration Vitest multi-projets
+-- package.json                  # 66 scripts npm
```

---

## 4. Stack technique

### Frontend

| Technologie  | Version              | Role                         |
| ------------ | -------------------- | ---------------------------- |
| Nuxt         | 4.3.1                | Framework full-stack SSR     |
| Vue.js       | 3.5                  | Framework reactif            |
| Nuxt UI      | 4.4.0                | Composants UI + Tailwind CSS |
| Pinia        | 3.0.4                | Gestion d'etat               |
| TypeScript   | 5.9.3                | Typage statique              |
| @nuxtjs/i18n | 10.2.3               | Internationalisation         |
| VueUse       | 14.2.1               | Utilitaires Vue              |
| FullCalendar | 6.1.20               | Calendrier interactif        |
| Chart.js     | 4.5.1                | Graphiques et statistiques   |
| Leaflet      | (composables custom) | Cartes interactives          |
| html5-qrcode | 2.3.8                | Scanner QR code              |
| jsPDF        | 4.2.0                | Generation de PDF            |
| Luxon        | 3.7.2                | Manipulation de dates        |

### Backend

| Technologie     | Version | Role                          |
| --------------- | ------- | ----------------------------- |
| Nitro           | (Nuxt)  | Moteur serveur                |
| Prisma          | 7.4.1   | ORM base de donnees           |
| MySQL           | 8.0     | Base de donnees relationnelle |
| Zod             | 4.3.6   | Validation de donnees         |
| nuxt-auth-utils | 0.5.29  | Auth par session              |
| bcryptjs        | 3.0.3   | Hachage de mots de passe      |
| Nodemailer      | 8.0.1   | Envoi d'emails                |
| Firebase Admin  | 13.6.1  | Notifications push (FCM)      |
| cron            | 4.4.0   | Taches planifiees             |
| Anthropic SDK   | 0.78.0  | Integration IA (import)       |
| sharp           | 0.34.5  | Traitement d'images           |
| web-push        | 3.6.7   | Web Push Notifications        |

### Outils de developpement

| Outil            | Version       | Role               |
| ---------------- | ------------- | ------------------ |
| Vitest           | 4.0.18        | Framework de tests |
| @nuxt/test-utils | 4.0.0         | Tests Nuxt         |
| @vue/test-utils  | 2.4.6         | Tests Vue          |
| happy-dom        | 20.7.0        | DOM simule         |
| ESLint           | 10.0.2        | Linting            |
| Prettier         | 3.8.1         | Formatage de code  |
| Docker           | (multi-stage) | Conteneurisation   |
| GitHub Actions   | --            | CI/CD              |

### Modules Nuxt configures

```typescript
modules: [
  '@nuxt/eslint', // Linting integre
  '@nuxt/image', // Optimisation images
  '@nuxt/scripts', // Scripts tiers
  '@nuxt/test-utils', // Tests (dev/test uniquement)
  '@nuxt/ui', // Composants UI
  '@pinia/nuxt', // Gestion d'etat
  'nuxt-auth-utils', // Authentification
  '@nuxtjs/i18n', // Internationalisation
  '@vueuse/nuxt', // Utilitaires Vue
  'nuxt-file-storage', // Upload de fichiers
  '@nuxtjs/seo', // SEO (robots, sitemap, og-image, schema-org)
  'nuxt-qrcode', // Generation QR codes
]
```

---

## 5. Base de donnees (Prisma)

### Organisation du schema

Le schema Prisma est divise en **9 fichiers modulaires** dans `prisma/schema/`, ce qui facilite la navigation et la maintenance :

| Fichier            | Modeles principaux                                                                                                                                               | Description                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `schema.prisma`    | User, Convention, Edition, ConventionOrganizer, EditionOrganizer, EditionPost, EditionZone, EditionMarker, PasswordResetToken                                    | Modeles principaux et config       |
| `ticketing.prisma` | ExternalTicketing, HelloAssoConfig, TicketingTier, TicketingOption, TicketingQuota, TicketingOrder, TicketingOrderItem, TicketingCounter, + 8 tables de jointure | Billetterie (16+ modeles)          |
| `volunteer.prisma` | EditionVolunteerApplication, VolunteerTeam, VolunteerTimeSlot, VolunteerAssignment, ApplicationTeamAssignment, VolunteerNotificationGroup, VolunteerComment      | Benevolat (9 modeles)              |
| `carpool.prisma`   | CarpoolOffer, CarpoolRequest, CarpoolBooking, CarpoolPassenger, CarpoolComment, CarpoolRequestComment                                                            | Covoiturage (6 modeles)            |
| `meals.prisma`     | VolunteerMeal, VolunteerMealSelection, ArtistMealSelection, TicketingTierMeal, TicketingOptionMeal, TicketingOrderItemMeal, VolunteerMealReturnableItem          | Repas (7 modeles)                  |
| `messenger.prisma` | Conversation, ConversationParticipant, Message                                                                                                                   | Messagerie (3 modeles)             |
| `workshops.prisma` | Workshop, WorkshopFavorite, WorkshopLocation                                                                                                                     | Ateliers (3 modeles)               |
| `artists.prisma`   | EditionArtist, Show, ShowArtist, ShowReturnableItem, EditionShowCall, ShowApplication                                                                            | Artistes et spectacles (6 modeles) |
| `misc.prisma`      | LostFoundItem, LostFoundComment, Feedback, ApiErrorLog, Notification, FcmToken                                                                                   | Divers (6 modeles)                 |

### Configuration

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../server/generated/prisma"
}

datasource db {
  provider = "mysql"
}
```

- **MySQL 8.0** avec adaptateur MariaDB (`@prisma/adapter-mariadb`)
- Client Prisma genere dans `server/generated/prisma/`
- Configuration via `prisma.config.ts` a la racine
- **143 migrations** depuis le debut du projet

### Modele User (pivot central)

Le modele `User` est le pivot central du schema avec des relations vers pratiquement toutes les entites :

- Conventions creees, editions creees
- Candidatures benevoles et artistes
- Offres/demandes de covoiturage
- Notifications, messages, feedbacks
- Favoris et participations
- Tokens FCM pour les notifications push
- Flags de role : `isGlobalAdmin`, `isVolunteer`, `isArtist`, `isOrganizer`

### Modele Edition (entite la plus riche)

Le modele `Edition` contient ~110 champs couvrant :

- Informations generales (nom, dates, adresse, coordonnees GPS)
- Services et equipements (25+ booleens : camping, douches, ateliers, etc.)
- Configuration benevolat (20+ champs : formulaire dynamique, phases)
- Configuration billetterie et ateliers
- Carte publique avec zones et points de repere

### Enums

Le schema definit 15 enums couvrant les statuts, modes et types :

- `EditionStatus` : PLANNED, PUBLISHED, OFFLINE, CANCELLED
- `VolunteerStatus` / `ShowApplicationStatus` / `BookingStatus` : PENDING, ACCEPTED, REJECTED (+ CANCELLED)
- `ConversationType` : TEAM_GROUP, TEAM_LEADER_PRIVATE, VOLUNTEER_TO_ORGANIZERS, ORGANIZERS_GROUP, PRIVATE, ARTIST_APPLICATION
- `CarpoolDirection` : TO_EVENT, FROM_EVENT
- `DietaryPreference` : NONE, VEGETARIAN, VEGAN
- `AllergySeverity` : LIGHT, MODERATE, SEVERE, CRITICAL
- Et autres (ShowCallMode, ShowCallVisibility, FeedbackType, etc.)

### Helpers Prisma Select

Le fichier `server/utils/prisma-select-helpers.ts` (630 lignes) centralise les patterns de selection Prisma pour eviter la duplication. Il fournit :

**Selections utilisateur :**

- `userBasicSelect` : { id, pseudo } -- utilise ~23 fichiers
- `userWithProfileSelect` : + profilePicture
- `userWithProfileAndGravatarSelect` : + emailHash, updatedAt -- utilise ~20+ fichiers
- `userWithNameSelect` : + nom, prenom -- utilise ~15 fichiers
- `userAdminSelect` : selection complete avec \_count

**Selections par domaine :**

- `editionListSelect` / `editionListInclude` : pour les listes d'editions
- `carpoolOfferInclude` / `carpoolOfferFullInclude` : covoiturage avec relations
- `organizerWithUserInclude` / `organizerFullInclude` : organisateurs
- `volunteerApplicationInclude` / `volunteerAssignmentDetailedInclude` : benevoles
- `showZoneSelect` / `showMarkerSelect` / `showZoneMarkerInclude` : spectacles et carte

**Types generes** : chaque helper exporte un type correspondant (ex: `UserBasic`, `EditionList`, `CarpoolOfferWithUser`).

---

## 6. Backend -- API et serveur

### Vue d'ensemble des endpoints

**367 fichiers API** organises dans `server/api/` en 20+ domaines :

| Domaine                               | Description                                       |
| ------------------------------------- | ------------------------------------------------- |
| `editions/`                           | Gestion complete des editions (le plus gros)      |
| `editions/[id]/artists/`              | Artistes d'une edition                            |
| `editions/[id]/carpool-offers/`       | Covoiturage par edition                           |
| `editions/[id]/carpool-requests/`     | Demandes de covoiturage                           |
| `editions/[id]/lost-found/`           | Objets trouves/perdus                             |
| `editions/[id]/markers/`              | Points de repere sur la carte                     |
| `editions/[id]/zones/`                | Zones de la carte                                 |
| `editions/[id]/meals/`                | Gestion des repas                                 |
| `editions/[id]/organizers/`           | Organisateurs d'une edition                       |
| `editions/[id]/posts/`                | Publications                                      |
| `editions/[id]/shows/`                | Spectacles                                        |
| `editions/[id]/shows-call/`           | Appels a spectacles                               |
| `editions/[id]/ticketing/`            | Billetterie                                       |
| `editions/[id]/volunteer-teams/`      | Equipes benevoles                                 |
| `editions/[id]/volunteer-time-slots/` | Creneaux benevoles                                |
| `editions/[id]/volunteers/`           | Candidatures benevoles                            |
| `editions/[id]/workshops/`            | Ateliers                                          |
| `admin/`                              | Administration (51 endpoints)                     |
| `conventions/`                        | CRUD conventions et organisateurs                 |
| `messenger/`                          | Messagerie temps reel                             |
| `notifications/`                      | Notifications push et in-app                      |
| `auth/`                               | Authentification (login, register, reset, verify) |
| `profile/`                            | Profil utilisateur                                |
| `carpool-offers/`                     | Gestion globale covoiturage                       |
| `carpool-requests/`                   | Gestion globale demandes                          |
| `files/`                              | Upload de fichiers                                |
| `feedback/`                           | Feedback utilisateurs                             |
| `show-applications/`                  | Candidatures artistes                             |
| `shows-call/`                         | Appels a spectacles publics                       |
| `users/`                              | Recherche utilisateurs                            |
| `__sitemap__/`                        | Generation sitemap dynamique                      |

### Wrapper API standardise (`wrapApiHandler`)

**100% des endpoints** (367/367) utilisent ce wrapper. Il gere automatiquement :

```typescript
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody(event)
  // ... logique metier
  return createSuccessResponse(result)
})
```

- Erreurs `ApiError` --> conversion en erreur h3 avec status code
- Erreurs HTTP h3 --> relancees directement
- Erreurs `ZodError` --> erreur 400 avec details de validation
- Erreurs generiques --> logs et erreur 500

### Format de reponse

**~246 endpoints (67%)** utilisent `createSuccessResponse()` :

```json
{ "success": true, "data": { ... }, "message": "optionnel" }
```

**~10 endpoints** utilisent `createPaginatedResponse()` :

```json
{
  "success": true,
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "totalCount": 150, "totalPages": 8, "hasNextPage": true, "hasPrevPage": false }
}
```

**~107 endpoints GET** retournent des donnees brutes (intentionnel pour les lectures simples).

### Authentification et autorisation (`server/utils/auth-utils.ts`)

| Fonction                     | Role                                              |
| ---------------------------- | ------------------------------------------------- |
| `requireAuth()`              | Exige une session authentifiee, retourne User     |
| `optionalAuth()`             | Retourne User ou null (pour contenu conditionnel) |
| `requireResourceOwner()`     | Verifie la propriete d'une ressource              |
| `requireUserOrGlobalAdmin()` | Proprietaire ou admin global                      |

### Taches CRON (`server/tasks/`)

| Tache                               | Description                             |
| ----------------------------------- | --------------------------------------- |
| `cleanup-empty-conversations.ts`    | Supprime les conversations vides        |
| `cleanup-expired-tokens.ts`         | Supprime les tokens de reset expires    |
| `cleanup-resolved-error-logs.ts`    | Archive les logs d'erreurs resolus      |
| `convention-favorites-reminders.ts` | Rappels pour les conventions en favoris |
| `volunteer-reminders.ts`            | Rappels pour les creneaux benevoles     |

### Templates email (`server/emails/`)

6 composants Vue pour les emails :

- `BaseEmail.vue` -- Template de base
- `VerificationEmail.vue` -- Verification d'adresse email
- `PasswordResetEmail.vue` -- Reinitialisation de mot de passe
- `NotificationEmail.vue` -- Notifications generiques
- `AccountDeletionEmail.vue` -- Confirmation de suppression de compte
- `VolunteerScheduleEmail.vue` -- Planning benevole

### Utilitaires serveur (69+ fichiers dans `server/utils/`)

**Par categorie :**

| Categorie                | Fichiers cles                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| API et reponses          | api-helpers, validation-helpers, validation-schemas, prisma-helpers                               |
| Auth et securite         | auth-utils, encryption, rate-limiter, api-rate-limiter, token-generator                           |
| Permissions              | 6 fichiers dans `permissions/` (voir section 2)                                                   |
| Notifications            | notification-service, notification-preferences, notification-stream-manager, unified-push-service |
| Benevolat                | volunteer-scheduler, volunteer-application-diff, volunteer-meals                                  |
| Messagerie               | messenger-helpers, messenger-unread-service, conversation-presence-service, typing-state          |
| Temps reel (SSE)         | sse-manager, notification-stream-manager, ticketing-counter-sse                                   |
| Fichiers et images       | file-helpers, move-temp-image, image-deletion, copy-to-output                                     |
| IA et import             | ai-config, ai-providers, llm-client, anthropic                                                    |
| Scraping et import       | jugglingedge-scraper, facebook-event-scraper, web-content-extractor, web-content-cache            |
| Email                    | emailService (SMTP configurable), email-hash                                                      |
| Dates et geolocalisation | date-helpers, date-utils, geocoding, countries, zone-validation                                   |
| Billetterie              | ticketing/ (sous-dossier dedie)                                                                   |
| Logging et erreurs       | logger, error-logger, errors                                                                      |

---

## 7. Frontend -- Pages, composants et stores

### Pages (91 fichiers Vue)

**Arborescence des routes principales :**

```
/                                    # Accueil (carte + agenda + recherche)
+-- /login, /register, /logout       # Authentification
+-- /verify-email                    # Verification email
+-- /auth/forgot-password            # Mot de passe oublie
+-- /auth/reset-password             # Reinitialisation mot de passe
+-- /auth/complete-profile           # Completion profil apres OAuth
|
+-- /favorites                       # Editions favorites (liste + carte)
+-- /notifications                   # Centre de notifications
+-- /messenger                       # Messagerie temps reel
+-- /profile                         # Profil utilisateur
+-- /my-conventions                  # Mes conventions (organisateur)
+-- /my-artist-applications          # Mes candidatures artiste
+-- /my-volunteer-applications       # Mes candidatures benevole
+-- /privacy-policy                  # Politique de confidentialite
|
+-- /conventions/add                 # Creer une convention
+-- /conventions/[id]/edit           # Modifier une convention
+-- /conventions/[id]/editions/add   # Ajouter une edition
|
+-- /editions/add                    # Creer une edition
+-- /editions/[id]/                  # Detail d'une edition (page publique)
+-- /editions/[id]/edit              # Modifier une edition
+-- /editions/[id]/carpool           # Covoiturage
+-- /editions/[id]/commentaires      # Publications et commentaires
+-- /editions/[id]/lost-found        # Objets trouves/perdus
+-- /editions/[id]/map               # Carte interactive (Leaflet)
+-- /editions/[id]/workshops         # Ateliers
+-- /editions/[id]/artist-space      # Espace artiste
+-- /editions/[id]/volunteers/       # Espace benevole
+-- /editions/[id]/shows-call/       # Appels a spectacles publics
|
+-- /editions/[id]/gestion/          # Dashboard de gestion (layout edition-dashboard)
|   +-- index                        #   Tableau de bord
|   +-- general-info                 #   Informations generales
|   +-- about                        #   Description et programme
|   +-- services                     #   Services et equipements
|   +-- external-links               #   Liens externes
|   +-- map                          #   Gestion de la carte
|   +-- organizers                   #   Organisateurs
|   +-- artists/                     #   Artistes (liste + shows)
|   +-- volunteers/                  #   Benevolat (7 sous-pages)
|   |   +-- config                   #     Configuration
|   |   +-- form                     #     Formulaire personnalisable
|   |   +-- applications             #     Candidatures
|   |   +-- teams                    #     Equipes
|   |   +-- planning                 #     Planning (FullCalendar)
|   |   +-- notifications            #     Notifications benevoles
|   |   +-- page                     #     Page benevole publique
|   +-- ticketing/                   #   Billetterie (7 sous-pages)
|   |   +-- config                   #     Configuration
|   |   +-- tiers                    #     Tarifs et options
|   |   +-- external                 #     HelloAsso/externe
|   |   +-- orders                   #     Commandes
|   |   +-- stats                    #     Statistiques
|   |   +-- access-control           #     Controle d'acces (QR)
|   |   +-- counter/                 #     Compteurs
|   +-- meals/                       #   Repas (3 sous-pages)
|   +-- workshops/                   #   Ateliers
|   +-- shows-call/                  #   Appels a spectacles (config + candidatures)
|
+-- /shows-call/                     # Appels a spectacles (liste publique)
|
+-- /admin/                          # Administration (layout default + middleware super-admin)
|   +-- index                        #   Dashboard admin (stats, activite)
|   +-- conventions                  #   Gestion des conventions
|   +-- users/                       #   Gestion des utilisateurs
|   +-- feedback                     #   Feedback utilisateurs
|   +-- error-logs                   #   Logs d'erreurs API
|   +-- notifications                #   Envoi de notifications
|   +-- backup                       #   Sauvegardes base de donnees
|   +-- crons                        #   Taches planifiees
|   +-- system-config                #   Configuration systeme
|   +-- import-edition               #   Import d'editions (IA)
|
+-- /guide/                          # Guides d'aide (layout guide)
+-- /welcome/                        # Pages d'accueil apres inscription
```

### Composants (137 fichiers Vue)

**Organisation par domaine fonctionnel :**

| Dossier             | Nb  | Composants cles                                                                            |
| ------------------- | --- | ------------------------------------------------------------------------------------------ |
| `ticketing/`        | 20  | TierModal, OptionModal, QrCodeScanner, PaymentMethodSelector, QuotasList, CustomFieldModal |
| `ui/`               | 10  | ConfirmModal, DateTimePicker, ImageUpload, UserAvatar, UserDisplay, SelectLanguage         |
| `volunteers/`       | 8   | VolunteerCard, ApplicationDetailsModal, TimeSlotsList, QrCodeModal, MealsModal             |
| `convention/`       | 8   | Form, Details, Selector, ClaimModal, OrganizersSection, OrganizerEditModal                 |
| `edition/`          | 7   | Form, Header, ManageButton, Post, ParticipantsCard, MyTicketCard, MyArtistCard             |
| `admin/`            | 8   | ImportGenerationProgress, ImportDuplicateModal, UserDeletionModal, ProfilePictureUpload    |
| `artists/`          | 4   | ArtistModal, AccommodationModal, OrganizerNotesModal, MealsModal                           |
| `notifications/`    | 4   | Center, PushPromoModal, PushNotificationToggle, PushDevicesModal                           |
| `messenger/`        | 3   | HeaderButton, MessageBubble, TypingIndicator                                               |
| `shows/`            | 1   | ShowModal                                                                                  |
| `show-application/` | --  | Composants de candidature                                                                  |
| `workshops/`        | 1   | ImportFromImageModal                                                                       |
| `organizer/`        | 1   | RightsFields                                                                               |
| Composants racine   | 17  | EditionCard, FiltersPanel, HomeMap, HomeAgenda, FavoritesMap, AppHeader, AppFooter, etc.   |

### Composables (48 fichiers TypeScript)

**Par categorie :**

| Categorie                 | Composables                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **API et donnees**        | `useApiAction`, `useApiActionById`, `useCarpoolForm`, `useConventionServices`, `useMeals`, `useProfileStats`, `useImportGeneration` |
| **Cartes (Leaflet)**      | `useLeafletMap`, `useLeafletEditable`, `useEditionMarkers`, `useEditionZones`, `useMapMarkers`, `useEditionStatus`                  |
| **Date et heure**         | `useDatetime`, `useDateFormat`, `useDateTimePicker`, `useTimezones`, `useCalendar`, `useElapsedTimer`                               |
| **Benevolat**             | `useVolunteerSchedule`, `useVolunteerTeams`, `useVolunteerTimeSlots`, `useVolunteerSettings`                                        |
| **Billetterie**           | `useTicketingCounter`, `useTicketingSettings`                                                                                       |
| **Temps reel (SSE)**      | `useMessenger`, `useMessengerStream`, `useNotificationStream`, `useRealtimeStats`, `useTypingIndicator`                             |
| **Firebase et push**      | `useFirebaseMessaging`, `usePushNotificationPromo`, `usePWA`, `useDeviceId`                                                         |
| **i18n et navigation**    | `useLazyI18n`, `useI18nNavigation`, `useCountryTranslation`                                                                         |
| **UI et UX**              | `useModal`, `useDebounce`, `useReturnTo`, `useChartExport`, `usePasswordStrength`                                                   |
| **Donnees et validation** | `useCountries`, `useImageUrl`, `useUrlValidation`, `useParticipantTypes`, `useOrganizerTitle`                                       |
| **Permissions**           | `useAccessControlPermissions`                                                                                                       |
| **Compte utilisateur**    | `useUserDeletion`                                                                                                                   |

### Stores Pinia (5 fichiers)

| Store                  | Role                                                   |
| ---------------------- | ------------------------------------------------------ |
| `auth.ts`              | Session utilisateur, login/register/logout, admin mode |
| `editions.ts`          | Liste et cache des editions                            |
| `favoritesEditions.ts` | Gestion des favoris (ajout/suppression)                |
| `notifications.ts`     | Notifications temps reel (compteur non-lu)             |
| `impersonation.ts`     | Mode impersonation admin                               |

Note : les 5 stores utilisent `$fetch` direct. Le composable `useApiAction` est utilise dans les composants et pages.

### Layouts (4 fichiers)

| Layout                  | Usage                                               |
| ----------------------- | --------------------------------------------------- |
| `default.vue`           | Layout principal (header, footer, navigation)       |
| `edition-dashboard.vue` | Dashboard de gestion d'edition (sidebar navigation) |
| `guide.vue`             | Pages de guide/aide (sidebar de navigation)         |
| `messenger.vue`         | Interface de messagerie (layout dedie)              |

Le layout `edition-dashboard` est applique automatiquement via `routeRules` dans `nuxt.config.ts` :

```typescript
routeRules: {
  '/editions/*/gestion/**': { appLayout: 'edition-dashboard' },
}
```

### Middleware client (6 fichiers)

| Middleware                    | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `authenticated.ts`            | Redirige vers /login si non connecte                |
| `auth-protected.ts`           | Routes protegees (verifie la session)               |
| `guest-only.ts`               | Accessible uniquement aux non-connectes             |
| `super-admin.ts`              | Reserve aux admins globaux                          |
| `verify-email-access.ts`      | Acces a la page de verification email               |
| `load-translations.global.ts` | Chargement lazy des traductions (middleware global) |

### Plugins (7 fichiers)

| Plugin                        | Cote    | Role                                           |
| ----------------------------- | ------- | ---------------------------------------------- |
| `auth.client.ts`              | Client  | Initialise la session depuis le serveur        |
| `countries.client.ts`         | Client  | Charge les donnees pays (i18n-iso-countries)   |
| `firebase.client.ts`          | Client  | Configure Firebase/FCM pour notifications push |
| `admin-mode-header.client.ts` | Client  | Ajoute un header custom en mode admin          |
| `router-api-ignore.client.ts` | Client  | Filtre les routes API du router Vue            |
| `vue-json-viewer.client.ts`   | Client  | Enregistre le composant JSON viewer            |
| `env-flags.server.ts`         | Serveur | Feature flags basees sur l'environnement       |

---

## 8. Internationalisation (i18n)

### Langues supportees (13)

| Code | Langue      | Statut              |
| ---- | ----------- | ------------------- |
| `fr` | Francais    | Langue de reference |
| `en` | Anglais     | Traduction complete |
| `de` | Allemand    | Traduction en cours |
| `es` | Espagnol    | Traduction en cours |
| `it` | Italien     | Traduction en cours |
| `nl` | Neerlandais | Traduction en cours |
| `pt` | Portugais   | Traduction en cours |
| `pl` | Polonais    | Traduction en cours |
| `cs` | Tcheque     | Traduction en cours |
| `da` | Danois      | Traduction en cours |
| `ru` | Russe       | Traduction en cours |
| `sv` | Suedois     | Traduction en cours |
| `uk` | Ukrainien   | Traduction en cours |

### Domaines de traduction (15 fichiers par langue pour le francais)

| Domaine              | Description                                   |
| -------------------- | --------------------------------------------- |
| `common.json`        | Termes partages (boutons, labels, validation) |
| `app.json`           | Chaines specifiques a l'application           |
| `admin.json`         | Panneau d'administration                      |
| `auth.json`          | Flux d'authentification                       |
| `artists.json`       | Gestion des artistes                          |
| `components.json`    | Labels de composants                          |
| `edition.json`       | Editions et evenements                        |
| `gestion.json`       | Interface de gestion (dashboard)              |
| `messenger.json`     | Messagerie                                    |
| `notifications.json` | Notifications                                 |
| `permissions.json`   | Permissions et roles                          |
| `public.json`        | Contenu public                                |
| `feedback.json`      | Systeme de feedback                           |
| `ticketing.json`     | Billetterie                                   |
| `workshops.json`     | Ateliers                                      |

Note : les langues autres que le francais ne chargent que 6 domaines de base (common, notifications, components, app, public, feedback). Le francais charge les 15 domaines.

### Architecture i18n

- **Lazy loading** : les traductions sont chargees a la demande par domaine
- **Strategie URL** : `no_prefix` (pas de /fr/, /en/ dans les URLs)
- **Detection** : langue du navigateur avec persistance par cookie (`i18n_redirected`)
- **Fallback** : `fr` --> `en` (le francais est la langue de reference et de fallback)
- **Middleware global** : `load-translations.global.ts` charge les traductions necessaires
- **Composition API** : `legacy: false`, `compositionOnly: true`

### Scripts de maintenance i18n

| Script                       | Commande                     | Role                                           |
| ---------------------------- | ---------------------------- | ---------------------------------------------- |
| `check-i18n.js`              | `npm run check-i18n`         | Analyse cles manquantes/inutilisees/dupliquees |
| `check-i18n-translations.js` | `npm run check-translations` | Compare les traductions entre locales          |
| `check-i18n-variables.cjs`   | `npm run check-i18n-vars`    | Verifie la coherence des variables             |
| `add-translation.js`         | `npm run i18n:add`           | Ajoute une cle de traduction                   |
| `translation/mark-todo.js`   | `npm run i18n:mark-todo`     | Marque les cles modifiees comme [TODO]         |

---

## 9. Tests

### Vue d'ensemble

| Type        | Fichiers | Framework                 | Environnement |
| ----------- | -------- | ------------------------- | ------------- |
| Unit        | 18       | Vitest + happy-dom        | happy-dom     |
| Nuxt        | 161      | Vitest + @nuxt/test-utils | nuxt          |
| E2E         | 1        | Vitest + @nuxt/test-utils | nuxt          |
| Integration | 7        | Vitest + MySQL reel       | node          |
| **Total**   | **187**  |                           |               |

### Configuration Vitest (`vitest.config.ts`)

4 projets configures :

| Projet        | Include pattern                    | Timeout | Particularites                                |
| ------------- | ---------------------------------- | ------- | --------------------------------------------- |
| `unit`        | `test/unit/**/*.{test,spec}.ts`    | defaut  | Globals, happy-dom                            |
| `nuxt`        | `test/nuxt/**/*.{test,spec}.ts`    | 20s     | Env nuxt, mocks Firebase/IntersectionObserver |
| `e2e`         | `test/e2e/**/*.{test,spec}.ts`     | 60s     | Env nuxt, serveur demarre                     |
| `integration` | `test/integration/**/*.db.test.ts` | 30s     | Pool forks, 1 worker, sequentiel              |

### Tests unitaires (`test/unit/`, 18 fichiers)

Tests isoles sans environnement Nuxt :

- **Utils** : avatar, countries, editionName, gravatar, mapMarkers, markdownToHtml, convention-services
- **Composables** : useApiAction, useEditionMarkers, useEditionZones, useMessenger, useProfileStats (2 fichiers)
- **Stores** : auth, editions, notifications
- **Securite** : brute-force
- **i18n** : keys-parity (verifie la coherence des cles entre langues)

### Tests Nuxt (`test/nuxt/`, 161 fichiers)

Tests avec environnement Nuxt complet :

| Categorie    | Nb  | Description                                                                                                         |
| ------------ | --- | ------------------------------------------------------------------------------------------------------------------- |
| Server API   | ~90 | Endpoints : auth, conventions, editions, carpool, volunteers, ticketing, messenger, notifications, shows-call, etc. |
| Pages        | 22  | Login, register, admin, editions (detail, carpool, lost-found, manage), favorites, profile, etc.                    |
| Components   | 15  | FlagIcon, UserAvatar, DateTimePicker, ConfirmModal, PWAInstallBanner, etc.                                          |
| Middleware   | 3   | auth, super-admin, authenticated                                                                                    |
| Features     | 3   | edition-features, convention-organizers, favorites-integration                                                      |
| Server Utils | 7   | errors, api-helpers, rate-limiter, validation, permissions                                                          |

### Tests d'integration (`test/integration/`, 7 fichiers)

Tests avec base MySQL reelle (via Docker) :

- `auth.db.test.ts` -- Flux d'authentification complet
- `conventions.db.test.ts` -- CRUD conventions
- `volunteers.workflow.db.test.ts` -- Workflow complet benevolat
- `organizers.chain.db.test.ts` -- Chaine de permissions organisateurs
- `access-control-permissions.db.test.ts` -- Controle d'acces
- `lost-found.db.test.ts` -- Objets trouves/perdus
- `migrate-organizers.db.test.ts` -- Migration des organisateurs

### Infrastructure de mocks

| Fichier                | Contenu                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| `setup.ts`             | Mocks globaux : H3, Prisma, Firebase, `createSuccessResponse`, `useRuntimeConfig` |
| `setup-mocks.ts`       | Mocks `#app` et `#imports` : navigateTo, useRouter, useState, etc.                |
| `setup-common.ts`      | Fallbacks partages pour Prisma et H3                                              |
| `setup-db.ts`          | Setup pour les tests d'integration avec MySQL                                     |
| `setup-integration.ts` | Configuration specifique integration                                              |
| `__mocks__/`           | Mocks Firebase (app, messaging, admin), app-manifest                              |

### Commandes de test

```bash
npm run test:unit         # Tests unitaires (watch)
npm run test:unit:run     # Tests unitaires (run once)
npm run test:nuxt         # Tests Nuxt (watch)
npm run test:nuxt:run     # Tests Nuxt (run once)
npm run test:e2e:run      # Tests E2E
npm run test:db:run       # Tests integration (Docker MySQL requis)
npm run test:all          # Tous les tests
npm run docker:test       # Tous les tests dans Docker
```

---

## 10. DevOps et deploiement

### Docker

#### Dockerfile multi-stage

Le `Dockerfile` definit 4 stages :

| Stage     | Base         | Usage                                          |
| --------- | ------------ | ---------------------------------------------- |
| `base`    | node:24-slim | Image de base avec curl, openssl, mysql-client |
| `builder` | base         | npm ci, Prisma generate, Nuxt build (8GB RAM)  |
| `runtime` | node:24-slim | Image de production minimale (port 3000)       |
| `dev`     | base         | Image de dev avec HMR (ports 3000 + 24678)     |

#### Docker Compose (6 configurations)

| Fichier                               | Usage                                            |
| ------------------------------------- | ------------------------------------------------ |
| `docker-compose.dev.yml`              | Dev local : MySQL + app avec HMR, volumes montes |
| `docker-compose.prod.yml`             | Production : MySQL + app runtime, reseau proxy   |
| `docker-compose.release.yml`          | Release/staging                                  |
| `docker-compose.test-all.yml`         | Tous les tests dans Docker                       |
| `docker-compose.test-simple.yml`      | Tests unitaires dans Docker                      |
| `docker-compose.test-integration.yml` | Tests integration avec MySQL                     |
| `docker-compose.test-ui.yml`          | UI Vitest dans Docker                            |

#### Configuration dev (`docker-compose.dev.yml`)

- **MySQL 8.0** avec healthcheck (port 3306)
- **App Nuxt** avec hot reload (ports 3000 + 24678)
- Volumes montes : `app/`, `server/`, `prisma/`, `i18n/`, `test/`, `scripts/`, `public/`
- `node_modules` dans un volume Docker persistant (pas synchronise avec l'hote)
- Variables : `NODE_OPTIONS=--max-old-space-size=6144`, polling Chokidar pour Windows
- Script de demarrage : `scripts/docker-start.sh` (migrations Prisma + dev server)

#### Configuration prod (`docker-compose.prod.yml`)

- Image runtime multi-stage optimisee
- Volumes persistants pour uploads et backups
- Variables d'environnement via `stack.env` (Portainer)
- Reseau Docker externe (`proxy-network`)
- Point d'entree : `docker/entrypoint.sh` (migrations + demarrage)

### GitHub Actions CI (`.github/workflows/tests.yml`)

Pipeline declenchee sur push/PR vers `main` :

```
setup (10 min)
    |
    +--- lint (5 min, pas de DB)
    |
    +--- build (10 min, pas de DB)
    |
    +--- test (15 min, matrice de 4 jobs)
         +-- unit (pas de DB)
         +-- nuxt (pas de DB)
         +-- e2e (pas de DB)
         +-- database (avec MySQL service)
```

**Optimisations du pipeline :**

- **Caching** : node_modules, Prisma client, build Nuxt (cles basees sur les hashes des fichiers)
- **Parallelisme** : lint, build et test s'executent en parallele apres setup
- **Matrice de tests** : 4 groupes independants (`fail-fast: false`)
- **Service MySQL** : demarre uniquement pour les tests database
- **Artifacts** : upload des resultats de test et rapports de couverture en cas d'echec

### Variables d'environnement requises

| Variable                               | Description                                        |
| -------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`                         | URL de connexion MySQL                             |
| `NUXT_SESSION_PASSWORD`                | Cle de chiffrement des sessions (32+ chars)        |
| `NUXT_PUBLIC_SITE_URL`                 | URL publique du site                               |
| `SEND_EMAILS`                          | Activer/desactiver l'envoi d'emails (`true/false`) |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`  | Configuration SMTP                                 |
| `ENCRYPTION_SECRET`, `ENCRYPTION_SALT` | Chiffrement des donnees sensibles                  |
| `NUXT_OAUTH_GOOGLE_*`                  | OAuth Google (client ID, secret)                   |
| `NUXT_OAUTH_FACEBOOK_*`                | OAuth Facebook                                     |
| `NUXT_PUBLIC_FIREBASE_*`               | Firebase configuration (6 variables)               |
| `NUXT_PUBLIC_FIREBASE_VAPID_KEY`       | Cle VAPID pour les notifications push              |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY`     | Integration IA (optionnel)                         |
| `NUXT_RECAPTCHA_SECRET_KEY`            | reCAPTCHA v3 (optionnel)                           |
| `PRISMA_LOG_LEVEL`                     | Niveau de log Prisma (`error,warn` par defaut)     |

### Scripts npm (66 commandes)

**Developpement :**

- `npm run dev` -- Serveur de dev Nuxt (NE PAS lancer, deja en cours via Docker)
- `npm run build` -- Build production (8GB RAM)
- `npm run lint` / `npm run lint:fix` -- Linting ESLint
- `npm run format` -- Formatage Prettier

**Docker :**

- `npm run docker:dev` -- Dev local (build + up)
- `npm run docker:dev:detached` -- Dev en mode detache
- `npm run docker:dev:logs` -- Logs de l'application
- `npm run docker:dev:exec` -- Shell dans le conteneur
- `npm run docker:dev:clean-modules` -- Reset des node_modules Docker

**Tests :**

- `npm run test:unit:run` -- Tests unitaires
- `npm run test:nuxt:run` -- Tests Nuxt
- `npm run test:e2e:run` -- Tests E2E
- `npm run test:db:run` -- Tests integration DB
- `npm run docker:test` -- Tous les tests dans Docker

**Base de donnees :**

- `npm run db:seed:dev` -- Seed donnees de dev
- `npm run db:reset:dev` -- Reset complet (migrations + seed)

**i18n :**

- `npm run check-i18n` -- Analyse des cles i18n
- `npm run check-translations` -- Comparaison entre locales
- `npm run i18n:mark-todo` -- Marquage des cles modifiees

---

## 11. Patterns de code

### Pattern 1 : `wrapApiHandler` + `createSuccessResponse`

Pattern standard pour tous les endpoints API :

```typescript
// server/api/editions/[id]/artists/index.post.ts
export default wrapApiHandler(async (event) => {
  // 1. Authentification
  const user = requireAuth(event)

  // 2. Parametres
  const editionId = getRouterParam(event, 'id')

  // 3. Validation
  const body = await readValidatedBody(event, artistSchema.parse)

  // 4. Permissions
  const permissions = await getEditionPermissions(event, parseInt(editionId!))
  if (!permissions.canManageArtists) {
    throw createError({ status: 403, message: 'Acces non autorise' })
  }

  // 5. Logique metier (Prisma)
  const artist = await prisma.editionArtist.create({
    data: { ...body, editionId: parseInt(editionId!) },
    include: { user: { select: userBasicSelect } },
  })

  // 6. Reponse standardisee
  return createSuccessResponse(artist)
})
```

### Pattern 2 : `useApiAction` (frontend)

Composable standardise pour les appels API avec gestion automatique du loading, toasts et erreurs :

```typescript
// Dans un composant Vue
const { execute, loading } = useApiAction('/api/editions/123/artists', {
  method: 'POST',
  body: () => ({ userId: selectedUser.value, ...formData }),
  successMessage: { title: t('artists.added_success') },
  errorMessages: {
    409: t('errors.artist_already_exists'),
    default: t('errors.generic'),
  },
  onSuccess: () => emit('saved'),
  refreshOnSuccess: () => refresh(),
})
```

**Smart unwrap** : `useApiAction` detecte automatiquement le format `createSuccessResponse` et extrait `data` :

```typescript
// Si le serveur retourne : { success: true, data: { id: 1 } }
// Le composable retourne directement : { id: 1 }
```

**Variante par ID** : `useApiActionById` pour les actions sur des listes :

```typescript
const { execute: deleteArtist, isLoading } = useApiActionById(
  (id) => `/api/editions/${editionId}/artists/${id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('artists.deleted') },
    refreshOnSuccess: () => refresh(),
  }
)
// Usage : <UButton :loading="isLoading(artist.id)" @click="deleteArtist(artist.id)" />
```

### Pattern 3 : Prisma Select Helpers

Helpers de selection reutilisables pour eviter la duplication :

```typescript
// server/utils/prisma-select-helpers.ts
export const userBasicSelect = { id: true, pseudo: true } satisfies Prisma.UserSelect
export const userWithNameSelect = { id: true, pseudo: true, nom: true, prenom: true }

// Usage dans un endpoint
const volunteers = await prisma.editionVolunteerApplication.findMany({
  where: { editionId },
  include: { user: { select: userWithNameSelect } },
})
```

### Pattern 4 : Middleware serveur d'authentification

Le middleware `server/middleware/auth.ts` :

1. Verifie si la route est dans la liste des routes publiques (`publicRoutes`)
2. Pour les routes publiques avec `hydrateSession: true`, charge la session sans bloquer
3. Pour les routes `/api/*` protegees, exige une session valide (401 sinon)
4. Les routes de pages sont gerees par le middleware client

### Pattern 5 : Temps reel via SSE (Server-Sent Events)

L'application utilise SSE pour le temps reel :

- **Notifications** : `useNotificationStream` ecoute les nouvelles notifications
- **Messagerie** : `useMessengerStream` ecoute les nouveaux messages
- **Billetterie** : `useTicketingCounter` pour les compteurs temps reel
- **Statistiques** : `useRealtimeStats` pour les stats en direct
- **Typing** : `useTypingIndicator` pour les indicateurs de frappe

Cote serveur, `server/utils/sse-manager.ts` et `notification-stream-manager.ts` gerent les connexions SSE.

### Pattern 6 : Systeme de notifications

Double systeme de notifications :

1. **In-app** : modele `Notification` avec systeme de traduction (cles i18n ou texte libre)
2. **Push** : Firebase Cloud Messaging (FCM) via `unified-push-service.ts`
3. **SSE** : notification temps reel via stream
4. **Email** : templates Vue avec `emailService.ts`

Les notifications supportent :

- Cles de traduction (`titleKey`, `messageKey`) pour les notifications systeme
- Texte libre (`titleText`, `messageText`) pour les notifications custom
- Parametres de traduction (`translationParams`) pour personnaliser les messages
- Categories et liens d'action

---

## 12. Diagramme d'architecture

```
+---------------------------------------------------------------------+
|                           CLIENT (Vue 3)                             |
|                                                                      |
|  +----------+  +----------+  +--------------+  +----------------+   |
|  |  Pages   |  |Components|  |  Composables  |  |  Pinia Stores  |   |
|  |  (91)    |  |  (137)   |  |    (48)       |  |     (5)        |   |
|  +----+-----+  +----+-----+  +------+-------+  +-------+--------+   |
|       |              |               |                  |            |
|       +------+-------+-------+-------+------------------+            |
|              |               |                                       |
|    useApiAction()      $fetch direct                                 |
|    (smart unwrap)      (stores Pinia)                                |
+---------|------------------|-----------------------------------------+
          |                  |
     HTTP/HTTPS         SSE Streams
          |                  |
+---------|------------------|-----------------------------------------+
|                        SERVEUR (Nitro)                                |
|                              |                                       |
|  +---------------------------+-------------------------------------+ |
|  |  Server Middleware : auth.ts, cache-headers.ts, noindex.ts      | |
|  +---------------------------+-------------------------------------+ |
|                              |                                       |
|  +---------------------------+-------------------------------------+ |
|  |                   wrapApiHandler()                               | |
|  |  +---------------+  +-------------+  +------------------------+ | |
|  |  | requireAuth() |  | Zod schemas |  | Permission checks      | | |
|  |  | optionalAuth()|  | readBody()  |  | (6 modules)            | | |
|  |  +---------------+  +-------------+  +------------------------+ | |
|  +---------------------------+-------------------------------------+ |
|                              |                                       |
|  +----------+  +---------+  |  +----------+  +--------------------+ |
|  | Emails   |  |  Tasks  |  |  | AI/LLM   |  |  Notifications     | |
|  | (6 tpl)  |  | (5 cron)|  |  | Providers|  |  (push/in-app/SSE) | |
|  +----------+  +---------+  |  +----------+  +--------------------+ |
|                              |                                       |
|  +----------+  +---------+  |  +----------+  +--------------------+ |
|  | SSE      |  | Rate    |  |  | Firebase |  |  Scraping/Import   | |
|  | Manager  |  | Limiter |  |  | Admin    |  |  (jugglingedge,fb) | |
|  +----------+  +---------+  |  +----------+  +--------------------+ |
|                              |                                       |
|             createSuccessResponse() / createPaginatedResponse()      |
+---------------------------------+------------------------------------+
                                  |
                           Prisma ORM 7.4
                     (select helpers, 55+ models)
                                  |
+---------------------------------+------------------------------------+
|                        MySQL 8.0                                      |
|                                                                       |
|   9 fichiers schema  |  143 migrations  |  Adaptateur MariaDB         |
|                                                                       |
|   Domaines : Users, Conventions, Editions, Ticketing, Volunteers,    |
|              Carpool, Meals, Messenger, Workshops, Artists, Shows,    |
|              Feedback, Notifications, Zones, Markers                   |
+-----------------------------------------------------------------------+

                     Services externes
+----------+  +----------+  +----------+  +----------+  +----------+
| Firebase |  |  Google   |  | Facebook |  | HelloAsso|  | Anthropic|
|   FCM    |  |  OAuth    |  |  OAuth   |  |  API     |  |  Claude  |
+----------+  +----------+  +----------+  +----------+  +----------+
```

---

## 13. Recommandations

### Forces du projet

- **Architecture coherente** : 100% des endpoints utilisent `wrapApiHandler()`, garantissant une gestion d'erreurs uniforme sur toute l'API
- **Reponses standardisees** : 67% des endpoints utilisent `createSuccessResponse()` avec smart unwrap automatique cote client
- **Systeme de permissions mature** : 6 modules de permissions couvrant tous les niveaux d'acces (convention, edition, volunteers, artists, ticketing, meals)
- **Tests solides** : 187 fichiers de test couvrant API, composants, pages, integration DB et E2E
- **i18n aboutie** : 13 langues avec lazy loading par domaine, scripts de maintenance automatises
- **Securite** : validation Zod systematique, auth par session scellee, rate limiting, permissions granulaires
- **Schema Prisma modulaire** : decoupage en 9 fichiers thematiques avec helpers de selection reutilisables
- **CI/CD robuste** : pipeline GitHub Actions avec lint, build et 4 types de tests en parallele
- **DevOps mature** : Docker multi-stage, 6 configurations Docker Compose (dev, prod, release, tests)
- **Documentation riche** : repertoire `docs/` complet couvrant tous les systemes

### Points d'attention

- **Taille du domaine `editions/`** : le sous-arbre `server/api/editions/` concentre la majorite des endpoints -- c'est inherent a la nature du projet mais requiert une attention particuliere lors des refactorings
- **Stores Pinia** : les 5 stores utilisent `$fetch` direct sans le smart unwrap de `useApiAction` -- une migration progressive pourrait etre envisagee
- **Tests E2E** : la configuration existe mais un seul fichier E2E est present, le coverage E2E reste a developper
- **Helpers Prisma** : le fichier `prisma-select-helpers.ts` (630 lignes) pourrait etre divise par domaine a mesure qu'il grandit

### Metriques de sante

| Indicateur                           | Valeur         | Appreciation                   |
| ------------------------------------ | -------------- | ------------------------------ |
| Endpoints avec wrapApiHandler        | 367/367 (100%) | Excellent                      |
| Endpoints avec createSuccessResponse | ~246/367 (67%) | Bon (GETs bruts intentionnels) |
| Migrations Prisma                    | 143            | Evolution soutenue             |
| Langues supportees                   | 13             | Excellent                      |
| Fichiers de test                     | 187            | Couverture solide              |
| Composables                          | 48             | Bonne reutilisation            |
| Documentation                        | 50+ fichiers   | Complete                       |
