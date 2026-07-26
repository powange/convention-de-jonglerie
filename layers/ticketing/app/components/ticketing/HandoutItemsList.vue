<template>
  <!-- Chargement -->
  <div v-if="loading" class="text-center py-12">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
    <p class="text-sm text-gray-500 mt-2">{{ $t('ticketing.handout_items.list.loading') }}</p>
  </div>

  <div v-else class="space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
      <!-- Liste des items existants -->
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <UFieldGroup class="w-full">
          <UInput
            :model-value="item.name"
            :placeholder="$t('ticketing.handout_items.list.name_placeholder')"
            class="flex-1"
            @blur="updateItem(item.id, $event.target.value)"
          />
          <UCheckbox
            :model-value="item.cumulative"
            variant="card"
            indicator="hidden"
            size="sm"
            :label="$t('ticketing.handout_items.list.cumulative_short')"
            :ui="{
              root: 'rounded-none py-0 px-3 self-stretch items-center whitespace-nowrap',
              wrapper: 'text-xs',
            }"
            @update:model-value="updateItemCumulative(item, $event === true)"
          />
          <UButton icon="i-heroicons-trash" color="error" @click="confirmDeleteItem(item)" />
        </UFieldGroup>
      </div>

      <!-- Ligne d'ajout -->
      <div class="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <UFieldGroup class="w-full">
          <UInput
            v-model="form.name"
            :placeholder="$t('ticketing.handout_items.list.add_placeholder')"
            class="flex-1"
            @keydown.enter="handleSave"
          />
          <UCheckbox
            v-model="form.cumulative"
            variant="card"
            indicator="hidden"
            size="sm"
            :label="$t('ticketing.handout_items.list.cumulative_short')"
            :ui="{
              root: 'rounded-none py-0 px-3 self-stretch items-center whitespace-nowrap',
              wrapper: 'text-xs',
            }"
          />
          <UButton icon="i-heroicons-plus" color="primary" :loading="saving" @click="handleSave" />
        </UFieldGroup>
      </div>
    </div>

    <p class="text-xs text-gray-500 dark:text-gray-400">
      {{ $t('ticketing.handout_items.list.cumulative_help') }}
    </p>
  </div>

  <!-- Modal de confirmation de suppression d'item à remettre -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    :title="$t('ticketing.handout_items.list.delete_title')"
    :description="`Êtes-vous sûr de vouloir supprimer l'item '${itemToDelete?.name}' ?`"
    :confirm-label="$t('ticketing.handout_items.list.delete_label')"
    confirm-color="error"
    confirm-icon="i-heroicons-trash"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-red-500"
    :loading="deleting"
    @confirm="deleteItem"
    @cancel="deleteConfirmOpen = false"
  />
</template>

<script setup lang="ts">
interface TicketingHandoutItem {
  id: number
  name: string
  cumulative?: boolean
}

interface HandoutItemForm {
  name: string
  cumulative: boolean
}

const props = defineProps<{
  items: TicketingHandoutItem[]
  loading: boolean
  editionId: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const toast = useToast()
const deleteConfirmOpen = ref(false)
const itemToDelete = ref<TicketingHandoutItem | null>(null)

const form = ref<HandoutItemForm>({
  name: '',
  cumulative: false,
})

const confirmDeleteItem = (item: TicketingHandoutItem) => {
  itemToDelete.value = item
  deleteConfirmOpen.value = true
}

const { execute: executeDeleteItem, loading: deleting } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/handout-items/${itemToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: {
      title: 'Item supprimé',
      description: "L'item à remettre a été supprimé avec succès",
    },
    errorMessages: { default: "Impossible de supprimer l'item" },
    onSuccess: () => {
      deleteConfirmOpen.value = false
      itemToDelete.value = null
      emit('refresh')
    },
  }
)

const deleteItem = () => {
  if (!itemToDelete.value) return
  executeDeleteItem()
}

// L'API exige toujours le nom : on envoie le couple (nom, cumulable) à chaque mise à jour.
const pendingUpdate = ref<{ name: string; cumulative: boolean }>({ name: '', cumulative: false })

const { execute: executeUpdateItem } = useApiActionById(
  (itemId) => `/api/editions/${props.editionId}/ticketing/handout-items/${itemId}`,
  {
    method: 'PUT',
    body: () => ({ ...pendingUpdate.value }),
    silentSuccess: true,
    errorMessages: { default: "Impossible de mettre à jour l'item" },
    onSuccess: () => {
      emit('refresh')
    },
  }
)

const updateItem = (itemId: number, name: string) => {
  if (!name.trim()) {
    toast.add({
      title: 'Erreur',
      description: 'Le nom est obligatoire',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }
  const current = props.items.find((i) => i.id === itemId)
  pendingUpdate.value = { name: name.trim(), cumulative: current?.cumulative ?? false }
  executeUpdateItem(itemId)
}

// Bascule le caractère cumulable d'un article existant (sauvegarde immédiate).
const updateItemCumulative = (item: TicketingHandoutItem, cumulative: boolean) => {
  pendingUpdate.value = { name: item.name, cumulative }
  executeUpdateItem(item.id)
}

const { execute: executeHandleSave, loading: saving } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/handout-items`,
  {
    method: 'POST',
    body: () => ({ name: form.value.name.trim(), cumulative: form.value.cumulative }),
    successMessage: {
      title: 'Item créé',
      description: "L'item à remettre a été créé avec succès",
    },
    errorMessages: { default: "Impossible d'enregistrer l'item" },
    onSuccess: () => {
      form.value.name = ''
      form.value.cumulative = false
      emit('refresh')
    },
  }
)

const handleSave = () => {
  if (!form.value.name.trim()) {
    toast.add({
      title: 'Erreur',
      description: 'Le nom est obligatoire',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }
  executeHandleSave()
}
</script>
