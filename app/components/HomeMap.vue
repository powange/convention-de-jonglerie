<template>
  <div class="space-y-4">
    <!-- Badge des éditions -->
    <div v-if="editionsWithCoordinates.length > 0" class="flex justify-between items-center mb-4">
      <UBadge :color="'primary'" variant="soft">
        {{ $t('components.map.editions_on_map', { count: editionsWithCoordinates.length }) }}
      </UBadge>
      <p class="text-sm text-gray-500">
        {{
          editions.length - editionsWithCoordinates.length > 0
            ? $t('components.map.without_coordinates', {
                count: editions.length - editionsWithCoordinates.length,
              })
            : ''
        }}
      </p>
    </div>

    <!-- Message si aucune édition avec coordonnées -->
    <div
      v-if="editionsWithCoordinates.length === 0"
      class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg"
    >
      <UIcon name="i-heroicons-map-pin" class="mx-auto h-12 w-12 text-gray-400 mb-3" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('components.map.no_editions_with_location') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ $t('components.map.incomplete_address_warning') }}
      </p>
    </div>

    <!-- Légende au-dessus de la carte -->
    <div v-else>
      <div
        class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg mb-3 border border-gray-200 dark:border-gray-700"
      >
        <div class="flex flex-wrap items-center gap-4">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('components.map.temporal_status') }} :
          </span>
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-emerald-500 rounded-full" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('components.map.ongoing')
              }}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-blue-500 rounded-full" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('components.map.upcoming')
              }}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-gray-500 rounded-full" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('components.map.past')
              }}</span>
            </div>
            <div v-if="authStore.isAuthenticated" class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full border-2 border-yellow-500 bg-transparent" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('components.map.yellow_border_favorite')
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Conteneur de la carte -->
      <div class="relative z-0">
        <div
          ref="mapContainer"
          class="h-[600px] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <!-- Message de chargement -->
          <div
            v-if="isLoading"
            class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800"
          >
            <div class="text-center">
              <UIcon
                name="i-heroicons-arrow-path"
                class="animate-spin text-primary-500 mx-auto mb-2"
                size="24"
              />
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('components.map.loading') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PopupBuilderContext } from '~/composables/useMapMarkers'
import { useAuthStore } from '~/stores/auth'
import { useFavoritesEditionsStore } from '~/stores/favoritesEditions'
import type { Edition } from '~/types'
import { escapeHtml } from '~/utils/mapMarkers'

interface Props {
  editions: Edition[]
}

const props = defineProps<Props>()
const authStore = useAuthStore()
const favoritesStore = useFavoritesEditionsStore()

// Initialiser les favoris si l'utilisateur est authentifié
if (authStore.isAuthenticated) {
  favoritesStore.ensureInitialized()
}

// Références
const mapContainer = ref<HTMLElement | null>(null)

// Filtrer les éditions avec coordonnées
const editionsWithCoordinates = computed(() => {
  return props.editions.filter((edition) => edition.latitude !== null && edition.longitude !== null)
})

// Vérifier si l'utilisateur a mis en favori cette édition
const isFavorited = (edition: Edition): boolean => {
  if (!authStore.user?.id) return false
  return favoritesStore.isFavorite(edition.id)
}

// Popup builder HomeMap : grand format, avec description
const buildPopup = (ctx: PopupBuilderContext, isFav: boolean): string => `
  <div class="p-3 min-w-[250px]">
    ${ctx.imageUrl ? `<img src="${escapeHtml(ctx.imageUrl)}" alt="${ctx.name}" class="w-full h-32 object-cover rounded mb-3">` : ''}
    <div class="flex items-start justify-between gap-2 mb-2">
      <h4 class="font-semibold text-gray-900">${ctx.name}</h4>
      ${isFav ? `<span class="text-yellow-500" title="${escapeHtml(ctx.t('common.favorite'))}">★</span>` : ''}
    </div>
    <p class="text-sm text-gray-600 mb-1">${ctx.city}, ${ctx.country}</p>
    <p class="text-xs text-gray-500 mb-3">${ctx.dateRange}</p>
    ${ctx.description ? `<p class="text-xs text-gray-600 mb-3 line-clamp-2">${ctx.description}</p>` : ''}
    <a href="${ctx.detailUrl}" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002 2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      ${ctx.t('common.view_details')}
    </a>
  </div>
`

const { isLoading } = useMapMarkers({
  mapContainer,
  editions: editionsWithCoordinates,
  popupBuilder: buildPopup,
  isFavorite: isFavorited,
})
</script>

<style scoped>
/* Force la hauteur minimale de la carte sur mobile */
@media (max-width: 640px) {
  [ref='mapContainer'] {
    min-height: 400px;
  }
}
</style>
