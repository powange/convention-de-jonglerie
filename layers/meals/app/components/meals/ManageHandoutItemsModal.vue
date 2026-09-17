<script setup lang="ts">
// Articles à remettre d'un repas — le ticket de cantine, typiquement.
// Le squelette vit dans TicketingHandoutItemsModal.
interface Meal {
  id: number
  date: string
  type: string
  enabled: boolean
  phases: string[]
  handoutItems?: Array<{ handoutItemId: number; quantity?: number }>
}

const props = defineProps<{
  open: boolean
  editionId: number
  meal: Meal | null
  /** Label affiché en titre du modal (date + type traduit). */
  mealLabel?: string
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
}>()

const { t } = useI18n()

const modalTitle = computed(() =>
  props.mealLabel
    ? t('gestion.ticketing.meals_handout_items_manage_for', { meal: props.mealLabel })
    : t('gestion.ticketing.meals_handout_items_title')
)

/**
 * Le PUT des repas attend la configuration complète du repas, pas seulement ses articles :
 * `enabled` et `phases` sont renvoyés inchangés, faute de quoi l'enregistrement des articles
 * éteindrait le repas au passage.
 */
const corpsDeRequete = (selection: Array<{ handoutItemId: number; quantity: number }>) => ({
  meals: [
    {
      id: props.meal?.id,
      enabled: props.meal?.enabled,
      phases: props.meal?.phases,
      handoutItemIds: selection,
    },
  ],
})
</script>

<template>
  <TicketingHandoutItemsModal
    :open="open"
    :edition-id="editionId"
    :title="modalTitle"
    :help="$t('gestion.ticketing.meals_handout_items_help')"
    :field-label="$t('gestion.meals.handout_items_label')"
    :initial-selection="meal?.handoutItems ?? []"
    :save-url="`/api/editions/${editionId}/volunteers/meals`"
    :save-body="corpsDeRequete"
    @update:open="emit('update:open', $event)"
    @saved="emit('saved')"
  />
</template>
