<script setup lang="ts">
import type { PropType } from 'vue'

/**
 * Articles à remettre d'une portée organisateur : tous les organisateurs (`organizer` absent),
 * ou un organisateur précis. Le squelette vit dans TicketingHandoutItemsModal.
 *
 * Seul écran à restreindre le choix proposé : régler un organisateur précis n'a pas à lui
 * reproposer ce qu'il reçoit déjà globalement — l'agrégation le dédoublonnerait de toute façon.
 */
const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  editionId: {
    type: Number,
    required: true,
  },
  organizer: {
    type: Object as PropType<any>,
    default: null,
  },
})

const emit = defineEmits(['update:open', 'itemsUpdated'])

const { t } = useI18n()

// Articles associés globalement, relevés au chargement pour être écartés du choix.
const articlesGlobaux = ref<Set<number>>(new Set())

const modalTitle = computed(() => {
  if (!props.organizer) return t('gestion.organizers.global_handout_items')

  // Vérification de sécurité pour éviter les erreurs si la structure est incomplète
  if (!props.organizer?.user) return t('gestion.organizers.manage_articles')

  const user = props.organizer.user
  const displayName = user.pseudo || `${user.prenom} ${user.nom}`
  return t('gestion.organizers.manage_articles_for', { name: displayName })
})

const selectionCourante = async () => {
  const reponse = await $fetch<any>(
    `/api/editions/${props.editionId}/ticketing/organizers/handout-items`
  )
  const toutes = reponse.items ?? []
  const organizerId = props.organizer?.id ?? null

  articlesGlobaux.value = new Set(
    toutes.filter((i: any) => i.organizerId === null).map((i: any) => i.handoutItemId)
  )

  return toutes
    .filter((i: any) => i.organizerId === organizerId)
    .map((i: any) => ({ handoutItemId: i.handoutItemId, quantity: i.quantity ?? 1 }))
}

/**
 * Écarte du choix ce qui est déjà remis globalement, quand on règle une personne précise.
 * Les articles déjà retenus restent listés, sinon ils disparaîtraient de leur propre sélecteur.
 */
const filtrerLesArticles = (
  articles: Array<{ id: number; name: string }>,
  selection: Array<{ handoutItemId: number }>
) => {
  if (!props.organizer?.id) return articles
  const retenus = new Set(selection.map((e) => e.handoutItemId))
  return articles.filter((a) => retenus.has(a.id) || !articlesGlobaux.value.has(a.id))
}
</script>

<template>
  <TicketingHandoutItemsModal
    :open="open"
    :edition-id="editionId"
    :title="modalTitle"
    :field-label="$t('gestion.organizers.assigned_items')"
    :initial-selection="selectionCourante"
    :filter-items="filtrerLesArticles"
    :save-url="`/api/editions/${editionId}/ticketing/organizers/handout-items`"
    :save-body="(selection) => ({ organizerId: organizer?.id ?? null, handoutItemIds: selection })"
    @update:open="emit('update:open', $event)"
    @saved="emit('itemsUpdated')"
  />
</template>
