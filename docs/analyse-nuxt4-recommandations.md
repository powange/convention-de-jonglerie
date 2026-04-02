# Analyse Nuxt 4.x - Recommandations performances et securite

> **Date** : 02/04/2026
> **Version Nuxt** : 4.4.2 (`future.compatibilityVersion: 5`)
> **Infrastructure** : Nginx Proxy Manager (NPM) + certificats Let's Encrypt

---

## Table des matieres

- [Etat des lieux](#etat-des-lieux)
  - [Points forts du projet](#points-forts-du-projet)
  - [Configuration actuelle analysee](#configuration-actuelle-analysee)
- [Recommandations par priorite](#recommandations-par-priorite)
  - [Priorite 1 - Securite (impact critique)](#priorite-1---securite-impact-critique)
  - [Priorite 2 - Performance (impact fort)](#priorite-2---performance-impact-fort)
  - [Priorite 3 - Performance (impact moyen)](#priorite-3---performance-impact-moyen)
  - [Priorite 4 - Architecture (bonnes pratiques)](#priorite-4---architecture-bonnes-pratiques)
- [Recapitulatif](#recapitulatif)

---

## Etat des lieux

### Points forts du projet

Le projet est deja bien configure sur de nombreux aspects. Voici ce qui est en place et conforme aux recommandations Nuxt 4.x :

| Aspect                    | Configuration                                                                                         | Statut |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ------ |
| Compatibilite Nuxt 5      | `future.compatibilityVersion: 5`                                                                      | OK     |
| Lazy hydration            | `experimental.lazyHydration: true`                                                                    | OK     |
| Gestion erreurs chunks    | `experimental.emitRouteChunkError: 'automatic'`                                                       | OK     |
| Compression assets        | gzip + brotli au build (Nitro)                                                                        | OK     |
| Cache assets hashes       | `/_nuxt/` avec `max-age=31536000, immutable`                                                          | OK     |
| Cache-Control differencie | Headers differents par type de ressource (API, HTML, images, fonts)                                   | OK     |
| i18n lazy loading         | Traductions chargees par domaine selon la route                                                       | OK     |
| i18n tree-shaking         | `bundle.compositionOnly: true`, `fullInstall: false`                                                  | OK     |
| Rate limiting             | Rate limiter en memoire sur auth, register, email, upload, contenu, commentaires, checkout, recherche | OK     |
| Authentification          | Sessions scellees (`nuxt-auth-utils`), middleware serveur obligatoire                                 | OK     |
| Chiffrement donnees       | AES-256-GCM pour les donnees sensibles en base                                                        | OK     |
| reCAPTCHA v3              | Validation serveur avec score minimum configurable                                                    | OK     |
| Robots/SEO                | `X-Robots-Tag: noindex` hors production, sitemap dynamique                                            | OK     |
| Pre-bundling Vite         | 22 packages dans `optimizeDeps.include`                                                               | OK     |
| Prisma externalise        | `@prisma/client` dans `serverExternals`                                                               | OK     |
| Sourcemaps                | Desactives en prod serveur, actives en dev client                                                     | OK     |
| SSR selectif              | Desactive pour admin et gestion (SPA)                                                                 | OK     |

### Configuration actuelle analysee

**Fichiers examines :**

- `nuxt.config.ts` - Configuration centrale (modules, Nitro, Vite, experimental, routeRules)
- `app.config.ts` - Theme Nuxt UI (couleurs, composants)
- `package.json` - Dependencies et scripts
- `tsconfig.json` - Configuration TypeScript
- `eslint.config.mjs` - Regles ESLint
- `vitest.config.ts` - Configuration tests multi-projets
- `server/middleware/` - auth, cache-headers, noindex
- `server/plugins/` - scheduler, error-logging, countries, recaptcha-debug
- `server/utils/` - prisma, api-helpers, errors, auth-utils, rate-limiter, encryption
- `app/middleware/` - auth-protected, guest-only, load-translations, super-admin, verify-email-access
- `app/plugins/` - auth, admin-mode-header, firebase, countries, router-api-ignore, env-flags
- `app/composables/` - 46 composables (API, carte, calendrier, i18n, temps reel, PWA, etc.)

**Modules actifs (13) :**

```
@nuxt/eslint, @nuxt/image, @nuxt/scripts, @nuxt/test-utils/module,
@nuxt/ui, @pinia/nuxt, nuxt-auth-utils, @nuxtjs/i18n, @vueuse/nuxt,
nuxt-file-storage, @nuxtjs/seo, nuxt-qrcode
```

---

## Recommandations par priorite

---

### Priorite 1 - Securite (impact critique)

#### 1.1 Ajouter le module `nuxt-security` pour les headers HTTP

**Probleme** : Le projet n'a **aucun header de securite HTTP** envoye par Nuxt. Il n'y a pas de :

- Content-Security-Policy (CSP)
- X-Frame-Options (protection clickjacking)
- X-Content-Type-Options (protection MIME sniffing)
- Referrer-Policy
- Permissions-Policy

Sans ces headers, le site est vulnerable aux attaques XSS, clickjacking, injection de contenu et MIME sniffing. C'est la **recommandation OWASP #1** pour les applications web.

**Note** : Nginx Proxy Manager peut ajouter certains de ces headers au niveau du reverse proxy, mais il est preferable de les definir au niveau applicatif pour :

- Avoir un CSP granulaire adapte a chaque route
- Supporter les nonces dynamiques (SSR)
- Garantir la coherence entre les environnements

**Solution** :

```bash
npm install nuxt-security
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-security' /* ...autres modules */],

  security: {
    // Nonce dynamique pour les scripts inline en SSR
    nonce: true,

    headers: {
      contentSecurityPolicy: {
        // Scripts : strict-dynamic avec nonce pour SSR
        'script-src': [
          "'self'",
          "'strict-dynamic'",
          "'nonce-{{nonce}}'",
          'https:',
          "'unsafe-inline'", // fallback navigateurs anciens (ignore si strict-dynamic supporte)
        ],
        // Styles : unsafe-inline necessaire pour Nuxt UI / Tailwind
        'style-src': ["'self'", 'https:', "'unsafe-inline'"],
        // Images : self + data URIs + domaines externes
        'img-src': ["'self'", 'data:', 'https:'],
        // Polices : self + Google Fonts si utilise
        'font-src': ["'self'", 'https:', 'data:'],
        // Connexions API : self + services tiers
        'connect-src': [
          "'self'",
          'https://*.googleapis.com',
          'https://*.stripe.com',
          'https://*.google.com',
          'https://*.firebaseio.com',
          'wss://*.firebaseio.com',
        ],
        // Frames : Stripe checkout, reCAPTCHA
        'frame-src': ['https://*.stripe.com', 'https://*.google.com'],
        'base-uri': ["'none'"],
        'object-src': ["'none'"],
        'script-src-attr': ["'none'"],
        'upgrade-insecure-requests': true,
      },
      // Protection clickjacking
      // X-Frame-Options est aussi ajoute automatiquement
      crossOriginEmbedderPolicy: false, // incompatible avec certains services tiers (Stripe, Firebase)
    },

    // Subresource Integrity : hash de verification sur les scripts externes
    sri: true,

    // Desactiver les fonctionnalites deja gerees par le projet
    rateLimiter: false, // rate limiter custom deja en place
    xssValidator: false, // reCAPTCHA + rehype-sanitize deja en place
  },

  // Desactiver les headers de securite pour les routes API internes si besoin
  routeRules: {
    '/api/**': {
      security: {
        headers: {
          contentSecurityPolicy: false, // les API n'ont pas besoin de CSP
        },
      },
    },
  },
})
```

**Headers ajoutes automatiquement par `nuxt-security`** :

| Header                    | Valeur par defaut                 | Protection                                               |
| ------------------------- | --------------------------------- | -------------------------------------------------------- |
| `Content-Security-Policy` | Configure ci-dessus               | XSS, injection de code                                   |
| `X-Content-Type-Options`  | `nosniff`                         | MIME sniffing                                            |
| `X-Frame-Options`         | `SAMEORIGIN`                      | Clickjacking                                             |
| `X-XSS-Protection`        | `0`                               | Desactive le filtre XSS navigateur (recommande avec CSP) |
| `Referrer-Policy`         | `strict-origin-when-cross-origin` | Fuite d'informations                                     |
| `Permissions-Policy`      | Restrictif                        | Acces camera, micro, geolocation                         |

**Impact** : Protection contre les 5 types d'attaques web les plus courants.

**Effort** : Moyen - necessite de tester la CSP avec tous les services tiers (Firebase, Stripe, reCAPTCHA) et d'ajuster les domaines autorises.

---

#### 1.2 Header HSTS

**Probleme** : Le header `Strict-Transport-Security` force les navigateurs a toujours utiliser HTTPS, empechant les attaques de type downgrade HTTP.

**Contexte infrastructure** : L'application est derriere **Nginx Proxy Manager** avec des certificats **Let's Encrypt**. NPM peut configurer HSTS directement dans ses parametres de proxy host.

**Option A - Via Nginx Proxy Manager (recommandee)** :

Dans NPM, editer le proxy host > onglet "SSL" > activer "HSTS Enabled". NPM ajoutera automatiquement :

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Option B - Via Nuxt (si NPM ne le gere pas)** :

```typescript
// nuxt.config.ts
routeRules: {
  '/**': {
    headers: {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    }
  }
}
```

**Recommandation** : Privilegier l'option A (NPM) car le header HSTS doit etre present meme si l'application Nuxt est en erreur. Le reverse proxy est la meilleure couche pour ca.

**Impact** : Empeche les attaques man-in-the-middle par downgrade HTTPS.

**Effort** : Faible - une case a cocher dans NPM.

---

### Priorite 2 - Performance (impact fort)

#### 2.1 Activer `buildCache`

**Probleme** : Chaque `npm run build` reconstruit tout depuis zero. Avec `buildCache`, Nuxt met en cache les artefacts de build et ne reconstruit que ce qui a change.

**Solution** :

```typescript
// nuxt.config.ts
experimental: {
  buildCache: true, // AJOUTER
  lazyHydration: true, // deja present
  emitRouteChunkError: 'automatic', // deja present
}
```

**Impact** : Reduction significative du temps de build (particulierement utile avec le `NODE_OPTIONS='--max-old-space-size=8192'` actuel qui indique des builds lourds).

**Effort** : 1 ligne de code.

---

#### 2.2 Activer `viewTransition`

**Probleme** : Les transitions entre pages sont actuellement sans animation native. La View Transitions API permet des transitions fluides gerees nativement par le navigateur, sans JavaScript supplementaire.

**Solution** :

```typescript
// nuxt.config.ts
experimental: {
  viewTransition: true, // respecte automatiquement prefers-reduced-motion
}
```

**Comportement** :

- Navigateurs supportes (Chrome, Edge) : transition fluide entre les pages
- Navigateurs non supportes : comportement classique sans transition (pas de fallback JS)
- Respecte `prefers-reduced-motion` : desactive les animations pour les utilisateurs qui le demandent

**Impact** : Experience utilisateur amelioree avec des transitions natives performantes.

**Effort** : 1 ligne de code.

---

#### 2.3 Activer `crossOriginPrefetch`

**Probleme** : Le prefetching actuel ne concerne que les liens internes. La Speculation Rules API permet au navigateur de precharger aussi les ressources cross-origin.

**Solution** :

```typescript
// nuxt.config.ts
experimental: {
  crossOriginPrefetch: true,
}
```

**Impact** : Navigation plus rapide vers les liens externes (si le site en contient).

**Effort** : 1 ligne de code.

---

#### 2.4 Audit des balises `<img>` natives

**Probleme** : Le module `@nuxt/image` est installe et actif, mais il n'y a aucune garantie que tous les composants utilisent `<NuxtImg>` au lieu de `<img>` natif. Les `<img>` natifs ne beneficient pas de :

- Conversion automatique en WebP/AVIF
- Redimensionnement automatique
- Generation de `srcset` responsive
- Optimisation du LCP (Largest Contentful Paint)

**Action recommandee** : Auditer le code pour identifier les `<img>` natifs restants :

```bash
# Rechercher les <img> natifs dans les composants Vue
grep -rn '<img ' app/
```

**Bonnes pratiques `<NuxtImg>`** :

```vue
<!-- Image critique (hero banner, LCP) -->
<NuxtImg
  src="/hero-banner.jpg"
  format="webp"
  :preload="{ fetchPriority: 'high' }"
  loading="eager"
  width="1200"
  height="630"
  alt="Description"
/>

<!-- Image secondaire (logo, illustration) -->
<NuxtImg
  src="/logo-partenaire.jpg"
  format="webp"
  loading="lazy"
  fetchpriority="low"
  width="200"
  height="100"
  alt="Description"
/>

<!-- Image responsive avec srcset -->
<NuxtImg
  src="/photo.jpg"
  format="webp"
  sizes="sm:100vw md:50vw lg:400px"
  loading="lazy"
  alt="Description"
/>
```

**Impact** : Amelioration du score LCP (Core Web Vitals) et reduction de la bande passante.

**Effort** : Moyen - necessite de modifier chaque composant utilisant `<img>`.

---

#### 2.5 Configurer `@nuxt/image` explicitement

**Probleme** : Le module `@nuxt/image` est actif mais sans aucune configuration. Les valeurs par defaut sont fonctionnelles mais pas optimales.

**Solution** :

```typescript
// nuxt.config.ts
image: {
  // Qualite par defaut (80 est un bon compromis taille/qualite)
  quality: 80,
  // Formats modernes avec fallback
  format: ['webp', 'avif'],
  // Tailles responsives par defaut
  screens: {
    xs: 320,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    xxl: 1536,
  },
}
```

**Impact** : Images automatiquement optimisees en WebP/AVIF avec une qualite adequate.

**Effort** : Faible - quelques lignes de configuration.

---

### Priorite 3 - Performance (impact moyen)

#### 3.1 Verifier `headNext`

**Probleme** : L'option `headNext` active les optimisations du `<head>` HTML :

- **capo.js** : reordonne les tags `<head>` dans l'ordre optimal (preconnect avant CSS, CSS avant scripts)
- **Hash hydration** : evite la duplication des tags `<head>` lors de l'hydratation

En Nuxt 4, cette option devrait etre `true` par defaut. Verifier qu'elle n'est pas explicitement desactivee.

```typescript
// nuxt.config.ts - verifier que cette valeur est bien true
experimental: {
  headNext: true, // defaut en Nuxt 4
}
```

**Impact** : Amelioration du First Contentful Paint (FCP) grace a l'ordonnancement optimal du `<head>`.

**Effort** : Verification uniquement.

---

#### 3.2 Configurer les defaults de NuxtLink

**Probleme** : Les composants `<NuxtLink>` prefetchent les pages au survol par defaut. On peut optimiser ce comportement pour pre-charger au premier signe d'interaction.

**Solution** :

```typescript
// nuxt.config.ts
experimental: {
  defaults: {
    nuxtLink: {
      prefetch: true,
      prefetchOn: { interaction: true }
    }
  }
}
```

**Impact** : Navigation plus reactive, les pages sont pre-chargees des le debut de l'interaction.

**Effort** : Faible.

---

#### 3.3 Supprimer les `console.log` en production

**Probleme** : Les `console.log` en production consomment des ressources (serialisation d'objets, ecriture stdout) et peuvent exposer des informations sensibles dans les devtools du navigateur.

**Solution** :

```typescript
// nuxt.config.ts
vite: {
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
}
```

**Note** : Cette configuration supprime **tous** les `console.*` cote client en production. Les logs serveur (Nitro) ne sont pas affectes.

**Alternative** : Si certains `console.warn` ou `console.error` doivent etre conserves en production, utiliser `pure` au lieu de `drop` :

```typescript
vite: {
  esbuild: {
    pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug'] : [],
  },
}
```

**Impact** : Reduction de la taille du bundle client + securite (pas d'informations exposees dans la console).

**Effort** : 1 ligne de code.

---

### Priorite 4 - Architecture (bonnes pratiques)

#### 4.1 Rate limiter : envisager Redis en production

**Probleme** : Le rate limiter actuel utilise une `Map` JavaScript en memoire. Cela fonctionne parfaitement en single-instance, mais pose probleme si l'application est scalee horizontalement (plusieurs instances Node.js derriere un load balancer) :

- Chaque instance a son propre compteur
- Un attaquant peut repartir ses requetes entre les instances pour contourner les limites
- Les compteurs sont perdus a chaque redemarrage

**Contexte** : Si l'application tourne sur une seule instance Docker (ce qui semble etre le cas actuellement), ce n'est **pas urgent**. C'est une amelioration a planifier pour le passage a l'echelle.

**Solution (quand necessaire)** :

```typescript
// nuxt.config.ts
nitro: {
  storage: {
    rateLimit: {
      driver: 'redis',
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    }
  }
}
```

Puis adapter le rate limiter pour utiliser `useStorage('rateLimit')` au lieu de `Map`.

**Impact** : Rate limiting fiable en multi-instance.

**Effort** : Moyen - necessite Redis + refactoring du rate limiter.

---

#### 4.2 Definir un preset Nitro explicite

**Probleme** : Aucun preset Nitro n'est defini. Nitro auto-detecte l'environnement de deploiement, ce qui peut varier entre le dev local, Docker et la production.

**Solution** :

```typescript
// nuxt.config.ts
nitro: {
  preset: 'node-server', // ou 'node-cluster' pour multi-process
}
```

**Presets disponibles** :

- `node-server` : serveur Node.js classique (recommande pour Docker)
- `node-cluster` : multi-process avec `cluster` (utilise tous les CPUs)

**Impact** : Builds deterministes, meme comportement entre les environnements.

**Effort** : 1 ligne de code.

---

#### 4.3 Activer `propsDestructure`

**Probleme** : Vue 3.5+ propose la destructuration des props dans `<script setup>`, rendant le code plus lisible :

```vue
<!-- Avant -->
<script setup lang="ts">
const props = defineProps<{ title: string; count: number }>()
// Utilisation : props.title, props.count
</script>

<!-- Apres (avec propsDestructure) -->
<script setup lang="ts">
const { title, count } = defineProps<{ title: string; count: number }>()
// Utilisation directe : title, count (toujours reactifs)
</script>
```

**Solution** :

```typescript
// nuxt.config.ts
vue: {
  propsDestructure: true,
}
```

**Note** : Ceci est optionnel et n'affecte que le style de code. Les props destructurees restent reactives grace au compilateur Vue.

**Impact** : Code plus lisible, adoption progressive possible (pas de breaking change).

**Effort** : 1 ligne de code.

---

## Recapitulatif

### Tableau synthetique

| #   | Recommandation                             | Categorie       | Impact   | Effort       | Statut              |
| --- | ------------------------------------------ | --------------- | -------- | ------------ | ------------------- |
| 1.1 | Module `nuxt-security` (CSP, headers HTTP) | Securite        | Critique | Moyen        | Fait (report-only)  |
| 1.2 | Header HSTS (via NPM)                      | Securite        | Fort     | Faible       | A verifier dans NPM |
| 2.1 | `experimental.buildCache: true`            | Performance     | Fort     | 1 ligne      | Fait                |
| 2.2 | `experimental.viewTransition: true`        | UX              | Fort     | 1 ligne      | Fait                |
| 2.3 | `experimental.crossOriginPrefetch: true`   | Performance     | Moyen    | 1 ligne      | Fait                |
| 2.4 | Audit `<img>` natifs vers `<NuxtImg>`      | Performance     | Fort     | Moyen        | A auditer           |
| 2.5 | Configurer `@nuxt/image` (quality, format) | Performance     | Moyen    | Faible       | Fait                |
| 3.1 | Verifier `experimental.headNext: true`     | Performance     | Moyen    | Verification | OK (defaut Nuxt 4)  |
| 3.2 | Defaults NuxtLink prefetch                 | Performance     | Moyen    | Faible       | Fait                |
| 3.3 | Supprimer `console.log` en prod            | Perf + Securite | Moyen    | 1 ligne      | Fait                |
| 4.1 | Rate limiter Redis                         | Securite        | Moyen    | Moyen        | Planifier           |
| 4.2 | Preset Nitro explicite (`node-server`)     | Fiabilite       | Faible   | 1 ligne      | Fait                |
| 4.3 | `vue.propsDestructure: true`               | DX              | Faible   | 1 ligne      | Fait                |

### Prochaines etapes

1. **Valider la CSP en production** : Deployer, verifier la console navigateur (onglet Console, filtrer sur `[Report Only]`), ajuster les domaines si besoin, puis passer `report-only: false`
2. **Verifier HSTS dans NPM** : Dans Nginx Proxy Manager, editer le proxy host > onglet SSL > activer "HSTS Enabled"
3. **Auditer les `<img>` natifs** : Remplacer par `<NuxtImg>` pour optimiser le LCP
4. **Planifier Redis** : Migrer le rate limiter vers Redis quand le scaling le justifie
