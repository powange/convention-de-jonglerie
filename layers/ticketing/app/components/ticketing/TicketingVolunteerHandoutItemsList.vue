<template>
  <!-- Chargement -->
  <div v-if="loading" class="flex flex-col items-center justify-center py-16">
    <UIcon name="i-heroicons-arrow-path" class="h-10 w-10 text-purple-500 animate-spin mb-3" />
    <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
      {{ $t('ticketing.handout_items.volunteer.loading') }}
    </p>
  </div>

  <div v-else class="space-y-8">
    <!-- Articles globaux (tous les bénévoles) -->
    <div v-if="globalItems.length > 0">
      <h3
        class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"
      >
        <UIcon name="i-heroicons-users" class="h-4 w-4" />
        {{ $t('ticketing.handout_items.volunteer.all_volunteers') }}
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="item in globalItems"
          :key="item.id"
          class="group relative flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200 dark:border-purple-800/30 transition-all duration-200"
        >
          <!-- Icône -->
          <div
            class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 transition-colors"
          >
            <UIcon name="i-heroicons-gift" class="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>

          <!-- Nom de l'article -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white break-words">
              {{ item.name }}{{ item.quantity > 1 ? ` ×${item.quantity}` : '' }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {{ $t('ticketing.handout_items.volunteer.scope_global_hint') }}
            </p>
          </div>
        </div>
      </div>
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
        <UBadge color="warning" variant="subtle" size="xs">
          <UIcon name="i-heroicons-arrow-path" class="h-3 w-3 mr-1" />
          {{ $t('ticketing.handout_items.volunteer.replaces_global_badge') }}
        </UBadge>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {{ $t('ticketing.handout_items.volunteer.replaces_global_explanation') }}
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="item in teamGroup.items"
          :key="item.id"
          class="group relative flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 border border-orange-200 dark:border-orange-800/30 transition-all duration-200"
        >
          <!-- Icône -->
          <div
            class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/40 transition-colors"
          >
            <UIcon name="i-heroicons-gift" class="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>

          <!-- Nom de l'article -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white break-words">
              {{ item.name }}{{ item.quantity > 1 ? ` ×${item.quantity}` : '' }}
            </p>
            <p class="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
              {{ $t('ticketing.handout_items.volunteer.team_only') }}
            </p>
          </div>
        </div>
      </div>
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
        {{ $t('ticketing.handout_items.volunteer.none_configured') }}
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
        {{ $t('ticketing.handout_items.volunteer.none_configured_hint') }}
      </p>
    </div>

    <!-- Section de réglage : une portée à la fois, enregistrée en bloc -->
    <div class="pt-2 space-y-4 border-t border-gray-200 dark:border-gray-800">
      <UFormField :label="$t('ticketing.handout_items.volunteer.scope_label')" class="pt-4">
        <USelect v-model="selectedTeamId" :items="teamOptions" size="lg" class="w-full" />
      </UFormField>

      <!--
        F4 : la surcharge, dite AVANT qu'on la déclenche.

        L'écran l'annonçait déjà, mais seulement sur une équipe qui avait DÉJÀ des articles —
        donc après coup. Le moment où l'information compte est celui-ci : on s'apprête à retirer
        silencieusement le bracelet global aux bénévoles de cette équipe.
      -->
      <UAlert
        v-if="selectedTeamId !== null"
        color="warning"
        variant="subtle"
        icon="i-heroicons-exclamation-triangle"
        :description="$t('ticketing.handout_items.volunteer.scope_replaces_global_warning')"
      />

      <UFormField :label="$t('ticketing.handout_items.volunteer.items_label')">
        <TicketingHandoutItemsQuantityPicker v-model="selection" :items="allHandoutItems" />
      </UFormField>

      <!-- Aperçu de ce que recevra réellement un bénévole de cette portée -->
      <div class="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1">
        <p class="text-xs font-medium text-gray-700 dark:text-gray-300">
          {{ apercuTitre }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ apercuDetail }}
        </p>
      </div>

      <div class="flex justify-end">
        <UButton
          icon="i-heroicons-check"
          color="primary"
          size="lg"
          :loading="saving"
          @click="enregistrer"
        >
          {{ $t('ticketing.handout_items.volunteer.save') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface VolunteerHandoutItem {
  id: number
  handoutItemId: number
  teamId: string | null
  name: string
  /** Nombre d'exemplaires remis pour cette association. */
  quantity: number
  team?: {
    id: string
    name: string
    color: string
  }
}

interface TicketingHandoutItem {
  id: number
  name: string
}

interface VolunteerTeam {
  id: string
  name: string
  color: string
}

const props = defineProps<{
  items: VolunteerHandoutItem[]
  loading: boolean
  editionId: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()
const selectedTeamId = ref<string | null>(null) // null = global, string = équipe spécifique
// Articles de la portée sélectionnée, avec leur quantité : la forme qu'attend le PUT.
const selection = ref<Array<{ handoutItemId: number; quantity: number }>>([])
const allHandoutItems = ref<TicketingHandoutItem[]>([])
const teams = ref<VolunteerTeam[]>([])

// La portée démarre sur le global. Les articles disponibles, eux, sont chargés par la
// surveillance ci-dessous, qui part en `immediate` : les demander ici aussi doublait la requête
// au montage.
onMounted(() => {
  selectedTeamId.value = null
  loadTeams()
})

/**
 * Recharge le formulaire quand la portée change, ou quand la liste est rafraîchie.
 *
 * Deux sources sont surveillées ensemble : sans la liste reçue en propriété, un enregistrement
 * réussi laissait le formulaire sur l'état d'avant, et un second clic aurait renvoyé la version
 * périmée. (Ne pas nommer la propriété avec un point ici : le détecteur i18n y lirait une clé.)
 */
watch(
  [selectedTeamId, () => props.items],
  () => {
    selection.value = props.items
      .filter((item) => (item.teamId ?? null) === selectedTeamId.value)
      .map((item) => ({ handoutItemId: item.handoutItemId, quantity: item.quantity ?? 1 }))
    loadAllHandoutItems()
  },
  { immediate: true }
)

// Séparer les articles globaux des articles par équipe
const globalItems = computed(() => props.items.filter((item) => !item.teamId))

const itemsByTeam = computed(() => {
  const teamMap = new Map<string, VolunteerHandoutItem[]>()

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
    teamName: items[0]?.team?.name || t('ticketing.handout_items.volunteer.unknown_team'),
    teamColor: items[0]?.team?.color || '#6b7280',
    items,
  }))
})

// Options pour le sélecteur d'équipe
const teamOptions = computed(() => {
  const options = [
    {
      label: t('ticketing.handout_items.volunteer.scope_all_option'),
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

/**
 * Ce qu'un bénévole de la portée choisie recevra réellement, la surcharge appliquée.
 *
 * La règle du serveur est précise et c'est elle qui est reproduite ici : une équipe ne remplace
 * le global que si elle porte AU MOINS UN article. Une équipe vide retombe donc sur le global —
 * dire « rien » serait faux, et c'est la lecture qu'on fait spontanément d'un formulaire vide.
 */
const apercuTitre = computed(() => {
  if (selectedTeamId.value === null)
    return t('ticketing.handout_items.volunteer.preview_global_title')
  const nom =
    teams.value.find((e) => e.id === selectedTeamId.value)?.name ??
    t('ticketing.handout_items.volunteer.preview_this_team')
  return t('ticketing.handout_items.volunteer.preview_team_title', { team: nom })
})

const apercuDetail = computed(() => {
  const nomsDe = (entrees: Array<{ handoutItemId: number; quantity: number }>) =>
    entrees
      .map((entree) => {
        const nom =
          allHandoutItems.value.find((a) => a.id === entree.handoutItemId)?.name ??
          `#${entree.handoutItemId}`
        return entree.quantity > 1 ? `${nom} ×${entree.quantity}` : nom
      })
      .join(', ')

  if (selection.value.length > 0) {
    const liste = nomsDe(selection.value)
    return selectedTeamId.value === null
      ? liste
      : t('ticketing.handout_items.volunteer.preview_team_replaces', { items: liste })
  }

  if (selectedTeamId.value === null) {
    return t('ticketing.handout_items.volunteer.preview_nothing_global')
  }

  const globaux = globalItems.value.map((item) => ({
    handoutItemId: item.handoutItemId,
    quantity: item.quantity ?? 1,
  }))

  return globaux.length > 0
    ? t('ticketing.handout_items.volunteer.preview_falls_back', { items: nomsDe(globaux) })
    : t('ticketing.handout_items.volunteer.preview_nothing_at_all')
})

// Charger tous les articles à remettre disponibles
const loadAllHandoutItems = async () => {
  try {
    const response = await $fetch<any>(`/api/editions/${props.editionId}/ticketing/handout-items`)
    allHandoutItems.value = response.data?.handoutItems || []
  } catch (error) {
    console.error('Failed to load all handout items:', error)
  }
}

// Charger les équipes de bénévoles
const loadTeams = async () => {
  try {
    const response = await $fetch<VolunteerTeam[]>(
      `/api/editions/${props.editionId}/volunteer-teams`
    )
    teams.value = response
  } catch (error) {
    console.error('Failed to load teams:', error)
  }
}

const { execute: executeSave, loading: saving } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/volunteers/handout-items`,
  {
    method: 'PUT',
    body: () => ({ teamId: selectedTeamId.value, handoutItemIds: selection.value }),
    successMessage: { title: t('ticketing.handout_items.volunteer.saved') },
    errorMessages: { default: t('ticketing.handout_items.volunteer.error_saving') },
    onSuccess: () => {
      emit('refresh')
    },
  }
)

const enregistrer = () => {
  executeSave()
}
</script>
