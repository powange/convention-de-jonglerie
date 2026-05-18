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

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="$t('gestion.stock.item_quantity')" :error="fieldErrors.quantity">
            <UInputNumber v-model="formData.quantity" :min="1" :step="1" class="w-full" />
          </UFormField>
          <UFormField
            :label="$t('gestion.stock.item_location')"
            :required="!siteMapEnabled || !formData.mapPin"
            :error="fieldErrors.location"
            :help="siteMapEnabled ? $t('gestion.stock.item_location_help') : undefined"
          >
            <UInput
              v-model="formData.location"
              :placeholder="$t('gestion.stock.item_location_placeholder')"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          v-if="siteMapEnabled"
          :label="$t('gestion.stock.item_map_pin')"
          :error="fieldErrors.zoneId || fieldErrors.markerId"
          :help="$t('gestion.stock.item_map_pin_help')"
        >
          <USelect
            v-model="formData.mapPin"
            :items="mapPinItems"
            :placeholder="$t('gestion.stock.no_map_pin')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('gestion.stock.item_notes')" :error="fieldErrors.notes">
          <UTextarea
            v-model="formData.notes"
            :placeholder="$t('gestion.stock.item_notes_placeholder')"
            :rows="2"
            class="w-full"
          />
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
interface StockItemLite {
  id: number
  name: string
  description: string | null
  location: string
  quantity: number
  notes: string | null
  zone?: { id: number } | null
  marker?: { id: number } | null
}

const props = defineProps<{
  open: boolean
  editionId: number
  groupId: number
  item: StockItemLite | null
  zones: { id: number; name: string; color: string }[]
  markers: { id: number; name: string }[]
  /** Si la fonctionnalité « Carte du site » est activée sur l'édition.
   * Si false, le sélecteur zone/marqueur est masqué et la localisation
   * textuelle devient obligatoire. */
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

// Sélecteur unifié zone OU marqueur de la carte du site.
// La valeur du select est une string :
//   - '' = aucun
//   - 'zone:<id>' = lien vers une EditionZone
//   - 'marker:<id>' = lien vers un EditionMarker
// Au submit, on dérive zoneId / markerId à envoyer au serveur.
const NONE_PIN = ''
const mapPinItems = computed(() => [
  { label: t('gestion.stock.no_map_pin'), value: NONE_PIN },
  ...props.zones.map((z) => ({
    label: `${t('gestion.stock.pin_zone_label')} : ${z.name}`,
    value: `zone:${z.id}`,
  })),
  ...props.markers.map((m) => ({
    label: `${t('gestion.stock.pin_marker_label')} : ${m.name}`,
    value: `marker:${m.id}`,
  })),
])

function pinFromItem(item: StockItemLite | null): string {
  if (item?.zone?.id) return `zone:${item.zone.id}`
  if (item?.marker?.id) return `marker:${item.marker.id}`
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
  location: '',
  mapPin: NONE_PIN,
  quantity: 1,
  notes: '',
})
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
      formData.location = props.item?.location || ''
      formData.mapPin = pinFromItem(props.item)
      formData.quantity = props.item?.quantity ?? 1
      formData.notes = props.item?.notes || ''
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
  // Validation cross-champ : location texte OU épingle carte est obligatoire
  const { zoneId, markerId } = pinToZoneAndMarker(formData.mapPin)
  if (!formData.location.trim() && !zoneId && !markerId) {
    fieldErrors.value = { location: t('gestion.stock.location_or_pin_required') }
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      location: formData.location.trim(),
      zoneId,
      markerId,
      quantity: formData.quantity,
      notes: formData.notes.trim() || null,
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
