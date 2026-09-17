<script setup lang="ts">
// Articles à remettre d'un tarif. Tout le squelette vit dans TicketingHandoutItemsModal ;
// il ne reste ici que ce qui est propre au tarif.
interface Tier {
  id: number
  name: string
  handoutItems?: Array<{ handoutItemId: number; quantity?: number }>
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

const modalTitle = computed(() =>
  props.tier ? t('gestion.ticketing.tiers_handout_items_manage_for', { name: props.tier.name }) : ''
)
</script>

<template>
  <TicketingHandoutItemsModal
    :open="open"
    :edition-id="editionId"
    :title="modalTitle"
    :field-label="$t('ticketing.tiers.modal.handout_items_label')"
    :initial-selection="tier?.handoutItems ?? []"
    :save-url="`/api/editions/${editionId}/ticketing/tiers/${tier?.id}/handout-items`"
    :save-body="(selection) => ({ handoutItemIds: selection })"
    @update:open="emit('update:open', $event)"
    @saved="emit('saved')"
  />
</template>
