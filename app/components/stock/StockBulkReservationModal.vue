<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('gestion.stock.bulk_reservation_title')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Items sélectionnés avec quantité éditable -->
        <UFormField :label="$t('gestion.stock.bulk_items_label')">
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1">
            <p class="text-xs text-gray-500 mb-2">
              {{ $t('gestion.stock.bulk_items_help') }}
            </p>
            <ul class="text-sm space-y-2 max-h-60 overflow-y-auto">
              <li v-for="it in items" :key="it.id" class="flex items-center gap-3">
                <UIcon name="i-heroicons-cube" class="size-4 text-amber-600 shrink-0" />
                <span class="flex-1 min-w-0 truncate">{{ it.name }}</span>
                <span class="text-xs text-gray-500 whitespace-nowrap">
                  {{ $t('gestion.stock.quantity_max', { max: it.maxQuantity }) }}
                </span>
                <UInputNumber
                  :model-value="quantities[it.id] ?? 1"
                  :min="1"
                  :max="it.maxQuantity"
                  :step="1"
                  class="w-24"
                  :ui="{ base: 'text-center' }"
                  @update:model-value="setQuantity(it.id, $event)"
                />
              </li>
            </ul>
          </div>
        </UFormField>

        <!-- Période -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UFormField :label="$t('gestion.stock.starts_at')" required :error="fieldErrors.startsAt">
            <UInput v-model="formData.startsAt" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField :label="$t('gestion.stock.ends_at')" required :error="fieldErrors.endsAt">
            <UInput v-model="formData.endsAt" type="datetime-local" class="w-full" />
          </UFormField>
        </div>

        <!-- Usage -->
        <UFormField :label="$t('gestion.stock.usage')" required :error="fieldErrors.usage">
          <UTextarea
            v-model="formData.usage"
            :placeholder="$t('gestion.stock.usage_placeholder')"
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <!-- Emplacement d'utilisation -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
          <div class="flex items-center gap-2 text-sm font-medium">
            <UIcon name="i-heroicons-map-pin" class="size-4 text-primary-500" />
            <span>{{ $t('gestion.stock.reservation_location') }}</span>
            <span class="text-error-600 dark:text-error-400">*</span>
          </div>
          <p class="text-xs text-gray-500">
            {{ $t('gestion.stock.reservation_location_help') }}
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <UFormField
              :label="$t('gestion.stock.item_location')"
              :class="siteMapEnabled ? 'sm:col-span-7' : 'sm:col-span-12'"
              :error="fieldErrors.location"
            >
              <UInput
                v-model="formData.location"
                :placeholder="$t('gestion.stock.reservation_location_placeholder')"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="siteMapEnabled"
              :label="$t('gestion.stock.item_map_pin')"
              class="sm:col-span-5"
            >
              <USelect
                v-model="formData.mapPin"
                :items="mapPinItems"
                :placeholder="$t('gestion.stock.no_map_pin')"
                class="w-full"
              >
                <template #leading>
                  <UIcon
                    v-if="getPinMeta(formData.mapPin)?.icon"
                    :name="getPinMeta(formData.mapPin)!.icon"
                    :style="
                      getPinMeta(formData.mapPin)?.color
                        ? { color: getPinMeta(formData.mapPin)!.color! }
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
          </div>
        </div>

        <!-- Conflits de disponibilité -->
        <UAlert
          v-if="unavailableItems.length"
          color="error"
          variant="soft"
          icon="i-heroicons-exclamation-triangle"
          :title="$t('gestion.stock.bulk_unavailable_title')"
        >
          <template #description>
            <ul class="list-disc list-inside text-sm">
              <li v-for="u in unavailableItems" :key="u.id">
                {{ u.name }}
                <span v-if="u.requested !== undefined" class="text-xs">
                  ({{
                    $t('gestion.stock.bulk_unavailable_detail', {
                      requested: u.requested,
                      available: u.available,
                    })
                  }})
                </span>
              </li>
            </ul>
          </template>
        </UAlert>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton color="primary" :loading="saving" @click="handleSubmit">
          {{ $t('gestion.stock.bulk_submit', { count: items.length }) }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { getZoneTypeColor, getZoneTypeIcon } from '~~/shared/utils/zone-types'

interface BulkItem {
  id: number
  name: string
  /** Quantité totale de l'item — borne max du sélecteur de quantité. */
  maxQuantity: number
}

const props = defineProps<{
  open: boolean
  editionId: number
  items: BulkItem[]
  /** Zones de la carte d'édition (pour le sélecteur). */
  zones?: { id: number; name: string; color: string; types?: string[] }[]
  /** Marqueurs de la carte d'édition (pour le sélecteur). */
  markers?: { id: number; name: string; color?: string | null; types?: string[] }[]
  /** Si la fonctionnalité « Carte du site » est activée. */
  siteMapEnabled?: boolean
  /** Date de début de l'édition (ISO) — utilisée pour le pré-remplissage */
  editionStartDate?: string | null
  /** Date de début du montage bénévoles (ISO, optionnelle) */
  editionSetupStartDate?: string | null
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
  ...(props.zones || []).map((z) => ({
    label: z.name,
    value: `zone:${z.id}`,
    icon: getZoneTypeIcon(z.types?.[0] || 'OTHER'),
    color: z.color as string | null,
  })),
  ...(props.markers || []).map((m) => ({
    label: m.name,
    value: `marker:${m.id}`,
    icon: getZoneTypeIcon(m.types?.[0] || 'OTHER'),
    color: (m.color || getZoneTypeColor(m.types?.[0] || 'OTHER')) as string | null,
  })),
])

function getPinMeta(pin: string) {
  return mapPinItems.value.find((i) => i.value === pin) || null
}

function pinToZoneAndMarker(pin: string): { zoneId: number | null; markerId: number | null } {
  if (pin.startsWith('zone:')) return { zoneId: parseInt(pin.slice(5)), markerId: null }
  if (pin.startsWith('marker:')) return { zoneId: null, markerId: parseInt(pin.slice(7)) }
  return { zoneId: null, markerId: null }
}

const formData = reactive({
  startsAt: '',
  endsAt: '',
  usage: '',
  location: '',
  mapPin: NONE_PIN,
})
// Quantités demandées par item (clé = item.id). Initialisées à 1 à l'ouverture.
const quantities = reactive<Record<number, number>>({})

function setQuantity(itemId: number, value: number) {
  const max = props.items.find((i) => i.id === itemId)?.maxQuantity ?? 1
  const safe = Math.max(1, Math.min(max, Math.floor(value || 1)))
  quantities[itemId] = safe
}

const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)
const unavailableItems = ref<{ id: number; name: string; requested?: number; available: number }[]>(
  []
)

function resetFieldErrors() {
  fieldErrors.value = {}
  unavailableItems.value = []
}

function toLocalInput(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function getDefaultStart(): Date {
  const now = new Date()
  const candidates = [props.editionSetupStartDate, props.editionStartDate]
  for (const iso of candidates) {
    if (!iso) continue
    const d = new Date(iso)
    if (isNaN(d.getTime())) continue
    if (d.getTime() >= now.getTime()) {
      d.setHours(0, 0, 0, 0)
      return d
    }
  }
  return now
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      const start = getDefaultStart()
      const end = new Date(start.getTime() + 3600_000)
      formData.startsAt = toLocalInput(start.toISOString())
      formData.endsAt = toLocalInput(end.toISOString())
      formData.usage = ''
      formData.location = ''
      formData.mapPin = NONE_PIN
      // Quantité par défaut = 1 pour chaque item à l'ouverture.
      // (eslint-disable car on doit purger les clés dynamiques de l'objet réactif)
      for (const key of Object.keys(quantities)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete quantities[Number(key)]
      }
      for (const it of props.items) quantities[it.id] = 1
      resetFieldErrors()
    }
  },
  { immediate: true }
)

function applyApiErrors(e: any): boolean {
  const errors = e?.data?.data?.errors || e?.data?.errors
  if (!errors || typeof errors !== 'object') return false
  const next: Record<string, string> = {}
  for (const [path, message] of Object.entries(errors as Record<string, string>)) {
    const fieldName = path.split('.')[0]
    if (!next[fieldName]) next[fieldName] = message
  }
  fieldErrors.value = next
  return true
}

async function handleSubmit() {
  resetFieldErrors()
  if (!formData.usage.trim()) {
    fieldErrors.value = { usage: t('errors.required_field') }
    return
  }
  if (!formData.startsAt || !formData.endsAt) {
    fieldErrors.value = { startsAt: t('errors.required_field') }
    return
  }
  const { zoneId, markerId } = pinToZoneAndMarker(formData.mapPin)
  if (!formData.location.trim() && !zoneId && !markerId) {
    fieldErrors.value = { location: t('gestion.stock.location_or_pin_required') }
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/stock-reservations/bulk`, {
      method: 'POST',
      body: {
        items: props.items.map((i) => ({ id: i.id, quantity: quantities[i.id] ?? 1 })),
        startsAt: new Date(formData.startsAt).toISOString(),
        endsAt: new Date(formData.endsAt).toISOString(),
        usage: formData.usage.trim(),
        location: formData.location.trim() || null,
        zoneId,
        markerId,
      },
    })
    useToast().add({
      title: t('gestion.stock.bulk_success', { count: props.items.length }),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    emit('saved')
    isOpen.value = false
  } catch (e: any) {
    // Conflit de disponibilité partielle → on affiche les items en cause
    // dans une UAlert inline et on évite le toast doublon.
    const status = e?.status ?? e?.statusCode ?? e?.data?.statusCode
    if (status === 409) {
      const list = e?.data?.data?.unavailable || e?.data?.unavailable || []
      unavailableItems.value = Array.isArray(list) ? list : []
      return
    }
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
