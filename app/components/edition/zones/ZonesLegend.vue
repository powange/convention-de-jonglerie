<script setup lang="ts">
import type { EditionMarker } from '~/composables/useEditionMarkers'
import type { EditionZone } from '~/composables/useEditionZones'

// getZoneTypeColor et getZoneTypeIcon sont auto-importés depuis shared/utils/zone-types.ts

// Type unifié pour la légende
interface LegendItem {
  id: number
  name: string
  description: string | null
  type: string // zoneType ou markerType
  color?: string // Seulement pour les zones
  itemType: 'zone' | 'marker'
  order: number
}

interface Props {
  zones: readonly EditionZone[]
  markers?: readonly EditionMarker[]
  editable?: boolean
  loading?: boolean
}

interface Emits {
  (e: 'edit' | 'delete' | 'focus', zone: EditionZone): void
  (e: 'edit-marker' | 'delete-marker' | 'focus-marker', marker: EditionMarker): void
  (e: 'toggle-visibility', item: { id: number; type: 'zone' | 'marker'; visible: boolean }): void
}

const props = withDefaults(defineProps<Props>(), {
  editable: false,
  loading: false,
  markers: () => [],
})
const emit = defineEmits<Emits>()
const { t } = useI18n()

// État de visibilité local (clé = "zone-id" ou "marker-id")
const visibilityState = ref<Map<string, boolean>>(new Map())

const getVisibilityKey = (itemType: 'zone' | 'marker', id: number) => `${itemType}-${id}`

const isVisible = (item: LegendItem) => {
  const key = getVisibilityKey(item.itemType, item.id)
  // Par défaut visible si pas dans le state
  return visibilityState.value.get(key) !== false
}

const toggleVisibility = (item: LegendItem) => {
  const key = getVisibilityKey(item.itemType, item.id)
  const currentVisible = visibilityState.value.get(key) !== false
  const newVisible = !currentVisible
  visibilityState.value.set(key, newVisible)
  emit('toggle-visibility', { id: item.id, type: item.itemType, visible: newVisible })
}

// Grouper zones et markers par type
interface LegendGroup {
  type: string
  items: LegendItem[]
}

const legendGroups = computed<LegendGroup[]>(() => {
  const items: LegendItem[] = []

  props.zones.forEach((zone) => {
    items.push({
      id: zone.id,
      name: zone.name,
      description: zone.description,
      type: zone.zoneType,
      color: zone.color,
      itemType: 'zone',
      order: zone.order,
    })
  })

  props.markers.forEach((marker) => {
    items.push({
      id: marker.id,
      name: marker.name,
      description: marker.description,
      type: marker.markerType,
      itemType: 'marker',
      order: marker.order,
    })
  })

  // Grouper par type
  const groupMap = new Map<string, LegendItem[]>()
  for (const item of items) {
    const group = groupMap.get(item.type)
    if (group) {
      group.push(item)
    } else {
      groupMap.set(item.type, [item])
    }
  }

  // Trier les items dans chaque groupe par ordre
  // Trier les groupes par le plus petit ordre de leurs items
  return Array.from(groupMap.entries())
    .map(([type, groupItems]) => ({
      type,
      items: groupItems.sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.items[0].order - b.items[0].order)
})

const hasItems = computed(() => legendGroups.value.length > 0)

const getTypeLabel = (type: string) => {
  const typeKey = type.toLowerCase()
  return t(`gestion.map.types.${typeKey}`)
}

const getMarkerIcon = (type: string) => {
  return getZoneTypeIcon(type)
}

const getMarkerColor = (type: string) => {
  return getZoneTypeColor(type)
}

const handleFocus = (item: LegendItem) => {
  if (item.itemType === 'zone') {
    const zone = props.zones.find((z) => z.id === item.id)
    if (zone) emit('focus', zone)
  } else {
    const marker = props.markers.find((m) => m.id === item.id)
    if (marker) emit('focus-marker', marker)
  }
}

const handleEdit = (item: LegendItem) => {
  if (item.itemType === 'zone') {
    const zone = props.zones.find((z) => z.id === item.id)
    if (zone) emit('edit', zone)
  } else {
    const marker = props.markers.find((m) => m.id === item.id)
    if (marker) emit('edit-marker', marker)
  }
}

const handleDelete = (item: LegendItem) => {
  if (item.itemType === 'zone') {
    const zone = props.zones.find((z) => z.id === item.id)
    if (zone) emit('delete', zone)
  } else {
    const marker = props.markers.find((m) => m.id === item.id)
    if (marker) emit('delete-marker', marker)
  }
}

// Obtenir les coordonnées GPS d'un élément (centroïde pour les zones, position pour les markers)
const getItemCoordinates = (item: LegendItem): [number, number] | null => {
  if (item.itemType === 'marker') {
    const marker = props.markers.find((m) => m.id === item.id)
    if (marker) return [marker.latitude, marker.longitude]
  } else {
    const zone = props.zones.find((z) => z.id === item.id)
    if (zone && zone.coordinates.length > 0) {
      // Calcul du centroïde du polygone
      const lat = zone.coordinates.reduce((sum, c) => sum + c[0], 0) / zone.coordinates.length
      const lng = zone.coordinates.reduce((sum, c) => sum + c[1], 0) / zone.coordinates.length
      return [lat, lng]
    }
  }
  return null
}

const getNavigationUrl = (item: LegendItem): string | null => {
  const coords = getItemCoordinates(item)
  if (!coords) return null
  return `https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="!hasItems" class="py-4 text-center text-gray-500 dark:text-gray-400">
      {{ t('gestion.map.no_items') }}
    </div>

    <!-- Groupes par type -->
    <div v-for="group in legendGroups" :key="group.type" class="flex flex-col gap-1">
      <!-- En-tête du groupe -->
      <div class="flex items-center gap-2 pb-1">
        <UIcon
          :name="getMarkerIcon(group.type)"
          class="h-4 w-4 shrink-0"
          :style="{ color: getMarkerColor(group.type) }"
        />
        <span
          class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        >
          {{ getTypeLabel(group.type) }}
        </span>
        <UBadge size="xs" color="neutral" variant="subtle">{{ group.items.length }}</UBadge>
      </div>

      <!-- Items du groupe -->
      <div
        v-for="item in group.items"
        :key="`${item.itemType}-${item.id}`"
        class="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        @click="handleFocus(item)"
      >
        <!-- Indicateur visuel : pastille pour zone, icône pour marker -->
        <template v-if="item.itemType === 'zone'">
          <div
            class="h-4 w-4 shrink-0 rounded-full border border-gray-300 dark:border-gray-600"
            :style="{ backgroundColor: item.color }"
          />
        </template>
        <template v-else>
          <UIcon
            :name="getMarkerIcon(item.type)"
            class="h-4 w-4 shrink-0"
            :style="{ color: getMarkerColor(item.type) }"
          />
        </template>

        <!-- Infos -->
        <div class="min-w-0 flex-1">
          <p
            class="truncate text-sm font-medium"
            :class="{ 'text-gray-400 dark:text-gray-500': !isVisible(item) }"
          >
            {{ item.name }}
          </p>
        </div>

        <!-- Actions (mode lecture) -->
        <div v-if="!editable" class="flex shrink-0 gap-1" @click.stop>
          <UButton
            v-if="getNavigationUrl(item)"
            icon="i-lucide-navigation"
            size="xs"
            color="neutral"
            variant="ghost"
            :aria-label="t('gestion.map.open_in_maps')"
            :to="getNavigationUrl(item)!"
            target="_blank"
          />
          <UButton
            :icon="isVisible(item) ? 'i-lucide-eye' : 'i-lucide-eye-off'"
            size="xs"
            color="neutral"
            variant="ghost"
            :aria-label="isVisible(item) ? t('gestion.map.hide_item') : t('gestion.map.show_item')"
            @click="toggleVisibility(item)"
          />
        </div>

        <!-- Actions (mode édition) -->
        <div v-if="editable" class="flex shrink-0 gap-1" @click.stop>
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            :aria-label="
              item.itemType === 'zone' ? t('gestion.map.edit_zone') : t('gestion.map.edit_marker')
            "
            @click="handleEdit(item)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            :aria-label="
              item.itemType === 'zone'
                ? t('gestion.map.delete_zone')
                : t('gestion.map.delete_marker')
            "
            :loading="loading"
            @click="handleDelete(item)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
