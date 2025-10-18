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

  <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <UCard v-for="tier in tiers" :key="tier.id" :class="!tier.isActive && 'opacity-60'">
      <template #header>
        <!-- En-tête -->
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-semibold text-gray-900 dark:text-white flex-1">
            {{ tier.name }}
          </h3>
          <div class="flex items-center gap-2">
            <img
              v-if="tier.helloAssoTierId"
              src="~/assets/img/helloasso/logo.svg"
              :alt="$t('ticketing.tiers.list.logo_alt')"
              class="h-5 w-auto"
              :title="`Synchronisé depuis HelloAsso (ID: ${tier.helloAssoTierId})`"
            />
            <UBadge v-if="!tier.isActive" color="neutral" variant="soft">
              {{ $t('ticketing.tiers.list.inactive') }}
            </UBadge>
          </div>
        </div>
      </template>

      <!-- Prix -->
      <div class="flex items-baseline gap-1">
        <span
          class="text-3xl font-bold"
          :class="tier.isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'"
        >
          {{ (tier.price / 100).toFixed(2) }}
        </span>
        <span class="text-sm text-gray-500">€</span>
      </div>

      <!-- Description -->
      <p v-if="tier.description" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
        {{ tier.description }}
      </p>

      <!-- Montants min/max -->
      <div v-if="tier.minAmount || tier.maxAmount" class="text-sm text-gray-500">
        <div v-if="tier.minAmount" class="flex items-center gap-1">
          <span>Min:</span>
          <span class="font-medium">{{ (tier.minAmount / 100).toFixed(2) }}€</span>
        </div>
        <div v-if="tier.maxAmount" class="flex items-center gap-1">
          <span>Max:</span>
          <span class="font-medium">{{ (tier.maxAmount / 100).toFixed(2) }}€</span>
        </div>
      </div>

      <!-- Quotas associés -->
      <div v-if="tier.quotas && tier.quotas.length > 0" class="flex flex-wrap gap-1">
        <p class="font-medium text-gray-700 dark:text-gray-300">Quotas :</p>
        <UBadge
          v-for="quotaRelation in tier.quotas"
          :key="quotaRelation.quota.id"
          color="warning"
          variant="soft"
        >
          {{ quotaRelation.quota.title }}
        </UBadge>
      </div>

      <!-- Articles à restituer -->
      <div
        v-if="tier.returnableItems && tier.returnableItems.length > 0"
        class="flex flex-wrap gap-1"
      >
        <p class="font-medium text-gray-700 dark:text-gray-300">À restituer :</p>
        <UBadge
          v-for="itemRelation in tier.returnableItems"
          :key="itemRelation.returnableItem.id"
          color="info"
          variant="soft"
        >
          {{ itemRelation.returnableItem.name }}
        </UBadge>
      </div>

      <template #footer>
        <!-- Actions -->
        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-pencil"
            color="primary"
            variant="soft"
            @click="openTierModal(tier)"
          >
            Modifier
          </UButton>
          <UButton
            v-if="!tier.helloAssoTierId"
            icon="i-heroicons-trash"
            color="error"
            variant="soft"
            @click="confirmDeleteTier(tier)"
          >
            Supprimer
          </UButton>
        </div>
      </template>
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
</script>
