# Optimisation mémoire RAM — Convention de Jonglerie

> Document créé le 03/03/2026 — Basé sur les recommandations officielles Nuxt, les issues GitHub connues, et l'analyse du projet.

## Table des matières

- [1. Contexte et état actuel](#1-contexte-et-état-actuel)
- [2. Actions critiques](#2-actions-critiques)
  - [2.1 Limites mémoire Node.js en production](#21-limites-mémoire-nodejs-en-production)
  - [2.2 Désactiver le SSR pour les pages admin/gestion](#22-désactiver-le-ssr-pour-les-pages-admingestion)
  - [2.3 Désactiver les sourcemaps en production](#23-désactiver-les-sourcemaps-en-production)
- [3. Actions haute priorité](#3-actions-haute-priorité)
  - [3.1 Borner les stores Pinia](#31-borner-les-stores-pinia)
  - [3.2 Lazy-loading des bibliothèques lourdes côté client](#32-lazy-loading-des-bibliothèques-lourdes-côté-client)
  - [3.3 i18n — Fuites mémoire connues en SSR](#33-i18n--fuites-mémoire-connues-en-ssr)
- [4. Actions moyenne priorité](#4-actions-moyenne-priorité)
  - [4.1 Tuning V8 / Node.js](#41-tuning-v8--nodejs)
  - [4.2 Réduire les watchers deep:true](#42-réduire-les-watchers-deeptrue)
  - [4.3 Optimiser Leaflet (cartes)](#43-optimiser-leaflet-cartes)
  - [4.4 File d'attente pour les exports PDF/Chart](#44-file-dattente-pour-les-exports-pdfchart)
- [5. Actions basse priorité](#5-actions-basse-priorité)
  - [5.1 Évaluer nuxt-i18n-micro](#51-évaluer-nuxt-i18n-micro)
  - [5.2 Lazy hydration des composants](#52-lazy-hydration-des-composants)
  - [5.3 Nettoyage des event listeners et timers](#53-nettoyage-des-event-listeners-et-timers)
- [6. Outils de diagnostic](#6-outils-de-diagnostic)
- [7. Tableau récapitulatif](#7-tableau-récapitulatif)
- [8. Sources](#8-sources)

---

## 1. Contexte et état actuel

### Configuration mémoire actuelle

| Environnement                              | `--max-old-space-size` | Remarque       |
| ------------------------------------------ | ---------------------- | -------------- |
| Build (`package.json`)                     | 8192 Mo (8 Go)         | OK             |
| Dev (`docker-compose.dev.yml`)             | 6144 Mo (6 Go)         | OK             |
| **Production (`docker-compose.prod.yml`)** | **Non défini**         | **Risque OOM** |

### Estimation de la consommation mémoire

| Composant                              | Mémoire estimée | Niveau de risque |
| -------------------------------------- | --------------- | ---------------- |
| Stores Pinia (éditions, notifications) | 10-50 Mo        | Élevé            |
| Carte Leaflet (100 éléments)           | 5-20 Mo         | Élevé            |
| FullCalendar + événements              | 5-15 Mo         | Moyen            |
| Firebase SDK                           | 2-3 Mo          | Faible           |
| Données de localisation i18n           | 2-5 Mo          | Faible           |
| **Total normal**                       | **40-140 Mo**   |                  |
| Export PDF/Chart (pic temporaire)      | +15-50 Mo       | Élevé            |
| **Total en pic**                       | **70-200 Mo**   |                  |

---

## 2. Actions critiques

### 2.1 Limites mémoire Node.js en production

**Problème** : Aucune limite mémoire configurée en production. Le processus Node.js peut consommer toute la RAM disponible et provoquer un OOM kill.

**Solution** : Ajouter dans `docker-compose.prod.yml` :

```yaml
environment:
  NODE_OPTIONS: '--max-old-space-size=4096'
```

Optionnel — ajouter aussi une limite Docker :

```yaml
deploy:
  resources:
    limits:
      memory: 6G
```

### 2.2 Désactiver le SSR pour les pages admin/gestion

> **Statut : IMPLÉMENTÉ** (03/03/2026)

**Problème** : Chaque requête SSR consomme de la mémoire serveur. Les pages d'administration et de gestion n'ont pas besoin de rendu côté serveur (pas de SEO, utilisateurs authentifiés).

**Correction appliquée** dans `nuxt.config.ts` :

```typescript
routeRules: {
  '/editions/*/gestion/**': { appLayout: 'edition-dashboard', ssr: false },
  '/admin/**': { ssr: false },
}
```

**Impact** : Réduction de 30-50% de la charge SSR selon le trafic sur ces pages.

### 2.3 Désactiver les sourcemaps en production

> **Statut : IMPLÉMENTÉ** (03/03/2026)

**Problème** : Les sourcemaps doublent la consommation mémoire pendant le build et augmentent la taille des bundles.

**Correction appliquée** dans `nuxt.config.ts` :

```typescript
// Niveau Nuxt — désactivé côté serveur, client uniquement en dev
sourcemap: {
  server: false,
  client: process.env.NODE_ENV !== 'production',
}

// Niveau Vite (déjà en place)
vite: {
  build: {
    sourcemap: process.env.NODE_ENV !== 'production',
  }
}
```

**Impact** : Réduction de 200-500 Mo pendant le build.

---

## 3. Actions haute priorité

### 3.1 Borner les stores Pinia

> **Statut : IMPLÉMENTÉ** (03/03/2026)

#### Store `editions.ts`

**Problème** : `fetchAllEditions()` chargeait jusqu'à **10 000 éditions** en mémoire (`limit: '10000'`). `fetchEditionById()` et `setEdition()` ajoutaient des éditions au cache sans limite.

**Corrections appliquées** :

- Constante `MAX_ALL_EDITIONS = 1000` : limite pour `fetchAllEditions()` (agenda/carte)
- Constante `MAX_CACHED_EDITIONS = 200` : limite pour le cache d'éditions individuelles
- `fetchEditionById()` et `setEdition()` éjectent les entrées les plus anciennes quand la limite est atteinte

```typescript
const MAX_CACHED_EDITIONS = 200
const MAX_ALL_EDITIONS = 1000

// Dans fetchEditionById et setEdition :
if (this.editions.length >= MAX_CACHED_EDITIONS) {
  this.editions.splice(0, this.editions.length - MAX_CACHED_EDITIONS + 1)
}
```

#### Store `notifications.ts`

**Problème** : `loadMore()` et `addRealTimeNotification()` ajoutaient des notifications sans limite de taille. Des `console.log` persistaient en production.

**Corrections appliquées** :

- Constante `MAX_NOTIFICATIONS = 500`
- `fetchNotifications(append: true)` tronque les notifications au-delà de la limite
- `addRealTimeNotification()` tronque les notifications anciennes
- Suppression des `console.log` du store (3 occurrences)

```typescript
const MAX_NOTIFICATIONS = 500

// Dans fetchNotifications (append) et addRealTimeNotification :
// slice(0, MAX_NOTIFICATIONS) pour garder les plus récentes (début du tableau)
if (this.notifications.length > MAX_NOTIFICATIONS) {
  this.notifications = this.notifications.slice(0, MAX_NOTIFICATIONS)
}
```

### 3.2 Lazy-loading des bibliothèques lourdes côté client

**Problème** : Leaflet, FullCalendar, Chart.js, html2canvas et jsPDF sont compilés côté serveur alors qu'ils ne servent que côté client. Cela augmente la mémoire du build et le bundle serveur.

**Solutions** :

1. Envelopper les composants lourds avec `process.client` :

```typescript
const HeavyChart = process.client
  ? defineAsyncComponent(() => import('~/components/HeavyChart.vue'))
  : null
```

2. Utiliser `<ClientOnly>` dans les templates :

```vue
<ClientOnly>
  <LazyFullCalendar :options="calendarOptions" />
</ClientOnly>
```

3. Voir le document existant : `docs/optimization/lazy-loading-libraries.md`

**Impact** : -5-15 Mo par page utilisant ces bibliothèques.

### 3.3 i18n — Fuites mémoire connues en SSR

**Problème** : `@nuxtjs/i18n` (basé sur `vue-i18n`) est documenté comme ayant des fuites mémoire en SSR. Plusieurs issues GitHub le confirment :

- [Issue #2629](https://github.com/nuxt-modules/i18n/issues/2629) — Fuite avec `computed` et `await`
- [Issue #3644](https://github.com/nuxt-modules/i18n/issues/3644) — JavaScript Heap Out of Memory
- [Issue #2034](https://github.com/nuxt-modules/i18n/issues/2034) — Huge memory leak

**État actuel du projet** : Le lazy loading par domaine est déjà en place (bon point). La structure `i18n/locales/{langue}/{domaine}.json` limite les traductions chargées.

**Précautions** :

- Ne jamais définir de `computed` qui utilise `$i18n.t()` après un `await` dans un composant page :

```typescript
// MAUVAIS — cause une fuite mémoire en SSR
const data = await useFetch('/api/data')
const label = computed(() => t('some.key'))

// BON — envelopper dans onMounted
onMounted(() => {
  const label = computed(() => t('some.key'))
})
```

- S'assurer que seules les traductions de la route active sont chargées en SSR.

---

## 4. Actions moyenne priorité

### 4.1 Tuning V8 / Node.js

#### `--max-semi-space-size`

**Le flag le plus impactant pour les applications SSR**. Il augmente l'espace pour les objets de courte durée (Young Generation), réduisant la fréquence des Scavenge GC et évitant la promotion prématurée vers l'Old Space.

```bash
# En production
node --max-semi-space-size=64 --max-old-space-size=4096 .output/server/index.mjs
```

#### Autres flags utiles

```bash
# Diagnostiquer les événements GC
node --trace-gc .output/server/index.mjs

# Exposer le GC pour pouvoir le forcer manuellement
node --expose-gc .output/server/index.mjs
```

### 4.2 Réduire les watchers `deep:true`

**Problème** : 15 watchers `deep: true` identifiés dans le projet. Chaque watcher deep clone l'objet entier pour la comparaison. Sur 1000+ éléments : 5-20 Mo de surcharge.

**Fichiers concernés** (exemples) :

- `app/composables/useCalendar.ts` — Watch de tous les événements du calendrier
- `app/pages/editions/[id]/gestion/map.vue` — Watch des zones et marqueurs

**Solutions** :

1. Remplacer par des `computed` quand possible.
2. Utiliser `shallowRef` (défaut Nuxt 4 pour `useFetch`).
3. Ajouter du debounce sur les watchers lourds :

```typescript
import { watchDebounced } from '@vueuse/core'

watchDebounced(
  largeArray,
  (newVal) => {
    // traitement
  },
  { debounce: 300, deep: true }
)
```

### 4.3 Optimiser Leaflet (cartes)

**Problème** : Le composable `useLeafletEditable` maintient 5 Maps en mémoire (polygons, zoneIconMarkers, leafletMarkers, popupBaseData, popupExtraContent). Avec 1000 zones/marqueurs : 20-50 Mo de références DOM.

**Solutions** :

1. **Clustering** : Utiliser `leaflet.markercluster` pour regrouper les marqueurs à faible zoom.
2. **Limiter les éléments visibles** : Ne charger que les éléments dans le viewport actuel.
3. **Nettoyage des références DOM** : Supprimer les polygones/marqueurs hors viewport.

### 4.4 File d'attente pour les exports PDF/Chart

**Problème** : `html2canvas` à scale 2x + `jsPDF` créent des pics de 15-50 Mo par export. Sans protection, plusieurs exports concurrents peuvent atteindre 150 Mo.

**Solution** : Implémenter une file d'attente (un seul export à la fois) :

```typescript
let exportInProgress = false

async function exportChart() {
  if (exportInProgress) {
    toast.warning('Un export est déjà en cours')
    return
  }
  exportInProgress = true
  try {
    // ... export logic
  } finally {
    exportInProgress = false
  }
}
```

---

## 5. Actions basse priorité

### 5.1 Évaluer nuxt-i18n-micro

`nuxt-i18n-micro` est une alternative légère à `@nuxtjs/i18n`. Benchmark avec un fichier de 10 Mo :

| Métrique         | nuxt-i18n v10 | nuxt-i18n-micro | Différence    |
| ---------------- | ------------- | --------------- | ------------- |
| Mémoire          | 9 528 Mo      | 1 658 Mo        | **-7 870 Mo** |
| Temps de réponse | 1 363 ms      | 411 ms          | **-952 ms**   |
| Requêtes/sec     | 51            | 292             | **+241**      |

**Attention** : La migration nécessite des changements d'API (pas de `useI18n()`, API différente). À évaluer si i18n devient un goulot d'étranglement.

- [nuxt-i18n-micro sur Nuxt Modules](https://nuxt.com/modules/nuxt-i18n-micro)

### 5.2 Lazy hydration des composants

Nuxt 4 supporte les stratégies de lazy hydration pour réduire le JavaScript hydraté au chargement :

```vue
<template>
  <!-- Hydrater seulement quand le composant est visible -->
  <LazyHeavyChart hydrate-on-visible />

  <!-- Hydrater quand le navigateur est inactif -->
  <LazyCalendar hydrate-on-idle />

  <!-- Hydrater à l'interaction utilisateur -->
  <LazyMap hydrate-on-interaction />
</template>
```

**Impact** : Réduit l'empreinte mémoire côté client au chargement initial.

### 5.3 Nettoyage des event listeners et timers

**Règle** : Tout listener ajouté dans `onMounted()` doit être supprimé dans `onBeforeUnmount()` :

```typescript
onMounted(() => {
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
```

Même chose pour les `setInterval` / `setTimeout` :

```typescript
let interval: ReturnType<typeof setInterval>
onMounted(() => {
  interval = setInterval(doSomething, 1000)
})
onBeforeUnmount(() => {
  clearInterval(interval)
})
```

---

## 6. Outils de diagnostic

### Profiling mémoire serveur

```bash
# Lancer avec l'inspecteur Chrome DevTools
node --inspect .output/server/index.mjs

# Simuler de la charge avec autocannon
npx autocannon -c 10 -d 60 http://localhost:3000
```

Puis dans Chrome : `chrome://inspect` → Prendre des heap snapshots avant/après la charge.

### Monitoring côté serveur

```typescript
// Ajouter temporairement pour diagnostiquer
setInterval(() => {
  const mem = process.memoryUsage()
  console.log({
    rss: `${(mem.rss / 1048576).toFixed(1)} Mo`,
    heapUsed: `${(mem.heapUsed / 1048576).toFixed(1)} Mo`,
    heapTotal: `${(mem.heapTotal / 1048576).toFixed(1)} Mo`,
  })
}, 10000)
```

### Monitoring côté client

```typescript
// En développement uniquement
if (import.meta.dev && performance.memory) {
  setInterval(() => {
    console.log(`Heap: ${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} Mo`)
  }, 5000)
}
```

### Approche par élimination

Si la source d'une fuite est inconnue :

1. Désactiver les plugins un par un
2. Désactiver les modules un par un
3. Désactiver les middlewares
4. Tester la mémoire après chaque changement
5. Si la mémoire se normalise après une désactivation → source identifiée

---

## 7. Tableau récapitulatif

| Priorité     | Action                             | Impact RAM estimé      | Complexité |
| ------------ | ---------------------------------- | ---------------------- | ---------- |
| **Critique** | Limiter la mémoire Node.js en prod | Prévient les OOM       | Faible     |
| **Critique** | `ssr: false` pour admin/gestion    | -30-50% charge SSR     | Faible     |
| **Critique** | Désactiver sourcemaps en prod      | -200-500 Mo au build   | Faible     |
| **Haute**    | Borner les stores Pinia            | -10-50 Mo runtime      | Moyenne    |
| **Haute**    | Lazy-load bibliothèques client     | -5-15 Mo par page      | Moyenne    |
| **Haute**    | Précautions i18n en SSR            | Prévient les fuites    | Faible     |
| **Moyenne**  | `--max-semi-space-size=64`         | Optimise le GC         | Faible     |
| **Moyenne**  | Réduire les watchers `deep:true`   | -5-20 Mo               | Moyenne    |
| **Moyenne**  | Optimiser Leaflet (clustering)     | -10-40 Mo              | Élevée     |
| **Moyenne**  | File d'attente exports PDF         | Évite pics 50-150 Mo   | Faible     |
| **Basse**    | Évaluer `nuxt-i18n-micro`          | Potentiellement massif | Élevée     |
| **Basse**    | Lazy hydration                     | -5-10 Mo client        | Moyenne    |
| **Basse**    | Nettoyage listeners/timers         | Prévient les fuites    | Faible     |

---

## 8. Sources

### Documentation officielle

- [Nuxt Performance Best Practices (v4)](https://nuxt.com/docs/4.x/guide/best-practices/performance)
- [Nuxt Plugins Best Practices (v4)](https://nuxt.com/docs/4.x/guide/best-practices/plugins)
- [Nuxt Rendering Modes](https://nuxt.com/docs/4.x/guide/concepts/rendering)
- [Nuxt Experimental Features](https://nuxt.com/docs/4.x/guide/going-further/experimental-features)

### Issues GitHub

- [nuxt/nuxt#21458 — Very high memory usage during build](https://github.com/nuxt/nuxt/issues/21458)
- [nuxt-modules/i18n#3644 — JavaScript Heap Out of Memory](https://github.com/nuxt-modules/i18n/issues/3644)
- [nuxt-modules/i18n#2629 — Memory Leak with computed translations](https://github.com/nuxt-modules/i18n/issues/2629)
- [nuxt/nuxt#33705 — Memory leak with Pinia stores in SSR](https://github.com/nuxt/nuxt/issues/33705)
- [nuxt/devtools#761 — Devtools severe memory leak](https://github.com/nuxt/devtools/issues/761)

### Articles et guides

- [Nuxt 3 Memory Leak Analysis and Fixes (DEV Community)](https://dev.to/themodernpk/nuxt-3-memory-leak-analysis-and-fixes-39ga)
- [Analyze Memory Leaks in Your Nuxt App (Mokkapps)](https://mokkapps.de/blog/analyze-memory-leaks-in-your-nuxt-app)
- [Fixing Memory Leaks in Nuxt Applications (Ptylek)](https://www.ptylek.com/blog/fixing-memory-leak-in-nuxt-application/)
- [Memory Leak in SSR & Nuxt.js (Medium)](https://medium.com/@oliverolmaru/memory-leak-in-ssr-nuxt-js-if-everything-else-fails-1a28e6c2e360)
- [Optimizing Node.js: Impact of --max-semi-space-size (NearForm)](https://nearform.com/digital-community/optimising-node-js-applications-the-impact-of-max-semi-space-size-on-garbage-collection-efficiency/)
- [Node.js Understanding and Tuning Memory](https://nodejs.org/en/learn/diagnostics/memory/understanding-and-tuning-memory)
- [Using shallowRef with Nuxt useFetch](https://bordermedia.org/blog/using-shallowref-nuxt-usefetch)

### Alternatives

- [nuxt-i18n-micro — Module Nuxt léger](https://nuxt.com/modules/nuxt-i18n-micro)
- [nuxt-memwatch — Monitoring mémoire](https://nuxt.com/modules/memwatch)
