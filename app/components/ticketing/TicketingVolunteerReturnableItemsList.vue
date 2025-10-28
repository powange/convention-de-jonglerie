<template>
  <!-- Chargement -->
  <div v-if="loading" class="flex flex-col items-center justify-center py-16">
    <UIcon name="i-heroicons-arrow-path" class="h-10 w-10 text-purple-500 animate-spin mb-3" />
    <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
      Chargement des articles bénévoles...
    </p>
  </div>

  <div v-else class="space-y-8">
    <!-- Articles globaux (tous les bénévoles) -->
    <div v-if="globalItems.length > 0">
      <h3
        class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"
      >
        <UIcon name="i-heroicons-users" class="h-4 w-4" />
        Tous les bénévoles
      </h3>
      <TransitionGroup
        name="list"
        tag="div"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-all duration-200 ease-in absolute"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-for="item in globalItems"
          :key="item.id"
          class="group relative flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200 dark:border-purple-800/30 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700/50 transition-all duration-200"
        >
          <!-- Icône -->
          <div
            class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/60 transition-colors"
          >
            <UIcon name="i-heroicons-gift" class="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>

          <!-- Nom de l'article -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white break-words">
              {{ item.name }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {{ $t('ticketing.returnable_items.volunteer.given_to_all') }}
            </p>
          </div>

          <!-- Bouton supprimer -->
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="xs"
            square
            class="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            @click="confirmDeleteItem(item)"
          />
        </div>
      </TransitionGroup>
    </div>

    <!-- Articles par équipe -->
    <div v-for="teamGroup in itemsByTeam" :key="teamGroup.teamId" class="space-y-3">
      <div class="flex items-center gap-3">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <div
            class="w-3 h-3 rounded-full"
            :style="{ backgroundColor: teamGroup.teamColor || '#6b7280' }"
          />
          {{ teamGroup.teamName }}
        </h3>
        <UBadge color="orange" variant="subtle" size="xs">
          <UIcon name="i-heroicons-arrow-path" class="h-3 w-3 mr-1" />
          Remplace la config globale
        </UBadge>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Ces articles remplacent complètement les articles globaux pour les bénévoles de cette équipe
      </p>
      <TransitionGroup
        name="list"
        tag="div"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-all duration-200 ease-in absolute"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-for="item in teamGroup.items"
          :key="item.id"
          class="group relative flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 border border-orange-200 dark:border-orange-800/30 hover:shadow-lg hover:border-orange-300 dark:hover:border-orange-700/50 transition-all duration-200"
        >
          <!-- Icône -->
          <div
            class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/40 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/60 transition-colors"
          >
            <UIcon name="i-heroicons-gift" class="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>

          <!-- Nom de l'article -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white break-words">
              {{ item.name }}
            </p>
            <p class="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
              Équipe uniquement
            </p>
          </div>

          <!-- Bouton supprimer -->
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="xs"
            square
            class="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            @click="confirmDeleteItem(item)"
          />
        </div>
      </TransitionGroup>
    </div>

    <!-- Message si aucun item -->
    <div
      v-if="items.length === 0"
      class="flex flex-col items-center justify-center py-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-2 border-dashed border-gray-300 dark:border-gray-700"
    >
      <div
        class="flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4"
      >
        <UIcon name="i-heroicons-gift" class="h-8 w-8 text-purple-400 dark:text-purple-500" />
      </div>
      <p class="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
        Aucun article configuré
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
        Sélectionnez un article et une portée ci-dessous
      </p>
    </div>

    <!-- Section d'ajout -->
    <div class="pt-2 space-y-3">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Ajouter un article pour les bénévoles
      </label>

      <!-- Sélecteur d'équipe ou global -->
      <USelect
        v-model="selectedTeamId"
        :items="teamOptions"
        placeholder="Sélectionner la portée"
        size="lg"
      />

      <!-- Sélecteur d'article + bouton ajouter -->
      <UFieldGroup>
        <USelect
          v-model="selectedItemId"
          :items="availableReturnableItems"
          :placeholder="$t('ticketing.returnable_items.volunteer.choose_placeholder')"
          size="lg"
          :disabled="availableReturnableItems.length === 0"
        />
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          size="lg"
          :loading="saving"
          :disabled="!selectedItemId || selectedTeamId === undefined"
          @click="handleAdd"
        >
          Ajouter
        </UButton>
      </UFieldGroup>
      <p
        v-if="availableReturnableItems.length === 0"
        class="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
      >
        <UIcon name="i-heroicons-information-circle" class="h-4 w-4" />
        Tous les articles disponibles sont déjà associés pour cette portée
      </p>
    </div>
  </div>

  <!-- Modal de confirmation de suppression -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    :title="$t('ticketing.returnable_items.volunteer.remove_title')"
    :description="`L'article '${itemToDelete?.name}' ne sera plus remis automatiquement aux bénévoles lors de leur validation d'accès.`"
    :confirm-label="$t('ticketing.returnable_items.volunteer.remove_label')"
    confirm-color="error"
    confirm-icon="i-heroicons-trash"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-red-500"
    :loading="deleting"
    @confirm="deleteItem"
    @cancel="deleteConfirmOpen = false"
  />
</template>

<script setup lang="ts">
interface VolunteerReturnableItem {
  id: number
  returnableItemId: number
  teamId: string | null
  name: string
  team?: {
    id: string
    name: string
    color: string
  }
}

interface TicketingReturnableItem {
  id: number
  name: string
}

interface VolunteerTeam {
  id: string
  name: string
  color: string
}

const props = defineProps<{
  items: VolunteerReturnableItem[]
  loading: boolean
  editionId: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const saving = ref(false)
const deleteConfirmOpen = ref(false)
const itemToDelete = ref<VolunteerReturnableItem | null>(null)
const deleting = ref(false)
const selectedItemId = ref<number | null>(null)
const selectedTeamId = ref<string | null>(null) // null = global par défaut, string = équipe spécifique
const allReturnableItems = ref<TicketingReturnableItem[]>([])
const teams = ref<VolunteerTeam[]>([])

// Initialiser selectedTeamId à null (global) au montage
onMounted(() => {
  selectedTeamId.value = null
  loadAllReturnableItems()
  loadTeams()
})

// Recharger la liste complète des articles quand la portée change
// Cela permet de récupérer les nouveaux articles créés entre-temps
watch(selectedTeamId, () => {
  loadAllReturnableItems()
})

// Séparer les articles globaux des articles par équipe
const globalItems = computed(() => props.items.filter((item) => !item.teamId))

const itemsByTeam = computed(() => {
  const teamMap = new Map<string, VolunteerReturnableItem[]>()

  props.items
    .filter((item) => item.teamId)
    .forEach((item) => {
      if (!item.teamId) return
      if (!teamMap.has(item.teamId)) {
        teamMap.set(item.teamId, [])
      }
      teamMap.get(item.teamId)!.push(item)
    })

  return Array.from(teamMap.entries()).map(([teamId, items]) => ({
    teamId,
    teamName: items[0]?.team?.name || 'Équipe inconnue',
    teamColor: items[0]?.team?.color || '#6b7280',
    items,
  }))
})

// Options pour le sélecteur d'équipe
const teamOptions = computed(() => {
  const options = [
    {
      label: '🌍 Tous les bénévoles (global)',
      value: null,
    },
  ]

  teams.value.forEach((team) => {
    options.push({
      label: `🔹 ${team.name}`,
      value: team.id,
    })
  })

  return options
})

// Charger tous les articles à restituer disponibles
const loadAllReturnableItems = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/ticketing/returnable-items`)
    allReturnableItems.value = response.returnableItems || []
  } catch (error) {
    console.error('Failed to load all returnable items:', error)
  }
}

// Charger les équipes de bénévoles
const loadTeams = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/volunteer-teams`)
    teams.value = response
  } catch (error) {
    console.error('Failed to load teams:', error)
  }
}

// Articles disponibles pour la portée sélectionnée
const availableReturnableItems = computed(() => {
  // Filtrer les articles déjà utilisés pour cette portée spécifique
  const usedIdsForScope = props.items
    .filter((item) => item.teamId === selectedTeamId.value)
    .map((item) => item.returnableItemId)

  return allReturnableItems.value
    .filter((item) => !usedIdsForScope.includes(item.id))
    .map((item) => ({
      label: item.name,
      value: item.id,
    }))
})

const confirmDeleteItem = (item: VolunteerReturnableItem) => {
  itemToDelete.value = item
  deleteConfirmOpen.value = true
}

const deleteItem = async () => {
  if (!itemToDelete.value) return

  const toast = useToast()
  deleting.value = true
  try {
    await $fetch(
      `/api/editions/${props.editionId}/ticketing/volunteers/returnable-items/${itemToDelete.value.id}`,
      {
        method: 'DELETE',
      }
    )

    toast.add({
      title: 'Article retiré',
      description: "L'article a été retiré des articles à restituer pour les bénévoles",
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    deleteConfirmOpen.value = false
    itemToDelete.value = null
    emit('refresh')
  } catch (error: any) {
    console.error('Failed to delete volunteer returnable item:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible de retirer l'article",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}

const handleAdd = async () => {
  if (!selectedItemId.value) return

  const toast = useToast()
  saving.value = true
  try {
    // Recharger d'abord la liste complète au cas où de nouveaux articles auraient été créés
    await loadAllReturnableItems()

    await $fetch(`/api/editions/${props.editionId}/ticketing/volunteers/returnable-items`, {
      method: 'POST',
      body: {
        returnableItemId: selectedItemId.value,
        teamId: selectedTeamId.value,
      },
    })

    const scope = selectedTeamId.value
      ? teams.value.find((t) => t.id === selectedTeamId.value)?.name || 'cette équipe'
      : 'tous les bénévoles'

    toast.add({
      title: 'Article ajouté',
      description: `L'article a été ajouté pour ${scope}`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    selectedItemId.value = null
    // Ne pas réinitialiser selectedTeamId pour faciliter l'ajout multiple

    // Émettre l'événement de refresh pour que le parent recharge les données
    emit('refresh')

    // Attendre le prochain cycle pour que les props soient mises à jour
    await nextTick()

    // Le computed availableReturnableItems a maintenant les nouvelles props.items
    // et peut recalculer la liste des articles disponibles
  } catch (error: any) {
    console.error('Failed to add volunteer returnable item:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible d'ajouter l'article",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
