# Système de Notifications

## Vue d'ensemble

Le système de notifications de l'application permet d'informer les utilisateurs en temps réel des événements importants (candidatures de bénévolat, covoiturage, arrivées d'artistes, messagerie, etc.). Il combine plusieurs technologies pour offrir une expérience optimale :

- **Notifications en base de données** (persistantes)
- **Notifications temps réel** via Server-Sent Events (SSE)
- **Notifications push** via Firebase Cloud Messaging (FCM)
- **Notifications par email** (templates Vue Email)
- **Fallback polling** en cas d'indisponibilité SSE

## Architecture

### 1. Stack technologique

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Nuxt)                          │
├─────────────────────────────────────────────────────────────┤
│  • NotificationCenter.vue (UI)                               │
│  • useNotificationStream.ts (SSE Client)                     │
│  • notificationsStore (Pinia)                                │
│  • Service Worker (Push Notifications)                       │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (Nitro)                          │
├─────────────────────────────────────────────────────────────┤
│  • /api/notifications/* (REST API)                           │
│  • notification-service.ts (Business Logic)                  │
│  • notification-stream-manager.ts (SSE Server)               │
│  • unified-push-service.ts (Firebase FCM)                    │
│  • firebase-admin.ts (Firebase Admin SDK)                    │
│  • emailService.ts + Templates Vue Email                     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   BASE DE DONNÉES (MySQL)                    │
├─────────────────────────────────────────────────────────────┤
│  • Notification (table principale)                           │
│  • NotificationPreference (préférences utilisateur)          │
│  • FcmToken (tokens Firebase par utilisateur)                │
│  • User (informations utilisateur)                           │
└─────────────────────────────────────────────────────────────┘
```

### 2. Flux de données

#### Création d'une notification

```
1. Événement déclenché (ex: acceptation candidature)
         ↓
2. NotificationHelpers.volunteerAccepted()
         ↓
3. NotificationService.create()
         ↓
4. Vérification des préférences utilisateur
         ↓
5. Sauvegarde en base de données
         ↓
6. PARALLÈLE :
   ├─→ Envoi SSE (temps réel)
   ├─→ Envoi Push Notification (si activé)
   └─→ Envoi Email (si préférence activée)
```

## Types de notifications

### Énumération `NotificationType`

```typescript
enum NotificationType {
  INFO      // Information générale
  SUCCESS   // Action réussie
  WARNING   // Avertissement
  ERROR     // Erreur
}
```

### Catégories de notifications

| Catégorie   | Description           | Exemples                              |
| ----------- | --------------------- | ------------------------------------- |
| `system`    | Notifications système | Bienvenue, erreur système             |
| `volunteer` | Bénévolat             | Candidature acceptée/refusée/modifiée |
| `carpool`   | Covoiturage           | Réservation reçue/acceptée/annulée    |
| `edition`   | Éditions              | Rappel d'événement                    |
| `artist`    | Artistes              | Arrivée d'un artiste                  |

### Types de notifications (préférences utilisateur)

Définis dans `notification-preferences.ts`, ces types permettent à l'utilisateur de contrôler ses préférences par catégorie :

```typescript
const NOTIFICATION_TYPES = [
  'volunteer_application_accepted',
  'volunteer_application_rejected',
  'volunteer_application_modified',
  'volunteer_application_submitted',
  'volunteer_schedule',
  'carpool_booking_received',
  'carpool_booking_accepted',
  'carpool_booking_rejected',
  'carpool_booking_cancelled',
  'event_reminder',
  'artist_arrival',
  'edition_published',
  'show_call_opened',
  'show_application_submitted',
  'show_application_accepted',
  'show_application_rejected',
  'system_announcement',
] as const
```

## API Endpoints

### GET `/api/notifications`

Récupère les notifications de l'utilisateur connecté.

**Query Parameters:**

- `limit` (number, optionnel) : Nombre de notifications à récupérer (défaut: 50, max: 100)
- `offset` (number, optionnel) : Offset pour la pagination (défaut: 0)
- `category` (string, optionnel) : Filtrer par catégorie
- `unreadOnly` (boolean, optionnel) : Uniquement les non lues

**Réponse:**

```json
{
  "success": true,
  "notifications": [
    {
      "id": 123,
      "type": "SUCCESS",
      "title": "Candidature acceptée !",
      "message": "Votre candidature pour...",
      "category": "volunteer",
      "isRead": false,
      "createdAt": "2025-10-10T10:00:00Z",
      "actionUrl": "/my-volunteer-applications",
      "actionText": "Voir ma candidature",
      "user": {
        "id": 456,
        "pseudo": "john_doe",
        "emailHash": "5d41402abc4b2a76b9719d911017c592"
      }
    }
  ],
  "unreadCount": 5,
  "pagination": {
    "limit": 50,
    "offset": 0
  }
}
```

**Note de sécurité:** L'email n'est pas retourné directement, mais hashé via `emailHash` pour protéger la vie privée.

### GET `/api/notifications/stream`

Connexion SSE pour recevoir les notifications en temps réel.

**Événements SSE:**

- `connected` : Connexion établie avec `connectionId`
- `notification` : Nouvelle notification
- `refresh` : Signal de rafraîchissement
- `heartbeat` : Keepalive (toutes les 30s)

**Exemple d'utilisation:**

```typescript
const eventSource = new EventSource('/api/notifications/stream')

eventSource.addEventListener('notification', (event) => {
  const notification = JSON.parse(event.data)
  // Traiter la notification
})
```

### PATCH `/api/notifications/:id/read`

Marque une notification comme lue.

**Réponse:**

```json
{
  "success": true,
  "notification": {
    /* ... */
  }
}
```

### PATCH `/api/notifications/:id/unread`

Marque une notification comme non lue.

### PATCH `/api/notifications/read-all`

Marque toutes les notifications comme lues.

**Query Parameters:**

- `category` (string, optionnel) : Catégorie spécifique

### DELETE `/api/notifications/:id`

Supprime une notification.

### GET `/api/notifications/preferences`

Récupère les préférences de notifications de l'utilisateur.

**Réponse:**

```json
{
  "success": true,
  "preferences": {
    "volunteer_application_accepted": {
      "enabled": true,
      "emailEnabled": true,
      "pushEnabled": true
    },
    "comment_on_edition": {
      "enabled": true,
      "emailEnabled": false,
      "pushEnabled": true
    }
    // ... autres types
  }
}
```

### PUT `/api/notifications/preferences`

Met à jour les préférences de notifications.

**Body:**

```json
{
  "volunteer_application_accepted": {
    "enabled": true,
    "emailEnabled": true,
    "pushEnabled": true
  }
}
```

### POST `/api/notifications/push/subscribe`

Enregistre un abonnement push notification.

**Body:**

```json
{
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

### POST `/api/notifications/push/unsubscribe`

Supprime un abonnement push notification.

## Service de notifications

### NotificationService

Fichier: `server/utils/notification-service.ts`

#### Méthode principale: `create()`

```typescript
await NotificationService.create({
  userId: number,
  type: NotificationType,           // INFO | SUCCESS | WARNING | ERROR
  // Traductions i18n (prioritaire)
  titleKey?: string,                // Clé i18n pour le titre
  messageKey?: string,              // Clé i18n pour le message
  translationParams?: Record<string, any>, // Paramètres de traduction
  // Texte libre (fallback)
  titleText?: string,               // Titre en texte brut
  messageText?: string,             // Message en texte brut
  // Métadonnées
  category?: string,                // 'volunteer', 'carpool', 'edition', etc.
  entityType?: string,              // 'Edition', 'User', 'CarpoolOffer', etc.
  entityId?: string,
  actionUrl?: string,
  actionTextKey?: string,           // Clé i18n pour le bouton d'action
  actionText?: string,              // Texte du bouton (fallback)
  notificationType?: string,        // Pour filtrage par préférences utilisateur
})
```

**Comportement:**

1. Vérifie les préférences utilisateur pour ce type de notification
2. Sauvegarde la notification en base de données (si autorisée)
3. Envoie via SSE aux clients connectés
4. Envoie une push notification (si autorisée et disponible)
5. Envoie un email (si autorisé pour ce type)

#### Autres méthodes

```typescript
// Récupérer les notifications
await NotificationService.getNotifications(userId, options)

// Marquer comme lue
await NotificationService.markAsRead(notificationId, userId)

// Marquer comme non lue
await NotificationService.markAsUnread(notificationId, userId)

// Marquer toutes comme lues
await NotificationService.markAllAsRead(userId, category?)

// Supprimer
await NotificationService.delete(notificationId, userId)

// Compter les non lues
await NotificationService.getUnreadCount(userId, category?)
```

### NotificationHelpers

Helpers pour créer des notifications typées selon les événements métier. Fichier : `server/utils/notification-service.ts`

#### Inventaire complet des helpers

| Helper                          | Déclencheur                              | Destinataire                     | Type    | Catégorie  |
| ------------------------------- | ---------------------------------------- | -------------------------------- | ------- | ---------- |
| `welcome`                       | Vérification email réussie               | L'utilisateur inscrit            | SUCCESS | system     |
| `newConvention`                 | Nouvelle convention créée                | Admin/organisateurs              | INFO    | convention |
| `volunteerApplicationSubmitted` | Candidature bénévole envoyée             | Le bénévole                      | SUCCESS | volunteer  |
| `volunteerAccepted`             | Candidature acceptée par organisateur    | Le bénévole                      | SUCCESS | volunteer  |
| `volunteerRejected`             | Candidature refusée par organisateur     | Le bénévole                      | WARNING | volunteer  |
| `volunteerBackToPending`        | Candidature remise en attente            | Le bénévole                      | INFO    | volunteer  |
| `eventReminder`                 | Rappel J-3 / J-7 avant événement         | Utilisateurs favoris / bénévoles | INFO    | edition    |
| `systemError`                   | Erreur système                           | Admin                            | ERROR   | system     |
| `carpoolBookingReceived`        | Demande de réservation covoiturage       | Propriétaire de l'offre          | INFO    | carpool    |
| `carpoolBookingAccepted`        | Réservation acceptée                     | Le passager                      | SUCCESS | carpool    |
| `carpoolBookingRejected`        | Réservation refusée                      | Le passager                      | WARNING | carpool    |
| `carpoolBookingCancelled`       | Annulation d'une réservation acceptée    | Propriétaire de l'offre          | INFO    | carpool    |
| `artistArrival`                 | Artiste scanné à l'entrée (billetterie)  | Gestionnaires artistes           | INFO    | artist     |
| `volunteerArrival`              | Bénévole scanné à l'entrée (billetterie) | Team leaders de ses équipes      | INFO    | volunteer  |
| `organizerAdded`                | Utilisateur ajouté comme organisateur    | L'utilisateur ajouté             | INFO    | convention |
| `editionPublished`              | Édition passe en statut PUBLISHED        | Utilisateurs ayant favorisé      | INFO    | edition    |
| `showCallOpened`                | Appel à spectacles ouvert                | Tous les utilisateurs artistes   | INFO    | artist     |
| `showApplicationSubmitted`      | Candidature artiste soumise              | Organisateurs (gestion artistes) | INFO    | artist     |
| `showApplicationAccepted`       | Candidature artiste acceptée             | L'artiste                        | SUCCESS | artist     |
| `showApplicationRejected`       | Candidature artiste refusée              | L'artiste                        | WARNING | artist     |
| `taskAssigned`                  | Tâche assignée à un utilisateur          | L'assigné                        | INFO    | task       |
| `taskCommented`                 | Nouveau commentaire sur une tâche        | Autres assignés (hors auteur)    | INFO    | task       |

#### Appels directs à NotificationService.create() (texte libre)

En plus des helpers, certaines actions utilisent `NotificationService.create()` directement avec du texte libre :

| Action                   | Déclencheur                               | Destinataire                     | Fichier                                 |
| ------------------------ | ----------------------------------------- | -------------------------------- | --------------------------------------- |
| Modification candidature | Organisateur modifie une candidature      | Le bénévole                      | `applications/[applicationId].patch.ts` |
| Message organisateur     | Organisateur envoie un message custom     | Bénévoles sélectionnés / équipes | `volunteers/notifications.post.ts`      |
| Planning disponible      | Organisateur notifie les créneaux         | Bénévoles acceptés               | `volunteers/notify-schedules.post.ts`   |
| Notification admin       | Admin crée une notification personnalisée | Utilisateur ciblé                | `admin/notifications/create.post.ts`    |

#### Notifications push messagerie (hors NotificationService)

La messagerie utilise directement `unifiedPushService.sendToUser()` sans passer par `NotificationService` :

| Action          | Déclencheur                          | Destinataire                                  | Fichier                            |
| --------------- | ------------------------------------ | --------------------------------------------- | ---------------------------------- |
| Nouveau message | Message envoyé dans une conversation | Participants (sauf expéditeur et ceux actifs) | `messenger/messages/index.post.ts` |

Le titre de la push varie selon le type de conversation (privée, groupe d'équipe, artiste, organisateurs, etc.).

#### Exemples d'utilisation des helpers

```typescript
// Bienvenue après vérification email
await NotificationHelpers.welcome(userId)

// Candidature de bénévolat acceptée
await NotificationHelpers.volunteerAccepted(
  userId,
  editionName,
  editionId,
  assignedTeams, // Optionnel: ['Accueil', 'Bar']
  organizerNote // Optionnel: "Merci pour ta candidature!"
)

// Candidature soumise
await NotificationHelpers.volunteerApplicationSubmitted(userId, editionName, editionId)

// Candidature refusée
await NotificationHelpers.volunteerRejected(userId, editionName, editionId)

// Candidature remise en attente
await NotificationHelpers.volunteerBackToPending(userId, editionName, editionId)

// Rappel d'événement (J-3 ou J-7)
await NotificationHelpers.eventReminder(userId, editionName, editionId, daysUntil)

// Erreur système
await NotificationHelpers.systemError(userId, errorMessage)

// Covoiturage - demande reçue
await NotificationHelpers.carpoolBookingReceived(userId, requesterName, offerId, seats, note?)

// Covoiturage - acceptée
await NotificationHelpers.carpoolBookingAccepted(userId, ownerName, offerId, seats, city, date)

// Covoiturage - refusée
await NotificationHelpers.carpoolBookingRejected(userId, ownerName, offerId, seats, city)

// Covoiturage - annulée par passager
await NotificationHelpers.carpoolBookingCancelled(userId, passengerName, offerId, seats, city, date)

// Arrivée d'un artiste
await NotificationHelpers.artistArrival(userId, artistName, editionId, artistId, shows?)

// Arrivée d'un bénévole
await NotificationHelpers.volunteerArrival(userId, volunteerName, volunteerPseudo, teamName, editionId, applicationId)

// Utilisateur ajouté comme organisateur
await NotificationHelpers.organizerAdded(userId, conventionName, conventionId)

// Édition publiée (notifier les favoris)
await NotificationHelpers.editionPublished(userId, editionName, conventionName, editionId)

// Appel à spectacles ouvert (notifier les artistes)
await NotificationHelpers.showCallOpened(userId, showCallName, editionName, editionId)

// Candidature artiste soumise (notifier les organisateurs)
await NotificationHelpers.showApplicationSubmitted(userId, artistName, showTitle, editionName, editionId)

// Candidature artiste acceptée
await NotificationHelpers.showApplicationAccepted(userId, showTitle, editionName, editionId)

// Candidature artiste refusée
await NotificationHelpers.showApplicationRejected(userId, showTitle, editionName, editionId)

// Tâche assignée à un utilisateur
await NotificationHelpers.taskAssigned(userId, taskTitle, editionName, editionId, taskId)

// Nouveau commentaire sur une tâche
await NotificationHelpers.taskCommented(userId, authorPseudo, taskTitle, editionName, editionId, taskId)
```

#### Helper non utilisé

> **`newConvention`** : Ce helper est défini dans le code mais n'est appelé nulle part dans l'application.

## Préférences de notifications

### Système de préférences multi-niveaux

Les utilisateurs peuvent configurer 3 niveaux pour chaque type de notification :

1. **`enabled`** : Activer/désactiver complètement ce type
2. **`emailEnabled`** : Recevoir un email pour ce type
3. **`pushEnabled`** : Recevoir une push notification pour ce type

### Valeurs par défaut

Définies dans `notification-preferences.ts` :

```typescript
const DEFAULT_PREFERENCES = {
  volunteer_application_accepted: {
    enabled: true,
    emailEnabled: true, // Email activé par défaut
    pushEnabled: true,
  },
  volunteer_application_rejected: {
    enabled: true,
    emailEnabled: true,
    pushEnabled: true,
  },
  comment_on_edition: {
    enabled: true,
    emailEnabled: false, // Pas d'email par défaut
    pushEnabled: true,
  },
  // ... autres types
}
```

### Vérification des préférences

```typescript
// Vérifier si une notification est autorisée
const allowed = await isNotificationAllowed(userId, notificationType)

// Vérifier si l'email est autorisé
const emailAllowed = await isEmailNotificationAllowed(userId, notificationType)

// Vérifier si la push notification est autorisée
const pushAllowed = await isPushNotificationAllowed(userId, notificationType)
```

### Gestion pour les utilisateurs sans préférences

Si un utilisateur n'a pas encore configuré ses préférences :

1. Les préférences par défaut sont utilisées
2. Aucune ligne n'est créée en base de données (économie de ressources)
3. Lors de la première modification, les préférences sont sauvegardées

## Notifications par email

### Templates Vue Email

Les emails sont générés à partir de composants Vue situés dans `server/emails/` :

```
server/emails/
├── BaseEmail.vue                 # Template de base
├── NotificationEmail.vue         # Notifications génériques
├── VerificationEmail.vue         # Vérification de compte
├── PasswordResetEmail.vue        # Réinitialisation mot de passe
└── AccountDeletionEmail.vue      # Suppression de compte
```

### BaseEmail.vue

Template de base partagé par tous les emails :

**Props:**

- `title` : Titre de l'email
- `headerColor` : `'primary'` (violet) ou `'error'` (rouge)

**Features:**

- Logo de l'application
- Design dark mode (violet/indigo)
- Responsive
- Footer automatique

### NotificationEmail.vue

Template pour les notifications génériques.

**Props:**

```typescript
{
  title: string,
  prenom: string,
  message: string,      // Support HTML via v-html
  actionUrl?: string,   // URL relative (ex: /my-applications)
  actionText?: string,  // Texte du bouton d'action
}
```

**Exemple d'utilisation:**

```typescript
const html = await generateNotificationEmailHtml(
  'John',
  'Candidature acceptée !',
  'Votre candidature pour "JuggleCon 2025" a été acceptée.<br><br>Équipe assignée : Accueil',
  '/my-volunteer-applications',
  'Voir ma candidature'
)

await sendEmail({
  to: 'john@example.com',
  subject: 'Candidature acceptée !',
  html,
})
```

**Note importante:** Les messages peuvent contenir du HTML (balises `<br>`, `<strong>`, etc.) qui sera rendu via `v-html`.

### Génération et envoi

```typescript
// Service d'envoi
import { sendEmail, generateNotificationEmailHtml } from './emailService'

// Générer le HTML
const html = await generateNotificationEmailHtml(prenom, title, message, actionUrl, actionText)

// Envoyer
const success = await sendEmail({
  to: 'user@example.com',
  subject: "Titre de l'email",
  html,
  text: 'Version texte brut (optionnel)',
})
```

### Configuration SMTP

Variables d'environnement :

```bash
SEND_EMAILS=true              # Activer l'envoi réel (false = simulation)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Mode simulation** (`SEND_EMAILS=false`) :

- Les emails ne sont pas envoyés
- Le contenu est affiché dans les logs console
- Utile pour le développement

### Langue préférée

Les emails respectent la langue préférée de l'utilisateur (champ `preferredLanguage` dans `User`).

**Note:** Actuellement, tous les emails sont envoyés en français. La traduction multi-langue est prévue pour une version future.

```typescript
// Le service récupère automatiquement la langue préférée
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { email: true, prenom: true, preferredLanguage: true },
})

// TODO: Utiliser preferredLanguage pour traduire les emails
```

## Notifications temps réel (SSE)

### Architecture SSE

Le système utilise Server-Sent Events pour pousser les notifications en temps réel.

**Avantages SSE vs WebSocket:**

- ✅ Unidirectionnel (serveur → client) : adapté aux notifications
- ✅ Auto-reconnexion native du navigateur
- ✅ Compatible avec HTTP/2
- ✅ Plus simple à implémenter
- ✅ Fonctionne derrière proxies/firewalls

### NotificationStreamManager

Fichier: `server/utils/notification-stream-manager.ts`

Gère les connexions SSE actives et la distribution des notifications.

#### Structure de données

```typescript
// Map userId → Set<connexions>
const activeConnections = new Map<
  number,
  Set<{
    id: string
    writer: H3ResponseWriter
    createdAt: number
  }>
>()
```

#### Méthodes principales

```typescript
// Ajouter une connexion
notificationStreamManager.addConnection(userId, connectionId, writer)

// Retirer une connexion
notificationStreamManager.removeConnection(userId, connectionId)

// Envoyer à un utilisateur spécifique
notificationStreamManager.sendToUser(userId, eventType, data)

// Broadcast à tous les utilisateurs
notificationStreamManager.broadcast(eventType, data)

// Nettoyer les connexions inactives
notificationStreamManager.cleanup()
```

#### Heartbeat (keepalive)

Un heartbeat est envoyé toutes les 30 secondes à toutes les connexions actives pour :

- Maintenir la connexion ouverte
- Détecter les connexions mortes
- Respecter les timeouts des proxies

```typescript
// Tâche CRON (toutes les 30s)
await notificationStreamManager.sendHeartbeat()
```

### Client SSE (useNotificationStream)

Composable: `app/composables/useNotificationStream.ts`

#### État de connexion

```typescript
const {
  isConnected, // Connexion établie
  isConnecting, // Tentative de connexion
  connectionStats, // Statistiques de connexion
  connect, // Se connecter manuellement
  disconnect, // Se déconnecter
} = useNotificationStream()
```

#### Statistiques

```typescript
connectionStats = {
  isConnected: boolean,
  isConnecting: boolean,
  connectionId: string | null,
  reconnectAttempts: number,
  error: string | null,
  lastHeartbeat: number | null,
}
```

#### Auto-reconnexion

Le client gère automatiquement la reconnexion avec backoff exponentiel :

```
Tentative 1 : 1s
Tentative 2 : 2s
Tentative 3 : 4s
Tentative 4 : 8s
Tentative 5 : 16s
Maximum    : 30s
```

#### Gestion des événements

```typescript
// Connexion établie
eventSource.addEventListener('connected', (event) => {
  const { connectionId } = JSON.parse(event.data)
})

// Nouvelle notification
eventSource.addEventListener('notification', (event) => {
  const notification = JSON.parse(event.data)
  notificationsStore.addNotification(notification)
})

// Signal de rafraîchissement
eventSource.addEventListener('refresh', () => {
  notificationsStore.refresh()
})

// Heartbeat
eventSource.addEventListener('heartbeat', () => {
  // Mettre à jour lastHeartbeat
})
```

### Fallback polling

Si SSE n'est pas disponible (firewall, proxy, etc.), le système bascule automatiquement sur du polling HTTP.

**Configuration polling:**

```typescript
const POLLING_INTERVAL = 30000 // 30 secondes
```

**Logique de fallback:**

```typescript
// Si SSE ne se connecte pas après quelques secondes
watchEffect(() => {
  if (!isConnected.value && !isConnecting.value && authStore.user) {
    startPolling() // Démarrer le polling
  }
})

// Si SSE se reconnecte
watch(isConnected, (connected) => {
  if (connected) {
    stopPolling() // Arrêter le polling
  }
})
```

## Push Notifications (Firebase Cloud Messaging)

### Architecture

Les push notifications utilisent Firebase Cloud Messaging (FCM) avec un Service Worker.

**Fichiers principaux :**

- `server/utils/firebase-admin.ts` : SDK Firebase Admin (envoi côté serveur)
- `server/utils/unified-push-service.ts` : Service unifié d'envoi push
- `public/firebase-messaging-sw.js` : Service Worker Firebase côté client

### Enregistrement du token FCM

```typescript
// 1. Initialiser Firebase côté client
const messaging = getMessaging(firebaseApp)

// 2. Obtenir le token FCM
const token = await getToken(messaging, { vapidKey: FIREBASE_VAPID_KEY })

// 3. Enregistrer le token sur le serveur
await $fetch('/api/notifications/fcm/register', {
  method: 'POST',
  body: { token },
})
```

### UnifiedPushService

Côté serveur : `server/utils/unified-push-service.ts`

```typescript
// Envoyer à un utilisateur spécifique
await unifiedPushService.sendToUser(userId, {
  title: 'Candidature acceptée !',
  message: 'Votre candidature pour "JuggleCon 2025" a été acceptée',
  url: '/my-volunteer-applications',
  type: 'success',
})

// Envoyer à plusieurs utilisateurs
await unifiedPushService.sendToUsers(userIds, pushData)

// Broadcast à tous les utilisateurs avec tokens FCM
await unifiedPushService.sendToAll(pushData)

// Tester l'envoi
await unifiedPushService.testPush(userId)
```

**Gestion automatique des tokens :** Les tokens FCM invalides sont automatiquement supprimés de la base après un échec d'envoi.

### Configuration Firebase

Variables d'environnement nécessaires :

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Le fichier de configuration client Firebase est dans `app/utils/firebase.ts`.

## Interface utilisateur

### NotificationCenter.vue

Composant principal affichant le centre de notifications.

Fichier: `app/components/notifications/Center.vue`

#### Fonctionnalités

- **Badge de compteur** : Affiche le nombre de notifications non lues
- **Animation pulse** : Indicateur visuel quand il y a des non lues
- **Modal** : Panneau déroulant avec la liste des notifications
- **Indicateur temps réel** : Affiche l'état de la connexion SSE
- **Actions** :
  - Rafraîchir manuellement
  - Marquer toutes comme lues
  - Marquer individuellement comme lue/non lue
  - Supprimer une notification
  - Charger plus (pagination)

#### Structure du header

```
┌─────────────────────────────────────────────────┐
│ Notifications                          🔄  ✕    │
│                                                  │
│ 🟢 Temps réel    5 non lues  [Tout marquer lu] │
└─────────────────────────────────────────────────┘
```

#### Indicateur de connexion

Trois états visuels :

- 🟢 Vert pulsant : Connecté en temps réel (SSE)
- 🟡 Jaune pulsant : Connexion en cours
- 🔴 Rouge : Hors ligne (mode polling)

#### Actions sur une notification

- **Clic** : Marque comme lue et navigue vers `actionUrl` si présent
- **Bouton ✕** : Supprime la notification
- **Bouton d'action** : Navigue vers la page spécifique

### Store Pinia (notificationsStore)

Fichier: `app/stores/notifications.ts`

#### État

```typescript
{
  notifications: Notification[],
  unreadCount: number,
  loading: boolean,
  hasMore: boolean,
  realTimeEnabled: boolean,  // SSE actif ou non
}
```

#### Actions principales

```typescript
// Récupérer les notifications
await notificationsStore.refresh()

// Charger plus
await notificationsStore.loadMore()

// Marquer comme lue
await notificationsStore.markAsRead(notificationId)

// Marquer toutes comme lues
await notificationsStore.markAllAsRead(category?)

// Supprimer
await notificationsStore.delete(notificationId)

// Ajouter une notification (SSE)
notificationsStore.addNotification(notification)

// Mettre à jour le compteur
notificationsStore.setUnreadCount(count)

// Activer/désactiver le temps réel
notificationsStore.setRealTimeEnabled(enabled)
```

#### Computed

```typescript
// Notifications récentes (pour le centre de notifications)
const recentNotifications = computed(() => {
  return notifications.slice(0, 20)
})
```

## Page complète des notifications

Fichier: `app/pages/notifications.vue`

Page dédiée affichant toutes les notifications avec :

- Filtrage par catégorie
- Recherche par titre/message
- Pagination complète
- Actions de masse

## Administration

### Page admin des notifications

Fichier: `app/pages/admin/notifications.vue`

#### Fonctionnalités admin

1. **Statistiques globales**
   - Total de notifications
   - Non lues
   - Taux de lecture
   - Notifications par catégorie

2. **Notifications récentes**
   - Vue tabulaire de toutes les notifications
   - Filtrage par utilisateur, type, catégorie
   - Actions : marquer lue/non lue, supprimer

3. **Créer une notification admin**
   - Envoyer à un utilisateur spécifique
   - Envoyer à tous les utilisateurs
   - Forcer l'envoi d'email
   - Forcer la push notification

4. **Test du système**
   - Tester l'envoi à soi-même
   - Vérifier les préférences
   - Tester SSE

### API Admin

#### GET `/api/admin/notifications/stats`

Statistiques globales des notifications.

**Réponse:**

```json
{
  "total": 1234,
  "unread": 456,
  "byCategory": {
    "volunteer": 300,
    "comment": 200,
    "system": 100
  },
  "byType": {
    "INFO": 500,
    "SUCCESS": 400,
    "WARNING": 200,
    "ERROR": 134
  }
}
```

#### GET `/api/admin/notifications/recent`

Liste des notifications récentes (toutes utilisateurs).

**Query Parameters:**

- `limit` : Nombre de notifications
- `offset` : Pagination
- `userId` : Filtrer par utilisateur
- `category` : Filtrer par catégorie

#### POST `/api/admin/notifications/create`

Créer une notification admin.

**Body:**

```json
{
  "userId": 123, // ou null pour broadcast
  "type": "INFO",
  "title": "Maintenance prévue",
  "message": "Le site sera en maintenance ce soir de 22h à minuit.",
  "category": "system",
  "actionUrl": "/",
  "actionText": "Retour à l'accueil",
  "forceEmail": true, // Forcer l'envoi d'email
  "forcePush": true // Forcer la push notification
}
```

## Tâches CRON

Fichier de configuration: `server/api/cron/notifications.ts`

### Nettoyage automatique

**Fréquence:** Quotidienne (2h du matin)

**Actions:**

- Supprime les notifications lues de plus de 30 jours
- Supprime les notifications non lues de plus de 90 jours
- Nettoie les abonnements push expirés
- Nettoie les connexions SSE mortes

```sql
DELETE FROM Notification
WHERE isRead = true AND createdAt < DATE_SUB(NOW(), INTERVAL 30 DAY)

DELETE FROM Notification
WHERE isRead = false AND createdAt < DATE_SUB(NOW(), INTERVAL 90 DAY)
```

### Heartbeat SSE

**Fréquence:** Toutes les 30 secondes

**Action:**

- Envoie un événement `heartbeat` à toutes les connexions SSE actives
- Nettoie les connexions qui ne répondent plus

## Bonnes pratiques

### Création de notifications

1. **Toujours utiliser NotificationHelpers** plutôt que `NotificationService.create()` directement

   ```typescript
   // ✅ BON
   await NotificationHelpers.volunteerAccepted(userId, editionName, editionId)

   // ❌ MAUVAIS
   await NotificationService.create({ ... })
   ```

2. **Utiliser des clés i18n** plutôt que du texte libre pour permettre la traduction

   ```typescript
   // ✅ BON - clés i18n traduites automatiquement
   titleKey: 'notifications.volunteer.application_accepted.title',
   messageKey: 'notifications.volunteer.application_accepted.message',
   translationParams: { editionName: 'JuggleCon 2025' },

   // ⚠️ ACCEPTABLE - texte libre (non traduit)
   titleText: 'Notification personnalisée',
   messageText: 'Message de l\'organisateur',
   ```

3. **Respecter les types de notifications** définis dans `notification-preferences.ts`

   ```typescript
   // ✅ BON
   notificationType: 'volunteer_application_accepted'

   // ❌ MAUVAIS
   notificationType: 'volunteer-accepted' // Non défini
   ```

4. **Utiliser `safeNotify()`** pour ne pas bloquer l'opération principale si l'envoi échoue

   ```typescript
   // ✅ BON
   await safeNotify(
     () => NotificationHelpers.volunteerAccepted(userId, editionName, editionId),
     'Notification acceptation bénévole'
   )
   ```

5. **Fournir des actionUrl et actionTextKey pertinents**

   ```typescript
   // ✅ BON
   actionUrl: '/my-volunteer-applications',
   actionTextKey: 'notifications.volunteer.application_accepted.action',

   // ❌ MAUVAIS
   actionUrl: '/',
   actionText: 'Cliquez ici',
   ```

### Messages d'emails

1. **Support du HTML** : Les messages peuvent contenir du HTML

   ```typescript
   // ✅ BON
   message: 'Candidature acceptée !<br><br>Équipe : <strong>Accueil</strong>'

   // ❌ MAUVAIS (plus maintenant)
   message: 'Candidature acceptée !\n\nÉquipe : Accueil'
   ```

2. **Éviter les espaces indésirables** : Les templates consolidés évitent les espaces

   ```vue
   <!-- ✅ BON -->
   <Text>Bonjour {{ prenom }},</Text>

   <!-- ❌ MAUVAIS -->
   <Text>
     Bonjour {{ prenom }},
   </Text>
   ```

### Gestion des erreurs

1. **Ne pas bloquer l'exécution** si l'envoi échoue

   ```typescript
   // Les notifications sont envoyées en "fire and forget"
   // Les erreurs sont loggées mais ne bloquent pas le flux
   await NotificationHelpers.volunteerAccepted(...).catch(console.error)
   ```

2. **Vérifier la disponibilité SSE** avant de compter dessus
   ```typescript
   // Le système bascule automatiquement sur polling si SSE échoue
   watchEffect(() => {
     if (!isConnected.value && authStore.user) {
       startPolling()
     }
   })
   ```

### Performance

1. **Utiliser la pagination** pour les listes longues

   ```typescript
   // ✅ BON
   await notificationsStore.loadMore()

   // ❌ MAUVAIS
   const all = await $fetch('/api/notifications?limit=999999')
   ```

2. **Nettoyer les connexions SSE** à la déconnexion

   ```typescript
   onBeforeUnmount(() => {
     disconnect()
   })
   ```

3. **Limiter les requêtes polling** (30s minimum)
   ```typescript
   const POLLING_INTERVAL = 30000 // 30 secondes
   ```

## Sécurité

### Protection de la vie privée

1. **EmailHash** : Les emails ne sont jamais exposés dans les réponses API

   ```typescript
   user: {
     id: 123,
     pseudo: 'john_doe',
     emailHash: '5d41402abc4b2a76b9719d911017c592',  // MD5
   }
   ```

2. **Isolation utilisateur** : Un utilisateur ne peut voir que ses propres notifications
   ```typescript
   // Vérifié automatiquement dans les endpoints
   const { user } = await requireUserSession(event)
   const notifications = await NotificationService.getNotifications(user.id, ...)
   ```

### Rate limiting

Les endpoints de notifications sont protégés contre les abus :

```typescript
// Limite: 60 requêtes par minute
await apiRateLimiter.check(event, {
  maxRequests: 60,
  windowMs: 60000,
})
```

### Validation des données

Tous les endpoints utilisent Zod pour valider les données :

```typescript
const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
  category: z.string().optional(),
  unreadOnly: z.coerce.boolean().optional(),
})
```

## Tests

### Tests unitaires

Fichiers de tests :

- `test/unit/stores/notifications.test.ts` : Store Pinia
- Tests intégrés dans les endpoints API

### Tests d'intégration

Les notifications sont testées dans le contexte des features :

- `test/nuxt/features/volunteers.test.ts` : Notifications de bénévolat
- `test/nuxt/server/api/notifications/*.test.ts` : API endpoints

### Tester manuellement

1. **Mode simulation email** (`SEND_EMAILS=false`)
   - Les emails sont affichés dans la console
   - Pas besoin de configuration SMTP

2. **Tester SSE**

   ```bash
   curl -N http://localhost:3000/api/notifications/stream
   ```

3. **Déclencher une notification**
   ```typescript
   // Dans la console du navigateur
   await $fetch('/api/test/trigger-notification', { method: 'POST' })
   ```

## Dépannage

### SSE ne se connecte pas

**Symptômes:**

- Indicateur rouge dans le NotificationCenter
- Polling actif en permanence

**Causes possibles:**

1. Proxy/firewall bloquant SSE
2. CORS mal configuré
3. Session expirée

**Solutions:**

```typescript
// Vérifier les logs du client
console.log('[SSE Client] Erreur de connexion:', error)

// Vérifier les logs serveur
console.log('[SSE Server] Connexion établie pour userId:', userId)

// Forcer la reconnexion
disconnect()
await new Promise((r) => setTimeout(r, 1000))
connect()
```

### Notifications non reçues

**Checklist:**

1. ✅ Vérifier les préférences utilisateur

   ```typescript
   const prefs = await $fetch('/api/notifications/preferences')
   ```

2. ✅ Vérifier que la notification a bien été créée en base

   ```sql
   SELECT * FROM Notification WHERE userId = ? ORDER BY createdAt DESC LIMIT 10
   ```

3. ✅ Vérifier les logs serveur

   ```bash
   npm run docker:dev:logs
   ```

4. ✅ Vérifier la connexion SSE
   ```typescript
   const { isConnected } = useNotificationStream()
   console.log('SSE connecté:', isConnected.value)
   ```

### Emails non envoyés

**Checklist:**

1. ✅ Vérifier `SEND_EMAILS=true`
2. ✅ Vérifier les credentials SMTP
3. ✅ Vérifier les préférences email de l'utilisateur
4. ✅ Vérifier les logs serveur pour les erreurs SMTP

### Push notifications non reçues

**Checklist:**

1. ✅ Vérifier la configuration Firebase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
2. ✅ Vérifier que l'utilisateur a des tokens FCM actifs en base (`FcmToken`)
3. ✅ Vérifier les permissions du navigateur
4. ✅ Vérifier les logs serveur pour les erreurs FCM (code d'erreur détaillé loggé)
5. ✅ Tester avec l'endpoint admin `/api/admin/notifications/test`

## Améliorations possibles

### Notifications manquantes

Actions métier qui ne déclenchent pas encore de notification :

- **Suppression de covoiturage** : Quand un propriétaire supprime une offre (pour les passagers acceptés)
- **Assignation à une nouvelle équipe** : Quand un bénévole accepté est assigné à une équipe après coup
- **Workshop créé/modifié** : Pour les participants inscrits

### Problèmes techniques à corriger

- **Helper `newConvention`** : Défini mais jamais appelé nulle part dans le code

### Traduction des emails

Actuellement, les notifications push sont traduites dans la langue préférée de l'utilisateur, mais les emails restent en français.

### Notifications groupées

Regrouper plusieurs notifications du même type :

```
"Vous avez 3 nouvelles candidatures acceptées"
au lieu de 3 notifications séparées
```

### Analytics

Tracking des notifications :

- Taux d'ouverture
- Taux de clic sur les actions
- Temps moyen avant lecture

## Conclusion

Le système de notifications est un composant critique de l'application qui combine plusieurs technologies pour offrir une expérience utilisateur optimale :

- ✅ **Fiable** : Fallback polling si SSE échoue
- ✅ **Temps réel** : SSE pour les updates instantanées
- ✅ **Flexible** : Préférences granulaires par type
- ✅ **Multi-canal** : Base de données, SSE, Push, Email
- ✅ **Sécurisé** : Isolation utilisateur, rate limiting, validation
- ✅ **Performant** : Pagination, nettoyage automatique, indexation DB

Pour toute question ou amélioration, se référer au code source ou contacter l'équipe de développement.
