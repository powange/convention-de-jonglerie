<script setup lang="ts">
// Articles à remettre d'une option. Le squelette vit dans TicketingHandoutItemsModal.
interface OptionItem {
  id: number
  name: string
  handoutItems?: Array<{ handoutItemId: number; quantity?: number }>
}

const props = defineProps<{
  open: boolean
  editionId: number
  option: OptionItem | null
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
}>()

const { t } = useI18n()

const modalTitle = computed(() =>
  props.option
    ? t('gestion.ticketing.options_handout_items_manage_for', { name: props.option.name })
    : ''
)
</script>

<template>
  <TicketingHandoutItemsModal
    :open="open"
    :edition-id="editionId"
    :title="modalTitle"
    :field-label="$t('ticketing.tiers.modal.handout_items_label')"
    :initial-selection="option?.handoutItems ?? []"
    :save-url="`/api/editions/${editionId}/ticketing/options/${option?.id}/handout-items`"
    :save-body="(selection) => ({ handoutItemIds: selection })"
    @update:open="emit('update:open', $event)"
    @saved="emit('saved')"
  />
</template>
