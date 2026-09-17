<script setup lang="ts">
// Modal de gestion des articles à remettre à TOUS les artistes de l'édition.
// Les articles propres à un spectacle sont gérés séparément (ShowsManageHandoutItemsModal).
//
// L'écran suivait un modèle « ajouter / supprimer » qui rendait une quantité définitive : la
// changer imposait de retirer l'article puis de le remettre. Il reprend désormais le sélecteur
// partagé avec les tarifs, les options, les champs personnalisés, les spectacles et les repas,
// et enregistre la portée entière en une fois.
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
const availableItems = ref<Array<{ id: number; name: string }>>([])
// Articles associés, avec le nombre d'exemplaires de chacun : la forme qu'attend le PUT.
const selection = ref<Array<{ handoutItemId: number; quantity: number }>>([])

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
    selection.value = (assignedResponse.items || []).map((item: any) => ({
      handoutItemId: item.handoutItemId,
      quantity: item.quantity ?? 1,
    }))
  } catch (error) {
    console.error('Erreur lors du chargement des articles:', error)
  } finally {
    isLoadingData.value = false
  }
}

const { execute: save, loading: saving } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/artists/handout-items`,
  {
    method: 'PUT',
    body: () => ({ handoutItemIds: selection.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      emit('itemsUpdated')
      emit('update:open', false)
    },
  }
)

watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      loadData()
    } else {
      selection.value = []
    }
  }
)
</script>

<template>
  <UModal
    :open="open"
    :title="$t('gestion.ticketing.all_artists_handout_items')"
    :ui="{ content: 'sm:max-w-xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="isLoadingData" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto h-8 w-8" />
      </div>

      <div v-else class="space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.ticketing.all_artists_handout_items_help') }}
        </p>

        <UFormField :label="$t('gestion.organizers.assigned_items')">
          <TicketingHandoutItemsQuantityPicker v-model="selection" :items="availableItems" />
        </UFormField>

        <p v-if="availableItems.length === 0" class="text-sm text-amber-600 dark:text-amber-400">
          {{ $t('gestion.ticketing.no_handout_items_created') }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="emit('update:open', false)">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton color="primary" :loading="saving" :disabled="isLoadingData" @click="save">
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
