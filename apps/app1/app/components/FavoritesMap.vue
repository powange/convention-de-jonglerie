<template>
  <div class="space-y-4">
    <!-- Badge des éditions -->
    <div v-if="upcomingFavorites.length > 0" class="flex justify-end mb-4">
      <UBadge :color="'primary'" variant="soft">
        {{
          $t('components.favorites_map.editions_with_location', { count: upcomingFavorites.length })
        }}
      </UBadge>
    </div>

    <!-- Message si aucune édition avec coordonnées -->
    <div
      v-if="upcomingFavorites.length === 0"
      class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
    >
      <UIcon name="i-heroicons-map-pin" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
      <p class="text-gray-600 dark:text-gray-400">
        {{ $t('components.favorites_map.no_upcoming_favorites') }}
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
                $t('components.favorites_map.upcoming')
              }}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-gray-500 rounded-full" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('components.favorites_map.past')
              }}</span>
            </div>
            <div class="flex items-center gap-2 pl-4 border-l border-gray-300 dark:border-gray-600">
              <div class="w-3 h-3 rounded-full border-2 border-yellow-500 bg-transparent" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('components.favorites_map.all_favorites')
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Conteneur de la carte -->
      <div class="relative z-0">
        <div
          ref="mapContainer"
          class="h-96 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
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
import type { Edition } from '~/types'
import { escapeHtml } from '~/utils/mapMarkers'

interface Props {
  editions: Edition[]
}

const props = defineProps<Props>()

// Références
const mapContainer = ref<HTMLElement | null>(null)

// Filtrer les éditions favorites à venir avec coordonnées
const upcomingFavorites = computed(() => {
  const now = new Date()
  return props.editions.filter((edition) => {
    const startDate = new Date(edition.startDate)
    return startDate >= now && edition.latitude && edition.longitude
  })
})

// Popup builder FavoritesMap : compact, sans description, toujours favori
const buildPopup = (ctx: PopupBuilderContext, _isFav: boolean): string => `
  <div class="p-3 min-w-[200px]">
    ${ctx.imageUrl ? `<img src="${escapeHtml(ctx.imageUrl)}" alt="${ctx.name}" class="w-full h-24 object-cover rounded mb-2">` : ''}
    <div class="flex items-start justify-between gap-2 mb-1">
      <h4 class="font-semibold text-gray-900 text-sm">${ctx.name}</h4>
      <span class="text-yellow-500 text-sm" title="${escapeHtml(ctx.t('common.favorite'))}">★</span>
    </div>
    <p class="text-xs text-gray-600 mb-1">${ctx.city}, ${ctx.country}</p>
    <p class="text-xs text-gray-500 mb-2">${ctx.dateRange}</p>
    <a href="${ctx.detailUrl}" class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      ${ctx.t('common.view_details')}
    </a>
  </div>
`

const { isLoading } = useMapMarkers({
  mapContainer,
  editions: upcomingFavorites,
  popupBuilder: buildPopup,
  isFavorite: () => true,
})
</script>
