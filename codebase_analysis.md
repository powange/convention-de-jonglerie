# Analyse Complète du Projet : Convention de Jonglerie

## Rapport généré le : 2025-10-15

---

## 1. Vue d'Ensemble du Projet

### Type de Projet

**Application Web Full-Stack** pour la gestion et la découverte de conventions de jonglerie avec un système collaboratif complet.

### Description

Plateforme web moderne permettant aux organisateurs de créer et gérer des conventions de jonglerie, aux utilisateurs de découvrir des événements, de s'inscrire comme bénévoles, de gérer du covoiturage, et de participer à une communauté autour des arts du cirque et de la jonglerie.

### Architecture Générale

- **Pattern**: Architecture Monolithique Full-Stack avec séparation client-serveur
- **Paradigme**: Server-Side Rendering (SSR) avec hydration côté client
- **Modèle de données**: Relationnel avec ORM
- **Architecture API**: RESTful avec routes typées

---

## 2. Stack Technologique

### Frontend (Client)

#### Framework Principal

- **Nuxt.js v4.1.1** - Framework Vue.js universel avec SSR
- **Vue.js v3.5.17** - Framework JavaScript réactif
- **TypeScript v5.8.3** - Langage typé pour une meilleure maintenabilité

#### UI & Styling

- **Nuxt UI v4.0.0** - Bibliothèque de composants basée sur Tailwind CSS
- **Tailwind CSS** (intégré via Nuxt UI) - Framework CSS utility-first
- **UnoCSS** - Moteur CSS atomique (via Nuxt UI)
- **Flag Icons v7.5.0** - Icônes de drapeaux pour le sélecteur de langue
- **@iconify/vue** - Système d'icônes unifié

#### Gestion d'État & Données

- **Pinia v3.0.3** - Store state management pour Vue.js
- **@vueuse/core v13.6.0** - Collection de composables Vue
- **@internationalized/date v3.8.2** - Manipulation de dates internationalisées

#### Bibliothèques Spécialisées

- **FullCalendar v6.1.x** - Système de planning pour bénévoles
  - `@fullcalendar/core`
  - `@fullcalendar/vue3`
  - `@fullcalendar/resource-timeline` - Planning avec ressources
  - `@fullcalendar/interaction` - Interactions drag & drop
- **Leaflet** (via composable) - Cartes interactives pour géolocalisation
- **html2canvas v1.4.1** - Capture d'écran/export PDF
- **jspdf v3.0.3** - Génération de PDF
- **html5-qrcode v2.3.8** - Lecteur QR Code pour contrôle d'accès
- **nuxt-qrcode v0.4.8** - Génération de QR Codes
- **vue3-json-viewer v2.4.1** - Visualisation JSON (admin)

### Backend (Serveur)

#### Moteur Serveur

- **Nitro** (intégré à Nuxt) - Moteur serveur universal avec API routes
- **Node.js** (v22.x requis) - Runtime JavaScript

#### Base de Données

- **MySQL** - SGBD relationnel
- **Prisma v6.17.1** - ORM moderne avec migrations
  - `@prisma/client` - Client Prisma généré
  - `@prisma/nuxt v0.3.0` - Intégration Nuxt

#### Authentification & Sécurité

- **nuxt-auth-utils v0.5.23** - Sessions scellées (sealed sessions)
- **bcryptjs v3.0.2** - Hachage de mots de passe
- **web-push v3.6.7** - Notifications push (VAPID)
- **Zod v4.1.9** - Validation de schémas TypeScript-first

#### Services Externes & Intégrations

- **nodemailer v7.0.5** - Envoi d'emails SMTP
- **@vue-email/render v0.0.9** - Templates d'emails en Vue
- **node-cron v3.0.3** - Tâches planifiées (cron jobs)

#### Traitement de Données

- **sharp v0.33.5** - Traitement d'images optimisé
- **md5 v2.3.0** - Hash MD5 (Gravatar)
- **luxon v3.5.0** - Manipulation de dates avancée

#### Markdown & Contenu

- **unified v11.0.4** - Processeur de contenu
- **remark-parse v11.0.0** - Parser Markdown
- **remark-gfm v4.0.0** - Support GitHub Flavored Markdown
- **remark-rehype v11.1.0** - Transformation Markdown → HTML
- **rehype-sanitize v6.0.0** - Sanitization HTML (sécurité XSS)
- **rehype-stringify v10.0.0** - Génération HTML

### Modules Nuxt

#### SEO & Performance

- **@nuxtjs/seo v3.2.2** - Suite SEO complète
  - Sitemap XML automatique
  - Robots.txt
  - Open Graph images
  - Schema.org (données structurées)
- **@nuxt/image v1.10.0** - Optimisation d'images
- **@nuxt/scripts v0.11.10** - Chargement optimisé de scripts tiers

#### Internationalisation

- **@nuxtjs/i18n v10.0.3** - Support multilingue
  - 11 langues supportées (en, fr, de, es, it, nl, pl, pt, ru, uk, da)
  - Stratégie no_prefix avec détection automatique du navigateur
  - Compilation optimisée des traductions

#### Développement

- **@nuxt/eslint v1.7.1** - Configuration ESLint intégrée
- **@nuxt/test-utils v3.19.2** - Utilitaires de test Nuxt

### Outils de Développement

#### Testing

- **Vitest v3.2.4** - Framework de tests unitaires et d'intégration
- **@vitest/ui v3.2.4** - Interface web pour Vitest
- **@testing-library/vue v8.1.0** - Test utilities pour Vue
- **@vue/test-utils v2.4.6** - Utilitaires de test officiels Vue
- **happy-dom v18.0.1** - Environnement DOM léger pour tests

#### Build & Qualité

- **Vite** (intégré à Nuxt) - Build tool rapide
- **ESLint v9.32.0** - Linter JavaScript/TypeScript
- **Prettier v3.3.3** - Formateur de code
- **TypeScript v5.8.3** - Vérification de types statique
- **tsx v4.19.1** - Exécution TypeScript direct

#### Storage & Files

- **nuxt-file-storage v0.3.0** - Gestion de fichiers uploadés

#### Docker

- Support Docker complet avec multiples configurations
- Environnements : dev, test, release, production
- Docker Compose pour orchestration

---

## 3. Architecture du Projet

### Structure des Répertoires

```
convention-de-jonglerie/
│
├── app/                          # Application Frontend (Nuxt Layer)
│   ├── assets/                   # Fichiers statiques (CSS, images sources)
│   │   └── css/
│   │       └── main.css         # Styles globaux + Tailwind imports
│   │
│   ├── components/              # Composants Vue réutilisables
│   │   ├── admin/               # Composants administration
│   │   ├── convention/          # Composants liés aux conventions
│   │   ├── edition/             # Composants liés aux éditions
│   │   │   ├── carpool/        # Système de covoiturage
│   │   │   ├── ticketing/      # Billetterie (HelloAsso)
│   │   │   └── volunteer/      # Gestion bénévoles
│   │   ├── notifications/       # Centre de notifications
│   │   └── ui/                  # Composants UI génériques
│   │
│   ├── composables/             # Composables Vue (logique réutilisable)
│   │   ├── useAuthStore.ts     # Gestion authentification
│   │   ├── useDateFormat.ts    # Formatage dates i18n
│   │   ├── useModal.ts         # Gestion modales
│   │   ├── useNotificationStream.ts  # Notifications temps réel
│   │   ├── usePushNotifications.ts   # Notifications push
│   │   ├── useVolunteerTeams.ts      # Gestion équipes bénévoles
│   │   └── ... (25 composables)
│   │
│   ├── middleware/              # Middlewares de navigation
│   │   ├── auth.ts             # Protection routes authentifiées
│   │   └── admin.ts            # Protection routes admin
│   │
│   ├── pages/                   # Pages de l'application (routing auto)
│   │   ├── index.vue           # Page d'accueil (liste éditions)
│   │   ├── login.vue           # Connexion
│   │   ├── register.vue        # Inscription
│   │   ├── profile.vue         # Profil utilisateur
│   │   ├── favorites.vue       # Éditions favorites
│   │   ├── my-conventions.vue  # Mes conventions
│   │   ├── my-volunteer-applications.vue  # Mes candidatures bénévoles
│   │   │
│   │   ├── auth/               # Flux authentification
│   │   │   ├── forgot-password.vue
│   │   │   └── reset-password.vue
│   │   │
│   │   ├── conventions/        # Gestion conventions
│   │   │   ├── add.vue
│   │   │   └── [id]/
│   │   │       ├── edit.vue
│   │   │       └── editions/add.vue
│   │   │
│   │   ├── editions/           # Pages éditions
│   │   │   ├── add.vue
│   │   │   └── [id]/
│   │   │       ├── index.vue          # Détail édition
│   │   │       ├── edit.vue           # Édition
│   │   │       ├── carpool.vue        # Covoiturage
│   │   │       ├── commentaires.vue   # Forum
│   │   │       ├── objets-trouves.vue # Objets perdus/trouvés
│   │   │       ├── volunteers/        # Espace bénévoles
│   │   │       │   └── index.vue      # Formulaire candidature
│   │   │       └── gestion/           # Espace organisateurs
│   │   │           ├── index.vue
│   │   │           ├── ticketing/     # Billetterie
│   │   │           │   ├── external.vue
│   │   │           │   ├── tiers.vue
│   │   │           │   ├── orders.vue
│   │   │           │   └── access-control.vue
│   │   │           └── volunteers/    # Gestion bénévoles
│   │   │               ├── applications.vue
│   │   │               ├── teams.vue
│   │   │               ├── planning.vue
│   │   │               ├── notifications.vue
│   │   │               └── tools.vue
│   │   │
│   │   └── admin/              # Administration globale
│   │       ├── index.vue       # Dashboard
│   │       ├── users/          # Gestion utilisateurs
│   │       ├── conventions.vue
│   │       ├── feedback.vue    # Retours utilisateurs
│   │       ├── error-logs.vue  # Logs d'erreurs
│   │       ├── notifications.vue
│   │       ├── backup.vue      # Backup/Restore DB
│   │       └── crons.vue       # Tâches planifiées
│   │
│   ├── plugins/                # Plugins Nuxt
│   │   └── auth.client.ts      # Initialisation auth côté client
│   │
│   ├── stores/                 # Stores Pinia
│   │   └── auth.ts            # Store authentification central
│   │
│   ├── types/                  # Types TypeScript partagés
│   │   └── index.d.ts         # Définitions de types globales
│   │
│   ├── utils/                  # Utilitaires frontend
│   │   ├── date.ts            # Manipulation dates
│   │   ├── avatar.ts          # Génération avatars
│   │   ├── countries.ts       # Liste pays
│   │   └── ...
│   │
│   └── app.vue                 # Composant racine de l'application
│
├── server/                     # Backend Nitro
│   ├── api/                    # Endpoints API RESTful
│   │   ├── auth/              # Authentification
│   │   │   ├── register.post.ts
│   │   │   ├── login.post.ts
│   │   │   ├── logout.post.ts
│   │   │   ├── verify-email.post.ts
│   │   │   ├── request-password-reset.post.ts
│   │   │   └── reset-password.post.ts
│   │   │
│   │   ├── session/           # Session utilisateur
│   │   │   └── me.get.ts      # Récupérer session courante
│   │   │
│   │   ├── profile/           # Profil utilisateur
│   │   │   ├── update.put.ts
│   │   │   ├── change-password.post.ts
│   │   │   ├── stats.get.ts
│   │   │   └── notification-preferences.{get,put}.ts
│   │   │
│   │   ├── conventions/       # CRUD Conventions
│   │   │   ├── index.{get,post}.ts
│   │   │   └── [id]/
│   │   │       ├── index.put.ts
│   │   │       ├── delete-image.delete.ts
│   │   │       ├── editions.get.ts
│   │   │       ├── collaborators.get.ts
│   │   │       ├── collaborators/
│   │   │       │   ├── [collaboratorId].delete.ts
│   │   │       │   ├── [collaboratorId].rights.patch.ts
│   │   │       │   └── history.get.ts
│   │   │       └── claim/     # Revendication de convention
│   │   │           ├── index.post.ts
│   │   │           └── verify.post.ts
│   │   │
│   │   ├── editions/          # CRUD Éditions
│   │   │   ├── index.{get,post}.ts
│   │   │   ├── favorites.get.ts
│   │   │   └── [id]/
│   │   │       ├── index.{get,put,delete}.ts
│   │   │       ├── carpool-offers.get.ts
│   │   │       ├── carpool-requests.get.ts
│   │   │       ├── posts/     # Forum
│   │   │       ├── lost-found/ # Objets perdus/trouvés
│   │   │       ├── volunteers/ # Bénévolat
│   │   │       │   ├── applications/
│   │   │       │   ├── teams/
│   │   │       │   ├── catering/
│   │   │       │   └── notification/
│   │   │       ├── volunteer-teams/
│   │   │       ├── volunteer-time-slots/
│   │   │       └── ticketing/  # Billetterie
│   │   │           ├── external.{get,post,put,delete}.ts
│   │   │           ├── helloasso/
│   │   │           ├── tiers/
│   │   │           ├── options/
│   │   │           ├── quotas/
│   │   │           ├── returnable-items/
│   │   │           └── volunteers/
│   │   │
│   │   ├── carpool-offers/    # Covoiturage - Offres
│   │   │   └── [id]/
│   │   │       ├── index.{put,delete}.ts
│   │   │       ├── comments.{get,post}.ts
│   │   │       ├── bookings.{get,post}.ts
│   │   │       └── passengers.post.ts
│   │   │
│   │   ├── carpool-requests/  # Covoiturage - Demandes
│   │   │   └── [id]/
│   │   │       ├── index.{put,delete}.ts
│   │   │       └── comments.{get,post}.ts
│   │   │
│   │   ├── notifications/     # Système de notifications
│   │   │   ├── index.get.ts
│   │   │   ├── stream.get.ts  # Server-Sent Events
│   │   │   ├── stats.get.ts
│   │   │   ├── mark-all-read.patch.ts
│   │   │   ├── [id]/
│   │   │   └── push/          # Push notifications
│   │   │       ├── subscribe.post.ts
│   │   │       ├── unsubscribe.post.ts
│   │   │       └── check.post.ts
│   │   │
│   │   ├── files/             # Upload de fichiers
│   │   │   ├── convention.post.ts
│   │   │   ├── edition.post.ts
│   │   │   ├── profile.post.ts
│   │   │   └── lost-found.post.ts
│   │   │
│   │   ├── feedback/          # Retours utilisateurs
│   │   │   └── index.post.ts
│   │   │
│   │   ├── users/             # Recherche utilisateurs
│   │   │   └── search.get.ts
│   │   │
│   │   ├── countries.get.ts   # Liste des pays
│   │   │
│   │   ├── admin/             # Administration
│   │   │   ├── stats.get.ts
│   │   │   ├── activity.get.ts
│   │   │   ├── users/
│   │   │   ├── conventions/
│   │   │   ├── editions/
│   │   │   ├── feedback/
│   │   │   ├── error-logs/
│   │   │   ├── notifications/
│   │   │   ├── backup/
│   │   │   ├── tasks/         # Tâches Nitro
│   │   │   └── impersonate/   # Impersonnalisation
│   │   │
│   │   ├── __sitemap__/       # Génération sitemap
│   │   │   └── editions.get.ts
│   │   │
│   │   └── uploads/           # Servir fichiers uploadés
│   │       └── [...path].get.ts
│   │
│   ├── emails/                # Templates d'emails (Vue Email)
│   │   ├── VerificationEmail.vue
│   │   ├── PasswordResetEmail.vue
│   │   └── ...
│   │
│   ├── middleware/            # Middlewares HTTP
│   │   └── auth.ts           # Authentification serveur
│   │
│   ├── routes/                # Routes non-API
│   │   └── auth/             # OAuth callbacks
│   │
│   ├── utils/                 # Utilitaires serveur
│   │   ├── prisma.ts         # Client Prisma singleton
│   │   ├── emailService.ts   # Service d'envoi d'emails
│   │   ├── notification-service.ts
│   │   ├── push-notification-service.ts
│   │   ├── error-logger.ts   # Logging d'erreurs structuré
│   │   ├── geocoding.ts      # Géocodage adresses (Nominatim)
│   │   ├── encryption.ts     # Chiffrement données sensibles
│   │   ├── rate-limiter.ts   # Rate limiting
│   │   ├── auth-utils.ts     # Helpers auth
│   │   ├── admin-auth.ts     # Vérifications admin
│   │   ├── permissions/      # Système de permissions
│   │   │   ├── convention-permissions.ts
│   │   │   ├── edition-permissions.ts
│   │   │   ├── volunteer-permissions.ts
│   │   │   └── access-control-permissions.ts
│   │   ├── editions/         # Logique métier éditions
│   │   │   ├── ticketing/    # Billetterie
│   │   │   │   ├── helloasso.ts
│   │   │   │   ├── tiers.ts
│   │   │   │   ├── options.ts
│   │   │   │   └── returnable-items.ts
│   │   │   └── volunteers/   # Bénévolat
│   │   │       ├── applications.ts
│   │   │       └── teams.ts
│   │   └── ...
│   │
│   └── tasks/                 # Tâches planifiées (cron)
│       ├── clean-tokens.ts   # Nettoyage tokens expirés
│       └── ...
│
├── prisma/                    # Gestion base de données
│   ├── schema.prisma         # Schéma de données Prisma
│   └── migrations/           # Migrations de base de données
│       └── [timestamp]_[name]/
│
├── test/                      # Tests
│   ├── unit/                 # Tests unitaires (Vitest)
│   │   ├── composables/
│   │   ├── stores/
│   │   ├── utils/
│   │   └── security/
│   │
│   ├── nuxt/                 # Tests Nuxt (SSR)
│   │   ├── components/       # Tests de composants
│   │   ├── pages/            # Tests de pages
│   │   ├── features/         # Tests de fonctionnalités
│   │   └── server/           # Tests API endpoints
│   │       ├── api/
│   │       └── middleware/
│   │
│   ├── integration/          # Tests d'intégration (DB)
│   │   ├── auth.db.test.ts
│   │   ├── conventions.db.test.ts
│   │   ├── collaborators.chain.db.test.ts
│   │   └── volunteers.workflow.db.test.ts
│   │
│   ├── e2e/                  # Tests end-to-end
│   │
│   ├── setup.ts              # Configuration tests Nuxt
│   ├── setup-db.ts           # Configuration tests DB
│   └── setup-common.ts       # Configuration commune
│
├── scripts/                   # Scripts utilitaires
│   ├── run-geocoding.mjs     # Géocodage batch
│   ├── clean-expired-tokens.ts
│   ├── manage-admin.ts       # Gestion admins CLI
│   ├── check-i18n.js         # Vérification traductions
│   ├── add-translation.js    # Ajout traductions
│   └── ...
│
├── docs/                      # Documentation technique
│   ├── AUTH_SESSIONS.md      # Système d'authentification
│   ├── COLLABORATOR_PERMISSIONS.md  # Permissions collaborateurs
│   ├── NOTIFICATION_SYSTEM.md
│   ├── ERROR_LOGGING_SYSTEM.md
│   ├── CRON_SYSTEM.md
│   ├── helloasso-integration.md
│   ├── backup-system.md
│   └── ...
│
├── i18n/                      # Internationalisation
│   ├── locales/              # Fichiers de traduction
│   │   ├── en.json
│   │   ├── fr.json
│   │   ├── de.json
│   │   └── ... (11 langues)
│   └── i18n.config.ts        # Configuration i18n
│
├── public/                    # Fichiers publics statiques
│   ├── logos/                # Logos de l'application
│   ├── favicons/             # Favicons multi-tailles
│   └── uploads/              # Fichiers uploadés (gitignored)
│
├── .claude/                   # Configuration Claude Code
│   ├── commands/             # Commandes slash personnalisées
│   │   ├── lint-fix.md
│   │   ├── run-tests.md
│   │   ├── quality-check.md
│   │   └── ...
│   └── settings.local.json   # Settings locaux
│
├── .github/                   # CI/CD GitHub Actions
│   └── workflows/
│       └── tests.yml         # Workflow de tests automatisés
│
├── .nuxt/                     # Build Nuxt (généré, gitignored)
├── .output/                   # Build production (généré)
├── node_modules/              # Dépendances (gitignored)
│
├── nuxt.config.ts            # Configuration Nuxt
├── vitest.config.ts          # Configuration Vitest
├── tsconfig.json             # Configuration TypeScript
├── eslint.config.mjs         # Configuration ESLint v9
├── package.json              # Dépendances et scripts
├── .env                      # Variables d'environnement (gitignored)
├── .env.example              # Template .env
├── Dockerfile                # Image Docker production
├── Dockerfile.dev            # Image Docker développement
├── docker-compose.dev.yml    # Orchestration Docker dev
├── docker-compose.prod.yml   # Orchestration Docker prod
├── CLAUDE.md                 # Instructions pour Claude Code
└── README.md                 # Documentation projet
```

---

## 4. Modèle de Données (Prisma Schema)

### Entités Principales

#### **User** (Utilisateur)

Utilisateur central du système avec support multi-providers.

**Champs clés:**

- `id`, `email`, `pseudo`, `password`
- `authProvider`: "email" | "google" | "facebook"
- `isGlobalAdmin`: Administrateur global
- `preferredLanguage`: Langue préférée (11 langues)
- `isEmailVerified`, `emailVerificationCode`
- `profilePicture`, `phone`

**Relations:**

- Créateur de `Convention[]`, `Edition[]`
- Collaborateur dans `ConventionCollaborator[]`
- Candidatures bénévoles `EditionVolunteerApplication[]`
- Offres/demandes covoiturage `CarpoolOffer[]`, `CarpoolRequest[]`
- Notifications `Notification[]`
- Favoris `Edition[]` (many-to-many)
- Présence `Edition[]` (many-to-many)

#### **Convention**

Représente une série d'événements récurrents.

**Champs:**

- `id`, `name`, `description`, `logo`, `email`
- `authorId` (nullable pour imports)
- `isArchived`, `archivedAt`

**Relations:**

- `author`: User
- `editions`: Edition[]
- `collaborators`: ConventionCollaborator[]
- `permissionHistory`: CollaboratorPermissionHistory[]
- `claimRequests`: ConventionClaimRequest[]

#### **ConventionCollaborator**

Système de permissions granulaires pour collaborateurs.

**Droits disponibles:**

- `canEditConvention`: Modifier métadonnées
- `canDeleteConvention`: Supprimer convention
- `canManageCollaborators`: Gérer collaborateurs
- `canAddEdition`: Créer éditions
- `canEditAllEditions`: Modifier toutes éditions
- `canDeleteAllEditions`: Supprimer toutes éditions
- `canManageVolunteers`: Gérer bénévoles
- `title`: Titre personnalisé (ex: "Organisateur")

**Relations:**

- `convention`: Convention
- `user`: User
- `addedBy`: User
- `perEditionPermissions`: EditionCollaboratorPermission[]

#### **EditionCollaboratorPermission**

Permissions ciblées par édition pour collaborateurs.

**Champs:**

- `canEdit`: Modifier cette édition
- `canDelete`: Supprimer cette édition
- `canManageVolunteers`: Gérer bénévoles de cette édition

#### **Edition**

Représente un événement spécifique (une occurrence de convention).

**Champs principaux:**

- `id`, `name`, `description`, `program`
- `startDate`, `endDate`
- Adresse complète: `addressLine1`, `city`, `country`, `postalCode`, `region`
- `latitude`, `longitude`: Géolocalisation
- `imageUrl`, `ticketingUrl`, `officialWebsiteUrl`
- URLs sociales: `facebookUrl`, `instagramUrl`

**Services disponibles (booléens):**

- Hébergement: `hasTentCamping`, `hasTruckCamping`, `hasFamilyCamping`, `hasSleepingRoom`
- Activités: `hasWorkshops`, `hasOpenStage`, `hasGala`, `hasConcert`, `hasFireSpace`
- Espaces: `hasGym`, `hasKidsZone`, `hasAerialSpace`, `hasSlacklineSpace`
- Services: `hasFoodTrucks`, `hasCantine`, `hasShowers`, `hasToilets`, `hasATM`
- Accessibilité: `hasAccessibility`, `acceptsPets`
- Paiements: `hasCashPayment`, `hasCreditCardPayment`, `hasAfjTokenPayment`

**Bénévolat:**

- `volunteersMode`: INTERNAL | EXTERNAL
- `volunteersOpen`: Accepte candidatures
- `volunteersDescription`, `volunteersExternalUrl`
- Configuration formulaire (booléens): `volunteersAsk*` (Diet, Allergies, TimePreferences, etc.)
- Périodes setup/teardown: `volunteersSetupStartDate`, `volunteersTeardownEndDate`

**Relations:**

- `convention`: Convention
- `creator`: User
- `favoritedBy`: User[] (many-to-many)
- `attendingUsers`: User[] (many-to-many)
- `volunteerApplications`: EditionVolunteerApplication[]
- `volunteerTeams`: VolunteerTeam[]
- `volunteerTimeSlots`: VolunteerTimeSlot[]
- `carpoolOffers`: CarpoolOffer[]
- `carpoolRequests`: CarpoolRequest[]
- `editionPosts`: EditionPost[]
- `lostFoundItems`: LostFoundItem[]
- `externalTicketing`: ExternalTicketing
- `tiers`: TicketingTier[]
- `options`: TicketingOption[]
- `orders`: TicketingOrder[]

#### **EditionVolunteerApplication**

Candidature bénévole avec formulaire riche.

**Champs:**

- `status`: PENDING | ACCEPTED | REJECTED
- `motivation`, `acceptanceNote`
- Informations diet: `dietaryPreference` (NONE, VEGETARIAN, VEGAN)
- Allergies: `allergies`, `allergySeverity` (LIGHT, MODERATE, SEVERE, CRITICAL)
- Préférences: `timePreferences`, `teamPreferences` (JSON)
- Informations optionnelles: `hasPets`, `hasMinors`, `hasVehicle`, `companionName`, `avoidList`, `skills`
- Expérience: `hasExperience`, `experienceDetails`
- Disponibilités: `setupAvailability`, `teardownAvailability`, `eventAvailability`
- Arrivée/Départ: `arrivalDateTime`, `departureDateTime`
- Contact urgence: `emergencyContactName`, `emergencyContactPhone`
- Validation entrée: `entryValidated`, `entryValidatedAt`, `entryValidatedBy`
- `userSnapshotPhone`: Copie du téléphone utilisateur

**Relations:**

- `edition`: Edition
- `user`: User
- `teamAssignments`: ApplicationTeamAssignment[]

#### **VolunteerTeam**

Équipe de bénévoles (ex: Bar, Cuisine, Accueil).

**Champs:**

- `name`, `description`, `color` (#hex)
- `maxVolunteers`: Capacité maximale
- `isRequired`: Équipe obligatoire
- `isAccessControlTeam`: Équipe de contrôle d'accès

**Relations:**

- `edition`: Edition
- `timeSlots`: VolunteerTimeSlot[]
- `assignedApplications`: ApplicationTeamAssignment[]

#### **VolunteerTimeSlot**

Créneau horaire pour planning bénévoles.

**Champs:**

- `title`, `description`
- `startDateTime`, `endDateTime`
- `maxVolunteers`, `assignedVolunteers`
- `teamId`: Équipe associée (nullable)

**Relations:**

- `edition`: Edition
- `team`: VolunteerTeam (optional)
- `assignments`: VolunteerAssignment[]

#### **VolunteerAssignment**

Assignation d'un bénévole à un créneau.

**Relations:**

- `timeSlot`: VolunteerTimeSlot
- `user`: User (assigné)
- `assignedBy`: User (qui a assigné)

#### **CarpoolOffer**

Offre de covoiturage.

**Champs:**

- `tripDate`, `locationCity`, `locationAddress`
- `availableSeats`, `direction`: TO_EVENT | FROM_EVENT
- `description`, `phoneNumber`
- Préférences: `smokingAllowed`, `petsAllowed`, `musicAllowed`

**Relations:**

- `edition`: Edition
- `user`: User (conducteur)
- `bookings`: CarpoolBooking[]
- `passengers`: CarpoolPassenger[]
- `comments`: CarpoolComment[]

#### **CarpoolRequest**

Demande de covoiturage.

**Champs similaires à CarpoolOffer:**

- `seatsNeeded` au lieu de `availableSeats`

#### **CarpoolBooking**

Réservation de place en covoiturage.

**Champs:**

- `seats`: Nombre de places réservées
- `message`: Message au conducteur
- `status`: PENDING | ACCEPTED | REJECTED | CANCELLED

#### **ExternalTicketing**

Configuration billetterie externe (HelloAsso, etc.).

**Champs:**

- `provider`: HELLOASSO | BILLETWEB | WEEZEVENT | OTHER
- `status`: ACTIVE | INACTIVE | ERROR
- `lastSyncAt`

**Relations:**

- `edition`: Edition (one-to-one)
- `helloAssoConfig`: HelloAssoConfig
- `tiers`: TicketingTier[]
- `options`: TicketingOption[]
- `orders`: TicketingOrder[]

#### **HelloAssoConfig**

Configuration HelloAsso spécifique.

**Champs:**

- `clientId`, `clientSecret` (chiffré)
- `organizationSlug`, `formType`, `formSlug`

#### **TicketingTier**

Tarif de billetterie.

**Champs:**

- `helloAssoTierId`: ID dans HelloAsso (nullable si manuel)
- `name`, `description`, `price` (centimes)
- `minAmount`, `maxAmount`: Pour tarifs libres
- `isActive`, `position`: Ordre affichage

**Relations:**

- `externalTicketing`: ExternalTicketing (nullable)
- `edition`: Edition
- `quotas`: TicketingTierQuota[]
- `returnableItems`: TicketingTierReturnableItem[]
- `orderItems`: TicketingOrderItem[]

#### **TicketingOption**

Option de billetterie (champ personnalisé).

**Champs:**

- `helloAssoOptionId`: ID dans HelloAsso
- `name`, `description`
- `type`: TextInput | CheckBox | Select | etc.
- `isRequired`, `choices` (JSON)
- `position`

#### **TicketingQuota**

Quota de places (ex: "100 places camping").

**Champs:**

- `title`, `description`, `quantity`

**Relations:**

- `tiers`: TicketingTierQuota[]
- `options`: TicketingOptionQuota[]

#### **TicketingReturnableItem**

Objet consigné (ex: gobelets, draps).

**Relations:**

- `tiers`: TicketingTierReturnableItem[]
- `options`: TicketingOptionReturnableItem[]
- `volunteerTicketingReturnableItems`: EditionVolunteerReturnableItem[]

#### **TicketingOrder**

Commande de billetterie.

**Champs:**

- `helloAssoOrderId`: ID dans HelloAsso
- Payeur: `payerFirstName`, `payerLastName`, `payerEmail`
- `amount`: Montant total (centimes)
- `status`: Processed | Refunded | etc.
- `orderDate`

**Relations:**

- `edition`: Edition
- `externalTicketing`: ExternalTicketing
- `items`: TicketingOrderItem[]

#### **TicketingOrderItem**

Item de commande (participant).

**Champs:**

- `helloAssoItemId`, `tierId`
- Participant: `firstName`, `lastName`, `email`
- Détails: `name`, `type`, `amount`, `state`
- `qrCode`: Pour contrôle d'accès
- `customFields`: Réponses aux options (JSON)
- Validation entrée: `entryValidated`, `entryValidatedAt`, `entryValidatedBy`

#### **EditionPost**

Message dans le forum d'édition.

**Champs:**

- `content`, `pinned`

**Relations:**

- `edition`: Edition
- `user`: User
- `comments`: EditionPostComment[]

#### **LostFoundItem**

Objet perdu/trouvé.

**Champs:**

- `description`, `imageUrl`
- `status`: LOST | RETURNED

**Relations:**

- `edition`: Edition
- `user`: User
- `comments`: LostFoundComment[]

#### **Notification**

Notification utilisateur.

**Champs:**

- `type`: INFO | SUCCESS | WARNING | ERROR
- `title`, `message`
- Métadonnées: `category`, `entityType`, `entityId`
- `isRead`, `readAt`
- Actions: `actionUrl`, `actionText`

**Relations:**

- `user`: User

#### **PushSubscription**

Abonnement aux notifications push (Web Push API).

**Champs:**

- `endpoint`, `p256dh`, `auth`: Clés VAPID
- `isActive`

#### **VolunteerNotificationGroup**

Groupe de notifications envoyées aux bénévoles.

**Champs:**

- `title`, `message`
- `targetType`: "all" | "teams"
- `selectedTeams` (JSON)
- `recipientCount`

**Relations:**

- `edition`: Edition
- `sender`: User
- `confirmations`: VolunteerNotificationConfirmation[]

#### **Feedback**

Retour utilisateur (bug, suggestion).

**Champs:**

- `type`: BUG | SUGGESTION | GENERAL | COMPLAINT
- `subject`, `message`
- `email`, `name` (anonyme possible)
- `userAgent`, `url`: Contexte technique
- `resolved`, `adminNotes`

#### **ApiErrorLog**

Log d'erreur API structuré.

**Champs:**

- `message`, `statusCode`, `stack`, `errorType`
- Contexte: `method`, `url`, `path`, `userAgent`, `ip`, `referer`
- Données: `headers`, `body`, `queryParams` (JSON, sanitisés)
- `userId`
- Admin: `resolved`, `resolvedBy`, `resolvedAt`, `adminNotes`

#### **PasswordResetToken**

Token de réinitialisation de mot de passe.

**Champs:**

- `token`, `expiresAt`, `used`

#### **ConventionClaimRequest**

Demande de revendication de convention.

**Champs:**

- `code`: Code de vérification (envoyé par email)
- `expiresAt`, `isVerified`, `verifiedAt`

#### **CollaboratorPermissionHistory**

Historique des modifications de permissions.

**Champs:**

- `changeType`: CREATED | RIGHTS_UPDATED | PER_EDITIONS_UPDATED | ARCHIVED | UNARCHIVED | REMOVED
- `before`, `after` (JSON)
- `actorId`, `targetUserId`

---

## 5. Endpoints API Principaux

### Authentification (`/api/auth/*`)

| Méthode | Route                          | Description                          | Public |
| ------- | ------------------------------ | ------------------------------------ | ------ |
| POST    | `/auth/register`               | Inscription utilisateur              | ✅     |
| POST    | `/auth/login`                  | Connexion                            | ✅     |
| POST    | `/auth/logout`                 | Déconnexion                          | ✅     |
| POST    | `/auth/verify-email`           | Vérification email (code 6 chiffres) | ✅     |
| POST    | `/auth/resend-verification`    | Renvoyer code vérification           | ✅     |
| POST    | `/auth/request-password-reset` | Demander reset password              | ✅     |
| GET     | `/auth/verify-reset-token`     | Vérifier token reset                 | ✅     |
| POST    | `/auth/reset-password`         | Réinitialiser password               | ✅     |
| POST    | `/auth/check-email`            | Vérifier si email existe             | ✅     |

### Session (`/api/session/*`)

| Méthode | Route         | Description                | Authentification |
| ------- | ------------- | -------------------------- | ---------------- |
| GET     | `/session/me` | Récupérer session courante | ✅               |

### Profil (`/api/profile/*`)

| Méthode | Route                               | Description                 |
| ------- | ----------------------------------- | --------------------------- |
| PUT     | `/profile/update`                   | Mettre à jour profil        |
| POST    | `/profile/change-password`          | Changer mot de passe        |
| DELETE  | `/profile/delete-picture`           | Supprimer photo de profil   |
| GET     | `/profile/stats`                    | Statistiques utilisateur    |
| GET     | `/profile/notification-preferences` | Préférences notifications   |
| PUT     | `/profile/notification-preferences` | Mettre à jour préférences   |
| GET     | `/profile/has-password`             | Vérifier si password défini |
| GET     | `/profile/auth-info`                | Infos authentification      |

### Conventions (`/api/conventions/*`)

| Méthode | Route                                                   | Description                 | Public |
| ------- | ------------------------------------------------------- | --------------------------- | ------ |
| GET     | `/conventions`                                          | Liste conventions           | ✅     |
| POST    | `/conventions`                                          | Créer convention            | ❌     |
| GET     | `/conventions/:id`                                      | Détail convention           | ✅     |
| PUT     | `/conventions/:id`                                      | Modifier convention         | ❌     |
| DELETE  | `/conventions/:id/delete-image`                         | Supprimer image             | ❌     |
| GET     | `/conventions/:id/editions`                             | Éditions d'une convention   | ✅     |
| GET     | `/conventions/:id/collaborators`                        | Liste collaborateurs        | ❌     |
| POST    | `/conventions/:id/collaborators`                        | Ajouter collaborateur       | ❌     |
| PATCH   | `/conventions/:id/collaborators/:collaboratorId/rights` | Modifier droits             | ❌     |
| DELETE  | `/conventions/:id/collaborators/:collaboratorId`        | Retirer collaborateur       | ❌     |
| GET     | `/conventions/:id/collaborators/history`                | Historique permissions      | ❌     |
| POST    | `/conventions/:id/claim`                                | Revendiquer convention      | ❌     |
| POST    | `/conventions/:id/claim/verify`                         | Vérifier code revendication | ❌     |

### Éditions (`/api/editions/*`)

| Méthode | Route                 | Description              | Public |
| ------- | --------------------- | ------------------------ | ------ |
| GET     | `/editions`           | Liste éditions (filtres) | ✅     |
| POST    | `/editions`           | Créer édition            | ❌     |
| GET     | `/editions/favorites` | Mes favoris              | ❌     |
| GET     | `/editions/:id`       | Détail édition           | ✅     |
| PUT     | `/editions/:id`       | Modifier édition         | ❌     |
| DELETE  | `/editions/:id`       | Supprimer édition        | ❌     |

### Covoiturage - Offres (`/api/editions/:id/carpool-offers`, `/api/carpool-offers/*`)

| Méthode | Route                                     | Description          | Public |
| ------- | ----------------------------------------- | -------------------- | ------ |
| GET     | `/editions/:id/carpool-offers`            | Liste offres édition | ✅     |
| POST    | `/editions/:id/carpool-offers`            | Créer offre          | ❌     |
| PUT     | `/carpool-offers/:id`                     | Modifier offre       | ❌     |
| DELETE  | `/carpool-offers/:id`                     | Supprimer offre      | ❌     |
| GET     | `/carpool-offers/:id/comments`            | Commentaires offre   | ✅     |
| POST    | `/carpool-offers/:id/comments`            | Ajouter commentaire  | ❌     |
| GET     | `/carpool-offers/:id/bookings`            | Réservations offre   | ❌     |
| POST    | `/carpool-offers/:id/bookings`            | Réserver place       | ❌     |
| PUT     | `/carpool-offers/:id/bookings/:bookingId` | Accepter/refuser     | ❌     |
| POST    | `/carpool-offers/:id/passengers`          | Ajouter passager     | ❌     |
| DELETE  | `/carpool-offers/:id/passengers/:userId`  | Retirer passager     | ❌     |

### Covoiturage - Demandes (`/api/editions/:id/carpool-requests`, `/api/carpool-requests/*`)

| Méthode | Route                            | Description         | Public |
| ------- | -------------------------------- | ------------------- | ------ |
| GET     | `/editions/:id/carpool-requests` | Liste demandes      | ✅     |
| POST    | `/editions/:id/carpool-requests` | Créer demande       | ❌     |
| PUT     | `/carpool-requests/:id`          | Modifier demande    | ❌     |
| DELETE  | `/carpool-requests/:id`          | Supprimer demande   | ❌     |
| GET     | `/carpool-requests/:id/comments` | Commentaires        | ✅     |
| POST    | `/carpool-requests/:id/comments` | Ajouter commentaire | ❌     |

### Bénévolat - Candidatures (`/api/editions/:id/volunteers/*`)

| Méthode | Route                                                                | Description               |
| ------- | -------------------------------------------------------------------- | ------------------------- |
| GET     | `/editions/:id/volunteers/info`                                      | Infos bénévolat (public)  |
| GET     | `/editions/:id/volunteers/settings`                                  | Paramètres formulaire     |
| POST    | `/editions/:id/volunteers/applications`                              | Candidater                |
| GET     | `/editions/:id/volunteers/applications`                              | Liste candidatures (orga) |
| GET     | `/editions/:id/volunteers/applications/my`                           | Ma candidature            |
| PUT     | `/editions/:id/volunteers/applications/:applicationId`               | Modifier candidature      |
| PATCH   | `/editions/:id/volunteers/applications/:applicationId`               | Accepter/Refuser          |
| DELETE  | `/editions/:id/volunteers/applications/:applicationId`               | Supprimer                 |
| POST    | `/editions/:id/volunteers/applications/:applicationId/teams/:teamId` | Assigner équipe           |
| DELETE  | `/editions/:id/volunteers/applications/:applicationId/teams/:teamId` | Retirer équipe            |

### Bénévolat - Équipes (`/api/editions/:id/volunteers/teams/*`)

| Méthode | Route                                    | Description      |
| ------- | ---------------------------------------- | ---------------- |
| GET     | `/editions/:id/volunteers/teams`         | Liste équipes    |
| POST    | `/editions/:id/volunteers/teams`         | Créer équipe     |
| PUT     | `/editions/:id/volunteers/teams/:teamId` | Modifier équipe  |
| DELETE  | `/editions/:id/volunteers/teams/:teamId` | Supprimer équipe |

### Bénévolat - Planning (`/api/editions/:id/volunteer-time-slots/*`)

| Méthode | Route                                                                  | Description         |
| ------- | ---------------------------------------------------------------------- | ------------------- |
| GET     | `/editions/:id/volunteer-time-slots`                                   | Liste créneaux      |
| POST    | `/editions/:id/volunteer-time-slots`                                   | Créer créneau       |
| PUT     | `/editions/:id/volunteer-time-slots/:slotId`                           | Modifier créneau    |
| DELETE  | `/editions/:id/volunteer-time-slots/:slotId`                           | Supprimer créneau   |
| POST    | `/editions/:id/volunteer-time-slots/:slotId/assignments`               | Assigner bénévole   |
| DELETE  | `/editions/:id/volunteer-time-slots/:slotId/assignments/:assignmentId` | Retirer assignation |

### Bénévolat - Notifications (`/api/editions/:id/volunteers/notification/*`)

| Méthode | Route                                                          | Description          |
| ------- | -------------------------------------------------------------- | -------------------- |
| POST    | `/editions/:id/volunteers/notification`                        | Envoyer notification |
| GET     | `/editions/:id/volunteers/notification/:groupId`               | Détails notification |
| POST    | `/editions/:id/volunteers/notification/:groupId/confirm`       | Confirmer réception  |
| GET     | `/editions/:id/volunteers/notification/:groupId/confirmations` | Liste confirmations  |

### Billetterie Externe (`/api/editions/:id/ticketing/*`)

| Méthode | Route                                                 | Description                |
| ------- | ----------------------------------------------------- | -------------------------- |
| GET     | `/editions/:id/ticketing/external`                    | Config billetterie         |
| POST    | `/editions/:id/ticketing/external`                    | Activer billetterie        |
| PUT     | `/editions/:id/ticketing/external`                    | Modifier config            |
| DELETE  | `/editions/:id/ticketing/external`                    | Désactiver                 |
| POST    | `/editions/:id/ticketing/helloasso/sync`              | Synchroniser HelloAsso     |
| GET     | `/editions/:id/ticketing/tiers`                       | Liste tarifs               |
| POST    | `/editions/:id/ticketing/tiers`                       | Créer tarif manuel         |
| PUT     | `/editions/:id/ticketing/tiers/:tierId`               | Modifier tarif             |
| DELETE  | `/editions/:id/ticketing/tiers/:tierId`               | Supprimer tarif            |
| GET     | `/editions/:id/ticketing/options`                     | Liste options              |
| GET     | `/editions/:id/ticketing/quotas`                      | Liste quotas               |
| POST    | `/editions/:id/ticketing/quotas`                      | Créer quota                |
| PUT     | `/editions/:id/ticketing/quotas/:quotaId`             | Modifier quota             |
| DELETE  | `/editions/:id/ticketing/quotas/:quotaId`             | Supprimer quota            |
| GET     | `/editions/:id/ticketing/returnable-items`            | Objets consignés           |
| POST    | `/editions/:id/ticketing/returnable-items`            | Créer objet                |
| DELETE  | `/editions/:id/ticketing/returnable-items/:itemId`    | Supprimer objet            |
| GET     | `/editions/:id/ticketing/orders`                      | Liste commandes            |
| GET     | `/editions/:id/ticketing/orders/:orderId`             | Détail commande            |
| GET     | `/editions/:id/ticketing/volunteers`                  | Bénévoles avec billets     |
| GET     | `/editions/:id/ticketing/volunteers/returnable-items` | Objets consignés bénévoles |

### Posts & Forum (`/api/editions/:id/posts/*`)

| Méthode | Route                                             | Description           | Public |
| ------- | ------------------------------------------------- | --------------------- | ------ |
| GET     | `/editions/:id/posts`                             | Liste posts           | ✅     |
| POST    | `/editions/:id/posts`                             | Créer post            | ❌     |
| PUT     | `/editions/:id/posts/:postId`                     | Modifier post         | ❌     |
| DELETE  | `/editions/:id/posts/:postId`                     | Supprimer post        | ❌     |
| PATCH   | `/editions/:id/posts/:postId/pin`                 | Épingler/Dépingler    | ❌     |
| GET     | `/editions/:id/posts/:postId/comments`            | Commentaires          | ✅     |
| POST    | `/editions/:id/posts/:postId/comments`            | Ajouter commentaire   | ❌     |
| PUT     | `/editions/:id/posts/:postId/comments/:commentId` | Modifier commentaire  | ❌     |
| DELETE  | `/editions/:id/posts/:postId/comments/:commentId` | Supprimer commentaire | ❌     |

### Objets Perdus/Trouvés (`/api/editions/:id/lost-found/*`)

| Méthode | Route                                       | Description         |
| ------- | ------------------------------------------- | ------------------- |
| GET     | `/editions/:id/lost-found`                  | Liste objets        |
| POST    | `/editions/:id/lost-found`                  | Signaler objet      |
| PUT     | `/editions/:id/lost-found/:itemId`          | Modifier objet      |
| DELETE  | `/editions/:id/lost-found/:itemId`          | Supprimer objet     |
| PATCH   | `/editions/:id/lost-found/:itemId/status`   | Marquer rendu       |
| GET     | `/editions/:id/lost-found/:itemId/comments` | Commentaires        |
| POST    | `/editions/:id/lost-found/:itemId/comments` | Ajouter commentaire |

### Notifications (`/api/notifications/*`)

| Méthode | Route                             | Description             |
| ------- | --------------------------------- | ----------------------- |
| GET     | `/notifications`                  | Liste notifications     |
| GET     | `/notifications/stream`           | Stream SSE (temps réel) |
| GET     | `/notifications/stats`            | Statistiques            |
| PATCH   | `/notifications/:id/read`         | Marquer lue             |
| PATCH   | `/notifications/:id/unread`       | Marquer non lue         |
| PATCH   | `/notifications/mark-all-read`    | Tout marquer lu         |
| DELETE  | `/notifications/:id/delete`       | Supprimer               |
| POST    | `/notifications/push/subscribe`   | S'abonner push          |
| POST    | `/notifications/push/unsubscribe` | Se désabonner           |
| POST    | `/notifications/push/check`       | Vérifier abonnement     |

### Upload de Fichiers (`/api/files/*`)

| Méthode | Route               | Description            |
| ------- | ------------------- | ---------------------- |
| POST    | `/files/convention` | Upload logo convention |
| POST    | `/files/edition`    | Upload image édition   |
| POST    | `/files/profile`    | Upload photo profil    |
| POST    | `/files/lost-found` | Upload image objet     |
| POST    | `/files/generic`    | Upload générique       |

### Administration (`/api/admin/*`)

| Méthode | Route                                 | Description                | Admin |
| ------- | ------------------------------------- | -------------------------- | ----- |
| GET     | `/admin/stats`                        | Statistiques globales      | ✅    |
| GET     | `/admin/activity`                     | Activité récente           | ✅    |
| GET     | `/admin/users`                        | Liste utilisateurs         | ✅    |
| GET     | `/admin/users/:id`                    | Détail utilisateur         | ✅    |
| PUT     | `/admin/users/:id`                    | Modifier utilisateur       | ✅    |
| DELETE  | `/admin/users/:id`                    | Supprimer utilisateur      | ✅    |
| PUT     | `/admin/users/:id/promote`            | Promouvoir admin           | ✅    |
| POST    | `/admin/users/:id/impersonate`        | Impersonnaliser            | ✅    |
| POST    | `/admin/impersonate/stop`             | Arrêter impersonnalisation | ✅    |
| GET     | `/admin/conventions`                  | Liste conventions admin    | ✅    |
| DELETE  | `/admin/conventions/:id`              | Supprimer convention       | ✅    |
| GET     | `/admin/editions/:id/export`          | Exporter édition (PDF)     | ✅    |
| POST    | `/admin/import-edition`               | Importer édition           | ✅    |
| GET     | `/admin/feedback`                     | Liste retours              | ✅    |
| PUT     | `/admin/feedback/:id/resolve`         | Résoudre retour            | ✅    |
| GET     | `/admin/error-logs`                   | Logs d'erreurs             | ✅    |
| GET     | `/admin/error-logs/:id`               | Détail erreur              | ✅    |
| PATCH   | `/admin/error-logs/:id/resolve`       | Résoudre erreur            | ✅    |
| POST    | `/admin/error-logs/resolve-similar`   | Résoudre similaires        | ✅    |
| GET     | `/admin/notifications/stats`          | Stats notifications        | ✅    |
| GET     | `/admin/notifications/recent`         | Notifications récentes     | ✅    |
| POST    | `/admin/notifications/create`         | Créer notification         | ✅    |
| POST    | `/admin/notifications/send-reminders` | Envoyer rappels            | ✅    |
| GET     | `/admin/notifications/push-stats`     | Stats push                 | ✅    |
| POST    | `/admin/notifications/push-test`      | Test push                  | ✅    |
| POST    | `/admin/backup/create`                | Créer backup DB            | ✅    |
| GET     | `/admin/backup/list`                  | Liste backups              | ✅    |
| GET     | `/admin/backup/download`              | Télécharger backup         | ✅    |
| POST    | `/admin/backup/restore`               | Restaurer backup           | ✅    |
| DELETE  | `/admin/backup/delete`                | Supprimer backup           | ✅    |
| GET     | `/admin/tasks`                        | Liste tâches Nitro         | ✅    |
| POST    | `/admin/tasks/:taskName`              | Exécuter tâche             | ✅    |

### Utilitaires

| Méthode | Route                   | Description              | Public |
| ------- | ----------------------- | ------------------------ | ------ |
| GET     | `/countries`            | Liste des pays           | ✅     |
| GET     | `/uploads/[...path]`    | Servir fichiers uploadés | ✅     |
| GET     | `/__sitemap__/editions` | Sitemap éditions (SEO)   | ✅     |
| GET     | `/site.webmanifest`     | Manifest PWA             | ✅     |

---

## 6. Patterns et Pratiques de Développement

### Architecture Pattern: Clean Architecture Simplifiée

#### Séparation des Couches

1. **Presentation Layer** (Frontend - `app/`)
   - Components Vue.js
   - Pages avec routing automatique
   - Composables pour logique réutilisable
   - Stores Pinia pour état global

2. **API Layer** (Backend - `server/api/`)
   - Endpoints RESTful typés
   - Validation des entrées (Zod)
   - Gestion d'erreurs centralisée

3. **Business Logic Layer** (`server/utils/`)
   - Services métier (EmailService, NotificationService, etc.)
   - Permissions et contrôle d'accès
   - Utilitaires métier

4. **Data Access Layer** (`prisma/`)
   - Prisma ORM
   - Schéma de base de données centralisé
   - Migrations versionnées

### Patterns de Code

#### 1. **Composables Pattern** (Vue Composition API)

Organisation de la logique réutilisable sous forme de composables.

**Exemples:**

- `useAuthStore()`: Gestion authentification
- `useDateFormat()`: Formatage dates i18n
- `useVolunteerTeams()`: Logique équipes bénévoles
- `useNotificationStream()`: Notifications temps réel SSE
- `usePushNotifications()`: Web Push API
- `useLeafletMap()`: Intégration Leaflet

**Avantages:**

- Réutilisabilité
- Testabilité
- Séparation des préoccupations
- Auto-import via Nuxt

#### 2. **Repository Pattern** (via Prisma)

Accès aux données centralisé via `server/utils/prisma.ts`.

```typescript
// Singleton Prisma Client
export const prisma = new PrismaClient()
```

#### 3. **Service Pattern**

Services métier encapsulant la logique complexe.

**Services principaux:**

- `EmailService` (`server/utils/emailService.ts`)
  - Envoi emails SMTP
  - Rendu templates Vue Email
  - Mode simulation pour dev
- `NotificationService` (`server/utils/notification-service.ts`)
  - Notifications in-app
  - Server-Sent Events (SSE)
- `PushNotificationService` (`server/utils/push-notification-service.ts`)
  - Web Push API (VAPID)
- `ErrorLogger` (`server/utils/error-logger.ts`)
  - Logging structuré des erreurs
  - Sanitization données sensibles

#### 4. **Permission System Pattern**

Système de permissions granulaires avec vérifications centralisées.

**Fichiers:**

- `server/utils/permissions/convention-permissions.ts`
- `server/utils/permissions/edition-permissions.ts`
- `server/utils/permissions/volunteer-permissions.ts`
- `server/utils/permissions/access-control-permissions.ts`

**Principe:**

- Vérifications côté serveur avant chaque action
- Droits globaux + droits par ressource
- Historique des modifications

#### 5. **Middleware Pattern**

Middlewares pour logique transversale.

**Serveur:**

- `server/middleware/auth.ts`: Authentification & autorisation
  - Routes publiques/privées
  - Hydratation session
  - Protection API

**Client:**

- `app/middleware/auth.ts`: Redirection pages authentifiées
- `app/middleware/admin.ts`: Protection pages admin

#### 6. **Error Handling Pattern**

Gestion d'erreurs centralisée et structurée.

**Composants:**

- `ErrorLogger` pour logging API
- Toast notifications pour erreurs utilisateur
- Pages d'erreur personnalisées (Nuxt error handling)
- Sanitization automatique des données sensibles

#### 7. **Validation Pattern** (Zod)

Validation de schémas TypeScript-first.

```typescript
// server/utils/validation-schemas.ts
import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  pseudo: z.string().min(3),
})
```

#### 8. **Type-Safe API Pattern**

Types partagés entre frontend et backend.

**Fichiers:**

- `app/types/index.d.ts`: Types globaux
- Prisma génère types automatiquement
- Inférence TypeScript pour API routes

#### 9. **SSR/SSG Pattern** (Nuxt)

- Server-Side Rendering pour SEO
- Static Generation pour pages statiques
- Hydration côté client
- API routes servies par Nitro

#### 10. **Internationalization Pattern**

Support multilingue avec @nuxtjs/i18n.

**Caractéristiques:**

- 11 langues supportées
- Détection automatique navigateur
- Fichiers JSON par locale
- Helpers de traduction i18n

---

## 7. Sécurité & Authentification

### Système d'Authentification

#### Sessions Scellées (Sealed Sessions)

Utilisation de **nuxt-auth-utils** avec cookies de session sécurisés.

**Avantages:**

- Pas de JWT côté client (plus sécurisé)
- Sessions scellées cryptographiquement
- Rotation automatique de sessions
- Protection CSRF intégrée

**Configuration:**

- `NUXT_SESSION_PASSWORD`: Clé de chiffrement (32+ caractères)
- Sessions stockées côté serveur
- Cookie HttpOnly + Secure en production

#### Vérification Email

- Code à 6 chiffres envoyé par email
- Expiration après 15 minutes
- Possibilité de renvoyer le code
- Utilisateurs non vérifiés ont accès limité

#### Réinitialisation Mot de Passe

- Token unique généré
- Envoi par email
- Expiration après 1 heure
- Token à usage unique

#### Hachage Mots de Passe

- **bcryptjs** avec salt rounds
- Mots de passe jamais stockés en clair

### Permissions & Contrôle d'Accès

#### Système de Permissions Collaborateurs

Modèle granulaire à deux niveaux:

1. **Droits Globaux** (ConventionCollaborator)
   - `canEditConvention`
   - `canDeleteConvention`
   - `canManageCollaborators`
   - `canAddEdition`
   - `canEditAllEditions`
   - `canDeleteAllEditions`
   - `canManageVolunteers`

2. **Droits par Édition** (EditionCollaboratorPermission)
   - `canEdit`: Édition spécifique
   - `canDelete`: Édition spécifique
   - `canManageVolunteers`: Édition spécifique

**Format API:**

```json
{
  "id": 42,
  "title": "Organisateur",
  "rights": { "editConvention": true, "addEdition": true },
  "perEdition": [{ "editionId": 10, "canEdit": true }]
}
```

#### Historique des Permissions

Table `CollaboratorPermissionHistory` pour audit complet:

- Type de changement (CREATED, RIGHTS_UPDATED, REMOVED, etc.)
- État avant/après (JSON)
- Acteur et cible
- Horodatage

#### Protection des Routes

**Middleware serveur** (`server/middleware/auth.ts`):

- Routes publiques: GET conventions/éditions, auth endpoints
- Routes authentifiées: Tout le reste
- Vérification session automatique

**Middleware client** (`app/middleware/auth.ts`):

- Redirection vers login si non authentifié
- Conservation de `returnTo` pour redirection post-login

#### Rate Limiting

`server/utils/rate-limiter.ts` et `api-rate-limiter.ts`

- Protection contre brute force
- Limites par IP et par utilisateur

### Sécurité des Données

#### Sanitization

- **rehype-sanitize**: HTML user-generated content
- Suppression données sensibles dans logs d'erreurs
- Validation entrées avec Zod

#### Chiffrement

`server/utils/encryption.ts`

- Chiffrement données sensibles (ex: `clientSecret` HelloAsso)
- Algorithmes modernes (AES)

#### Upload de Fichiers

- Validation type MIME
- Limitation taille
- Nommage sécurisé
- Storage séparé (`public/uploads/`)

#### Protection CSRF

- Intégré via nuxt-auth-utils
- Tokens automatiques pour formulaires

#### Headers de Sécurité

Configurés via Nitro:

- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security (HSTS)

---

## 8. Tests

### Configuration Vitest Multi-Projets

Le projet utilise **Vitest** avec 4 types de tests distincts:

#### 1. Tests Unitaires (`test/unit/`)

- **Environnement**: happy-dom
- **Cible**: Composables, stores, utilitaires isolés
- **Exemple**: `test/unit/composables/`, `test/unit/utils/`
- **Commande**: `npm run test:unit`

#### 2. Tests Nuxt (`test/nuxt/`)

- **Environnement**: nuxt (avec @nuxt/test-utils)
- **Cible**: Composants Vue, pages, API endpoints avec contexte Nuxt
- **Caractéristiques**:
  - SSR testing
  - Auto-imports disponibles
  - Mocking Prisma
- **Exemple**: `test/nuxt/components/`, `test/nuxt/server/api/`
- **Commande**: `npm run test:nuxt`

#### 3. Tests d'Intégration (`test/integration/`)

- **Environnement**: node
- **Cible**: Workflows complets avec base de données réelle
- **Caractéristiques**:
  - Base de données MySQL de test
  - Docker Compose (`docker-compose.test-integration.yml`)
  - Tests séquentiels (pas de parallélisation)
- **Exemple**:
  - `auth.db.test.ts`: Flux d'authentification
  - `conventions.db.test.ts`: CRUD conventions
  - `collaborators.chain.db.test.ts`: Permissions collaborateurs
  - `volunteers.workflow.db.test.ts`: Workflow bénévolat
- **Commande**: `TEST_WITH_DB=true npm run test:db`

#### 4. Tests E2E (`test/e2e/`)

- **Environnement**: nuxt (serveur démarré)
- **Cible**: Tests end-to-end complets
- **Timeout**: 60s
- **Commande**: `npm run test:e2e`

### Scripts de Test

```json
{
  "test": "vitest --project unit",
  "test:unit": "vitest --project unit",
  "test:unit:run": "vitest run --project unit --silent",
  "test:nuxt": "vitest --project nuxt --silent",
  "test:nuxt:run": "vitest run --project nuxt --silent",
  "test:e2e": "vitest --project e2e",
  "test:e2e:run": "vitest run --project e2e --silent",
  "test:db": "cross-env TEST_WITH_DB=true vitest run --project integration",
  "test:all": "npm run test:unit:run && npm run test:nuxt:run && npm run test:e2e:run"
}
```

### Couverture de Tests

**Domaines testés:**

- ✅ Authentification (register, login, verify-email, password reset)
- ✅ CRUD Conventions & Éditions
- ✅ Système de permissions collaborateurs
- ✅ Workflow bénévolat (candidature, acceptation, assignation)
- ✅ API endpoints critiques
- ✅ Composants UI principaux
- ✅ Utilitaires (date, avatar, countries, etc.)
- ✅ Stores Pinia

### Outils de Test

- **@testing-library/vue**: Test utilities React-like pour Vue
- **@vue/test-utils**: Utilitaires officiels Vue
- **happy-dom**: DOM léger pour tests unitaires
- **@nuxt/test-utils**: Helpers spécifiques Nuxt

### Configuration Docker pour Tests

#### Test Integration

```yaml
# docker-compose.test-integration.yml
services:
  test-db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: testroot
      MYSQL_DATABASE: convention_test
```

### CI/CD (GitHub Actions)

**Workflow** (`.github/workflows/tests.yml`):

- Déclenchement: push, pull_request
- Jobs:
  - Lint (ESLint)
  - Tests unitaires
  - Tests Nuxt
  - Tests d'intégration (avec MySQL)
- Environnement: Node 22.x

---

## 9. Internationalisation (i18n)

### Langues Supportées

11 langues disponibles:

- 🇬🇧 **Anglais (en)** - Langue par défaut
- 🇫🇷 **Français (fr)**
- 🇩🇪 **Allemand (de)**
- 🇪🇸 **Espagnol (es)**
- 🇮🇹 **Italien (it)**
- 🇳🇱 **Néerlandais (nl)**
- 🇵🇱 **Polonais (pl)**
- 🇵🇹 **Portugais (pt)**
- 🇷🇺 **Russe (ru)**
- 🇺🇦 **Ukrainien (uk)**
- 🇩🇰 **Danois (da)**

### Configuration

**Fichiers de traduction**: `i18n/locales/{lang}.json`

**Stratégie**: `no_prefix`

- Pas de préfixe dans URLs (ex: `/` au lieu de `/en/`)
- Détection automatique langue navigateur
- Cookie `i18n_redirected` pour persistance

**Compilation optimisée:**

- Composition-only mode
- Messages compilés
- Tree-shaking pour réduire bundle size

### Utilisation

**Dans composants Vue:**

```vue
<template>
  <h1>{{ $t('home.welcome') }}</h1>
  <p>{{ $t('home.description', { count: 42 }) }}</p>
</template>

<script setup>
const { t, locale, setLocale } = useI18n()
</script>
```

**Dans API/Server:**

```typescript
// Utilisation de l'en-tête Accept-Language
const locale = event.node.req.headers['accept-language']
```

### Scripts i18n

- `npm run check-i18n`: Analyse clés manquantes/inutilisées/dupliquées
- `npm run check-translations`: Compare traductions entre locales
- `npm run i18n:add`: Ajouter une traduction

### Préférence Utilisateur

Les utilisateurs peuvent définir leur langue préférée dans leur profil:

- Champ `User.preferredLanguage`
- Synchronisation automatique à la connexion
- Override de la détection automatique

---

## 10. Fonctionnalités Avancées

### 1. Système de Notifications

#### Notifications In-App

**Caractéristiques:**

- Table `Notification` en base de données
- Types: INFO, SUCCESS, WARNING, ERROR
- États: lu/non lu
- Actions cliquables avec `actionUrl`
- Métadonnées pour contexte

**Stream Temps Réel (SSE):**

- Endpoint: `GET /api/notifications/stream`
- Server-Sent Events pour mises à jour live
- Composable: `useNotificationStream()`
- Gestion automatique reconnexion

#### Notifications Push (Web Push API)

**Caractéristiques:**

- Support VAPID (Voluntary Application Server Identification)
- Abonnements stockés dans `PushSubscription`
- Service Worker pour réception
- Composable: `usePushNotifications()`

**Configuration:**

- `NUXT_PUBLIC_VAPID_PUBLIC_KEY`: Clé publique VAPID
- Variable privée serveur pour clé privée

#### Centre de Notifications

Composant: `NotificationsCenter.vue`

- Badge compteur non lues
- Liste déroulante
- Marquer tout comme lu
- Navigation vers ressource associée

### 2. Système de Billetterie (HelloAsso)

#### Intégration HelloAsso

**Configuration:**

- OAuth2 HelloAsso
- `HelloAssoConfig`: `clientId`, `clientSecret` (chiffré)
- Synchronisation bidirectionnelle

**Entités:**

- **Tarifs** (`TicketingTier`): Tarifs HelloAsso ou manuels
- **Options** (`TicketingOption`): Champs personnalisés
- **Commandes** (`TicketingOrder`): Commandes importées
- **Participants** (`TicketingOrderItem`): Items de commande

#### Quotas de Places

`TicketingQuota`: Gestion de quotas (ex: "100 places camping")

- Association aux tarifs via `TicketingTierQuota`
- Association aux options via `TicketingOptionQuota`
- Calcul automatique places restantes

#### Objets Consignés

`TicketingReturnableItem`: Gobelets, draps, etc.

- Association aux tarifs/options
- Suivi consignation bénévoles

#### QR Codes & Contrôle d'Accès

- Génération QR Code par participant
- Page de scan: `editions/[id]/gestion/ticketing/access-control.vue`
- Validation entrée avec `entryValidated`, `entryValidatedAt`
- Support équipes de contrôle d'accès (bénévoles)

### 3. Gestion Bénévoles Avancée

#### Formulaire de Candidature Configurable

Édition définit quels champs demander:

- `volunteersAskDiet`, `volunteersAskAllergies`
- `volunteersAskTimePreferences`, `volunteersAskTeamPreferences`
- `volunteersAskPets`, `volunteersAskMinors`, `volunteersAskVehicle`
- `volunteersAskCompanion`, `volunteersAskAvoidList`
- `volunteersAskSkills`, `volunteersAskExperience`
- `volunteersAskEmergencyContact`
- `volunteersAskSetup`, `volunteersAskTeardown`

#### Planning FullCalendar

**Composant**: `VolunteerTimeSlot` + FullCalendar

- Vue timeline avec ressources (équipes)
- Drag & drop pour assignation
- Gestion conflits horaires
- Export PDF/ICS

**Plugins FullCalendar utilisés:**

- `@fullcalendar/resource-timeline`: Planning avec équipes
- `@fullcalendar/interaction`: Interactions
- `@fullcalendar/vue3`: Intégration Vue

#### Équipes de Bénévoles

`VolunteerTeam`:

- Nom, couleur, description
- Capacité maximale (`maxVolunteers`)
- Équipe requise (`isRequired`)
- Équipe de contrôle d'accès (`isAccessControlTeam`)

**Assignation:**

- `ApplicationTeamAssignment`: Association candidature ↔ équipe
- Chefs d'équipe via `isLeader`

#### Notifications de Groupe

`VolunteerNotificationGroup`:

- Envoi notifications à tous les bénévoles ou par équipes
- Confirmations de lecture: `VolunteerNotificationConfirmation`
- Page de confirmation publique par code unique

#### Catering (Restauration Bénévoles)

- Suivi repas par bénévole
- Calcul besoins par type de régime
- Export pour traiteur

### 4. Système de Covoiturage

#### Offres de Covoiturage

`CarpoolOffer`:

- Direction: `TO_EVENT` (aller) | `FROM_EVENT` (retour)
- Places disponibles, date, lieu départ
- Préférences: fumeur, animaux, musique
- Système de réservation avec statuts
- Commentaires

#### Demandes de Covoiturage

`CarpoolRequest`:

- Direction, nombre de places recherchées
- Commentaires pour discussions

#### Réservations

`CarpoolBooking`:

- Statuts: PENDING, ACCEPTED, REJECTED, CANCELLED
- Gestion par le conducteur
- Notifications automatiques

#### Passagers Confirmés

`CarpoolPassenger`:

- Liste des passagers acceptés
- Affichage numéro de téléphone après acceptation

### 5. Objets Perdus/Trouvés

`LostFoundItem`:

- Description, photo
- Statuts: LOST, RETURNED
- Système de commentaires pour discussions
- Filtres par édition

### 6. Forum par Édition

`EditionPost`:

- Messages publics liés à une édition
- Système de commentaires (`EditionPostComment`)
- Posts épinglés (`pinned`)
- Pagination

### 7. Géolocalisation & Cartes

#### Géocodage Automatique

Service: `server/utils/geocoding.ts`

- API Nominatim (OpenStreetMap)
- Stratégie de fallback pour maximiser succès
- Script batch: `npm run geocode`

#### Cartes Leaflet

Composable: `useLeafletMap()`

- Affichage éditions sur carte
- Marqueurs colorés par statut (passé/en cours/à venir)
- Popups avec infos édition
- Clustering pour performances

**Pages avec cartes:**

- Page d'accueil (éditions filtrées)
- Page favoris (mes favoris à venir)

### 8. Backup & Restore Base de Données

**Page admin**: `/admin/backup`

**Fonctionnalités:**

- Création backup manuel
- Liste backups disponibles
- Téléchargement backup
- Restauration depuis backup
- Suppression backups anciens

**Implémentation:**

- Export MySQL via `mysqldump`
- Compression gzip
- Storage dans `/backups/`
- Restauration via `mysql` CLI

### 9. Impersonnalisation (Admin)

**Fonctionnalité:**

- Admins globaux peuvent se connecter "en tant que" un utilisateur
- Session temporaire avec indication visuelle
- Retour à sa propre session
- Audit des impersonnalisations

**Endpoints:**

- `POST /api/admin/users/:id/impersonate`: Démarrer
- `POST /api/admin/impersonate/stop`: Arrêter

### 10. Logs d'Erreurs Structurés

`ApiErrorLog`:

- Capture automatique erreurs API
- Contexte complet (requête, user, stack)
- Sanitization données sensibles
- Interface admin pour résolution
- Résolution en masse d'erreurs similaires

**Page admin**: `/admin/error-logs`

### 11. Système de Feedback

`Feedback`:

- Types: BUG, SUGGESTION, GENERAL, COMPLAINT
- Formulaire public (authentifié ou anonyme)
- Capture contexte (URL, user agent)
- Résolution par admins avec notes

**Page publique**: Feedback via modal accessible partout
**Page admin**: `/admin/feedback`

### 12. Revendication de Conventions

**Scénario**: Conventions importées sans propriétaire

**Workflow:**

1. Utilisateur demande revendication: `POST /api/conventions/:id/claim`
2. Code envoyé à l'email de la convention
3. Vérification code: `POST /api/conventions/:id/claim/verify`
4. Si valide: utilisateur devient collaborateur avec tous les droits

**Table**: `ConventionClaimRequest`

### 13. SEO & Open Graph

#### Sitemap XML

- Génération automatique
- Endpoint dédié: `GET /api/__sitemap__/editions`
- Inclut éditions publiques
- Mise à jour dynamique

#### Open Graph Images

- Génération automatique via `@nuxtjs/seo`
- Images OG par page
- Meta tags dynamiques

#### Schema.org

- Données structurées pour événements
- Rich snippets Google

#### Robots.txt

- Configuration par environnement
- Blocage staging/release

### 14. PWA (Progressive Web App)

**Fonctionnalités:**

- Web App Manifest (`/api/site.webmanifest`)
- Icônes multi-tailles (`/favicons/`)
- Installation sur mobile/desktop
- Bannière d'installation: `PWAInstallBanner.vue`

### 15. Tâches Planifiées (Cron)

**Implémentation**: node-cron + Nitro Tasks

**Tâches:**

- Nettoyage tokens expirés: `scripts/clean-expired-tokens.ts`
- Rappels notifications
- Synchronisation HelloAsso (si configuré)

**Configuration**: `CRON_SYSTEM.md`

**Interface admin**: `/admin/crons`

### 16. Mode Dark

**Implémentation:**

- `UColorModeSwitch` (Nuxt UI)
- Persistance préférence utilisateur
- Support `prefers-color-scheme`
- Classes Tailwind: `dark:`

---

## 11. Docker & Déploiement

### Configurations Docker

#### 1. Développement (`docker-compose.dev.yml`)

**Services:**

- `app`: Application Nuxt en mode dev (hot reload)
- `db`: MySQL 8.0
- Volumes pour persistence et hot reload

**Commandes:**

```bash
npm run docker:dev           # Démarrer
npm run docker:dev:down      # Arrêter
npm run docker:dev:logs      # Logs temps réel
npm run docker:dev:exec      # Shell dans le conteneur
```

#### 2. Production (`docker-compose.prod.yml`)

**Caractéristiques:**

- Build production optimisé
- MySQL en production
- Health checks
- Restart policies

#### 3. Release/Staging (`docker-compose.release.yml`)

Configuration intermédiaire pour tests pré-production.

#### 4. Tests

**Test Unitaires** (`docker-compose.test-simple.yml`):

```bash
npm run docker:test:unit
npm run docker:test:unit:clean
```

**Tests d'Intégration** (`docker-compose.test-integration.yml`):

```bash
npm run docker:test:integration
npm run docker:test:integration:clean
```

**Tous les Tests** (`docker-compose.test-all.yml`):

```bash
npm run docker:test
npm run docker:test:clean
```

**Tests avec UI** (`docker-compose.test-ui.yml`):

```bash
npm run docker:test:ui
npm run docker:test:ui:clean
```

### Images Docker

#### Dockerfile Principal

**Multi-stage build:**

1. **deps**: Installation dépendances
2. **builder**: Build Nuxt production
3. **runner**: Image finale légère

**Optimisations:**

- Node Alpine pour petite taille
- Prisma binaries optimisés
- Cache layers Docker

#### Dockerfile.dev

Build optimisé pour développement:

- Hot reload
- Source maps
- Debugging

### Variables d'Environnement

**Fichiers:**

- `.env` (local, gitignored)
- `.env.example` (template)
- `.env.docker.example` (Docker)
- `.env.portainer.example` (Portainer/Swarm)

**Variables critiques:**

```env
# Database
DATABASE_URL="mysql://user:password@host:port/database"

# Auth
NUXT_SESSION_PASSWORD="32+ chars secret"

# Emails
SEND_EMAILS=true
SMTP_USER="email@example.com"
SMTP_PASS="app_password"

# VAPID (Push Notifications)
NUXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."

# reCAPTCHA (optionnel)
NUXT_PUBLIC_RECAPTCHA_SITE_KEY="..."
NUXT_RECAPTCHA_SECRET_KEY="..."

# Site
NUXT_PUBLIC_SITE_URL="https://example.com"
```

### Déploiement Production

#### Option 1: Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

#### Option 2: Kubernetes/Swarm

Utiliser les images buildées + configurations d'orchestration.

#### Option 3: Plateforme Cloud

- **Vercel**: Support Nuxt natif
- **Netlify**: Adapter Netlify
- **Railway/Render**: Support Docker
- **VPS**: Docker Compose ou PM2

### Base de Données Production

#### Migrations

```bash
# Appliquer migrations
npx prisma migrate deploy

# Générer client Prisma
npx prisma generate
```

#### Backup

- Script automatique dans l'application (`/admin/backup`)
- Ou via cron externe avec `mysqldump`

#### Stratégie Zero-Downtime

- Migrations compatibles backwards
- Rollback plan pour chaque migration
- Tests d'intégration avant déploiement

---

## 12. Scripts Utilitaires

### Scripts NPM Principaux

```json
{
  "dev": "nuxt dev",
  "build": "NODE_OPTIONS='--max-old-space-size=4096' nuxt build",
  "preview": "nuxt preview",
  "postinstall": "nuxt prepare",

  "lint": "[ -d .nuxt ] || npx nuxt prepare; eslint .",
  "lint:fix": "[ -d .nuxt ] || npx nuxt prepare; eslint . --fix",
  "format": "prettier -w \"**/*.{js,ts,vue,json,md,yml,yaml}\"",
  "format:check": "prettier -c \"**/*.{js,ts,vue,json,md,yml,yaml}\"",

  "geocode": "node scripts/run-geocoding.mjs",
  "db:clean-tokens": "npx tsx scripts/clean-expired-tokens.ts",

  "admin:add": "npx tsx scripts/manage-admin.ts add",
  "admin:remove": "npx tsx scripts/manage-admin.ts remove",
  "admin:list": "npx tsx scripts/manage-admin.ts list",

  "check-i18n": "node scripts/check-i18n.js",
  "check-translations": "node scripts/check-i18n-translations.js",
  "i18n:add": "node scripts/add-translation.js",

  "db:seed:dev": "npx tsx scripts/seed-dev.ts",
  "db:seed:password": "npx tsx scripts/list-seed-accounts.ts",
  "db:reset:dev": "npx prisma migrate reset --force --skip-seed",

  "favicons": "tsx scripts/generate-favicons.ts"
}
```

### Scripts Personnalisés (`scripts/`)

#### `run-geocoding.mjs`

Géocodage batch de toutes les éditions sans coordonnées.

- Stratégie de fallback
- Rate limiting respectueux
- Logging des échecs

#### `manage-admin.ts`

CLI pour gestion des admins globaux.

```bash
npm run admin:add        # Promouvoir utilisateur
npm run admin:remove     # Révoquer droits admin
npm run admin:list       # Lister admins
```

#### `clean-expired-tokens.ts`

Nettoyage automatique des tokens expirés:

- Tokens de vérification email
- Tokens de reset password
- Tokens de revendication

#### `check-i18n.js`

Analyse des fichiers de traduction:

- Clés manquantes
- Clés inutilisées
- Clés dupliquées
- Textes hardcodés (détection)

#### `check-i18n-translations.js`

Compare traductions entre locales.

#### `add-translation.js`

Assistant interactif pour ajouter une traduction.

#### `seed-dev.ts`

Peuple la base de données de développement:

- Utilisateurs de test
- Conventions et éditions d'exemple
- Collaborateurs
- Bénévoles

#### `list-seed-accounts.ts`

Liste comptes créés par le seed.

#### `generate-favicons.ts`

Génère favicons multi-tailles depuis SVG source.

#### `kill-servers.js`

Tue les serveurs Nuxt/Nitro orphelins.

---

## 13. Diagramme d'Architecture Visuel

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Vue/Nuxt)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │   Pages      │  │  Components  │  │  Composables │  │   Stores     ││
│  │  (Routing)   │  │    (UI)      │  │   (Logic)    │  │   (Pinia)    ││
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘│
│         │                 │                 │                 │         │
│         └─────────────────┴─────────────────┴─────────────────┘         │
│                                   │                                      │
│                                   │ $fetch / useFetch                   │
│                                   ▼                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                           MIDDLEWARE LAYER                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌───────────────────┐          ┌───────────────────┐                   │
│  │  Client Middleware│          │  Server Middleware│                   │
│  │  (auth, admin)    │          │  (auth.ts)        │                   │
│  └───────────────────┘          └───────────────────┘                   │
│                                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                          API LAYER (Nitro)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                       API Routes (/api/*)                          │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  /auth/*  │ /conventions/* │ /editions/* │ /notifications/* │ ... │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                   │                                      │
│                                   ▼                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                         BUSINESS LOGIC LAYER                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Services   │  │ Permissions │  │   Utils     │  │   Email     │   │
│  │  (Notif,    │  │  System     │  │ (Geocoding, │  │  Service    │   │
│  │   Push)     │  │             │  │  Crypto)    │  │             │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                   │                                      │
│                                   ▼                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                          DATA ACCESS LAYER                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│                          ┌───────────────┐                               │
│                          │  Prisma ORM   │                               │
│                          └───────┬───────┘                               │
│                                  │                                       │
│                                  ▼                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                            DATABASE LAYER                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│                          ┌───────────────┐                               │
│                          │   MySQL 8.0   │                               │
│                          │   (Prisma)    │                               │
│                          └───────────────┘                               │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        SERVICES EXTERNES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  SMTP       │  │ HelloAsso   │  │ Nominatim   │  │ Web Push    │   │
│  │  (Emails)   │  │ (Ticketing) │  │ (Geocoding) │  │ (VAPID)     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUX DE DONNÉES                                 │
└─────────────────────────────────────────────────────────────────────────┘

Requête Utilisateur
       │
       ▼
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │ HTTP Request
       ▼
┌──────────────────────┐
│  Nuxt SSR/Client     │ ◄──── 1. Render initial (SSR)
│  + Vue Router        │ ◄──── 2. Hydration
└──────┬───────────────┘
       │ $fetch()
       ▼
┌──────────────────────┐
│  API Middleware      │ ◄──── 3. Authentification
│  (auth.ts)           │ ◄──── 4. Vérification permissions
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  API Handler         │ ◄──── 5. Validation (Zod)
│  (/api/*/route.ts)   │ ◄──── 6. Business logic
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Service Layer       │ ◄──── 7. Permissions check
│  (utils/)            │ ◄──── 8. Email/Notif envoi
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Prisma Client       │ ◄──── 9. Requête SQL
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│     MySQL            │ ◄──── 10. CRUD opérations
└──────┬───────────────┘
       │
       │ Response
       ▼
┌──────────────────────┐
│  JSON Response       │ ◄──── 11. Serialization
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Vue Component       │ ◄──── 12. Réactivité Vue
│  Update              │ ◄──── 13. Re-render
└──────────────────────┘
```

---

## 14. Insights & Recommandations

### Points Forts du Projet

#### 1. **Architecture Moderne & Scalable**

✅ Stack technologique à jour (Nuxt 4, Vue 3, Prisma)
✅ Séparation claire des préoccupations
✅ TypeScript end-to-end pour sécurité des types
✅ SSR pour SEO + hydration pour interactivité

#### 2. **Système de Permissions Granulaire**

✅ Droits globaux + par ressource
✅ Historique complet des modifications
✅ API normalisée facile à consommer
✅ Modèle flexible et extensible

#### 3. **Tests Complets**

✅ 4 types de tests (unit, nuxt, e2e, integration)
✅ Configuration Vitest multi-projets
✅ Tests avec base de données réelle
✅ CI/CD GitHub Actions

#### 4. **Internationalisation Complète**

✅ 11 langues supportées
✅ Détection automatique
✅ Compilation optimisée
✅ Préférence par utilisateur

#### 5. **Fonctionnalités Riches**

✅ Bénévolat avec planning FullCalendar
✅ Billetterie HelloAsso intégrée
✅ Covoiturage complet
✅ Notifications temps réel (SSE + Push)
✅ Géolocalisation et cartes

#### 6. **Sécurité Robuste**

✅ Sessions scellées (nuxt-auth-utils)
✅ Hachage bcrypt
✅ Rate limiting
✅ Sanitization HTML
✅ Chiffrement données sensibles
✅ Logs d'erreurs structurés

#### 7. **DevOps & Déploiement**

✅ Docker multi-environnements
✅ Scripts automatisés
✅ Backup/Restore intégré
✅ Migrations versionnées

### Points à Améliorer

#### 1. **Performance**

**Observation:**

- Bundle size potentiellement important (FullCalendar, Leaflet)
- Beaucoup de dépendances

**Recommandations:**

- ✅ Déjà fait: `serverBundle: 'remote'` pour icônes
- ✅ Déjà fait: Lazy hydration expérimentale
- 🔧 **À faire:**
  - Code splitting plus agressif
  - Lazy loading de FullCalendar (uniquement pages planning)
  - Lazy loading de Leaflet (uniquement pages cartes)
  - Analyser bundle avec `nuxt build --analyze`
  - Cache HTTP agressif pour assets statiques
  - CDN pour images uploadées

#### 2. **Tests E2E**

**Observation:**

- Tests E2E présents mais peu développés
- Pas d'outil dédié (Playwright, Cypress)

**Recommandations:**

- Implémenter Playwright pour tests E2E robustes
- Tester workflows critiques:
  - Inscription → Vérification → Login → Création convention
  - Workflow bénévolat complet
  - Processus covoiturage
  - Billetterie HelloAsso

#### 3. **Documentation API**

**Observation:**

- Pas de documentation OpenAPI/Swagger
- Documentation dans fichiers Markdown séparés

**Recommandations:**

- Générer documentation OpenAPI automatique
- Utiliser `@nuxt/content` pour docs interactives
- Swagger UI pour tester API en développement

#### 4. **Monitoring & Observabilité**

**Observation:**

- Logs d'erreurs structurés ✅
- Pas de monitoring temps réel en production

**Recommandations:**

- Intégrer Sentry pour error tracking
- Logs structurés avec Winston/Pino
- Métriques avec Prometheus
- APM (Application Performance Monitoring)
- Uptime monitoring

#### 5. **Rate Limiting Avancé**

**Observation:**

- Rate limiting basique présent
- Pas de protection DDoS avancée

**Recommandations:**

- Implémenter Redis pour rate limiting distribué
- Rate limiting par endpoint sensible
- CAPTCHA sur formulaires publics (déjà prévu: reCAPTCHA)
- IP whitelisting pour admin

#### 6. **Gestion des Images**

**Observation:**

- Sharp utilisé pour traitement
- Pas de CDN

**Recommandations:**

- Intégrer Cloudinary ou ImageKit
- Générer thumbnails multiples tailles
- WebP + fallback
- Lazy loading images
- Progressive image loading (LQIP)

#### 7. **Accessibilité (A11y)**

**Observation:**

- Nuxt UI basé sur Headless UI (accessible)
- Pas de tests d'accessibilité automatisés

**Recommandations:**

- Tests a11y avec Axe ou Pa11y
- Tester navigation clavier
- Screen reader testing
- ARIA labels complets
- Focus management (modales, notifications)

#### 8. **Base de Données**

**Observation:**

- MySQL 8.0 ✅
- Pas de réplication
- Backups manuels

**Recommandations:**

- Réplication master-slave pour HA
- Backups automatiques quotidiens
- Point-in-time recovery
- Monitoring queries lentes
- Index optimization (Prisma Insights)

#### 9. **Search & Filtering**

**Observation:**

- Filtres basiques sur éditions
- Pas de recherche full-text

**Recommandations:**

- Full-text search MySQL ou PostgreSQL
- Ou Algolia/Meilisearch pour search avancé
- Filtres avancés (services, dates, localisation)
- Recherche géographique (rayon)

#### 10. **Notifications**

**Observation:**

- SSE + Push notifications ✅
- Pas de support mobile natif

**Recommandations:**

- Firebase Cloud Messaging pour mobile
- Email notifications configurable par utilisateur
- Résumé quotidien/hebdomadaire
- Notifications Slack/Discord (webhooks pour orgas)

### Évolutions Futures Possibles

#### Fonctionnalités Métier

1. **Marketplace de Services**
   - Orgas peuvent proposer services (impression badges, etc.)
   - Artistes peuvent proposer workshops

2. **Système de Billetterie Interne**
   - Alternative à HelloAsso
   - Stripe Connect pour paiements
   - Gestion complète dans l'app

3. **App Mobile Native**
   - React Native ou Flutter
   - Notifications push natives
   - Mode offline

4. **Messagerie Interne**
   - Chat organisateurs ↔ bénévoles
   - Chat covoiturage
   - Notifications temps réel

5. **Statistiques & Analytics**
   - Dashboard analytics pour organisateurs
   - Taux de remplissage
   - Origine participants (géo)
   - Conversion bénévoles

6. **Intégrations Supplémentaires**
   - Google Calendar export
   - iCal feeds
   - Zapier/Make webhooks
   - Autres plateformes billetterie (Weezevent, Billetweb)

7. **Gamification**
   - Badges pour bénévoles récurrents
   - Système de points
   - Leaderboard

8. **Système de Reviews**
   - Avis sur conventions
   - Notation organisateurs
   - Galerie photos participantes

#### Améliorations Techniques

1. **Migration PostgreSQL**
   - Meilleur support JSON
   - Full-text search natif
   - Performances

2. **GraphQL API**
   - Alternative REST
   - Requêtes optimisées
   - Typed queries

3. **Microservices**
   - Service notifications séparé
   - Service emails séparé
   - Service media (images) séparé

4. **Queue System**
   - BullMQ ou RabbitMQ
   - Jobs asynchrones (emails, sync HelloAsso)
   - Retry logic

5. **Caching Strategy**
   - Redis pour sessions
   - Cache API responses
   - Cache full-page pour pages publiques

### Qualité du Code

#### Points Positifs

✅ **TypeScript strict**: Typage end-to-end
✅ **ESLint configuré**: Règles cohérentes
✅ **Prettier**: Formatage automatique
✅ **Composables pattern**: Code réutilisable
✅ **Service pattern**: Logique métier isolée
✅ **Permissions centralisées**: Pas de duplication

#### Points d'Attention

⚠️ **Commentaires**: Commentaires en français ET anglais mélangés

- **Recommandation**: Standardiser langue (anglais pour code, français pour docs métier)

⚠️ **Taille des fichiers**: Certains composants/pages volumineux

- **Recommandation**: Extraire sous-composants, respecter SRP (Single Responsibility)

⚠️ **Tests coverage**: Non mesurée

- **Recommandation**: Ajouter Istanbul/c8 pour coverage reporting

⚠️ **Documentation inline**: Manque de JSDoc sur fonctions complexes

- **Recommandation**: Ajouter JSDoc pour fonctions publiques

### Sécurité

#### Bonne Pratiques Appliquées

✅ Sessions scellées (pas JWT client)
✅ Hachage mots de passe (bcrypt)
✅ Sanitization HTML (rehype-sanitize)
✅ Rate limiting
✅ HTTPS enforced (production)
✅ HttpOnly cookies
✅ CSRF protection (via nuxt-auth-utils)
✅ SQL injection protection (Prisma)
✅ XSS protection (sanitization)

#### À Améliorer

🔒 **Audit de Sécurité**

- Audit tiers recommandé avant production
- Pentesting

🔒 **Secrets Management**

- Utiliser Vault ou AWS Secrets Manager
- Rotation automatique secrets

🔒 **2FA (Two-Factor Authentication)**

- Ajouter TOTP pour utilisateurs
- Obligatoire pour admins

🔒 **API Rate Limiting Avancé**

- Rate limiting distribué (Redis)
- Throttling par endpoint

🔒 **Content Security Policy (CSP)**

- Headers CSP stricts
- Nonce pour inline scripts

---

## 15. Métriques du Projet

### Taille du Projet

- **Total fichiers**: 9378
- **Fichiers de code**: 2077
- **Taille**: 114 MB
- **Lignes de code** (estimation): 50 000+

### Dépendances

- **Dependencies**: 58
- **DevDependencies**: 16
- **Total**: 74 packages

### Base de Données

- **Tables**: 39 modèles Prisma
- **Relations**: ~100+ (many-to-many, one-to-many)
- **Migrations**: 30+

### API

- **Endpoints publics**: ~30
- **Endpoints authentifiés**: ~150+
- **Total**: ~180 endpoints

### Tests

- **Fichiers de test**: ~100+
- **Types de tests**: 4 (unit, nuxt, integration, e2e)

### Internationalisation

- **Langues**: 11
- **Clés de traduction** (estimation): 500+

### Documentation

- **Fichiers Markdown**: 16 (dans `docs/`)
- **README**: Oui, complet
- **CLAUDE.md**: Instructions Claude Code

---

## 16. Conclusion

### Résumé Exécutif

Le projet **Convention de Jonglerie** est une **application web full-stack moderne et complète** dédiée à la gestion d'événements de jonglerie. Elle se distingue par:

1. **Architecture Technique Solide**
   - Stack moderne (Nuxt 4, Vue 3, TypeScript, Prisma)
   - Séparation claire des couches
   - Tests complets (unit, integration, e2e)
   - Docker multi-environnements

2. **Fonctionnalités Riches**
   - Gestion collaborative de conventions avec permissions granulaires
   - Système de bénévolat avancé (planning FullCalendar, équipes, notifications)
   - Billetterie externe intégrée (HelloAsso) avec QR codes
   - Covoiturage complet
   - Géolocalisation et cartes
   - Notifications temps réel (SSE + Web Push)
   - Objets perdus/trouvés
   - Forum par édition

3. **Sécurité & Qualité**
   - Sessions scellées (nuxt-auth-utils)
   - Permissions granulaires avec audit
   - Hachage bcrypt, sanitization HTML
   - Rate limiting, logs d'erreurs structurés
   - Tests d'intégration avec base de données

4. **Internationalisation**
   - 11 langues supportées
   - Détection automatique
   - Préférence par utilisateur

5. **DevOps Mature**
   - CI/CD GitHub Actions
   - Docker multi-env (dev, test, prod, release)
   - Backup/Restore DB intégré
   - Scripts utilitaires nombreux

### Positionnement

Ce projet représente un **excellent exemple d'application Nuxt 4 enterprise-grade** avec:

- Architecture scalable
- Code maintenable
- Fonctionnalités métier complexes bien implémentées
- Attention portée à l'UX (i18n, notifications, cartes)
- DevOps solide

### Prêt pour Production ?

**Oui, avec quelques améliorations recommandées:**

✅ **Prêt:**

- Fonctionnalités core complètes et testées
- Sécurité de base robuste
- Docker production prêt
- Migrations Prisma versionnées

⚠️ **À compléter avant production:**

- Monitoring & observabilité (Sentry, logs agrégés)
- CDN pour assets statiques
- Backups automatiques quotidiens
- Audit de sécurité externe
- Tests E2E complets (Playwright)
- Documentation API (OpenAPI)

### Maintenance & Évolution

Le projet est **bien structuré pour maintenance long terme**:

- Code modulaire et découplé
- Tests facilitent refactoring
- TypeScript prévient regressions
- Documentation technique complète
- Scripts utilitaires pour tâches courantes

Les évolutions futures sont **faciles à intégrer**:

- Architecture extensible
- Permissions système flexible
- API RESTful cohérente
- Composables réutilisables

---

## Annexes

### A. Ressources & Liens Utiles

**Documentation Officielle:**

- [Nuxt 4](https://nuxt.com/docs/4.x)
- [Nuxt UI](https://ui.nuxt.com)
- [Prisma](https://www.prisma.io/docs)
- [Vue 3](https://vuejs.org)
- [Pinia](https://pinia.vuejs.org)
- [Vitest](https://vitest.dev)
- [FullCalendar](https://fullcalendar.io)

**Documentation Projet:**

- `docs/AUTH_SESSIONS.md`: Authentification
- `docs/COLLABORATOR_PERMISSIONS.md`: Permissions
- `docs/NOTIFICATION_SYSTEM.md`: Notifications
- `docs/ERROR_LOGGING_SYSTEM.md`: Logs erreurs
- `docs/helloasso-integration.md`: Billetterie
- `docs/backup-system.md`: Backup/Restore
- `CLAUDE.md`: Instructions Claude Code

### B. Glossaire

- **SSR**: Server-Side Rendering
- **SSG**: Static Site Generation
- **ORM**: Object-Relational Mapping
- **CRUD**: Create, Read, Update, Delete
- **VAPID**: Voluntary Application Server Identification (Web Push)
- **SSE**: Server-Sent Events
- **PWA**: Progressive Web App
- **SEO**: Search Engine Optimization
- **CSRF**: Cross-Site Request Forgery
- **XSS**: Cross-Site Scripting
- **A11y**: Accessibility
- **i18n**: Internationalization
- **CI/CD**: Continuous Integration/Continuous Deployment

### C. Contacts & Support

**Issues GitHub:**
[https://github.com/[username]/convention-de-jonglerie/issues](https://github.com/[username]/convention-de-jonglerie/issues)

**Documentation:**
Voir fichiers dans `/docs/`

**Claude Code:**
Utiliser commandes slash personnalisées dans `.claude/commands/`

---

**Rapport généré automatiquement par Claude Code**
**Date:** 2025-10-15
**Version de l'application:** Basée sur analyse du code source
**Analyseur:** Claude Sonnet 4.5

---

_Fin du rapport d'analyse_
