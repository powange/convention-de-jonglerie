<script setup lang="ts">
import type { EditionMarker } from '~/composables/useEditionMarkers'
import type { EditionZone } from '~/composables/useEditionZones'

import { getZoneTypeColor, getZoneTypeIcon } from '~~/shared/utils/zone-types'

// Type unifié pour la légende
interface LegendItem {
  id: number
  name: string
  description: string | null
  types: string[]
  color?: string // Seulement pour les zones
  itemType: 'zone' | 'marker'
  navigationUrl: string | null
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

// Liste plate triée par ordre alphabétique
const sortedItems = computed<LegendItem[]>(() => {
  const items: LegendItem[] = []

  props.zones.forEach((zone) => {
    let navigationUrl: string | null = null
    if (zone.coordinates.length > 0) {
      const lat = zone.coordinates.reduce((sum, c) => sum + c[0], 0) / zone.coordinates.length
      const lng = zone.coordinates.reduce((sum, c) => sum + c[1], 0) / zone.coordinates.length
      navigationUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    }
    items.push({
      id: zone.id,
      name: zone.name,
      description: zone.description,
      types: zone.zoneTypes,
      color: zone.color,
      itemType: 'zone',
      navigationUrl,
    })
  })

  props.markers.forEach((marker) => {
    items.push({
      id: marker.id,
      name: marker.name,
      description: marker.description,
      types: marker.markerTypes,
      color: marker.color || undefined,
      itemType: 'marker',
      navigationUrl: `https://www.google.com/maps/search/?api=1&query=${marker.latitude},${marker.longitude}`,
    })
  })

  return items.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
})

// Filtres par type
const activeFilters = ref<Set<string>>(new Set())

const availableTypes = computed(() => {
  const typeSet = new Set<string>()
  for (const item of sortedItems.value) {
    for (const type of item.types) {
      typeSet.add(type)
    }
  }
  return Array.from(typeSet).sort((a, b) => getTypeLabel(a).localeCompare(getTypeLabel(b), 'fr'))
})

// État de visibilité précédent par filtre (pour n'émettre que les changements)
const previousFilterVisibility = new Map<string, boolean>()

const toggleFilter = (type: string) => {
  const next = new Set(activeFilters.value)
  if (next.has(type)) {
    next.delete(type)
  } else {
    next.add(type)
  }
  activeFilters.value = next
}

const filteredItems = computed(() => {
  if (activeFilters.value.size === 0) return sortedItems.value
  return sortedItems.value.filter((item) => item.types.some((t) => activeFilters.value.has(t)))
})

// Synchroniser la visibilité sur la carte quand les filtres changent
// N'émettre que pour les items dont l'état a réellement changé
watch(activeFilters, () => {
  const filteredSet =
    activeFilters.value.size === 0
      ? null
      : new Set(filteredItems.value.map((i) => `${i.itemType}-${i.id}`))

  for (const item of sortedItems.value) {
    const key = `${item.itemType}-${item.id}`
    const visible = filteredSet === null || filteredSet.has(key)
    if (previousFilterVisibility.get(key) !== visible) {
      previousFilterVisibility.set(key, visible)
      emit('toggle-visibility', { id: item.id, type: item.itemType, visible })
    }
  }
})

const hasItems = computed(() => sortedItems.value.length > 0)

const getTypeLabel = (type: string) => {
  const typeKey = type.toLowerCase()
  return t(`gestion.map.types.${typeKey}`)
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
    <div v-if="!hasItems" class="py-4 text-center text-gray-500 dark:text-gray-400">
      {{ t('gestion.map.no_items') }}
    </div>

    <!-- Filtres par type -->
    <div v-if="availableTypes.length > 1" class="flex flex-wrap gap-x-3 gap-y-1 pb-2">
      <UCheckbox
        v-for="type in availableTypes"
        :key="type"
        :model-value="activeFilters.has(type)"
        :icon="getZoneTypeIcon(type)"
        :label="getTypeLabel(type)"
        size="md"
        @update:model-value="toggleFilter(type)"
      />
    </div>

    <div
      v-for="item in filteredItems"
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
          :name="getZoneTypeIcon(item.types[0] || 'OTHER')"
          class="h-4 w-4 shrink-0"
          :style="{ color: item.color || getZoneTypeColor(item.types[0] || 'OTHER') }"
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
        <div v-if="item.types.length > 0" class="mt-0.5 flex flex-wrap items-center gap-1">
          <span
            v-for="type in item.types"
            :key="type"
            class="inline-flex items-center gap-0.5 text-xs"
            :style="{ color: getZoneTypeColor(type) }"
          >
            <UIcon :name="getZoneTypeIcon(type)" class="h-3 w-3" />
            {{ getTypeLabel(type) }}
          </span>
        </div>
      </div>

      <!-- Actions (mode lecture) -->
      <div v-if="!editable" class="flex shrink-0 gap-1" @click.stop>
        <UButton
          v-if="item.navigationUrl"
          icon="i-lucide-navigation"
          size="xs"
          color="neutral"
          variant="ghost"
          :aria-label="t('gestion.map.open_in_maps')"
          :to="item.navigationUrl"
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
          :icon="isVisible(item) ? 'i-lucide-eye' : 'i-lucide-eye-off'"
          size="xs"
          color="neutral"
          variant="ghost"
          :aria-label="isVisible(item) ? t('gestion.map.hide_item') : t('gestion.map.show_item')"
          @click="toggleVisibility(item)"
        />
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
