<template>
  <!-- Bouton ajouter une option -->
  <div class="mb-4 flex justify-end">
    <UButton icon="i-heroicons-plus" color="primary" @click="openOptionModal()">
      Ajouter une option
    </UButton>
  </div>

  <!-- Liste des options -->
  <div v-if="loading" class="text-center py-12">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
    <p class="text-sm text-gray-500 mt-2">Chargement...</p>
  </div>

  <div v-else-if="options.length === 0" class="text-center py-12">
    <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-300 mb-3 mx-auto" />
    <p class="text-sm text-gray-500">Aucune option trouvée</p>
    <p class="text-xs text-gray-400 mt-1">
      Ajoutez une option manuelle ou synchronisez depuis votre billeterie externe
    </p>
  </div>

  <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <UCard v-for="option in options" :key="option.id">
      <template #header>
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 dark:text-white">
              {{ option.name }}
            </h3>
            <div class="flex items-center gap-2 mt-1">
              <UBadge color="primary" variant="soft" size="xs">
                {{ option.type }}
              </UBadge>
              <UBadge v-if="option.isRequired" color="warning" variant="soft" size="xs">
                Obligatoire
              </UBadge>
            </div>
          </div>
          <img
            v-if="option.helloAssoOptionId"
            src="~/assets/img/helloasso/logo.svg"
            alt="HelloAsso"
            class="h-5 w-auto"
            :title="`Synchronisé depuis HelloAsso (ID: ${option.helloAssoOptionId})`"
          />
        </div>
      </template>

      <div class="space-y-3">
        <p v-if="option.description" class="text-sm text-gray-600 dark:text-gray-400">
          {{ option.description }}
        </p>

        <!-- Choix disponibles -->
        <div v-if="option.choices && option.choices.length > 0">
          <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Choix :</p>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="(choice, idx) in option.choices"
              :key="idx"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ choice }}
            </UBadge>
          </div>
        </div>

        <!-- Quotas associés -->
        <div v-if="option.quotas && option.quotas.length > 0" class="flex flex-wrap gap-1">
          <p class="font-medium text-gray-700 dark:text-gray-300">Quotas :</p>
          <UBadge
            v-for="quotaRelation in option.quotas"
            :key="quotaRelation.quota.id"
            color="warning"
            variant="soft"
          >
            {{ quotaRelation.quota.title }}
          </UBadge>
        </div>

        <!-- Articles à restituer -->
        <div
          v-if="option.returnableItems && option.returnableItems.length > 0"
          class="flex flex-wrap gap-1"
        >
          <p class="font-medium text-gray-700 dark:text-gray-300">À restituer :</p>
          <UBadge
            v-for="itemRelation in option.returnableItems"
            :key="itemRelation.returnableItem.id"
            color="info"
            variant="soft"
          >
            {{ itemRelation.returnableItem.name }}
          </UBadge>
        </div>
      </div>

      <template #footer>
        <!-- Actions -->
        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-pencil"
            color="primary"
            variant="soft"
            @click="openOptionModal(option)"
          >
            Modifier
          </UButton>
          <UButton
            v-if="!option.helloAssoOptionId"
            icon="i-heroicons-trash"
            color="error"
            variant="soft"
            @click="confirmDeleteOption(option)"
          >
            Supprimer
          </UButton>
        </div>
      </template>
    </UCard>
  </div>

  <!-- Modal pour ajouter/modifier une option -->
  <TicketingOptionModal
    v-model:open="optionModalOpen"
    :option="selectedOption"
    :edition-id="editionId"
    @saved="handleOptionSaved"
  />

  <!-- Modal de confirmation de suppression d'option -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    title="Supprimer l'option"
    :description="`Êtes-vous sûr de vouloir supprimer l'option '${optionToDelete?.name}' ?`"
    confirm-label="Supprimer"
    confirm-color="error"
    confirm-icon="i-heroicons-trash"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-red-500"
    :loading="deleting"
    @confirm="deleteOptionAction"
    @cancel="deleteConfirmOpen = false"
  />
</template>

<script setup lang="ts">
import { deleteOption, type Option } from '~/utils/ticketing/options'

const props = defineProps<{
  options: Option[]
  loading: boolean
  editionId: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const optionModalOpen = ref(false)
const selectedOption = ref<Option | null>(null)
const deleteConfirmOpen = ref(false)
const optionToDelete = ref<Option | null>(null)
const deleting = ref(false)

const openOptionModal = (option?: Option) => {
  selectedOption.value = option || null
  optionModalOpen.value = true
}

const handleOptionSaved = () => {
  emit('refresh')
}

const confirmDeleteOption = (option: Option) => {
  optionToDelete.value = option
  deleteConfirmOpen.value = true
}

const deleteOptionAction = async () => {
  if (!optionToDelete.value) return

  const toast = useToast()
  deleting.value = true
  try {
    await deleteOption(props.editionId, optionToDelete.value.id)

    toast.add({
      title: 'Option supprimée',
      description: "L'option a été supprimée avec succès",
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    deleteConfirmOpen.value = false
    optionToDelete.value = null
    emit('refresh')
  } catch (error: any) {
    console.error('Failed to delete option:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible de supprimer l'option",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}
</script>
