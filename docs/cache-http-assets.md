# Configuration du Cache HTTP pour les Assets Statiques

Ce document explique la stratégie de cache HTTP mise en place pour optimiser les performances de l'application.

## Objectifs

- **Réduire la charge serveur** : Les assets statiques sont mis en cache par les navigateurs
- **Améliorer les performances** : Navigation quasi-instantanée après la première visite
- **Économiser la bande passante** : Moins de téléchargements répétés

## Architecture

### 1. Middleware de cache (`server/middleware/cache-headers.ts`)

Le middleware configure automatiquement les en-têtes HTTP `Cache-Control` selon le type de ressource :

#### Assets avec hash (générés par Vite)

```
/_nuxt/*.js, *.css, *.png, etc.
→ Cache-Control: public, max-age=31536000, immutable
```

- **Cache de 1 an** : Ces fichiers ont un hash dans leur nom (ex: `app.a3b2c1.js`)
- **Immutable** : Le navigateur ne revalidera jamais tant que le fichier n'expire pas
- **Stratégie** : Quand le code change, Vite génère un nouveau hash → nouveau fichier → téléchargement automatique

#### Assets statiques dans /public

```
/logos/*, /favicons/*, /images/*
→ Cache-Control: public, max-age=2592000 (1 mois)
```

- **Cache de 1 mois** : Fichiers sans hash, donc cache moins agressif
- **Revalidation possible** : Le navigateur peut vérifier si le fichier a changé

#### Fonts

```
*.woff2, *.woff, *.ttf
→ Cache-Control: public, max-age=31536000, immutable
```

- **Cache de 1 an** : Les fonts changent rarement

#### Pages HTML

```
*.html, /
→ Cache-Control: no-cache, must-revalidate
```

- **Pas de cache** : Toujours récupérer la dernière version
- **Important** : Le HTML référence les assets avec hash, donc il charge toujours les bonnes versions

#### API

```
/api/*
→ Cache-Control: no-store, no-cache, must-revalidate
```

- **Aucun cache** : Les données API doivent être fraîches

### 2. Configuration Nitro (`nuxt.config.ts`)

```typescript
nitro: {
  // Compression gzip et brotli activée
  compressPublicAssets: {
    gzip: true,
    brotli: true,
  },
  // Cache pour /public (30 jours)
  publicAssets: [{
    dir: '../public',
    maxAge: 60 * 60 * 24 * 30,
  }],
}
```

**Bénéfices** :
- **Compression automatique** : Fichiers JS/CSS réduits de 70-80%
- **Brotli** : Meilleure compression que gzip (navigateurs modernes)
- **Gzip** : Fallback pour navigateurs plus anciens

## Fonctionnement en détail

### Première visite

```
1. Navigateur → GET /
2. Serveur → HTML (no-cache)
3. HTML contient <script src="/_nuxt/app.a3b2c1.js">
4. Navigateur → GET /_nuxt/app.a3b2c1.js
5. Serveur → JS + Cache-Control: max-age=31536000, immutable
6. Navigateur stocke en cache pour 1 an
```

### Visites suivantes

```
1. Navigateur → GET /
2. Serveur → HTML (no-cache, vérifie toujours)
3. HTML contient <script src="/_nuxt/app.a3b2c1.js">
4. Navigateur vérifie son cache → Fichier présent ✓
5. Pas de requête réseau → Chargement instantané
```

### Après un déploiement (nouveau code)

```
1. Navigateur → GET /
2. Serveur → HTML (nouveau, avec nouveau hash)
3. HTML contient <script src="/_nuxt/app.f7e8d9.js"> (nouveau hash!)
4. Navigateur vérifie son cache → Fichier non trouvé ✗
5. Navigateur → GET /_nuxt/app.f7e8d9.js
6. Serveur → Nouveau JS + Cache-Control
7. Navigateur stocke le nouveau fichier
```

**L'ancien fichier (`app.a3b2c1.js`) reste en cache mais ne sera plus jamais utilisé.**

## Vérification

### 1. Dans les DevTools (Onglet Network)

Après la première visite, rechargez la page et vérifiez :

```
Status: 200 OK (from disk cache)
Cache-Control: public, max-age=31536000, immutable
Content-Encoding: br (ou gzip)
```

### 2. Test avec curl

```bash
# Vérifier les en-têtes d'un asset Vite
curl -I http://localhost:3000/_nuxt/entry.js

# Vérifier un asset dans /public
curl -I http://localhost:3000/logos/logo-jc.svg

# Vérifier la page HTML
curl -I http://localhost:3000/
```

### 3. Lighthouse / PageSpeed Insights

Les scores devraient montrer :
- ✅ "Serve static assets with an efficient cache policy"
- ✅ "Enable text compression"

## Impact attendu

### Avant

- Chaque visite : ~2 MB de JS/CSS/images téléchargés
- Time to Interactive : 2-3 secondes
- Bande passante serveur : importante

### Après

- Première visite : ~2 MB téléchargés (compressés → ~500 KB)
- Visites suivantes : ~0 KB (tout depuis le cache)
- Time to Interactive : <1 seconde
- Bande passante serveur : réduite de 80-90%

## Bonnes pratiques

### ✅ À faire

- Toujours utiliser les helpers Nuxt (`useAsset`, `<NuxtImg>`) pour les assets
- Laisser Vite gérer le fingerprinting automatique
- Ne pas modifier manuellement les noms de fichiers dans `/_nuxt/`

### ❌ À ne pas faire

- Ne pas désactiver le fingerprinting de Vite
- Ne pas ajouter de query strings manuelles (`?v=123`) pour casser le cache
- Ne pas mettre de cache sur les endpoints API qui retournent des données dynamiques

## Maintenance

Cette configuration est automatique et ne nécessite aucune maintenance. Vite et Nitro gèrent tout automatiquement :

1. **Build** : Vite génère des fichiers avec hash
2. **Déploiement** : Les nouveaux fichiers sont déployés
3. **Accès** : Le middleware applique automatiquement les bons en-têtes
4. **Compression** : Nitro compresse automatiquement les fichiers

## Ressources

- [MDN - HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Vite Build Optimization](https://vitejs.dev/guide/build.html)
- [Nitro Static Assets](https://nitro.unjs.io/guide/assets)
