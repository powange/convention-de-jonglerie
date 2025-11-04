# Analyse Complète de la Base de Code - Convention de Jonglerie

## Table des Matières

1. [Vue d'Ensemble du Projet](#1-vue-densemble-du-projet)
2. [Analyse Détaillée de la Structure des Répertoires](#2-analyse-détaillée-de-la-structure-des-répertoires)
3. [Analyse Fichier par Fichier](#3-analyse-fichier-par-fichier)
4. [Analyse des Endpoints API](#4-analyse-des-endpoints-api)
5. [Architecture Approfondie](#5-architecture-approfondie)
6. [Analyse de l'Environnement et Configuration](#6-analyse-de-lenvironnement-et-configuration)
7. [Stack Technologique Détaillée](#7-stack-technologique-détaillée)
8. [Diagrammes d'Architecture](#8-diagrammes-darchitecture)
9. [Insights Clés et Recommandations](#9-insights-clés-et-recommandations)

---

## 1. Vue d'Ensemble du Projet

### Type de Projet

**Application Web Full-Stack** - Plateforme collaborative de gestion et découverte de conventions de jonglerie.

### Description

Convention de Jonglerie est une application web moderne permettant aux organisateurs de créer et gérer des conventions de jonglerie, et aux participants de découvrir, s'inscrire et interagir avec ces événements. L'application offre un système complet de gestion incluant :

- Gestion des conventions et éditions
- Système de collaboration avec permissions granulaires
- Gestion des bénévoles et planning
- Système de billetterie (interne et HelloAsso)
- Covoiturage
- Objets trouvés
- Ateliers et artistes
- Système de notifications temps réel

### Pattern d'Architecture

- **Frontend** : Architecture Nuxt 4 (Vue 3 + TypeScript)
- **Backend** : API RESTful avec Nitro (serveur Nuxt intégré)
- **Base de données** : MySQL avec Prisma ORM
- **Pattern** : MVC moderne avec composition API et stores Pinia
- **Authentification** : Sessions scellées (nuxt-auth-utils)

### Langages et Versions

- **TypeScript** : v5.8.3 (langage principal)
- **Vue.js** : v3.5.17
- **Nuxt.js** : v4.2.0
- **Node.js** : >= 22 < 23 (requirement strict)
- **Prisma** : v6.18.0
- **MySQL** : Compatible avec MySQL 8.x

---

## 2. Analyse Détaillée de la Structure des Répertoires

### `/app` - Application Frontend Nuxt

#### `/app/pages` - Routage et Pages

Structure basée sur le file-system routing de Nuxt :

**Pages Publiques :**

- `index.vue` - Page d'accueil avec liste des éditions
- `login.vue`, `register.vue`, `logout.vue` - Authentification
- `auth/forgot-password.vue`, `auth/reset-password.vue` - Récupération mot de passe
- `verify-email.vue` - Vérification email
- `privacy-policy.vue` - Politique de confidentialité

**Pages Authentifiées :**

- `profile.vue` - Profil utilisateur
- `favorites.vue` - Éditions favorites
- `my-conventions.vue` - Conventions de l'utilisateur
- `my-volunteer-applications.vue` - Candidatures bénévolat
- `notifications.vue` - Centre de notifications

**Pages Conventions :**

- `conventions/add.vue` - Création de convention
- `conventions/[id]/edit.vue` - Édition de convention
- `conventions/[id]/editions/add.vue` - Ajout d'édition

**Pages Éditions :**

- `editions/add.vue` - Ajout édition standalone
- `editions/[id]/index.vue` - Page détail édition
- `editions/[id]/edit.vue` - Édition d'édition
- `editions/[id]/carpool.vue` - Covoiturage
- `editions/[id]/commentaires.vue` - Commentaires
- `editions/[id]/objets-trouves.vue` - Objets trouvés
- `editions/[id]/workshops.vue` - Ateliers
- `editions/[id]/volunteers/index.vue` - Portail bénévoles

**Pages Gestion (Organisateurs) :**

- `editions/[id]/gestion/index.vue` - Dashboard gestion
- `editions/[id]/gestion/volunteers/*` - Gestion bénévoles
- `editions/[id]/gestion/ticketing/*` - Billetterie
- `editions/[id]/gestion/artists/*` - Gestion artistes
- `editions/[id]/gestion/meals/*` - Gestion repas

**Pages Administration :**

- `admin/index.vue` - Dashboard admin
- `admin/users/index.vue`, `admin/users/[id].vue` - Gestion utilisateurs
- `admin/conventions.vue` - Gestion conventions
- `admin/feedback.vue` - Feedbacks utilisateurs
- `admin/error-logs.vue` - Logs d'erreurs
- `admin/notifications.vue` - Notifications système
- `admin/crons.vue` - Tâches planifiées
- `admin/backup.vue` - Sauvegardes
- `admin/import-edition.vue` - Import d'éditions

#### `/app/components` - Composants Vue

Organisation modulaire par fonctionnalité :

**Composants Globaux :**

- `AppHeader.vue`, `AppFooter.vue` - Layout
- `EditionCard.vue` - Carte d'édition (réutilisée partout)
- `HomeMap.vue`, `FavoritesMap.vue` - Cartes Leaflet
- `HomeAgenda.vue` - Calendrier FullCalendar
- `FiltersPanel.vue` - Filtres de recherche
- `AddressAutocomplete.vue` - Autocomplete d'adresses
- `CountryMultiSelect.vue` - Sélection de pays
- `MinimalMarkdownEditor.vue` - Éditeur Markdown

**Composants UI (`/ui`) :**

- `UserAvatar.vue`, `UserDisplay.vue` - Affichage utilisateurs
- `UserDisplayForAdmin.vue` - Affichage admin
- `DateTimePicker.vue` - Sélection date/heure
- `ImageUpload.vue` - Upload d'images
- `ConfirmModal.vue` - Modal de confirmation
- `LazyFullCalendar.vue` - Wrapper FullCalendar lazy
- `SelectLanguage.vue` - Sélection langue
- `LogoJc.vue` - Logo SVG
- `ImpersonationBanner.vue` - Bannière d'usurpation d'identité

**Composants Edition (`/edition`) :**

- `Form.vue` - Formulaire d'édition
- `Header.vue` - En-tête d'édition
- `ParticipantsCard.vue` - Liste participants
- `MyTicketCard.vue` - Billet utilisateur
- `MyArtistCard.vue` - Carte artiste utilisateur

**Composants Carpool (`/edition/carpool`) :**

- `Section.vue` - Section covoiturage
- `OfferForm.vue`, `OfferCard.vue` - Offres
- `RequestForm.vue`, `RequestCard.vue` - Demandes
- `FormBase.vue` - Formulaire base partagé
- `BookingsList.vue` - Liste réservations
- `CommentsModal.vue` - Modal commentaires

**Composants Volunteers (`/edition/volunteer`) :**

- `ApplicationModal.vue` - Modal candidature
- `InternalModeOptions.vue` - Options mode interne
- `AutoAssignmentPanel.vue` - Affectation automatique
- `MySlotsCard.vue`, `MyTeamsCard.vue` - Cartes utilisateur
- `MealsCard.vue` - Carte repas
- `Table.vue` - Tableau bénévoles

**Composants Planning (`/edition/volunteer/planning`) :**

- `PlanningCard.vue` - Carte planning
- `SlotDetailsModal.vue` - Détails créneau
- `VolunteersSummary.vue` - Résumé bénévoles
- `OverlapWarningsAlert.vue` - Alertes chevauchements

**Composants Notifications (`/edition/volunteer/notifications`) :**

- `Manager.vue` - Gestionnaire notifications
- `Index.vue` - Liste notifications
- `History.vue` - Historique
- `Modal.vue` - Modal notification
- `ConfirmationsModal.vue` - Confirmations

**Composants Ticketing (`/ticketing`) :**

- `TiersList.vue`, `TierModal.vue` - Tarifs
- `OptionsList.vue`, `OptionModal.vue` - Options
- `QuotasList.vue` - Quotas
- `ReturnableItemsList.vue` - Objets consignés
- `CustomFieldsList.vue`, `CustomFieldModal.vue` - Champs personnalisés
- `QrCodeScanner.vue` - Scanneur QR
- `ParticipantDetailsModal.vue` - Détails participant
- `TicketingUserInfoSection.vue` - Section info utilisateur
- `TicketingMealsDisplaySection.vue` - Section repas
- `EmailValidationInput.vue` - Input validation email
- `AddParticipantModal.vue` - Ajout participant manuel
- `VolunteerDetailsCard.vue`, `ArtistDetailsCard.vue` - Cartes détails

**Composants Stats (`/ticketing/stats`) :**

- `EntryStatsCard.vue` - Stats entrées
- `QuotaStatsCard.vue` - Stats quotas

**Composants Volunteers globaux (`/volunteers`) :**

- `VolunteerCard.vue` - Carte bénévole
- `ApplicationDetailsModal.vue` - Détails candidature
- `TimeSlotCard.vue` - Carte créneau
- `AddVolunteerModal.vue` - Ajout bénévole
- `MealsModal.vue` - Modal repas
- `QrCodeModal.vue` - QR code bénévole

**Composants Artists (`/artists`) :**

- `ArtistModal.vue` - Modal artiste
- `AccommodationModal.vue` - Hébergement
- `MealsModal.vue` - Repas artiste
- `OrganizerNotesModal.vue` - Notes organisateurs

**Composants Shows (`/shows`) :**

- `ShowModal.vue` - Modal spectacle

**Composants Workshops (`/workshops`) :**

- `ImportFromImageModal.vue` - Import depuis image (IA)

**Composants Convention (`/convention`) :**

- `Form.vue` - Formulaire convention
- `ClaimModal.vue` - Modal réclamation

**Composants Collaborator (`/collaborator`) :**

- `RightsFields.vue` - Champs de droits

**Composants Admin (`/admin`) :**

- `UserDeletionModal.vue` - Suppression utilisateur
- `ProfilePictureUpload.vue` - Upload photo admin
- `ConfigModal.vue` - Configuration système

**Composants Notifications (`/notifications`) :**

- `Center.vue` - Centre de notifications
- `PushNotificationToggle.vue` - Toggle notifications push
- `PushPromoModal.vue` - Promo notifications push

**Composants Management (`/management`) :**

- `NavigationCard.vue` - Navigation gestion

**Composants Feedback (`/feedback`) :**

- `FeedbackModal.vue` - Modal feedback

**Autres :**

- `PWAInstallBanner.vue` - Bannière installation PWA
- `FlagIcon.vue` - Icône de drapeau pays

#### `/app/composables` - Hooks Vue Réutilisables

**Authentification & Autorisation :**

- `useAccessControlPermissions.ts` - Permissions contrôle d'accès
- `useCollaboratorTitle.ts` - Titres collaborateurs

**Dates & Formatage :**

- `useDateFormat.ts` - Formatage dates
- `useDatetime.ts` - Manipulation dates
- `useDateTimePicker.ts` - Picker date/heure
- `useEditionStatus.ts` - Statut édition (passé/en cours/futur)

**Formulaires & UI :**

- `useDebounce.ts` - Debouncing
- `useModal.ts` - Gestion modales
- `useImageUrl.ts` - URLs images
- `useImageLoader.ts` - Chargement images lazy
- `useCarpoolForm.ts` - Formulaire covoiturage
- `usePasswordStrength.ts` - Force mot de passe

**Bénévoles :**

- `useVolunteerSettings.ts` - Paramètres bénévoles
- `useVolunteerTeams.ts` - Équipes
- `useVolunteerTimeSlots.ts` - Créneaux horaires
- `useVolunteerSchedule.ts` - Planning

**Cartes & Calendrier :**

- `useLeafletMap.ts` - Intégration Leaflet
- `useCalendar.ts` - Intégration FullCalendar

**Repas :**

- `useMeals.ts` - Gestion repas

**Notifications :**

- `usePushNotifications.ts` - Notifications push
- `usePushNotificationPromo.ts` - Promotion notifications
- `useNotificationStream.ts` - Stream SSE

**Statistiques :**

- `useProfileStats.ts` - Stats profil
- `useRealtimeStats.ts` - Stats temps réel

**Divers :**

- `useReturnTo.ts` - Retour après login
- `useUserDeletion.ts` - Suppression utilisateur
- `useConventionServices.ts` - Services conventions
- `useI18nNavigation.ts` - Navigation i18n
- `useLazyI18n.ts` - Lazy loading traductions
- `usePWA.ts` - Progressive Web App

#### `/app/middleware` - Middleware de Navigation

- `authenticated.ts` - Nécessite authentification
- `auth-protected.ts` - Protection routes auth
- `guest-only.ts` - Visiteurs uniquement
- `super-admin.ts` - Admin global uniquement
- `verify-email-access.ts` - Vérification email
- `load-translations.global.ts` - Chargement traductions (global)

#### `/app/stores` - Stores Pinia

- `auth.ts` - Authentification et utilisateur
- Autres stores potentiels (éditions, notifications, etc.)

#### `/app/types` - Types TypeScript

Définitions de types pour toute l'application (User, Edition, Convention, etc.)

#### `/app/utils` - Utilitaires Frontend

Fonctions utilitaires partagées côté client

#### `/app/assets` - Assets

- `/css` - Styles globaux (main.css avec Tailwind)
- Autres assets statiques

#### `/app/layouts` - Layouts Nuxt

Layouts de page (default, admin, etc.)

#### `/app/plugins` - Plugins Nuxt

Plugins Vue/Nuxt (i18n, auth, etc.)

---

### `/server` - Backend Nitro

#### `/server/api` - Endpoints API RESTful

**Structure organisée par domaine :**

**`/auth` - Authentification :**

- `register.post.ts` - Inscription
- `login.post.ts` - Connexion
- `logout.post.ts` - Déconnexion
- `verify-email.post.ts` - Vérification email
- `resend-verification.post.ts` - Renvoi code
- `check-email.post.ts` - Vérification existence email
- `reset-password.post.ts` - Réinitialisation mot de passe
- `verify-reset-token.get.ts` - Vérification token reset
- `set-password-and-verify.post.ts` - Définir mot de passe + vérifier

**`/profile` - Profil Utilisateur :**

- `update.put.ts` - Mise à jour profil
- `stats.get.ts` - Statistiques profil
- `change-password.post.ts` - Changement mot de passe
- `has-password.get.ts` - Vérifier si mot de passe défini
- `delete-picture.delete.ts` - Supprimer photo profil
- `auth-info.get.ts` - Infos authentification
- `notification-preferences.get.ts`, `notification-preferences.put.ts` - Préférences notifs

**`/user` - Informations Utilisateur :**

- `volunteer-applications.get.ts` - Candidatures bénévole de l'utilisateur

**`/users` - Recherche Utilisateurs :**

- `search.get.ts` - Recherche utilisateurs (pour collaborateurs)

**`/conventions` - Gestion Conventions :**

- `index.post.ts` - Créer convention
- `my-conventions.get.ts` - Mes conventions
- `[id]/index.get.ts` - Détails convention
- `[id]/index.put.ts` - Modifier convention
- `[id]/index.delete.ts` - Supprimer convention
- `[id]/delete-image.delete.ts` - Supprimer image
- `[id]/archive.patch.ts` - Archiver convention
- `[id]/editions.get.ts` - Éditions d'une convention

**`/conventions/[id]/collaborators` - Collaborateurs :**

- `collaborators.get.ts` - Liste collaborateurs
- `collaborators.post.ts` - Ajouter collaborateur
- `[collaboratorId].put.ts` - Modifier collaborateur
- `[collaboratorId].patch.ts` - Modifier collaborateur (PATCH)
- `[collaboratorId].delete.ts` - Retirer collaborateur
- `[collaboratorId].rights.patch.ts` - Modifier droits
- `history.get.ts` - Historique permissions

**`/conventions/[id]/claim` - Réclamation :**

- `claim.post.ts` - Réclamer convention
- `verify.post.ts` - Vérifier code réclamation

**`/editions` - Gestion Éditions :**

- `add.vue` - Ajouter édition
- `[id]/index.vue` - Détails édition
- `[id]/edit.vue` - Modifier édition

**`/editions/[id]` - Fonctionnalités Édition :**

_Covoiturage :_

- `carpool-offers/*.ts` - Offres covoiturage
- `carpool-requests/*.ts` - Demandes covoiturage

_Objets trouvés :_

- `lost-found/*.ts` - Objets trouvés
- `lost-found/[itemId]/*.ts` - Gestion item

_Posts/Commentaires :_

- `posts/*.ts` - Posts édition
- `posts/[postId]/*.ts` - Gestion post
- `posts/[postId]/comments/*.ts` - Commentaires

_Bénévoles :_

- `volunteers/*.ts` - Gestion bénévoles
- `volunteers/applications/*.ts` - Candidatures
- `volunteers/applications/[applicationId]/*.ts` - Gestion candidature
- `volunteers/applications/[applicationId]/teams/*.ts` - Affectation équipes
- `volunteers/teams/*.ts` - Équipes
- `volunteers/notification/*.ts` - Notifications bénévoles
- `volunteers/notification/[groupId]/*.ts` - Gestion groupe notification
- `volunteers/catering/*.ts` - Restauration bénévoles
- `volunteers/access-control/*.ts` - Contrôle accès

_Planning Bénévoles :_

- `volunteer-teams/*.ts` - Équipes
- `volunteer-time-slots/*.ts` - Créneaux
- `volunteer-time-slots/[slotId]/*.ts` - Gestion créneau
- `volunteer-time-slots/[slotId]/assignments/*.ts` - Affectations

_Billetterie :_

- `ticketing/*.ts` - Configuration billetterie
- `ticketing/tiers/*.ts` - Tarifs
- `ticketing/options/*.ts` - Options
- `ticketing/quotas/*.ts` - Quotas
- `ticketing/returnable-items/*.ts` - Objets consignés
- `ticketing/custom-fields/*.ts` - Champs personnalisés
- `ticketing/orders/*.ts` - Commandes
- `ticketing/volunteers/*.ts` - Bénévoles billetterie
- `ticketing/volunteers/returnable-items/*.ts` - Consignes bénévoles
- `ticketing/external/*.ts` - Billetterie externe
- `ticketing/helloasso/*.ts` - HelloAsso
- `ticketing/access-control/*.ts` - Contrôle accès

_Ateliers :_

- `workshops/*.ts` - Ateliers
- `workshops/[workshopId]/*.ts` - Gestion atelier
- `workshops/locations/*.ts` - Lieux ateliers

_Artistes :_

- `artists/*.ts` - Artistes
- `artists/[artistId]/*.ts` - Gestion artiste

_Spectacles :_

- `shows/*.ts` - Spectacles
- `shows/[showId]/*.ts` - Gestion spectacle

_Repas :_

- `meals/*.ts` - Repas

**`/carpool-offers` - Offres Covoiturage (global) :**

- `[id]/*.ts` - CRUD offre
- `[id]/bookings/*.ts` - Réservations
- `[id]/passengers/*.ts` - Passagers
- `[id]/comments/*.ts` - Commentaires

**`/carpool-requests` - Demandes Covoiturage (global) :**

- `[id]/*.ts` - CRUD demande
- `[id]/comments/*.ts` - Commentaires

**`/notifications` - Notifications :**

- `index.ts` - Liste notifications
- `[id]/*.ts` - Gestion notification
- `push/*.ts` - Notifications push

**`/feedback` - Feedback :**

- `index.post.ts` - Envoyer feedback

**`/files` - Upload Fichiers :**

- `profile.post.ts` - Photo profil
- `convention.post.ts` - Image convention
- `edition.post.ts` - Image édition
- `lost-found.post.ts` - Image objet trouvé
- `generic.post.ts` - Upload générique

**`/admin` - Administration :**

_Utilisateurs :_

- `users/index.get.ts` - Liste utilisateurs
- `users/[id].get.ts`, `.put.ts`, `.delete.ts` - CRUD utilisateur
- `users/[id]/promote.put.ts` - Promouvoir admin
- `users/[id]/impersonate.post.ts` - Usurper identité
- `users/[id]/profile-picture.put.ts` - Photo admin

_Conventions & Éditions :_

- `conventions.get.ts` - Liste conventions
- `conventions/[id].delete.ts` - Supprimer convention (admin)
- `editions/[id]/export.get.ts` - Exporter édition

_Feedback & Logs :_

- `feedback/index.get.ts` - Liste feedbacks
- `feedback/[id]/resolve.put.ts` - Résoudre feedback
- `error-logs/*.ts` - Gestion logs erreurs
- `error-logs/[id]/*.ts` - Détails log
- `error-logs/resolve-similar.post.ts` - Résoudre similaires
- `error-logs/cleanup-old.post.ts` - Nettoyer anciens logs

_Notifications :_

- `notifications/create.post.ts` - Créer notification
- `notifications/send-reminders.post.ts` - Envoyer rappels
- `notifications/test.post.ts`, `test-simple.get.ts` - Tests
- `notifications/stats.get.ts`, `recent.get.ts` - Statistiques
- `notifications/push-test.post.ts`, `push-stats.get.ts` - Push

_Tâches :_

- `tasks/index.get.ts` - Liste tâches cron
- `tasks/[taskName].post.ts` - Exécuter tâche

_Sauvegardes :_

- `backup/create.post.ts` - Créer sauvegarde
- `backup/list.get.ts` - Liste sauvegardes
- `backup/download.get.ts` - Télécharger sauvegarde
- `backup/restore.post.ts` - Restaurer sauvegarde
- `backup/delete.delete.ts` - Supprimer sauvegarde

_Usurpation :_

- `impersonate/stop.post.ts` - Arrêter usurpation

_Divers :_

- `stats.get.ts` - Statistiques globales
- `activity.get.ts` - Activité récente
- `config.get.ts` - Configuration système
- `import-edition.post.ts` - Importer édition
- `assign-meals-volunteers.post.ts` - Affecter repas auto
- `debug-auth.get.ts` - Debug auth
- `fix-session.post.ts` - Corriger session

**`/__sitemap__` - Génération Sitemap :**

- `editions.get.ts` - Éditions pour sitemap
- `carpool.get.ts` - Covoiturage pour sitemap
- `volunteers.get.ts` - Bénévoles pour sitemap

**Autres :**

- `session/me.ts` - Session utilisateur courante
- `countries.get.ts` - Liste pays
- `uploads/[...path].get.ts` - Servir fichiers uploadés
- `site.webmanifest.get.ts` - Manifest PWA

#### `/server/utils` - Utilitaires Backend

**Authentification & Sécurité :**

- `admin-auth.ts` - Vérifications admin
- `auth-utils.ts` - Utilitaires auth
- `jwt.ts` - Gestion JWT
- `encryption.ts` - Chiffrement
- `email-hash.ts` - Hash emails (gravatar)
- `api-rate-limiter.ts` - Rate limiting API
- `rate-limiter.ts` - Rate limiting général

**Permissions :**

- `permissions/permissions.ts` - Système permissions principal
- `permissions/convention-permissions.ts` - Permissions conventions
- `permissions/edition-permissions.ts` - Permissions éditions
- `permissions/volunteer-permissions.ts` - Permissions bénévoles
- `permissions/access-control-permissions.ts` - Contrôle accès
- `permissions/meal-validation-permissions.ts` - Validation repas
- `permissions/workshop-permissions.ts` - Permissions ateliers

**Base de données :**

- `prisma.ts` - Client Prisma singleton

**Email :**

- `emailService.ts` - Service d'envoi d'emails
- `server-i18n.ts` - i18n côté serveur

**Notifications :**

- `notification-service.ts` - Service notifications
- `notification-stream-manager.ts` - Gestionnaire streams SSE
- `notification-preferences.ts` - Préférences notifications
- `push-notification-service.ts` - Notifications push (Web Push)
- `sse-manager.ts` - Server-Sent Events

**Bénévoles :**

- `volunteer-application-diff.ts` - Diff candidatures
- `volunteer-scheduler.ts` - Planification automatique
- `volunteer-meals.ts` - Repas bénévoles
- `editions/volunteers/applications.ts` - Utilitaires candidatures
- `editions/volunteers/teams.ts` - Utilitaires équipes

**Billetterie :**

- `editions/ticketing/helloasso.ts` - Intégration HelloAsso
- `editions/ticketing/tiers.ts` - Utilitaires tarifs
- `editions/ticketing/options.ts` - Utilitaires options
- `editions/ticketing/returnable-items.ts` - Objets consignés
- `editions/ticketing/quota-stats.ts` - Stats quotas
- `editions/ticketing/user-info-update.ts` - MAJ infos utilisateurs
- `ticketing/returnable-items.ts` - Items consignés (général)

**Gestion Collaborateurs :**

- `collaborator-management.ts` - Gestion collaborateurs

**IA :**

- `anthropic.ts` - Intégration Claude (Anthropic)
- `ai-providers.ts` - Providers IA multiples (Anthropic, Ollama, LMStudio)

**Divers :**

- `validation-schemas.ts` - Schémas validation Zod
- `geocoding.ts` - Géocodage adresses
- `date-utils.ts`, `date-helpers.ts` - Manipulation dates
- `image-deletion.ts` - Suppression images
- `move-temp-image.ts` - Déplacement images temporaires
- `error-logger.ts` - Logger erreurs API
- `allergy-severity.ts` - Utilitaire gravité allergies
- `commentsHandler.ts` - Gestion commentaires
- `copy-to-output.ts` - Copie fichiers build

#### `/server/middleware` - Middleware API

Middleware appliqué automatiquement aux requêtes API (CORS, auth, etc.)

#### `/server/emails` - Templates Email

Templates d'emails (Vue Email Components)

#### `/server/routes` - Routes Personnalisées

Routes Nitro non-API (auth OAuth potentiel, etc.)

#### `/server/tasks` - Tâches Cron

Tâches planifiées (nettoyage, notifications, etc.)

---

### `/prisma` - Base de Données

#### `schema.prisma` - Schéma de Base de Données

**Modèles principaux :**

**User** - Utilisateurs

- Authentification (email, pseudo, password, authProvider)
- Profil (nom, prenom, phone, profilePicture, preferredLanguage)
- Vérification email (emailVerificationCode, isEmailVerified)
- Admin (isGlobalAdmin)
- Relations : conventions, collaborations, éditions, feedbacks, notifications, etc.

**Convention** - Conventions de Jonglerie

- Informations de base (name, description, imageUrl)
- Créateur (creatorId → User)
- Relations : éditions, collaborateurs
- Archivage (archivedAt)

**Edition** - Éditions de Conventions

- Informations générales (name, description, program)
- Dates (startDate, endDate, volunteersSetupStartDate, volunteersTeardownEndDate)
- Adresse complète + coordonnées GPS (latitude, longitude)
- Services (nombreux champs boolean : hasCamping, hasKidsZone, etc.)
- Paiements (hasCashPayment, hasCreditCardPayment, hasAfjTokenPayment, hasATM)
- Bénévolat (volunteersMode, volunteersDescription, volunteersOpen, nombreux champs volunteersAsk\*)
- Billetterie (relations tiers, options, quotas, orders)
- Relations : convention, créateur, posts, bénévoles, covoiturage, objets trouvés, ateliers, artistes, spectacles

**ConventionCollaborator** - Collaborateurs

- Système de permissions granulaires (can\*)
- Convention + Utilisateur + Ajouté par
- Titre personnalisé (title)
- Relations : permissions par édition

**EditionCollaboratorPermission** - Permissions par Édition

- canEdit, canDelete pour une édition spécifique
- Permet override des permissions globales

**CollaboratorPermissionHistory** - Historique Permissions

- Traçabilité des changements de permissions
- actorId (qui a fait le changement)
- targetUserId (utilisateur modifié)
- action, details

**Volunteer Models** - Système Bénévoles Complet

- **EditionVolunteerApplication** - Candidatures bénévoles
- **VolunteerTeam** - Équipes de bénévoles
- **VolunteerTimeSlot** - Créneaux horaires
- **VolunteerAssignment** - Affectations bénévoles/créneaux
- **VolunteerNotificationGroup** - Groupes de notifications
- **VolunteerNotificationConfirmation** - Confirmations
- **EditionVolunteerReturnableItem** - Objets consignés bénévoles
- **VolunteerMeal** - Repas bénévoles

**Ticketing Models** - Système de Billetterie

- **TicketingTier** - Tarifs/Catégories
- **TicketingOption** - Options additionnelles
- **TicketingQuota** - Quotas (limites entrées)
- **TicketingReturnableItem** - Objets consignés
- **TicketingOrder** - Commandes
- **TicketingOrderItem** - Items de commande
- **TicketingParticipant** - Participants
- **TicketingTierCustomField** - Champs personnalisés
- **TicketingCustomFieldValue** - Valeurs champs perso
- **ExternalTicketing** - Billetterie externe (HelloAsso)

**Carpool Models** - Covoiturage

- **CarpoolOffer** - Offres covoiturage
- **CarpoolRequest** - Demandes covoiturage
- **CarpoolBooking** - Réservations
- **CarpoolPassenger** - Passagers
- **CarpoolComment** - Commentaires offres
- **CarpoolRequestComment** - Commentaires demandes

**Lost & Found** - Objets Trouvés

- **LostFoundItem** - Items objets trouvés
- **LostFoundComment** - Commentaires

**Posts & Comments** - Forum Édition

- **EditionPost** - Posts
- **EditionPostComment** - Commentaires

**Workshop Models** - Ateliers

- **Workshop** - Ateliers
- **WorkshopLocation** - Lieux ateliers
- **WorkshopFavorite** - Favoris ateliers

**Artist Models** - Artistes

- **EditionArtist** - Artistes par édition
- **ArtistMeal** - Repas artistes

**Show Models** - Spectacles

- **Show** - Spectacles

**Notification Models** - Notifications

- **Notification** - Notifications système
- **PushSubscription** - Abonnements push

**Admin & System** - Administration

- **Feedback** - Feedbacks utilisateurs
- **ApiErrorLog** - Logs erreurs API
- **PasswordResetToken** - Tokens réinitialisation

**Convention Claim** - Réclamation Conventions

- **ConventionClaimRequest** - Demandes de réclamation

#### `/migrations` - Migrations Prisma

Historique des migrations de schéma (40+ migrations)

Migrations récentes notables :

- `20251027115031_add_volunteer_meal_selection` - Sélection repas bénévoles
- `20251028033046_add_meal_returnable_items` - Objets consignés repas
- `20251030080823_add_meal_validation` - Validation repas
- `20251018102803_add_team_id_to_volunteer_returnable_items` - Team ID items
- `20250915010810_make_volunteer_notification_confirmed_at_nullable` - Nullable confirmation

---

### `/i18n` - Internationalisation

#### Structure Lazy Loading

Organisation modulaire par domaine et langue :

**13 Langues Supportées :**

- 🇬🇧 English (en) - Défaut
- 🇫🇷 Français (fr)
- 🇩🇪 Deutsch (de)
- 🇪🇸 Español (es)
- 🇮🇹 Italiano (it)
- 🇳🇱 Nederlands (nl)
- 🇵🇱 Polski (pl)
- 🇵🇹 Português (pt)
- 🇷🇺 Русский (ru)
- 🇸🇪 Svenska (sv)
- 🇨🇿 Čeština (cs)
- 🇩🇰 Dansk (da)
- 🇺🇦 Українська (uk)

**Domaines de Traduction :**

- `common.json` - Commun (navigation, erreurs, boutons)
- `app.json` - Application (pages générales)
- `public.json` - Pages publiques
- `auth.json` - Authentification
- `admin.json` - Administration
- `components.json` - Composants
- `edition.json` - Éditions
- `gestion.json` - Gestion (organisateurs)
- `notifications.json` - Notifications
- `feedback.json` - Feedback
- `ticketing.json` - Billetterie
- `permissions.json` - Permissions
- `artists.json` - Artistes
- `workshops.json` - Ateliers

**Chargement intelligent** : Les traductions sont chargées automatiquement selon les routes (voir `docs/i18n-lazy-loading.md`)

#### Configuration

- `i18n.config.ts` - Configuration Vue I18n
- Scripts de gestion :
  - `npm run check-i18n` - Analyse clés
  - `npm run check-translations` - Compare traductions
  - `npm run i18n:add` - Ajouter traduction
  - `npm run i18n:translate` - Traduction automatique (DeepL)

---

### `/docs` - Documentation

**Documentation complète du projet :**

**Systèmes Principaux :**

- `AUTH_SESSIONS.md` - Système d'authentification par sessions
- `COLLABORATOR_PERMISSIONS.md` - Système de permissions collaborateurs
- `NOTIFICATION_SYSTEM.md` - Système de notifications
- `CRON_SYSTEM.md` - Système de tâches planifiées
- `ERROR_LOGGING_SYSTEM.md` - Système de logs d'erreurs
- `backup-system.md` - Système de sauvegardes

**Billetterie (`/ticketing`) :**

- `README.md` - Vue d'ensemble
- `tiers.md` - Tarifs
- `options.md` - Options
- `quotas.md` - Quotas
- `orders.md` - Commandes
- `returnable-items.md` - Objets consignés
- `external-integration.md` - Intégration externe
- `access-control.md` - Contrôle d'accès

**Bénévoles (`/volunteers`) :**

- `teams-utils.md` - Utilitaires équipes
- `volunteer-application-api-utility.md` - API candidatures
- `volunteer-application-diff-utility.md` - Diff candidatures
- `volunteer-application-edit-mode.md` - Mode édition
- `volunteer-auto-assignment-system.md` - Affectation automatique
- `volunteer-returnable-items-by-team.md` - Items par équipe

**Intégrations & IA :**

- `helloasso-integration.md` - HelloAsso
- `anthropic-integration.md` - Claude (Anthropic)
- `ai-providers-ollama.md` - Ollama
- `ai-providers-lmstudio.md` - LM Studio
- `ai-providers-lmstudio-logs.md` - Logs LM Studio

**i18n :**

- `i18n-lazy-loading.md` - Lazy loading traductions
- `i18n-component-lazy-loading.md` - Lazy loading composants
- `notification-i18n.md` - Notifications i18n
- `notification-i18n-migration-guide.md` - Guide migration
- `guide-traduction-rapide.md` - Guide traduction rapide
- `ajout-langues-sv-cs.md` - Ajout langues

**Performance :**

- `image-loading-cache.md` - Cache images
- `cache-http-assets.md` - Cache assets HTTP
- `lazy-loading-libraries.md` - Lazy loading bibliothèques

**Autres :**

- `allergy-severity-utility.md` - Utilitaire gravité allergies
- `API_PROFILE_STATS.md` - API stats profil
- `ADMIN_AUTH_MIGRATION.md` - Migration auth admin
- `logs-erreur-api-ameliorations.md` - Améliorations logs
- `tests/feedback.md` - Tests feedback

---

### `/test` - Tests

#### Structure Multi-Projets Vitest

**`/test/unit`** - Tests Unitaires

- Tests isolés (composables, utilitaires, stores)
- Environnement : happy-dom
- Exemples :
  - `utils/convention-services.test.ts`
  - `utils/countries.test.ts`
  - `utils/avatar.test.ts`
  - `stores/auth.test.ts` (potentiel)

**`/test/nuxt`** - Tests Nuxt

- Tests avec environnement Nuxt complet
- Environnement : nuxt (@nuxt/test-utils)
- Sous-dossiers :
  - `/pages` - Tests pages
  - `/components` - Tests composants
  - `/server/api` - Tests API
  - `/server/middleware` - Tests middleware
  - `/features` - Tests fonctionnalités complètes

**`/test/integration`** - Tests Intégration

- Tests avec base de données réelle
- Environnement : node
- Fichiers `.db.test.ts`
- Exemples :
  - `auth.db.test.ts`
  - `conventions.db.test.ts`
  - `volunteers.workflow.db.test.ts`
  - `access-control-permissions.db.test.ts`

**`/test/e2e`** - Tests E2E (potentiel)

- Tests end-to-end avec serveur démarré
- Non encore implémentés

**Configuration :**

- `vitest.config.ts` - Configuration multi-projets
- `setup.ts`, `setup-common.ts`, `setup-db.ts` - Setup tests
- `__mocks__/` - Mocks

---

### `/scripts` - Scripts Utilitaires

**Administration :**

- `manage-admin.ts` - Gestion admins (add/remove/list)
- `clean-expired-tokens.ts` - Nettoyage tokens expirés

**i18n :**

- `check-i18n.js` - Vérification clés i18n
- `check-i18n-translations.js` - Vérification traductions
- `check-i18n-variables.cjs` - Vérification variables
- `add-translation.js` - Ajout traductions
- `translate-with-deepl.js` - Traduction automatique DeepL

**Base de données :**

- `seed-dev.ts` - Peupler BDD développement
- `list-seed-accounts.ts` - Lister comptes seeds
- `assign-meals-to-accepted-volunteers.ts` - Affecter repas
- `test-db-run.js` - Lancer tests BDD

**Divers :**

- `run-geocoding.mjs` - Géocodage adresses
- `show-help.mjs` - Aide
- `kill-servers.js` - Tuer serveurs
- `generate-favicons.ts` - Générer favicons
- `reset-deps.sh` - Reset dépendances

**Traduction :**

- `/translation` - Scripts traduction avancés

---

### `/public` - Assets Statiques

**Fichiers servis directement :**

- `/uploads/` - Uploads utilisateurs (images, etc.)
- `/logos/` - Logos
- `/favicons/` - Favicons
- `favicon.ico` - Favicon principal
- Autres assets statiques

---

### `.nuxt` - Dossier Généré Nuxt

**Contenu généré automatiquement :**

- Types TypeScript auto-générés
- Configuration runtime
- Routes auto-générées
- Ne pas modifier manuellement

---

### Configuration Racine

**Fichiers de configuration principaux :**

- `nuxt.config.ts` - Configuration Nuxt (module principal)
- `vitest.config.ts` - Configuration tests
- `package.json` - Dépendances et scripts
- `tsconfig.json` - Configuration TypeScript
- `prisma/schema.prisma` - Schéma BDD
- `.env` - Variables environnement (non versionné)
- `.gitignore` - Fichiers ignorés Git
- `docker-compose.*.yml` - Configurations Docker (dev, prod, test)
- `Dockerfile`, `Dockerfile.dev`, `Dockerfile.test` - Images Docker
- `README.md` - Documentation projet
- `CLAUDE.md` - Instructions Claude Code

---

## 3. Analyse Fichier par Fichier

### Fichiers de Configuration Critiques

#### `nuxt.config.ts`

**Configuration exhaustive de l'application :**

**Modules Principaux :**

```typescript
modules: [
  '@nuxt/eslint', // Linting
  '@nuxt/image', // Optimisation images
  '@nuxt/scripts', // Scripts tiers
  '@nuxt/test-utils/module', // Tests
  '@nuxt/ui', // Composants UI
  '@pinia/nuxt', // State management
  '@prisma/nuxt', // ORM
  'nuxt-auth-utils', // Auth sessions
  '@nuxtjs/i18n', // i18n
  '@vueuse/nuxt', // Composables VueUse
  'nuxt-file-storage', // Stockage fichiers
  '@nuxtjs/seo', // SEO
  'nuxt-qrcode', // QR Codes
]
```

**Configuration i18n Avancée :**

- 13 langues avec lazy loading
- Structure par domaine (common, app, auth, admin, etc.)
- Détection automatique langue navigateur
- Cookie de préférence langue
- Compilation optimisée pour bundles légers

**Configuration SEO :**

- Site : `juggling-convention.com`
- Sitemap automatique avec routes dynamiques
- OpenGraph images
- Schema.org
- Robots.txt dynamique

**Configuration Nitro (Serveur) :**

- Compression Gzip + Brotli
- Cache assets statiques (30 jours)
- Tâches expérimentales (cron)
- Exclusion fichiers tests du build
- External : node-cron

**Configuration Vite :**

- Sourcemaps en dev
- Hot reload Docker (polling Windows)
- Optimisations dynamicImportVarsOptions
- Exclusion node-cron
- Alias Prisma

**Runtime Config :**

```typescript
runtimeConfig: {
  // Privé (serveur uniquement)
  session: { password, maxAge },
  emailEnabled, smtpUser, smtpPass,
  anthropicApiKey,
  aiProvider, ollamaBaseUrl, ollamaModel,
  lmstudioBaseUrl, lmstudioModel,
  recaptchaSecretKey, recaptchaMinScore,

  // Public (client + serveur)
  public: {
    recaptchaSiteKey,
    vapidPublicKey,
    siteUrl,
  }
}
```

**Expérimental :**

- `lazyHydration: true` - Performances
- `emitRouteChunkError: 'automatic'` - Gestion erreurs chunks

#### `vitest.config.ts`

**Configuration Multi-Projets :**

1. **Projet "unit"**
   - Inclut : `test/unit/**/*.test.ts`
   - Environnement : happy-dom
   - Tests rapides, isolés

2. **Projet "nuxt"**
   - Inclut : `test/nuxt/**/*.test.ts`
   - Environnement : nuxt
   - Setup : `test/setup.ts`, `test/setup-common.ts`
   - Timeout : 20s
   - Mock : IntersectionObserver, IndexedDB

3. **Projet "e2e"**
   - Inclut : `test/e2e/**/*.test.ts`
   - Environnement : nuxt
   - Timeout : 60s

4. **Projet "integration"**
   - Inclut : `test/integration/**/*.db.test.ts`
   - Environnement : node
   - Single thread (pool: threads, singleThread: true)
   - Timeout : 30s
   - Tests séquentiels (sequence: { concurrent: false })

**Alias Complexes :**

- Alias `#app`, `#build`, `#app-manifest` pour imports Nuxt
- Plugin `tsconfigPaths` pour résolution alias

#### `prisma/schema.prisma`

**Configuration Prisma :**

```prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../node_modules/.prisma/client"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

**Modèles Clés (67 au total) :**

**User** (Utilisateur)

- 67 colonnes
- 24 relations (conventions, collaborations, éditions, feedbacks, etc.)
- Auth multi-provider (email, Google, Facebook potentiel)
- Vérification email avec code à 6 chiffres
- Admin global (isGlobalAdmin)
- Langue préférée (preferredLanguage)

**Convention** (Convention de Jonglerie)

- Informations de base
- Relations : éditions, collaborateurs, demandes réclamation

**Edition** (Édition de Convention)

- 167 colonnes !
- 20+ relations
- Adresse complète + GPS
- 40+ champs boolean pour services
- Système bénévoles complet (10+ champs volunteersAsk\*)
- Billetterie intégrée

**ConventionCollaborator** (Collaborateur)

- Système permissions granulaires :
  - `canEditConvention`
  - `canDeleteConvention`
  - `canManageCollaborators`
  - `canAddEdition`
  - `canEditAllEditions`
  - `canDeleteAllEditions`
  - `canManageVolunteers`
  - `canManageArtists`
- Titre personnalisé
- Historique traçable

**EditionVolunteerApplication** (Candidature Bénévole)

- 30+ champs pour candidature complète
- Statut (status : PENDING, APPROVED, REJECTED, CANCELLED)
- Informations personnelles (diet, allergies, emergencyContact)
- Préférences (timePreferences, teamPreferences, pets, minors, vehicle)
- Compétences (skills, experience, avoidList)
- Période (isSetup, isTeardown)
- Relations : équipes, créneaux assignés, repas

**Ticketing** (Billetterie)

- **TicketingTier** : Tarifs avec quotas
- **TicketingOption** : Options additionnelles
- **TicketingQuota** : Quotas journaliers
- **TicketingReturnableItem** : Objets consignés (gobelets, etc.)
- **TicketingOrder** : Commandes avec items
- **TicketingParticipant** : Participants avec infos complètes
- **ExternalTicketing** : HelloAsso integration

**Enums :**

- `AuthProvider` : EMAIL, GOOGLE, FACEBOOK
- `VolunteerMode` : INTERNAL, EXTERNAL, DISABLED
- `VolunteerApplicationStatus` : PENDING, APPROVED, REJECTED, CANCELLED
- `CarpoolDirection` : TO_EVENT, FROM_EVENT
- `OrderSource` : INTERNAL, HELLOASSO
- `OrderStatus` : PENDING, CONFIRMED, CANCELLED, REFUNDED
- `EntryStatus` : NOT_ARRIVED, ARRIVED, EXITED
- `NotificationType` : INFO, WARNING, SUCCESS, ERROR
- `AllergySeverity` : LOW, MODERATE, HIGH, SEVERE

#### `package.json`

**Scripts Principaux :**

**Développement :**

- `dev` : Lancer serveur dev
- `build` : Build production (4096 MB heap)
- `preview` : Preview production
- `lint`, `lint:fix` : ESLint
- `format`, `format:check` : Prettier

**Base de données :**

- `db:clean-tokens` : Nettoyer tokens expirés
- `db:seed:dev` : Peupler BDD dev
- `db:seed:password` : Lister mots de passe seeds
- `db:reset:dev` : Reset BDD
- `db:assign-meals` : Affecter repas auto

**Admin :**

- `admin:add`, `admin:remove`, `admin:list` : Gestion admins

**i18n :**

- `check-i18n` : Vérifier clés
- `check-translations` : Vérifier traductions
- `check-i18n-vars` : Vérifier variables
- `i18n:add` : Ajouter traduction
- `i18n:translate` : Traduire (DeepL)
- `i18n:translate:force` : Force traduction

**Tests :**

- `test` : Tous tests (unit par défaut)
- `test:unit`, `test:unit:run` : Tests unitaires
- `test:nuxt`, `test:nuxt:run` : Tests Nuxt
- `test:e2e`, `test:e2e:run` : Tests E2E
- `test:all` : Tous tests séquentiellement
- `test:ui` : Interface Vitest UI
- `test:db`, `test:db:run` : Tests intégration BDD
- `test:setup`, `test:teardown` : Setup/teardown containers

**Docker :**

- `docker:dev`, `docker:dev:detached` : Dev Docker
- `docker:dev:down`, `docker:dev:logs`, `docker:dev:exec` : Gestion dev
- `docker:test*` : Tests Docker
- `docker:release:up`, `docker:release:down` : Release

**Divers :**

- `geocode` : Géocoder adresses
- `help` : Aide
- `kill-servers` : Tuer serveurs
- `favicons` : Générer favicons
- `deps:reset` : Reset dépendances

**Dépendances Principales :**

```json
{
  "@nuxt/ui": "^4.0.0",
  "nuxt": "^4.2.0",
  "vue": "^3.5.17",
  "@prisma/client": "^6.18.0",
  "nuxt-auth-utils": "^0.5.23",
  "@nuxtjs/i18n": "^10.0.3",
  "@pinia/nuxt": "^0.11.2",
  "@anthropic-ai/sdk": "^0.67.0",
  "zod": "^4.1.9",
  "luxon": "^3.5.0",
  "bcryptjs": "^3.0.2",
  "nodemailer": "^7.0.5",
  "web-push": "^3.6.7"
}
```

**DevDependencies :**

```json
{
  "vitest": "^3.2.4",
  "@nuxt/test-utils": "^3.19.2",
  "prisma": "^6.18.0",
  "typescript": "^5.8.3",
  "deepl-node": "^1.20.0",
  "prettier": "^3.3.3"
}
```

---

### Fichiers Clés Application

#### `app/stores/auth.ts`

**Store Pinia d'Authentification :**

**State :**

- `user: User | null` - Utilisateur courant
- `rememberMe: boolean` - Se souvenir de moi
- `adminMode: boolean` - Mode admin activé

**Getters :**

- `isAuthenticated` - Est authentifié
- `isGlobalAdmin` - Est admin global
- `isAdminModeActive` - Mode admin actif

**Actions :**

- `register()` - Inscription
- `login()` - Connexion (stocke user en localStorage/sessionStorage)
- `logout()` - Déconnexion (nettoie session serveur + stores)
- `initializeAuth()` - Initialisation (hydrate depuis serveur)
- `updateUser()` - MAJ utilisateur
- `enableAdminMode()`, `disableAdminMode()` - Mode admin

**Architecture :**

- Session côté serveur (via nuxt-auth-utils)
- localStorage/sessionStorage côté client (UX uniquement)
- Double nettoyage logout (serveur puis client)

#### `app/middleware/authenticated.ts`

Middleware protégeant les routes authentifiées :

- Vérifie session serveur (`getUserSession()`)
- Redirige vers `/login` si non authentifié
- Stocke `returnTo` pour redirection post-login

#### `server/utils/permissions/permissions.ts`

**Système de Permissions Centralisé :**

**Fonctions Principales :**

- `getUserConventionPermissions()` - Permissions convention utilisateur
- `checkConventionPermission()` - Vérifier permission convention
- `getUserEditionPermissions()` - Permissions édition utilisateur
- `checkEditionPermission()` - Vérifier permission édition
- `ensureConventionPermission()` - Assurer permission (throw si non)
- `ensureEditionPermission()` - Assurer permission édition

**Types de Permissions Convention :**

- `editConvention`, `deleteConvention`
- `manageCollaborators`
- `addEdition`, `editAllEditions`, `deleteAllEditions`
- `manageVolunteers`, `manageArtists`

**Types de Permissions Édition :**

- `edit`, `delete`
- `manageVolunteers`, `manageArtists`
- Héritées des permissions convention

**Logique :**

1. Admin global = toutes permissions
2. Créateur convention = toutes permissions
3. Collaborateur = permissions définies
4. Créateur édition = edit/delete cette édition
5. Permissions spécifiques par édition via `EditionCollaboratorPermission`

---

## 4. Analyse des Endpoints API

### Organisation des Endpoints

L'API suit une structure RESTful cohérente avec namespaces clairs.

### Endpoints Authentification

**Base : `/api/auth`**

| Méthode | Endpoint                   | Description                                        |
| ------- | -------------------------- | -------------------------------------------------- |
| POST    | `/register`                | Inscription (email, password, pseudo, nom, prenom) |
| POST    | `/login`                   | Connexion (identifier, password, rememberMe)       |
| POST    | `/logout`                  | Déconnexion (clear session)                        |
| POST    | `/verify-email`            | Vérification email (code 6 chiffres)               |
| POST    | `/resend-verification`     | Renvoyer code vérification                         |
| POST    | `/check-email`             | Vérifier si email existe                           |
| POST    | `/reset-password`          | Demander reset mot de passe                        |
| GET     | `/verify-reset-token`      | Vérifier token reset                               |
| POST    | `/set-password-and-verify` | Définir mot de passe + vérifier email              |

**Authentification :**

- Sessions scellées via `nuxt-auth-utils`
- Code vérification email 6 chiffres (expire 15 minutes)
- Token reset mot de passe (expire 1 heure)
- Rate limiting sur endpoints sensibles

### Endpoints Profil

**Base : `/api/profile`**

| Méthode | Endpoint                    | Description                                                 |
| ------- | --------------------------- | ----------------------------------------------------------- |
| PUT     | `/update`                   | Mettre à jour profil (pseudo, nom, prenom, phone, language) |
| GET     | `/stats`                    | Statistiques profil (éditions, conventions, bénévoles)      |
| POST    | `/change-password`          | Changer mot de passe                                        |
| GET     | `/has-password`             | Vérifier si mot de passe défini                             |
| DELETE  | `/delete-picture`           | Supprimer photo profil                                      |
| GET     | `/auth-info`                | Infos authentification (provider)                           |
| GET     | `/notification-preferences` | Préférences notifications                                   |
| PUT     | `/notification-preferences` | MAJ préférences notifications                               |

**Base : `/api/user`**

| Méthode | Endpoint                  | Description                       |
| ------- | ------------------------- | --------------------------------- |
| GET     | `/volunteer-applications` | Candidatures bénévole utilisateur |

**Base : `/api/session`**

| Méthode | Endpoint | Description                  |
| ------- | -------- | ---------------------------- |
| GET     | `/me`    | Session utilisateur courante |

### Endpoints Conventions

**Base : `/api/conventions`**

| Méthode | Endpoint             | Description                                              |
| ------- | -------------------- | -------------------------------------------------------- |
| POST    | `/`                  | Créer convention                                         |
| GET     | `/my-conventions`    | Conventions de l'utilisateur (créateur ou collaborateur) |
| GET     | `/[id]`              | Détails convention                                       |
| PUT     | `/[id]`              | Modifier convention                                      |
| DELETE  | `/[id]`              | Supprimer convention                                     |
| DELETE  | `/[id]/delete-image` | Supprimer image convention                               |
| PATCH   | `/[id]/archive`      | Archiver/désarchiver convention                          |
| GET     | `/[id]/editions`     | Éditions d'une convention                                |

**Permissions :**

- Lecture : Publique (ou créateur/collaborateur pour archives)
- Création : Authentifié
- Modification/Suppression : Créateur ou collaborateur avec droits

### Endpoints Collaborateurs

**Base : `/api/conventions/[id]/collaborators`**

| Méthode | Endpoint                   | Description                                                     |
| ------- | -------------------------- | --------------------------------------------------------------- |
| GET     | `/`                        | Liste collaborateurs convention                                 |
| POST    | `/`                        | Ajouter collaborateur (userIdentifier ou userId, rights, title) |
| GET     | `/[collaboratorId]`        | Détails collaborateur                                           |
| PUT     | `/[collaboratorId]`        | Modifier collaborateur (rights, title)                          |
| PATCH   | `/[collaboratorId]`        | Modifier collaborateur (PATCH)                                  |
| DELETE  | `/[collaboratorId]`        | Retirer collaborateur                                           |
| PATCH   | `/[collaboratorId]/rights` | Modifier uniquement droits                                      |
| GET     | `/history`                 | Historique permissions                                          |

**Système de Permissions :**

- Droits granulaires (8 permissions : editConvention, deleteConvention, manageCollaborators, addEdition, editAllEditions, deleteAllEditions, manageVolunteers, manageArtists)
- Titre personnalisé (ex: "Créateur", "Gestionnaire", etc.)
- Historique traçable des changements
- Permissions par édition via `EditionCollaboratorPermission`

**Format Collaborateur :**

```json
{
  "id": 12,
  "addedAt": "2025-08-23T10:11:12.000Z",
  "title": "Créateur",
  "rights": {
    "editConvention": true,
    "deleteConvention": true,
    "manageCollaborators": true,
    "addEdition": true,
    "editAllEditions": true,
    "deleteAllEditions": true,
    "manageVolunteers": true,
    "manageArtists": true
  },
  "user": { "id": 5, "pseudo": "alice", "emailHash": "..." },
  "addedBy": { "id": 5, "pseudo": "alice" }
}
```

### Endpoints Réclamation Convention

**Base : `/api/conventions/[id]/claim`**

| Méthode | Endpoint  | Description                                             |
| ------- | --------- | ------------------------------------------------------- |
| POST    | `/`       | Réclamer convention (générer code vérification email)   |
| POST    | `/verify` | Vérifier code réclamation (ajouter comme collaborateur) |

**Workflow :**

1. Utilisateur demande réclamation
2. Code envoyé par email (6 chiffres, expire 15 min)
3. Vérification code → Ajout comme collaborateur avec tous droits

### Endpoints Éditions

**Base : `/api/editions`**

| Méthode | Endpoint | Description                                   |
| ------- | -------- | --------------------------------------------- |
| POST    | `/`      | Créer édition (standalone ou sous convention) |
| GET     | `/[id]`  | Détails édition                               |
| PUT     | `/[id]`  | Modifier édition                              |
| DELETE  | `/[id]`  | Supprimer édition                             |

**Données Édition :**

- Informations générales (name, description, program)
- Dates (startDate, endDate, setup/teardown)
- Adresse + GPS
- 40+ services (hasCamping, hasKidsZone, etc.)
- Configuration bénévolat (10+ champs volunteersAsk\*)
- Liens externes (facebookUrl, instagramUrl, ticketingUrl, officialWebsiteUrl)

### Endpoints Covoiturage

**Base : `/api/editions/[id]/carpool-offers` (Offres)**

| Méthode | Endpoint | Description          |
| ------- | -------- | -------------------- |
| GET     | `/`      | Liste offres édition |
| POST    | `/`      | Créer offre          |

**Base : `/api/carpool-offers/[id]` (Gestion Offre)**

| Méthode | Endpoint                | Description                   |
| ------- | ----------------------- | ----------------------------- |
| GET     | `/`                     | Détails offre                 |
| PUT     | `/`                     | Modifier offre                |
| DELETE  | `/`                     | Supprimer offre               |
| GET     | `/bookings`             | Réservations offre            |
| POST    | `/bookings`             | Créer réservation             |
| PUT     | `/bookings/[bookingId]` | MAJ statut réservation        |
| POST    | `/passengers`           | Ajouter passager (conducteur) |
| DELETE  | `/passengers/[userId]`  | Retirer passager              |
| GET     | `/comments`             | Commentaires offre            |
| POST    | `/comments`             | Ajouter commentaire           |

**Base : `/api/carpool-requests` (Demandes)**

| Méthode | Endpoint         | Description          |
| ------- | ---------------- | -------------------- |
| GET     | `/[id]`          | Détails demande      |
| PUT     | `/[id]`          | Modifier demande     |
| DELETE  | `/[id]`          | Supprimer demande    |
| GET     | `/[id]/comments` | Commentaires demande |
| POST    | `/[id]/comments` | Ajouter commentaire  |

**Fonctionnalités :**

- Direction (aller/retour)
- Places disponibles
- Prix suggéré
- Préférences (animaux, fumeur, musique)
- Statut réservations
- Commentaires

### Endpoints Objets Trouvés

**Base : `/api/editions/[id]/lost-found`**

| Méthode | Endpoint             | Description                  |
| ------- | -------------------- | ---------------------------- |
| GET     | `/`                  | Liste objets trouvés         |
| POST    | `/`                  | Déclarer objet trouvé        |
| GET     | `/[itemId]`          | Détails objet                |
| PUT     | `/[itemId]`          | Modifier objet               |
| DELETE  | `/[itemId]`          | Supprimer objet              |
| PATCH   | `/[itemId]/status`   | MAJ statut (trouvé/récupéré) |
| GET     | `/[itemId]/comments` | Commentaires                 |
| POST    | `/[itemId]/comments` | Ajouter commentaire          |

### Endpoints Bénévoles

**Base : `/api/editions/[id]/volunteers`**

**Candidatures :**

| Méthode | Endpoint                               | Description                        |
| ------- | -------------------------------------- | ---------------------------------- |
| GET     | `/applications`                        | Liste candidatures                 |
| POST    | `/applications`                        | Soumettre candidature              |
| GET     | `/applications/[applicationId]`        | Détails candidature                |
| PUT     | `/applications/[applicationId]`        | Modifier candidature               |
| DELETE  | `/applications/[applicationId]`        | Annuler candidature                |
| PATCH   | `/applications/[applicationId]/status` | Changer statut (approuver/rejeter) |

**Équipes :**

| Méthode | Endpoint                                       | Description                |
| ------- | ---------------------------------------------- | -------------------------- |
| GET     | `/teams`                                       | Liste équipes              |
| POST    | `/teams`                                       | Créer équipe               |
| GET     | `/teams/[teamId]`                              | Détails équipe             |
| PUT     | `/teams/[teamId]`                              | Modifier équipe            |
| DELETE  | `/teams/[teamId]`                              | Supprimer équipe           |
| POST    | `/applications/[applicationId]/teams`          | Affecter bénévole à équipe |
| DELETE  | `/applications/[applicationId]/teams/[teamId]` | Retirer bénévole d'équipe  |

**Planning :**

| Méthode | Endpoint                                          | Description          |
| ------- | ------------------------------------------------- | -------------------- |
| GET     | `/time-slots` (via `/volunteer-time-slots`)       | Liste créneaux       |
| POST    | `/time-slots`                                     | Créer créneau        |
| GET     | `/time-slots/[slotId]`                            | Détails créneau      |
| PUT     | `/time-slots/[slotId]`                            | Modifier créneau     |
| DELETE  | `/time-slots/[slotId]`                            | Supprimer créneau    |
| GET     | `/time-slots/[slotId]/assignments`                | Affectations créneau |
| POST    | `/time-slots/[slotId]/assignments`                | Affecter bénévole    |
| DELETE  | `/time-slots/[slotId]/assignments/[assignmentId]` | Retirer affectation  |

**Notifications :**

| Méthode | Endpoint                                | Description               |
| ------- | --------------------------------------- | ------------------------- |
| GET     | `/notification`                         | Groupes de notifications  |
| POST    | `/notification`                         | Créer groupe notification |
| GET     | `/notification/[groupId]`               | Détails groupe            |
| POST    | `/notification/[groupId]/send`          | Envoyer notification      |
| GET     | `/notification/[groupId]/confirmations` | Confirmations             |

**Restauration :**

| Méthode | Endpoint           | Description                  |
| ------- | ------------------ | ---------------------------- |
| GET     | `/catering`        | Infos restauration bénévoles |
| POST    | `/catering/assign` | Affecter repas               |

**Contrôle Accès :**

| Méthode | Endpoint                | Description               |
| ------- | ----------------------- | ------------------------- |
| GET     | `/access-control`       | Infos contrôle accès      |
| POST    | `/access-control/entry` | Enregistrer entrée/sortie |

**Système Bénévoles Complet :**

- Candidatures avec statut (pending/approved/rejected/cancelled)
- 30+ champs candidature (diet, allergies, préférences, compétences)
- Équipes multiples
- Planning avec créneaux et affectations
- Notifications groupées avec confirmations
- Repas avec sélection
- Objets consignés par équipe
- Contrôle d'accès (entrées/sorties)

### Endpoints Billetterie

**Base : `/api/editions/[id]/ticketing`**

**Configuration :**

| Méthode | Endpoint | Description               |
| ------- | -------- | ------------------------- |
| GET     | `/`      | Configuration billetterie |
| PUT     | `/`      | MAJ configuration         |

**Tarifs :**

| Méthode | Endpoint          | Description     |
| ------- | ----------------- | --------------- |
| GET     | `/tiers`          | Liste tarifs    |
| POST    | `/tiers`          | Créer tarif     |
| PUT     | `/tiers/[tierId]` | Modifier tarif  |
| DELETE  | `/tiers/[tierId]` | Supprimer tarif |

**Options :**

| Méthode | Endpoint              | Description      |
| ------- | --------------------- | ---------------- |
| GET     | `/options`            | Liste options    |
| POST    | `/options`            | Créer option     |
| PUT     | `/options/[optionId]` | Modifier option  |
| DELETE  | `/options/[optionId]` | Supprimer option |

**Quotas :**

| Méthode | Endpoint            | Description         |
| ------- | ------------------- | ------------------- |
| GET     | `/quotas`           | Liste quotas        |
| POST    | `/quotas`           | Créer quota         |
| PUT     | `/quotas/[quotaId]` | Modifier quota      |
| DELETE  | `/quotas/[quotaId]` | Supprimer quota     |
| GET     | `/quotas/stats`     | Statistiques quotas |

**Objets Consignés :**

| Méthode | Endpoint                     | Description            |
| ------- | ---------------------------- | ---------------------- |
| GET     | `/returnable-items`          | Liste objets consignés |
| POST    | `/returnable-items`          | Créer objet consigné   |
| PUT     | `/returnable-items/[itemId]` | Modifier objet         |
| DELETE  | `/returnable-items/[itemId]` | Supprimer objet        |

**Champs Personnalisés :**

| Méthode | Endpoint                   | Description        |
| ------- | -------------------------- | ------------------ |
| GET     | `/custom-fields`           | Liste champs perso |
| POST    | `/custom-fields`           | Créer champ        |
| PUT     | `/custom-fields/[fieldId]` | Modifier champ     |
| DELETE  | `/custom-fields/[fieldId]` | Supprimer champ    |

**Commandes :**

| Méthode | Endpoint                   | Description              |
| ------- | -------------------------- | ------------------------ |
| GET     | `/orders`                  | Liste commandes          |
| POST    | `/orders`                  | Créer commande (interne) |
| GET     | `/orders/[orderId]`        | Détails commande         |
| PUT     | `/orders/[orderId]`        | MAJ commande             |
| PATCH   | `/orders/[orderId]/status` | Changer statut           |

**HelloAsso :**

| Méthode | Endpoint             | Description            |
| ------- | -------------------- | ---------------------- |
| GET     | `/helloasso`         | Config HelloAsso       |
| PUT     | `/helloasso`         | MAJ config HelloAsso   |
| POST    | `/helloasso/sync`    | Synchroniser commandes |
| POST    | `/helloasso/webhook` | Webhook HelloAsso      |

**Billetterie Externe :**

| Méthode | Endpoint    | Description                |
| ------- | ----------- | -------------------------- |
| GET     | `/external` | Config billetterie externe |
| PUT     | `/external` | MAJ config externe         |

**Contrôle Accès :**

| Méthode | Endpoint                | Description               |
| ------- | ----------------------- | ------------------------- |
| GET     | `/access-control`       | Infos contrôle accès      |
| POST    | `/access-control/scan`  | Scanner QR code           |
| POST    | `/access-control/entry` | Enregistrer entrée/sortie |
| GET     | `/access-control/stats` | Stats entrées/sorties     |

**Système Billetterie Complet :**

- Tarifs multiples avec quotas
- Options additionnelles
- Objets consignés (gobelets, etc.)
- Champs personnalisés par tarif
- Commandes internes ou HelloAsso
- Synchronisation HelloAsso automatique
- Contrôle d'accès par QR code
- Stats en temps réel

### Endpoints Ateliers

**Base : `/api/editions/[id]/workshops`**

| Méthode | Endpoint                 | Description       |
| ------- | ------------------------ | ----------------- |
| GET     | `/`                      | Liste ateliers    |
| POST    | `/`                      | Créer atelier     |
| GET     | `/[workshopId]`          | Détails atelier   |
| PUT     | `/[workshopId]`          | Modifier atelier  |
| DELETE  | `/[workshopId]`          | Supprimer atelier |
| POST    | `/[workshopId]/favorite` | Favori atelier    |
| DELETE  | `/[workshopId]/favorite` | Retirer favori    |
| GET     | `/locations`             | Lieux ateliers    |
| POST    | `/locations`             | Créer lieu        |

**Fonctionnalités :**

- Planning ateliers avec FullCalendar
- Lieux prédéfinis ou saisie libre
- Import depuis image (IA Anthropic)
- Favoris utilisateurs

### Endpoints Artistes

**Base : `/api/editions/[id]/artists`**

| Méthode | Endpoint                    | Description            |
| ------- | --------------------------- | ---------------------- |
| GET     | `/`                         | Liste artistes         |
| POST    | `/`                         | Ajouter artiste        |
| GET     | `/[artistId]`               | Détails artiste        |
| PUT     | `/[artistId]`               | Modifier artiste       |
| DELETE  | `/[artistId]`               | Supprimer artiste      |
| PATCH   | `/[artistId]/validation`    | Valider entrée artiste |
| POST    | `/[artistId]/accommodation` | Ajouter hébergement    |
| POST    | `/[artistId]/meals`         | Gérer repas            |

**Système Artistes :**

- Profil artiste (nom, compagnie, pays, bio)
- Hébergement (période, adresse, notes)
- Repas avec sélection
- Transport (pickup/dropoff responsables)
- Notes organisateurs (privées)
- Validation entrée/sortie

### Endpoints Spectacles

**Base : `/api/editions/[id]/shows`**

| Méthode | Endpoint    | Description         |
| ------- | ----------- | ------------------- |
| GET     | `/`         | Liste spectacles    |
| POST    | `/`         | Créer spectacle     |
| GET     | `/[showId]` | Détails spectacle   |
| PUT     | `/[showId]` | Modifier spectacle  |
| DELETE  | `/[showId]` | Supprimer spectacle |

**Données Spectacle :**

- Titre, description
- Date/heure
- Lieu
- Artistes associés
- Type (gala, open stage, concert)

### Endpoints Repas

**Base : `/api/editions/[id]/meals`**

| Méthode | Endpoint    | Description     |
| ------- | ----------- | --------------- |
| GET     | `/`         | Liste repas     |
| POST    | `/`         | Créer repas     |
| PUT     | `/[mealId]` | Modifier repas  |
| DELETE  | `/[mealId]` | Supprimer repas |

**Gestion Repas :**

- Repas par jour/période
- Sélection par bénévoles
- Sélection par artistes
- Validation organisateur
- Objets consignés liés

### Endpoints Posts & Commentaires

**Base : `/api/editions/[id]/posts`**

| Méthode | Endpoint                         | Description           |
| ------- | -------------------------------- | --------------------- |
| GET     | `/`                              | Liste posts           |
| POST    | `/`                              | Créer post            |
| GET     | `/[postId]`                      | Détails post          |
| PUT     | `/[postId]`                      | Modifier post         |
| DELETE  | `/[postId]`                      | Supprimer post        |
| GET     | `/[postId]/comments`             | Commentaires post     |
| POST    | `/[postId]/comments`             | Ajouter commentaire   |
| DELETE  | `/[postId]/comments/[commentId]` | Supprimer commentaire |

### Endpoints Notifications

**Base : `/api/notifications`**

| Méthode | Endpoint            | Description                     |
| ------- | ------------------- | ------------------------------- |
| GET     | `/`                 | Liste notifications utilisateur |
| GET     | `/[id]`             | Détails notification            |
| PATCH   | `/[id]/read`        | Marquer comme lu                |
| POST    | `/push/subscribe`   | Abonnement push                 |
| DELETE  | `/push/unsubscribe` | Désabonnement push              |
| GET     | `/stream`           | Stream SSE notifications        |

**Système Notifications :**

- Notifications in-app avec badge
- Push notifications (Web Push API)
- Stream temps réel (SSE)
- Types : INFO, WARNING, SUCCESS, ERROR
- Préférences utilisateur

### Endpoints Feedback

**Base : `/api/feedback`**

| Méthode | Endpoint | Description      |
| ------- | -------- | ---------------- |
| POST    | `/`      | Envoyer feedback |

### Endpoints Fichiers

**Base : `/api/files`**

| Méthode | Endpoint      | Description               |
| ------- | ------------- | ------------------------- |
| POST    | `/profile`    | Upload photo profil       |
| POST    | `/convention` | Upload image convention   |
| POST    | `/edition`    | Upload image édition      |
| POST    | `/lost-found` | Upload image objet trouvé |
| POST    | `/generic`    | Upload générique          |

**Base : `/api/uploads`**

| Méthode | Endpoint     | Description            |
| ------- | ------------ | ---------------------- |
| GET     | `/[...path]` | Servir fichier uploadé |

### Endpoints Administration

**Base : `/api/admin`**

**Statistiques & Monitoring :**

| Méthode | Endpoint    | Description            |
| ------- | ----------- | ---------------------- |
| GET     | `/stats`    | Stats globales système |
| GET     | `/activity` | Activité récente       |
| GET     | `/config`   | Configuration système  |

**Utilisateurs :**

| Méthode | Endpoint                      | Description                              |
| ------- | ----------------------------- | ---------------------------------------- |
| GET     | `/users`                      | Liste utilisateurs (pagination, filtres) |
| GET     | `/users/[id]`                 | Détails utilisateur                      |
| PUT     | `/users/[id]`                 | Modifier utilisateur                     |
| DELETE  | `/users/[id]`                 | Supprimer utilisateur                    |
| PUT     | `/users/[id]/promote`         | Promouvoir admin                         |
| POST    | `/users/[id]/impersonate`     | Usurper identité                         |
| PUT     | `/users/[id]/profile-picture` | Changer photo admin                      |

**Conventions & Éditions :**

| Méthode | Endpoint                | Description                  |
| ------- | ----------------------- | ---------------------------- |
| GET     | `/conventions`          | Liste toutes conventions     |
| DELETE  | `/conventions/[id]`     | Supprimer convention (admin) |
| POST    | `/import-edition`       | Importer édition             |
| GET     | `/editions/[id]/export` | Exporter édition (JSON)      |

**Feedback :**

| Méthode | Endpoint                 | Description       |
| ------- | ------------------------ | ----------------- |
| GET     | `/feedback`              | Liste feedbacks   |
| PUT     | `/feedback/[id]/resolve` | Résoudre feedback |

**Logs Erreurs :**

| Méthode | Endpoint                      | Description                |
| ------- | ----------------------------- | -------------------------- |
| GET     | `/error-logs`                 | Liste logs erreurs         |
| GET     | `/error-logs/[id]`            | Détails log                |
| PATCH   | `/error-logs/[id]/resolve`    | Résoudre erreur            |
| POST    | `/error-logs/resolve-similar` | Résoudre similaires        |
| POST    | `/error-logs/cleanup-old`     | Nettoyer anciens (>1 mois) |

**Notifications :**

| Méthode | Endpoint                        | Description                |
| ------- | ------------------------------- | -------------------------- |
| POST    | `/notifications/create`         | Créer notification globale |
| POST    | `/notifications/send-reminders` | Envoyer rappels éditions   |
| POST    | `/notifications/test`           | Test notification          |
| GET     | `/notifications/test-simple`    | Test simple                |
| GET     | `/notifications/stats`          | Stats notifications        |
| GET     | `/notifications/recent`         | Notifications récentes     |
| POST    | `/notifications/push-test`      | Test push                  |
| GET     | `/notifications/push-stats`     | Stats push                 |

**Tâches Cron :**

| Méthode | Endpoint            | Description                 |
| ------- | ------------------- | --------------------------- |
| GET     | `/tasks`            | Liste tâches disponibles    |
| POST    | `/tasks/[taskName]` | Exécuter tâche manuellement |

**Sauvegardes :**

| Méthode | Endpoint           | Description            |
| ------- | ------------------ | ---------------------- |
| POST    | `/backup/create`   | Créer sauvegarde BDD   |
| GET     | `/backup/list`     | Liste sauvegardes      |
| GET     | `/backup/download` | Télécharger sauvegarde |
| POST    | `/backup/restore`  | Restaurer sauvegarde   |
| DELETE  | `/backup/delete`   | Supprimer sauvegarde   |

**Usurpation :**

| Méthode | Endpoint            | Description        |
| ------- | ------------------- | ------------------ |
| POST    | `/impersonate/stop` | Arrêter usurpation |

**Divers :**

| Méthode | Endpoint                   | Description                  |
| ------- | -------------------------- | ---------------------------- |
| POST    | `/assign-meals-volunteers` | Affecter repas auto          |
| GET     | `/debug-auth`              | Debug authentification       |
| POST    | `/fix-session`             | Corriger session utilisateur |

### Endpoints Sitemap & SEO

**Base : `/api/__sitemap__`**

| Méthode | Endpoint      | Description              |
| ------- | ------------- | ------------------------ |
| GET     | `/editions`   | Éditions pour sitemap    |
| GET     | `/carpool`    | Covoiturage pour sitemap |
| GET     | `/volunteers` | Bénévoles pour sitemap   |

### Endpoints Divers

| Méthode | Endpoint            | Description              |
| ------- | ------------------- | ------------------------ |
| GET     | `/countries`        | Liste pays avec drapeaux |
| GET     | `/users/search`     | Rechercher utilisateurs  |
| GET     | `/site.webmanifest` | Manifest PWA             |

### Stratégie d'API

**Principes :**

- RESTful avec verbes HTTP standards
- Authentification par session (cookies scellés)
- Permissions granulaires vérifiées côté serveur
- Validation Zod côté serveur
- Pagination pour listes longues
- Rate limiting sur endpoints sensibles
- Logs d'erreurs automatiques
- Réponses structurées (data, error, message)

**Sécurité :**

- CORS configuré
- CSRF protection via sessions
- Input validation (Zod)
- SQL injection prevention (Prisma)
- XSS prevention (sanitization)
- Rate limiting
- Admin-only endpoints protégés

---

## 5. Architecture Approfondie

### Architecture Globale

**Type** : Monolithe Full-Stack Moderne (Nuxt 4)

**Pattern** : Server-Side Rendering (SSR) + API RESTful

```
┌─────────────────────────────────────────────────────────┐
│                      UTILISATEUR                        │
│                  (Navigateur Web)                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ HTTP/HTTPS
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   NUXT 4 SERVER                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │           NITRO (Serveur H3)                      │  │
│  │  ┌─────────────────┐    ┌─────────────────┐      │  │
│  │  │   SSR Renderer  │    │   API Routes    │      │  │
│  │  │   (Vue 3)       │    │   (/api/*)      │      │  │
│  │  └─────────────────┘    └─────────────────┘      │  │
│  │                                                     │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │         MIDDLEWARE LAYER                    │  │  │
│  │  │  - Auth middleware                          │  │  │
│  │  │  - Permission checks                        │  │  │
│  │  │  - Rate limiting                            │  │  │
│  │  │  - Error handling                           │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Prisma Client
                       │
┌──────────────────────▼──────────────────────────────────┐
│                    MySQL DATABASE                       │
│                   (67 modèles)                          │
└─────────────────────────────────────────────────────────┘
```

### Architecture Frontend (Vue 3 + Nuxt 4)

**Pattern** : Composition API + Auto-imports

```
┌─────────────────────────────────────────────────────────┐
│                  FRONTEND LAYERS                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  PAGES (File-based Routing)                       │ │
│  │  - index.vue                                       │ │
│  │  - editions/[id]/index.vue                         │ │
│  │  - admin/users/index.vue                           │ │
│  └────────────────┬───────────────────────────────────┘ │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────────┐ │
│  │  LAYOUTS                                           │ │
│  │  - default.vue                                     │ │
│  │  - admin.vue                                       │ │
│  └────────────────┬───────────────────────────────────┘ │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────────┐ │
│  │  COMPONENTS (Modular)                              │ │
│  │  - EditionCard.vue                                 │ │
│  │  - edition/volunteer/Table.vue                     │ │
│  │  - ticketing/TierModal.vue                         │ │
│  └────────────────┬───────────────────────────────────┘ │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────────┐ │
│  │  COMPOSABLES (Hooks)                               │ │
│  │  - useAuthStore()                                  │ │
│  │  - useVolunteerTeams()                             │ │
│  │  - useDateFormat()                                 │ │
│  └────────────────┬───────────────────────────────────┘ │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────────┐ │
│  │  STORES (Pinia)                                    │ │
│  │  - auth (user, isAuthenticated)                    │ │
│  │  - [autres stores potentiels]                      │ │
│  └────────────────┬───────────────────────────────────┘ │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────────┐ │
│  │  UTILS                                             │ │
│  │  - Formatters                                      │ │
│  │  - Validators                                      │ │
│  │  - Helpers                                         │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Architecture Backend (Nitro + H3)

**Pattern** : API Routes + Utils

```
┌─────────────────────────────────────────────────────────┐
│                   BACKEND LAYERS                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  API ROUTES (/server/api)                         │ │
│  │  - Handlers par endpoint                           │ │
│  │  - Validation entrées (Zod)                        │ │
│  │  - Appel utils + permissions                       │ │
│  └────────────────┬───────────────────────────────────┘ │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────────┐ │
│  │  MIDDLEWARE (/server/middleware)                   │ │
│  │  - CORS                                            │ │
│  │  - Rate limiting (potentiel)                       │ │
│  │  - Error handling global                           │ │
│  └────────────────┬───────────────────────────────────┘ │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────────┐ │
│  │  UTILS (/server/utils)                             │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │  PERMISSIONS SYSTEM                          │  │ │
│  │  │  - convention-permissions.ts                 │  │ │
│  │  │  - edition-permissions.ts                    │  │ │
│  │  │  - volunteer-permissions.ts                  │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │  SERVICES                                    │  │ │
│  │  │  - emailService.ts                           │  │ │
│  │  │  - notification-service.ts                   │  │ │
│  │  │  - push-notification-service.ts              │  │ │
│  │  │  - geocoding.ts                              │  │ │
│  │  │  - anthropic.ts                              │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │  DATA ACCESS                                 │  │ │
│  │  │  - prisma.ts (singleton)                     │  │ │
│  │  │  - collaborator-management.ts                │  │ │
│  │  │  - volunteer-scheduler.ts                    │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └────────────────┬───────────────────────────────────┘ │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────────┐ │
│  │  TASKS (/server/tasks)                             │ │
│  │  - Tâches cron (nettoyage, notifications)         │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Architecture Base de Données

**Schéma** : 67 modèles Prisma (MySQL)

**Entités Principales et Relations :**

```
                    ┌──────────────┐
                    │     USER     │
                    │──────────────│
                    │ id           │
                    │ email        │
                    │ pseudo       │
                    │ password     │
                    │ isGlobalAdmin│
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           │               │               │
    ┌──────▼───────┐  ┌───▼──────┐  ┌────▼────────┐
    │ CONVENTION   │  │ EDITION  │  │ COLLABORATOR│
    │──────────────│  │──────────│  │─────────────│
    │ id           │  │ id       │  │ id          │
    │ name         │  │ name     │  │ conventionId│
    │ description  │  │ startDate│  │ userId      │
    │ creatorId    │  │ endDate  │  │ rights (8)  │
    └──────┬───────┘  │ conventionId│ │ title       │
           │          └──────┬──────┘  └─────────────┘
           │                 │
           │                 │
           │     ┌───────────┴───────────┐
           │     │                       │
           │  ┌──▼─────────┐   ┌────────▼────────┐
           │  │ VOLUNTEER  │   │   TICKETING     │
           │  │ APPLICATION│   │   (Tiers/Options│
           │  │────────────│   │   Quotas/Orders)│
           │  │ id         │   │─────────────────│
           │  │ editionId  │   │ TicketingTier   │
           │  │ userId     │   │ TicketingOption │
           │  │ status     │   │ TicketingQuota  │
           │  │ diet, etc. │   │ TicketingOrder  │
           │  └──────┬─────┘   └─────────────────┘
           │         │
           │         │
           │  ┌──────▼─────────────────────┐
           │  │ VolunteerTeam              │
           │  │ VolunteerTimeSlot          │
           │  │ VolunteerAssignment        │
           │  │ VolunteerNotificationGroup │
           │  └────────────────────────────┘
           │
    ┌──────▼────────────────────────┐
    │ CarpoolOffer/Request          │
    │ LostFoundItem                 │
    │ EditionPost                   │
    │ Workshop                      │
    │ EditionArtist                 │
    │ Show                          │
    └───────────────────────────────┘
```

**Relations Clés :**

- User → Convention (1:N, créateur)
- User → ConventionCollaborator (1:N)
- Convention → Edition (1:N)
- Edition → VolunteerApplication (1:N)
- Edition → TicketingTier/Option/Quota/Order (1:N)
- VolunteerApplication → VolunteerTeam (N:M via table jointure)
- VolunteerApplication → VolunteerTimeSlot (N:M via VolunteerAssignment)

### Système de Permissions

**Architecture en 3 Niveaux :**

1. **Admin Global** (`isGlobalAdmin`)
   - Accès complet à tout
   - Gestion utilisateurs
   - Tâches admin système

2. **Permissions Convention** (`ConventionCollaborator`)
   - 8 permissions granulaires :
     - `canEditConvention`
     - `canDeleteConvention`
     - `canManageCollaborators`
     - `canAddEdition`
     - `canEditAllEditions`
     - `canDeleteAllEditions`
     - `canManageVolunteers`
     - `canManageArtists`
   - Titre personnalisé
   - Historique traçable

3. **Permissions Édition** (`EditionCollaboratorPermission`)
   - Permissions spécifiques par édition
   - Override permissions globales
   - Permet granularité fine

**Workflow Vérification :**

```typescript
function checkPermission(user, convention, edition, action) {
  // 1. Admin global → ALLOW
  if (user.isGlobalAdmin) return true

  // 2. Créateur convention → ALLOW
  if (convention.creatorId === user.id) return true

  // 3. Collaborateur avec permission globale
  const collab = getCollaborator(user, convention)
  if (collab && collab[action]) return true

  // 4. Créateur édition (edit/delete uniquement)
  if (edition && edition.creatorId === user.id && ['edit', 'delete'].includes(action)) return true

  // 5. Permission spécifique édition
  if (edition) {
    const edPerm = getEditionPermission(user, convention, edition)
    if (edPerm && edPerm[action]) return true
  }

  // 6. Sinon DENY
  return false
}
```

### Architecture Notifications

**3 Canaux de Notifications :**

1. **In-App Notifications**
   - Stockées en BDD (`Notification` model)
   - Badge compteur
   - Centre de notifications
   - Types : INFO, WARNING, SUCCESS, ERROR

2. **Server-Sent Events (SSE)**
   - Stream temps réel
   - `/api/notifications/stream`
   - Gestionnaire SSE Manager (`sse-manager.ts`)
   - Notifications instantanées

3. **Push Notifications**
   - Web Push API
   - Service Worker
   - Abonnements (`PushSubscription` model)
   - VAPID keys
   - Notifications même app fermée

```
┌─────────────────────────────────────────────────┐
│              NOTIFICATION FLOW                  │
│                                                  │
│  1. Événement Système                           │
│     (nouvelle candidature, message, etc.)       │
│              ┌───────────────┐                  │
│              │ notification- │                  │
│              │ service.ts    │                  │
│              └───────┬───────┘                  │
│                      │                           │
│         ┌────────────┼────────────┐             │
│         │            │            │             │
│  ┌──────▼─────┐ ┌───▼────┐ ┌────▼─────┐        │
│  │  BDD       │ │  SSE   │ │  Push    │        │
│  │ Notification│ │ Stream │ │ Service  │        │
│  └──────┬─────┘ └───┬────┘ └────┬─────┘        │
│         │           │            │              │
│  ┌──────▼───────────▼────────────▼─────┐        │
│  │         CLIENT (Navigateur)         │        │
│  │  - Badge notif                      │        │
│  │  - Toast (SSE)                      │        │
│  │  - Push notif (Service Worker)      │        │
│  └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

### Architecture i18n

**Système Lazy Loading par Domaine :**

```
┌─────────────────────────────────────────────────┐
│           I18N ARCHITECTURE                     │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  13 LANGUES                                │ │
│  │  en, fr, de, es, it, nl, pl, pt, ru,       │ │
│  │  sv, cs, da, uk                            │ │
│  └────────────────┬───────────────────────────┘ │
│                   │                              │
│  ┌────────────────▼───────────────────────────┐ │
│  │  DOMAINES (par fichier)                    │ │
│  │  - common.json    (navigation, boutons)    │ │
│  │  - app.json       (pages générales)        │ │
│  │  - auth.json      (authentification)       │ │
│  │  - admin.json     (administration)         │ │
│  │  - edition.json   (éditions)               │ │
│  │  - gestion.json   (gestion)                │ │
│  │  - ticketing.json (billetterie)            │ │
│  │  - etc. (14 domaines)                      │ │
│  └────────────────┬───────────────────────────┘ │
│                   │                              │
│  ┌────────────────▼───────────────────────────┐ │
│  │  CHARGEMENT INTELLIGENT                    │ │
│  │  - Route → Domaines nécessaires            │ │
│  │  - /admin/* → common + admin               │ │
│  │  - /editions/[id]/gestion/* → common +     │ │
│  │    edition + gestion + ticketing           │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Avantages :**

- Bundles légers (seules traductions nécessaires)
- Temps de chargement réduit
- Scalabilité (facile d'ajouter domaines/langues)
- Maintenance simplifiée (domaines séparés)

### Architecture Billetterie

**2 Modes : Interne + HelloAsso**

```
┌─────────────────────────────────────────────────┐
│         TICKETING ARCHITECTURE                  │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  CONFIGURATION ÉDITION                     │ │
│  │  - Mode : INTERNAL / EXTERNAL / BOTH       │ │
│  │  - HelloAsso : Config + Sync               │ │
│  └────────────────┬───────────────────────────┘ │
│                   │                              │
│         ┌─────────┴─────────┐                   │
│         │                   │                   │
│  ┌──────▼─────┐      ┌──────▼─────┐             │
│  │  INTERNE   │      │  HELLOASSO │             │
│  │────────────│      │────────────│             │
│  │ Tiers      │      │ Sync Orders│             │
│  │ Options    │      │ Webhook    │             │
│  │ Quotas     │      │ Formulaires│             │
│  │ Consignes  │      └──────┬─────┘             │
│  │ Champs     │             │                   │
│  │  perso     │             │                   │
│  └──────┬─────┘             │                   │
│         │                   │                   │
│         └─────────┬─────────┘                   │
│                   │                              │
│  ┌────────────────▼───────────────────────────┐ │
│  │  COMMANDES UNIFIÉES (TicketingOrder)       │ │
│  │  - Source : INTERNAL / HELLOASSO           │ │
│  │  - Statut : PENDING / CONFIRMED / etc.     │ │
│  │  - Items (Tiers + Options)                 │ │
│  │  - Participants (infos complètes)          │ │
│  └────────────────┬───────────────────────────┘ │
│                   │                              │
│  ┌────────────────▼───────────────────────────┐ │
│  │  CONTRÔLE D'ACCÈS                          │ │
│  │  - QR Code par participant                 │ │
│  │  - Scanner entrée/sortie                   │ │
│  │  - Statut : NOT_ARRIVED / ARRIVED / EXITED │ │
│  │  - Stats temps réel                        │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Architecture Bénévoles

**Système Complet de Gestion Bénévoles :**

```
┌─────────────────────────────────────────────────┐
│       VOLUNTEER SYSTEM ARCHITECTURE             │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  CANDIDATURE (EditionVolunteerApplication) │ │
│  │  - Infos perso (30+ champs)                │ │
│  │  - Statut : PENDING → APPROVED/REJECTED    │ │
│  │  - Diet, allergies, emergency contact      │ │
│  │  - Préférences (temps, équipes, etc.)      │ │
│  └────────────────┬───────────────────────────┘ │
│                   │                              │
│         ┌─────────┴─────────┐                   │
│         │                   │                   │
│  ┌──────▼─────┐      ┌──────▼─────┐             │
│  │  ÉQUIPES   │      │  PLANNING  │             │
│  │────────────│      │────────────│             │
│  │VolunteerTeam│     │VolunteerTimeSlot│        │
│  │ - Nom      │      │ - Date/heure   │         │
│  │ - Description│     │ - Équipe       │         │
│  │ - Responsable│     │ - Min/max slots│         │
│  │ - Membres (N:M)│   └──────┬─────┘             │
│  └──────┬─────┘             │                   │
│         │                   │                   │
│         └─────────┬─────────┘                   │
│                   │                              │
│  ┌────────────────▼───────────────────────────┐ │
│  │  AFFECTATIONS (VolunteerAssignment)        │ │
│  │  - Bénévole → Créneau                      │ │
│  │  - Auto-assignment (algorithme)            │ │
│  │  - Détection chevauchements                │ │
│  └────────────────┬───────────────────────────┘ │
│                   │                              │
│  ┌────────────────▼───────────────────────────┐ │
│  │  NOTIFICATIONS GROUPÉES                    │ │
│  │  - VolunteerNotificationGroup              │ │
│  │  - Envoi notifications bénévoles           │ │
│  │  - Confirmations trackées                  │ │
│  └────────────────┬───────────────────────────┘ │
│                   │                              │
│  ┌────────────────▼───────────────────────────┐ │
│  │  REPAS & CONSIGNES                         │ │
│  │  - Sélection repas par bénévole            │ │
│  │  - Objets consignés par équipe             │ │
│  │  - Validation organisateur                 │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Flux de Données Typique

**Exemple : Candidature Bénévole**

```
1. Utilisateur
   ↓
2. Page /editions/[id]/volunteers
   ↓
3. Composant ApplicationModal.vue
   - Formulaire réactif (30+ champs)
   - Validation Zod côté client
   ↓
4. Submit → POST /api/editions/[id]/volunteers/applications
   ↓
5. API Handler
   - Vérification auth (middleware)
   - Validation Zod (schéma serveur)
   - Vérification permissions édition
   ↓
6. Server Utils
   - editions/volunteers/applications.ts
   - Logique métier
   ↓
7. Prisma Client
   - Insertion BDD (EditionVolunteerApplication)
   - Transaction si nécessaire
   ↓
8. Notification Service
   - Notification organisateur (nouveau bénévole)
   - Email si configuré
   ↓
9. Réponse API
   - Statut 201 Created
   - Données candidature
   ↓
10. Frontend
    - Toast succès
    - Redirection ou refresh
    - MAJ state local si nécessaire
```

---

## 6. Analyse de l'Environnement et Configuration

### Variables d'Environnement

**Fichier : `.env` (non versionné)**

**Base de données :**

```env
DATABASE_URL="mysql://user:password@host:port/database_name"
```

**Authentification :**

```env
NUXT_SESSION_PASSWORD="change_me_very_secret_32_chars_min"
```

- Obligatoire en production
- Minimum 32 caractères
- Utilisé pour sceller sessions cookies

**Emails :**

```env
SEND_EMAILS=false                    # true pour envoi réel, false simulation
SMTP_USER="votre.email@gmail.com"   # Si SEND_EMAILS=true
SMTP_PASS="mot_de_passe_application" # Mot de passe application Gmail
```

**IA (Anthropic / Ollama / LM Studio) :**

```env
# Anthropic (défaut)
ANTHROPIC_API_KEY="sk-ant-..."
AI_PROVIDER="anthropic"              # anthropic | ollama | lmstudio

# Ollama (alternatif)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llava"

# LM Studio (alternatif)
LMSTUDIO_BASE_URL="http://localhost:1234"
LMSTUDIO_MODEL="auto"
```

**reCAPTCHA (protection formulaires) :**

```env
NUXT_RECAPTCHA_SITE_KEY="6Lc..."           # Public
NUXT_RECAPTCHA_SECRET_KEY="6Lc..."         # Privé
NUXT_RECAPTCHA_MIN_SCORE="0.5"             # Seuil v3
NUXT_RECAPTCHA_EXPECTED_HOSTNAME=""        # Optionnel
NUXT_RECAPTCHA_DEV_BYPASS="true"           # Bypass dev
```

**Push Notifications (VAPID) :**

```env
NUXT_PUBLIC_VAPID_PUBLIC_KEY="BM..."       # Public
VAPID_PRIVATE_KEY="..."                    # Privé (ne pas exposer)
```

**Site :**

```env
NUXT_PUBLIC_SITE_URL="https://juggling-convention.com"
```

**Docker (optionnelles) :**

```env
MYSQL_ROOT_PASSWORD="rootpassword"
MYSQL_DATABASE="convention_db"
MYSQL_USER="convention_user"
MYSQL_PASSWORD="convention_password"
```

### Installation et Setup

**Prérequis :**

- Node.js >= 22 < 23 (strictement)
- npm/pnpm/yarn/bun
- MySQL 8.x
- Docker (optionnel mais recommandé)

**Installation Locale :**

```bash
# 1. Cloner le dépôt
git clone <URL_DU_DEPOT>
cd convention-de-jonglerie

# 2. Installer dépendances
npm install

# 3. Configurer .env
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Appliquer migrations Prisma
npx prisma migrate dev

# 5. Générer client Prisma
npx prisma generate

# 6. (Optionnel) Peupler BDD dev
npm run db:seed:dev

# 7. Lancer serveur dev
npm run dev
```

**Installation Docker :**

```bash
# Mode développement
npm run docker:dev

# Logs
npm run docker:dev:logs

# Shell dans container
npm run docker:dev:exec

# Arrêter
npm run docker:dev:down
```

**Environnements Docker :**

- **dev** : Développement avec hot reload
- **release** : Preview production
- **test** : Tests automatisés
- **prod** : Production (docker-compose.prod.yml)

### Workflow de Développement

**Commandes Quotidiennes :**

```bash
# Lancer dev (si pas Docker)
npm run dev

# Linter
npm run lint
npm run lint:fix

# Formattage
npm run format

# Tests
npm run test:unit
npm run test:nuxt
npm run test:all

# Vérifications i18n
npm run check-i18n
npm run check-translations
```

**Workflow Git :**

1. Créer branche feature
2. Développer + tests
3. Lint + format (`npm run lint:fix && npm run format`)
4. Commit (messages clairs)
5. Push + Pull Request
6. CI/CD tests automatiques (GitHub Actions)
7. Review + Merge

**Workflow Base de Données :**

```bash
# Créer migration
npx prisma migrate dev --name descriptive_name

# Appliquer migrations
npx prisma migrate deploy

# Reset BDD dev (ATTENTION: perte données)
npm run db:reset:dev

# Studio Prisma (GUI)
npx prisma studio
```

### Déploiement Production

**Build Production :**

```bash
# Build
npm run build

# Preview local
npm run preview
```

**Docker Production :**

```bash
# Lancer en mode release
npm run docker:release:up

# Arrêter
npm run docker:release:down
```

**Checklist Déploiement :**

- [ ] Variables `.env` production configurées
- [ ] `NUXT_SESSION_PASSWORD` robuste (32+ chars)
- [ ] `SEND_EMAILS=true` avec SMTP valide
- [ ] `DATABASE_URL` production
- [ ] Migrations appliquées (`prisma migrate deploy`)
- [ ] Assets statiques buildés
- [ ] HTTPS configuré (certificat SSL)
- [ ] Backups BDD automatisés
- [ ] Monitoring erreurs (logs)
- [ ] Tests E2E passés

**Stratégies Déploiement :**

- **Serverless** : Vercel, Netlify (limites BDD)
- **VPS** : DigitalOcean, Hetzner, OVH
- **Docker** : Docker Swarm, Kubernetes
- **PaaS** : Railway, Render, Fly.io

---

## 7. Stack Technologique Détaillée

### Runtime & Framework

**Node.js >= 22 < 23**

- Runtime JavaScript serveur
- Requirement strict pour compatibilité dépendances

**Nuxt 4.2.0**

- Framework Vue.js full-stack
- SSR (Server-Side Rendering)
- File-based routing
- Auto-imports
- Nitro engine (serveur H3)
- Module ecosystem riche

**Vue.js 3.5.17**

- Framework JavaScript réactif
- Composition API
- Script setup
- TypeScript support natif

**TypeScript 5.8.3**

- Langage typé (superset JavaScript)
- Sécurité type compile-time
- IntelliSense amélioré
- Refactoring sûr

### UI & Styling

**Nuxt UI 4.0.0**

- Bibliothèque composants UI
- Basée sur Tailwind CSS + Headless UI
- Composants préconstruits (UButton, UModal, etc.)
- Personnalisation via tailwind.config
- Dark mode support

**Tailwind CSS**

- Framework CSS utility-first
- Intégré via Nuxt UI
- Classes utilitaires (flex, grid, p-4, etc.)
- Responsive design facile

**Icônes**

- **@iconify/vue** - Iconify (100k+ icônes)
- **@iconify-json/\*** - Collections (heroicons, lucide, mdi, etc.)
- **nuxt-icon** - Module Nuxt icônes
- Mode serveur : `remote` (optimisation bundle)

**Flag Icons**

- **flag-icons** - Drapeaux pays (CSS)

### State Management & Stores

**Pinia 3.0.3**

- Store officiel Vue 3
- Remplacement Vuex
- Type-safe
- DevTools support
- Composition API friendly

**VueUse 13.6.0**

- Collection composables Vue
- Utilitaires réactifs (useDebounce, useIntersectionObserver, etc.)

### Base de Données & ORM

**MySQL 8.x**

- SGBD relationnel
- Performance élevée
- Transactions ACID
- Réplication
- Full-text search

**Prisma 6.18.0**

- ORM moderne TypeScript
- Schema-first
- Type-safe queries
- Migrations automatiques
- Prisma Studio (GUI)

**Prisma Client**

- Client auto-généré
- IntelliSense complet
- Relations auto-résolues
- Transactions

### Authentification

**nuxt-auth-utils 0.5.23**

- Module auth Nuxt
- Sessions scellées (sealed cookies)
- Pas de JWT (plus sécurisé)
- Intégration H3
- OAuth support potentiel

**bcryptjs 3.0.2**

- Hachage mots de passe
- Salt automatique
- Résistant brute-force

### Internationalisation

**@nuxtjs/i18n 10.0.3**

- Module i18n Nuxt
- Vue I18n intégré
- 13 langues supportées
- Lazy loading
- Détection langue navigateur
- SEO support

**@intlify/\*** - Core i18n Vue

### Email

**nodemailer 7.0.5**

- Envoi emails Node.js
- SMTP support (Gmail, etc.)
- Attachments
- HTML templates

**@vue-email/\*** - Templates email Vue

- Composants Vue pour emails
- Rendu HTML/texte
- Responsive

### Notifications

**web-push 3.6.7**

- Web Push API Node.js
- Notifications push
- VAPID support
- Service Worker

**Server-Sent Events (SSE)**

- Implémentation custom
- Stream temps réel
- Notifications instantanées

### IA & Intégrations

**@anthropic-ai/sdk 0.67.0**

- SDK Claude (Anthropic)
- Import ateliers depuis image
- Support streaming
- Multi-providers (Ollama, LM Studio)

### Validation

**zod 4.1.9**

- Validation schema TypeScript-first
- Type inference
- Validation runtime
- Error messages clairs

### Dates & Temps

**luxon 3.5.0**

- Manipulation dates moderne
- Remplacement Moment.js
- i18n support
- Timezones

**@internationalized/date 3.8.2**

- Dates internationalisées
- Calendriers non-grégoriens
- Intégration React Aria

### Cartes & Calendrier

**Leaflet** (via composable)

- Bibliothèque cartes interactives
- OpenStreetMap
- Markers, popups, layers
- Léger

**FullCalendar 6.1.15**

- Calendrier événements
- Vue 3 support
- Resource timeline
- Drag & drop
- Gestion ateliers/planning

### QR Codes

**nuxt-qrcode 0.4.8**

- Génération QR codes
- Module Nuxt
- Billetterie, bénévoles

**html5-qrcode 2.3.8**

- Scanner QR codes
- WebRTC (caméra)
- Contrôle d'accès

### PDF & Export

**jspdf 3.0.3**

- Génération PDF client-side
- Export listes, badges

**jspdf-autotable 5.0.2**

- Tableaux PDF
- Auto-layout

**html2canvas 1.4.1**

- Capture HTML → Canvas
- Screenshots

### Markdown

**unified, remark-_, rehype-_**

- Pipeline Markdown → HTML
- remark-parse : Parser Markdown
- remark-gfm : GitHub Flavored Markdown
- remark-rehype : MD → HTML
- rehype-sanitize : Sanitization XSS
- rehype-stringify : HTML output

### Images

**@nuxt/image 1.10.0**

- Optimisation images
- Lazy loading
- Placeholder
- Formats modernes (WebP, AVIF)

**sharp 0.33.5**

- Processing images Node.js
- Resize, crop, format conversion
- Performance

### Fichiers

**nuxt-file-storage 0.3.0**

- Upload fichiers
- Stockage local
- Gestion uploads utilisateurs

### Testing

**Vitest 3.2.4**

- Test runner moderne
- Vite-powered
- Jest-compatible
- Fast

**@nuxt/test-utils 3.19.2**

- Utilitaires tests Nuxt
- mountSuspended, renderSuspended
- Mock nuxt context

**@vue/test-utils 2.4.6**

- Utilitaires tests Vue
- mount, shallowMount

**@testing-library/vue 8.1.0**

- Testing Library Vue
- User-centric testing

**happy-dom 18.0.1**

- DOM implementation léger
- Alternative jsdom
- Fast

**@vitest/ui 3.2.4**

- Interface web Vitest
- Debug tests

### Linting & Formatting

**ESLint 9.32.0**

- Linter JavaScript/TypeScript
- @nuxt/eslint - Config Nuxt

**Prettier 3.3.3**

- Formatteur code
- Opinionated
- Config : singleQuote, semi: false, printWidth: 100

### SEO & Meta

**@nuxtjs/seo 3.2.2**

- Module SEO Nuxt
- Sitemap automatique
- OpenGraph images
- Schema.org
- Robots.txt

**@unhead/vue 2.0.12**

- Gestion tags <head>
- SSR-safe

### Scripts & Performance

**@nuxt/scripts 0.11.10**

- Chargement scripts tiers optimisé
- Lazy loading
- Analytics, widgets, etc.

### Utilitaires

**md5 2.3.0**

- Hash MD5
- Gravatar

**@babel/parser**

- Parser JavaScript/TypeScript

**cross-env 10.0.0**

- Variables env cross-platform

### DevDeps & Tooling

**tsx 4.19.1**

- Exécuter TypeScript direct (scripts)

**vite-tsconfig-paths 5.1.4**

- Support paths tsconfig dans Vite

**deepl-node 1.20.0**

- API DeepL traduction

**dotenv 17.2.3**

- Chargement .env

**glob 11.0.3**

- Pattern matching fichiers

**wait-on 8.0.4**

- Attendre ressource (tests)

### Dépendances Spécifiques

**@adonisjs/hash**

- Hachage (Prisma custom)

**@phc/format**

- Format PHC hashing

**node-cron 3.0.3**

- Tâches planifiées
- Cron syntax

**vue3-json-viewer 2.4.1**

- Visualisation JSON
- Debug

### Docker

**Images de base :**

- `node:22-alpine` - Production
- `mysql:8` - Base de données

---

## 8. Diagrammes d'Architecture

### 8.1 Diagramme de Haut Niveau

```
┌─────────────────────────────────────────────────────────────────┐
│                      UTILISATEURS                               │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│   │Visiteur  │  │Participant│  │Organisateur│ │  Admin  │       │
│   └────┬─────┘  └────┬─────┘  └────┬──────┘  └────┬─────┘       │
└────────┼─────────────┼─────────────┼──────────────┼─────────────┘
         │             │             │              │
         └─────────────┴─────────────┴──────────────┘
                       │ HTTPS
         ┌─────────────▼─────────────────────────────┐
         │         REVERSE PROXY                      │
         │         (Nginx/Traefik)                    │
         └─────────────┬─────────────────────────────┘
                       │
         ┌─────────────▼─────────────────────────────┐
         │       NUXT 4 APPLICATION                   │
         │  ┌─────────────────────────────────────┐  │
         │  │   FRONTEND (Vue 3 + SSR)            │  │
         │  │  - Pages (File-based routing)       │  │
         │  │  - Components (Modular)             │  │
         │  │  - Stores (Pinia)                   │  │
         │  │  - Composables (Hooks)              │  │
         │  └─────────────────────────────────────┘  │
         │  ┌─────────────────────────────────────┐  │
         │  │   BACKEND (Nitro + H3)              │  │
         │  │  - API Routes (/api/*)              │  │
         │  │  - Middleware (Auth, Permissions)   │  │
         │  │  - Utils (Services, Helpers)        │  │
         │  │  - Tasks (Cron)                     │  │
         │  └─────────────────────────────────────┘  │
         └─────────────┬─────────────────────────────┘
                       │ Prisma Client
         ┌─────────────▼─────────────────────────────┐
         │         MYSQL DATABASE                     │
         │  - 67 modèles                              │
         │  - Relations complexes                     │
         │  - Indexes optimisés                       │
         └─────────────┬─────────────────────────────┘
                       │
         ┌─────────────▼─────────────────────────────┐
         │      SERVICES EXTERNES                     │
         │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
         │  │  SMTP    │ │HelloAsso │ │Anthropic │  │
         │  │ (Emails) │ │(Billetterie)│   (IA)  │  │
         │  └──────────┘ └──────────┘ └──────────┘  │
         │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
         │  │Nominatim │ │ Web Push │ │ DeepL    │  │
         │  │(Geocoding)│ │  (Notifs)│ │(Traduc.) │  │
         │  └──────────┘ └──────────┘ └──────────┘  │
         └─────────────────────────────────────────┘
```

### 8.2 Architecture Détaillée par Couches

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  PAGES                                                     │  │
│ │  - Public (index, login, register)                        │  │
│ │  - Authenticated (profile, favorites, my-conventions)     │  │
│ │  - Conventions ([id]/edit)                                │  │
│ │  - Editions ([id]/index, carpool, volunteers, workshops)  │  │
│ │  - Gestion ([id]/gestion/*)                               │  │
│ │  - Admin (users, conventions, feedback, logs, backups)    │  │
│ └─────────────────────┬──────────────────────────────────────┘  │
│                       │                                          │
│ ┌─────────────────────▼──────────────────────────────────────┐  │
│ │  COMPONENTS (100+ composants modulaires)                  │  │
│ │  - Global (EditionCard, AppHeader, HomeMap)               │  │
│ │  - UI (UserAvatar, DateTimePicker, ImageUpload)           │  │
│ │  - Domain-specific (edition/*, volunteers/*, ticketing/*) │  │
│ └─────────────────────┬──────────────────────────────────────┘  │
│                       │                                          │
│ ┌─────────────────────▼──────────────────────────────────────┐  │
│ │  COMPOSABLES (30+ hooks réutilisables)                    │  │
│ │  - Auth (useAccessControlPermissions)                     │  │
│ │  - UI (useModal, useDebounce, useImageLoader)             │  │
│ │  - Domain (useVolunteerTeams, useMeals, useCalendar)      │  │
│ └─────────────────────┬──────────────────────────────────────┘  │
│                       │                                          │
│ ┌─────────────────────▼──────────────────────────────────────┐  │
│ │  STORES (Pinia)                                            │  │
│ │  - auth (user, isAuthenticated, login, logout)            │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  MIDDLEWARE                                                │  │
│ │  - authenticated.ts (protection routes)                   │  │
│ │  - super-admin.ts (admin uniquement)                      │  │
│ │  - load-translations.global.ts (i18n lazy)                │  │
│ └────────────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  API ROUTES (200+ endpoints RESTful)                      │  │
│ │  /auth/* - Authentification                               │  │
│ │  /profile/* - Profil utilisateur                          │  │
│ │  /conventions/* - CRUD conventions                        │  │
│ │  /conventions/[id]/collaborators/* - Collaborateurs       │  │
│ │  /editions/[id]/* - Éditions complètes                    │  │
│ │    - carpool-offers/*, carpool-requests/*                 │  │
│ │    - lost-found/*                                          │  │
│ │    - volunteers/*, volunteer-teams/*, volunteer-time-slots/*│ │
│ │    - ticketing/* (tiers, options, quotas, orders)         │  │
│ │    - workshops/*, artists/*, shows/*, meals/*             │  │
│ │  /notifications/* - Notifications (in-app, push, SSE)     │  │
│ │  /admin/* - Administration complète                       │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     BUSINESS LAYER                              │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  PERMISSIONS SYSTEM                                        │  │
│ │  - permissions.ts (système central)                       │  │
│ │  - convention-permissions.ts                              │  │
│ │  - edition-permissions.ts                                 │  │
│ │  - volunteer-permissions.ts                               │  │
│ │  - access-control-permissions.ts                          │  │
│ └────────────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  SERVICES                                                  │  │
│ │  - emailService.ts (envoi emails)                         │  │
│ │  - notification-service.ts (notifications)                │  │
│ │  - push-notification-service.ts (Web Push)                │  │
│ │  - sse-manager.ts (Server-Sent Events)                    │  │
│ │  - geocoding.ts (géocodage adresses)                      │  │
│ │  - anthropic.ts / ai-providers.ts (IA)                    │  │
│ └────────────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  BUSINESS LOGIC                                            │  │
│ │  - volunteer-scheduler.ts (affectation auto)              │  │
│ │  - volunteer-application-diff.ts (comparaison)            │  │
│ │  - volunteer-meals.ts (gestion repas)                     │  │
│ │  - collaborator-management.ts (collaborateurs)            │  │
│ │  - editions/ticketing/* (billetterie)                     │  │
│ │  - editions/volunteers/* (bénévoles)                      │  │
│ └────────────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  VALIDATION & UTILITIES                                    │  │
│ │  - validation-schemas.ts (Zod)                            │  │
│ │  - date-utils.ts, date-helpers.ts                         │  │
│ │  - error-logger.ts (logs API)                             │  │
│ │  - rate-limiter.ts, api-rate-limiter.ts                  │  │
│ │  - encryption.ts, email-hash.ts, jwt.ts                  │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     DATA ACCESS LAYER                           │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  PRISMA CLIENT (ORM)                                       │  │
│ │  - prisma.ts (singleton)                                  │  │
│ │  - Type-safe queries                                       │  │
│ │  - Auto-generated types                                    │  │
│ │  - Transactions support                                    │  │
│ └────────────────────┬─────────────────────────────────────────┘│
└──────────────────────┼──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                     DATABASE LAYER                              │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  MYSQL 8.x                                                 │  │
│ │  - 67 modèles (User, Convention, Edition, etc.)           │  │
│ │  - Relations N:M avec tables jointures                    │  │
│ │  - Indexes optimisés                                       │  │
│ │  - Full-text search (potentiel)                           │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Flux de Requête Complet

```
┌───────────────────────────────────────────────────────────────┐
│  1. CLIENT (Navigateur)                                       │
│     - Utilisateur clique "Soumettre candidature bénévole"    │
└─────────────┬─────────────────────────────────────────────────┘
              │ POST /api/editions/123/volunteers/applications
              │ Body: { diet: "vegetarian", ... }
┌─────────────▼─────────────────────────────────────────────────┐
│  2. NUXT MIDDLEWARE                                           │
│     - load-translations.global.ts (charge traductions)        │
└─────────────┬─────────────────────────────────────────────────┘
              │
┌─────────────▼─────────────────────────────────────────────────┐
│  3. API ROUTE HANDLER                                         │
│     server/api/editions/[id]/volunteers/applications.post.ts  │
│     - Récupère session utilisateur (getUserSession())         │
│     - Vérifie authentification                                │
└─────────────┬─────────────────────────────────────────────────┘
              │
┌─────────────▼─────────────────────────────────────────────────┐
│  4. VALIDATION                                                │
│     - Zod schema validation (body)                            │
│     - Validation business (dates, quotas, etc.)               │
└─────────────┬─────────────────────────────────────────────────┘
              │
┌─────────────▼─────────────────────────────────────────────────┐
│  5. PERMISSIONS CHECK                                         │
│     server/utils/permissions/volunteer-permissions.ts         │
│     - checkVolunteerApplicationPermission(user, edition)      │
│     - Vérifie si bénévolat ouvert                             │
└─────────────┬─────────────────────────────────────────────────┘
              │ Autorisé
┌─────────────▼─────────────────────────────────────────────────┐
│  6. BUSINESS LOGIC                                            │
│     server/utils/editions/volunteers/applications.ts          │
│     - createVolunteerApplication(data)                        │
│     - Génère QR code unique                                   │
│     - Calcule statut (PENDING)                                │
└─────────────┬─────────────────────────────────────────────────┘
              │
┌─────────────▼─────────────────────────────────────────────────┐
│  7. DATA ACCESS (Prisma)                                      │
│     prisma.editionVolunteerApplication.create({              │
│       data: { userId, editionId, diet, ... }                 │
│     })                                                        │
└─────────────┬─────────────────────────────────────────────────┘
              │
┌─────────────▼─────────────────────────────────────────────────┐
│  8. MYSQL DATABASE                                            │
│     INSERT INTO EditionVolunteerApplication ...               │
└─────────────┬─────────────────────────────────────────────────┘
              │ Application créée
┌─────────────▼─────────────────────────────────────────────────┐
│  9. SIDE EFFECTS                                              │
│     - notification-service.ts : Notifier organisateur        │
│     - emailService.ts : Email confirmation (si config)       │
│     - sse-manager.ts : Broadcast SSE (temps réel)            │
└─────────────┬─────────────────────────────────────────────────┘
              │
┌─────────────▼─────────────────────────────────────────────────┐
│  10. RESPONSE                                                 │
│      { status: 201, data: { id, userId, status, ... } }      │
└─────────────┬─────────────────────────────────────────────────┘
              │
┌─────────────▼─────────────────────────────────────────────────┐
│  11. CLIENT (Navigateur)                                      │
│      - Affiche toast succès                                   │
│      - Redirection ou refresh liste candidatures              │
│      - MAJ state local (Pinia store potentiel)                │
└───────────────────────────────────────────────────────────────┘
```

### 8.4 Architecture Hiérarchique des Fichiers

```
convention-de-jonglerie/
│
├── 📁 app/                       # FRONTEND APPLICATION
│   ├── 📁 pages/                 # Routes (file-based routing)
│   │   ├── index.vue             # Page d'accueil
│   │   ├── login.vue, register.vue
│   │   ├── 📁 conventions/
│   │   │   ├── add.vue
│   │   │   └── [id]/
│   │   │       └── edit.vue
│   │   ├── 📁 editions/
│   │   │   ├── add.vue
│   │   │   └── [id]/
│   │   │       ├── index.vue
│   │   │       ├── carpool.vue
│   │   │       ├── volunteers/index.vue
│   │   │       └── gestion/
│   │   │           ├── index.vue
│   │   │           ├── volunteers/*.vue
│   │   │           └── ticketing/*.vue
│   │   └── 📁 admin/
│   │       ├── index.vue
│   │       ├── users/index.vue
│   │       └── ...
│   ├── 📁 components/            # Composants (100+)
│   │   ├── EditionCard.vue
│   │   ├── AppHeader.vue
│   │   ├── 📁 edition/
│   │   │   ├── Form.vue
│   │   │   ├── Header.vue
│   │   │   ├── 📁 volunteer/
│   │   │   │   ├── ApplicationModal.vue
│   │   │   │   ├── Table.vue
│   │   │   │   └── planning/*.vue
│   │   │   └── 📁 carpool/
│   │   │       └── *.vue
│   │   ├── 📁 ticketing/
│   │   │   └── *.vue
│   │   ├── 📁 volunteers/
│   │   │   └── *.vue
│   │   ├── 📁 ui/
│   │   │   └── *.vue
│   │   └── ...
│   ├── 📁 composables/           # Hooks Vue (30+)
│   │   ├── useAuthStore.ts
│   │   ├── useVolunteerTeams.ts
│   │   └── ...
│   ├── 📁 stores/                # Pinia stores
│   │   └── auth.ts
│   ├── 📁 middleware/            # Middleware navigation
│   │   ├── authenticated.ts
│   │   └── super-admin.ts
│   ├── 📁 layouts/               # Layouts
│   ├── 📁 plugins/               # Plugins
│   ├── 📁 types/                 # Types TypeScript
│   ├── 📁 utils/                 # Utilitaires frontend
│   └── 📁 assets/                # Assets
│       └── css/main.css
│
├── 📁 server/                    # BACKEND API
│   ├── 📁 api/                   # API Routes (200+ endpoints)
│   │   ├── 📁 auth/
│   │   │   ├── register.post.ts
│   │   │   ├── login.post.ts
│   │   │   └── ...
│   │   ├── 📁 profile/
│   │   ├── 📁 conventions/
│   │   │   ├── index.post.ts
│   │   │   └── [id]/
│   │   │       ├── index.get.ts
│   │   │       ├── index.put.ts
│   │   │       ├── index.delete.ts
│   │   │       └── collaborators/
│   │   │           └── *.ts
│   │   ├── 📁 editions/
│   │   │   └── [id]/
│   │   │       ├── volunteers/
│   │   │       │   ├── applications/*.ts
│   │   │       │   ├── teams/*.ts
│   │   │       │   └── notification/*.ts
│   │   │       ├── ticketing/
│   │   │       │   ├── tiers/*.ts
│   │   │       │   ├── options/*.ts
│   │   │       │   └── orders/*.ts
│   │   │       ├── carpool-offers/*.ts
│   │   │       ├── workshops/*.ts
│   │   │       └── artists/*.ts
│   │   ├── 📁 admin/
│   │   │   ├── users/*.ts
│   │   │   ├── feedback/*.ts
│   │   │   ├── error-logs/*.ts
│   │   │   └── ...
│   │   └── 📁 notifications/
│   ├── 📁 utils/                 # Utilitaires backend
│   │   ├── 📁 permissions/
│   │   │   ├── permissions.ts
│   │   │   ├── convention-permissions.ts
│   │   │   ├── edition-permissions.ts
│   │   │   └── volunteer-permissions.ts
│   │   ├── 📁 editions/
│   │   │   ├── volunteers/
│   │   │   │   ├── applications.ts
│   │   │   │   └── teams.ts
│   │   │   └── ticketing/
│   │   │       ├── helloasso.ts
│   │   │       └── tiers.ts
│   │   ├── prisma.ts
│   │   ├── emailService.ts
│   │   ├── notification-service.ts
│   │   ├── push-notification-service.ts
│   │   ├── sse-manager.ts
│   │   ├── geocoding.ts
│   │   ├── anthropic.ts
│   │   ├── ai-providers.ts
│   │   └── ...
│   ├── 📁 middleware/            # API middleware
│   ├── 📁 emails/                # Templates email
│   ├── 📁 routes/                # Routes custom
│   └── 📁 tasks/                 # Tâches cron
│
├── 📁 prisma/                    # DATABASE
│   ├── schema.prisma             # Schéma BDD (67 modèles)
│   └── migrations/               # Migrations (40+)
│
├── 📁 i18n/                      # INTERNATIONALISATION
│   ├── i18n.config.ts
│   └── locales/
│       ├── en/
│       │   ├── common.json
│       │   ├── app.json
│       │   ├── auth.json
│       │   └── ... (14 domaines)
│       ├── fr/, de/, es/, ...    # 13 langues
│
├── 📁 test/                      # TESTS
│   ├── unit/
│   ├── nuxt/
│   │   ├── pages/
│   │   ├── components/
│   │   └── server/api/
│   ├── integration/
│   └── e2e/
│
├── 📁 docs/                      # DOCUMENTATION
│   ├── AUTH_SESSIONS.md
│   ├── COLLABORATOR_PERMISSIONS.md
│   ├── NOTIFICATION_SYSTEM.md
│   ├── ticketing/*.md
│   └── ...
│
├── 📁 scripts/                   # SCRIPTS UTILITAIRES
│   ├── manage-admin.ts
│   ├── check-i18n.js
│   ├── translate-with-deepl.js
│   └── ...
│
├── 📁 public/                    # ASSETS STATIQUES
│   ├── uploads/
│   ├── logos/
│   └── favicons/
│
├── 📄 nuxt.config.ts             # Configuration Nuxt
├── 📄 vitest.config.ts           # Configuration tests
├── 📄 package.json               # Dépendances
├── 📄 tsconfig.json              # Configuration TS
├── 📄 docker-compose.*.yml       # Configurations Docker
├── 📄 Dockerfile                 # Image Docker
├── 📄 .env                       # Variables env (non versionné)
├── 📄 .gitignore
├── 📄 README.md
└── 📄 CLAUDE.md                  # Instructions Claude Code
```

---

## 9. Insights Clés et Recommandations

### 9.1 Points Forts de l'Architecture

**Architecture Moderne et Robuste :**

- ✅ **Nuxt 4** : Framework full-stack moderne avec SSR
- ✅ **TypeScript** : Type-safety complète
- ✅ **Prisma** : ORM moderne avec migrations
- ✅ **Architecture modulaire** : Composants, composables, utils bien séparés
- ✅ **File-based routing** : Organisation intuitive

**Système de Permissions Sophistiqué :**

- ✅ **8 permissions granulaires** au niveau convention
- ✅ **Permissions par édition** pour granularité fine
- ✅ **Historique traçable** des changements
- ✅ **3 niveaux** : Admin global, Convention, Édition
- ✅ **Flexible** : Titres personnalisés collaborateurs

**Système Bénévoles Complet :**

- ✅ **Candidatures détaillées** (30+ champs)
- ✅ **Équipes multiples** avec affectations
- ✅ **Planning automatisé** avec détection chevauchements
- ✅ **Notifications groupées** avec confirmations
- ✅ **Repas et consignes** par équipe
- ✅ **Contrôle d'accès** QR code

**Billetterie Flexible :**

- ✅ **Mode interne** complet (tiers, options, quotas)
- ✅ **Intégration HelloAsso** avec sync automatique
- ✅ **Objets consignés** (gobelets, etc.)
- ✅ **Champs personnalisés** par tarif
- ✅ **Contrôle d'accès** QR code temps réel
- ✅ **Statistiques** en temps réel

**i18n Avancé :**

- ✅ **13 langues** supportées
- ✅ **Lazy loading** par domaine (optimisation bundles)
- ✅ **Structure modulaire** (14 domaines)
- ✅ **Traduction automatique** (DeepL)
- ✅ **Scripts de vérification** complets

**Notifications Multi-Canaux :**

- ✅ **In-app** avec badge
- ✅ **Server-Sent Events** (temps réel)
- ✅ **Push notifications** (Web Push API)
- ✅ **Préférences utilisateur**

**Tests Complets :**

- ✅ **Multi-projets Vitest** (unit, nuxt, integration, e2e)
- ✅ **Coverage** bon (voir CI/CD)
- ✅ **Tests intégration** avec BDD réelle

**DevOps & Tooling :**

- ✅ **Docker** multi-environnements (dev, test, prod)
- ✅ **CI/CD** GitHub Actions
- ✅ **Scripts admin** (manage-admin, geocoding, etc.)
- ✅ **Backups automatisés**
- ✅ **Logs erreurs** système complet

### 9.2 Qualité du Code

**Code bien structuré :**

- ✅ **Séparation des préoccupations** claire (frontend/backend)
- ✅ **Composants modulaires** réutilisables
- ✅ **Composables** bien nommés et documentés
- ✅ **Utilitaires** logiquement organisés
- ✅ **Validation** Zod côté serveur

**Conventions :**

- ✅ **Naming** cohérent (camelCase, PascalCase)
- ✅ **File structure** conventionnelle Nuxt
- ✅ **ESLint + Prettier** configurés
- ✅ **TypeScript strict** (type-safety)

**Documentation :**

- ✅ **README** complet
- ✅ **40+ docs** dans `/docs`
- ✅ **CLAUDE.md** pour instructions IA
- ✅ **Commentaires** dans code critique

### 9.3 Améliorations Potentielles

#### Sécurité

**1. Rate Limiting**

- ⚠️ **Actuel** : `rate-limiter.ts` et `api-rate-limiter.ts` existent mais utilisation limitée
- 💡 **Recommandation** : Implémenter rate limiting sur tous endpoints sensibles :
  - Auth (login, register, verify-email) : 5 requêtes/min
  - API mutations : 100 requêtes/min
  - Upload fichiers : 10 requêtes/min
- 🛠️ **Outil** : `@nuxt/server-rate-limit` ou Redis-based

**2. Input Sanitization**

- ⚠️ **Actuel** : Validation Zod côté serveur, `rehype-sanitize` pour Markdown
- 💡 **Recommandation** : Ajouter sanitization explicite pour :
  - HTML injecté dans descriptions
  - Upload fichiers (validation MIME types + contenu)
  - SQL injection (Prisma protège mais double vérification)
- 🛠️ **Outil** : `dompurify` côté client, `validator.js`

**3. CSRF Protection**

- ✅ **Actuel** : Sessions scellées (nuxt-auth-utils) offrent protection
- 💡 **Recommandation** : Vérifier si protection CSRF explicite (tokens) nécessaire pour formulaires critiques

**4. Content Security Policy (CSP)**

- ⚠️ **Actuel** : Non configuré explicitement
- 💡 **Recommandation** : Ajouter headers CSP dans `nuxt.config.ts` :
  ```typescript
  nitro: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; ..."
    }
  }
  ```

**5. Secrets Management**

- ⚠️ **Actuel** : `.env` non versionné (✅) mais pas de rotation
- 💡 **Recommandation** :
  - Utiliser vault (HashiCorp Vault, AWS Secrets Manager)
  - Rotation automatique `NUXT_SESSION_PASSWORD`
  - Audits réguliers secrets exposés

#### Performance

**1. Caching Stratégie**

- ⚠️ **Actuel** : Cache assets statiques (30 jours), pas de cache API
- 💡 **Recommandation** :
  - **Cache Redis** : Données fréquemment lues (conventions, éditions publiques)
  - **Cache HTTP** : Headers `Cache-Control` sur GET endpoints
  - **CDN** : CloudFlare, Fastly pour assets statiques
  - **ISR** (Incremental Static Regeneration) pour pages publiques
- 🛠️ **Outil** : `ioredis`, `@nuxtjs/redis`

**2. Database Indexing**

- ⚠️ **Actuel** : Indexes Prisma basiques (@@index sur foreign keys)
- 💡 **Recommandation** :
  - Analyser requêtes lentes (`EXPLAIN` MySQL)
  - Ajouter indexes composites pour requêtes fréquentes :
    ```prisma
    @@index([conventionId, status]) // Candidatures bénévoles
    @@index([editionId, startDate]) // Créneaux planning
    ```
  - Full-text search index pour recherche conventions/éditions

**3. Lazy Loading Images**

- ✅ **Actuel** : `@nuxt/image` avec lazy loading
- 💡 **Recommandation** :
  - Vérifier placeholder LQIP (Low-Quality Image Placeholder)
  - Formats modernes (WebP, AVIF) configurés
  - `srcset` responsive

**4. Code Splitting**

- ✅ **Actuel** : Nuxt 4 fait code splitting automatique
- 💡 **Recommandation** :
  - Analyser bundles (`npx nuxi analyze`)
  - Lazy load bibliothèques volumineuses (FullCalendar, Leaflet)
  - Dynamic imports pour routes admin

**5. SSR vs SSG**

- ⚠️ **Actuel** : SSR pour toutes pages
- 💡 **Recommandation** :
  - **SSG** pages statiques (privacy-policy, landing)
  - **ISR** pages semi-statiques (liste éditions publiques)
  - **CSR** pages admin (pas SEO critique)

#### Scalabilité

**1. Architecture Microservices (Long terme)**

- ⚠️ **Actuel** : Monolithe (acceptable pour taille actuelle)
- 💡 **Recommandation** (si croissance forte) :
  - Séparer services :
    - **Auth Service** : Authentification centralisée
    - **Notification Service** : Notifications (SSE, Push, Email)
    - **Ticketing Service** : Billetterie isolée
  - Communication : API Gateway + Message Queue (RabbitMQ, Kafka)

**2. Database Scaling**

- ⚠️ **Actuel** : MySQL single instance
- 💡 **Recommandation** :
  - **Réplication** : Master-slave (read replicas)
  - **Sharding** : Par conventionId si très gros volume
  - **Pooling** : Connection pooling Prisma configuré

**3. Horizontal Scaling**

- ⚠️ **Actuel** : Single server
- 💡 **Recommandation** :
  - Load balancer (Nginx, HAProxy)
  - Sessions Redis partagées (remplacer cookies)
  - Stateless API (déjà le cas)

**4. CDN & Edge Computing**

- 💡 **Recommandation** :
  - CDN pour assets statiques (images, JS, CSS)
  - Edge functions pour géolocalisation (proche utilisateurs)
  - Vercel Edge, CloudFlare Workers

#### Monitoring & Observabilité

**1. APM (Application Performance Monitoring)**

- ⚠️ **Actuel** : Logs erreurs API en BDD
- 💡 **Recommandation** :
  - **Sentry** : Tracking erreurs frontend + backend
  - **DataDog / New Relic** : Monitoring performances
  - **LogRocket** : Session replay

**2. Metrics & Dashboards**

- 💡 **Recommandation** :
  - **Prometheus + Grafana** : Métriques serveur
  - **Custom metrics** : Candidatures bénévoles/jour, commandes/heure, etc.
  - **Alerting** : Slack, email si anomalies

**3. Distributed Tracing**

- 💡 **Recommandation** (si microservices) :
  - **OpenTelemetry** : Traçage requêtes cross-services
  - **Jaeger** : Visualisation traces

**4. Logs Centralisés**

- ⚠️ **Actuel** : Logs BDD + console
- 💡 **Recommandation** :
  - **ELK Stack** (Elasticsearch, Logstash, Kibana)
  - **Loki + Grafana** (alternative plus légère)
  - Logs structurés (JSON format)

#### Fonctionnalités

**1. Recherche Full-Text**

- ⚠️ **Actuel** : Filtres basiques (SQL LIKE)
- 💡 **Recommandation** :
  - **Elasticsearch** : Recherche avancée conventions/éditions
  - **Algolia** : Alternative SaaS
  - Facettes (filtres pays, dates, services)

**2. Analytics Utilisateur**

- ⚠️ **Actuel** : Stats basiques (nombre éditions, bénévoles)
- 💡 **Recommandation** :
  - **Google Analytics 4** : Tracking comportement
  - **Matomo** : Alternative privacy-friendly
  - **Custom analytics** : Tunnels conversions (inscription → candidature bénévole)

**3. Webhooks**

- 💡 **Recommandation** :
  - Permettre organisateurs configurer webhooks
  - Events : nouvelle candidature, nouvelle commande, etc.
  - Intégrations tierces (Slack, Discord, Zapier)

**4. API Publique**

- 💡 **Recommandation** (long terme) :
  - API REST publique documentée (OpenAPI/Swagger)
  - Rate limiting + API keys
  - Use cases : apps mobiles tierces, intégrations

#### Tests

**1. Coverage**

- ⚠️ **Actuel** : Tests existent mais coverage partiel
- 💡 **Recommandation** :
  - Target : 80% coverage minimum
  - Focus tests critiques :
    - Permissions system
    - Billetterie (calculs, quotas)
    - Bénévoles (affectations)

**2. Tests E2E**

- ⚠️ **Actuel** : Projet e2e défini mais vide
- 💡 **Recommandation** :
  - **Playwright** : Tests E2E navigateur
  - Scénarios critiques :
    - Inscription → Candidature bénévole → Acceptation
    - Création convention → Édition → Bénévole
    - Achat billet (interne) → Contrôle accès

**3. Tests Charge**

- 💡 **Recommandation** :
  - **k6**, **Apache JMeter** : Tests de charge
  - Simuler 1000+ utilisateurs simultanés
  - Identifier bottlenecks

**4. Tests Mutation**

- 💡 **Recommandation** :
  - **Stryker Mutator** : Vérifier qualité tests
  - Detect code non testé

#### DevOps

**1. CI/CD Avancé**

- ✅ **Actuel** : GitHub Actions tests
- 💡 **Recommandation** :
  - **Déploiement automatique** : Staging + Production
  - **Blue-Green deployment** : Zero downtime
  - **Rollback automatique** si tests échouent

**2. Infrastructure as Code**

- 💡 **Recommandation** :
  - **Terraform** : Provisionning infrastructure
  - **Ansible** : Configuration serveurs
  - Versioning infrastructure

**3. Container Orchestration**

- ⚠️ **Actuel** : Docker Compose (dev/prod)
- 💡 **Recommandation** (si scale) :
  - **Kubernetes** : Orchestration containers
  - **Docker Swarm** : Alternative plus simple

**4. Backups**

- ✅ **Actuel** : Système backup manuel (`/api/admin/backup`)
- 💡 **Recommandation** :
  - Backups automatisés (cron quotidien)
  - Stockage distant (S3, BackBlaze B2)
  - Rotation backups (7j, 4 semaines, 12 mois)
  - Tests restore réguliers

### 9.4 Maintenabilité

**Points Positifs :**

- ✅ Documentation complète (40+ docs)
- ✅ Code TypeScript (maintenabilité)
- ✅ Conventions cohérentes
- ✅ Composants réutilisables
- ✅ Tests automatisés

**Recommandations :**

**1. Refactoring**

- 💡 Audit code duplications (DRY)
- 💡 Simplifier composants complexes (>300 lignes)
- 💡 Extraire logique métier dans utils

**2. Documentation Code**

- 💡 JSDoc pour fonctions publiques complexes
- 💡 README par répertoire majeur
- 💡 ADR (Architecture Decision Records) pour décisions importantes

**3. Dependency Management**

- 💡 Audits sécurité réguliers (`npm audit`)
- 💡 Updates dépendances (`npm outdated`)
- 💡 Renovate Bot : Updates automatiques PRs

**4. Code Reviews**

- 💡 Reviews obligatoires avant merge
- 💡 Checklist review (tests, docs, sécurité)
- 💡 Pair programming pour fonctionnalités critiques

### 9.5 Considérations Sécurité Spécifiques

**1. Upload Fichiers**

- ✅ Stockage local (`/uploads`)
- ⚠️ Validation MIME types basique
- 💡 **Recommandation** :
  - Validation contenu fichier (pas juste extension)
  - Antivirus scan (ClamAV)
  - Limite taille stricte
  - Stockage S3 (hors serveur)

**2. Permissions Collaborateurs**

- ✅ Système granulaire sophistiqué
- ✅ Historique traçable
- 💡 **Recommandation** :
  - Audit logs accès sensibles
  - Alertes tentatives accès non autorisés

**3. Data Privacy (RGPD)**

- ⚠️ **Actuel** : Privacy policy basique
- 💡 **Recommandation** :
  - **Consentement cookies** (banner)
  - **Export données utilisateur** (RGPD article 15)
  - **Suppression compte** (RGPD article 17) - existe déjà (`useUserDeletion`)
  - **Anonymisation données** après suppression

**4. XSS Protection**

- ✅ `rehype-sanitize` pour Markdown
- 💡 **Recommandation** :
  - Vérifier tous points injection HTML
  - CSP headers
  - `v-html` limité et sanitized

**5. Authentification Multi-Facteurs (2FA)**

- ⚠️ **Actuel** : Password uniquement
- 💡 **Recommandation** (optionnel pour admins) :
  - TOTP (Google Authenticator, Authy)
  - SMS (Twilio)
  - Clés sécurité (WebAuthn)

### 9.6 Performances Mesurables

**Métriques Actuelles (à mesurer) :**

- ⏱️ **Time to First Byte (TTFB)** : ?
- ⏱️ **First Contentful Paint (FCP)** : ?
- ⏱️ **Largest Contentful Paint (LCP)** : ?
- ⏱️ **Cumulative Layout Shift (CLS)** : ?
- ⏱️ **Total Blocking Time (TBT)** : ?

**Outils Recommandés :**

- Lighthouse (Chrome DevTools)
- WebPageTest
- GTmetrix
- Google PageSpeed Insights

**Objectifs :**

- LCP < 2.5s
- FCP < 1.8s
- CLS < 0.1
- TBT < 300ms

### 9.7 Recommandations Prioritaires

**🔴 Haute Priorité (Court terme) :**

1. **Rate Limiting** sur endpoints authentification
2. **Sentry** pour monitoring erreurs production
3. **Redis Cache** pour requêtes fréquentes
4. **Tests E2E** scénarios critiques
5. **CSP Headers** sécurité

**🟡 Moyenne Priorité (Moyen terme) :**

1. **Elasticsearch** recherche avancée
2. **Backups automatisés** avec stockage distant
3. **Analytics** comportement utilisateurs
4. **Coverage tests** 80%
5. **API Publique** documentée

**🟢 Basse Priorité (Long terme) :**

1. **Microservices** (si croissance forte)
2. **Kubernetes** orchestration
3. **2FA** authentification
4. **Webhooks** intégrations tierces
5. **Infrastructure as Code**

---

## Conclusion

**Convention de Jonglerie** est une application full-stack moderne, robuste et bien architecturée. Le code est de qualité, la structure est claire, et la documentation est complète. Les systèmes de permissions, bénévoles et billetterie sont particulièrement sophistiqués.

**Forces Principales :**

- Architecture moderne (Nuxt 4, TypeScript, Prisma)
- Système de permissions granulaire
- Internationalisation avancée (13 langues, lazy loading)
- Système bénévoles complet
- Billetterie flexible (interne + HelloAsso)
- Notifications multi-canaux
- Tests automatisés

**Axes d'Amélioration Prioritaires :**

1. Sécurité (rate limiting, CSP, 2FA optionnel)
2. Performance (caching, indexes BDD)
3. Monitoring (Sentry, métriques)
4. Tests (coverage, E2E)

Le projet est **prêt pour la production** avec quelques améliorations sécurité/performance recommandées. La scalabilité est bonne jusqu'à plusieurs milliers d'utilisateurs sans changements majeurs.

---

**Dernière mise à jour** : 2025-11-03
**Version** : 1.0
**Auteur** : Analyse automatisée Claude Code
