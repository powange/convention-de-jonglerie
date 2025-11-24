# Configuration Firebase Multi-Environnements

## Vue d'ensemble

L'application supporte plusieurs environnements Firebase (dev, release, prod) via des variables d'environnement.

## Architecture

### Projets Firebase recommandés

Il est recommandé de créer **un projet Firebase par environnement** :

- **Développement** : `juggling-convention-dev`
- **Release/Staging** : `juggling-convention-release`
- **Production** : `juggling-convention-prod`

**Avantages** :

- ✅ Isolation complète des données
- ✅ Quotas indépendants
- ✅ Tokens FCM séparés (pas de notifications croisées entre env)
- ✅ Sécurité renforcée
- ✅ Tests sans risque sur les environnements non-prod

## Configuration

### 1. Créer les projets Firebase

1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Créer un projet pour chaque environnement
3. Activer **Cloud Messaging** dans chaque projet
4. Générer les clés VAPID pour chaque projet

### 2. Variables d'environnement

Ajouter les variables suivantes dans les fichiers `.env` de chaque environnement :

#### `.env.dev` (Développement)

```bash
# Firebase Dev
NUXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=juggling-convention-dev.firebaseapp.com
NUXT_PUBLIC_FIREBASE_PROJECT_ID=juggling-convention-dev
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=juggling-convention-dev.firebasestorage.app
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NUXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123...
NUXT_PUBLIC_FIREBASE_VAPID_KEY=BN8x...

# Firebase Admin (serveur uniquement)
FIREBASE_PROJECT_ID=juggling-convention-dev
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@juggling-convention-dev.iam.gserviceaccount.com
```

#### `.env.release` (Pre-production)

```bash
# Firebase Release
NUXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=juggling-convention-release.firebaseapp.com
NUXT_PUBLIC_FIREBASE_PROJECT_ID=juggling-convention-release
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=juggling-convention-release.firebasestorage.app
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=987654321
NUXT_PUBLIC_FIREBASE_APP_ID=1:987654321:web:def456...
NUXT_PUBLIC_FIREBASE_VAPID_KEY=BM7y...

# Firebase Admin (serveur uniquement)
FIREBASE_PROJECT_ID=juggling-convention-release
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-yyy@juggling-convention-release.iam.gserviceaccount.com
```

#### `.env.prod` (Production)

```bash
# Firebase Production
NUXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=juggling-convention.firebaseapp.com
NUXT_PUBLIC_FIREBASE_PROJECT_ID=juggling-convention
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=juggling-convention.firebasestorage.app
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=136924576295
NUXT_PUBLIC_FIREBASE_APP_ID=1:136924576295:web:b9d515a218409804c9ec02
NUXT_PUBLIC_FIREBASE_VAPID_KEY=BKl9...

# Firebase Admin (serveur uniquement)
FIREBASE_PROJECT_ID=juggling-convention
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-zzz@juggling-convention.iam.gserviceaccount.com
```

### 3. Récupérer les configurations Firebase

Pour chaque projet Firebase :

1. **Configuration Client** (Web) :
   - Aller dans **Project Settings** > **General**
   - Dans "Your apps", cliquer sur l'app Web (ou en créer une)
   - Copier les valeurs de la configuration Firebase

2. **Clé VAPID** :
   - Aller dans **Project Settings** > **Cloud Messaging**
   - Onglet **Web Push certificates**
   - Générer une nouvelle paire de clés (ou utiliser existante)
   - Copier la **clé publique** dans `NUXT_PUBLIC_FIREBASE_VAPID_KEY`

3. **Service Account** (Admin SDK) :
   - Aller dans **Project Settings** > **Service accounts**
   - Cliquer sur **Generate new private key**
   - Télécharger le fichier JSON
   - Copier les valeurs dans les variables d'environnement :
     - `FIREBASE_PROJECT_ID` : `project_id`
     - `FIREBASE_PRIVATE_KEY` : `private_key` (garder les `\n`)
     - `FIREBASE_CLIENT_EMAIL` : `client_email`

## Fonctionnement

### Configuration dynamique (Client)

Le fichier `app/config/firebase.config.ts` exporte une **fonction** `getFirebaseConfig()` qui utilise `useRuntimeConfig()` pour accéder aux variables d'environnement à l'exécution :

```typescript
export function getFirebaseConfig() {
  const config = useRuntimeConfig()

  return {
    apiKey: config.public.firebaseApiKey || 'AIzaSy...',
    authDomain: config.public.firebaseAuthDomain || 'juggling-convention.firebaseapp.com',
    projectId: config.public.firebaseProjectId || 'juggling-convention',
    // ...
  }
}
```

**Important** : Ne PAS utiliser `import.meta.env` car ces valeurs sont évaluées au moment du build et ne changent pas selon l'environnement d'exécution.

### Service Worker dynamique

Le Service Worker Firebase est généré **dynamiquement** via l'endpoint `/firebase-messaging-sw.js` qui injecte la configuration de l'environnement actuel.

**Fichier** : `server/routes/firebase-messaging-sw.js.ts`

**Fonctionnalités clés** :

- ✅ Configuration Firebase injectée selon l'environnement
- ✅ Système de versioning (`v2-{projectId}`) pour forcer le rechargement du SW quand la config change
- ✅ Headers anti-cache pour éviter les problèmes de configuration obsolète

Exemple de version générée :

```javascript
// Version du Service Worker (change quand la configuration Firebase change)
const SW_VERSION = 'v2-juggling-convention-2cafd'

// Configuration Firebase (injectée dynamiquement selon l'environnement)
const firebaseConfig = {
  apiKey: 'AIzaSy...',
  projectId: 'juggling-convention-2cafd',
  // ...
}
```

Cela permet d'avoir un Service Worker qui :

1. S'adapte automatiquement à l'environnement
2. Se recharge automatiquement quand la configuration Firebase change (nouveau projectId)
3. Ne peut pas être mis en cache par le navigateur

## Déploiement

### Docker

Dans les fichiers `docker-compose.*.yml`, charger le bon fichier `.env` :

```yaml
services:
  app:
    env_file:
      - .env.dev # ou .env.release, .env.prod
```

### Variables d'environnement dans CI/CD

Dans GitHub Actions, GitLab CI ou autre, définir les variables Firebase comme **secrets** et les injecter lors du build.

## Migration depuis configuration unique

Si vous aviez une seule configuration Firebase en dur :

1. **Backup** : Garder les valeurs actuelles comme fallback dans le code
2. **Créer les projets** : Créer les projets dev et release
3. **Ajouter les variables** : Ajouter les variables d'environnement
4. **Tester** : Vérifier que chaque environnement utilise le bon projet Firebase
5. **Monitoring** : Surveiller les logs Firebase pour confirmer l'utilisation correcte

## Bonnes pratiques

### Sécurité

- ✅ **Ne jamais commit** les fichiers `.env` avec les vraies clés
- ✅ Utiliser des **secrets** dans CI/CD
- ✅ Restreindre les **API restrictions** dans Firebase Console
- ✅ Configurer les **App Check** pour limiter l'accès aux APIs Firebase

### Organisation

- 📁 Un dossier par environnement dans Firebase Console
- 📝 Documenter les quotas et limites de chaque environnement
- 🔔 Configurer les alertes de quota Firebase

### Tests

- Test en **dev** d'abord
- Validation en **release/staging**
- Déploiement en **production** après validation

## Troubleshooting

### Erreur 401 "Request is missing required authentication credential"

**Symptôme** : L'erreur montre l'ancien projet Firebase au lieu du nouveau

```
POST https://fcmregistrations.googleapis.com/v1/projects/OLD-PROJECT/registrations 401
```

**Causes possibles** :

1. **Le client utilise `import.meta.env` au lieu de `useRuntimeConfig()`**
   - ➡️ Vérifier que `app/config/firebase.config.ts` exporte une **fonction** `getFirebaseConfig()` qui utilise `useRuntimeConfig()`
   - ➡️ Ne PAS utiliser `import.meta.env` car ces valeurs sont figées au moment du build

2. **Le navigateur a mis en cache l'ancien Service Worker**
   - ➡️ Vider le cache du navigateur (Ctrl+Shift+Del)
   - ➡️ Aller dans DevTools > Application > Service Workers > Unregister
   - ➡️ Rafraîchir la page (Ctrl+Shift+R)
   - ➡️ Le système de versioning automatique (`v2-{projectId}`) devrait normalement éviter ce problème

3. **Les variables d'environnement ne sont pas chargées**
   - ➡️ Vérifier que le fichier `.env` est bien chargé
   - ➡️ Redémarrer le serveur après modification du `.env`
   - ➡️ Vérifier les logs : `✅ Firebase initialisé` devrait afficher le bon projet

### Les notifications vont au mauvais environnement

➡️ Vérifier que `NUXT_PUBLIC_FIREBASE_PROJECT_ID` est correct dans `.env`

➡️ Vérifier dans la console du navigateur :

```javascript
// Doit afficher le bon projectId
console.log(useRuntimeConfig().public.firebaseProjectId)
```

### Le Service Worker ne charge pas la bonne config

➡️ Vérifier que `/firebase-messaging-sw.js` est bien l'endpoint dynamique (et non un fichier statique)

➡️ Tester l'endpoint :

```bash
curl http://localhost:3000/firebase-messaging-sw.js | grep projectId
```

Doit retourner le bon `projectId`.

### Erreur "Project not found"

➡️ Vérifier que le projet existe dans Firebase Console et que `FIREBASE_PROJECT_ID` est correct

### Le Service Worker ne se met pas à jour

➡️ Le système de versioning `v2-{projectId}` force normalement la mise à jour automatique

➡️ Si le problème persiste, supprimer manuellement le SW :

1. DevTools > Application > Service Workers
2. Cliquer sur "Unregister" pour tous les SW Firebase
3. Rafraîchir la page

## Références

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
