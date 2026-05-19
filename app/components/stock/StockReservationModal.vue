<template>
  <UModal
    v-model:open="isOpen"
    :title="
      reservation ? $t('gestion.stock.edit_reservation') : $t('gestion.stock.new_reservation')
    "
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <UFormField :label="$t('gestion.stock.usage')" required :error="fieldErrors.usage">
          <UTextarea
            v-model="formData.usage"
            :placeholder="$t('gestion.stock.usage_placeholder')"
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="$t('gestion.stock.starts_at')" required :error="fieldErrors.startsAt">
            <UInput v-model="formData.startsAt" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField :label="$t('gestion.stock.ends_at')" required :error="fieldErrors.endsAt">
            <UInput v-model="formData.endsAt" type="datetime-local" class="w-full" />
          </UFormField>
        </div>

        <UFormField
          :label="$t('gestion.stock.quantity_reserved')"
          required
          :error="fieldErrors.quantityReserved"
        >
          <UInputNumber
            v-model="formData.quantityReserved"
            :min="1"
            :max="itemQuantity"
            :step="1"
            class="w-full"
          />
          <template #help>
            <span class="text-xs text-gray-500">
              {{ $t('gestion.stock.quantity_max', { max: itemQuantity }) }}
            </span>
          </template>
        </UFormField>

        <!-- Emplacement d'utilisation : où le matériel doit être amené -->
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

        <UFormField
          v-if="reservation && canModerate"
          :label="$t('gestion.stock.status_label')"
          :error="fieldErrors.status"
        >
          <USelect v-model="formData.status" :items="statusItems" class="w-full" />
        </UFormField>
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

type StockReservationStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED'

interface StockReservationItem {
  id: number
  startsAt: string
  endsAt: string
  usage: string
  quantityReserved: number
  status: StockReservationStatus
  location?: string | null
  zone?: { id: number; name: string; color: string } | null
  marker?: { id: number; name: string } | null
}

const props = defineProps<{
  open: boolean
  editionId: number
  itemId: number
  itemQuantity: number
  reservation: StockReservationItem | null
  canModerate: boolean
  /** Zones de la carte d'édition (pour le sélecteur). */
  zones?: { id: number; name: string; color: string; types?: string[] }[]
  /** Marqueurs de la carte d'édition (pour le sélecteur). */
  markers?: { id: number; name: string; color?: string | null; types?: string[] }[]
  /** Si la fonctionnalité « Carte du site » est activée. */
  siteMapEnabled?: boolean
  /** Date de début de l'édition (ISO) — utilisée pour le pré-remplissage */
  editionStartDate?: string | null
  /** Date de début du montage bénévoles (ISO, optionnelle) — prioritaire sur editionStartDate */
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

const statusItems = computed(() =>
  (['RESERVED', 'PICKED_UP', 'RETURNED', 'CANCELLED'] as StockReservationStatus[]).map((s) => ({
    label: t(`gestion.stock.status.${s}`),
    value: s,
  }))
)

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

function pinFromReservation(r: StockReservationItem | null): string {
  if (r?.zone?.id) return `zone:${r.zone.id}`
  if (r?.marker?.id) return `marker:${r.marker.id}`
  return NONE_PIN
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
  quantityReserved: 1,
  status: 'RESERVED' as StockReservationStatus,
  location: '',
  mapPin: NONE_PIN,
})
const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)

function resetFieldErrors() {
  fieldErrors.value = {}
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

/**
 * Calcule la date de début à pré-remplir pour une nouvelle réservation :
 * - priorité 1 : `volunteersSetupStartDate` si renseignée et future (minuit)
 * - priorité 2 : `startDate` de l'édition si future (minuit)
 * - sinon : `now`
 *
 * Évite de proposer une date passée si l'édition est dans plusieurs mois.
 */
function getDefaultStart(): Date {
  const now = new Date()
  const candidates = [props.editionSetupStartDate, props.editionStartDate]
  for (const iso of candidates) {
    if (!iso) continue
    const d = new Date(iso)
    if (isNaN(d.getTime())) continue
    // Si la date est dans le futur (≥ aujourd'hui), on l'utilise à minuit
    if (d.getTime() >= now.getTime()) {
      d.setHours(0, 0, 0, 0)
      return d
    }
  }
  return now
}

watch(
  () => [props.open, props.reservation],
  ([open]) => {
    if (open) {
      if (props.reservation) {
        formData.startsAt = toLocalInput(props.reservation.startsAt)
        formData.endsAt = toLocalInput(props.reservation.endsAt)
        formData.usage = props.reservation.usage
        formData.quantityReserved = props.reservation.quantityReserved
        formData.status = props.reservation.status
        formData.location = props.reservation.location || ''
        formData.mapPin = pinFromReservation(props.reservation)
      } else {
        const start = getDefaultStart()
        const end = new Date(start.getTime() + 3600_000)
        formData.startsAt = toLocalInput(start.toISOString())
        formData.endsAt = toLocalInput(end.toISOString())
        formData.usage = ''
        formData.quantityReserved = 1
        formData.status = 'RESERVED'
        formData.location = ''
        formData.mapPin = NONE_PIN
      }
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
  // Validation cross-champ : au moins texte OU pin
  const { zoneId, markerId } = pinToZoneAndMarker(formData.mapPin)
  if (!formData.location.trim() && !zoneId && !markerId) {
    fieldErrors.value = { location: t('gestion.stock.location_or_pin_required') }
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      startsAt: new Date(formData.startsAt).toISOString(),
      endsAt: new Date(formData.endsAt).toISOString(),
      usage: formData.usage.trim(),
      quantityReserved: formData.quantityReserved,
      location: formData.location.trim() || null,
      zoneId,
      markerId,
    }
    if (props.reservation) {
      if (props.canModerate) body.status = formData.status
      await $fetch(`/api/editions/${props.editionId}/stock-reservations/${props.reservation.id}`, {
        method: 'PUT',
        body,
      })
    } else {
      await $fetch(`/api/editions/${props.editionId}/stock-items/${props.itemId}/reservations`, {
        method: 'POST',
        body,
      })
    }
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
