# Analyse Complète du Codebase — Convention de Jonglerie

> **Dernière mise à jour** : 11 février 2026
> **Taille du projet** : ~190 Mo | ~2 822 fichiers de code | ~6 908 fichiers au total

---

## Table des matières

- [1. Vue d'ensemble du projet](#1-vue-densemble-du-projet)
- [2. Stack technologique](#2-stack-technologique)
- [3. Architecture détaillée des répertoires](#3-architecture-détaillée-des-répertoires)
- [4. Couche Frontend](#4-couche-frontend)
  - [4.1 Pages et routage](#41-pages-et-routage)
  - [4.2 Composants](#42-composants)
  - [4.3 Composables](#43-composables)
  - [4.4 Stores Pinia](#44-stores-pinia)
  - [4.5 Middleware](#45-middleware)
  - [4.6 Layouts et Plugins](#46-layouts-et-plugins)
- [5. Couche Backend (API)](#5-couche-backend-api)
  - [5.1 Endpoints API](#51-endpoints-api)
  - [5.2 Middleware serveur](#52-middleware-serveur)
  - [5.3 Utilitaires serveur](#53-utilitaires-serveur)
  - [5.4 Système de permissions](#54-système-de-permissions)
  - [5.5 Plugins et tâches serveur](#55-plugins-et-tâches-serveur)
- [6. Couche données (Prisma)](#6-couche-données-prisma)
  - [6.1 Modèles par domaine](#61-modèles-par-domaine)
  - [6.2 Enums](#62-enums)
  - [6.3 Relations clés](#63-relations-clés)
  - [6.4 Migrations](#64-migrations)
- [7. Internationalisation (i18n)](#7-internationalisation-i18n)
- [8. Tests et CI/CD](#8-tests-et-cicd)
  - [8.1 Structure des tests](#81-structure-des-tests)
  - [8.2 Pipeline CI/CD](#82-pipeline-cicd)
  - [8.3 Tests Docker](#83-tests-docker)
- [9. Infrastructure Docker et déploiement](#9-infrastructure-docker-et-déploiement)
- [10. Diagramme d'architecture](#10-diagramme-darchitecture)
- [11. Patterns et conventions de code](#11-patterns-et-conventions-de-code)
- [12. Statistiques clés](#12-statistiques-clés)
- [13. Recommandations et améliorations](#13-recommandations-et-améliorations)

---

## 1. Vue d'ensemble du projet

**Type** : Application web full-stack (monolithique)
**Objectif** : Gestion et découverte de conventions de jonglerie, permettant de consulter, ajouter, modifier des conventions et gérer les éditions, bénévoles, billetterie, artistes, ateliers, etc.
**Langage** : TypeScript (frontend + backend)
**Architecture** : Monolithe Nuxt.js avec API Nitro intégrée, base de données MySQL via Prisma ORM.

### Fonctionnalités principales

| Domaine               | Fonctionnalités                                                                      |
| --------------------- | ------------------------------------------------------------------------------------ |
| **Conventions**       | CRUD complet, organisateurs avec droits granulaires, réclamation                     |
| **Éditions**          | Gestion multi-éditions par convention, statuts (PUBLISHED/PLANNED/OFFLINE/CANCELLED) |
| **Bénévoles**         | Candidatures, équipes, créneaux, planification, repas, QR codes                      |
| **Billetterie**       | Tarifs, options, quotas, compteurs, intégration HelloAsso, validation entrées        |
| **Artistes**          | Gestion spectacles, hébergement, paiements, repas, QR codes                          |
| **Covoiturage**       | Offres et demandes, réservations, commentaires                                       |
| **Messagerie**        | Conversations par équipe, organisateurs, privées, réponses                           |
| **Ateliers**          | Workshops, lieux, favoris                                                            |
| **Carte interactive** | Géolocalisation, zones, marqueurs, filtrage                                          |
| **Notifications**     | In-app, push FCM, SSE temps réel, préférences                                        |
| **Administration**    | Gestion utilisateurs, logs d'erreurs, feedback, impersonation                        |

---

## 2. Stack technologique

### Frontend

| Technologie      | Version    | Rôle                              |
| ---------------- | ---------- | --------------------------------- |
| **Nuxt.js**      | 4.3.0      | Framework Vue.js universel        |
| **Vue.js**       | 3.5.17     | Framework réactif                 |
| **Nuxt UI**      | 4.0.0      | Composants UI (Tailwind CSS)      |
| **Pinia**        | 3.0.3      | Gestion d'état                    |
| **TypeScript**   | 5.8.3      | Typage statique                   |
| **Nuxt i18n**    | 10.0.3     | Internationalisation (14 langues) |
| **VueUse**       | 13.6.0     | Utilitaires Vue                   |
| **FullCalendar** | 6.1.15+    | Calendrier interactif             |
| **Chart.js**     | 4.5.1      | Graphiques                        |
| **Leaflet**      | (via Nuxt) | Cartes interactives               |

### Backend

| Technologie         | Version        | Rôle                               |
| ------------------- | -------------- | ---------------------------------- |
| **Nitro**           | (intégré Nuxt) | Serveur API RESTful                |
| **Prisma**          | 7.0.0          | ORM base de données                |
| **MySQL**           | 8.0            | Base de données relationnelle      |
| **nuxt-auth-utils** | 0.5.23         | Auth par session (cookies scellés) |
| **bcryptjs**        | 3.0.2          | Hachage mots de passe              |
| **nodemailer**      | 7.0.5          | Envoi d'emails                     |
| **Firebase Admin**  | 13.6.0         | Push notifications FCM             |
| **Zod**             | 4.1.9          | Validation de schémas              |

### Outils de développement

| Outil        | Version    | Rôle                              |
| ------------ | ---------- | --------------------------------- |
| **Vitest**   | 3.2.4      | Tests (unit/nuxt/e2e/integration) |
| **ESLint**   | 9.32.0     | Linter                            |
| **Prettier** | 3.3.3      | Formatage                         |
| **Docker**   | Compose v2 | Environnements dev/test/prod      |

---

## 3. Architecture détaillée des répertoires

```
convention-de-jonglerie/
├── app/                          # Frontend Nuxt.js
│   ├── assets/                   # CSS (Tailwind), images
│   ├── components/               # Composants Vue (~100+ fichiers)
│   │   ├── admin/                # Interface admin
│   │   ├── artists/              # Gestion artistes
│   │   ├── convention/           # Composants convention
│   │   ├── edition/              # Éditions (carpool, ticketing, volunteer, zones)
│   │   ├── feedback/             # Retours utilisateurs
│   │   ├── guide/                # Guide utilisateur
│   │   ├── management/           # Gestion (tab manager)
│   │   ├── messenger/            # Messagerie
│   │   ├── notifications/        # Notifications
│   │   ├── organizer/            # Organisateurs
│   │   ├── profile/              # Profil utilisateur
│   │   ├── shows/                # Spectacles
│   │   ├── show-application/     # Candidatures spectacles
│   │   ├── ticketing/            # Billetterie (stats)
│   │   ├── ui/                   # Composants UI réutilisables
│   │   ├── volunteers/           # Bénévoles
│   │   └── workshops/            # Ateliers
│   ├── composables/              # Composables Vue (~30 fichiers)
│   ├── config/                   # Configuration Firebase
│   ├── layouts/                  # Layouts Nuxt
│   ├── middleware/               # Middleware navigation
│   ├── pages/                    # Pages (~50+ fichiers)
│   ├── plugins/                  # Plugins Nuxt
│   ├── stores/                   # Stores Pinia
│   ├── types/                    # Types TypeScript
│   └── utils/                    # Utilitaires frontend
├── server/                       # Backend API Nitro
│   ├── api/                      # Endpoints REST (~200+ handlers)
│   ├── constants/                # Constantes (permissions)
│   ├── emails/                   # Templates email (Vue Email)
│   ├── middleware/               # Middleware serveur
│   ├── plugins/                  # Plugins Nitro
│   ├── routes/                   # Routes spéciales (auth, uploads)
│   ├── tasks/                    # Tâches planifiées (CRON)
│   ├── templates/                # Templates HTML
│   ├── types/                    # Types serveur
│   └── utils/                    # Utilitaires serveur (~40 fichiers)
├── prisma/                       # Schéma et migrations
│   ├── schema/                   # Schéma multi-fichiers
│   └── migrations/               # 136 migrations
├── i18n/                         # Traductions
│   └── locales/                  # 14 langues, 15 domaines
├── test/                         # Tests (~199 fichiers)
│   ├── unit/                     # Tests unitaires (18)
│   ├── nuxt/                     # Tests Nuxt (169)
│   ├── integration/              # Tests DB (7)
│   └── e2e/                      # Tests E2E (2)
├── docs/                         # Documentation (~54 fichiers)
├── scripts/                      # Scripts utilitaires
├── shared/                       # Code partagé client/serveur
├── lib/                          # Bibliothèque partagée (schemas)
└── docker/                       # Configuration Docker
```

---

## 4. Couche Frontend

### 4.1 Pages et routage

L'application suit la convention de routage fichier-système de Nuxt.js :

| Route                                      | Page                         | Description                         |
| ------------------------------------------ | ---------------------------- | ----------------------------------- |
| `/`                                        | `index.vue`                  | Accueil avec filtres, carte, agenda |
| `/auth/login`                              | `auth/login.vue`             | Connexion                           |
| `/auth/register`                           | `auth/register.vue`          | Inscription                         |
| `/auth/forgot-password`                    | `auth/forgot-password.vue`   | Réinitialisation MDP                |
| `/auth/reset-password`                     | `auth/reset-password.vue`    | Nouveau MDP                         |
| `/conventions/add`                         | `conventions/add.vue`        | Créer convention                    |
| `/conventions/[id]`                        | `conventions/[id]/index.vue` | Détail convention                   |
| `/conventions/[id]/editions`               | `conventions/[id]/editions/` | Éditions d'une convention           |
| `/editions`                                | `editions/index.vue`         | Liste des éditions                  |
| `/editions/[id]`                           | `editions/[id]/index.vue`    | Détail édition                      |
| `/editions/[id]/gestion`                   | `editions/[id]/gestion/`     | Gestion édition                     |
| `/editions/[id]/gestion/volunteers`        | Onglets bénévoles            | Candidatures, équipes, planning     |
| `/editions/[id]/gestion/artists`           | Onglets artistes             | Gestion artistes                    |
| `/editions/[id]/gestion/meals`             | Onglet repas                 | Gestion repas                       |
| `/editions/[id]/gestion/ticketing`         | Onglet billetterie           | Tarifs, options, commandes          |
| `/editions/[id]/gestion/ticketing/counter` | Comptoir                     | Validation tickets                  |
| `/editions/[id]/gestion/workshops`         | Onglet ateliers              | Gestion ateliers                    |
| `/editions/[id]/gestion/shows-call`        | Appel spectacles             | Gestion candidatures                |
| `/editions/[id]/shows-call/[showCallId]`   | Appel public                 | Page publique                       |
| `/editions/[id]/volunteers`                | Espace bénévole              | Candidature, planning               |
| `/carpool-offers`                          | Covoiturage                  | Offres de covoiturage               |
| `/shows-call`                              | Appels ouverts               | Liste appels spectacles             |
| `/admin`                                   | Admin                        | Dashboard admin                     |
| `/admin/users`                             | Admin utilisateurs           | Gestion utilisateurs                |
| `/guide`                                   | Guide                        | Guide utilisateur                   |
| `/welcome`                                 | Bienvenue                    | Page d'accueil post-inscription     |

### 4.2 Composants

**Composants globaux** (racine de `app/components/`) :

| Composant                        | Description                            |
| -------------------------------- | -------------------------------------- |
| `AppHeader.vue`                  | En-tête avec navigation, thème, langue |
| `AppFooter.vue`                  | Pied de page                           |
| `EditionCard.vue`                | Carte d'édition réutilisable           |
| `FiltersPanel.vue`               | Panneau de filtres (accueil)           |
| `FavoritesMap.vue`               | Carte des favoris                      |
| `HomeMap.vue` / `HomeAgenda.vue` | Vue carte/agenda de l'accueil          |
| `AddressAutocomplete.vue`        | Autocomplétion adresse                 |
| `CountryMultiSelect.vue`         | Sélection multi-pays                   |
| `MinimalMarkdownEditor.vue`      | Éditeur Markdown                       |
| `UserSelector.vue`               | Sélection utilisateur                  |
| `PWAInstallBanner.vue`           | Bannière installation PWA              |

**Composants par domaine** :

| Répertoire           | Nombre | Exemples                                                         |
| -------------------- | ------ | ---------------------------------------------------------------- |
| `ui/`                | ~15    | LogoJc, SelectLanguage, UserAvatar, ConfirmModal, DateTimePicker |
| `edition/`           | ~20    | EditionHeader, EditionPosts, EditionServices                     |
| `edition/volunteer/` | ~15    | VolunteerApplicationForm, VolunteerPlanning                      |
| `edition/ticketing/` | ~10    | TicketingTiers, TicketingOrders                                  |
| `edition/carpool/`   | ~8     | CarpoolOfferCard, CarpoolRequestCard                             |
| `edition/zones/`     | ~5     | ZoneManager, ZoneMarkers                                         |
| `convention/`        | ~8     | ConventionForm, ConventionCard                                   |
| `organizer/`         | ~5     | OrganizerList, OrganizerRightsEditor                             |
| `admin/`             | ~10    | AdminStats, ErrorLogsList, FeedbackTable                         |
| `messenger/`         | ~8     | ConversationList, MessageBubble, ChatInput                       |
| `notifications/`     | ~5     | NotificationCenter, PushToggle                                   |
| `artists/`           | ~5     | ArtistForm, ArtistCard                                           |
| `shows/`             | ~5     | ShowForm, ShowCard                                               |
| `workshops/`         | ~5     | WorkshopForm, WorkshopCard                                       |
| `volunteers/`        | ~5     | VolunteerCard, VolunteerTeamCard                                 |
| `ticketing/stats/`   | ~5     | TicketingStats, RevenueChart                                     |
| `feedback/`          | ~3     | FeedbackForm, FeedbackModal                                      |
| `guide/`             | ~5     | GuideNav, GuidePage                                              |
| `profile/`           | ~5     | ProfilePictureUpload, ProfileForm                                |

### 4.3 Composables

| Composable              | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `useApiAction`          | Appels API standardisés (loading, toast, erreurs)    |
| `useApiActionById`      | Version par ID pour listes                           |
| `useChartExport`        | Export graphiques en PDF/image                       |
| `useConventionServices` | Services d'une convention (restauration, camping...) |
| `useCountries`          | Liste des pays avec cache                            |
| `useDateFormat`         | Formatage dates avec fuseaux horaires                |
| `useDatetime`           | Gestion cohérente des dates client/serveur           |
| `useDateTimePicker`     | Logique du sélecteur date/heure                      |
| `useEditionMarkers`     | Marqueurs carte d'une édition                        |
| `useEditionStatus`      | Statut et badge d'une édition                        |
| `useEditionZones`       | Zones géographiques d'une édition                    |
| `useElapsedTimer`       | Timer temps réel (opérations longues)                |
| `useLeaflet`            | Initialisation carte Leaflet                         |
| `useMessenger`          | Logique messagerie (types, conversations)            |
| `useOrganizerTitle`     | Titre synthétique d'un organisateur                  |
| `useProfileStats`       | Statistiques du profil utilisateur                   |
| `useSSE`                | Server-Sent Events (notifications temps réel)        |
| `useTimeFormat`         | Formatage horaires                                   |
| `useTicketingStats`     | Statistiques billetterie                             |
| `useVolunteerPlanning`  | Logique planning bénévoles                           |

### 4.4 Stores Pinia

| Store           | Description                                                 |
| --------------- | ----------------------------------------------------------- |
| `auth`          | Authentification (état connexion, utilisateur, permissions) |
| `editions`      | Cache et gestion des éditions                               |
| `favorites`     | Conventions/éditions favorites                              |
| `notifications` | Notifications in-app et compteurs                           |
| `messenger`     | État messagerie (conversations, messages non lus)           |

### 4.5 Middleware

| Middleware                    | Type   | Description                                |
| ----------------------------- | ------ | ------------------------------------------ |
| `load-translations.global.ts` | Global | Charge les traductions i18n selon la route |
| `auth.ts`                     | Route  | Vérifie l'authentification                 |
| `super-admin.ts`              | Route  | Vérifie les droits super-admin             |
| `authenticated.ts`            | Route  | Garde de route authentifié                 |

### 4.6 Layouts et Plugins

**Layouts** : Layout par défaut avec `AppHeader`, `AppFooter`, et zone de contenu.

**Plugins** :

- `auth.client.ts` : Initialise le store d'authentification côté client
- `firebase.client.ts` : Configuration Firebase pour les notifications push

**Configuration** (`app/config/`) :

- `firebase.config.ts` : Configuration Firebase (clés API)

---

## 5. Couche Backend (API)

### 5.1 Endpoints API

L'API suit une architecture RESTful organisée par domaine fonctionnel :

#### Authentification (`server/api/auth/`)

| Méthode | Route                              | Description                         |
| ------- | ---------------------------------- | ----------------------------------- |
| POST    | `/api/auth/register`               | Inscription avec vérification email |
| POST    | `/api/auth/login`                  | Connexion                           |
| POST    | `/api/auth/verify-email`           | Vérification code email             |
| POST    | `/api/auth/resend-verification`    | Renvoi code                         |
| POST    | `/api/auth/request-password-reset` | Demande réinitialisation MDP        |
| POST    | `/api/auth/reset-password`         | Réinitialisation MDP                |
| GET     | `/api/auth/verify-reset-token`     | Vérification token reset            |

#### Conventions (`server/api/conventions/`)

| Méthode             | Route                              | Description                |
| ------------------- | ---------------------------------- | -------------------------- |
| GET                 | `/api/conventions`                 | Liste des conventions      |
| POST                | `/api/conventions`                 | Créer une convention       |
| GET                 | `/api/conventions/[id]`            | Détail d'une convention    |
| PUT                 | `/api/conventions/[id]`            | Modifier une convention    |
| DELETE              | `/api/conventions/[id]`            | Supprimer une convention   |
| POST                | `/api/conventions/[id]/claim`      | Réclamer une convention    |
| GET/POST/PUT/DELETE | `/api/conventions/[id]/organizers` | CRUD organisateurs         |
| GET                 | `/api/conventions/[id]/volunteers` | Bénévoles d'une convention |

#### Éditions (`server/api/editions/`)

| Méthode | Route                | Description                             |
| ------- | -------------------- | --------------------------------------- |
| GET     | `/api/editions`      | Liste des éditions                      |
| POST    | `/api/editions`      | Créer une édition                       |
| GET     | `/api/editions/[id]` | Détail avec convention et organisateurs |
| PUT     | `/api/editions/[id]` | Modifier                                |
| DELETE  | `/api/editions/[id]` | Supprimer                               |

#### Sous-ressources des éditions (`server/api/editions/[id]/`)

| Domaine                     | Routes                                                                | Opérations                      |
| --------------------------- | --------------------------------------------------------------------- | ------------------------------- |
| **Artistes**                | `artists/`, `artists/[artistId]/`                                     | CRUD artistes, repas, QR codes  |
| **Spectacles**              | `shows/`                                                              | CRUD spectacles                 |
| **Appels spectacles**       | `shows-call/`, `shows-call/[showCallId]/applications/`                | Appels et candidatures          |
| **Bénévoles**               | `volunteers/`, `volunteers/applications/`, `volunteers/teams/`        | Candidatures, équipes, planning |
| **Créneaux**                | `volunteer-time-slots/`, `volunteer-time-slots/[slotId]/assignments/` | Planning horaire                |
| **Notifications bénévoles** | `volunteers/notification/`, `volunteers/notification/[groupId]/`      | Groupes de notification         |
| **Restauration**            | `volunteers/catering/`, `meals/`, `meals/[mealId]/`                   | Repas et validation             |
| **Billetterie**             | `ticketing/`, `ticketing/tiers/`, `ticketing/options/`                | Configuration billetterie       |
| **Commandes**               | `ticketing/orders/`, `ticketing/orders/[orderId]/`                    | Gestion commandes               |
| **Comptoirs**               | `ticketing/counters/`, `ticketing/counters/token/`                    | Comptoirs de vente              |
| **HelloAsso**               | `ticketing/helloasso/`, `ticketing/external/`                         | Intégrations externes           |
| **Quotas**                  | `ticketing/quotas/`                                                   | Gestion quotas                  |
| **Articles restituables**   | `ticketing/returnable-items/`                                         | Gestion consignes               |
| **Champs custom**           | `ticketing/custom-fields/`                                            | Champs personnalisés            |
| **Objets trouvés**          | `lost-found/`, `lost-found/[itemId]/`                                 | Objets perdus/trouvés           |
| **Posts**                   | `posts/`, `posts/[postId]/comments/`                                  | Fil d'actualité                 |
| **Ateliers**                | `workshops/`, `workshops/locations/`                                  | Ateliers et lieux               |
| **Covoiturage**             | `carpool-offers/`, `carpool-requests/`                                | Offres/demandes                 |
| **Zones**                   | `zones/`                                                              | Zones géographiques             |
| **Marqueurs**               | `markers/`                                                            | Marqueurs carte                 |
| **Permissions**             | `permissions/`                                                        | Droits par édition              |
| **Organisateurs édition**   | `organizers/edition-organizers/`                                      | Organisateurs spécifiques       |

#### Autres API

| Domaine                | Routes                                                                  |
| ---------------------- | ----------------------------------------------------------------------- |
| **Profil**             | `profile/` (update, change-password, upload-picture, categories)        |
| **Notifications**      | `notifications/` (CRUD, stream SSE, stats, mark-all-read)               |
| **FCM**                | `notifications/fcm/` (register, check, devices)                         |
| **Messagerie**         | `messenger/conversations/`, `messenger/conversations/[id]/messages/`    |
| **Covoiturage global** | `carpool-offers/`, `carpool-requests/`                                  |
| **Fichiers**           | `files/` (upload convention, edition, profile, lost-found)              |
| **Feedback**           | `feedback/`                                                             |
| **Admin**              | `admin/users/`, `admin/error-logs/`, `admin/feedback/`, `admin/backup/` |
| **Admin avancé**       | `admin/impersonate/`, `admin/tasks/`, `admin/notifications/`            |
| **Candidatures**       | `show-applications/`, `show-applications/[id]/`                         |
| **Appels ouverts**     | `shows-call/`                                                           |
| **Session**            | `session/`                                                              |
| **Uploads**            | Route catch-all pour servir les fichiers uploadés                       |

### 5.2 Middleware serveur

| Fichier           | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `error-logger.ts` | Capture et log les erreurs API dans `ApiErrorLog`       |
| `rate-limiter.ts` | Protection contre les abus (requêtes/fenêtre glissante) |

### 5.3 Utilitaires serveur

| Utilitaire                 | Description                                                           |
| -------------------------- | --------------------------------------------------------------------- |
| `api-helpers.ts`           | `wrapApiHandler` — wrapper standard pour tous les handlers API        |
| `auth-utils.ts`            | `requireAuth`, `optionalAuth` — extraction utilisateur depuis session |
| `validation-helpers.ts`    | `validateEditionId`, `sanitizeString` — validation et assainissement  |
| `validation-schemas.ts`    | Schémas Zod pour validation des données                               |
| `prisma-helpers.ts`        | `fetchResourceOrFail` — récupération avec erreur 404                  |
| `prisma-select-helpers.ts` | Sélections Prisma réutilisables (10+ helpers)                         |
| `organizer-management.ts`  | `canManageOrganizers`, `checkAdminMode`                               |
| `notification-service.ts`  | Service de notifications (in-app, push, email)                        |
| `notification-helpers.ts`  | Helpers pour créer des notifications contextuelles                    |
| `server-i18n.ts`           | Traduction côté serveur avec cache LRU                                |
| `api-rate-limiter.ts`      | Rate limiter configurable par route                                   |
| `upload-helpers.ts`        | Gestion des fichiers uploadés                                         |
| `error-helpers.ts`         | Gestion et formatage des erreurs                                      |

**Sous-utilitaires** :

- `editions/ticketing/` : Logique billetterie (HelloAsso, compteurs, quotas)
- `editions/volunteers/` : Logique bénévoles (auto-assignation, planification)
- `permissions/` : Système de permissions (convention, édition)
- `ticketing/` : Utilitaires billetterie

### 5.4 Système de permissions

Le système repose sur des **droits granulaires** par organisateur, sans rôles prédéfinis :

```
ConventionOrganizer
├── canEditConvention        # Modifier la convention
├── canDeleteConvention      # Supprimer la convention
├── canManageOrganizers      # Gérer les organisateurs
├── canManageVolunteers      # Gérer les bénévoles
├── canAddEdition            # Créer des éditions
├── canEditAllEditions       # Modifier toutes les éditions
└── canDeleteAllEditions     # Supprimer toutes les éditions

EditionOrganizerPermission   # Droits spécifiques par édition
├── canEdit
├── canDelete
└── canManageVolunteers
```

**Hiérarchie d'accès** :

1. Super Admin global (`isGlobalAdmin`)
2. Auteur de la convention (`authorId`)
3. Organisateur avec droits spécifiques
4. Créateur d'édition
5. Utilisateur authentifié
6. Visiteur anonyme

### 5.5 Plugins et tâches serveur

**Plugins Nitro** :

- `recaptcha-debug.ts` : Debug des clés reCAPTCHA

**Tâches CRON** (`server/tasks/`) :

- Nettoyage de tokens expirés
- Tâches de maintenance automatisées

**Templates email** (`server/emails/`) :

- Vérification email (code à 6 chiffres)
- Réinitialisation mot de passe
- Notifications bénévoles
- Templates Vue Email

**Routes spéciales** (`server/routes/`) :

- `auth/` : Routes d'authentification OAuth/social
- `uploads/[...path].get.ts` : Serveur de fichiers statiques avec cache

---

## 6. Couche données (Prisma)

### 6.1 Modèles par domaine

Le schéma utilise le format multi-fichiers dans `prisma/schema/` :

#### Utilisateurs et authentification

| Modèle                   | Description                                                    |
| ------------------------ | -------------------------------------------------------------- |
| `User`                   | Utilisateur (pseudo, email, mot de passe, profil, préférences) |
| `VerificationCode`       | Codes de vérification email                                    |
| `PasswordResetToken`     | Tokens réinitialisation MDP                                    |
| `NotificationPreference` | Préférences de notification                                    |
| `FcmToken`               | Tokens Firebase Cloud Messaging                                |

#### Conventions et éditions

| Modèle                       | Description                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| `Convention`                 | Convention de jonglerie                                      |
| `Edition`                    | Édition d'une convention (dates, lieu, services, ~50 champs) |
| `ConventionOrganizer`        | Organisateur avec droits granulaires                         |
| `EditionOrganizer`           | Organisateur spécifique à une édition                        |
| `EditionOrganizerPermission` | Droits par édition                                           |
| `ConventionClaim`            | Réclamation de convention                                    |
| `EditionAttendance`          | Participation à une édition                                  |

#### Bénévoles

| Modèle                        | Description                 |
| ----------------------------- | --------------------------- |
| `EditionVolunteerApplication` | Candidature bénévole        |
| `VolunteerTeam`               | Équipe de bénévoles         |
| `VolunteerTeamAssignment`     | Affectation à une équipe    |
| `VolunteerTimeSlot`           | Créneau horaire             |
| `VolunteerTimeSlotAssignment` | Affectation à un créneau    |
| `VolunteerNotificationGroup`  | Groupe de notifications     |
| `VolunteerComment`            | Commentaire sur un bénévole |

#### Billetterie

| Modèle                     | Description                    |
| -------------------------- | ------------------------------ |
| `TicketingTier`            | Tarif (manuel ou HelloAsso)    |
| `TicketingOption`          | Option de billetterie          |
| `TicketingOrder`           | Commande                       |
| `TicketingOrderItem`       | Ligne de commande              |
| `TicketingOrderItemOption` | Option sur ligne de commande   |
| `TicketingTierQuota`       | Quota par tarif                |
| `TicketingOptionQuota`     | Quota par option               |
| `TicketingReturnableItem`  | Article restituable (consigne) |
| `TicketingCounter`         | Comptoir de vente              |
| `TicketingCounterToken`    | Token d'accès comptoir         |
| `TicketingCustomField`     | Champ personnalisé             |
| `TicketingTierOption`      | Association tarif/option       |

#### Repas

| Modèle                        | Description                  |
| ----------------------------- | ---------------------------- |
| `VolunteerMeal`               | Type de repas par jour       |
| `VolunteerMealSelection`      | Sélection repas bénévole     |
| `ArtistMealSelection`         | Sélection repas artiste      |
| `VolunteerMealReturnableItem` | Consigne sur repas           |
| `TicketingTierMeal`           | Association tarif/repas      |
| `TicketingOptionMeal`         | Association option/repas     |
| `TicketingOrderItemMeal`      | Validation repas participant |

#### Artistes et spectacles

| Modèle                   | Description            |
| ------------------------ | ---------------------- |
| `EditionArtist`          | Artiste d'une édition  |
| `Show`                   | Spectacle              |
| `ShowReturnableItem`     | Consigne sur spectacle |
| `ShowCall`               | Appel à spectacles     |
| `ShowApplication`        | Candidature spectacle  |
| `ShowApplicationMessage` | Message de candidature |

#### Covoiturage

| Modèle             | Description            |
| ------------------ | ---------------------- |
| `CarpoolOffer`     | Offre de covoiturage   |
| `CarpoolRequest`   | Demande de covoiturage |
| `CarpoolBooking`   | Réservation            |
| `CarpoolPassenger` | Passager               |
| `CarpoolComment`   | Commentaire            |

#### Messagerie

| Modèle                    | Description                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `Conversation`            | Conversation (types: TEAM, VOLUNTEER_TO_ORGANIZERS, ORGANIZERS, PRIVATE, ARTIST_APPLICATION) |
| `ConversationParticipant` | Participant à une conversation                                                               |
| `Message`                 | Message avec réponses                                                                        |

#### Ateliers

| Modèle             | Description    |
| ------------------ | -------------- |
| `Workshop`         | Atelier        |
| `WorkshopFavorite` | Favori atelier |
| `WorkshopLocation` | Lieu d'atelier |

#### Carte et géographie

| Modèle          | Description                     |
| --------------- | ------------------------------- |
| `EditionZone`   | Zone géographique d'une édition |
| `EditionMarker` | Marqueur sur la carte           |

#### Divers

| Modèle                               | Description          |
| ------------------------------------ | -------------------- |
| `LostFoundItem` / `LostFoundComment` | Objets trouvés       |
| `Feedback`                           | Retours utilisateurs |
| `ApiErrorLog`                        | Logs d'erreurs API   |
| `Notification`                       | Notifications in-app |
| `EditionPost` / `EditionPostComment` | Fil d'actualité      |

### 6.2 Enums

| Enum                         | Valeurs                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| `AuthProvider`               | EMAIL, GOOGLE, FACEBOOK                                                |
| `EditionStatus`              | PUBLISHED, PLANNED, OFFLINE, CANCELLED                                 |
| `VolunteerApplicationStatus` | PENDING, ACCEPTED, REJECTED, CANCELLED, WAITLISTED                     |
| `VolunteerMealType`          | BREAKFAST, LUNCH, DINNER                                               |
| `VolunteerMealPhase`         | SETUP, EVENT, TEARDOWN                                                 |
| `LostFoundStatus`            | LOST, RETURNED                                                         |
| `FeedbackType`               | BUG, SUGGESTION, GENERAL, COMPLAINT                                    |
| `NotificationType`           | INFO, SUCCESS, WARNING, ERROR                                          |
| `ConversationType`           | TEAM, VOLUNTEER_TO_ORGANIZERS, ORGANIZERS, PRIVATE, ARTIST_APPLICATION |
| `VolunteerApplicationSource` | INTERNAL, EXTERNAL                                                     |
| `CarpoolPaymentMethod`       | CASH, CARD, TRANSFER, OTHER                                            |

### 6.3 Relations clés

```
User ──1:N──> Convention (auteur)
Convention ──1:N──> Edition
Convention ──N:M──> User (via ConventionOrganizer, droits granulaires)
Edition ──1:N──> EditionVolunteerApplication
Edition ──1:N──> VolunteerTeam
Edition ──1:N──> EditionArtist
Edition ──1:N──> Show
Edition ──1:N──> TicketingTier
Edition ──1:N──> TicketingOrder
Edition ──1:N──> Workshop
Edition ──1:N──> EditionPost
Edition ──1:N──> LostFoundItem
Edition ──1:N──> CarpoolOffer / CarpoolRequest
Edition ──1:N──> Conversation
Edition ──1:N──> VolunteerMeal
Edition ──1:N──> EditionZone / EditionMarker
Edition ──1:N──> ShowCall ──1:N──> ShowApplication
User ──N:M──> Edition (via EditionAttendance, favoris)
```

### 6.4 Migrations

- **Total** : 136 migrations
- **Première** : `20250910191127_initial_schema`
- **Dernière** : `20260210035734_add_show_image_and_location_reference`
- **Période** : Septembre 2025 - Février 2026 (~5 mois de développement actif)
- **Moteur** : MySQL avec adaptateur MariaDB (Prisma 7)

---

## 7. Internationalisation (i18n)

### Configuration

- **Stratégie** : `no_prefix` (pas de préfixe d'URL pour la langue)
- **Locale par défaut** : Français (`fr`)
- **API** : Composition API uniquement (`legacy: false`)
- **Lazy loading** : Chargement à la demande par route via middleware global

### Langues supportées (14)

| Code | Langue               |
| ---- | -------------------- |
| `fr` | Français (référence) |
| `en` | English              |
| `de` | Deutsch              |
| `es` | Español              |
| `it` | Italiano             |
| `nl` | Nederlands           |
| `pt` | Português            |
| `pl` | Polski               |
| `ru` | Русский              |
| `cs` | Čeština              |
| `da` | Dansk                |
| `sv` | Svenska              |
| `uk` | Українська           |

### Domaines de traduction (15)

| Domaine              | Chargement                           | Contenu                               |
| -------------------- | ------------------------------------ | ------------------------------------- |
| `common.json`        | Toujours                             | Navigation, erreurs, validation, pays |
| `components.json`    | Toujours                             | Composants UI réutilisables           |
| `app.json`           | Toujours                             | PWA, services                         |
| `public.json`        | Toujours                             | Homepage, SEO                         |
| `admin.json`         | Sur `/admin/*`                       | Interface d'administration            |
| `edition.json`       | Sur `/editions/*`                    | Éditions, conventions                 |
| `auth.json`          | Sur `/auth/*`, `/login`, `/register` | Authentification, profil              |
| `messenger.json`     | Sur `/messenger`                     | Messagerie                            |
| `gestion.json`       | Sur pages de gestion                 | Dashboard de gestion                  |
| `ticketing.json`     | Sur pages billetterie                | Billetterie                           |
| `artists.json`       | Sur pages artistes                   | Artistes                              |
| `workshops.json`     | Sur pages ateliers                   | Ateliers                              |
| `feedback.json`      | Sur pages feedback                   | Retours                               |
| `notifications.json` | Variable                             | Notifications                         |
| `permissions.json`   | Variable                             | Permissions                           |

### Scripts de gestion

| Script                           | Description                                    |
| -------------------------------- | ---------------------------------------------- |
| `check-i18n.js`                  | Analyse clés manquantes/inutilisées/dupliquées |
| `check-i18n-translations.js`     | Compare traductions entre langues              |
| `check-i18n-variables.cjs`       | Valide les variables dans les traductions      |
| `add-translation.js`             | Ajoute une clé à toutes les langues            |
| `translation/mark-todo.js`       | Marque les clés modifiées comme [TODO]         |
| `translation/translate-todos.js` | Traduit les clés [TODO] (API Anthropic)        |
| `translation/shared-config.js`   | Configuration partagée (mapping domaines)      |

---

## 8. Tests et CI/CD

### 8.1 Structure des tests

Le projet utilise **Vitest** avec 4 projets de test distincts :

| Projet        | Environnement | Fichiers | Description                                       |
| ------------- | ------------- | -------- | ------------------------------------------------- |
| `unit`        | happy-dom     | 18       | Tests unitaires purs (utils, composables, stores) |
| `nuxt`        | Nuxt complet  | 169      | Tests composants, pages, API serveur              |
| `integration` | Node + MySQL  | 7        | Tests avec vraie base de données                  |
| `e2e`         | Serveur Nuxt  | 2        | Tests end-to-end (infrastructure en place)        |

**Détail des 199 fichiers de test** :

```
test/
├── __mocks__/                    5 fichiers (Prisma, Firebase)
├── setup-*.ts                    5 fichiers de configuration
├── unit/                         18 fichiers
│   ├── composables/              6 (useApiAction, useEditionMarkers, etc.)
│   ├── utils/                    8 (avatar, countries, markdown, etc.)
│   ├── stores/                   3 (auth, editions, notifications)
│   └── security + i18n/          2
├── nuxt/                         169 fichiers
│   ├── components/               30+ (UI, admin, edition, notifications)
│   ├── middleware/                3 (auth, authenticated, super-admin)
│   ├── pages/                    22 (login, register, admin, editions, etc.)
│   ├── features/                 6 (conventions, editions, favorites)
│   ├── server/api/               108 (tous les endpoints API)
│   └── server/utils/             15 (permissions, rate-limiter, validation)
├── integration/                  7 fichiers .db.test.ts
└── e2e/                          2 fichiers
```

### 8.2 Pipeline CI/CD

**GitHub Actions** (`.github/workflows/tests.yml`) avec 4 jobs :

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Setup   │────>│   Lint   │     │  Build   │
│ (10 min) │     │ (5 min)  │     │ (10 min) │
└──────────┘     └─────┬────┘     └─────┬────┘
                       │                │
                       └───────┬────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Test (15 min)     │
                    │  Matrix 4 projets   │
                    │ unit|nuxt|e2e|db    │
                    └─────────────────────┘
```

- **Node.js** : v22
- **Cache** : npm + Prisma + .nuxt
- **MySQL 8.0** : Pour tests DB uniquement
- **Artifacts** : Résultats tests + coverage (30j)

### 8.3 Tests Docker

| Commande                          | Description                        |
| --------------------------------- | ---------------------------------- |
| `npm run docker:test`             | Suite complète (tous projets + DB) |
| `npm run docker:test:unit`        | Tests unitaires uniquement         |
| `npm run docker:test:integration` | Tests intégration avec MySQL       |
| `npm run docker:test:ui`          | Interface Vitest UI (port 5173)    |

---

## 9. Infrastructure Docker et déploiement

### Environnements Docker

| Fichier                      | Usage         | Services                                 |
| ---------------------------- | ------------- | ---------------------------------------- |
| `docker-compose.dev.yml`     | Développement | MySQL + App (hot reload, HMR port 24678) |
| `docker-compose.prod.yml`    | Production    | MySQL + App (réseau proxy externe)       |
| `docker-compose.release.yml` | Release       | Build et déploiement                     |

### Dockerfile multi-stage

```
┌───────────────┐
│   base        │  Node.js + curl, openssl, mysql-client
└───────┬───────┘
        │
┌───────▼───────┐
│   builder     │  npm install + Prisma generate + nuxt build (8Go RAM)
└───────┬───────┘
        │
┌───────▼───────┐     ┌───────────────┐
│   runtime     │     │     dev       │
│  (production) │     │ (hot reload)  │
│ entrypoint.sh │     │ ports 3000+   │
│ + migrations  │     │    24678      │
└───────────────┘     └───────────────┘
```

### Variables d'environnement clés

| Variable                  | Description                    |
| ------------------------- | ------------------------------ |
| `DATABASE_URL`            | URL de connexion MySQL         |
| `NUXT_SESSION_PASSWORD`   | Clé de session (32+ chars)     |
| `SEND_EMAILS`             | `true`/`false` pour envoi réel |
| `SMTP_USER` / `SMTP_PASS` | Identifiants SMTP Gmail        |
| `PRISMA_LOG_LEVEL`        | Niveau de log Prisma           |
| `NUXT_PUBLIC_SITE_URL`    | URL publique du site           |

---

## 10. Diagramme d'architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVIGATEUR                              │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   Vue.js    │  │  Pinia       │  │  Composables           │ │
│  │   Pages     │  │  Stores      │  │  (useApiAction, etc.)  │ │
│  │   Composants│  │  (auth,      │  │                        │ │
│  │   Nuxt UI   │  │  favorites,  │  │  ┌──────────────────┐  │ │
│  │   Tailwind  │  │  notifs)     │  │  │ SSE (notifications│  │ │
│  │             │  │              │  │  │  temps réel)      │  │ │
│  └──────┬──────┘  └──────┬───────┘  │  └──────────────────┘  │ │
│         │                │          └────────────┬───────────┘ │
│         └────────────────┼───────────────────────┘             │
│                          │ $fetch / useFetch                   │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   NITRO     │
                    │   Server    │
                    │             │
┌───────────────────┤  Middleware ├───────────────────────────────┐
│                   │  ├ auth     │                               │
│                   │  ├ rate-lim │                               │
│                   │  └ err-log  │                               │
│                   └──────┬──────┘                               │
│                          │                                      │
│  ┌───────────────────────▼────────────────────────────────────┐ │
│  │                    API HANDLERS                            │ │
│  │                                                            │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │ │
│  │  │   Auth   │ │Convention│ │ Editions │ │  Bénévoles   │ │ │
│  │  │  login   │ │  CRUD    │ │  CRUD    │ │ candidatures │ │ │
│  │  │ register │ │ orga.    │ │ artistes │ │  équipes     │ │ │
│  │  │ verify   │ │ claim    │ │ shows    │ │  planning    │ │ │
│  │  └──────────┘ └──────────┘ │ tickets  │ │  repas       │ │ │
│  │                            │ ateliers │ │              │ │ │
│  │  ┌──────────┐ ┌──────────┐│ covoit.  │ └──────────────┘ │ │
│  │  │  Admin   │ │Messenger ││ zones    │                   │ │
│  │  │  users   │ │ convos   ││ markers  │ ┌──────────────┐ │ │
│  │  │  logs    │ │ messages │└──────────┘ │ Notifications│ │ │
│  │  │  backup  │ │ replies  │             │  in-app      │ │ │
│  │  │  tasks   │ └──────────┘             │  push FCM    │ │ │
│  │  └──────────┘                          │  SSE stream  │ │ │
│  │                                        │  email       │ │ │
│  └────────────────────────┬───────────────┴──────────────┘  │
│                           │                                  │
│               ┌───────────▼────────────┐                    │
│               │     PRISMA ORM         │                    │
│               │   prisma-select-helpers │                    │
│               │   validation (Zod)     │                    │
│               │   permissions          │                    │
│               └───────────┬────────────┘                    │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   MySQL 8   │
                    │  60+ tables │
                    │  136 migr.  │
                    └─────────────┘

Services externes :
  ├── Firebase Cloud Messaging (push notifications)
  ├── Gmail SMTP (emails)
  ├── HelloAsso API (billetterie)
  ├── Nominatim/OpenStreetMap (géocodage)
  └── Anthropic Claude API (traductions IA)
```

---

## 11. Patterns et conventions de code

### Patterns API

1. **`wrapApiHandler`** : Wrapper standard pour tous les handlers, gère les erreurs et le logging
2. **`requireAuth` / `optionalAuth`** : Extraction utilisateur depuis la session scellée
3. **`fetchResourceOrFail`** : Récupération avec erreur 404 automatique
4. **Validation Zod** : Schémas de validation pour toutes les entrées
5. **`sanitizeString`** : Assainissement des chaînes contre XSS

### Patterns Frontend

1. **`useApiAction`** : Composable standard pour les appels API (loading, toast, erreurs)
2. **Nuxt UI** : Utilisation systématique des composants UI (UButton, UModal, UCard, etc.)
3. **Tailwind CSS** : Classes utilitaires pour tout le styling
4. **i18n** : Toutes les chaînes via `$t()` ou `t()` (composition API)
5. **Stores Pinia** : État global pour auth, favoris, notifications

### Conventions de nommage

- **Fichiers API** : `index.get.ts`, `index.post.ts`, `[id].put.ts`, `[id].delete.ts`
- **Tests** : `.test.ts`, `.db.test.ts` (intégration), `.page.nuxt.test.ts` (pages)
- **Composables** : `use<Nom>.ts` (camelCase)
- **Composants** : `PascalCase.vue`

### Sécurité

- Sessions scellées (cookies httpOnly, SameSite)
- Rate limiting par route
- Validation Zod sur toutes les entrées
- Sanitisation des chaînes
- Hash bcrypt des mots de passe
- Hash MD5 des emails (Gravatar)
- Pas d'exposition d'emails dans les réponses API

---

## 12. Statistiques clés

| Métrique                  | Valeur               |
| ------------------------- | -------------------- |
| **Taille du projet**      | ~190 Mo              |
| **Fichiers de code**      | ~2 822               |
| **Fichiers totaux**       | ~6 908               |
| **Modèles Prisma**        | 60+                  |
| **Migrations**            | 136                  |
| **Endpoints API**         | 200+ handlers        |
| **Pages**                 | 50+                  |
| **Composants**            | 100+                 |
| **Composables**           | ~30                  |
| **Stores Pinia**          | 5                    |
| **Fichiers de test**      | 199                  |
| **Tests API**             | 108                  |
| **Langues i18n**          | 14                   |
| **Domaines traduction**   | 15                   |
| **Documentation**         | 54 fichiers (688 Ko) |
| **Docker configs**        | 10 fichiers compose  |
| **Période développement** | Sep 2025 - Fév 2026  |

---

## 13. Recommandations et améliorations

### Points forts

- **Architecture bien structurée** : Séparation claire frontend/backend, organisation par domaine
- **Système de permissions granulaire** : Flexible et extensible, sans rôles rigides
- **i18n complète** : 14 langues avec lazy loading et workflow de traduction automatisé
- **Tests exhaustifs** : 199 fichiers couvrant tous les niveaux (unit, component, API, integration)
- **CI/CD robuste** : Pipeline GitHub Actions avec cache, tests parallèles, et Docker
- **Documentation riche** : 54 fichiers couvrant tous les sous-systèmes
- **Patterns standardisés** : `wrapApiHandler`, `useApiAction`, `prisma-select-helpers`
- **Sécurité** : Rate limiting, validation Zod, sessions scellées, sanitisation

### Axes d'amélioration potentiels

1. **Tests E2E** : Infrastructure en place mais tests actuellement désactivés (`describe.skip`). Activer et étendre les tests E2E pour couvrir les workflows utilisateur critiques.

2. **Prisma Select Helpers** : Certains endpoints utilisent encore des sélections en dur au lieu des helpers standardisés. Continuer la migration vers les helpers réutilisables.

3. ~~**Répertoire `.history/`**~~ : ✅ Déjà dans `.gitignore`, aucun fichier suivi par git. Dossier local de l'extension VSCode "Local History".

4. **Coverage** : Pas de configuration de coverage explicite dans `vitest.config.ts`. Ajouter des seuils de couverture minimaux dans la CI.

5. **Cache API** : Certaines requêtes fréquentes (liste des conventions, éditions publiques) pourraient bénéficier d'un cache serveur (Redis ou cache en mémoire).

6. ~~**Types API**~~ : ✅ Implémenté. Types partagés dans `shared/types/api.ts`, types Prisma-dépendants dans `server/types/api-responses.ts`, 4 endpoints prioritaires typés avec `wrapApiHandler<T>`.

7. **Bundle size** : Surveiller la taille du bundle avec les 14 langues et les nombreuses dépendances. Le lazy loading i18n est un bon début.
