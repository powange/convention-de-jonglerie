<template>
  <UModal
    v-model:open="isOpen"
    :title="`Associations pour &quot;${customField?.label}&quot;`"
    :ui="{ width: 'sm:max-w-4xl' }"
  >
    <template #body>
      <div class="space-y-6">
        <!-- Information sur le custom field -->
        <UAlert icon="i-heroicons-information-circle" color="info" variant="soft">
          <template #title>Associations</template>
          <template #description>
            <div class="space-y-1">
              <p>
                Configurez les tarifs, quotas et articles à restituer pour ce champ personnalisé.
              </p>
              <p class="text-xs">
                Pour les champs de type "Liste de choix", vous pouvez associer par choix spécifique
                ou pour tous les choix.
              </p>
            </div>
          </template>
        </UAlert>

        <!-- Section Tarifs -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="font-semibold text-gray-900 dark:text-white">Tarifs associés</h4>
          </div>

          <div v-if="loadingTiers" class="flex justify-center py-4">
            <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-primary-500" />
          </div>

          <UCheckboxGroup
            v-else-if="availableTiers.length > 0"
            v-model="selectedTierIds"
            :items="tierItems"
            class="space-y-2"
          />

          <p v-else class="text-sm text-gray-500">Aucun tarif disponible</p>
        </div>

        <USeparator />

        <!-- Section Quotas -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="font-semibold text-gray-900 dark:text-white">Quotas</h4>
            <UButton
              icon="i-heroicons-plus"
              color="primary"
              variant="soft"
              size="sm"
              @click="addQuotaAssociation"
            >
              Ajouter un quota
            </UButton>
          </div>

          <div v-if="loadingQuotas" class="flex justify-center py-4">
            <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-primary-500" />
          </div>

          <div
            v-else-if="quotaAssociations.length === 0"
            class="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg"
          >
            <p class="text-sm text-gray-500 dark:text-gray-400">Aucun quota associé</p>
          </div>

          <div v-else class="space-y-3">
            <UCard
              v-for="(assoc, index) in quotaAssociations"
              :key="index"
              :ui="{ body: { padding: 'p-4' } }"
            >
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormField label="Quota" required>
                  <USelect
                    v-model="assoc.quotaId"
                    :items="quotaItems"
                    placeholder="Sélectionnez un quota"
                    value-key="id"
                    :ui="{ content: 'min-w-fit' }"
                  />
                </UFormField>

                <UFormField label="Choix concerné">
                  <USelect
                    v-model="assoc.choiceValue"
                    :items="choiceOptions"
                    placeholder="Tous les choix"
                    value-key="value"
                    :ui="{ content: 'min-w-fit' }"
                  />
                </UFormField>
              </div>

              <div class="flex justify-end mt-3">
                <UButton
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  size="sm"
                  @click="removeQuotaAssociation(index)"
                >
                  Supprimer
                </UButton>
              </div>
            </UCard>
          </div>
        </div>

        <USeparator />

        <!-- Section Articles à restituer -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="font-semibold text-gray-900 dark:text-white">Articles à restituer</h4>
            <UButton
              icon="i-heroicons-plus"
              color="primary"
              variant="soft"
              size="sm"
              @click="addReturnableItemAssociation"
            >
              Ajouter un article
            </UButton>
          </div>

          <div v-if="loadingReturnableItems" class="flex justify-center py-4">
            <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-primary-500" />
          </div>

          <div
            v-else-if="returnableItemAssociations.length === 0"
            class="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg"
          >
            <p class="text-sm text-gray-500 dark:text-gray-400">Aucun article associé</p>
          </div>

          <div v-else class="space-y-3">
            <UCard
              v-for="(assoc, index) in returnableItemAssociations"
              :key="index"
              :ui="{ body: { padding: 'p-4' } }"
            >
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormField label="Article" required>
                  <USelect
                    v-model="assoc.returnableItemId"
                    :items="returnableItemItems"
                    placeholder="Sélectionnez un article"
                    value-key="id"
                    :ui="{ content: 'min-w-fit' }"
                  />
                </UFormField>

                <UFormField label="Choix concerné">
                  <USelect
                    v-model="assoc.choiceValue"
                    :items="choiceOptions"
                    placeholder="Tous les choix"
                    value-key="value"
                    :ui="{ content: 'min-w-fit' }"
                  />
                </UFormField>
              </div>

              <div class="flex justify-end mt-3">
                <UButton
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  size="sm"
                  @click="removeReturnableItemAssociation(index)"
                >
                  Supprimer
                </UButton>
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="soft" @click="isOpen = false"> Annuler </UButton>
        <UButton color="primary" icon="i-heroicons-check" :loading="saving" @click="save">
          Enregistrer
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface CustomField {
  id: number
  label: string
  type: string
  values?: string[]
  tiers?: Array<{
    tier: {
      id: number
      name: string
    }
  }>
  quotas?: Array<{
    quota: {
      id: number
      title: string
    }
    choiceValue?: string | null
  }>
  returnableItems?: Array<{
    returnableItem: {
      id: number
      name: string
    }
    choiceValue?: string | null
  }>
}

interface Quota {
  id: number
  title: string
}

interface Tier {
  id: number
  name: string
}

interface ReturnableItem {
  id: number
  name: string
}

interface QuotaAssociation {
  quotaId: number | null
  choiceValue: string | null
}

interface ReturnableItemAssociation {
  returnableItemId: number | null
  choiceValue: string | null
}

const props = defineProps<{
  open: boolean
  customField: CustomField | null
  editionId: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  refresh: []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const loadingTiers = ref(false)
const loadingQuotas = ref(false)
const loadingReturnableItems = ref(false)
const availableTiers = ref<Tier[]>([])
const availableQuotas = ref<Quota[]>([])
const availableReturnableItems = ref<ReturnableItem[]>([])

const selectedTierIds = ref<number[]>([])
const quotaAssociations = ref<QuotaAssociation[]>([])
const returnableItemAssociations = ref<ReturnableItemAssociation[]>([])

// Items pour le UCheckboxGroup des tarifs
const tierItems = computed(() =>
  availableTiers.value.map((tier) => ({
    label: tier.name,
    value: tier.id,
  }))
)

// Items pour les quotas (avec label au lieu de title)
const quotaItems = computed(() => {
  if (!Array.isArray(availableQuotas.value)) return []
  return availableQuotas.value.map((quota) => ({
    label: quota.title,
    id: quota.id,
  }))
})

// Items pour les articles à restituer (avec label au lieu de name)
const returnableItemItems = computed(() => {
  if (!Array.isArray(availableReturnableItems.value)) return []
  return availableReturnableItems.value.map((item) => ({
    label: item.name,
    id: item.id,
  }))
})

// Options de choix pour les selects
const choiceOptions = computed(() => {
  if (!props.customField?.values || props.customField.type !== 'ChoiceList') {
    return [{ label: 'Tous les choix', value: null }]
  }

  return [
    { label: 'Tous les choix', value: null },
    ...props.customField.values.map((v) => ({ label: v, value: v })),
  ]
})

const addQuotaAssociation = () => {
  quotaAssociations.value.push({
    quotaId: null,
    choiceValue: null,
  })
}

const removeQuotaAssociation = (index: number) => {
  quotaAssociations.value.splice(index, 1)
}

const addReturnableItemAssociation = () => {
  returnableItemAssociations.value.push({
    returnableItemId: null,
    choiceValue: null,
  })
}

const removeReturnableItemAssociation = (index: number) => {
  returnableItemAssociations.value.splice(index, 1)
}

const loadTiers = async () => {
  loadingTiers.value = true
  try {
    const response = await $fetch<{ tiers: Tier[] }>(
      `/api/editions/${props.editionId}/ticketing/tiers/available`
    )
    availableTiers.value = response.tiers || []
  } catch (error) {
    console.error('Erreur lors du chargement des tarifs:', error)
  } finally {
    loadingTiers.value = false
  }
}

const loadQuotas = async () => {
  loadingQuotas.value = true
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/ticketing/quotas`)
    availableQuotas.value = response || []
  } catch (error) {
    console.error('Erreur lors du chargement des quotas:', error)
  } finally {
    loadingQuotas.value = false
  }
}

const loadReturnableItems = async () => {
  loadingReturnableItems.value = true
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/ticketing/returnable-items`)
    availableReturnableItems.value = response?.returnableItems || []
  } catch (error) {
    console.error('Erreur lors du chargement des articles:', error)
  } finally {
    loadingReturnableItems.value = false
  }
}

const buildAssociationsBody = () => {
  const validQuotas = quotaAssociations.value
    .filter((a) => a.quotaId !== null)
    .map((a) => ({
      quotaId: a.quotaId!,
      choiceValue: a.choiceValue || undefined,
    }))

  const validReturnableItems = returnableItemAssociations.value
    .filter((a) => a.returnableItemId !== null)
    .map((a) => ({
      returnableItemId: a.returnableItemId!,
      choiceValue: a.choiceValue || undefined,
    }))

  return {
    tierIds: selectedTierIds.value,
    quotas: validQuotas,
    returnableItems: validReturnableItems,
  }
}

const { execute: save, loading: saving } = useApiAction(
  () =>
    `/api/editions/${props.editionId}/ticketing/custom-fields/${props.customField?.id}/associations`,
  {
    method: 'PUT',
    body: buildAssociationsBody,
    successMessage: {
      title: 'Associations mises à jour',
      description: 'Les tarifs, quotas et articles ont été enregistrés avec succès',
    },
    errorMessages: { default: 'Impossible de sauvegarder les associations' },
    onSuccess: () => {
      isOpen.value = false
      emit('refresh')
    },
  }
)

// Initialiser les associations quand on ouvre la modal
watch(
  () => props.open,
  async (newValue) => {
    if (newValue && props.customField) {
      await Promise.all([loadTiers(), loadQuotas(), loadReturnableItems()])

      // Charger les associations de tarifs existantes
      selectedTierIds.value = props.customField.tiers?.map((t) => t.tier.id) || []

      // Charger les associations existantes
      if (props.customField.quotas && props.customField.quotas.length > 0) {
        quotaAssociations.value = props.customField.quotas.map((q) => ({
          quotaId: q.quota.id,
          choiceValue: q.choiceValue || null,
        }))
      } else {
        quotaAssociations.value = []
      }

      if (props.customField.returnableItems && props.customField.returnableItems.length > 0) {
        returnableItemAssociations.value = props.customField.returnableItems.map((r) => ({
          returnableItemId: r.returnableItem.id,
          choiceValue: r.choiceValue || null,
        }))
      } else {
        returnableItemAssociations.value = []
      }
    }
  }
)
</script>
