<!--
  Modifier plusieurs objets d'un coup.

  Le piège de ce genre d'écran : distinguer « ne pas toucher à ce champ » de « vider ce champ ».
  Un formulaire ordinaire, pré-rempli à vide, effacerait l'emplacement de toute la sélection dès
  qu'on ne veut changer qu'autre chose. Chaque champ est donc précédé d'une case : décoché, il
  n'est pas envoyé du tout.

  Le changement de groupe a sa propre modale — c'est le geste le plus courant, et il mérite un
  bouton direct plutôt qu'une ligne perdue au milieu de dix autres.
-->
<template>
  <UModal
    v-model:open="isOpen"
    :title="t('gestion.stock.bulk_edit')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('gestion.stock.bulk_edit_intro', { count: itemIds.length }) }}
        </p>

        <!-- Emplacement de rangement -->
        <div class="flex items-start gap-3">
          <UCheckbox v-model="actifs.emplacement" class="mt-7" />
          <UFormField :label="t('gestion.stock.item_storage_location')" class="flex-1 min-w-0">
            <!-- Même sélecteur que sur la fiche d'un objet, icône et couleur du type comprises :
                 reconnaître un lieu ne doit pas dépendre de l'écran où on le choisit. -->
            <USelect
              v-model="valeurs.mapPin"
              :items="mapPinItems"
              :disabled="!actifs.emplacement"
              :placeholder="t('gestion.stock.no_map_pin')"
              class="w-full"
            >
              <template #leading>
                <UIcon
                  v-if="pinChoisi?.icon"
                  :name="pinChoisi.icon"
                  :style="pinChoisi.color ? { color: pinChoisi.color } : undefined"
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
            <UInput
              v-model="valeurs.location"
              :disabled="!actifs.emplacement"
              :placeholder="t('gestion.stock.item_location_placeholder')"
              class="w-full mt-2"
            />
          </UFormField>
        </div>

        <!-- Tags : ajout et retrait séparés, pour préserver ceux qu'on ne touche pas -->
        <div v-if="tags.length" class="flex items-start gap-3">
          <UCheckbox v-model="actifs.tags" class="mt-7" />
          <div class="flex-1 min-w-0 space-y-2">
            <UFormField :label="t('gestion.stock.bulk_edit_add_tags')">
              <USelectMenu
                v-model="valeurs.addTags"
                :items="tagItems"
                multiple
                :disabled="!actifs.tags"
                class="w-full"
                :ui="{ content: 'min-w-fit' }"
              />
            </UFormField>
            <UFormField :label="t('gestion.stock.bulk_edit_remove_tags')">
              <USelectMenu
                v-model="valeurs.removeTags"
                :items="tagItems"
                multiple
                :disabled="!actifs.tags"
                class="w-full"
                :ui="{ content: 'min-w-fit' }"
              />
            </UFormField>
          </div>
        </div>

        <!-- Emprunt : n'atteint que le matériel effectivement prêté -->
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
          <p
            class="text-sm"
            :class="nbEmpruntes ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 italic'"
          >
            {{ t('gestion.stock.bulk_edit_loan_scope', { count: nbEmpruntes }) }}
          </p>

          <div class="flex items-start gap-3">
            <UCheckbox v-model="actifs.proprietaire" class="mt-7" :disabled="!nbEmpruntes" />
            <UFormField :label="t('gestion.stock.owner_contact')" class="flex-1 min-w-0">
              <UInput
                v-model="valeurs.ownerContact"
                :disabled="!actifs.proprietaire"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="flex items-start gap-3">
            <UCheckbox v-model="actifs.dateRetour" class="mt-7" :disabled="!nbEmpruntes" />
            <UFormField :label="t('gestion.stock.return_due_at')" class="flex-1 min-w-0">
              <UiDateField v-model="valeurs.returnDueAt" :disabled="!actifs.dateRetour" />
            </UFormField>
          </div>

          <div class="flex items-start gap-3">
            <UCheckbox v-model="actifs.recuperation" class="mt-7" :disabled="!nbEmpruntes" />
            <div class="flex-1 min-w-0 space-y-2">
              <UFormField :label="t('gestion.stock.pickup_location')">
                <UInput
                  v-model="valeurs.pickupLocation"
                  :disabled="!actifs.recuperation"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="t('gestion.stock.pickup_responsible')">
                <UInput
                  v-model="valeurs.pickupContact"
                  :disabled="!actifs.recuperation"
                  :placeholder="t('gestion.stock.responsible_contact_placeholder')"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <UCheckbox v-model="actifs.retour" class="mt-7" :disabled="!nbEmpruntes" />
            <div class="flex-1 min-w-0 space-y-2">
              <UFormField :label="t('gestion.stock.return_location')">
                <UInput
                  v-model="valeurs.returnLocation"
                  :disabled="!actifs.retour"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="t('gestion.stock.return_responsible')">
                <UInput
                  v-model="valeurs.returnContact"
                  :disabled="!actifs.retour"
                  :placeholder="t('gestion.stock.responsible_contact_placeholder')"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="enregistrement"
          :disabled="rienAChanger"
          @click="enregistrer"
        >
          {{ t('gestion.stock.bulk_edit_apply', { count: itemIds.length }) }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { getZoneTypeColor, getZoneTypeIcon } from '~~/shared/utils/zone-types'

interface TagLite {
  id: number
  name: string
  color: string
}

const props = defineProps<{
  modelValue: boolean
  editionId: number
  /** Les objets cochés dans la liste. */
  itemIds: number[]
  /** Combien d'entre eux sont des emprunts : les champs de prêt ne toucheront que ceux-là. */
  nbEmpruntes: number
  tags: TagLite[]
  zones?: Array<{ id: number; name: string; color: string; types?: string[] }>
  markers?: Array<{ id: number; name: string; color?: string | null; types?: string[] }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const toast = useToast()
const enregistrement = ref(false)

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const AUCUN_PIN = 'none'

const actifs = reactive({
  emplacement: false,
  tags: false,
  proprietaire: false,
  dateRetour: false,
  recuperation: false,
  retour: false,
})

const valeurs = reactive({
  mapPin: AUCUN_PIN,
  location: '',
  addTags: [] as Array<{ label: string; value: number }>,
  removeTags: [] as Array<{ label: string; value: number }>,
  ownerContact: '',
  returnDueAt: '',
  pickupLocation: '',
  pickupContact: '',
  returnLocation: '',
  returnContact: '',
})

const tagItems = computed(() => props.tags.map((tg) => ({ label: tg.name, value: tg.id })))

// Les mêmes options que la fiche d'un objet : icône du type, couleur de la zone ou du marqueur —
// celle du type à défaut pour un marqueur, exactement comme là-bas.
const mapPinItems = computed(() => [
  { label: t('gestion.stock.no_map_pin'), value: AUCUN_PIN, icon: 'i-lucide-minus', color: null },
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

const pinChoisi = computed(() => mapPinItems.value.find((i) => i.value === valeurs.mapPin) || null)

/** Rien de coché : il n'y a rien à appliquer, et le bouton doit le dire. */
const rienAChanger = computed(() => !Object.values(actifs).some(Boolean))

// Chaque ouverture repart de zéro : garder les cases d'une modification précédente ferait
// appliquer par inadvertance des changements à une autre sélection.
watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return
    for (const cle of Object.keys(actifs) as Array<keyof typeof actifs>) actifs[cle] = false
    valeurs.mapPin = AUCUN_PIN
    valeurs.location = ''
    valeurs.addTags = []
    valeurs.removeTags = []
    valeurs.ownerContact = ''
    valeurs.returnDueAt = ''
    valeurs.pickupLocation = ''
    valeurs.pickupContact = ''
    valeurs.returnLocation = ''
    valeurs.returnContact = ''
  }
)

/**
 * Ne construit le corps qu'avec les champs cochés.
 *
 * Un champ coché mais laissé vide vaut « vider » : c'est précisément ce que la case permet
 * d'exprimer, et qu'un formulaire ordinaire ne saurait pas distinguer de « ne pas y toucher ».
 */
function corpsDeLaRequete(): Record<string, unknown> {
  const corps: Record<string, unknown> = { itemIds: props.itemIds }

  if (actifs.emplacement) {
    corps.location = valeurs.location.trim() || null
    corps.zoneId = valeurs.mapPin.startsWith('zone:') ? Number(valeurs.mapPin.slice(5)) : null
    corps.markerId = valeurs.mapPin.startsWith('marker:') ? Number(valeurs.mapPin.slice(7)) : null
  }

  if (actifs.tags) {
    corps.addTagIds = valeurs.addTags.map((tg) => tg.value)
    corps.removeTagIds = valeurs.removeTags.map((tg) => tg.value)
  }

  if (actifs.proprietaire) corps.ownerContact = valeurs.ownerContact.trim() || null
  if (actifs.dateRetour) {
    corps.returnDueAt = valeurs.returnDueAt ? new Date(valeurs.returnDueAt).toISOString() : null
  }
  if (actifs.recuperation) {
    corps.pickupLocation = valeurs.pickupLocation.trim() || null
    corps.pickupContact = valeurs.pickupContact.trim() || null
  }
  if (actifs.retour) {
    corps.returnLocation = valeurs.returnLocation.trim() || null
    corps.returnContact = valeurs.returnContact.trim() || null
  }

  return corps
}

async function enregistrer() {
  if (rienAChanger.value) return

  enregistrement.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/stock-items/bulk`, {
      method: 'PATCH',
      body: corpsDeLaRequete(),
    })
    toast.add({ title: t('common.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    emit('saved')
    isOpen.value = false
  } catch (e: any) {
    toast.add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    enregistrement.value = false
  }
}
</script>
