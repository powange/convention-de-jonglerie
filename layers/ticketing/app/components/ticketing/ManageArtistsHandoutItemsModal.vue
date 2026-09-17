<script setup lang="ts">
// Articles à remettre à TOUS les artistes de l'édition.
// Les articles d'un spectacle ou d'un artiste précis sont gérés par leurs propres écrans.
//
// La sélection courante n'est pas portée par un objet affiché : il faut aller la chercher.
const props = defineProps<{
  open: boolean
  editionId: number
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  itemsUpdated: []
}>()

const selectionCourante = async () => {
  const reponse = await $fetch<any>(
    `/api/editions/${props.editionId}/ticketing/artists/handout-items`
  )
  return (reponse.items ?? []).map((item: any) => ({
    handoutItemId: item.handoutItemId,
    quantity: item.quantity ?? 1,
  }))
}
</script>

<template>
  <TicketingHandoutItemsModal
    :open="open"
    :edition-id="editionId"
    :title="$t('gestion.ticketing.all_artists_handout_items')"
    :help="$t('gestion.ticketing.all_artists_handout_items_help')"
    :field-label="$t('gestion.organizers.assigned_items')"
    :initial-selection="selectionCourante"
    :save-url="`/api/editions/${editionId}/ticketing/artists/handout-items`"
    :save-body="(selection) => ({ handoutItemIds: selection })"
    @update:open="emit('update:open', $event)"
    @saved="emit('itemsUpdated')"
  />
</template>
