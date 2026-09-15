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
            <p>Configurez les tarifs associés à ce champ personnalisé.</p>
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
}

interface Tier {
  id: number
  name: string
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
const availableTiers = ref<Tier[]>([])

const selectedTierIds = ref<number[]>([])

// Items pour le UCheckboxGroup des tarifs
const tierItems = computed(() =>
  availableTiers.value.map((tier) => ({
    label: tier.name,
    value: tier.id,
  }))
)

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

// Pas de `quotas` : ils se règlent sur la page dédiée, et l'endpoint ne les accepte plus du
// tout — il n'y a donc qu'un seul chemin pour les modifier.
const buildAssociationsBody = () => ({ tierIds: selectedTierIds.value })

const { execute: save, loading: saving } = useApiAction(
  () =>
    `/api/editions/${props.editionId}/ticketing/custom-fields/${props.customField?.id}/associations`,
  {
    method: 'PUT',
    body: buildAssociationsBody,
    successMessage: {
      title: 'Associations mises à jour',
      description: 'Les tarifs et quotas ont été enregistrés avec succès',
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
      await loadTiers()

      // Charger les associations de tarifs existantes
      selectedTierIds.value = props.customField.tiers?.map((t) => t.tier.id) || []
    }
  }
)
</script>
