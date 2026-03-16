<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <div v-else class="space-y-6">
      <!-- En-tête avec navigation -->
      <EditionHeader :edition="edition" current-page="map" />

      <!-- Message si pas de zones ni de markers -->
      <UAlert
        v-if="zones.length === 0 && markers.length === 0"
        icon="i-lucide-map"
        color="info"
        variant="soft"
        :title="$t('gestion.map.no_items')"
      />

      <!-- Contenu principal -->
      <div
        v-if="zones.length > 0 || markers.length > 0"
        class="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        <!-- Carte -->
        <div class="lg:col-span-2 relative z-0">
          <UCard
            class="w-full aspect-square lg:aspect-auto lg:h-[calc(100vh-var(--ui-header-height)-16rem)]"
            :ui="{ body: 'h-full p-0' }"
          >
            <div ref="mapContainerRef" class="h-full w-full rounded-lg" />
          </UCard>
        </div>

        <!-- Légende -->
        <div class="space-y-4">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-layers" class="h-5 w-5" />
                <h2 class="font-semibold">{{ $t('gestion.map.zones_list') }}</h2>
              </div>
            </template>

            <ZonesLegend
              :zones="zones"
              :markers="markers"
              :editable="false"
              @focus="handleFocusZone"
              @focus-marker="handleFocusMarker"
              @toggle-visibility="handleToggleVisibility"
            />
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ZonesLegend from '~/components/edition/zones/ZonesLegend.vue'
import type { EditionMarker } from '~/composables/useEditionMarkers'
import type { EditionZone } from '~/composables/useEditionZones'
import { useEditionStore } from '~/stores/editions'
import { getEditionDisplayName } from '~/utils/editionName'
import { escapeHtml } from '~/utils/mapMarkers'

const route = useRoute()
const { t, locale } = useI18n()
const editionStore = useEditionStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Query params pour focus automatique sur une zone ou un marqueur
const focusZoneId = computed(() => {
  const val = route.query.focusZone
  return val ? parseInt(val as string) : null
})
const focusMarkerId = computed(() => {
  const val = route.query.focusMarker
  return val ? parseInt(val as string) : null
})

// Métadonnées SEO
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))

const seoTitle = computed(() => {
  if (!edition.value) return t('edition.map')
  return `${t('edition.map')} - ${editionName.value}`
})

const seoDescription = computed(() => {
  if (!edition.value) return ''
  return `${t('edition.map')} - ${editionName.value}, ${edition.value.city || ''}`
})

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
})
const loading = computed(() => editionStore.loading)

// Zones
const { zones } = useEditionZones(editionId)

// Markers
const { markers } = useEditionMarkers(editionId)

// Map (mode lecture seule)
const mapContainerRef = ref<HTMLElement | null>(null)

// Flag pour ne centrer la carte qu'une seule fois (évite le recentrage après navigation utilisateur)
const initialViewSet = ref(false)

const {
  map,
  addZones,
  addMarkers,
  focusOnZone,
  focusOnMarker,
  setPopupExtra,
  showZone,
  hideZone,
  showMarker,
  hideMarker,
  fitBoundsToItems,
} = useLeafletEditable(mapContainerRef, {
  center: computed(() => {
    if (edition.value?.latitude && edition.value?.longitude) {
      return [edition.value.latitude, edition.value.longitude]
    }
    return [46.603354, 1.888334]
  }).value,
  zoom: edition.value?.latitude ? 15 : 6,
  editable: false,
  typeLabel: (type: string) => t(`gestion.map.types.${type.toLowerCase()}`),
  popupLabels: { navigate: t('gestion.map.popup_navigate') },
})

// Ajouter les zones à la carte quand elles sont chargées ET que la carte est prête
// Note: addZones vérifie déjà les doublons via polygons.value.has(zone.id)
watch(
  [zones, map],
  ([newZones, newMap]) => {
    if (newMap && newZones.length > 0) {
      addZones(
        newZones.map((z) => ({
          id: z.id,
          name: z.name,
          description: z.description,
          color: z.color,
          coordinates: z.coordinates,
          zoneTypes: z.zoneTypes,
          order: z.order,
        }))
      )
    }
  },
  { immediate: true }
)

// Ajouter les markers à la carte quand ils sont chargés ET que la carte est prête
// Note: addMarkers vérifie déjà les doublons via leafletMarkers.value.has(marker.id)
watch(
  [markers, map],
  ([newMarkers, newMap]) => {
    if (newMap && newMarkers.length > 0) {
      addMarkers(
        newMarkers.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          latitude: m.latitude,
          longitude: m.longitude,
          markerTypes: m.markerTypes,
          color: m.color,
          order: m.order,
        }))
      )
    }
  },
  { immediate: true }
)

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId.value, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
})

// Adapter le zoom pour afficher tous les éléments (une seule fois)
// Si un focus spécifique est demandé via query param, ne pas centrer (le focus prend le relais)
// nextTick garantit que les watches addZones/addMarkers ont peuplé les structures Leaflet
watch(
  [zones, markers, map],
  async ([newZones, newMarkers, newMap]) => {
    if (!initialViewSet.value && newMap && (newZones.length > 0 || newMarkers.length > 0)) {
      if (!focusZoneId.value && !focusMarkerId.value) {
        await nextTick()
        fitBoundsToItems()
      }
      initialViewSet.value = true
    }
  },
  { immediate: true }
)

// Focus automatique sur une zone/marqueur via query params
const focusApplied = ref(false)
watch(
  [zones, markers, map],
  ([newZones, newMarkers, newMap]) => {
    if (focusApplied.value || !newMap) return

    if (focusZoneId.value && newZones.some((z) => z.id === focusZoneId.value)) {
      focusOnZone(focusZoneId.value)
      focusApplied.value = true
    } else if (focusMarkerId.value && newMarkers.some((m) => m.id === focusMarkerId.value)) {
      focusOnMarker(focusMarkerId.value)
      focusApplied.value = true
    }
  },
  { immediate: true }
)

// Spectacles publics — affichés dans les popups des zones/marqueurs
const { data: publicShows } = useFetch<any[]>(`/api/editions/${editionId.value}/shows/public`, {
  lazy: true,
  transform: (response: any) => response?.data?.shows || response?.shows || [],
})

const showsByZone = computed(() => {
  const map = new Map<number, any[]>()
  if (!publicShows.value) return map
  for (const show of publicShows.value) {
    if (show.zoneId) {
      if (!map.has(show.zoneId)) map.set(show.zoneId, [])
      map.get(show.zoneId)!.push(show)
    }
  }
  return map
})

const showsByMarker = computed(() => {
  const map = new Map<number, any[]>()
  if (!publicShows.value) return map
  for (const show of publicShows.value) {
    if (show.markerId) {
      if (!map.has(show.markerId)) map.set(show.markerId, [])
      map.get(show.markerId)!.push(show)
    }
  }
  return map
})

const formatPopupDateTime = (dateTimeStr: string) => {
  const date = new Date(dateTimeStr)
  const localeCode = locale.value === 'fr' ? 'fr-FR' : locale.value
  const day = date.toLocaleDateString(localeCode, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const time = date.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })
  return `${day} ${time}`
}

// Workshops — affichés dans les popups des zones/marqueurs
const { data: workshops } = useFetch<any[]>(`/api/editions/${editionId.value}/workshops`, {
  lazy: true,
  transform: (response: any) => response?.data?.workshops || response?.workshops || response || [],
})

// Filtrer les workshops non terminés
const upcomingWorkshops = computed(() => {
  if (!workshops.value) return []
  const now = new Date()
  return workshops.value.filter((ws) => new Date(ws.endDateTime) > now)
})

const workshopsByZone = computed(() => {
  const m = new Map<number, any[]>()
  for (const ws of upcomingWorkshops.value) {
    const zId = ws.location?.zoneId
    if (zId) {
      if (!m.has(zId)) m.set(zId, [])
      m.get(zId)!.push(ws)
    }
  }
  return m
})

const workshopsByMarker = computed(() => {
  const m = new Map<number, any[]>()
  for (const ws of upcomingWorkshops.value) {
    const mId = ws.location?.markerId
    if (mId) {
      if (!m.has(mId)) m.set(mId, [])
      m.get(mId)!.push(ws)
    }
  }
  return m
})

const buildItemsPopupHtml = (shows: any[], wsItems: any[]) => {
  let html = ''

  if (shows.length > 0) {
    const sorted = [...shows].sort(
      (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    )
    html += '<hr style="margin: 8px 0; border-color: #e5e7eb;"/>'
    html += `<div style="margin-top: 4px;"><strong>🎭 ${escapeHtml(t('edition.public_shows'))}</strong>`
    html += '<div style="margin-top: 4px; font-size: 13px;">'
    for (const show of sorted) {
      html += `<div style="margin-top: 4px;">• ${escapeHtml(show.title)} — ${formatPopupDateTime(show.startDateTime)}`
      if (show.duration) html += ` (${show.duration} min)`
      html += '</div>'
    }
    html += '</div></div>'
  }

  if (wsItems.length > 0) {
    const sorted = [...wsItems].sort(
      (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    )
    html += '<hr style="margin: 8px 0; border-color: #e5e7eb;"/>'
    html += `<div style="margin-top: 4px;"><strong>🎓 ${escapeHtml(t('workshops.page_title'))}</strong>`
    html += '<div style="margin-top: 4px; font-size: 13px;">'
    for (const ws of sorted) {
      html += `<div style="margin-top: 4px;">• ${escapeHtml(ws.title)} — ${formatPopupDateTime(ws.startDateTime)}`
      html += '</div>'
    }
    html += '</div></div>'
  }

  return html
}

// Mettre à jour les popups quand les spectacles ou workshops sont chargés
watch(
  [publicShows, workshops, zones, markers, map],
  () => {
    if (!map.value) return

    for (const zone of zones.value) {
      const zoneShows = showsByZone.value.get(zone.id) || []
      const zoneWorkshops = workshopsByZone.value.get(zone.id) || []
      if (zoneShows.length > 0 || zoneWorkshops.length > 0) {
        setPopupExtra('zone', zone.id, buildItemsPopupHtml(zoneShows, zoneWorkshops))
      }
    }

    for (const marker of markers.value) {
      const markerShows = showsByMarker.value.get(marker.id) || []
      const markerWorkshops = workshopsByMarker.value.get(marker.id) || []
      if (markerShows.length > 0 || markerWorkshops.length > 0) {
        setPopupExtra('marker', marker.id, buildItemsPopupHtml(markerShows, markerWorkshops))
      }
    }
  },
  { immediate: true }
)

const handleFocusZone = (zone: EditionZone) => {
  focusOnZone(zone.id)
}

const handleFocusMarker = (marker: EditionMarker) => {
  focusOnMarker(marker.id)
}

const handleToggleVisibility = (item: {
  id: number
  type: 'zone' | 'marker'
  visible: boolean
}) => {
  if (item.type === 'zone') {
    if (item.visible) {
      showZone(item.id)
    } else {
      hideZone(item.id)
    }
  } else {
    if (item.visible) {
      showMarker(item.id)
    } else {
      hideMarker(item.id)
    }
  }
}
</script>
