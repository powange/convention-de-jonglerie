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
          <UInput
            v-model.number="formData.quantityReserved"
            type="number"
            :min="1"
            :max="itemQuantity"
            class="w-full"
          />
          <template #help>
            <span class="text-xs text-gray-500">
              {{ $t('gestion.stock.quantity_max', { max: itemQuantity }) }}
            </span>
          </template>
        </UFormField>

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
type StockReservationStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED'

interface StockReservationItem {
  id: number
  startsAt: string
  endsAt: string
  usage: string
  quantityReserved: number
  status: StockReservationStatus
}

const props = defineProps<{
  open: boolean
  editionId: number
  itemId: number
  itemQuantity: number
  reservation: StockReservationItem | null
  canModerate: boolean
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

const formData = reactive({
  startsAt: '',
  endsAt: '',
  usage: '',
  quantityReserved: 1,
  status: 'RESERVED' as StockReservationStatus,
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
      } else {
        const start = getDefaultStart()
        const end = new Date(start.getTime() + 3600_000)
        formData.startsAt = toLocalInput(start.toISOString())
        formData.endsAt = toLocalInput(end.toISOString())
        formData.usage = ''
        formData.quantityReserved = 1
        formData.status = 'RESERVED'
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
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      startsAt: new Date(formData.startsAt).toISOString(),
      endsAt: new Date(formData.endsAt).toISOString(),
      usage: formData.usage.trim(),
      quantityReserved: formData.quantityReserved,
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
