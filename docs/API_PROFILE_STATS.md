# API Profile Stats

## Route `/api/profile/stats.get`

Cette route retourne les statistiques du profil de l'utilisateur authentifié.

### Authentification

Cette route nécessite une authentification. L'utilisateur doit être connecté.

### Réponse

La route retourne un objet JSON avec les statistiques suivantes :

```typescript
interface ProfileStats {
  conventionsCreated: number // Nombre de conventions créées par l'utilisateur
  editionsFavorited: number // Nombre d'éditions mises en favoris par l'utilisateur
  favoritesReceived: number // Nombre total de favoris reçus sur toutes les éditions créées
}
```

### Exemple d'usage

#### Côté client (composable)

```typescript
// composables/useProfileStats.ts
export const useProfileStats = () => {
  const stats = ref<ProfileStats | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchStats = async () => {
    loading.value = true
    error.value = null

    try {
      stats.value = await $fetch<ProfileStats>('/api/profile/stats')
    } catch (e) {
      error.value = 'Impossible de charger les statistiques'
      console.error('Erreur lors du chargement des statistiques:', e)
    } finally {
      loading.value = false
    }
  }

  return {
    stats: readonly(stats),
    loading: readonly(loading),
    error: readonly(error),
    fetchStats,
  }
}
```

#### Dans une page Vue

```vue
<script setup lang="ts">
const { stats, loading, error, fetchStats } = useProfileStats()

onMounted(() => {
  fetchStats()
})
</script>

<template>
  <div v-if="loading">Chargement des statistiques...</div>

  <div v-else-if="error" class="text-red-600">
    {{ error }}
  </div>

  <div v-else-if="stats" class="grid grid-cols-3 gap-4">
    <div class="stat-card">
      <h3>Conventions créées</h3>
      <p class="text-2xl font-bold">{{ stats.conventionsCreated }}</p>
    </div>

    <div class="stat-card">
      <h3>Éditions favorites</h3>
      <p class="text-2xl font-bold">{{ stats.editionsFavorited }}</p>
    </div>

    <div class="stat-card">
      <h3>Favoris reçus</h3>
      <p class="text-2xl font-bold">{{ stats.favoritesReceived }}</p>
    </div>
  </div>
</template>
```

### Erreurs

- **401 Unauthorized** : L'utilisateur n'est pas authentifié
- **500 Server Error** : Erreur interne du serveur

### Optimisations

- Les requêtes vers la base de données sont exécutées en parallèle avec `Promise.all()`
- Utilise les fonctions de comptage optimisées de Prisma (`_count`)
- Cache automatique côté client avec le système de cache de Nuxt

### Tests

Les tests sont disponibles dans `tests/composables/useProfileStats-api.test.ts` (test unitaire optimisé avec mocks Prisma)

```bash
# Lancer les tests spécifiques à cette route
npm run test:unit:run -- tests/composables/useProfileStats-api.test.ts
```

> 💡 **Note :** Les tests ont été convertis d'un test e2e lourd (5+ min timeout) vers un test unitaire rapide (543ms) pour améliorer les performances et la fiabilité.
