<script setup lang="ts">
// Articles à remettre à UN artiste. Le squelette vit dans TicketingHandoutItemsModal.
//
// Ces articles s'AJOUTENT à ceux remis à tous les artistes et à ceux des spectacles : ils ne
// les remplacent pas — contrairement aux équipes de bénévoles, où la portée d'équipe surcharge.
interface Artist {
  id: number
  handoutItems?: Array<{ handoutItemId: number; quantity?: number }>
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

const modalTitle = computed(() =>
  props.artist
    ? t('gestion.ticketing.artist_handout_items_manage_for', { name: props.artistLabel })
    : ''
)
</script>

<template>
  <TicketingHandoutItemsModal
    :open="open"
    :edition-id="editionId"
    :title="modalTitle"
    :help="$t('gestion.ticketing.artist_handout_items_help')"
    :field-label="$t('ticketing.tiers.modal.handout_items_label')"
    :initial-selection="artist?.handoutItems ?? []"
    :save-url="`/api/editions/${editionId}/artists/${artist?.id}/handout-items`"
    :save-body="(selection) => ({ handoutItemIds: selection })"
    @update:open="emit('update:open', $event)"
    @saved="emit('saved')"
  />
</template>
