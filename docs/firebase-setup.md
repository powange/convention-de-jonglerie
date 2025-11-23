# Configuration Firebase

Ce document explique comment configurer Firebase Cloud Messaging (FCM) pour les notifications push.

## Prérequis

1. Projet Firebase créé : `juggling-convention`
2. Application web configurée dans Firebase Console
3. Service Account créé pour Firebase Admin SDK

## Configuration côté client

### 1. Configuration Firebase App

La configuration client est déjà dans le code (`app/config/firebase.config.ts`) :

```typescript
{
  apiKey: 'AIzaSyAVDttdYlK-jAxvj06Nui-DRwf5Jj2GvHg',
  authDomain: 'juggling-convention.firebaseapp.com',
  projectId: 'juggling-convention',
  storageBucket: 'juggling-convention.firebasestorage.app',
  messagingSenderId: '136924576295',
  appId: '1:136924576295:web:b9d515a218409804c9ec02',
}
```

### 2. Clé VAPID pour Cloud Messaging

**IMPORTANT** : Pour que Firebase Cloud Messaging fonctionne, vous devez configurer une clé VAPID.

#### Obtenir la clé VAPID :

1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionner le projet `juggling-convention`
3. **Project Settings** (⚙️) → **Cloud Messaging**
4. Section **Web Push certificates**
5. Cliquer sur **Generate key pair** (si pas encore fait)
6. Copier la **clé publique**

#### Ajouter dans .env :

```bash
# Firebase Cloud Messaging - VAPID Public Key
NUXT_PUBLIC_FIREBASE_VAPID_KEY="BKagOny0KF_2pCJQ3m....votre_cle_vapid_complete"
```

**Note** : Cette clé est publique et peut être exposée côté client.

## Configuration côté serveur

### 1. Créer un Service Account

1. Aller dans Firebase Console → Project Settings → Service Accounts
2. Cliquer sur "Generate new private key"
3. Télécharger le fichier JSON

### 2. Ajouter dans .env

Ajouter la variable `FIREBASE_SERVICE_ACCOUNT` avec le contenu JSON du service account **en une seule ligne** :

```bash
# Firebase Admin SDK (Service Account JSON - tout sur une ligne)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"juggling-convention","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

**Important** :
- Mettre toutes les guillemets en échappement si nécessaire
- Garder les `\n` dans la clé privée
- Utiliser des guillemets simples pour entourer le JSON

### 3. Exemple de Service Account JSON

```json
{
  "type": "service_account",
  "project_id": "juggling-convention",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgk...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@juggling-convention.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40juggling-convention.iam.gserviceaccount.com"
}
```

## Coexistence avec VAPID

Le système est conçu pour coexister avec le système VAPID existant :

- **Si `FIREBASE_SERVICE_ACCOUNT` n'est pas configuré** : Le système utilise web-push VAPID (système actuel)
- **Si `FIREBASE_SERVICE_ACCOUNT` est configuré** : Firebase Cloud Messaging est disponible en parallèle

Tu peux utiliser les deux systèmes simultanément et migrer progressivement.

## Test de l'intégration

### Test côté client

1. Ouvrir l'application dans le navigateur
2. Vérifier la console : `✅ Firebase initialisé`
3. Vérifier : `✅ Firebase Cloud Messaging initialisé`

### Test côté serveur

1. Vérifier les logs au démarrage de Nitro
2. Si configuré correctement : `✅ Firebase Admin SDK initialisé`
3. Si non configuré : `[Firebase Admin] FIREBASE_SERVICE_ACCOUNT non configuré - FCM désactivé`

## Service Worker

Le service worker Firebase est déjà configuré dans `public/firebase-messaging-sw.js` et gère :

- Les notifications en arrière-plan
- Les clics sur les notifications
- La navigation vers les URLs spécifiques

## Utilisation dans le code

### Côté client (obtenir un token FCM)

```typescript
// Utiliser le composable
const { requestPermissionAndGetToken, isAvailable } = useFirebaseMessaging()

if (isAvailable.value) {
  const token = await requestPermissionAndGetToken()
  if (token) {
    console.log('FCM Token:', token)
    // Envoyer le token au serveur pour l'enregistrer en base de données
  }
}
```

### Côté serveur (envoyer une notification)

```typescript
import { firebaseAdmin } from '~/server/utils/firebase-admin'

const result = await firebaseAdmin.sendToTokens(
  ['token1', 'token2'],
  {
    title: 'Titre',
    body: 'Message'
  },
  {
    url: '/notifications',
    type: 'info'
  }
)
```

## Migration depuis VAPID

Pour migrer progressivement :

1. Garder VAPID actif pour les utilisateurs existants
2. Détecter le support FCM côté client
3. Si supporté, enregistrer le token FCM
4. Stocker les tokens FCM dans une nouvelle table ou colonne
5. Envoyer via FCM si token disponible, sinon via VAPID
6. Une fois tous les utilisateurs migrés, désactiver VAPID

## Sécurité

- Les clés API Firebase client sont **publiques** et peuvent être exposées
- La clé privée du Service Account doit rester **secrète** (côté serveur uniquement)
- Firebase gère automatiquement les restrictions de domaine et les quotas

## Ressources

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Service Worker Firebase](https://firebase.google.com/docs/cloud-messaging/js/receive)
