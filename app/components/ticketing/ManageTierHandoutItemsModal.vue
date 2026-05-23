<script setup lang="ts">
interface Tier {
  id: number
  name: string
  handoutItems?: Array<{
    handoutItemId: number
    handoutItem?: { id: number; name: string }
  }>
}

const props = defineProps<{
  open: boolean
  editionId: number
  tier: Tier | null
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
const selectedItemIds = ref<number[]>([])

const modalTitle = computed(() =>
  props.tier ? t('gestion.ticketing.tiers_handout_items_manage_for', { name: props.tier.name }) : ''
)

const itemOptions = computed(() =>
  availableItems.value.map((item) => ({ label: item.name, value: item.id }))
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
      selectedItemIds.value = props.tier?.handoutItems?.map((ri) => ri.handoutItemId) ?? []
      loadAvailableItems()
    }
  },
  { immediate: true }
)

const { execute: save, loading: saving } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/tiers/${props.tier?.id}/handout-items`,
  {
    method: 'PUT',
    body: () => ({ handoutItemIds: selectedItemIds.value }),
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
        <UFormField :label="$t('ticketing.tiers.modal.handout_items_label')">
          <USelectMenu
            v-model="selectedItemIds"
            :items="itemOptions"
            value-key="value"
            multiple
            :placeholder="$t('gestion.ticketing.select_handout_items_placeholder')"
            class="w-full"
          >
            <template #label>
              <span v-if="selectedItemIds.length === 0">
                {{ $t('gestion.ticketing.no_items_selected') }}
              </span>
              <span v-else>
                {{
                  $t('gestion.ticketing.items_selected_count', { count: selectedItemIds.length })
                }}
              </span>
            </template>
          </USelectMenu>
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
        <UButton color="primary" :loading="saving" :disabled="loading" @click="save">
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
