<script setup lang="ts">
interface Artist {
  id: number
  handoutItems?: Array<{
    handoutItemId: number
    quantity?: number
    handoutItem?: { id: number; name: string }
  }>
}

const props = defineProps<{
  open: boolean
  editionId: number
  artist: Artist | null
  /** Nom affiché de l'artiste, calculé par la page appelante. */
  artistLabel: string
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const availableItems = ref<Array<{ id: number; name: string }>>([])
// Articles demandés pour cet artiste, avec le nombre d'exemplaires de chacun
const selection = ref<Array<{ handoutItemId: number; quantity: number }>>([])

const modalTitle = computed(() =>
  props.artist
    ? t('gestion.ticketing.artist_handout_items_manage_for', { name: props.artistLabel })
    : ''
)

const { execute: loadAvailableItems, loading } = useApiAction<
  unknown,
  { handoutItems: Array<{ id: number; name: string }> }
>(() => `/api/editions/${props.editionId}/ticketing/handout-items`, {
  method: 'GET',
  silentSuccess: true,
  errorMessages: { default: t('gestion.organizers.error_loading_items') },
  onSuccess: (result) => {
    availableItems.value = result?.handoutItems || []
  },
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      selection.value = (props.artist?.handoutItems ?? []).map((ri) => ({
        handoutItemId: ri.handoutItemId,
        quantity: ri.quantity ?? 1,
      }))
      loadAvailableItems()
    }
  },
  { immediate: true }
)

const { execute: save, loading: saving } = useApiAction(
  () => `/api/editions/${props.editionId}/artists/${props.artist?.id}/handout-items`,
  {
    method: 'PUT',
    body: () => ({ handoutItemIds: selection.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      emit('saved')
      isOpen.value = false
    },
  }
)
</script>

<template>
  <UModal v-model:open="isOpen" :title="modalTitle" :ui="{ content: 'sm:max-w-xl' }">
    <template #body>
      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto h-8 w-8" />
      </div>

      <div v-else class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('gestion.ticketing.artist_handout_items_help') }}
        </p>

        <UFormField :label="$t('gestion.shows.handout_items')">
          <TicketingHandoutItemsQuantityPicker v-model="selection" :items="availableItems" />
        </UFormField>

        <p v-if="availableItems.length === 0" class="text-sm text-amber-600 dark:text-amber-400">
          {{ $t('gestion.ticketing.no_handout_items_created') }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton color="primary" :loading="saving" :disabled="loading" @click="() => void save()">
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
