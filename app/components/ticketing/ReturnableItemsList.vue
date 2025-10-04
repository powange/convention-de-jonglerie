<template>
  <!-- Chargement -->
  <div v-if="loading" class="text-center py-12">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
    <p class="text-sm text-gray-500 mt-2">Chargement...</p>
  </div>

  <div v-else class="space-y-4">
    <!-- Message d'information -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="soft"
      title="Articles à remettre aux participants"
      description="Listez ici les articles à remettre à l'accueil lors de la validation ou de l'achat d'un billet (bracelets, pass camping, goodies, etc.)"
    />

    <div class="space-y-2">
      <!-- Liste des items existants -->
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <UInput
          :model-value="item.name"
          placeholder="Nom de l'item"
          class="flex-1"
          @blur="updateItem(item.id, $event.target.value)"
        />
        <UButton
          icon="i-heroicons-trash"
          color="error"
          variant="ghost"
          size="xs"
          @click="confirmDeleteItem(item)"
        />
      </div>

      <!-- Ligne d'ajout -->
      <div class="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <UInput
          v-model="form.name"
          placeholder="Nouvel item..."
          class="flex-1"
          @keydown.enter="handleSave"
        />
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          variant="ghost"
          size="xs"
          :loading="saving"
          @click="handleSave"
        />
      </div>
    </div>
  </div>

  <!-- Modal de confirmation de suppression d'item à restituer -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    title="Supprimer l'item"
    :description="`Êtes-vous sûr de vouloir supprimer l'item '${itemToDelete?.name}' ?`"
    confirm-label="Supprimer"
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
interface ReturnableItem {
  id: number
  name: string
}

interface ReturnableItemForm {
  name: string
}

const props = defineProps<{
  items: ReturnableItem[]
  loading: boolean
  editionId: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const saving = ref(false)
const deleteConfirmOpen = ref(false)
const itemToDelete = ref<ReturnableItem | null>(null)
const deleting = ref(false)

const form = ref<ReturnableItemForm>({
  name: '',
})

const confirmDeleteItem = (item: ReturnableItem) => {
  itemToDelete.value = item
  deleteConfirmOpen.value = true
}

const deleteItem = async () => {
  if (!itemToDelete.value) return

  const toast = useToast()
  deleting.value = true
  try {
    await $fetch(
      `/api/editions/${props.editionId}/ticketing/returnable-items/${itemToDelete.value.id}`,
      {
        method: 'DELETE',
      }
    )

    toast.add({
      title: 'Item supprimé',
      description: "L'item à restituer a été supprimé avec succès",
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    deleteConfirmOpen.value = false
    itemToDelete.value = null
    emit('refresh')
  } catch (error: any) {
    console.error('Failed to delete returnable item:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible de supprimer l'item",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}

const updateItem = async (itemId: number, name: string) => {
  const toast = useToast()

  if (!name.trim()) {
    toast.add({
      title: 'Erreur',
      description: 'Le nom est obligatoire',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  try {
    await $fetch(`/api/editions/${props.editionId}/ticketing/returnable-items/${itemId}`, {
      method: 'PUT',
      body: { name: name.trim() },
    })

    emit('refresh')
  } catch (error: any) {
    console.error('Failed to update returnable item:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible de mettre à jour l'item",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

const handleSave = async () => {
  const toast = useToast()

  if (!form.value.name.trim()) {
    toast.add({
      title: 'Erreur',
      description: 'Le nom est obligatoire',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/ticketing/returnable-items`, {
      method: 'POST',
      body: { name: form.value.name.trim() },
    })

    toast.add({
      title: 'Item créé',
      description: "L'item à restituer a été créé avec succès",
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    form.value.name = ''
    emit('refresh')
  } catch (error: any) {
    console.error('Failed to save returnable item:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible d'enregistrer l'item",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
