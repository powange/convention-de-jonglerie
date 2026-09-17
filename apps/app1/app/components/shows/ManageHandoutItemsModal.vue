<script setup lang="ts">
// Articles à remettre d'un spectacle. Le squelette vit dans TicketingHandoutItemsModal.
//
// L'écriture passe par le PUT du spectacle, qui met à jour l'objet entier : c'est la raison
// pour laquelle ce point d'API garde le droit « artistes » et non le droit billetterie.
interface Show {
  id: number
  title: string
  handoutItems?: Array<{ handoutItemId: number; quantity?: number }>
}

const props = defineProps<{
  open: boolean
  editionId: number
  show: Show | null
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
}>()

const { t } = useI18n()

const modalTitle = computed(() =>
  props.show
    ? t('gestion.ticketing.shows_handout_items_manage_for', { title: props.show.title })
    : ''
)
</script>

<template>
  <TicketingHandoutItemsModal
    :open="open"
    :edition-id="editionId"
    :title="modalTitle"
    :help="$t('gestion.ticketing.shows_handout_items_help')"
    :field-label="$t('ticketing.tiers.modal.handout_items_label')"
    :initial-selection="show?.handoutItems ?? []"
    :save-url="`/api/editions/${editionId}/shows/${show?.id}`"
    :save-body="(selection) => ({ handoutItemIds: selection })"
    @update:open="emit('update:open', $event)"
    @saved="emit('saved')"
  />
</template>
