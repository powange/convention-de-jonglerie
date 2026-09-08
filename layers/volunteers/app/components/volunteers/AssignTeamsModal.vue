<script setup lang="ts">
import {
  basculerEquipe,
  effectifParEquipe,
  equipesDuBenevole,
  grouperParPreference,
} from '../../utils/equipes-du-benevole'

/**
 * Choix des équipes d'un bénévole.
 *
 * Une seule étape : les équipes actuelles arrivent cochées, on ajuste, on valide. L'écran
 * précédent demandait de choisir une équipe puis de trancher entre « déplacer » et « ajouter »
 * — deux décisions pour un seul geste, et rien qui permette d'en retirer une au passage.
 *
 * Le composant charge lui-même ce qu'il affiche : les deux pages qui l'ouvrent n'ont donc rien
 * à préparer, et les effectifs annoncés sont ceux du moment où l'on choisit.
 */
interface BenevoleProp {
  id: number
  user?: { pseudo?: string; prenom?: string | null; nom?: string | null }
  teamPreferences?: string[] | null
  teamAssignments?: Array<{ teamId: string }>
}

const props = defineProps<{
  modelValue: boolean
  editionId: number
  volunteer: BenevoleProp | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const nomAffiche = computed(() => {
  const u = props.volunteer?.user
  return [u?.prenom, u?.nom].filter(Boolean).join(' ') || u?.pseudo || ''
})

const title = computed(() =>
  props.volunteer
    ? t('pages.volunteers.team_distribution.modal.assign_title', { name: nomAffiche.value })
    : t('pages.volunteers.team_distribution.modal.assign_title_generic')
)

interface EquipeAffichee {
  id: string
  name: string
  color?: string
  maxVolunteers?: number | null
  count: number
}

const equipes = ref<EquipeAffichee[]>([])
const selection = ref<string[]>([])
const chargement = ref(false)
const enregistrement = ref(false)

/** Le bénévole a-t-il exprimé des souhaits d'équipe ? */
const aDesPreferences = computed(() => {
  const preferences = props.volunteer?.teamPreferences
  return Array.isArray(preferences) && preferences.length > 0
})

/**
 * L'équipe est-elle parmi celles que le bénévole a demandées ?
 *
 * Sans souhait exprimé, aucune ne l'est : les ranger toutes dans « Équipes souhaitées » aurait
 * fait dire au bénévole ce qu'il n'a pas dit. La modale l'annonce alors explicitement.
 */
const estPreferee = (equipe: EquipeAffichee) => {
  if (!aDesPreferences.value) return false
  const preferences = props.volunteer?.teamPreferences ?? []
  return preferences.includes(equipe.id) || preferences.includes(equipe.name)
}

const equipesGroupees = computed(() => grouperParPreference(equipes.value, estPreferee))

const cocherEquipe = (teamId: string, coche: boolean) => {
  selection.value = basculerEquipe(selection.value, teamId, coche)
}

const charger = async () => {
  chargement.value = true
  try {
    const [listeEquipes, candidatures, organisateurs] = await Promise.all([
      // L'endpoint rend un tableau nu, et non un objet `{ teams }`.
      $fetch<EquipeAffichee[]>(`/api/editions/${props.editionId}/volunteer-teams`).catch(
        () => [] as EquipeAffichee[]
      ),
      $fetch<Array<{ teamAssignments?: Array<{ teamId: string }> }>>(
        `/api/editions/${props.editionId}/volunteers/team-assignments`
      ).catch(() => []),
      $fetch<{ data?: { organizers?: Array<{ teamIds?: string[] }> } }>(
        `/api/editions/${props.editionId}/volunteers/organizers`
      )
        .then((reponse) => reponse?.data?.organizers ?? [])
        .catch(() => []),
    ])

    const effectif = effectifParEquipe(candidatures, organisateurs)
    equipes.value = listeEquipes.map((equipe) => ({
      ...equipe,
      count: effectif[equipe.id] ?? 0,
    }))
  } catch (error) {
    console.error('Erreur lors du chargement des équipes:', error)
    equipes.value = []
  } finally {
    chargement.value = false
  }
}

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) {
      selection.value = []
      return
    }
    selection.value = equipesDuBenevole(props.volunteer)
    charger()
  },
  { immediate: true }
)

const enregistrer = async () => {
  const benevole = props.volunteer
  if (!benevole) return

  enregistrement.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/volunteers/applications/${benevole.id}/teams`, {
      method: 'PATCH',
      body: { teams: selection.value },
    })
    isOpen.value = false
    emit('saved')
    toast.add({ title: t('common.saved'), color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (error: any) {
    toast.add({
      title: error?.data?.message || t('errors.error_occurred'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    enregistrement.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="title" :ui="{ content: 'sm:max-w-lg' }">
    <template #body>
      <div v-if="chargement" class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
      </div>

      <div v-else class="space-y-4">
        <div v-if="volunteer?.user" class="text-center">
          <UiUserAvatar :user="volunteer.user" size="lg" class="mx-auto mb-3" />
          <h4 class="text-lg font-medium text-gray-900 dark:text-white">
            <UiUserName :user="volunteer.user" />
          </h4>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('pages.volunteers.team_distribution.select_teams_instruction') }}
          </p>
        </div>

        <p
          v-if="equipes.length === 0"
          class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center"
        >
          {{ $t('pages.volunteers.team_distribution.no_teams') }}
        </p>

        <!-- Deux groupes : ce que le bénévole a demandé d'abord, le reste ensuite. La préférence
             n'interdit rien — bloquer les autres équipes empêchait de répondre à un besoin réel —,
             elle guide seulement le regard. -->
        <div v-else class="space-y-4 max-h-96 overflow-y-auto">
          <!-- Dit pourquoi le premier groupe manque, plutôt que de le laisser disparaître sans
               explication : un bénévole sans souhait n'est pas un bénévole dont on ignore les
               souhaits. -->
          <p v-if="!aDesPreferences" class="text-xs italic text-gray-500">
            {{ $t('pages.volunteers.team_distribution.no_preferred_teams') }}
          </p>
          <div v-for="groupe in equipesGroupees" :key="groupe.cle" class="space-y-2">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">
              {{ $t(groupe.libelle) }}
            </p>
            <label
              v-for="equipe in groupe.equipes"
              :key="equipe.id"
              class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer"
            >
              <!-- Liaison explicite plutôt qu'un tableau en `v-model` : `UCheckbox` attend un
                   booléen, et lui donner la liste cochait tout d'un coup sans jamais refléter
                   l'état réel. -->
              <UCheckbox
                :model-value="selection.includes(equipe.id)"
                @update:model-value="
                  (coche: boolean | 'indeterminate') => cocherEquipe(equipe.id, coche === true)
                "
              />
              <span
                class="size-3 rounded-full shrink-0"
                :style="{ backgroundColor: equipe.color || '#6b7280' }"
              />
              <span class="flex-1 min-w-0 text-sm font-medium truncate">{{ equipe.name }}</span>
              <!-- Effectif sur capacité, bénévoles et organisateurs confondus : c'est ce qui dit
                   où il reste une place, au moment de choisir. -->
              <span
                class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 shrink-0"
              >
                <UIcon name="i-heroicons-users" size="14" />
                {{ equipe.count
                }}<template v-if="equipe.maxVolunteers"> / {{ equipe.maxVolunteers }}</template>
              </span>
            </label>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="isOpen = false">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="enregistrement"
          :disabled="chargement || equipes.length === 0"
          @click="() => void enregistrer()"
        >
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
