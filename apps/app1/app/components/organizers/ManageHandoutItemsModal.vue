<script setup lang="ts">
import type { PropType } from 'vue'

/**
 * Articles à remettre d'une portée organisateur : tous les organisateurs (`organizer` absent),
 * ou un organisateur précis.
 *
 * L'écran suivait un modèle « ajouter / supprimer » qui rendait une quantité définitive : la
 * changer imposait de retirer l'article puis de le remettre. Il reprend désormais le sélecteur
 * partagé avec les tarifs, les options et les spectacles, et enregistre la portée en une fois.
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

// État
const isLoadingData = ref(false)
const availableItems = ref<Array<{ id: number; name: string }>>([])
// Articles associés à la portée affichée, avec leur quantité : la forme qu'attend le PUT.
const selection = ref<Array<{ handoutItemId: number; quantity: number }>>([])
// Articles associés globalement, écartés du choix quand on règle un organisateur précis.
const globalItemIds = ref<Set<number>>(new Set())

// Titre du modal
const modalTitle = computed(() => {
  if (!props.organizer) return t('gestion.organizers.global_handout_items')

  // Vérification de sécurité pour éviter les erreurs si la structure est incomplète
  if (!props.organizer?.user) {
    return t('gestion.organizers.manage_articles')
  }

  const user = props.organizer.user
  const displayName = user.pseudo || `${user.prenom} ${user.nom}`
  return t('gestion.organizers.manage_articles_for', { name: displayName })
})

// Charger les données
async function loadData() {
  if (!props.open) return

  isLoadingData.value = true
  try {
    // Charger tous les articles à remettre de l'édition
    const itemsResponse = await $fetch<any>(
      `/api/editions/${props.editionId}/ticketing/handout-items`
    )
    // L'API retourne { success: true, data: { handoutItems: [...] } }
    availableItems.value = itemsResponse.data?.handoutItems || []

    // Charger les articles déjà assignés
    const assignedResponse = await $fetch<any>(
      `/api/editions/${props.editionId}/ticketing/organizers/handout-items`
    )

    const allAssignedItems = assignedResponse.items || []
    const organizerId = props.organizer?.id ?? null

    globalItemIds.value = new Set(
      allAssignedItems
        .filter((item: any) => item.organizerId === null)
        .map((item: any) => item.handoutItemId)
    )

    selection.value = allAssignedItems
      .filter((item: any) => item.organizerId === organizerId)
      .map((item: any) => ({ handoutItemId: item.handoutItemId, quantity: item.quantity ?? 1 }))
  } catch (error) {
    console.error('Erreur lors du chargement des articles:', error)
  } finally {
    isLoadingData.value = false
  }
}

const { execute: save, loading: saving } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/organizers/handout-items`,
  {
    method: 'PUT',
    body: () => ({
      organizerId: props.organizer?.id ?? null,
      handoutItemIds: selection.value,
    }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      emit('itemsUpdated')
      emit('update:open', false)
    },
  }
)

/**
 * Le choix offert pour un organisateur précis exclut ce qui lui est déjà remis globalement —
 * l'associer deux fois ne lui en donnerait pas davantage, l'agrégation le dédoublonne.
 * Les articles déjà retenus restent listés, faute de quoi ils disparaîtraient du sélecteur.
 */
const availableForSelection = computed(() => {
  const retenus = new Set(selection.value.map((entry) => entry.handoutItemId))

  return availableItems.value.filter((item) => {
    if (retenus.has(item.id)) return true
    return !props.organizer?.id || !globalItemIds.value.has(item.id)
  })
})

// Charger les données quand le modal s'ouvre
watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      loadData()
    } else {
      // Réinitialiser l'état quand le modal se ferme
      selection.value = []
    }
  }
)
</script>

<template>
  <UModal
    :open="open"
    :title="modalTitle"
    :ui="{ content: 'sm:max-w-xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="isLoadingData" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto h-8 w-8" />
      </div>

      <div v-else class="space-y-4">
        <UFormField :label="$t('gestion.organizers.assigned_items')">
          <TicketingHandoutItemsQuantityPicker v-model="selection" :items="availableForSelection" />
        </UFormField>

        <p v-if="availableItems.length === 0" class="text-sm text-amber-600 dark:text-amber-400">
          {{ $t('gestion.organizers.no_handout_items_created') }}
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
