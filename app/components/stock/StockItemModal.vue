<template>
  <UModal
    v-model:open="isOpen"
    :title="item ? $t('gestion.stock.edit_item') : $t('gestion.stock.new_item')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <UFormField :label="$t('gestion.stock.item_name')" required :error="fieldErrors.name">
          <UInput
            v-model="formData.name"
            :placeholder="$t('gestion.stock.item_name_placeholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('gestion.stock.item_description')" :error="fieldErrors.description">
          <UTextarea
            v-model="formData.description"
            :placeholder="$t('gestion.stock.item_description_placeholder')"
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('gestion.stock.item_quantity')" :error="fieldErrors.quantity">
          <div class="flex flex-wrap items-center gap-1">
            <UButton
              v-for="n in 10"
              :key="n"
              :variant="formData.quantity === n ? 'solid' : 'soft'"
              :color="formData.quantity === n ? 'primary' : 'neutral'"
              size="sm"
              :ui="{ base: 'min-w-9 justify-center' }"
              @click="formData.quantity = n"
            >
              {{ n }}
            </UButton>
            <UInputNumber
              v-model="formData.quantity"
              :min="1"
              :step="1"
              class="w-28 ml-1"
              :ui="{ base: 'text-center' }"
            />
          </div>
        </UFormField>

        <UFormField :label="$t('gestion.stock.item_notes')" :error="fieldErrors.notes">
          <UTextarea
            v-model="formData.notes"
            :placeholder="$t('gestion.stock.item_notes_placeholder')"
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <!-- Emplacement de rangement (par défaut, hors réservation) -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
          <div class="flex items-center gap-2 text-sm font-medium">
            <UIcon name="i-heroicons-map-pin" class="size-4 text-primary-500" />
            <span>{{ $t('gestion.stock.item_storage_location') }}</span>
          </div>
          <p class="text-xs text-gray-500">
            {{ $t('gestion.stock.item_storage_location_help') }}
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <UFormField
              :label="$t('gestion.stock.item_location')"
              :class="siteMapEnabled ? 'sm:col-span-7' : 'sm:col-span-12'"
              :error="fieldErrors.location"
            >
              <UInput
                v-model="formData.location"
                :placeholder="$t('gestion.stock.item_storage_location_placeholder')"
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

        <!-- Bloc Emprunt externe -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
          <USwitch
            v-model="formData.isExternalLoan"
            :label="$t('gestion.stock.external_loan')"
            :description="$t('gestion.stock.external_loan_help')"
          />

          <div v-if="formData.isExternalLoan" class="space-y-3 pt-1">
            <UFormField :label="$t('gestion.stock.owner_contact')">
              <UTextarea
                v-model="formData.ownerContact"
                :placeholder="$t('gestion.stock.owner_contact_placeholder')"
                :rows="2"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="$t('gestion.stock.return_due_at')">
              <UInput v-model="formData.returnDueAt" type="date" class="w-full" />
            </UFormField>
          </div>
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

interface StockItemLite {
  id: number
  name: string
  description: string | null
  quantity: number
  notes: string | null
  isExternalLoan?: boolean
  ownerContact?: string | null
  returnDueAt?: string | null
  location?: string | null
  zone?: { id: number; name: string; color: string } | null
  marker?: { id: number; name: string } | null
}

const props = defineProps<{
  open: boolean
  editionId: number
  groupId: number
  item: StockItemLite | null
  /** Zones de la carte d'édition (pour le sélecteur d'emplacement). */
  zones?: { id: number; name: string; color: string; types?: string[] }[]
  /** Marqueurs de la carte d'édition (pour le sélecteur d'emplacement). */
  markers?: { id: number; name: string; color?: string | null; types?: string[] }[]
  /** Si la fonctionnalité « Carte du site » est activée sur l'édition. */
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

function pinFromItem(it: StockItemLite | null): string {
  if (it?.zone?.id) return `zone:${it.zone.id}`
  if (it?.marker?.id) return `marker:${it.marker.id}`
  return NONE_PIN
}

function pinToZoneAndMarker(pin: string): { zoneId: number | null; markerId: number | null } {
  if (pin.startsWith('zone:')) return { zoneId: parseInt(pin.slice(5)), markerId: null }
  if (pin.startsWith('marker:')) return { zoneId: null, markerId: parseInt(pin.slice(7)) }
  return { zoneId: null, markerId: null }
}

const formData = reactive({
  name: '',
  description: '',
  quantity: 1,
  notes: '',
  isExternalLoan: false,
  ownerContact: '',
  returnDueAt: '',
  location: '',
  mapPin: NONE_PIN,
})

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toISOString().split('T')[0]
  } catch {
    return ''
  }
}
const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)

function resetFieldErrors() {
  fieldErrors.value = {}
}

watch(
  () => [props.open, props.item],
  ([open]) => {
    if (open) {
      formData.name = props.item?.name || ''
      formData.description = props.item?.description || ''
      formData.quantity = props.item?.quantity ?? 1
      formData.notes = props.item?.notes || ''
      formData.isExternalLoan = props.item?.isExternalLoan ?? false
      formData.ownerContact = props.item?.ownerContact || ''
      formData.returnDueAt = toDateInput(props.item?.returnDueAt)
      formData.location = props.item?.location || ''
      formData.mapPin = pinFromItem(props.item)
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
  if (!formData.name.trim()) {
    fieldErrors.value = { name: t('errors.required_field') }
    return
  }
  if (!formData.quantity || formData.quantity < 1) {
    fieldErrors.value = { quantity: t('errors.required_field') }
    return
  }
  saving.value = true
  try {
    const { zoneId, markerId } = pinToZoneAndMarker(formData.mapPin)
    const body: Record<string, unknown> = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      quantity: formData.quantity,
      notes: formData.notes.trim() || null,
      isExternalLoan: formData.isExternalLoan,
      ownerContact: formData.isExternalLoan ? formData.ownerContact.trim() || null : null,
      returnDueAt:
        formData.isExternalLoan && formData.returnDueAt
          ? new Date(formData.returnDueAt).toISOString()
          : null,
      location: formData.location.trim() || null,
      zoneId,
      markerId,
    }
    if (props.item) {
      await $fetch(`/api/editions/${props.editionId}/stock-items/${props.item.id}`, {
        method: 'PUT',
        body,
      })
    } else {
      await $fetch(`/api/editions/${props.editionId}/stock-groups/${props.groupId}/items`, {
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
