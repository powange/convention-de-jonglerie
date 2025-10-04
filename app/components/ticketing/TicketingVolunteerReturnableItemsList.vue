<template>
  <!-- Chargement -->
  <div v-if="loading" class="text-center py-12">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
    <p class="text-sm text-gray-500 mt-2">Chargement...</p>
  </div>

  <div v-else class="space-y-4">
    <div class="space-y-2">
      <!-- Liste des items existants -->
      <template v-if="items.length > 0">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <UIcon name="i-heroicons-gift" class="h-5 w-5 text-gray-400" />
          <span class="flex-1 text-sm text-gray-900 dark:text-white">{{ item.name }}</span>
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="xs"
            @click="confirmDeleteItem(item)"
          />
        </div>
      </template>

      <!-- Message si aucun item -->
      <div v-else class="text-center py-8">
        <UIcon name="i-heroicons-gift" class="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto" />
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Aucun article à restituer pour les bénévoles
        </p>
      </div>

      <!-- Ligne d'ajout -->
      <div class="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <USelect
          v-model="selectedItemId"
          :items="availableReturnableItems"
          placeholder="Sélectionner un article..."
          class="flex-1"
        />
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          variant="ghost"
          size="xs"
          :loading="saving"
          :disabled="!selectedItemId"
          @click="handleAdd"
        />
      </div>
    </div>
  </div>

  <!-- Modal de confirmation de suppression -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    title="Retirer l'article"
    :description="`Êtes-vous sûr de vouloir retirer l'article '${itemToDelete?.name}' des articles à restituer pour les bénévoles ?`"
    confirm-label="Retirer"
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
interface VolunteerReturnableItem {
  id: number
  returnableItemId: number
  name: string
}

interface ReturnableItem {
  id: number
  name: string
}

const props = defineProps<{
  items: VolunteerReturnableItem[]
  loading: boolean
  editionId: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const saving = ref(false)
const deleteConfirmOpen = ref(false)
const itemToDelete = ref<VolunteerReturnableItem | null>(null)
const deleting = ref(false)
const selectedItemId = ref<number | null>(null)
const allReturnableItems = ref<ReturnableItem[]>([])

// Charger tous les articles à restituer disponibles
const loadAllReturnableItems = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/ticketing/returnable-items`)
    allReturnableItems.value = response
  } catch (error) {
    console.error('Failed to load all returnable items:', error)
  }
}

// Articles disponibles (non encore associés aux bénévoles)
const availableReturnableItems = computed(() => {
  const usedIds = props.items.map((item) => item.returnableItemId)
  return allReturnableItems.value
    .filter((item) => !usedIds.includes(item.id))
    .map((item) => ({
      label: item.name,
      value: item.id,
    }))
})

onMounted(() => {
  loadAllReturnableItems()
})

const confirmDeleteItem = (item: VolunteerReturnableItem) => {
  itemToDelete.value = item
  deleteConfirmOpen.value = true
}

const deleteItem = async () => {
  if (!itemToDelete.value) return

  const toast = useToast()
  deleting.value = true
  try {
    await $fetch(
      `/api/editions/${props.editionId}/ticketing/volunteers/returnable-items/${itemToDelete.value.id}`,
      {
        method: 'DELETE',
      }
    )

    toast.add({
      title: 'Article retiré',
      description: "L'article a été retiré des articles à restituer pour les bénévoles",
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    deleteConfirmOpen.value = false
    itemToDelete.value = null
    emit('refresh')
  } catch (error: any) {
    console.error('Failed to delete volunteer returnable item:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible de retirer l'article",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}

const handleAdd = async () => {
  if (!selectedItemId.value) return

  const toast = useToast()
  saving.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/ticketing/volunteers/returnable-items`, {
      method: 'POST',
      body: { returnableItemId: selectedItemId.value },
    })

    toast.add({
      title: 'Article ajouté',
      description: "L'article a été ajouté aux articles à restituer pour les bénévoles",
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    selectedItemId.value = null
    emit('refresh')
  } catch (error: any) {
    console.error('Failed to add volunteer returnable item:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible d'ajouter l'article",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
