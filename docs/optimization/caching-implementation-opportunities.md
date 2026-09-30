# Opportunités d'implémentation du Caching

Ce document identifie les endpoints spécifiques où le caching peut être appliqué pour améliorer les performances de l'application.

## 📊 Vue d'ensemble

Les recommandations sont classées par **priorité** et **impact attendu**.

---

## 🔴 Priorité HAUTE - Impact fort

### 1. `/api/countries.get.ts` - Liste des pays

**État actuel :**

```typescript
// Exécute une requête Prisma à chaque appel
const countries = await prisma.edition.findMany({
  where: { status: 'PUBLISHED' },
  select: { country: true },
  distinct: ['country'],
  orderBy: { country: 'asc' },
})
```

**Problème :**

- Requête DB exécutée à chaque chargement de la page d'éditions
- Données changent rarement (seulement quand une nouvelle édition est créée ou publiée)
- Endpoint public appelé fréquemment
- Retourne tous les pays avec des éditions en ligne (passées, présentes, futures)

**Solution recommandée :**

**Caching côté serveur (1 heure)** :

```typescript
import { wrapApiHandler } from '#server/utils/api-helpers'
import { prisma } from '#server/utils/prisma'

export default wrapApiHandler(
  async (_event) => {
    // Clé de cache statique (données changent uniquement à la création/modification d'éditions)
    const cacheKey = 'countries:list'

    // Vérifier le cache
    const cached = await useStorage('cache').getItem(cacheKey)
    if (cached) {
      return cached
    }

    // Requête DB si pas en cache
    const countries = await prisma.edition.findMany({
      where: {
        status: 'PUBLISHED', // Toutes les éditions en ligne (passées, présentes, futures)
      },
      select: {
        country: true,
      },
      distinct: ['country'],
      orderBy: {
        country: 'asc',
      },
    })

    const result = countries.map((c) => c.country).filter(Boolean)

    // Mettre en cache pour 24 heures (invalide manuellement lors des mutations)
    await useStorage('cache').setItem(cacheKey, result, { ttl: 86400 })

    return result
  },
  { operationName: 'GetCountries' }
)
```

**Caching côté client (composable)** :

```typescript
// composables/useCountries.ts
export const useCountries = () => {
  const countries = useState<string[]>('countries', () => [])
  const loading = useState('countries-loading', () => false)

  const fetchCountries = async () => {
    // Éviter les requêtes multiples
    if (countries.value.length > 0 || loading.value) {
      return countries.value
    }

    loading.value = true
    try {
      countries.value = await $fetch('/api/countries')
    } finally {
      loading.value = false
    }

    return countries.value
  }

  return {
    countries: readonly(countries),
    loading: readonly(loading),
    fetchCountries,
  }
}
```

**Impact estimé :**

- Réduction de 99% des requêtes DB
- Temps de réponse : ~50ms → ~2ms (cache hit)
- Économie : ~100 requêtes/jour → ~1 requête/jour
- Cache invalidé uniquement lors de la création/modification/suppression d'éditions

---

### 2. `/api/site.webmanifest.get.ts` - Manifest PWA

**État actuel :**

```typescript
export default wrapApiHandler(
  () => {
    const nodeEnv = process.env.NODE_ENV
    // ... génération du manifest
    return { name: appName, ... }
  },
  { operationName: 'GetWebManifest' }
)
```

**Problème :**

- Généré dynamiquement à chaque requête
- Données **complètement statiques** (sauf en cas de changement d'environnement)
- Appelé par le navigateur au chargement de chaque page

**Solution recommandée :**

**Caching côté serveur (24 heures)** :

```typescript
import { wrapApiHandler } from '#server/utils/api-helpers'

export default wrapApiHandler(
  async () => {
    const nodeEnv = process.env.NODE_ENV
    const nuxtEnv = process.env.NUXT_ENV || nodeEnv

    // Clé de cache basée sur l'environnement
    const cacheKey = `webmanifest:${nodeEnv}:${nuxtEnv}`

    // Vérifier le cache
    const cached = await useStorage('cache').getItem(cacheKey)
    if (cached) {
      return cached
    }

    const iconVersion = 'v2'
    let appName = 'Juggling Convention'
    let shortName = 'JuggConv'
    let themeColor = '#0f172a'

    if (nodeEnv === 'development') {
      appName = 'Juggling Convention DEV'
      shortName = 'JuggConv DEV'
      themeColor = '#ef4444'
    } else if (nuxtEnv === 'release' || process.env.VERCEL_ENV === 'preview') {
      appName = 'Juggling Convention TEST'
      shortName = 'JuggConv TEST'
      themeColor = '#f59e0b'
    }

    const manifest = {
      name: appName,
      short_name: shortName,
      description: 'Plateforme de découverte et gestion de conventions de jonglerie',
      theme_color: themeColor,
      background_color: '#0f172a',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      orientation: 'portrait-primary',
      icons: [
        {
          src: `/favicons/android-chrome-192x192.png?v=${iconVersion}`,
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: `/favicons/android-chrome-512x512.png?v=${iconVersion}`,
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: `/favicons/apple-touch-icon.png?v=${iconVersion}`,
          sizes: '180x180',
          type: 'image/png',
        },
      ],
      categories: ['entertainment', 'lifestyle', 'sports'],
      lang: 'fr',
    }

    // Cache 24h
    await useStorage('cache').setItem(cacheKey, manifest, { ttl: 86400 })

    return manifest
  },
  { operationName: 'GetWebManifest' }
)
```

**Impact estimé :**

- Réduction de 99% de la charge CPU
- Temps de réponse : ~5ms → ~1ms
- Bénéfice surtout sur mobile (requête fréquente)

---

## 🟡 Priorité MOYENNE - Impact modéré

### 3. `/api/__sitemap__/*.get.ts` - Génération des sitemaps

**Endpoints concernés :**

- `/api/__sitemap__/editions.get.ts`
- `/api/__sitemap__/carpool.get.ts`
- `/api/__sitemap__/volunteers.get.ts`

**État actuel :**

```typescript
// Requête DB complète à chaque appel du crawler
const editions = await prisma.edition.findMany({
  where: { convention: { isArchived: false }, status: 'PUBLISHED' },
  select: { id: true, updatedAt: true, startDate: true, endDate: true },
})
```

**Problème :**

- Appelés par les crawlers SEO (Google, Bing, etc.)
- Données changent peu souvent
- Génération coûteuse (plusieurs requêtes, calculs de priorité)

**Solution recommandée :**

**Caching côté serveur (6 heures avec invalidation)** :

```typescript
import { wrapApiHandler } from '#server/utils/api-helpers'
import { prisma } from '#server/utils/prisma'

export default wrapApiHandler(
  async () => {
    const cacheKey = 'sitemap:editions'

    // Vérifier le cache
    const cached = await useStorage('cache').getItem(cacheKey)
    if (cached) {
      return cached
    }

    // Génération du sitemap (code actuel)
    const editions = await prisma.edition.findMany({
      where: {
        convention: { isArchived: false },
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        updatedAt: true,
        startDate: true,
        endDate: true,
      },
    })

    const urls = []
    const now = new Date()

    editions.forEach((edition) => {
      const isUpcoming = new Date(edition.startDate) > now
      const isRecent =
        new Date(edition.endDate) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      let priority = 0.5
      if (isUpcoming) priority = 0.9
      else if (isRecent) priority = 0.7

      const changefreq = isUpcoming ? 'weekly' : 'monthly'
      const lastmod = edition.updatedAt.toISOString()

      urls.push(
        { loc: `/editions/${edition.id}`, lastmod, changefreq, priority },
        {
          loc: `/editions/${edition.id}/commentaires`,
          lastmod,
          changefreq,
          priority: priority * 0.8,
        },
        { loc: `/editions/${edition.id}/carpool`, lastmod, changefreq, priority: priority * 0.7 }
      )

      const hasStarted = new Date(edition.startDate) <= now
      if (hasStarted) {
        urls.push({
          loc: `/editions/${edition.id}/lost-found`,
          lastmod,
          changefreq,
          priority: priority * 0.6,
        })
      }
    })

    // Cache 6h
    await useStorage('cache').setItem(cacheKey, urls, { ttl: 21600 })

    return urls
  },
  { operationName: 'GenerateEditionsSitemap' }
)
```

**Stratégie d'invalidation :**

```typescript
// server/api/editions/index.post.ts (création d'édition)
// server/api/editions/[id].put.ts (mise à jour d'édition)

// Ajouter après la création/modification :
await useStorage('cache').removeItem('sitemap:editions')
await useStorage('cache').removeItem('sitemap:carpool')
await useStorage('cache').removeItem('sitemap:volunteers')
```

**Impact estimé :**

- Réduction de 90% des requêtes DB sur sitemaps
- Amélioration du crawl SEO (temps de réponse plus rapide)
- Économie : ~20 requêtes/jour → ~2 requêtes/jour

---

### 4. `/api/editions/[id]/ticketing/stats/order-sources.get.ts` - Statistiques des sources de commande

**Problème probable :**

- Calculs d'agrégation potentiellement coûteux
- Données statistiques qui changent peu souvent

**Recommandation :**
**Analyser le contenu du fichier** pour déterminer si un cache court terme (5-15 minutes) serait approprié.

```typescript
// Pattern général pour les stats
const cacheKey = `ticketing:stats:order-sources:${editionId}`

const cached = await useStorage('cache').getItem(cacheKey)
if (cached) return cached

// Requête d'agrégation
const stats = await prisma.ticketOrder.groupBy({
  by: ['source'],
  where: { editionId },
  _count: true,
})

// Cache 15 minutes
await useStorage('cache').setItem(cacheKey, stats, { ttl: 900 })
```

---

## 🟢 Priorité BASSE - Nice to have

### 5. `/api/admin/config.get.ts` - Configuration admin

**État actuel :**
Lecture directe des variables d'environnement à chaque requête.

**Note :**

- Endpoint protégé (super admin uniquement)
- Appelé rarement
- Pas de requête DB

**Recommandation :**
Pas de caching nécessaire (overhead > bénéfice).

---

## 🛠️ Infrastructure requise

### Configuration du storage Nuxt

**`nuxt.config.ts`** :

```typescript
export default defineNuxtConfig({
  nitro: {
    storage: {
      cache: {
        driver: 'memory', // Développement
        // driver: 'redis',  // Production (recommandé)
        // host: process.env.REDIS_HOST,
        // port: process.env.REDIS_PORT,
        // password: process.env.REDIS_PASSWORD,
      },
    },
  },
})
```

### Helper d'invalidation

**`server/utils/cache-helpers.ts`** :

```typescript
/**
 * Invalide les caches liés aux éditions
 */
export async function invalidateEditionCache(editionId?: number) {
  const storage = useStorage('cache')

  await Promise.all([
    storage.removeItem('sitemap:editions'),
    storage.removeItem('sitemap:carpool'),
    storage.removeItem('sitemap:volunteers'),
    storage.removeItem('countries:list'),
  ])

  if (editionId) {
    // Invalider les caches spécifiques à l'édition
    await storage.removeItem(`ticketing:stats:order-sources:${editionId}`)
  }
}

/**
 * Invalide tous les caches
 */
export async function clearAllCache() {
  const storage = useStorage('cache')
  await storage.clear()
}
```

---

## 📈 Métriques de succès

**Indicateurs à surveiller après implémentation :**

1. **Temps de réponse API**
   - Baseline actuel : mesurer avec les DevTools
   - Objectif : réduction de 80% sur endpoints cachés

2. **Charge DB**
   - Nombre de requêtes Prisma/heure
   - Objectif : réduction de 40% globale

3. **Performance perçue**
   - Time to Interactive (TTI)
   - Largest Contentful Paint (LCP)

---

## 🚀 Plan d'implémentation

### Phase 1 - Quick Wins (1-2h)

1. ✅ Implémenter cache pour `/api/countries.get.ts`
2. ✅ Implémenter cache pour `/api/site.webmanifest.get.ts`
3. ✅ Créer helper `cache-helpers.ts`

### Phase 2 - Optimisations moyennes (2-3h)

4. ✅ Implémenter cache pour sitemaps
5. ✅ Ajouter invalidation sur mutations d'éditions
6. ⚠️ Composable `useCountries.ts` — créé, JAMAIS branché, **supprimé le 30/09/2026**. Aucun
   écran ne l'appelait : le code ci-dessus reste une proposition à réimplémenter le jour où l'on
   en aura l'emploi, et non un état des lieux.

### Phase 3 - Monitoring (1h)

7. ✅ Ajouter logs de cache hit/miss
8. ✅ Créer dashboard de métriques
9. ✅ Tests de charge

---

## ⚠️ Considérations importantes

### Invalidation du cache

**Règle d'or** : Toujours invalider le cache lors de mutations de données.

**Endpoints à modifier** :

- `POST /api/editions` → invalider `countries`, `sitemap:editions`
- `PUT /api/editions/[id]` → invalider caches liés
- `DELETE /api/editions/[id]` → invalider caches liés

### Mode développement

Utiliser `driver: 'memory'` pour éviter de configurer Redis en dev.

### Mode production

**Redis recommandé** pour :

- Persistance entre redémarrages
- Partage du cache entre instances (scaling horizontal)
- Meilleure performance

---

**Dernière mise à jour** : 12 novembre 2025
