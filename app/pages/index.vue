<template>
  <div class="flex gap-6">
    <!-- Panneau de filtres à gauche -->
    <div class="w-80 flex-shrink-0 hidden lg:block">
      <UCard class="sticky top-4">
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-semibold">{{ $t('homepage.filters') }}</h2>
            <UBadge v-if="activeFiltersCount > 0" :color="'primary'" variant="solid" size="xs">
              {{ activeFiltersCount }}
            </UBadge>
          </div>
        </template>

        <FiltersPanel
          :filters="filters"
          :services-by-category="servicesByCategory"
          :calendar-start-date="calendarStartDate"
          :calendar-end-date="calendarEndDate"
          @reset-filters="resetFilters"
          @update-filter="handleFilterUpdate"
          @update-start-date="updateStartDate"
          @update-end-date="updateEndDate"
        />
      </UCard>
    </div>

    <!-- Contenu principal à droite -->
    <div class="flex-1 min-w-0">
      <!-- En-tête avec boutons -->
      <div class="flex justify-end items-center gap-3 mb-6">
        <!-- Sélecteur de vue -->
        <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <UButton
            :color="viewMode === 'grid' ? 'primary' : 'neutral'"
            :variant="viewMode === 'grid' ? 'solid' : 'ghost'"
            icon="i-heroicons-squares-2x2"
            size="sm"
            @click="changeViewMode('grid')"
          >
            {{ $t('homepage.grid') }}
          </UButton>
          <UButton
            :color="viewMode === 'agenda' ? 'primary' : 'neutral'"
            :variant="viewMode === 'agenda' ? 'solid' : 'ghost'"
            icon="i-heroicons-calendar"
            size="sm"
            @click="changeViewMode('agenda')"
          >
            {{ $t('homepage.agenda') || 'Agenda' }}
          </UButton>
          <UButton
            :color="viewMode === 'map' ? 'primary' : 'neutral'"
            :variant="viewMode === 'map' ? 'solid' : 'ghost'"
            icon="i-heroicons-map"
            size="sm"
            @click="changeViewMode('map')"
          >
            {{ $t('homepage.map') }}
          </UButton>
        </div>
        <!-- Bouton filtres sur mobile -->
        <UButton
          v-if="!showMobileFilters"
          icon="i-heroicons-funnel"
          size="md"
          color="neutral"
          variant="outline"
          :label="$t('homepage.filters')"
          class="lg:hidden"
          @click="showMobileFilters = true"
        />
      </div>

      <!-- Filtres mobiles en overlay -->
      <UModal
        v-model:open="showMobileFilters"
        variant="subtle"
        size="lg"
        close-icon="i-heroicons-x-mark"
        @close="closeMobileFilters"
      >
        <template #header>
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-semibold">{{ $t('homepage.filters') }}</h2>
              <UBadge v-if="activeFiltersCount > 0" :color="'primary'" variant="solid" size="xs">
                {{ activeFiltersCount }}
              </UBadge>
            </div>
            <!-- Bouton de fermeture pour mobile -->
            <UButton
              icon="i-heroicons-x-mark"
              type="button"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="closeMobileFilters"
            >
              {{ $t('common.close') }}
            </UButton>
          </div>
        </template>

        <template #body>
          <FiltersPanel
            :filters="filters"
            :services-by-category="servicesByCategory"
            :calendar-start-date="calendarStartDate"
            :calendar-end-date="calendarEndDate"
            :is-mobile="true"
            @reset-filters="resetFilters"
            @update-filter="handleFilterUpdate"
            @update-start-date="updateStartDate"
            @update-end-date="updateEndDate"
          />
        </template>
      </UModal>

      <div v-if="editionStore.loading">
        <p>{{ $t('common.loading') }}...</p>
      </div>

      <div v-else-if="editionStore.error">
        <p class="text-red-500">{{ $t('common.error') }}: {{ editionStore.error }}</p>
      </div>

      <div v-else-if="editionStore.editions.length === 0">
        <div class="text-center py-8">
          <UIcon name="i-heroicons-magnifying-glass" class="text-gray-400 text-4xl mb-4" />
          <p v-if="activeFiltersCount > 0" class="text-gray-600">
            {{ $t('homepage.no_conventions_match_criteria') }}
          </p>
          <p v-else class="text-gray-600">
            {{ $t('homepage.no_conventions_found') }}
          </p>
          <UButton
            v-if="activeFiltersCount > 0"
            color="neutral"
            variant="outline"
            icon="i-heroicons-arrow-path"
            class="mt-4"
            @click="resetFilters"
          >
            {{ $t('common.reset') }}
          </UButton>
        </div>
      </div>

      <div v-else>
        <!-- Vue en grille -->
        <div v-if="viewMode === 'grid'">
          <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            <EditionCard
              v-for="edition in editionStore.editions"
              :key="edition.id"
              :edition="edition"
              :show-status="true"
            >
              <template #actions="{ edition: ed }">
                <UButton
                  v-if="authStore.isAuthenticated"
                  :icon="isFavorited(ed.id) ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                  :color="isFavorited(ed.id) ? 'warning' : 'neutral'"
                  variant="ghost"
                  size="sm"
                  @click="toggleFavorite(ed.id)"
                />
              </template>
            </EditionCard>
          </div>

          <!-- Pagination -->
          <div v-if="editionStore.pagination.totalPages > 1" class="mt-8 flex justify-center">
            <UPagination
              v-model:page="currentPage"
              :total="editionStore.pagination.total"
              :items-per-page="itemsPerPage"
              :sibling-count="1"
              :show-edges="true"
              size="md"
            />
          </div>
        </div>

        <!-- Vue Agenda -->
        <div v-else-if="viewMode === 'agenda'">
          <ClientOnly>
            <HomeAgenda :editions="editionStore.allEditions" />
          </ClientOnly>
        </div>

        <!-- Vue carte -->
        <div v-else-if="viewMode === 'map'">
          <HomeMap :editions="editionStore.allEditions" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'
import { useDebounceFn } from '@vueuse/core'
import { onMounted, computed, reactive, watch, ref, defineAsyncComponent, toRaw } from 'vue'

import { useTranslatedConventionServices } from '~/composables/useConventionServices'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

// SEO - Métadonnées de la page d'accueil
const { t, locale } = useI18n()

useSeoMeta({
  title: () => t('seo.homepage.title'),
  titleTemplate: () => `%s | ${t('seo.site_name')}`,
  description: () => t('seo.homepage.description'),
  keywords: () => t('seo.homepage.keywords'),
  ogTitle: () => t('seo.homepage.og_title'),
  ogDescription: () => t('seo.homepage.og_description'),
  ogType: 'website',
  ogLocale: () => locale.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => t('seo.homepage.twitter_title'),
  twitterDescription: () => t('seo.homepage.twitter_description'),
})

// Schema.org pour la page d'accueil
useSchemaOrg([
  defineWebSite({
    name: () => t('seo.site_name'),
    description: () => t('seo.site_description'),
    url: () => useRequestURL().origin,
    inLanguage: () => locale.value,
    potentialAction: [
      {
        '@type': 'SearchAction',
        target: () => `${useRequestURL().origin}/?name={search_term_string}`,
        'query-input': 'required name=search_term_string',
        description: () => t('seo.search_action.description'),
        name: () => t('seo.search_action.name'),
      },
    ],
  }),
  defineOrganization({
    name: 'Juggling Convention',
    alternateName: 'Convention de Jonglerie',
    description: () => t('seo.organization.description'),
    url: () => useRequestURL().origin,
    logo: () => `${useRequestURL().origin}/logos/logo-jc.svg`,
    foundingDate: '2024',
    organizationType: 'Organization',
    knowsAbout: [
      'Juggling',
      'Convention Management',
      'Event Organization',
      'Juggling Community',
      'Circus Arts',
    ],
    sameAs: [
      // TODO: Ajouter les liens vers les réseaux sociaux si disponibles
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      availableLanguage: ['fr', 'en', 'de', 'es', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'da'],
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'FR',
      addressLocality: 'France',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Juggling Conventions',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Event',
            name: 'Convention de Jonglerie',
            description: 'Événements de jonglerie organisés par la communauté',
          },
        },
      ],
    },
  }),
])

// Lazy loading du composant HomeMap
const HomeMap = defineAsyncComponent(() => import('~/components/HomeMap.vue'))

const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const showMobileFilters = ref(false)
const { getTranslatedServices, getTranslatedServicesByCategory } = useTranslatedConventionServices()
const services = getTranslatedServices
const servicesByCategory = getTranslatedServicesByCategory
// Initialiser le mode de vue depuis l'URL ou par défaut 'grid'
const getInitialViewMode = (): 'grid' | 'map' | 'agenda' => {
  const urlView = route.query.view as string
  if (urlView === 'agenda' || urlView === 'map' || urlView === 'grid') {
    return urlView
  }
  return 'grid'
}

const viewMode = ref<'grid' | 'map' | 'agenda'>(getInitialViewMode())

// Fonction pour initialiser les filtres depuis l'URL
const initFiltersFromUrl = () => {
  const query = route.query

  // Parser les pays avec gestion d'erreur
  let countries: string[] = []
  if (query.countries) {
    try {
      countries = JSON.parse(query.countries as string)
    } catch {
      countries = []
    }
  }

  return {
    name: (query.name as string) || '',
    startDate: (query.startDate as string) || '',
    endDate: (query.endDate as string) || '',
    countries,
    showPast: query.showPast ? query.showPast === 'true' : false,
    showCurrent: query.showCurrent ? query.showCurrent === 'true' : true,
    showFuture: query.showFuture ? query.showFuture === 'true' : true,
    // Initialiser les services depuis l'URL ou false par défaut
    ...Object.fromEntries(
      services.value.map((service: any) => [service.key, query[service.key] === 'true'])
    ),
  }
}

// Fonction pour changer le mode de vue et mettre à jour l'URL
const changeViewMode = (newMode: 'grid' | 'map' | 'agenda') => {
  viewMode.value = newMode
  updateUrlFromFilters({ view: newMode === 'grid' ? undefined : newMode })
}

// Fonction pour mettre à jour l'URL avec les filtres
const updateUrlFromFilters = (extraParams: Record<string, any> = {}) => {
  const query: Record<string, any> = { ...extraParams }

  // Préserver le viewMode actuel si pas explicitement fourni dans extraParams
  if (!('view' in extraParams)) {
    if (viewMode.value !== 'grid') {
      query.view = viewMode.value
    }
  }

  // Ajouter les filtres non-par défaut à l'URL
  if (filters.name) query.name = filters.name
  if (filters.startDate) query.startDate = filters.startDate
  if (filters.endDate) query.endDate = filters.endDate
  if (filters.countries.length > 0) query.countries = JSON.stringify(filters.countries)

  // Filtres temporels (seulement si différents des valeurs par défaut)
  if (filters.showPast !== false) query.showPast = filters.showPast.toString()
  if (filters.showCurrent !== true) query.showCurrent = filters.showCurrent.toString()
  if (filters.showFuture !== true) query.showFuture = filters.showFuture.toString()

  // Services actifs
  services.value.forEach((service: any) => {
    if ((filters as any)[service.key]) {
      query[service.key] = 'true'
    }
  })

  router.push({ query })
}

// Lazy load agenda component (FullCalendar wrapper)
const HomeAgenda = defineAsyncComponent(() => import('~/components/HomeAgenda.vue'))

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(12)

// CalendarDate objects pour les sélecteurs de date
const calendarStartDate = ref<CalendarDate | null>(null)
const calendarEndDate = ref<CalendarDate | null>(null)

// Compteur de filtres actifs
const activeFiltersCount = computed(() => {
  let count = 0
  if (filters.name) count++
  if (filters.startDate) count++
  if (filters.endDate) count++
  if (filters.countries.length > 0) count++
  // Compter le filtre temporel si pas tous cochés (par défaut showPast=false, showCurrent=true, showFuture=true)
  if (!(filters.showPast === false && filters.showCurrent === true && filters.showFuture === true))
    count++
  // Compter les services actifs
  count += services.value.filter((service: any) => (filters as any)[service.key]).length
  return count
})

const filters = reactive(initFiltersFromUrl())

// Créer une fonction debounced pour éviter les appels API trop fréquents
// Délai de 300ms pour tous les changements de filtres pour éviter la surcharge
const debouncedFetchEditions = useDebounceFn((newFilters: any) => {
  editionStore.fetchEditions(newFilters)
}, 300)

// Variable pour tracker le dernier nom recherché
let lastNameFilter = ''

// Watcher pour appliquer automatiquement les filtres
watch(
  [filters, currentPage],
  ([newFilters, newPage]) => {
    // Si c'est uniquement le champ name qui a changé, utiliser le debounce
    // Sinon (checkbox, dates, etc.), appliquer immédiatement pour une meilleure réactivité
    const nameChanged = filters.name !== lastNameFilter
    lastNameFilter = filters.name

    const filtersWithPage = { ...newFilters, page: newPage, limit: itemsPerPage.value }

    if (nameChanged && filters.name !== '') {
      // Debounce pour le champ de recherche texte
      debouncedFetchEditions(filtersWithPage)
    } else {
      // Application immédiate pour les autres filtres (checkbox, dates, pays)
      editionStore.fetchEditions(filtersWithPage)
    }

    // Si on est en mode agenda ou carte, charger aussi toutes les éditions
    if (viewMode.value === 'agenda' || viewMode.value === 'map') {
      editionStore.fetchAllEditions(newFilters)
    }

    // Mettre à jour l'URL avec les nouveaux filtres
    updateUrlFromFilters()
  },
  { deep: true, immediate: false }
)

// Watcher pour charger toutes les éditions quand on passe en mode agenda ou carte
watch(viewMode, (newViewMode) => {
  if (newViewMode === 'agenda' || newViewMode === 'map') {
    // Charger toutes les éditions avec les filtres actuels
    editionStore.fetchAllEditions(filters)
  }
})

// Watcher pour synchroniser les filtres avec les changements d'URL (boutons navigateur)
watch(
  () => route.query,
  (_newQuery) => {
    const newFilters = initFiltersFromUrl()
    // Mettre à jour seulement si les filtres ont vraiment changé pour éviter une boucle
    const filtersChanged = JSON.stringify(newFilters) !== JSON.stringify(toRaw(filters))
    if (filtersChanged) {
      Object.assign(filters, newFilters)
    }

    // Synchroniser le viewMode avec l'URL (séparément des filtres)
    const newView = route.query.view as string
    const validViews = ['grid', 'agenda', 'map']
    const targetView =
      newView && validViews.includes(newView) ? (newView as 'grid' | 'agenda' | 'map') : 'grid'
    if (viewMode.value !== targetView) {
      viewMode.value = targetView
    }
  },
  { deep: true }
)

const updateStartDate = (date: CalendarDate | null) => {
  if (date) {
    // Convertir CalendarDate en string ISO
    filters.startDate = date.toString()
  } else {
    filters.startDate = ''
  }
}

const updateEndDate = (date: CalendarDate | null) => {
  if (date) {
    // Convertir CalendarDate en string ISO
    filters.endDate = date.toString()
  } else {
    filters.endDate = ''
  }
}

// Initialiser les CalendarDate quand les filtres changent
watch(
  () => filters.startDate,
  (newValue) => {
    if (newValue) {
      const parts = newValue.split('-').map(Number)
      if (parts.length === 3 && parts.every((part) => !isNaN(part))) {
        const [year, month, day] = parts
        if (year && month && day) {
          calendarStartDate.value = new CalendarDate(year, month, day)
        }
      }
    } else {
      calendarStartDate.value = null
    }
  }
)

watch(
  () => filters.endDate,
  (newValue) => {
    if (newValue) {
      const parts = newValue.split('-').map(Number)
      if (parts.length === 3 && parts.every((part) => !isNaN(part))) {
        const [year, month, day] = parts
        if (year && month && day) {
          calendarEndDate.value = new CalendarDate(year, month, day)
        }
      }
    } else {
      calendarEndDate.value = null
    }
  }
)

const resetFilters = () => {
  filters.name = ''
  filters.startDate = ''
  filters.endDate = ''
  filters.countries = []
  calendarStartDate.value = null
  calendarEndDate.value = null
  // Réinitialiser les filtres temporels aux valeurs par défaut
  filters.showPast = false
  filters.showCurrent = true
  filters.showFuture = true
  // Réinitialiser tous les services
  services.value.forEach((service: any) => {
    ;(filters as any)[service.key] = false
  })
  // Vider l'URL (garder seulement la vue si elle n'est pas 'grid')
  const query: Record<string, any> = {}
  if (viewMode.value !== 'grid') {
    query.view = viewMode.value
  }
  router.push({ query })
  editionStore.fetchEditions({ ...filters, page: currentPage.value, limit: itemsPerPage.value }) // Fetch all conventions again
}

// Fonction pour gérer les mises à jour de filtres depuis le composant FiltersPanel
const handleFilterUpdate = ({ key, value }: { key: string; value: any }) => {
  Object.assign(filters, { [key]: value })
}

onMounted(() => {
  editionStore.fetchEditions({ ...filters, page: currentPage.value, limit: itemsPerPage.value })
  // Si on démarre en mode agenda ou carte, charger toutes les éditions aussi
  if (viewMode.value === 'agenda' || viewMode.value === 'map') {
    editionStore.fetchAllEditions(filters)
  }
})

const isFavorited = computed(() => (editionId: number) => {
  return editionStore.editions
    .find((c: any) => c.id === editionId)
    ?.favoritedBy.some((u: any) => u.id === authStore.user?.id)
})

// Réinitialiser la page courante quand les filtres changent
watch(
  filters,
  () => {
    currentPage.value = 1
  },
  { deep: true }
)

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
    toast.add({
      title: t('messages.favorite_status_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: unknown) {
    const error = e as { message?: string }
    toast.add({
      title: error.message || t('errors.favorite_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const closeMobileFilters = () => {
  showMobileFilters.value = false
}
</script>
