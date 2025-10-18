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

        <UFormField :label="$t('ticketing.options.modal.type_label')" name="type" required>
          <USelect
            v-model="form.type"
            :disabled="isHelloAssoOption"
            :options="typeOptions"
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
          v-if="form.type === 'ChoixMultiple' || form.type === 'ChoixUnique'"
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

import { createOption, updateOption } from '~/utils/ticketing/options'

interface TicketingOption {
  id: number
  name: string
  description?: string
  type: string
  isRequired: boolean
  choices?: string[]
  position: number
  helloAssoOptionId?: number
  quotas?: any[]
  returnableItems?: any[]
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

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const saving = ref(false)

// Vérifie si c'est une option HelloAsso (lecture seule)
const isHelloAssoOption = computed(
  () => props.option?.helloAssoOptionId !== null && props.option?.helloAssoOptionId !== undefined
)

const typeOptions = [
  { label: 'Texte', value: 'Texte' },
  { label: 'Choix unique', value: 'ChoixUnique' },
  { label: 'Choix multiple', value: 'ChoixMultiple' },
  { label: 'Case à cocher', value: 'CaseACocher' },
]

const form = ref({
  name: '',
  description: '',
  type: 'Texte',
  isRequired: false,
  position: 0,
  quotaIds: [] as number[],
  returnableItemIds: [] as number[],
})

const choicesText = ref('')

// Charger les quotas et items disponibles
const quotas = ref<any[]>([])
const returnableItems = ref<any[]>([])

const loadQuotasAndItems = async () => {
  try {
    const [quotasData, itemsData] = await Promise.all([
      $fetch(`/api/editions/${props.editionId}/ticketing/quotas`),
      $fetch(`/api/editions/${props.editionId}/ticketing/returnable-items`),
    ])
    quotas.value = quotasData
    returnableItems.value = itemsData
  } catch (error) {
    console.error('Failed to load quotas and items:', error)
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
        }
        choicesText.value = props.option.choices?.join('\n') || ''
      } else {
        // Mode création
        form.value = {
          name: '',
          description: '',
          type: 'Texte',
          isRequired: false,
          position: 0,
          quotaIds: [],
          returnableItemIds: [],
        }
        choicesText.value = ''
      }
    }
  }
)

const handleSubmit = async () => {
  const toast = useToast()

  if (!form.value.name.trim()) {
    toast.add({
      title: 'Erreur',
      description: "Le nom de l'option est obligatoire",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  saving.value = true
  try {
    const data = {
      name: form.value.name.trim(),
      description: form.value.description.trim() || null,
      type: form.value.type,
      isRequired: form.value.isRequired,
      position: form.value.position,
      choices:
        form.value.type === 'ChoixMultiple' || form.value.type === 'ChoixUnique'
          ? choicesText.value.split('\n').filter((c) => c.trim())
          : null,
      quotaIds: form.value.quotaIds,
      returnableItemIds: form.value.returnableItemIds,
    }

    if (props.option) {
      // Mode édition
      await updateOption(props.editionId, props.option.id, data)
      toast.add({
        title: 'Option modifiée',
        description: "L'option a été modifiée avec succès",
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else {
      // Mode création
      await createOption(props.editionId, data)
      toast.add({
        title: 'Option créée',
        description: "L'option a été créée avec succès",
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }

    emit('saved')
    isOpen.value = false
  } catch (error: any) {
    console.error('Failed to save option:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible d'enregistrer l'option",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
