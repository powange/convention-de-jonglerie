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
          <UButton icon="i-heroicons-plus" color="primary" :loading="saving" @click="handleSave" />
        </UFieldGroup>
      </div>
    </div>
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
}

interface HandoutItemForm {
  name: string
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

const pendingUpdateName = ref('')

const { execute: executeUpdateItem } = useApiActionById(
  (itemId) => `/api/editions/${props.editionId}/ticketing/handout-items/${itemId}`,
  {
    method: 'PUT',
    body: () => ({ name: pendingUpdateName.value }),
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
  pendingUpdateName.value = name.trim()
  executeUpdateItem(itemId)
}

const { execute: executeHandleSave, loading: saving } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/handout-items`,
  {
    method: 'POST',
    body: () => ({ name: form.value.name.trim() }),
    successMessage: {
      title: 'Item créé',
      description: "L'item à remettre a été créé avec succès",
    },
    errorMessages: { default: "Impossible d'enregistrer l'item" },
    onSuccess: () => {
      form.value.name = ''
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
