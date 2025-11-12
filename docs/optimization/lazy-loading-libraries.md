# Lazy Loading des Bibliothèques Tierces

Ce document détaille la stratégie de lazy loading des bibliothèques tierces lourdes (Leaflet et FullCalendar) pour optimiser les performances de l'application.

## Objectifs

- Réduire la taille du bundle JavaScript initial
- Charger les bibliothèques uniquement quand elles sont nécessaires
- Améliorer le temps de chargement initial de l'application
- Maintenir une bonne expérience utilisateur

## Leaflet (Cartes interactives)

### État actuel

✅ **Déjà en lazy loading**

### Implémentation

Le composable `useLeafletMap.ts` charge Leaflet dynamiquement via CDN :

```typescript
const loadLeaflet = async () => {
  // Vérifier si Leaflet est déjà chargé
  if (typeof window !== 'undefined' && window.L) {
    return window.L
  }

  // Charger dynamiquement Leaflet CSS
  // Charger dynamiquement Leaflet JS via unpkg CDN
}
```

### Composants utilisant Leaflet

- `app/components/HomeMap.vue` : Carte des conventions sur la page d'accueil
- `app/components/FavoritesMap.vue` : Carte des favoris

### Avantages

- Leaflet (~145 KB) n'est chargé que sur les pages avec des cartes
- Chargement depuis le CDN avec cache navigateur
- Pas d'impact sur le bundle principal

---

## FullCalendar (Calendriers)

### État actuel

❌ **PAS encore en lazy loading** - Importé statiquement

### Packages installés

```json
{
  "@fullcalendar/core": "^6.1.15",
  "@fullcalendar/daygrid": "^6.1.15",
  "@fullcalendar/interaction": "^6.1.15",
  "@fullcalendar/list": "^6.1.15",
  "@fullcalendar/resource": "^6.1.19",
  "@fullcalendar/resource-timeline": "^6.1.19",
  "@fullcalendar/timeline": "^6.1.19",
  "@fullcalendar/vue3": "^6.1.15"
}
```

**Taille estimée** : ~300-400 KB (tous les plugins combinés)

### Composants utilisant FullCalendar

1. **HomeAgenda.vue** : Agenda des éditions sur la page d'accueil
   - Plugins utilisés : daygrid, list, interaction
   - Utilise le composable `useCalendar.ts`

2. **PlanningCard.vue** : Planning des bénévoles dans la gestion d'édition
   - Plugins utilisés : resource-timeline, timeline, daygrid, interaction
   - Utilise le composable `useVolunteerSchedule.ts`

### Implémentation actuelle

#### Composable `useCalendar.ts`

```typescript
import allLocales from '@fullcalendar/core/locales-all'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
```

#### Composants

```vue
<template>
  <FullCalendar ref="calendarRef" :options="calendarOptions" />
</template>

<script setup>
import FullCalendar from '@fullcalendar/vue3'
</script>
```

### Plan d'implémentation du lazy loading

#### Étape 1 : Créer un composant wrapper

Créer `app/components/ui/LazyFullCalendar.vue` :

```vue
<template>
  <div>
    <div v-if="loading" class="flex items-center gap-2 p-4">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
      <span>{{ t('common.loading') }}...</span>
    </div>
    <component
      v-else-if="FullCalendar"
      :is="FullCalendar"
      ref="calendarRef"
      :options="options"
      :class="class"
    />
  </div>
</template>

<script setup lang="ts">
import type { CalendarOptions } from '@fullcalendar/core'

interface Props {
  options: CalendarOptions
  class?: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const FullCalendar = ref<any>(null)
const loading = ref(true)
const calendarRef = ref<any>(null)

onMounted(async () => {
  try {
    // Import dynamique du composant FullCalendar
    const module = await import('@fullcalendar/vue3')
    FullCalendar.value = module.default
  } catch (error) {
    console.error('Error loading FullCalendar:', error)
  } finally {
    loading.value = false
  }
})

// Exposer la référence pour permettre l'accès depuis le parent
defineExpose({
  calendarRef,
})
</script>
```

#### Étape 2 : Adapter le composable `useCalendar.ts`

```typescript
// Remplacer les imports statiques par des imports dynamiques
export function useCalendar(options: UseCalendarOptions) {
  const plugins = ref<any[]>([])
  const allLocales = ref<any[]>([])

  // Charger les plugins dynamiquement
  const loadPlugins = async () => {
    const [dayGrid, list, interaction, locales] = await Promise.all([
      import('@fullcalendar/daygrid'),
      import('@fullcalendar/list'),
      import('@fullcalendar/interaction'),
      import('@fullcalendar/core/locales-all'),
    ])

    plugins.value = [dayGrid.default, list.default, interaction.default]
    allLocales.value = locales.default
  }

  onMounted(async () => {
    await loadPlugins()
    ready.value = true
  })

  // ...
}
```

#### Étape 3 : Mettre à jour les composants

Remplacer :

```vue
import FullCalendar from '@fullcalendar/vue3'
```

Par :

```vue
import LazyFullCalendar from '~/components/ui/LazyFullCalendar.vue'
```

Et dans le template :

```vue
<LazyFullCalendar ref="calendarRef" :options="calendarOptions" />
```

### Impact attendu

#### Avant

- Bundle initial : inclut FullCalendar (~300-400 KB)
- Chargé sur toutes les pages, même celles qui ne l'utilisent pas

#### Après

- Bundle initial : réduit de ~300-400 KB
- FullCalendar chargé uniquement sur :
  - Page d'accueil (HomeAgenda)
  - Page de gestion du planning des bénévoles
- Lazy load via code splitting automatique de Vite

### Avantages

- Réduction significative du bundle initial
- Amélioration du Time to Interactive (TTI)
- Meilleure expérience sur mobile et connexions lentes
- Code splitting automatique par route

### Inconvénients potentiels

- Léger délai lors du premier affichage du calendrier
- Complexité légèrement accrue du code
- Nécessité de gérer l'état de chargement

---

## Résumé

| Bibliothèque     | Taille estimée | Status Lazy Loading | Impact                      |
| ---------------- | -------------- | ------------------- | --------------------------- |
| **Leaflet**      | ~145 KB        | ✅ Déjà implémenté  | Pas dans le bundle initial  |
| **FullCalendar** | ~300-400 KB    | ❌ À implémenter    | Réduction majeure du bundle |

**Gain total potentiel** : ~300-400 KB du bundle initial (soit ~30-40% de réduction sur un bundle typique de 1 MB)

## Recommandations

1. ✅ **Leaflet** : Maintenir l'implémentation actuelle (déjà optimale)
2. 🚀 **FullCalendar** : Implémenter le lazy loading selon le plan ci-dessus
3. 📊 **Monitoring** : Mesurer l'impact avec Lighthouse/WebPageTest avant/après

## Ressources

- [Vite Code Splitting](https://vitejs.dev/guide/features.html#code-splitting)
- [Nuxt Dynamic Imports](https://nuxt.com/docs/guide/concepts/code-splitting)
- [FullCalendar Vue 3 Docs](https://fullcalendar.io/docs/vue)
- [Leaflet Quick Start](https://leafletjs.com/examples/quick-start/)
