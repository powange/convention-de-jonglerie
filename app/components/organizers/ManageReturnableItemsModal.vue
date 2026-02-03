<script setup lang="ts">
import type { PropType } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  editionId: {
    type: Number,
    required: true,
  },
  organizer: {
    type: Object as PropType<any>,
    default: null,
  },
})

const emit = defineEmits(['update:open', 'itemsUpdated'])

const { t } = useI18n()

// État
const isLoadingData = ref(false)
const availableItems = ref<any[]>([])
const assignedItems = ref<any[]>([])
const globalItems = ref<any[]>([]) // Articles globaux (pour tous les organisateurs)
const selectedItemId = ref<number | null>(null)
const deleteConfirmOpen = ref(false)
const itemToDelete = ref<{ id: number; name: string } | null>(null)

// Titre du modal
const modalTitle = computed(() => {
  if (!props.organizer) return t('gestion.organizers.global_returnable_items')

  // Vérification de sécurité pour éviter les erreurs si la structure est incomplète
  if (!props.organizer?.user) {
    return t('gestion.organizers.manage_articles')
  }

  const user = props.organizer.user
  const displayName = user.pseudo || `${user.prenom} ${user.nom}`
  return t('gestion.organizers.manage_articles_for', { name: displayName })
})

// Charger les données
async function loadData() {
  if (!props.open) return

  isLoadingData.value = true
  try {
    // Charger tous les articles à restituer de l'édition
    const itemsResponse = await $fetch(
      `/api/editions/${props.editionId}/ticketing/returnable-items`
    )
    // L'API retourne { success: true, returnableItems: [...] }
    availableItems.value = itemsResponse.returnableItems || []

    // Charger les articles déjà assignés
    const assignedResponse = await $fetch(
      `/api/editions/${props.editionId}/ticketing/organizers/returnable-items`
    )

    const allAssignedItems = assignedResponse.items || []

    const organizerId = props.organizer?.id ?? null

    // Toujours stocker les articles globaux
    globalItems.value = allAssignedItems.filter((item: any) => item.organizerId === null)

    if (organizerId === null) {
      // Mode global : on affiche uniquement les articles globaux
      assignedItems.value = globalItems.value
    } else {
      // Mode organisateur spécifique : on affiche les articles de cet organisateur
      assignedItems.value = allAssignedItems.filter((item: any) => item.organizerId === organizerId)
    }
  } catch (error) {
    console.error('Erreur lors du chargement des articles:', error)
  } finally {
    isLoadingData.value = false
  }
}

// Action pour ajouter un article
const { execute: executeAddItem, loading: isAdding } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/organizers/returnable-items`,
  {
    method: 'POST',
    body: () => ({
      returnableItemId: selectedItemId.value,
      organizerId: props.organizer?.id ?? null,
    }),
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

// Confirmation de suppression d'un article
function confirmRemoveItem(item: any) {
  itemToDelete.value = {
    id: item.id,
    name: item.returnableItemName,
  }
  deleteConfirmOpen.value = true
}

// Action pour retirer un article
const { execute: executeRemoveItem, loading: isRemoving } = useApiAction(
  () =>
    `/api/editions/${props.editionId}/ticketing/organizers/returnable-items/${itemToDelete.value?.id}`,
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

// État de chargement combiné
const loading = computed(() => isLoadingData.value || isAdding.value || isRemoving.value)

// Articles disponibles pour sélection (non encore assignés)
const availableForSelection = computed(() => {
  // IDs des articles déjà assignés à cet organisateur
  const assignedIds = new Set(assignedItems.value.map((item) => item.returnableItemId))

  // IDs des articles globaux (à exclure pour les organisateurs spécifiques)
  const globalIds = new Set(globalItems.value.map((item) => item.returnableItemId))

  return availableItems.value
    .filter((item) => {
      // Exclure les articles déjà assignés à cet organisateur/global
      if (assignedIds.has(item.id)) {
        return false
      }

      // Si on est en mode organisateur spécifique, exclure aussi les articles globaux
      if (props.organizer?.id && globalIds.has(item.id)) {
        return false
      }

      return true
    })
    .map((item) => ({
      label: item.name,
      value: item.id,
    }))
})

// Charger les données quand le modal s'ouvre
watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      loadData()
    } else {
      // Réinitialiser l'état quand le modal se ferme
      selectedItemId.value = null
    }
  }
)
</script>

<template>
  <UModal
    :open="open"
    :title="modalTitle"
    :ui="{ wrapper: 'sm:max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto h-8 w-8" />
      </div>

      <div v-else class="space-y-6">
        <!-- Formulaire d'ajout -->
        <div class="space-y-4">
          <UFormField :label="$t('gestion.organizers.add_returnable_item')">
            <div class="flex gap-2">
              <USelect
                v-model="selectedItemId"
                :items="availableForSelection"
                :placeholder="$t('gestion.organizers.select_returnable_item')"
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
            {{ $t('gestion.organizers.no_returnable_items_created') }}
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
                <span class="text-sm">{{ item.returnableItemName }}</span>
              </div>
              <UButton
                color="red"
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
