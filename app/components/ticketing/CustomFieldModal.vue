<template>
  <UModal
    v-model:open="isOpen"
    :title="customField ? 'Modifier le champ personnalisé' : 'Ajouter un champ personnalisé'"
    :ui="{ width: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-6">
        <!-- Informations de base -->
        <div class="space-y-4">
          <UFormField label="Label du champ" required>
            <UInput v-model="form.label" placeholder="Ex: Taille de t-shirt" class="w-full" />
          </UFormField>

          <UFormField label="Type de champ" required>
            <USelect
              v-model="form.type"
              :items="typeOptions"
              placeholder="Sélectionnez un type"
              value-key="value"
              @update:model-value="onTypeChange"
            />
          </UFormField>

          <!-- Valeurs pour ChoiceList -->
          <div v-if="form.type === 'ChoiceList'" class="space-y-3">
            <UFormField label="Choix disponibles" required>
              <div class="space-y-2">
                <div
                  v-for="(value, index) in form.values"
                  :key="index"
                  class="flex items-center gap-2"
                >
                  <UInput
                    v-model="form.values[index]"
                    placeholder="Ex: S, M, L, XL"
                    class="flex-1"
                  />
                  <UButton
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="sm"
                    @click="removeValue(index)"
                  />
                </div>
                <UButton
                  icon="i-heroicons-plus"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  block
                  @click="addValue"
                >
                  Ajouter un choix
                </UButton>
              </div>
            </UFormField>
          </div>

          <UFormField label="Champ obligatoire">
            <UCheckbox v-model="form.isRequired" label="Ce champ est obligatoire" />
          </UFormField>
        </div>

        <USeparator />

        <!-- Association aux tarifs -->
        <div class="space-y-3">
          <h4 class="font-semibold text-gray-900 dark:text-white">Association aux tarifs</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Sélectionnez les tarifs auxquels ce champ sera associé
          </p>

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

        <!-- Note pour les associations avancées -->
        <UAlert
          v-if="form.type === 'ChoiceList'"
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
        >
          <template #title>Associations quotas/articles</template>
          <template #description>
            Les associations avec les quotas et articles à restituer pour chaque choix peuvent être
            configurées après la création du champ.
          </template>
        </UAlert>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="soft" @click="isOpen = false"> Annuler </UButton>
        <UButton
          color="primary"
          icon="i-heroicons-check"
          :loading="saving"
          :disabled="!isFormValid"
          @click="save"
        >
          {{ customField ? 'Enregistrer' : 'Créer' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface CustomField {
  id: number
  label: string
  type: string
  isRequired: boolean
  values?: string[]
  tiers?: Array<{
    tier: {
      id: number
      name: string
    }
  }>
}

interface Tier {
  id: number
  name: string
}

const props = defineProps<{
  open: boolean
  customField?: CustomField | null
  editionId: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  refresh: []
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const form = ref({
  label: '',
  type: '',
  isRequired: false,
  values: [] as string[],
})

const selectedTierIds = ref<number[]>([])
const loadingTiers = ref(false)
const availableTiers = ref<Tier[]>([])

const typeOptions = [
  { label: 'Texte court', value: 'TextInput' },
  { label: 'Oui/Non', value: 'YesNo' },
  { label: 'Liste de choix', value: 'ChoiceList' },
  { label: 'Texte long', value: 'FreeText' },
]

const tierItems = computed(() =>
  availableTiers.value.map((tier) => ({
    label: tier.name,
    value: tier.id,
  }))
)

const isFormValid = computed(() => {
  if (!form.value.label || !form.value.type) return false
  if (form.value.type === 'ChoiceList' && form.value.values.length === 0) return false
  return true
})

const onTypeChange = () => {
  if (form.value.type !== 'ChoiceList') {
    form.value.values = []
  } else if (form.value.values.length === 0) {
    form.value.values = ['']
  }
}

const addValue = () => {
  form.value.values.push('')
}

const removeValue = (index: number) => {
  form.value.values.splice(index, 1)
}

const loadTiers = async () => {
  loadingTiers.value = true
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/ticketing/tiers/available`, {
      query: {
        showAll: true,
      },
    })
    availableTiers.value = response.tiers || []
  } catch (error) {
    console.error('Erreur lors du chargement des tarifs:', error)
  } finally {
    loadingTiers.value = false
  }
}

// Construit les données du formulaire pour l'API
const buildFormData = () => ({
  label: form.value.label,
  type: form.value.type,
  isRequired: form.value.isRequired,
  values: form.value.type === 'ChoiceList' ? form.value.values.filter((v) => v.trim()) : undefined,
  tierIds: selectedTierIds.value,
})

// Callbacks communs
const onSaveSuccess = () => {
  isOpen.value = false
  emit('refresh')
}

// Action pour créer un champ personnalisé
const { execute: executeCreate, loading: isCreating } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/custom-fields`,
  {
    method: 'POST',
    body: buildFormData,
    successMessage: { title: t('ticketing.custom_fields.created') },
    errorMessages: { default: t('ticketing.custom_fields.error_saving') },
    onSuccess: onSaveSuccess,
  }
)

// Action pour mettre à jour un champ personnalisé
const { execute: executeUpdate, loading: isUpdating } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/custom-fields/${props.customField?.id}`,
  {
    method: 'PUT',
    body: buildFormData,
    successMessage: { title: t('ticketing.custom_fields.updated') },
    errorMessages: { default: t('ticketing.custom_fields.error_saving') },
    onSuccess: onSaveSuccess,
  }
)

// État de chargement combiné
const saving = computed(() => isCreating.value || isUpdating.value)

const save = () => {
  if (props.customField) {
    executeUpdate()
  } else {
    executeCreate()
  }
}

// Initialiser le formulaire quand on ouvre la modal
watch(
  () => props.open,
  async (newValue) => {
    if (newValue) {
      await loadTiers()

      if (props.customField) {
        // Mode édition
        form.value = {
          label: props.customField.label,
          type: props.customField.type,
          isRequired: props.customField.isRequired,
          values: props.customField.values ? [...props.customField.values] : [],
        }
        selectedTierIds.value = props.customField.tiers?.map((t) => t.tier.id) || []
      } else {
        // Mode création
        form.value = {
          label: '',
          type: '',
          isRequired: false,
          values: [],
        }
        selectedTierIds.value = []
      }
    }
  }
)
</script>
