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

// Combiner et trier zones et markers par ordre
const legendItems = computed<LegendItem[]>(() => {
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

  // Trier par ordre (zones et markers mélangés)
  return items.sort((a, b) => a.order - b.order)
})

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
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="legendItems.length === 0" class="py-4 text-center text-gray-500 dark:text-gray-400">
      {{ t('gestion.map.no_items') }}
    </div>

    <div
      v-for="item in legendItems"
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
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ getTypeLabel(item.type) }}
        </p>
      </div>

      <!-- Bouton visibilité (mode lecture) -->
      <div v-if="!editable" class="flex shrink-0" @click.stop>
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
            item.itemType === 'zone' ? t('gestion.map.delete_zone') : t('gestion.map.delete_marker')
          "
          :loading="loading"
          @click="handleDelete(item)"
        />
      </div>
    </div>
  </div>
</template>
