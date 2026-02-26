<template>
  <!-- Bouton ajouter un tarif -->
  <div class="mb-4 flex justify-end">
    <UButton icon="i-heroicons-plus" color="primary" @click="openTierModal()">
      Ajouter un tarif
    </UButton>
  </div>

  <!-- Liste des tarifs -->
  <div v-if="loading" class="text-center py-12">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
    <p class="text-sm text-gray-500 mt-2">{{ $t('ticketing.tiers.list.loading') }}</p>
  </div>

  <div v-else-if="tiers.length === 0" class="text-center py-12">
    <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-300 mb-3 mx-auto" />
    <p class="text-sm text-gray-500">{{ $t('ticketing.tiers.list.none_found') }}</p>
    <p class="text-xs text-gray-400 mt-1">
      Ajoutez un tarif manuel ou synchronisez depuis votre billeterie externe
    </p>
  </div>

  <div v-else>
    <UTable
      :data="sortedTiers"
      :columns="columns"
      :loading="loading"
      class="border border-accented"
    >
      <!-- Colonne Position avec drag handle -->
      <template #position-cell="{ row }">
        <div
          class="flex items-center gap-2 cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          draggable="true"
          :title="$t('ticketing.tiers.list.drag_to_reorder')"
          @dragstart="handleDragStart(row.original, $event)"
          @dragend="handleDragEnd"
          @dragover.prevent="handleDragOver(row.original, $event)"
          @drop="handleDrop(row.original, $event)"
        >
          <UIcon name="i-heroicons-bars-3" class="h-5 w-5" />
          <span class="text-sm font-medium text-gray-500 dark:text-gray-400">
            {{ row.index + 1 }}
          </span>
        </div>
      </template>

      <!-- Colonne Titre avec description en popover -->
      <template #title-cell="{ row }">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-gray-900 dark:text-white">
              {{ row.original.name }}
            </span>
            <img
              v-if="row.original.helloAssoTierId"
              src="~/assets/img/helloasso/logo.svg"
              :alt="$t('ticketing.tiers.list.logo_alt')"
              class="h-4 w-auto flex-shrink-0"
              :title="`Synchronisé depuis HelloAsso (ID: ${row.original.helloAssoTierId})`"
            />
            <UBadge v-if="!row.original.isActive" color="neutral" variant="soft" size="xs">
              {{ $t('ticketing.tiers.list.inactive') }}
            </UBadge>
          </div>
          <div v-if="row.original.description">
            <UPopover>
              <div class="flex items-center gap-1 cursor-pointer">
                <span class="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 max-w-xs">
                  {{ row.original.description }}
                </span>
                <UIcon
                  name="i-heroicons-information-circle"
                  class="h-3.5 w-3.5 text-gray-400 flex-shrink-0"
                />
              </div>
              <template #content>
                <div class="p-3 max-w-md">
                  <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {{ row.original.description }}
                  </p>
                </div>
              </template>
            </UPopover>
          </div>
        </div>
      </template>

      <!-- Colonne Prix -->
      <template #price-cell="{ row }">
        <div class="flex flex-col items-start">
          <!-- Prix fixe -->
          <div v-if="isFixedPrice(row.original)" class="flex items-baseline gap-1">
            <span
              class="text-lg font-bold"
              :class="
                row.original.isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
              "
            >
              {{ (row.original.price / 100).toFixed(2) }}
            </span>
            <span class="text-xs text-gray-500">€</span>
          </div>
          <!-- Prix libre -->
          <div v-else class="flex flex-col gap-1">
            <span
              class="text-sm font-semibold"
              :class="
                row.original.isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
              "
            >
              Prix libre
            </span>
            <div class="text-xs text-gray-500">
              <span v-if="row.original.minAmount != null"
                >Min: {{ (row.original.minAmount / 100).toFixed(2) }}€</span
              >
              <span v-if="row.original.minAmount != null && row.original.maxAmount != null">
                •
              </span>
              <span v-if="row.original.maxAmount != null"
                >Max: {{ (row.original.maxAmount / 100).toFixed(2) }}€</span
              >
            </div>
          </div>
        </div>
      </template>

      <!-- Colonne Date de début -->
      <template #validFrom-cell="{ row }">
        <span v-if="row.original.validFrom" class="text-sm text-gray-700 dark:text-gray-300">
          {{ formatDateTimeWithWeekday(row.original.validFrom) }}
        </span>
        <span v-else class="text-xs text-gray-400">-</span>
      </template>

      <!-- Colonne Date de fin -->
      <template #validUntil-cell="{ row }">
        <span v-if="row.original.validUntil" class="text-sm text-gray-700 dark:text-gray-300">
          {{ formatDateTimeWithWeekday(row.original.validUntil) }}
        </span>
        <span v-else class="text-xs text-gray-400">-</span>
      </template>

      <!-- Colonne Nombre de tickets -->
      <template #tickets-cell="{ row }">
        <div
          class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md"
          :class="
            row.original.soldCount && row.original.soldCount > 0
              ? 'bg-success-50 dark:bg-success-900/20'
              : 'bg-gray-50 dark:bg-gray-800'
          "
        >
          <UIcon
            name="i-heroicons-ticket"
            class="h-3.5 w-3.5"
            :class="
              row.original.soldCount && row.original.soldCount > 0
                ? 'text-success-600 dark:text-success-400'
                : 'text-gray-400'
            "
          />
          <span
            class="text-sm font-semibold"
            :class="
              row.original.soldCount && row.original.soldCount > 0
                ? 'text-success-700 dark:text-success-400'
                : 'text-gray-500'
            "
          >
            {{ row.original.soldCount || 0 }}
          </span>
        </div>
      </template>

      <!-- Colonne Quotas -->
      <template #quotas-cell="{ row }">
        <div
          v-if="row.original.quotas && row.original.quotas.length > 0"
          class="flex flex-wrap gap-1"
        >
          <UBadge
            v-for="quotaRelation in row.original.quotas"
            :key="quotaRelation.quota.id"
            color="warning"
            variant="soft"
            size="xs"
          >
            {{ quotaRelation.quota.title }}
          </UBadge>
        </div>
        <span v-else class="text-xs text-gray-400">-</span>
      </template>

      <!-- Colonne Articles à restituer -->
      <template #returnableItems-cell="{ row }">
        <div
          v-if="row.original.returnableItems && row.original.returnableItems.length > 0"
          class="flex flex-wrap gap-1"
        >
          <UBadge
            v-for="itemRelation in row.original.returnableItems"
            :key="itemRelation.returnableItem.id"
            color="info"
            variant="soft"
            size="xs"
          >
            {{ itemRelation.returnableItem.name }}
          </UBadge>
        </div>
        <span v-else class="text-xs text-gray-400">-</span>
      </template>

      <!-- Colonne Repas -->
      <template #meals-cell="{ row }">
        <div
          v-if="row.original.meals && row.original.meals.length > 0"
          class="flex flex-wrap gap-1"
        >
          <UBadge
            v-for="mealRelation in row.original.meals"
            :key="mealRelation.meal.id"
            color="success"
            variant="soft"
            size="xs"
          >
            {{ formatMealDisplay(mealRelation.meal) }}
          </UBadge>
        </div>
        <span v-else class="text-xs text-gray-400">-</span>
      </template>

      <!-- Colonne Actions -->
      <template #actions-cell="{ row }">
        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-pencil"
            color="primary"
            variant="ghost"
            size="sm"
            @click="openTierModal(row.original)"
          />
          <UButton
            v-if="!row.original.helloAssoTierId"
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="sm"
            @click="confirmDeleteTier(row.original)"
          />
        </div>
      </template>
    </UTable>
  </div>

  <!-- Modal pour ajouter/modifier un tarif -->
  <TicketingTierModal
    v-model:open="tierModalOpen"
    :tier="selectedTier"
    :edition-id="editionId"
    @saved="handleTierSaved"
  />

  <!-- Modal de confirmation de suppression de tarif -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    title="Supprimer le tarif"
    :description="`Êtes-vous sûr de vouloir supprimer le tarif '${tierToDelete?.name}' ?`"
    confirm-label="Supprimer"
    confirm-color="error"
    confirm-icon="i-heroicons-trash"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-red-500"
    :loading="deleting"
    @confirm="deleteTierAction"
    @cancel="deleteConfirmOpen = false"
  />
</template>

<script setup lang="ts">
import { formatMealDisplay } from '~/utils/meals'
import { isFixedPrice, type TicketingTier } from '~/utils/ticketing/tiers'

import type { TableColumn } from '@nuxt/ui'

const props = defineProps<{
  tiers: TicketingTier[]
  loading: boolean
  editionId: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const tierModalOpen = ref(false)
const selectedTier = ref<TicketingTier | null>(null)
const deleteConfirmOpen = ref(false)
const tierToDelete = ref<TicketingTier | null>(null)

// Drag and drop
const draggedTierId = ref<number | null>(null)
const dragOverTierId = ref<number | null>(null)
const sortedTiers = ref<TicketingTier[]>([])

// Définition des colonnes
const columns = computed((): TableColumn<TicketingTier>[] => [
  {
    id: 'position',
    header: '#',
    size: 80,
  },
  {
    id: 'title',
    header: 'Titre',
    size: 250,
  },
  {
    id: 'price',
    header: 'Tarif',
    size: 120,
  },
  {
    id: 'validFrom',
    header: 'Début de validité',
    size: 150,
  },
  {
    id: 'validUntil',
    header: 'Fin de validité',
    size: 150,
  },
  {
    id: 'tickets',
    header: 'Billets',
    size: 100,
  },
  {
    id: 'quotas',
    header: 'Quotas',
    size: 150,
  },
  {
    id: 'returnableItems',
    header: 'Articles à restituer',
    size: 150,
  },
  {
    id: 'meals',
    header: 'Repas',
    size: 150,
  },
  {
    id: 'actions',
    header: 'Actions',
    size: 120,
  },
])

// Initialiser sortedTiers avec les props.tiers
watch(
  () => props.tiers,
  (newTiers) => {
    sortedTiers.value = [...newTiers]
  },
  { immediate: true }
)

const handleDragStart = (tier: TicketingTier, event: DragEvent) => {
  draggedTierId.value = tier.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/html', '')
  }
}

const handleDragEnd = () => {
  draggedTierId.value = null
  dragOverTierId.value = null
}

const handleDragOver = (tier: TicketingTier, _event: DragEvent) => {
  dragOverTierId.value = tier.id
}

const handleDrop = async (targetTier: TicketingTier, event: DragEvent) => {
  event.preventDefault()

  if (!draggedTierId.value || draggedTierId.value === targetTier.id) {
    draggedTierId.value = null
    dragOverTierId.value = null
    return
  }

  const draggedIndex = sortedTiers.value.findIndex((t) => t.id === draggedTierId.value)
  const targetIndex = sortedTiers.value.findIndex((t) => t.id === targetTier.id)

  if (draggedIndex === -1 || targetIndex === -1) {
    draggedTierId.value = null
    dragOverTierId.value = null
    return
  }

  // Réorganiser localement
  const newTiers = [...sortedTiers.value]
  const [draggedTier] = newTiers.splice(draggedIndex, 1)
  newTiers.splice(targetIndex, 0, draggedTier)
  sortedTiers.value = newTiers

  // Mettre à jour les positions en base de données
  await updateTiersPositions(newTiers)

  draggedTierId.value = null
  dragOverTierId.value = null
}

const reorderPositions = ref<{ id: number; position: number }[]>([])

const { execute: executeReorder } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/tiers/reorder`,
  {
    method: 'PUT',
    body: () => ({ positions: reorderPositions.value }),
    successMessage: {
      title: 'Ordre mis à jour',
      description: "L'ordre des tarifs a été enregistré",
    },
    errorMessages: { default: "Impossible de mettre à jour l'ordre des tarifs" },
    emitOnSuccess: () => emit('refresh'),
  }
)

const updateTiersPositions = (tiers: TicketingTier[]) => {
  reorderPositions.value = tiers.map((tier, index) => ({
    id: tier.id,
    position: index,
  }))
  executeReorder()
}

const openTierModal = (tier?: TicketingTier) => {
  selectedTier.value = tier || null
  tierModalOpen.value = true
}

const handleTierSaved = () => {
  emit('refresh')
}

const confirmDeleteTier = (tier: TicketingTier) => {
  tierToDelete.value = tier
  deleteConfirmOpen.value = true
}

const { execute: executeDeleteTier, loading: deleting } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/tiers/${tierToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: {
      title: 'Tarif supprimé',
      description: 'Le tarif a été supprimé avec succès',
    },
    errorMessages: { default: 'Impossible de supprimer le tarif' },
    onSuccess: () => {
      deleteConfirmOpen.value = false
      tierToDelete.value = null
      emit('refresh')
    },
  }
)

const deleteTierAction = () => {
  if (!tierToDelete.value) return
  executeDeleteTier()
}

const { formatDateTimeWithWeekday } = useDateFormat()
</script>
