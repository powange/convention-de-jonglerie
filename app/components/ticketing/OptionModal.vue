<template>
  <UModal
    v-model:open="isOpen"
    :title="option ? 'Modifier l\'option' : 'Ajouter une option'"
    :ui="{ width: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form class="space-y-6" @submit.prevent="handleSubmit">
        <UAlert
          v-if="isHelloAssoOption"
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          :title="$t('ticketing.options.modal.title')"
          description="Cette option est synchronisée depuis HelloAsso et ne peut pas être modifiée."
        />

        <UFormField :label="$t('ticketing.options.modal.name_label')" name="name" required>
          <UInput
            v-model="form.name"
            :disabled="isHelloAssoOption"
            :placeholder="$t('ticketing.options.modal.name_placeholder')"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('ticketing.options.modal.description_label')" name="description">
          <UTextarea
            v-model="form.description"
            :disabled="isHelloAssoOption"
            :placeholder="$t('ticketing.options.modal.description_placeholder')"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Prix de l'option"
          name="price"
          help="Prix supplémentaire en euros (laisser vide si l'option est gratuite)"
        >
          <UInput
            v-model.number="priceInEuros"
            :disabled="isHelloAssoOption"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            size="lg"
            class="w-full"
          >
            <template #trailing>
              <span class="text-gray-500">€</span>
            </template>
          </UInput>
        </UFormField>

        <UFormField :label="$t('ticketing.options.modal.type_label')" name="type" required>
          <USelect
            v-model="form.type"
            :disabled="isHelloAssoOption"
            :items="typeOptions"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('ticketing.options.modal.is_mandatory_label')" name="isRequired">
          <div class="flex items-start gap-3">
            <USwitch v-model="form.isRequired" :disabled="isHelloAssoOption" class="mt-1" />
            <div class="flex-1">
              <label for="isRequired" class="text-sm font-medium text-gray-900 dark:text-white">
                Rendre cette option obligatoire
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Le participant devra obligatoirement sélectionner cette option
              </p>
            </div>
          </div>
        </UFormField>

        <UFormField
          v-if="form.type === 'MultipleChoice' || form.type === 'Select'"
          :label="$t('ticketing.options.modal.choices_label')"
          name="choices"
          help="Un choix par ligne"
        >
          <UTextarea
            v-model="choicesText"
            :disabled="isHelloAssoOption"
            :placeholder="$t('ticketing.options.modal.choices_placeholder')"
            :rows="5"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="$t('ticketing.options.modal.position_label')"
          name="position"
          help="Ordre d'affichage (0 = premier)"
        >
          <UInput
            v-model.number="form.position"
            :disabled="isHelloAssoOption"
            type="number"
            min="0"
            :placeholder="$t('ticketing.options.modal.position_placeholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('ticketing.options.modal.quotas_label')" name="quotas">
          <USelectMenu
            v-model="form.quotaIds"
            :items="quotas.map((q) => ({ label: q.title, value: q.id }))"
            value-key="value"
            multiple
            searchable
            :placeholder="$t('ticketing.options.modal.quotas_placeholder')"
            class="w-full"
          >
            <template #label>
              <span v-if="form.quotaIds.length === 0">{{
                $t('ticketing.options.modal.no_quota_selected')
              }}</span>
              <span v-else>{{ form.quotaIds.length }} quota(s) sélectionné(s)</span>
            </template>
          </USelectMenu>
        </UFormField>

        <UFormField
          :label="$t('ticketing.tiers.modal.returnable_items_label')"
          name="returnableItems"
        >
          <USelectMenu
            v-model="form.returnableItemIds"
            :items="returnableItems.map((item) => ({ label: item.name, value: item.id }))"
            value-key="value"
            multiple
            searchable
            :placeholder="$t('ticketing.tiers.modal.returnable_items_placeholder')"
            class="w-full"
          >
            <template #label>
              <span v-if="form.returnableItemIds.length === 0">{{
                $t('ticketing.tiers.modal.no_item_selected')
              }}</span>
              <span v-else>{{ form.returnableItemIds.length }} article(s) sélectionné(s)</span>
            </template>
          </USelectMenu>
        </UFormField>

        <UFormField
          label="Tarifs associés"
          name="tiers"
          :help="
            isHelloAssoOption
              ? 'Les associations tarif-option sont gérées par HelloAsso'
              : 'Cette option ne sera proposée que pour les tarifs sélectionnés'
          "
        >
          <USelectMenu
            v-model="form.tierIds"
            :items="tiers.map((tier) => ({ label: tier.name, value: tier.id }))"
            value-key="value"
            multiple
            searchable
            :disabled="isHelloAssoOption"
            placeholder="Sélectionner les tarifs..."
            class="w-full"
          >
            <template #label>
              <span v-if="form.tierIds.length === 0">Tous les tarifs</span>
              <span v-else>{{ form.tierIds.length }} tarif(s) sélectionné(s)</span>
            </template>
          </USelectMenu>
        </UFormField>

        <UFormField
          label="Repas associés"
          name="meals"
          help="Cette option donnera accès aux repas sélectionnés"
        >
          <USelectMenu
            v-model="form.mealIds"
            :items="mealsOptions"
            value-key="value"
            multiple
            searchable
            placeholder="Sélectionner les repas..."
            class="w-full"
          >
            <template #label>
              <span v-if="form.mealIds.length === 0">Aucun repas sélectionné</span>
              <span v-else>{{ form.mealIds.length }} repas sélectionné(s)</span>
            </template>
          </USelectMenu>
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton color="neutral" variant="soft" @click="isOpen = false"> Annuler </UButton>
        <UButton color="primary" icon="i-heroicons-check" :loading="saving" @click="handleSubmit">
          {{ option ? 'Enregistrer' : 'Ajouter' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface TicketingOption {
  id: number
  name: string
  description?: string
  type: string
  isRequired: boolean
  choices?: string[]
  price?: number | null
  position: number
  helloAssoOptionId?: number
  quotas?: any[]
  returnableItems?: any[]
  tiers?: any[]
  meals?: any[]
}

const props = defineProps<{
  open: boolean
  option?: TicketingOption
  editionId: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

// Vérifie si c'est une option HelloAsso (lecture seule)
const isHelloAssoOption = computed(
  () => props.option?.helloAssoOptionId !== null && props.option?.helloAssoOptionId !== undefined
)

const typeOptions = [
  { label: 'Texte court', value: 'TextInput' },
  { label: 'Texte long', value: 'FreeText' },
  { label: 'Liste de choix', value: 'ChoiceList' },
  { label: 'Oui/Non', value: 'YesNo' },
  { label: 'Date', value: 'Date' },
  { label: 'Numéro de téléphone', value: 'Phone' },
  { label: 'Code postal', value: 'Zipcode' },
  { label: 'Nombre', value: 'Number' },
  { label: 'Fichier', value: 'File' },
]

const form = ref({
  name: '',
  description: '',
  type: 'TextInput',
  isRequired: false,
  position: 0,
  quotaIds: [] as number[],
  returnableItemIds: [] as number[],
  tierIds: [] as number[],
  mealIds: [] as number[],
})

const choicesText = ref('')
const priceInEuros = ref<number | null>(null)

// Charger les quotas, items, tarifs et repas disponibles
const quotas = ref<any[]>([])
const returnableItems = ref<any[]>([])
const tiers = ref<any[]>([])
const meals = ref<any[]>([])

// Utiliser les utilitaires meals pour formater les labels
const { getMealTypeLabel } = useMealTypeLabel()
const { getPhasesLabel } = useMealPhaseLabel()

// Computed pour formater les options de repas
const mealsOptions = computed(() => {
  return meals.value.map((meal) => {
    const dateStr = new Date(meal.date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    const mealTypeLabel = getMealTypeLabel(meal.mealType)
    const phasesLabel = getPhasesLabel(meal.phases)

    return {
      label: `${dateStr} - ${mealTypeLabel} (${phasesLabel})`,
      value: meal.id,
    }
  })
})

const loadQuotasAndItems = async () => {
  try {
    const [quotasData, itemsData, tiersData, mealsData] = await Promise.all([
      $fetch(`/api/editions/${props.editionId}/ticketing/quotas`),
      $fetch<{ success: boolean; returnableItems: any[] }>(
        `/api/editions/${props.editionId}/ticketing/returnable-items`
      ),
      $fetch<any[]>(`/api/editions/${props.editionId}/ticketing/tiers`),
      $fetch(`/api/editions/${props.editionId}/volunteers/meals`),
    ])
    quotas.value = quotasData
    returnableItems.value = itemsData.returnableItems
    tiers.value = tiersData
    meals.value = Array.isArray(mealsData?.meals) ? mealsData.meals : []
  } catch (error) {
    console.error('Failed to load quotas, items, tiers and meals:', error)
  }
}

// Réinitialiser le formulaire quand la modal s'ouvre
watch(
  () => props.open,
  async (newValue) => {
    if (newValue) {
      await loadQuotasAndItems()

      if (props.option) {
        // Mode édition
        form.value = {
          name: props.option.name,
          description: props.option.description || '',
          type: props.option.type,
          isRequired: props.option.isRequired,
          position: props.option.position,
          quotaIds: props.option.quotas?.map((q: any) => q.quotaId) || [],
          returnableItemIds:
            props.option.returnableItems?.map((r: any) => r.returnableItemId) || [],
          tierIds: props.option.tiers?.map((t: any) => t.tierId) || [],
          mealIds: props.option.meals?.map((m: any) => m.mealId) || [],
        }
        choicesText.value = props.option.choices?.join('\n') || ''
        // Convertir le prix de centimes en euros
        priceInEuros.value = props.option.price ? props.option.price / 100 : null
      } else {
        // Mode création
        form.value = {
          name: '',
          description: '',
          type: 'TextInput',
          isRequired: false,
          position: 0,
          quotaIds: [],
          returnableItemIds: [],
          tierIds: [],
          mealIds: [],
        }
        choicesText.value = ''
        priceInEuros.value = null
      }
    }
  }
)

// Construit les données du formulaire pour l'API
const buildFormData = () => ({
  name: form.value.name.trim(),
  description: form.value.description.trim() || null,
  type: form.value.type,
  isRequired: form.value.isRequired,
  position: form.value.position,
  choices:
    form.value.type === 'MultipleChoice' || form.value.type === 'Select'
      ? choicesText.value.split('\n').filter((c) => c.trim())
      : null,
  price: priceInEuros.value ? Math.round(priceInEuros.value * 100) : null,
  quotaIds: form.value.quotaIds,
  returnableItemIds: form.value.returnableItemIds,
  tierIds: form.value.tierIds,
  mealIds: form.value.mealIds,
})

// Callbacks communs
const onSaveSuccess = () => {
  emit('saved')
  isOpen.value = false
}

// Action pour créer une option
const { execute: executeCreate, loading: isCreating } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/options`,
  {
    method: 'POST',
    body: buildFormData,
    successMessage: { title: t('ticketing.options.created') },
    errorMessages: { default: t('ticketing.options.error_saving') },
    onSuccess: onSaveSuccess,
  }
)

// Action pour mettre à jour une option
const { execute: executeUpdate, loading: isUpdating } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/options/${props.option?.id}`,
  {
    method: 'PUT',
    body: buildFormData,
    successMessage: { title: t('ticketing.options.updated') },
    errorMessages: { default: t('ticketing.options.error_saving') },
    onSuccess: onSaveSuccess,
  }
)

// État de chargement combiné
const saving = computed(() => isCreating.value || isUpdating.value)

const handleSubmit = () => {
  const toast = useToast()

  if (!form.value.name.trim()) {
    toast.add({
      title: t('common.error'),
      description: t('ticketing.options.name_required'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  if (props.option) {
    executeUpdate()
  } else {
    executeCreate()
  }
}
</script>
