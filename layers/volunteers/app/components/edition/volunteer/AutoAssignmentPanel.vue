<template>
  <UCollapsible class="flex flex-col gap-2 w-full">
    <UButton
      :label="t('volunteers.auto_assignment.title')"
      color="neutral"
      variant="subtle"
      trailing-icon="i-heroicons-sparkles"
      block
    />
    <template #content>
      <UCard variant="soft">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="text-primary-500" />
              {{ t('volunteers.auto_assignment.title') }}
            </h3>
            <UBadge color="warning" variant="soft" size="sm">
              {{ t('volunteers.auto_assignment.beta_badge') }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-6">
          <!-- Description -->
          <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              {{ t('volunteers.auto_assignment.description') }}
            </p>
          </div>

          <!-- Contraintes -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField
              :label="t('volunteers.auto_assignment.hours_per_volunteer')"
              :help="t('volunteers.auto_assignment.hours_per_volunteer_help')"
            >
              <UFieldGroup>
                <UButton
                  :label="t('volunteers.auto_assignment.minimum')"
                  disabled
                  variant="soft"
                  color="neutral"
                />
                <UInput
                  v-model="constraints.minHoursPerVolunteer"
                  type="number"
                  min="0"
                  max="12"
                  :placeholder="t('volunteers.auto_assignment.min_placeholder')"
                />
                <UButton
                  :label="t('volunteers.auto_assignment.maximum')"
                  disabled
                  variant="soft"
                  color="neutral"
                />
                <UInput
                  v-model="constraints.maxHoursPerVolunteer"
                  type="number"
                  min="1"
                  max="24"
                  :placeholder="t('volunteers.auto_assignment.max_placeholder')"
                />
              </UFieldGroup>
            </UFormField>

            <UFormField
              :label="t('volunteers.auto_assignment.hours_per_day')"
              :help="t('volunteers.auto_assignment.hours_per_day_help')"
            >
              <UFieldGroup>
                <UButton
                  :label="t('volunteers.auto_assignment.minimum')"
                  disabled
                  variant="soft"
                  color="neutral"
                />
                <UInput
                  v-model="constraints.minHoursPerDay"
                  type="number"
                  min="0"
                  max="8"
                  :placeholder="t('volunteers.auto_assignment.min_placeholder')"
                />
                <UButton
                  :label="t('volunteers.auto_assignment.maximum')"
                  disabled
                  variant="soft"
                  color="neutral"
                />
                <UInput
                  v-model="constraints.maxHoursPerDay"
                  type="number"
                  min="1"
                  max="12"
                  :placeholder="t('volunteers.auto_assignment.max_placeholder')"
                />
              </UFieldGroup>
            </UFormField>

            <UFormField
              :label="t('volunteers.auto_assignment.balance_teams')"
              :help="t('volunteers.auto_assignment.balance_teams_help')"
            >
              <USwitch v-model="constraints.balanceTeams" />
            </UFormField>

            <UFormField
              :label="t('volunteers.auto_assignment.respect_availability')"
              :help="t('volunteers.auto_assignment.respect_availability_help')"
            >
              <USwitch v-model="constraints.respectStrictAvailability" />
            </UFormField>

            <UFormField
              :label="t('volunteers.auto_assignment.respect_team_preferences')"
              :help="t('volunteers.auto_assignment.respect_team_preferences_help')"
            >
              <USwitch v-model="constraints.respectStrictTeamPreferences" />
            </UFormField>

            <UFormField
              :label="t('volunteers.auto_assignment.respect_assigned_teams')"
              :help="t('volunteers.auto_assignment.respect_assigned_teams_help')"
            >
              <USwitch v-model="constraints.respectStrictAssignedTeams" />
            </UFormField>

            <UFormField
              :label="t('volunteers.auto_assignment.respect_time_preferences')"
              :help="t('volunteers.auto_assignment.respect_time_preferences_help')"
            >
              <USwitch v-model="constraints.respectStrictTimePreferences" />
            </UFormField>

            <UFormField
              :label="t('volunteers.auto_assignment.preserve_show_access')"
              :help="t('volunteers.auto_assignment.preserve_show_access_help')"
            >
              <USwitch v-model="constraints.preserverAccesSpectacles" />
            </UFormField>

            <UFormField
              :label="t('volunteers.auto_assignment.allow_overtime')"
              :help="t('volunteers.auto_assignment.allow_overtime_help')"
            >
              <USwitch v-model="constraints.allowOvertime" />
            </UFormField>

            <!-- Trois sorts possibles plutôt qu'un interrupteur : le mode intermédiaire est
                 celui qui manquait, effacer ce que l'algorithme avait posé sans toucher aux
                 décisions humaines. -->
            <UFormField
              :label="t('volunteers.auto_assignment.existing_mode')"
              :help="aideModeAffectations"
              class="sm:col-span-2"
            >
              <USelect
                v-model="constraints.existingAssignmentsMode"
                :items="modesAffectationsExistantes"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Heures supplémentaires maximum (si activées) -->
          <UFormField
            v-if="constraints.allowOvertime"
            :label="t('volunteers.auto_assignment.max_overtime_hours')"
            :help="t('volunteers.auto_assignment.max_overtime_help_detailed')"
          >
            <UInput
              v-model="constraints.maxOvertimeHours"
              type="number"
              min="0"
              max="6"
              :placeholder="t('volunteers.auto_assignment.max_overtime_placeholder')"
            />
          </UFormField>

          <!-- Boutons d'action -->
          <div class="flex flex-wrap items-center gap-3">
            <UButton
              color="primary"
              variant="soft"
              icon="i-heroicons-eye"
              :loading="previewLoading"
              @click="generatePreview"
            >
              {{ t('volunteers.auto_assignment.preview') }}
            </UButton>

            <UButton
              v-if="previewResult"
              color="primary"
              icon="i-heroicons-check"
              :loading="applyLoading"
              @click="applyAssignments"
            >
              {{ t('volunteers.auto_assignment.apply') }}
            </UButton>

            <UButton
              v-if="previewResult"
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="clearPreview"
            >
              {{ t('common.cancel') }}
            </UButton>
          </div>

          <!-- Revenir sur le dernier calcul appliqué. Séparé des actions ci-dessus : ce n'est pas
               une étape du calcul, c'est le filet en dessous. -->
          <UAlert
            v-if="dernierCalcul"
            color="neutral"
            variant="soft"
            icon="i-heroicons-arrow-uturn-left"
            :title="t('volunteers.auto_assignment.undo_title')"
            :description="
              t('volunteers.auto_assignment.undo_description', {
                created: dernierCalcul.createdCount,
                deleted: dernierCalcul.deletedCount,
              })
            "
          >
            <template #actions>
              <UButton
                color="warning"
                variant="soft"
                icon="i-heroicons-arrow-uturn-left"
                :loading="undoLoading"
                @click="annulerLeCalcul"
              >
                {{ t('volunteers.auto_assignment.undo_action') }}
              </UButton>
            </template>
          </UAlert>

          <!-- Résultats de l'aperçu -->
          <div v-if="previewResult" class="space-y-4">
            <USeparator :label="t('volunteers.auto_assignment.preview_results')" />

            <!-- Statistiques -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-green-600">
                  {{ previewResult.result.assignments.length }}
                </div>
                <div class="text-sm text-green-700 dark:text-green-300">
                  {{ t('volunteers.auto_assignment.total_assignments') }}
                </div>
              </div>

              <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-blue-600">
                  {{ previewResult.result.stats.averageHoursPerVolunteer.toFixed(1) }}h
                </div>
                <div class="text-sm text-blue-700 dark:text-blue-300">
                  {{ t('volunteers.auto_assignment.average_hours') }}
                </div>
              </div>

              <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-purple-600">
                  {{ pourcentage(previewResult.result.stats.creneauxComplets) }}
                </div>
                <div class="text-sm text-purple-700 dark:text-purple-300">
                  {{ t('volunteers.auto_assignment.stat_creneaux_complets') }}
                </div>
              </div>

              <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-orange-600">
                  {{ pourcentage(previewResult.result.stats.benevolesAuMinimumDHeures) }}
                </div>
                <div class="text-sm text-orange-700 dark:text-orange-300">
                  {{ t('volunteers.auto_assignment.stat_benevoles_au_minimum') }}
                </div>
              </div>
            </div>

            <!-- Ce que les bénévoles ont obtenu de ce qu'ils demandaient. Des chiffres qui se
                 vérifient sur le planning, là où la « satisfaction » qu'ils remplacent était
                 dérivée du score — donc de l'opinion de l'algorithme sur son propre travail. -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="border border-default rounded-lg p-3 text-center">
                <div class="text-lg font-semibold">
                  {{ pourcentage(previewResult.result.stats.preferencesEquipeHonorees) }}
                </div>
                <div class="text-xs text-muted">
                  {{ t('volunteers.auto_assignment.stat_preferences_equipe') }}
                </div>
              </div>

              <div class="border border-default rounded-lg p-3 text-center">
                <div class="text-lg font-semibold">
                  {{ pourcentage(previewResult.result.stats.creneauxDansLesHorairesSouhaites) }}
                </div>
                <div class="text-xs text-muted">
                  {{ t('volunteers.auto_assignment.stat_horaires_souhaites') }}
                </div>
              </div>

              <div class="border border-default rounded-lg p-3 text-center">
                <div class="text-lg font-semibold">
                  {{ heuresArrondies(previewResult.result.stats.ecartTypeDesHeures) }}
                </div>
                <div class="text-xs text-muted">
                  {{ t('volunteers.auto_assignment.stat_ecart_type') }}
                </div>
              </div>
            </div>

            <!-- Avertissements -->
            <div v-if="previewResult.result.warnings.length > 0">
              <UAlert
                color="warning"
                variant="soft"
                :title="t('volunteers.auto_assignment.warnings')"
              >
                <ul class="list-disc list-inside space-y-1">
                  <li v-for="warning in previewResult.result.warnings" :key="warning.code">
                    {{ libelleAvertissement(warning) }}
                  </li>
                </ul>
              </UAlert>
            </div>

            <!-- Recommandations -->
            <div v-if="previewResult.result.recommendations.length > 0">
              <UAlert
                color="info"
                variant="soft"
                :title="t('volunteers.auto_assignment.recommendations')"
              >
                <ul class="list-disc list-inside space-y-1">
                  <li
                    v-for="recommendation in previewResult.result.recommendations"
                    :key="recommendation.code"
                  >
                    {{ libelleRecommandation(recommendation) }}
                  </li>
                </ul>
              </UAlert>
            </div>

            <!-- Ce qui va être effacé. En mode « tout effacer », c'est l'information la plus
                 importante de l'écran, et c'était la seule absente. -->
            <UAlert
              v-if="suppressionsPrevues.length > 0"
              color="error"
              variant="soft"
              icon="i-heroicons-trash"
              :title="
                t('volunteers.auto_assignment.deletions_title', {
                  count: suppressionsPrevues.length,
                })
              "
            >
              <template #description>
                <p v-if="suppressionsManuelles > 0" class="font-medium mb-2">
                  {{
                    t('volunteers.auto_assignment.deletions_manual_warning', {
                      count: suppressionsManuelles,
                    })
                  }}
                </p>
                <div class="space-y-1 max-h-40 overflow-y-auto">
                  <div
                    v-for="suppression in suppressionsPrevues"
                    :key="`${suppression.timeSlotId}-${suppression.userId}`"
                    class="text-xs flex flex-wrap items-center gap-x-2"
                  >
                    <span class="font-medium">{{ suppression.pseudo }}</span>
                    <span class="opacity-80">
                      {{ getSlotDisplayInfo(suppression.timeSlotId).title }} —
                      {{ getSlotDisplayInfo(suppression.timeSlotId).timeRange }}
                    </span>
                    <UBadge
                      v-if="suppression.source !== 'AUTO'"
                      color="error"
                      variant="solid"
                      size="xs"
                    >
                      {{ t('volunteers.auto_assignment.deletion_manual') }}
                    </UBadge>
                  </div>
                </div>
              </template>
            </UAlert>

            <!-- Détails des assignations -->
            <UCard>
              <template #header>
                <h4 class="font-medium">
                  {{ t('volunteers.auto_assignment.assignment_details') }}
                </h4>
              </template>

              <div class="space-y-2 max-h-60 overflow-y-auto">
                <div
                  v-for="assignment in previewResult.result.assignments"
                  :key="`${assignment.volunteerId}-${assignment.slotId}`"
                  class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <div class="flex items-center gap-2">
                    <UiUserAvatar :user="getVolunteerById(assignment.volunteerId)" size="xs" />
                    <span class="text-sm font-medium">
                      {{ getVolunteerById(assignment.volunteerId)?.pseudo }}
                    </span>
                    <UIcon name="i-heroicons-arrow-right" class="text-gray-400" size="14" />
                    <div class="flex flex-col">
                      <span class="text-sm font-medium">
                        {{ getSlotDisplayInfo(assignment.slotId).title }}
                      </span>
                      <span class="text-xs text-gray-500">
                        {{ getSlotDisplayInfo(assignment.slotId).timeRange }}
                      </span>
                      <span
                        v-if="getSlotDisplayInfo(assignment.slotId).team"
                        class="text-xs text-blue-600"
                      >
                        {{ getSlotDisplayInfo(assignment.slotId).team }}
                      </span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-1">
                    <UBadge
                      :color="getConfidenceColor(assignment.confidence)"
                      variant="soft"
                      size="xs"
                    >
                      {{ Math.round(assignment.confidence || 0) }}%
                    </UBadge>
                    <!-- Barre de progression -->
                    <UProgress
                      v-model="assignment.confidence"
                      :max="100"
                      :color="getConfidenceColor(assignment.confidence || 0)"
                      size="xs"
                      class="w-16"
                    />
                  </div>
                </div>
              </div>
            </UCard>

            <!-- Non assignés -->
            <div
              v-if="
                previewResult.result.unassigned.volunteers.length > 0 ||
                previewResult.result.unassigned.slots.length > 0
              "
            >
              <UCard>
                <template #header>
                  <h4 class="font-medium text-orange-600">
                    {{ t('volunteers.auto_assignment.unassigned') }}
                  </h4>
                </template>

                <div class="space-y-4">
                  <div v-if="previewResult.result.unassigned.volunteers.length > 0">
                    <h5 class="text-sm font-medium mb-2">
                      {{ t('volunteers.auto_assignment.unassigned_volunteers') }}
                    </h5>
                    <!-- La raison à côté du nom : c'est elle qui dit quel réglage relâcher. -->
                    <div class="flex flex-wrap gap-2">
                      <UBadge
                        v-for="volunteerId in previewResult.result.unassigned.volunteers"
                        :key="volunteerId"
                        color="warning"
                        variant="soft"
                      >
                        <span class="font-medium">{{ getVolunteerById(volunteerId)?.pseudo }}</span>
                        <span v-if="motifDe(volunteerId)" class="opacity-80">
                          — {{ libelleMotif(motifDe(volunteerId)) }}
                        </span>
                      </UBadge>
                    </div>
                  </div>

                  <div v-if="previewResult.result.unassigned.slots.length > 0">
                    <h5 class="text-sm font-medium mb-2">
                      {{ t('volunteers.auto_assignment.unassigned_slots') }}
                    </h5>
                    <div class="flex flex-wrap gap-2">
                      <UBadge
                        v-for="slotId in previewResult.result.unassigned.slots"
                        :key="slotId"
                        color="error"
                        variant="soft"
                        class="text-xs"
                      >
                        <div class="flex flex-col items-start">
                          <span class="font-medium">{{ getSlotDisplayInfo(slotId).title }}</span>
                          <span
                            v-if="getSlotDisplayInfo(slotId).timeRange"
                            class="text-xs opacity-80"
                          >
                            {{ getSlotDisplayInfo(slotId).timeRange }}
                          </span>
                          <!-- Combien de candidats chaque contrainte a écartés : la réponse à
                               « pourquoi ce créneau est-il vide ? ». -->
                          <span
                            v-for="motif in motifsDuCreneau(slotId)"
                            :key="motif.motif"
                            class="text-xs opacity-70"
                          >
                            {{ libelleMotifCompte(motif.motif, motif.candidats) }}
                          </span>
                        </div>
                      </UBadge>
                    </div>
                  </div>
                </div>
              </UCard>
            </div>
          </div>
        </div>
      </UCard>
    </template>

    <!-- Confirmation. Un UModal plutôt qu'un confirm() natif, et surtout un message qui décrit le
         mode réellement choisi. -->
    <UModal
      v-model:open="confirmationOuverte"
      :title="t('volunteers.auto_assignment.confirm_title')"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm">{{ messageDeConfirmation }}</p>

          <p class="text-sm font-medium">
            {{
              t('volunteers.auto_assignment.confirm_details', {
                count: previewResult?.result.assignments.length || 0,
              })
            }}
          </p>

          <UAlert
            v-if="suppressionsPrevues.length > 0"
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            :description="
              suppressionsManuelles > 0
                ? t('volunteers.auto_assignment.deletions_manual_warning', {
                    count: suppressionsManuelles,
                  })
                : t('volunteers.auto_assignment.deletions_title', {
                    count: suppressionsPrevues.length,
                  })
            "
          />
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="confirmationOuverte = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="applyLoading" @click="confirmerApplication">
            {{ t('volunteers.auto_assignment.apply') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </UCollapsible>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'

interface Props {
  editionId: number
  volunteers: any[]
  timeSlots: any[]
  teams?: any[]
}

interface Constraints {
  maxHoursPerVolunteer: number
  minHoursPerVolunteer: number
  maxHoursPerDay: number
  minHoursPerDay: number
  balanceTeams: boolean
  respectStrictAvailability: boolean
  respectStrictTeamPreferences: boolean
  respectStrictAssignedTeams: boolean
  respectStrictTimePreferences: boolean
  preserverAccesSpectacles: boolean
  allowOvertime: boolean
  maxOvertimeHours: number
  keepExistingAssignments: boolean
  existingAssignmentsMode: 'replace-all' | 'keep-all' | 'keep-manual'
}

const props = defineProps<Props>()
const { t, locale } = useI18n()

const REGLAGES_PAR_DEFAUT: Constraints = {
  maxHoursPerVolunteer: 8,
  minHoursPerVolunteer: 2,
  maxHoursPerDay: 6,
  minHoursPerDay: 1,
  balanceTeams: true,
  respectStrictAvailability: true,
  respectStrictTeamPreferences: false,
  respectStrictAssignedTeams: false,
  respectStrictTimePreferences: false,
  // Activée d'emblée : priver quelqu'un du seul spectacle qu'il voulait voir doit être un
  // choix délibéré de l'organisateur, pas le comportement par défaut.
  preserverAccesSpectacles: true,
  allowOvertime: false,
  maxOvertimeHours: 2,
  keepExistingAssignments: false,
  // Conserver les choix humains par défaut : effacer le travail d'un organisateur doit être
  // un geste délibéré, pas le comportement par défaut d'un bouton qu'on relance.
  existingAssignmentsMode: 'keep-manual',
}

/**
 * Les réglages survivent au rechargement de la page, édition par édition.
 *
 * Il y a une dizaine de curseurs à poser, et on relance rarement l'assignation du premier coup :
 * tout ressaisir à chaque passage décourageait d'ajuster. Chaque édition garde les siens — les
 * contraintes d'un festival de trois jours ne sont pas celles d'une rencontre d'un week-end.
 *
 * `mergeDefaults` protège les réglages enregistrés avant l'ajout d'une option : la valeur par
 * défaut de la nouvelle complète l'objet stocké au lieu de le rendre inutilisable.
 */
const constraints = useLocalStorage<Constraints>(
  `assignation-auto:${props.editionId}`,
  REGLAGES_PAR_DEFAUT,
  { mergeDefaults: true }
)

const modesAffectationsExistantes = computed(() => [
  {
    value: 'keep-manual',
    label: t('volunteers.auto_assignment.existing_mode_keep_manual'),
  },
  {
    value: 'keep-all',
    label: t('volunteers.auto_assignment.existing_mode_keep_all'),
  },
  {
    value: 'replace-all',
    label: t('volunteers.auto_assignment.existing_mode_replace_all'),
  },
])

// Correspondance explicite plutôt qu'une clé composée : l'outillage i18n ne repère pas les
// clés construites à l'exécution et les croirait inutilisées.
const aideModeAffectations = computed(() => {
  switch (constraints.value.existingAssignmentsMode) {
    case 'keep-all':
      return t('volunteers.auto_assignment.existing_mode_help_keep_all')
    case 'replace-all':
      return t('volunteers.auto_assignment.existing_mode_help_replace_all')
    default:
      return t('volunteers.auto_assignment.existing_mode_help_keep_manual')
  }
})

const previewResult = ref<any>(null)

// Fonctions utilitaires
const getVolunteerById = (id: number) => {
  return props.volunteers.find((v) => v.user.id === id)?.user
}

const getSlotById = (id: string | number) => {
  // Essayer de trouver le slot avec l'ID exact ou en convertissant les types
  return props.timeSlots.find(
    (s) => s.id === id || s.id === String(id) || String(s.id) === String(id)
  )
}

/**
 * Les dates étaient formatées en `fr-FR` en dur, sur une application qui gère treize langues : un
 * organisateur allemand lisait « samedi 1 août » au milieu d'une interface allemande.
 *
 * `locale` suit la langue choisie ; les libellés de repli passent par i18n comme le reste.
 */
const heure = (valeur: string | null | undefined) =>
  valeur
    ? new Date(valeur).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    : ''

const jour = (valeur: string | null | undefined) =>
  valeur
    ? new Date(valeur).toLocaleDateString(locale.value, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : ''

const getSlotDisplayInfo = (slotId: string | number) => {
  const slot = getSlotById(slotId)

  if (!slot) {
    return {
      title: t('volunteers.auto_assignment.slot_not_found', { id: slotId }),
      timeRange: '',
      team: '',
    }
  }

  const debut = heure(slot.start)
  const fin = heure(slot.end)
  const date = jour(slot.start)

  const timeRange =
    debut && fin ? `${date} • ${debut} - ${fin}` : date || (debut && fin ? `${debut} - ${fin}` : '')

  return {
    title: slot.title || t('volunteers.auto_assignment.slot_without_title'),
    timeRange,
    team: slot.teamId ? getTeamName(slot.teamId) : '',
  }
}

const getTeamName = (teamId: string | number) => {
  if (!teamId || !props.teams) return ''

  const team = props.teams.find(
    (t) => t.id === teamId || t.id === String(teamId) || String(t.id) === String(teamId)
  )
  return team?.name || t('volunteers.auto_assignment.team_fallback', { id: teamId })
}

const getConfidenceColor = (
  confidence: number
): 'warning' | 'primary' | 'secondary' | 'success' | 'info' | 'error' | 'neutral' | undefined => {
  if (confidence >= 80) return 'success'
  if (confidence >= 60) return 'info'
  if (confidence >= 40) return 'warning'
  return 'error'
}

// Actions
const { execute: generatePreview, loading: previewLoading } = useApiAction(
  () => `/api/editions/${props.editionId}/volunteers/auto-assign`,
  {
    method: 'POST',
    body: () => ({
      constraints: constraints.value,
      applyAssignments: false,
    }),
    successMessage: { title: t('volunteers.auto_assignment.preview_generated') },
    errorMessages: { default: t('errors.error_occurred') },
    onSuccess: (response) => {
      previewResult.value = response
    },
  }
)

const { execute: executeApplyAssignments, loading: applyLoading } = useApiAction(
  () => `/api/editions/${props.editionId}/volunteers/auto-assign`,
  {
    method: 'POST',
    body: () => ({
      constraints: constraints.value,
      applyAssignments: true,
      // L'aperçu qu'on a sous les yeux : c'est ce plan-là qui doit être écrit, et aucun autre.
      planId: previewResult.value?.planId ?? undefined,
    }),
    successMessage: {
      title: t('volunteers.auto_assignment.assignments_applied'),
      description: t('volunteers.auto_assignment.assignments_applied_description'),
    },
    errorMessages: {
      // Le planning a changé sous les pieds de l'organisateur, ou l'aperçu a trop vieilli.
      409: t('volunteers.auto_assignment.preview_outdated'),
      404: t('volunteers.auto_assignment.preview_gone'),
      default: t('errors.error_occurred'),
    },
    onSuccess: (response) => {
      previewResult.value = null
      // Le calcul qu'on vient d'appliquer devient celui qu'on peut défaire.
      dernierCalcul.value = response?.journalId
        ? {
            id: response.journalId,
            executedAt: new Date().toISOString(),
            createdCount: response.result?.assignments?.length ?? 0,
            deletedCount: 0,
          }
        : null
      emit('assignments-applied')
    },
  }
)

/**
 * Le dernier calcul encore annulable.
 *
 * Relu au montage, et pas seulement mémorisé après une application : c'est le lendemain matin
 * qu'on se rend compte qu'on s'est trompé de mode, page rechargée depuis longtemps.
 */
const dernierCalcul = ref<{
  id: string
  executedAt: string
  createdCount: number
  deletedCount: number
} | null>(null)

const chargerDernierCalcul = async () => {
  try {
    const reponse = await $fetch<{
      data?: { lastRun?: typeof dernierCalcul.value }
      lastRun?: typeof dernierCalcul.value
    }>(`/api/editions/${props.editionId}/volunteers/auto-assign/last-run`)
    dernierCalcul.value = reponse?.data?.lastRun ?? reponse?.lastRun ?? null
  } catch {
    // Le bouton d'annulation est un filet, pas une fonction vitale : s'il ne peut pas s'afficher,
    // le reste du panneau doit fonctionner quand même. Un rejet non géré ici interromprait
    // l'hydratation de la page entière.
    dernierCalcul.value = null
  }
}

onMounted(chargerDernierCalcul)

const { execute: executeUndo, loading: undoLoading } = useApiAction(
  () => `/api/editions/${props.editionId}/volunteers/auto-assign/undo`,
  {
    method: 'POST',
    body: () => ({ journalId: dernierCalcul.value?.id }),
    successMessage: { title: t('volunteers.auto_assignment.undo_done') },
    errorMessages: {
      409: t('volunteers.auto_assignment.undo_outdated'),
      404: t('volunteers.auto_assignment.undo_nothing'),
      default: t('errors.error_occurred'),
    },
    onSuccess: () => {
      dernierCalcul.value = null
      emit('assignments-applied')
    },
  }
)

const annulerLeCalcul = () => {
  if (!dernierCalcul.value) return
  if (!confirm(t('volunteers.auto_assignment.undo_confirm'))) return
  executeUndo()
}

/**
 * Le motif dominant d'un bénévole non assigné, et les contraintes qui ont vidé un créneau.
 *
 * Le moteur connaissait ces raisons et les jetait ; l'organisateur devait deviner quel réglage
 * relâcher, ce qui est précisément la question qu'il se pose devant un planning incomplet.
 */
const motifDe = (volunteerId: number) =>
  previewResult.value?.result?.refus?.parBenevole?.find(
    (refus: { volunteerId: number }) => refus.volunteerId === volunteerId
  )?.motif ?? null

const motifsDuCreneau = (slotId: string | number) =>
  previewResult.value?.result?.refus?.parCreneau?.find(
    (refus: { slotId: string }) => String(refus.slotId) === String(slotId)
  )?.motifs ?? []

/**
 * Des correspondances explicites, et non des clés composées à l'exécution.
 *
 * C'est la convention du dépôt, et elle a une raison : l'outillage i18n ne repère pas une clé
 * construite avec un gabarit, la croit inutilisée, et `--delete-unused` finirait par l'effacer.
 * Verbeux ici, mais c'est le prix d'une clé qui survit au ménage.
 */
const libelleMotif = (motif: string | null) => {
  switch (motif) {
    case 'indisponible':
      return t('volunteers.auto_assignment.motif.indisponible')
    case 'absent':
      return t('volunteers.auto_assignment.motif.absent')
    case 'equipe-non-souhaitee':
      return t('volunteers.auto_assignment.motif.equipe_non_souhaitee')
    case 'hors-equipe-assignee':
      return t('volunteers.auto_assignment.motif.hors_equipe_assignee')
    case 'hors-plage-horaire':
      return t('volunteers.auto_assignment.motif.hors_plage_horaire')
    case 'plafond-journalier':
      return t('volunteers.auto_assignment.motif.plafond_journalier')
    case 'chevauchement':
      return t('volunteers.auto_assignment.motif.chevauchement')
    case 'acces-spectacle':
      return t('volunteers.auto_assignment.motif.acces_spectacle')
    case 'plafond-heures':
      return t('volunteers.auto_assignment.motif.plafond_heures')
    default:
      return ''
  }
}

const libelleMotifCompte = (motif: string, count: number) => {
  switch (motif) {
    case 'indisponible':
      return t('volunteers.auto_assignment.motif_compte.indisponible', { count })
    case 'absent':
      return t('volunteers.auto_assignment.motif_compte.absent', { count })
    case 'equipe-non-souhaitee':
      return t('volunteers.auto_assignment.motif_compte.equipe_non_souhaitee', { count })
    case 'hors-equipe-assignee':
      return t('volunteers.auto_assignment.motif_compte.hors_equipe_assignee', { count })
    case 'hors-plage-horaire':
      return t('volunteers.auto_assignment.motif_compte.hors_plage_horaire', { count })
    case 'plafond-journalier':
      return t('volunteers.auto_assignment.motif_compte.plafond_journalier', { count })
    case 'chevauchement':
      return t('volunteers.auto_assignment.motif_compte.chevauchement', { count })
    case 'acces-spectacle':
      return t('volunteers.auto_assignment.motif_compte.acces_spectacle', { count })
    case 'plafond-heures':
      return t('volunteers.auto_assignment.motif_compte.plafond_heures', { count })
    default:
      return ''
  }
}

const libelleAvertissement = (avertissement: { code: string; params?: Record<string, number> }) => {
  switch (avertissement.code) {
    case 'unassigned_volunteers':
      return t(
        'volunteers.auto_assignment.warning.unassigned_volunteers',
        avertissement.params || {}
      )
    case 'unassigned_slots':
      return t('volunteers.auto_assignment.warning.unassigned_slots', avertissement.params || {})
    default:
      return ''
  }
}

const libelleRecommandation = (recommandation: { code: string }) => {
  switch (recommandation.code) {
    case 'adjust_constraints':
      return t('volunteers.auto_assignment.recommendation.adjust_constraints')
    case 'more_slots_or_fewer_volunteers':
      return t('volunteers.auto_assignment.recommendation.more_slots_or_fewer_volunteers')
    default:
      return ''
  }
}

/** Les indicateurs arrivent en proportions ; l'écran les montre en pourcentages. */
const pourcentage = (valeur: number | undefined) =>
  valeur === undefined ? '—' : `${Math.round(valeur * 100)} %`

const heuresArrondies = (valeur: number | undefined) =>
  valeur === undefined ? '—' : `${valeur.toFixed(1)} h`

const confirmationOuverte = ref(false)

/**
 * Ce que la confirmation annonce dépend du MODE réellement choisi.
 *
 * Elle se décidait sur `keepExistingAssignments`, l'ancien booléen resté à `false` et que plus
 * aucun champ de l'écran ne pilote depuis le passage au sélecteur de mode. Le message annonçait
 * donc toujours « cela remplacera toutes les assignations existantes », y compris dans le mode par
 * défaut, qui n'efface précisément rien de manuel. L'organisateur était alarmé à tort, et le texte
 * qu'il lisait ne décrivait pas l'action qu'il déclenchait.
 */
const messageDeConfirmation = computed(() => {
  switch (constraints.value.existingAssignmentsMode) {
    case 'keep-all':
      return t('volunteers.auto_assignment.confirm_apply_keep_all')
    case 'replace-all':
      return t('volunteers.auto_assignment.confirm_apply_replace_all')
    default:
      return t('volunteers.auto_assignment.confirm_apply_keep_manual')
  }
})

/** Ce que l'application effacerait, tel que l'aperçu l'a relevé. */
const suppressionsPrevues = computed<
  { timeSlotId: string; userId: number; source: string; pseudo: string | null }[]
>(() => previewResult.value?.suppressionsPrevues ?? [])

const suppressionsManuelles = computed(
  () => suppressionsPrevues.value.filter((s) => s.source !== 'AUTO').length
)

const applyAssignments = () => {
  if (!previewResult.value) return
  confirmationOuverte.value = true
}

const confirmerApplication = () => {
  confirmationOuverte.value = false
  executeApplyAssignments()
}

const clearPreview = () => {
  previewResult.value = null
}

// Émissions
const emit = defineEmits<{
  'assignments-applied': []
}>()
</script>
