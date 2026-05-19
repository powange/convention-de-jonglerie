<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('gestion.stock.locations')"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <form class="space-y-3" @submit.prevent="handleSubmit">
        <p class="text-xs text-gray-500">{{ $t('gestion.stock.locations_help') }}</p>

        <div class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
          <UIcon name="i-heroicons-cube" class="size-4" />
          <span>
            {{ $t('gestion.stock.item_quantity') }} :
            <strong class="text-gray-900 dark:text-gray-100">{{ item?.quantity ?? 0 }}</strong>
          </span>
        </div>

        <div
          v-if="!formLocations.length"
          class="text-xs text-gray-500 italic border border-dashed border-gray-300 dark:border-gray-700 rounded-md p-3 text-center"
        >
          {{ $t('gestion.stock.no_locations_yet') }}
        </div>

        <div
          v-for="(loc, idx) in formLocations"
          :key="idx"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2"
        >
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <UFormField
              :label="$t('gestion.stock.item_location')"
              :class="siteMapEnabled ? 'sm:col-span-5' : 'sm:col-span-9'"
              :error="locationErrors[idx]"
            >
              <UInput
                v-model="loc.location"
                :placeholder="$t('gestion.stock.item_location_placeholder')"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="siteMapEnabled"
              :label="$t('gestion.stock.item_map_pin')"
              class="sm:col-span-4"
            >
              <USelect
                v-model="loc.mapPin"
                :items="mapPinItems"
                :placeholder="$t('gestion.stock.no_map_pin')"
                class="w-full"
              >
                <template #leading>
                  <UIcon
                    v-if="getPinMeta(loc.mapPin)?.icon"
                    :name="getPinMeta(loc.mapPin)!.icon"
                    :style="
                      getPinMeta(loc.mapPin)?.color
                        ? { color: getPinMeta(loc.mapPin)!.color! }
                        : undefined
                    "
                    class="size-5"
                  />
                </template>
                <template #item-leading="{ item: opt }">
                  <UIcon
                    :name="(opt as { icon: string }).icon"
                    :style="
                      (opt as { color: string | null }).color
                        ? { color: (opt as { color: string }).color }
                        : undefined
                    "
                    class="size-5"
                  />
                </template>
              </USelect>
            </UFormField>
            <UFormField :label="$t('common.quantity')" class="sm:col-span-3">
              <UInputNumber v-model="loc.quantity" :min="1" :step="1" class="w-full" />
            </UFormField>
          </div>
          <div class="flex justify-end">
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-heroicons-trash"
              @click="removeLocation(idx)"
            >
              {{ $t('common.delete') }}
            </UButton>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <p v-if="locationsSummary" class="text-xs" :class="locationsSummary.class">
            {{ locationsSummary.text }}
          </p>
          <span v-else />
          <UButton
            size="xs"
            variant="soft"
            color="primary"
            icon="i-heroicons-plus"
            @click="addLocation"
          >
            {{ $t('gestion.stock.add_location') }}
          </UButton>
        </div>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton color="primary" :loading="saving" @click="handleSubmit">
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { getZoneTypeColor, getZoneTypeIcon } from '~~/shared/utils/zone-types'

interface StockItemLocationLite {
  id?: number
  location: string | null
  quantity: number
  zone?: { id: number; name?: string; color?: string } | null
  marker?: { id: number; name?: string } | null
}
interface StockItemLite {
  id: number
  quantity: number
  locations?: StockItemLocationLite[]
}

const props = defineProps<{
  open: boolean
  editionId: number
  item: StockItemLite | null
  zones: { id: number; name: string; color: string; types?: string[] }[]
  markers: { id: number; name: string; color?: string | null; types?: string[] }[]
  /** Si la fonctionnalité « Carte du site » est activée. */
  siteMapEnabled?: boolean
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
}>()

const { t } = useI18n()
const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const NONE_PIN = 'none'
const mapPinItems = computed(() => [
  { label: t('gestion.stock.no_map_pin'), value: NONE_PIN, icon: 'i-lucide-minus', color: null },
  ...props.zones.map((z) => ({
    label: z.name,
    value: `zone:${z.id}`,
    icon: getZoneTypeIcon(z.types?.[0] || 'OTHER'),
    color: z.color as string | null,
  })),
  ...props.markers.map((m) => ({
    label: m.name,
    value: `marker:${m.id}`,
    icon: getZoneTypeIcon(m.types?.[0] || 'OTHER'),
    color: (m.color || getZoneTypeColor(m.types?.[0] || 'OTHER')) as string | null,
  })),
])

function getPinMeta(pin: string) {
  return mapPinItems.value.find((i) => i.value === pin) || null
}

function pinFromLocation(loc: StockItemLocationLite): string {
  if (loc.zone?.id) return `zone:${loc.zone.id}`
  if (loc.marker?.id) return `marker:${loc.marker.id}`
  return NONE_PIN
}

function pinToZoneAndMarker(pin: string): { zoneId: number | null; markerId: number | null } {
  if (pin.startsWith('zone:')) return { zoneId: parseInt(pin.slice(5)), markerId: null }
  if (pin.startsWith('marker:')) return { zoneId: null, markerId: parseInt(pin.slice(7)) }
  return { zoneId: null, markerId: null }
}

interface LocationForm {
  location: string
  mapPin: string
  quantity: number
}

const formLocations = ref<LocationForm[]>([])
const locationErrors = ref<Record<number, string>>({})
const saving = ref(false)

function addLocation() {
  formLocations.value.push({ location: '', mapPin: NONE_PIN, quantity: 1 })
}

function removeLocation(idx: number) {
  formLocations.value.splice(idx, 1)
  const next: Record<number, string> = {}
  for (const [key, val] of Object.entries(locationErrors.value)) {
    const k = Number(key)
    if (k < idx) next[k] = val
    else if (k > idx) next[k - 1] = val
  }
  locationErrors.value = next
}

const totalLocated = computed(() =>
  formLocations.value.reduce((sum, l) => sum + (l.quantity || 0), 0)
)

const locationsSummary = computed(() => {
  if (!formLocations.value.length) return null
  const qty = props.item?.quantity ?? 0
  const diff = qty - totalLocated.value
  if (diff > 0) {
    return {
      text: t('gestion.stock.unlocated_units', { count: diff }, diff),
      class: 'text-gray-500',
    }
  }
  if (diff < 0) {
    return {
      text: t('gestion.stock.over_located_units', { count: -diff }, -diff),
      class: 'text-error-600 dark:text-error-400',
    }
  }
  return { text: t('gestion.stock.all_located'), class: 'text-success-600 dark:text-success-400' }
})

watch(
  () => [props.open, props.item],
  ([open]) => {
    if (open) {
      formLocations.value = (props.item?.locations || []).map((l) => ({
        location: l.location || '',
        mapPin: pinFromLocation(l),
        quantity: l.quantity ?? 1,
      }))
      locationErrors.value = {}
    }
  },
  { immediate: true }
)

function applyApiErrors(e: any): boolean {
  const errors = e?.data?.data?.errors || e?.data?.errors
  if (!errors || typeof errors !== 'object') return false
  const nextLoc: Record<number, string> = {}
  for (const [path, message] of Object.entries(errors as Record<string, string>)) {
    const locMatch = path.match(/^locations\.(\d+)\./)
    if (locMatch) {
      const idx = Number(locMatch[1])
      if (!nextLoc[idx]) nextLoc[idx] = message
    }
  }
  locationErrors.value = nextLoc
  return Object.keys(nextLoc).length > 0
}

async function handleSubmit() {
  if (!props.item) return
  locationErrors.value = {}
  // Validation par emplacement : au moins texte OU pin
  const locErrs: Record<number, string> = {}
  for (let i = 0; i < formLocations.value.length; i++) {
    const loc = formLocations.value[i]
    const { zoneId, markerId } = pinToZoneAndMarker(loc.mapPin)
    if (!loc.location.trim() && !zoneId && !markerId) {
      locErrs[i] = t('gestion.stock.location_or_pin_required')
    }
  }
  if (Object.keys(locErrs).length > 0) {
    locationErrors.value = locErrs
    return
  }
  if (totalLocated.value > (props.item.quantity ?? 0)) {
    useToast().add({
      title: t('gestion.stock.over_located_error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }
  saving.value = true
  try {
    const body = {
      locations: formLocations.value.map((loc) => {
        const { zoneId, markerId } = pinToZoneAndMarker(loc.mapPin)
        return {
          location: loc.location.trim() || null,
          zoneId,
          markerId,
          quantity: loc.quantity,
        }
      }),
    }
    await $fetch(`/api/editions/${props.editionId}/stock-items/${props.item.id}`, {
      method: 'PUT',
      body,
    })
    useToast().add({ title: t('common.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    emit('saved')
    isOpen.value = false
  } catch (e: any) {
    const hasFieldErrors = applyApiErrors(e)
    useToast().add({
      title: hasFieldErrors
        ? e?.data?.data?.message || e?.data?.message || t('errors.validation_error')
        : e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
