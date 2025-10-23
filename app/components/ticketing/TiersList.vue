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

  <div v-else class="space-y-3">
    <UCard
      v-for="(tier, index) in sortedTiers"
      :key="tier.id"
      :class="[
        'transition-all duration-200',
        !tier.isActive && 'opacity-60',
        draggedTierId === tier.id && 'opacity-50',
        dragOverTierId === tier.id && 'border-primary-500 border-2',
      ]"
      draggable="true"
      @dragstart="handleDragStart(tier, $event)"
      @dragend="handleDragEnd"
      @dragover.prevent="handleDragOver(tier, $event)"
      @drop="handleDrop(tier, $event)"
    >
      <div class="flex items-center gap-4">
        <!-- Poignée de drag -->
        <div
          class="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Glisser pour réordonner"
        >
          <UIcon name="i-heroicons-bars-3" class="h-5 w-5" />
        </div>

        <!-- Numéro de position -->
        <div class="flex-shrink-0 w-8 text-center">
          <span class="text-sm font-medium text-gray-500 dark:text-gray-400">
            {{ index + 1 }}
          </span>
        </div>

        <!-- Informations principales -->
        <div class="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <!-- Nom et badges -->
          <div class="md:col-span-4 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-semibold text-gray-900 dark:text-white truncate" :title="tier.name">
                {{ tier.name }}
              </h3>
              <img
                v-if="tier.helloAssoTierId"
                src="~/assets/img/helloasso/logo.svg"
                :alt="$t('ticketing.tiers.list.logo_alt')"
                class="h-4 w-auto flex-shrink-0"
                :title="`Synchronisé depuis HelloAsso (ID: ${tier.helloAssoTierId})`"
              />
              <UBadge v-if="!tier.isActive" color="neutral" variant="soft" size="xs">
                {{ $t('ticketing.tiers.list.inactive') }}
              </UBadge>
            </div>
            <p
              v-if="tier.description"
              class="text-xs text-gray-600 dark:text-gray-400 line-clamp-1"
              :title="tier.description"
            >
              {{ tier.description }}
            </p>
          </div>

          <!-- Prix -->
          <div class="md:col-span-2">
            <div class="flex items-baseline gap-1">
              <span
                class="text-xl font-bold"
                :class="tier.isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'"
              >
                {{ (tier.price / 100).toFixed(2) }}
              </span>
              <span class="text-xs text-gray-500">€</span>
            </div>
            <div v-if="tier.minAmount || tier.maxAmount" class="text-xs text-gray-500 mt-1">
              <span v-if="tier.minAmount">Min: {{ (tier.minAmount / 100).toFixed(2) }}€</span>
              <span v-if="tier.minAmount && tier.maxAmount"> • </span>
              <span v-if="tier.maxAmount">Max: {{ (tier.maxAmount / 100).toFixed(2) }}€</span>
            </div>
          </div>

          <!-- Quotas -->
          <div class="md:col-span-2 min-w-0">
            <div v-if="tier.quotas && tier.quotas.length > 0" class="flex flex-wrap gap-1">
              <UBadge
                v-for="quotaRelation in tier.quotas.slice(0, 2)"
                :key="quotaRelation.quota.id"
                color="warning"
                variant="soft"
                size="xs"
              >
                {{ quotaRelation.quota.title }}
              </UBadge>
              <UBadge
                v-if="tier.quotas.length > 2"
                color="warning"
                variant="soft"
                size="xs"
                :title="tier.quotas.map((q) => q.quota.title).join(', ')"
              >
                +{{ tier.quotas.length - 2 }}
              </UBadge>
            </div>
            <span v-else class="text-xs text-gray-400">-</span>
          </div>

          <!-- Articles à restituer -->
          <div class="md:col-span-2 min-w-0">
            <div
              v-if="tier.returnableItems && tier.returnableItems.length > 0"
              class="flex flex-wrap gap-1"
            >
              <UBadge
                v-for="itemRelation in tier.returnableItems.slice(0, 2)"
                :key="itemRelation.returnableItem.id"
                color="info"
                variant="soft"
                size="xs"
              >
                {{ itemRelation.returnableItem.name }}
              </UBadge>
              <UBadge
                v-if="tier.returnableItems.length > 2"
                color="info"
                variant="soft"
                size="xs"
                :title="tier.returnableItems.map((i) => i.returnableItem.name).join(', ')"
              >
                +{{ tier.returnableItems.length - 2 }}
              </UBadge>
            </div>
            <span v-else class="text-xs text-gray-400">-</span>
          </div>

          <!-- Période de validité -->
          <div class="md:col-span-2 min-w-0">
            <div
              v-if="tier.validFrom || tier.validUntil"
              class="text-xs text-gray-600 dark:text-gray-400 space-y-1"
            >
              <div v-if="tier.validFrom" class="flex items-center gap-1">
                <UIcon
                  name="i-heroicons-arrow-right-circle"
                  class="h-3 w-3 flex-shrink-0 text-success-500"
                />
                <span class="truncate">{{ formatDateShort(tier.validFrom) }}</span>
              </div>
              <div v-if="tier.validUntil" class="flex items-center gap-1">
                <UIcon
                  name="i-heroicons-arrow-left-circle"
                  class="h-3 w-3 flex-shrink-0 text-error-500"
                />
                <span class="truncate">{{ formatDateShort(tier.validUntil) }}</span>
              </div>
            </div>
            <span v-else class="text-xs text-gray-400">-</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex-shrink-0 flex gap-2">
          <UButton
            icon="i-heroicons-pencil"
            color="primary"
            variant="ghost"
            size="sm"
            @click="openTierModal(tier)"
          />
          <UButton
            v-if="!tier.helloAssoTierId"
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="sm"
            @click="confirmDeleteTier(tier)"
          />
        </div>
      </div>
    </UCard>
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
import { deleteTier, type TicketingTier } from '~/utils/ticketing/tiers'

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
const deleting = ref(false)

// Drag and drop
const draggedTierId = ref<number | null>(null)
const dragOverTierId = ref<number | null>(null)
const sortedTiers = ref<TicketingTier[]>([])

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

const updateTiersPositions = async (tiers: TicketingTier[]) => {
  const toast = useToast()

  try {
    // Créer la liste des positions à envoyer à l'API
    const positions = tiers.map((tier, index) => ({
      id: tier.id,
      position: index,
    }))

    await $fetch(`/api/editions/${props.editionId}/ticketing/tiers/reorder`, {
      method: 'PUT',
      body: { positions },
    })

    toast.add({
      title: 'Ordre mis à jour',
      description: "L'ordre des tarifs a été enregistré",
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Rafraîchir les données
    emit('refresh')
  } catch (error: any) {
    console.error('Failed to update tiers positions:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible de mettre à jour l'ordre des tarifs",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
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

const deleteTierAction = async () => {
  if (!tierToDelete.value) return

  const toast = useToast()
  deleting.value = true
  try {
    await deleteTier(props.editionId, tierToDelete.value.id)

    toast.add({
      title: 'Tarif supprimé',
      description: 'Le tarif a été supprimé avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    deleteConfirmOpen.value = false
    tierToDelete.value = null
    emit('refresh')
  } catch (error: any) {
    console.error('Failed to delete tier:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de supprimer le tarif',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}

const formatDateShort = (date: string | Date) => {
  const d = new Date(date)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
