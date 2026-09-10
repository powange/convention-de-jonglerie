<template>
  <UModal
    v-model:open="isOpen"
    :title="item ? $t('gestion.stock.edit_item') : $t('gestion.stock.new_item')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <!-- Deux onglets : ce qui décrit l'objet, et ce qui décrit son emprunt. Les champs
           de prêt n'ont d'objet que pour du matériel prêté, et les laisser dans le même
           défilement obligeait à les traverser à chaque modification ordinaire. -->
      <form @submit.prevent="handleSubmit">
        <UTabs v-model="ongletActif" :items="onglets">
          <template #general>
            <div class="space-y-4 pt-2">
              <UFormField :label="$t('gestion.stock.item_name')" required :error="fieldErrors.name">
                <UInput
                  v-model="formData.name"
                  :placeholder="$t('gestion.stock.item_name_placeholder')"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                :label="$t('gestion.stock.item_description')"
                :error="fieldErrors.description"
              >
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

              <!-- Comptage du rangement. Laissé vide tant qu'il n'a pas eu lieu : un zéro dirait que
                 tout a disparu, ce qui n'est pas la même chose que « pas encore compté ». -->
              <UFormField
                :label="$t('gestion.stock.final_quantity')"
                :description="$t('gestion.stock.final_quantity_help')"
                :error="fieldErrors.finalQuantity"
              >
                <div class="flex items-center gap-2">
                  <UInput
                    v-model="formData.finalQuantity"
                    type="number"
                    min="0"
                    class="w-28"
                    :placeholder="$t('gestion.stock.final_quantity_placeholder')"
                  />
                  <UBadge v-if="ecartQuantite > 0" color="warning" variant="soft">
                    {{ $t('gestion.stock.missing_count', { count: ecartQuantite }) }}
                  </UBadge>
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
            </div>
          </template>

          <template #emprunt>
            <div class="space-y-4 pt-2">
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
                    <UiDateField v-model="formData.returnDueAt" />
                  </UFormField>

                  <!-- Deux lieux distincts : on emprunte souvent chez quelqu'un et l'on rend ailleurs.
                     Le responsable est un utilisateur quand il en est un, du texte sinon. -->
                  <div class="space-y-3 pt-1 border-t border-gray-200 dark:border-gray-700">
                    <UFormField :label="$t('gestion.stock.pickup_location')">
                      <UInput
                        v-model="formData.pickupLocation"
                        :placeholder="$t('gestion.stock.pickup_location_placeholder')"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField
                      :label="$t('gestion.stock.pickup_responsible')"
                      :description="$t('gestion.stock.responsible_help')"
                    >
                      <UserSelector
                        v-model="formData.pickupResponsible"
                        v-model:search-term="pickupSearchTerm"
                        :searched-users="pickupSearchedUsers"
                        :searching-users="searchingPickupUsers"
                        :placeholder="$t('gestion.stock.responsible_placeholder')"
                      />
                      <UInput
                        v-model="formData.pickupContact"
                        :placeholder="$t('gestion.stock.responsible_contact_placeholder')"
                        class="w-full mt-2"
                      />
                    </UFormField>
                  </div>

                  <div class="space-y-3 pt-1 border-t border-gray-200 dark:border-gray-700">
                    <UFormField :label="$t('gestion.stock.return_location')">
                      <UInput
                        v-model="formData.returnLocation"
                        :placeholder="$t('gestion.stock.return_location_placeholder')"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField
                      :label="$t('gestion.stock.return_responsible')"
                      :description="$t('gestion.stock.responsible_help')"
                    >
                      <UserSelector
                        v-model="formData.returnResponsible"
                        v-model:search-term="returnSearchTerm"
                        :searched-users="returnSearchedUsers"
                        :searching-users="searchingReturnUsers"
                        :placeholder="$t('gestion.stock.responsible_placeholder')"
                      />
                      <UInput
                        v-model="formData.returnContact"
                        :placeholder="$t('gestion.stock.responsible_contact_placeholder')"
                        class="w-full mt-2"
                      />
                    </UFormField>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </UTabs>
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
import type { UserSelectItem } from '~/components/UserSelector.vue'

import { estAdresseEmail } from '~~/shared/utils/adresse-email'
import { getZoneTypeColor, getZoneTypeIcon } from '~~/shared/utils/zone-types'

/** Un responsable tel que la fiche le rend : à retraduire pour le sélecteur. */
interface ResponsableFiche {
  id: number
  pseudo: string
  emailHash?: string | null
  profilePicture?: string | null
}

interface StockItemLite {
  id: number
  name: string
  description: string | null
  quantity: number
  finalQuantity?: number | null
  notes: string | null
  isExternalLoan?: boolean
  ownerContact?: string | null
  returnDueAt?: string | null
  pickupLocation?: string | null
  pickupResponsible?: ResponsableFiche | null
  pickupContact?: string | null
  returnLocation?: string | null
  returnResponsible?: ResponsableFiche | null
  returnContact?: string | null
  location?: string | null
  zone?: { id: number; name: string; color: string } | null
  marker?: { id: number; name: string } | null
}

/**
 * Le sélecteur veut un libellé et une adresse ; la fiche ne rend que l'identité.
 *
 * L'adresse n'est volontairement pas exposée par l'API : la recherche se fait par e-mail exact,
 * mais l'afficher ensuite reviendrait à la divulguer à qui ouvre la fiche. Le pseudo suffit à
 * reconnaître la personne déjà désignée.
 */
function utilisateurDepuisFiche(
  responsable: ResponsableFiche | null | undefined
): UserSelectItem | null {
  if (!responsable) return null
  return {
    id: responsable.id,
    label: responsable.pseudo,
    pseudo: responsable.pseudo,
    email: '',
    emailHash: responsable.emailHash || '',
    profilePicture: responsable.profilePicture,
  }
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
const ongletActif = ref('general')

/**
 * L'onglet du prêt porte un point quand la case est cochée : sans lui, rien ne dirait depuis
 * l'onglet général qu'un matériel est emprunté, ni qu'il y a des champs remplis à côté.
 */
const onglets = computed(() => [
  // `value` et non `key` : c'est la propriété que `UTabs` lie à son `v-model`. Avec `key`, la
  // sélection retombait sur l'index et l'onglet par défaut ne s'appliquait pas.
  { value: 'general', slot: 'general', label: t('gestion.stock.tab_general') },
  {
    value: 'emprunt',
    slot: 'emprunt',
    label: t('gestion.stock.external_loan'),
    icon: formData.isExternalLoan ? 'i-heroicons-hand-raised' : undefined,
  },
])

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
  // Chaîne et non nombre : le champ doit pouvoir rester vide, et `null` se distingue de zéro.
  finalQuantity: '',
  notes: '',
  isExternalLoan: false,
  ownerContact: '',
  returnDueAt: '',
  pickupLocation: '',
  pickupResponsible: null as UserSelectItem | null,
  pickupContact: '',
  returnLocation: '',
  returnResponsible: null as UserSelectItem | null,
  returnContact: '',
  location: '',
  mapPin: NONE_PIN,
})

/** Ce qui manque au rangement, quand le comptage a eu lieu. */
const ecartQuantite = computed(() => {
  const compte = Number(formData.finalQuantity)
  if (formData.finalQuantity === '' || !Number.isFinite(compte)) return 0
  return Math.max(0, formData.quantity - compte)
})

// La recherche se fait par adresse e-mail exacte, comme pour les responsables d'accueil des
// artistes : on ne parcourt pas l'annuaire des comptes, on désigne quelqu'un qu'on connaît.
const pickupSearchTerm = ref('')
const pickupSearchedUsers = ref<UserSelectItem[]>([])
const searchingPickupUsers = ref(false)
const returnSearchTerm = ref('')
const returnSearchedUsers = ref<UserSelectItem[]>([])
const searchingReturnUsers = ref(false)

async function chercherUtilisateurs(email: string): Promise<UserSelectItem[]> {
  if (!estAdresseEmail(email)) return []
  try {
    const reponse = await $fetch<{ data: { users: any[] } }>('/api/users/search', {
      params: { emailExact: email },
    })
    return (reponse.data.users || []).map((u) => ({
      id: u.id,
      label: `${u.pseudo} (${u.email})`,
      pseudo: u.pseudo,
      email: u.email,
      emailHash: u.emailHash,
      profilePicture: u.profilePicture,
    }))
  } catch {
    return []
  }
}

watch(pickupSearchTerm, async (terme) => {
  if (!estAdresseEmail(terme)) {
    pickupSearchedUsers.value = []
    return
  }
  searchingPickupUsers.value = true
  pickupSearchedUsers.value = await chercherUtilisateurs(terme)
  searchingPickupUsers.value = false
})

watch(returnSearchTerm, async (terme) => {
  if (!estAdresseEmail(terme)) {
    returnSearchedUsers.value = []
    return
  }
  searchingReturnUsers.value = true
  returnSearchedUsers.value = await chercherUtilisateurs(terme)
  searchingReturnUsers.value = false
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
      ongletActif.value = 'general'
      formData.name = props.item?.name || ''
      formData.description = props.item?.description || ''
      formData.quantity = props.item?.quantity ?? 1
      formData.notes = props.item?.notes || ''
      formData.isExternalLoan = props.item?.isExternalLoan ?? false
      formData.ownerContact = props.item?.ownerContact || ''
      formData.returnDueAt = props.item?.returnDueAt
        ? String(props.item.returnDueAt).slice(0, 10)
        : ''
      formData.finalQuantity =
        props.item?.finalQuantity === null || props.item?.finalQuantity === undefined
          ? ''
          : String(props.item.finalQuantity)
      formData.pickupLocation = props.item?.pickupLocation || ''
      formData.pickupResponsible = utilisateurDepuisFiche(props.item?.pickupResponsible)
      formData.pickupContact = props.item?.pickupContact || ''
      formData.returnLocation = props.item?.returnLocation || ''
      formData.returnResponsible = utilisateurDepuisFiche(props.item?.returnResponsible)
      formData.returnContact = props.item?.returnContact || ''
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
    // `split` rend toujours au moins un morceau, mais le typage ne le sait pas : le repli garde le
    // chemin entier plutôt que de laisser une clé indéfinie.
    const fieldName = path.split('.')[0] ?? path
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
      finalQuantity: formData.finalQuantity === '' ? null : Number(formData.finalQuantity),
      isExternalLoan: formData.isExternalLoan,
      ownerContact: formData.isExternalLoan ? formData.ownerContact.trim() || null : null,
      returnDueAt:
        formData.isExternalLoan && formData.returnDueAt
          ? new Date(formData.returnDueAt).toISOString()
          : null,
      pickupLocation: formData.isExternalLoan ? formData.pickupLocation.trim() || null : null,
      pickupResponsibleId: formData.isExternalLoan
        ? (formData.pickupResponsible?.id ?? null)
        : null,
      pickupContact: formData.isExternalLoan ? formData.pickupContact.trim() || null : null,
      returnLocation: formData.isExternalLoan ? formData.returnLocation.trim() || null : null,
      returnResponsibleId: formData.isExternalLoan
        ? (formData.returnResponsible?.id ?? null)
        : null,
      returnContact: formData.isExternalLoan ? formData.returnContact.trim() || null : null,
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
