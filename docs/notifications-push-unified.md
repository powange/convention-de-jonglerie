# Système Unifié de Notifications Push

Ce document explique comment le système unifié de notifications push fonctionne avec **Firebase Cloud Messaging (FCM)** et **Web Push VAPID**.

## 🎯 Architecture

Le système utilise **deux technologies en parallèle** :

1. **Firebase Cloud Messaging (FCM)** - Prioritaire
   - Utilisé si l'utilisateur a un token FCM enregistré
   - Plus fiable, avec retry automatique
   - Analytics et statistiques intégrées

2. **Web Push VAPID** - Fallback
   - Utilisé si l'utilisateur n'a pas de token FCM
   - Standard W3C, pas de dépendance externe
   - Gratuit à 100%

## 📊 Flux de fonctionnement

```
Notification à envoyer
  ↓
unifiedPushService.sendToUser(userId, data)
  ↓
  ├─→ sendViaFirebase() ──→ Firebase FCM ──→ Push Service ──→ Navigateur
  │   (si token FCM disponible)
  │
  └─→ sendViaVapid() ────→ Web Push VAPID ──→ Push Service ──→ Navigateur
      (toujours en parallèle)
```

**Note** : Les deux méthodes s'exécutent en parallèle avec `Promise.allSettled()`. La notification réussit si **au moins une** des deux méthodes fonctionne.

## 🗄️ Base de données

### Table `FcmToken`

```prisma
model FcmToken {
  id        String   @id @default(cuid())
  userId    Int
  token     String   @db.VarChar(500)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, token])
  @@index([userId])
  @@index([token])
}
```

### Table `PushSubscription` (existante pour VAPID)

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    Int
  endpoint  String   @db.VarChar(500)
  p256dh    String   @db.VarChar(255)
  auth      String   @db.VarChar(255)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, endpoint])
  @@index([userId])
}
```

## 🔧 Configuration requise

### 1. Variables d'environnement Firebase FCM

```bash
# Firebase Service Account (JSON complet sur une ligne)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# Clé VAPID publique Firebase pour le client
NUXT_PUBLIC_FIREBASE_VAPID_KEY="BAOfRVL9azF-ClPklipE6mtnIjuq_6x9LVrQyL4WKf0mkEV1k8NOdbBmhgmDF0EzDsFfsvuN_5lg5OMYb3EFcTg"
```

### 2. Variables d'environnement Web Push VAPID

```bash
# Clés VAPID pour Web Push standard
NUXT_PUBLIC_VAPID_PUBLIC_KEY="BJcYdnrcpqDEl181uWEj8oxTn_pbSe6a8lTxTlprIXClvsy9wCqhv2eI96oA7u4xUyySGyP4DKX8McDDi930CWs"
VAPID_PRIVATE_KEY="wiyDXvv0Ov15TUdOKjHZskYnSuW9LqW-uggzQbKzlts"
VAPID_SUBJECT="mailto:powange@gmail.com"
```

## 📱 Côté Client

### Activation automatique des deux systèmes (recommandé)

Lorsqu'un utilisateur active les notifications push dans son profil ou via le modal de promotion, **les deux systèmes sont activés automatiquement en parallèle** :

```typescript
// app/components/notifications/PushNotificationToggle.vue
// app/components/notifications/PushPromoModal.vue

// Activer les deux systèmes en parallèle
const results = await Promise.allSettled([
  subscribeVapid(),
  isFirebaseAvailable.value ? requestPermissionAndGetToken() : Promise.resolve(null),
])

// Succès si au moins un système fonctionne
const vapidSuccess = results[0].status === 'fulfilled'
const fcmSuccess = results[1].status === 'fulfilled' && results[1].value !== null
```

### Enregistrer un token FCM manuellement

```typescript
// app/composables/useFirebaseMessaging.ts
const { requestPermissionAndGetToken } = useFirebaseMessaging()

// Demander la permission et obtenir le token
const token = await requestPermissionAndGetToken()

// Le token est automatiquement enregistré côté serveur via l'API
// POST /api/notifications/fcm/subscribe
```

### Enregistrer une subscription VAPID manuellement

```typescript
// app/composables/usePushNotifications.ts
const { subscribe } = usePushNotifications()

// S'abonner aux notifications VAPID
await subscribe()

// La subscription est automatiquement enregistrée côté serveur via l'API
// POST /api/notifications/push/subscribe
```

## 🖥️ Côté Serveur

### Envoyer une notification

```typescript
import { unifiedPushService } from '~/server/utils/unified-push-service'

// Envoyer à un utilisateur
const success = await unifiedPushService.sendToUser(userId, {
  title: 'Titre de la notification',
  message: 'Message de la notification',
  url: '/notifications',
  actionText: 'Voir',
  icon: '/favicons/android-chrome-192x192.png',
  badge: '/favicons/notification-badge.png',
})

// Envoyer à plusieurs utilisateurs
const results = await unifiedPushService.sendToUsers([userId1, userId2], {
  title: 'Titre',
  message: 'Message',
})

// Envoyer à tous les utilisateurs (utilise VAPID uniquement pour l'instant)
const count = await unifiedPushService.sendToAll({
  title: 'Annonce importante',
  message: 'Message pour tous',
})
```

### Obtenir les statistiques

```typescript
const stats = await unifiedPushService.getStats()
// {
//   fcm: {
//     totalTokens: 42,
//     enabled: true
//   },
//   vapid: {
//     totalSubscriptions: 38,
//     uniqueUsers: 35,
//     initialized: true
//   }
// }
```

## 🔄 Migration Prisma

Pour créer la table `FcmToken`, vous devez créer et appliquer une migration :

```bash
# IMPORTANT : NE PAS exécuter ces commandes, donner uniquement la commande à l'utilisateur
# L'utilisateur s'occupe toujours de créer et d'appliquer les migrations

# Commande de migration à fournir à l'utilisateur :
npx prisma migrate dev --name add_fcm_token_table
```

## ✅ Avantages du système unifié

1. **Double fiabilité** : Si FCM échoue, VAPID prend le relais (et vice versa)
2. **Migration progressive** : Les utilisateurs existants continuent avec VAPID, les nouveaux peuvent utiliser FCM
3. **Pas de breaking change** : L'ancien code VAPID continue de fonctionner
4. **Fallback automatique** : Si Firebase n'est pas configuré, VAPID fonctionne seul
5. **Statistiques combinées** : Vue d'ensemble complète des deux systèmes

## 🔍 Logs de débogage

Le système unifié produit des logs pour chaque envoi :

```
📲 [FCM] Envoi à l'utilisateur 123: 1 succès, 0 échecs
📲 [VAPID] Notification envoyée à l'utilisateur 123
[NotificationService] Notification abc123 envoyée via Push (FCM+VAPID, langue: fr)
```

## 🚀 Prochaines étapes

1. ✅ Créer la migration Prisma pour `FcmToken`
2. ✅ Configurer Firebase Service Account dans `.env`
3. ✅ Tester l'enregistrement de tokens FCM
4. ✅ Vérifier que les notifications sont bien envoyées via les deux canaux
5. 🔄 Implémenter `sendToAll()` avec FCM pour les envois massifs (optionnel)

## 📚 Ressources

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
