# 📱 Push Notifications

Ce document décrit l'implémentation complète du système de notifications push pour l'application Convention de Jonglerie.

## 🎯 Fonctionnalités

- ✅ **Notifications push en temps réel** sur tous les appareils
- ✅ **Progressive Web App (PWA)** pour installation mobile
- ✅ **Gestion multi-appareils** par utilisateur
- ✅ **Service Worker personnalisé** pour traitement des notifications
- ✅ **Interface utilisateur complète** dans `/notifications`
- ✅ **Tests intégrés** avec endpoint de test
- ✅ **Nettoyage automatique** des subscriptions expirées

## 🏗️ Architecture

### Backend
- **Base de données** : Modèle `PushSubscription` avec relation vers `User`
- **Service Web Push** : `server/utils/web-push-service.ts`
- **Intégration automatique** : Toutes les notifications déclenchent un push
- **Endpoints API** : `/api/push/*` pour gérer les subscriptions

### Frontend
- **PWA** : Configuration Nuxt avec `@vite-pwa/nuxt`
- **Composable** : `usePushNotifications()` pour logique client
- **Interface** : `NotificationsPushNotificationSettings.vue`
- **Service Worker** : `/public/sw-push.js` pour réception push

## 🚀 Configuration

### 1. Variables d'environnement

```bash
# Générer les clés VAPID
npm run generate:vapid

# Ou manuellement :
NUXT_PUBLIC_VAPID_PUBLIC_KEY=BB5GZjydBDYr_miy52edJ9p2fSilMSBD_S6FU4kY1aCrB6YQWUl1Pn7YW1kpj_gxfUcvijTEAlF7rx_bM1K-c9s
VAPID_PRIVATE_KEY=a-E7Y4pnSZmMi2X-k4QYGVMXYBNWNsnogBo4WHKzM0k
VAPID_SUBJECT=mailto:admin@convention-jonglerie.fr
```

### 2. Base de données

```bash
# Migration automatique déjà appliquée
npx prisma migrate deploy
```

## 📋 Utilisation

### Interface utilisateur
1. Aller sur `/notifications`
2. Section "Notifications Push"
3. Cliquer "Activer" et autoriser les permissions
4. Tester avec le bouton "Envoyer un test"

### Développement
```typescript
// Envoyer une notification programmatiquement
import { NotificationService } from '~/server/utils/notification-service'

const notification = await NotificationService.create({
  userId: 123,
  type: 'SUCCESS',
  title: 'Test notification',
  message: 'Ceci est un test',
  actionUrl: '/test'
})
// Le push est envoyé automatiquement !
```

## 📊 Cas d'usage actuels

Toutes les notifications existantes déclenchent automatiquement un push :

### 🎓 Bénévolat
- Candidature envoyée
- Candidature acceptée/refusée

### 🚗 Covoiturage  
- Nouvelle demande reçue
- Demande acceptée/refusée
- Réservation annulée

### 🎪 Événements
- Rappels d'événements
- Nouvelles conventions

### 🔧 Système
- Bienvenue nouveaux utilisateurs
- Erreurs système
- Notifications administratives

## 🛠️ Scripts utiles

```bash
# Générer les clés VAPID
node scripts/generate-vapid-keys.js

# Tester le système
curl -X POST http://localhost:3001/api/push/test \
  -H "Content-Type: application/json" \
  -b "nuxt-session=your-session-cookie"
```

## 🔐 Sécurité

- ✅ **Clé privée** côté serveur uniquement
- ✅ **Validation** des subscriptions par utilisateur
- ✅ **HTTPS requis** en production
- ✅ **Nettoyage automatique** des subscriptions expirées
- ✅ **Permissions** navigateur respectées

## 📱 Compatibilité

### ✅ Supporté
- Chrome 50+ (Android/Desktop)
- Firefox 44+ (Android/Desktop)
- Edge 17+
- Safari 16.4+ (macOS/iOS avec "Add to Home Screen")

### ⚠️ Limitations
- Safari iOS < 16.4 : Non supporté
- Safari nécessite installation PWA pour notifications
- Notifications en arrière-plan dépendent du système

## 🧹 Maintenance

### Nettoyage automatique
Le système nettoie automatiquement les subscriptions expirées :

```typescript
// Appelé automatiquement lors des échecs push
await WebPushService.cleanupExpiredSubscriptions()
```

### Monitoring
- Logs automatiques des succès/échecs d'envoi
- Statistiques dans l'interface `/api/push/status`
- Désactivation automatique des subscriptions invalides

## 🎯 Tests

### Test manuel
1. Se connecter sur l'app
2. Aller dans `/notifications`
3. Activer les notifications push
4. Cliquer "Envoyer un test"
5. Vérifier réception de la notification

### Test automatisé
```bash
# Déclencher une notification de bienvenue
curl -X POST http://localhost:3001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"code": "valid-code"}'
```

## 🚀 Déploiement

### Production
1. **HTTPS obligatoire** pour les service workers
2. **Variables VAPID** en production
3. **Domaines autorisés** dans la configuration
4. **Certificats SSL** valides

### Monitoring production
- Surveiller les logs d'erreur push
- Monitorer le taux de succès des notifications
- Nettoyer périodiquement les anciennes subscriptions

---

## 🎉 Résultat final

L'application peut maintenant envoyer des **notifications push natives** à tous les utilisateurs connectés, sur tous leurs appareils, automatiquement pour chaque action importante ! 

Les utilisateurs peuvent installer l'app comme une **PWA native** et recevoir les notifications même quand l'app n'est pas ouverte.