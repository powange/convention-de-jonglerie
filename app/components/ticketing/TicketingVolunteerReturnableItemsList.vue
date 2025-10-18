<template>
  <!-- Chargement -->
  <div v-if="loading" class="flex flex-col items-center justify-center py-16">
    <UIcon name="i-heroicons-arrow-path" class="h-10 w-10 text-purple-500 animate-spin mb-3" />
    <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
      Chargement des articles bénévoles...
    </p>
  </div>

  <div v-else class="space-y-6">
    <!-- Liste des items existants -->
    <div v-if="items.length > 0">
      <TransitionGroup
        name="list"
        tag="div"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-all duration-200 ease-in absolute"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-for="item in items"
          :key="item.id"
          class="group relative flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200 dark:border-purple-800/30 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700/50 transition-all duration-200"
        >
          <!-- Icône -->
          <div
            class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/60 transition-colors"
          >
            <UIcon name="i-heroicons-gift" class="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>

          <!-- Nom de l'article -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white break-words">
              {{ item.name }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {{ $t('ticketing.returnable_items.volunteer.given_to_all') }}
            </p>
          </div>

          <!-- Bouton supprimer -->
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="xs"
            square
            class="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            @click="confirmDeleteItem(item)"
          />
        </div>
      </TransitionGroup>
    </div>

    <!-- Message si aucun item -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-2 border-dashed border-gray-300 dark:border-gray-700"
    >
      <div
        class="flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4"
      >
        <UIcon name="i-heroicons-gift" class="h-8 w-8 text-purple-400 dark:text-purple-500" />
      </div>
      <p class="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
        Aucun article configuré
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
        Sélectionnez un article ci-dessous pour le remettre automatiquement à tous les bénévoles
      </p>
    </div>

    <!-- Section d'ajout -->
    <div class="pt-2">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Ajouter un article pour les bénévoles
      </label>
      <UFieldGroup>
        <USelect
          v-model="selectedItemId"
          :items="availableReturnableItems"
          :placeholder="$t('ticketing.returnable_items.volunteer.choose_placeholder')"
          size="lg"
          :disabled="availableReturnableItems.length === 0"
        />
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          size="lg"
          :loading="saving"
          :disabled="!selectedItemId"
          @click="handleAdd"
        >
          Ajouter
        </UButton>
      </UFieldGroup>
      <p
        v-if="availableReturnableItems.length === 0"
        class="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
      >
        <UIcon name="i-heroicons-information-circle" class="h-4 w-4" />
        Tous les articles disponibles sont déjà associés aux bénévoles
      </p>
    </div>
  </div>

  <!-- Modal de confirmation de suppression -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    :title="$t('ticketing.returnable_items.volunteer.remove_title')"
    :description="`L'article '${itemToDelete?.name}' ne sera plus remis automatiquement aux bénévoles lors de leur validation d'accès.`"
    :confirm-label="$t('ticketing.returnable_items.volunteer.remove_label')"
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

interface TicketingReturnableItem {
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
const allReturnableItems = ref<TicketingReturnableItem[]>([])

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
