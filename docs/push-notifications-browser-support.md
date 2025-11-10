# Support des notifications push par navigateur

## Résumé

Les notifications push Web utilisent le protocole **VAPID (Voluntary Application Server Identification)** avec la bibliothèque `web-push`.

## Navigateurs testés et supportés

### ✅ Firefox

- **Statut** : Entièrement fonctionnel
- **Push Service** : Mozilla Push Service
- **Particularité** : N'utilise pas Google FCM, fonctionne indépendamment

### ✅ Chrome / Chromium

- **Statut** : Entièrement fonctionnel
- **Push Service** : Google FCM (Firebase Cloud Messaging)
- **Prérequis** :
  - Autoriser les domaines Firebase dans le pare-feu/bloqueur de publicités :
    - `fcm.googleapis.com`
    - `android.googleapis.com`
    - `firebaseinstallations.googleapis.com`
    - `firebaselogging-pa.googleapis.com`

### ❌ Opera

- **Statut** : Non fonctionnel (erreur code 20)
- **Raison** : Google FCM refuse les souscriptions depuis Opera
- **Impact** : Faible (~2-3% des utilisateurs)
- **Solution potentielle** : Nécessiterait un projet Firebase avec domaine autorisé

## Configuration technique

### Variables d'environnement requises

```env
# Clés VAPID (générées avec web-push generate-vapid-keys)
NUXT_PUBLIC_VAPID_PUBLIC_KEY=BJcYdnrcpqDEl181uWEj8oxTn_pbSe6a8lTxTlprIXClvsy9wCqhv2eI96oA7u4xUyySGyP4DKX8McDDi930CWs
VAPID_PRIVATE_KEY=wiyDXvv0Ov15TUdOKjHZskYnSuW9LqW-uggzQbKzlts
VAPID_SUBJECT=mailto:powange@gmail.com
```

### Service Worker

Le Service Worker est disponible dans `/public/sw.js` et gère :

- Réception des notifications push
- Affichage des notifications
- Actions de clic sur les notifications

### Manifest PWA

Le manifest est généré dynamiquement via `/api/site.webmanifest` :

- Pas de `gcm_sender_id` (utilisation VAPID pure)
- Configuration adaptée selon l'environnement (dev/staging/prod)

## Configuration réseau

### AdGuard Home / Bloqueurs de publicités

Pour Chrome/Chromium, il faut autoriser les domaines Firebase :

```
@@||fcm.googleapis.com^$important
@@||android.googleapis.com^$important
@@||firebaseinstallations.googleapis.com^$important
@@||firebaselogging-pa.googleapis.com^$important
```

### Pare-feu

Aucune configuration spéciale requise. Les notifications push utilisent HTTPS standard.

## Limites connues

1. **Opera** : Non supporté sans Firebase
2. **Safari iOS** : Support limité (iOS 16.4+)
3. **Navigateurs mobiles anciens** : Support variable

## Taux de couverture

- **Firefox + Chrome** : ~95% des utilisateurs
- **Opera** : ~2-3% non couvert
- **Autres** : Dépend du navigateur et de la version

## Pour ajouter le support d'Opera (optionnel)

Si nécessaire, il faudrait :

1. Créer un projet Firebase
2. Récupérer le Sender ID
3. Ajouter le domaine dans Firebase Authentication > Authorized domains
4. Configurer la variable d'environnement `FIREBASE_SENDER_ID`
5. Modifier le manifest pour inclure `gcm_sender_id`

Cela représente un effort non négligeable pour 2-3% des utilisateurs.
