<script setup lang="ts">
// Modal de gestion des articles à remettre à TOUS les artistes de l'édition.
// Les articles propres à un spectacle sont gérés séparément (ShowsManageHandoutItemsModal).
const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  editionId: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['update:open', 'itemsUpdated'])

const { t } = useI18n()

const isLoadingData = ref(false)
const availableItems = ref<any[]>([])
const assignedItems = ref<any[]>([])
const selectedItemId = ref<number | null>(null)
const deleteConfirmOpen = ref(false)
const itemToDelete = ref<{ id: number; name: string } | null>(null)

async function loadData() {
  if (!props.open) return

  isLoadingData.value = true
  try {
    // Articles à remettre définis sur l'édition
    const itemsResponse = await $fetch<any>(
      `/api/editions/${props.editionId}/ticketing/handout-items`
    )
    availableItems.value = itemsResponse.data?.handoutItems || []

    // Articles déjà associés à tous les artistes
    const assignedResponse = await $fetch<any>(
      `/api/editions/${props.editionId}/ticketing/artists/handout-items`
    )
    assignedItems.value = assignedResponse.items || []
  } catch (error) {
    console.error('Erreur lors du chargement des articles:', error)
  } finally {
    isLoadingData.value = false
  }
}

const { execute: executeAddItem, loading: isAdding } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/artists/handout-items`,
  {
    method: 'POST',
    body: () => ({ handoutItemId: selectedItemId.value }),
    successMessage: { title: t('gestion.organizers.item_added_success') },
    errorMessages: { default: t('gestion.organizers.error_adding_item') },
    onSuccess: async () => {
      selectedItemId.value = null
      await loadData()
      emit('itemsUpdated')
    },
  }
)

function addItem() {
  if (!selectedItemId.value) return
  executeAddItem()
}

function confirmRemoveItem(item: any) {
  itemToDelete.value = { id: item.id, name: item.handoutItemName }
  deleteConfirmOpen.value = true
}

const { execute: executeRemoveItem, loading: isRemoving } = useApiAction(
  () =>
    `/api/editions/${props.editionId}/ticketing/artists/handout-items/${itemToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.organizers.item_removed_success') },
    errorMessages: { default: t('gestion.organizers.error_removing_item') },
    onSuccess: async () => {
      deleteConfirmOpen.value = false
      itemToDelete.value = null
      await loadData()
      emit('itemsUpdated')
    },
  }
)

function removeItem() {
  if (!itemToDelete.value) return
  executeRemoveItem()
}

const loading = computed(() => isLoadingData.value || isAdding.value || isRemoving.value)

// Articles encore assignables (non déjà associés à tous les artistes)
const availableForSelection = computed(() => {
  const assignedIds = new Set(assignedItems.value.map((item) => item.handoutItemId))
  return availableItems.value
    .filter((item) => !assignedIds.has(item.id))
    .map((item) => ({ label: item.name, value: item.id }))
})

watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      loadData()
    } else {
      selectedItemId.value = null
    }
  }
)
</script>

<template>
  <UModal
    :open="open"
    :title="$t('gestion.ticketing.all_artists_handout_items')"
    :ui="{ wrapper: 'sm:max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto h-8 w-8" />
      </div>

      <div v-else class="space-y-6">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.ticketing.all_artists_handout_items_help') }}
        </p>

        <!-- Formulaire d'ajout -->
        <div class="space-y-4">
          <UFormField :label="$t('gestion.organizers.add_handout_item')">
            <div class="flex gap-2">
              <USelect
                v-model="selectedItemId"
                :items="availableForSelection"
                :placeholder="$t('gestion.organizers.select_handout_item')"
                class="flex-1"
                :disabled="availableForSelection.length === 0"
              />
              <UButton
                color="primary"
                icon="i-heroicons-plus"
                :disabled="!selectedItemId || loading"
                @click="addItem"
              >
                {{ $t('common.add') }}
              </UButton>
            </div>
          </UFormField>

          <p
            v-if="availableForSelection.length === 0 && availableItems.length === 0"
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            {{ $t('gestion.organizers.no_handout_items_created') }}
          </p>
          <p
            v-else-if="availableForSelection.length === 0"
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            {{ $t('gestion.organizers.no_items_available') }}
          </p>
        </div>

        <!-- Liste des articles assignés -->
        <div class="space-y-2">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('gestion.organizers.assigned_items') }}
          </h4>

          <div v-if="assignedItems.length > 0" class="space-y-2">
            <div
              v-for="item in assignedItems"
              :key="item.id"
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-gift" class="text-orange-500" />
                <span class="text-sm">{{ item.handoutItemName }}</span>
              </div>
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                icon="i-heroicons-trash"
                :disabled="loading"
                @click="confirmRemoveItem(item)"
              >
                {{ $t('common.delete') }}
              </UButton>
            </div>
          </div>

          <div v-else class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <UIcon name="i-heroicons-gift" class="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p class="text-sm text-gray-500">
              {{ $t('gestion.organizers.no_assigned_items') }}
            </p>
          </div>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal de confirmation de suppression -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    :title="$t('common.delete')"
    :description="
      itemToDelete ? `${$t('gestion.organizers.confirm_remove_item')}\n${itemToDelete.name}` : ''
    "
    :confirm-label="$t('common.delete')"
    confirm-color="error"
    confirm-icon="i-heroicons-trash"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-red-500"
    :loading="loading"
    @confirm="removeItem"
    @cancel="deleteConfirmOpen = false"
  />
</template>
