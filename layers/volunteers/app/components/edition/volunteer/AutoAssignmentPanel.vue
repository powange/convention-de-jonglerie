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
            <div class="flex items-center gap-2">
              <UBadge color="warning" variant="soft" size="sm">
                {{ t('volunteers.auto_assignment.beta_badge') }}
              </UBadge>
              <UTooltip :text="t('volunteers.auto_assignment.history_title')">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-heroicons-clock"
                  :aria-label="t('volunteers.auto_assignment.history_title')"
                  @click="ouvrirLHistorique"
                />
              </UTooltip>
            </div>
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
            <!-- Indisponible tant que les réglages de l'édition ne sont pas arrivés : lancer le
                 calcul les enregistre, et ce seraient alors les valeurs par défaut affichées
                 entre-temps qui écraseraient ceux du collègue. -->
            <UButton
              color="primary"
              variant="soft"
              icon="i-heroicons-eye"
              :loading="previewLoading || !reglagesCharges"
              :disabled="!reglagesCharges"
              @click="lancerLApercu"
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

          <!-- Le second moteur : proposé à partir d'un aperçu, jamais à la place. -->
          <UAlert
            v-if="previewResult && !planAmeliore"
            color="neutral"
            variant="soft"
            icon="i-heroicons-magnifying-glass"
            :title="t('volunteers.auto_assignment.search_title')"
            :description="t('volunteers.auto_assignment.search_description')"
          >
            <template #actions>
              <UButton
                color="primary"
                variant="soft"
                icon="i-heroicons-magnifying-glass"
                :loading="rechercheLoading"
                @click="lancerLaRecherche"
              >
                {{ t('volunteers.auto_assignment.search_action') }}
              </UButton>
            </template>
          </UAlert>

          <!-- Les deux plans côte à côte : c'est l'organisateur qui tranche, pas l'algorithme. -->
          <div v-if="planGlouton && planAmeliore" class="space-y-3">
            <USeparator :label="t('volunteers.auto_assignment.compare_title')" />

            <UAlert
              v-if="!laRechercheAApporteQuelqueChose"
              color="neutral"
              variant="soft"
              icon="i-heroicons-information-circle"
              :description="t('volunteers.auto_assignment.compare_no_gain')"
            />

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                v-for="colonne in colonnesDeComparaison"
                :key="colonne.cle"
                type="button"
                class="text-left p-4 rounded-lg border-2 transition-colors"
                :class="
                  planChoisi === colonne.cle
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-default hover:border-primary-300'
                "
                :aria-pressed="planChoisi === colonne.cle"
                @click="choisirLePlan(colonne.cle)"
              >
                <div class="flex items-center justify-between mb-3">
                  <span class="font-semibold">{{ colonne.titre }}</span>
                  <UIcon
                    v-if="planChoisi === colonne.cle"
                    name="i-heroicons-check-circle-solid"
                    class="text-primary-500 text-xl"
                  />
                </div>

                <dl class="space-y-1 text-sm">
                  <div
                    v-for="ligne in colonne.indicateurs"
                    :key="ligne.libelle"
                    class="flex justify-between gap-2"
                  >
                    <dt class="text-dimmed">{{ ligne.libelle }}</dt>
                    <dd class="font-medium tabular-nums" :class="ligne.classe">
                      {{ ligne.valeur }}
                    </dd>
                  </div>
                </dl>
              </button>
            </div>

            <p class="text-xs text-dimmed">
              {{ t('volunteers.auto_assignment.compare_help') }}
            </p>
          </div>

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
                  {{ t('volunteers.auto_assignment.stat_creneaux_pourvus') }}
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
                      :model-value="assignment.confidence"
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

    <!-- L'historique des calculs. Dans une modale et non dans le panneau : on l'ouvre pour
         répondre à une question ponctuelle (« qui a lancé ça, et quand ? »), pas à chaque
         passage. -->
    <UModal
      v-model:open="historiqueOuvert"
      :title="t('volunteers.auto_assignment.history_title')"
      :description="t('volunteers.auto_assignment.history_description')"
    >
      <template #body>
        <div class="space-y-4">
          <div v-if="historiqueLoading" class="space-y-2">
            <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
          </div>

          <UAlert
            v-else-if="historique.length === 0"
            color="neutral"
            variant="soft"
            icon="i-heroicons-clock"
            :description="t('volunteers.auto_assignment.history_empty')"
          />

          <ul v-else class="divide-y divide-default">
            <li v-for="calcul in historique" :key="calcul.id" class="py-3 flex flex-col gap-1">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-sm font-medium">
                  {{ formaterDate(calcul.executedAt) }}
                </span>
                <UBadge
                  :color="calcul.undoneAt ? 'neutral' : 'primary'"
                  variant="soft"
                  size="sm"
                  :label="libelleMode(calcul.mode)"
                />
              </div>

              <p class="text-sm text-dimmed">
                {{
                  t('volunteers.auto_assignment.history_line', {
                    author: calcul.executedBy?.pseudo ?? t('common.unknown'),
                    created: calcul.createdCount,
                    deleted: calcul.deletedCount,
                  })
                }}
              </p>

              <p v-if="calcul.undoneAt" class="text-sm text-warning">
                {{
                  t('volunteers.auto_assignment.history_undone', {
                    author: calcul.undoneBy?.pseudo ?? t('common.unknown'),
                    date: formaterDate(calcul.undoneAt),
                  })
                }}
              </p>
            </li>
          </ul>

          <UPagination
            v-if="historiqueTotalPages > 1"
            v-model:page="historiquePage"
            :total="historiqueTotal"
            :items-per-page="TAILLE_PAGE_HISTORIQUE"
            class="justify-center"
          />
        </div>
      </template>
    </UModal>
  </UCollapsible>
</template>

<script setup lang="ts">
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
 * Les réglages appartiennent à l'édition, pas au navigateur.
 *
 * Il y a une dizaine de curseurs à poser, et on relance rarement l'assignation du premier coup :
 * tout ressaisir à chaque passage décourageait d'ajuster. Ils vivaient donc dans le
 * `localStorage` — ce qui les faisait repartir aux valeurs par défaut sur un autre poste, sans
 * prévenir, y compris le mode de conservation qui décide de ce qui sera détruit. Et deux
 * organisateurs pouvaient lancer le calcul avec des contraintes différentes sans le savoir.
 *
 * Ils sont désormais conservés sur l'édition, par le serveur, au moment où le calcul les
 * utilise : rien à enregistrer, et ce qui est mémorisé est exactement ce qui a servi.
 *
 * L'étalement sur les valeurs par défaut protège les réglages enregistrés avant l'ajout d'une
 * option : la valeur par défaut de la nouvelle complète l'objet stocké au lieu de le rendre
 * inutilisable.
 */
const constraints = ref<Constraints>({ ...REGLAGES_PAR_DEFAUT })

/**
 * Les réglages de l'édition sont-ils arrivés ?
 *
 * Décide si le calcul peut être lancé : tant que la réponse n'est pas là, l'écran montre les
 * valeurs par défaut, et les envoyer au serveur les ferait enregistrer à la place de celles que
 * l'édition avait déjà.
 */
const reglagesCharges = ref(false)

const chargerLesReglages = async () => {
  try {
    const reponse = await $fetch<{
      autoAssignConstraints?: Partial<Constraints> | null
    }>(`/api/editions/${props.editionId}/volunteers/settings`)
    if (reponse?.autoAssignConstraints) {
      constraints.value = {
        ...REGLAGES_PAR_DEFAUT,
        ...reponse.autoAssignConstraints,
      }
    }
  } catch {
    // Les valeurs par défaut font un point de départ valable ; un rejet non géré, lui,
    // interromprait l'hydratation de la page entière.
  } finally {
    // `finally` : un échec de lecture ne doit pas condamner le bouton. L'organisateur repart
    // alors des valeurs par défaut, ce qui reste préférable à un panneau définitivement inerte.
    reglagesCharges.value = true
  }
}

onMounted(chargerLesReglages)

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
/**
 * Les deux plans, quand le second moteur a tourné.
 *
 * `previewResult` reste ce que l'écran affiche ET ce que « Appliquer » écrira : basculer de l'un
 * à l'autre revient donc à le réaffecter, et tout le reste de l'écran suit sans rien savoir de la
 * cohabitation. C'est aussi ce qui garantit qu'on applique bien le plan qu'on regarde.
 */
const planGlouton = ref<any>(null)
const planAmeliore = ref<any>(null)
const planChoisi = ref<'glouton' | 'ameliore'>('glouton')

const choisirLePlan = (lequel: 'glouton' | 'ameliore') => {
  planChoisi.value = lequel
  previewResult.value = lequel === 'glouton' ? planGlouton.value : planAmeliore.value
}

/**
 * Les deux colonnes de comparaison.
 *
 * Seuls les indicateurs que la recherche peut bouger sont montrés : en afficher cinq dont trois
 * identiques ferait chercher la différence à l'œil. Celui qui change est mis en évidence.
 */
const colonnesDeComparaison = computed(() => {
  const construire = (cle: 'glouton' | 'ameliore', titre: string, plan: any, autre: any) => ({
    cle,
    titre,
    indicateurs: [
      {
        libelle: t('volunteers.auto_assignment.stat_creneaux_pourvus'),
        valeur: pourcentage(plan.result.stats.creneauxComplets),
        classe: ecart(plan.result.stats.creneauxComplets, autre.result.stats.creneauxComplets),
      },
      {
        libelle: t('volunteers.auto_assignment.stat_horaires_souhaites'),
        valeur: pourcentage(plan.result.stats.creneauxDansLesHorairesSouhaites),
        classe: ecart(
          plan.result.stats.creneauxDansLesHorairesSouhaites,
          autre.result.stats.creneauxDansLesHorairesSouhaites
        ),
      },
      {
        libelle: t('volunteers.auto_assignment.stat_preferences_equipe'),
        valeur: pourcentage(plan.result.stats.preferencesEquipeHonorees),
        classe: ecart(
          plan.result.stats.preferencesEquipeHonorees,
          autre.result.stats.preferencesEquipeHonorees
        ),
      },
      {
        libelle: t('volunteers.auto_assignment.stat_ecart_type'),
        valeur: heuresArrondies(plan.result.stats.ecartTypeDesHeures),
        // L'écart-type est le seul indicateur où PLUS BAS vaut mieux : la comparaison s'inverse.
        classe: ecart(
          -plan.result.stats.ecartTypeDesHeures,
          -autre.result.stats.ecartTypeDesHeures
        ),
      },
    ],
  })

  if (!planGlouton.value || !planAmeliore.value) return []
  return [
    construire(
      'glouton',
      t('volunteers.auto_assignment.compare_greedy'),
      planGlouton.value,
      planAmeliore.value
    ),
    construire(
      'ameliore',
      t('volunteers.auto_assignment.compare_search'),
      planAmeliore.value,
      planGlouton.value
    ),
  ]
})

/** Vert si cette colonne fait mieux que l'autre, gris si elles sont à égalité. */
const ecart = (valeur: number, reference: number) =>
  valeur > reference ? 'text-success' : valeur < reference ? 'text-dimmed' : ''

/** Les deux plans diffèrent-ils sur au moins un indicateur ? Sinon, inutile de faire choisir. */
const laRechercheAApporteQuelqueChose = computed(() => {
  if (!planGlouton.value || !planAmeliore.value) return false
  const a = planGlouton.value.result.stats
  const b = planAmeliore.value.result.stats
  return (
    a.creneauxDansLesHorairesSouhaites !== b.creneauxDansLesHorairesSouhaites ||
    a.preferencesEquipeHonorees !== b.preferencesEquipeHonorees ||
    a.creneauxComplets !== b.creneauxComplets ||
    a.ecartTypeDesHeures !== b.ecartTypeDesHeures
  )
})

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
      // Un nouvel aperçu repart de zéro : l'amélioration précédente portait sur un autre plan.
      planGlouton.value = response
      planAmeliore.value = null
      planChoisi.value = 'glouton'
    },
  }
)

/**
 * Le second moteur : la recherche locale.
 *
 * Elle ne remplace pas l'aperçu, elle en propose un second à côté. Mesuré : elle gagne quelques
 * points sur les horaires souhaités SANS rien céder sur les préférences d'équipe — ce qu'un
 * simple réglage de poids ne sait pas faire, puisqu'il échange l'un contre l'autre.
 */
const { execute: chercherUnMeilleurPlan, loading: rechercheLoading } = useApiAction(
  () => `/api/editions/${props.editionId}/volunteers/auto-assign`,
  {
    method: 'POST',
    body: () => ({
      constraints: constraints.value,
      ameliorerLePlan: true,
      planId: planGlouton.value?.planId ?? undefined,
    }),
    successMessage: { title: t('volunteers.auto_assignment.search_done') },
    errorMessages: {
      409: t('volunteers.auto_assignment.preview_outdated'),
      404: t('volunteers.auto_assignment.preview_gone'),
      default: t('errors.error_occurred'),
    },
    onSuccess: (response) => {
      planAmeliore.value = response
      choisirLePlan('ameliore')
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
      planGlouton.value = null
      planAmeliore.value = null
      planChoisi.value = 'glouton'
      // Le calcul qu'on vient d'appliquer devient celui qu'on peut défaire.
      // Les deux chiffres viennent du serveur : `deletedCount` était codé à zéro faute d'être
      // renvoyé, si bien que l'encart annonçait « 0 affectation effacée » après en avoir effacé
      // cinquante — sur le bouton même qui propose d'annuler.
      dernierCalcul.value = response?.journalId
        ? {
            id: response.journalId,
            executedAt: new Date().toISOString(),
            createdCount: response.creees ?? 0,
            deletedCount: response.effacees ?? 0,
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
 * L'historique des calculs déjà lancés sur cette édition.
 *
 * Le panneau ne montrait que le dernier calcul, et seulement pour proposer de l'annuler. Sur une
 * édition à plusieurs organisateurs, la question « qui a relancé le calcul, quand, et avec quel
 * mode ? » n'avait aucune réponse ailleurs que dans la base.
 */
const TAILLE_PAGE_HISTORIQUE = 10

interface CalculConsigne {
  id: string
  executedAt: string
  mode: string
  createdCount: number
  deletedCount: number
  undoneAt: string | null
  executedBy: { pseudo: string } | null
  undoneBy: { pseudo: string } | null
}

const historiqueOuvert = ref(false)
const historique = ref<CalculConsigne[]>([])
const historiqueLoading = ref(false)
const historiquePage = ref(1)
const historiqueTotal = ref(0)
const historiqueTotalPages = computed(() =>
  Math.ceil(historiqueTotal.value / TAILLE_PAGE_HISTORIQUE)
)

const chargerLHistorique = async () => {
  historiqueLoading.value = true
  try {
    const reponse = await $fetch<{
      data: CalculConsigne[]
      pagination: { totalCount: number }
    }>(`/api/editions/${props.editionId}/volunteers/auto-assign/history`, {
      query: { page: historiquePage.value, limit: TAILLE_PAGE_HISTORIQUE },
    })
    historique.value = reponse?.data ?? []
    historiqueTotal.value = reponse?.pagination?.totalCount ?? 0
  } catch {
    // Même raison que pour le dernier calcul : un rejet non géré interromprait l'hydratation.
    historique.value = []
    historiqueTotal.value = 0
  } finally {
    historiqueLoading.value = false
  }
}

const ouvrirLHistorique = () => {
  historiqueOuvert.value = true
  historiquePage.value = 1
  chargerLHistorique()
}

// Changer de page recharge, mais seulement quand la modale est ouverte : la refermer remet la
// page à 1 au prochain clic, sans déclencher de requête inutile entre-temps.
watch(historiquePage, () => {
  if (historiqueOuvert.value) chargerLHistorique()
})

const { formatDateTime } = useDateFormat()
const formaterDate = (valeur: string) => formatDateTime(valeur)

// Correspondance explicite, comme pour l'aide du mode : une clé composée à l'exécution passerait
// pour inutilisée aux yeux de l'outillage i18n.
const libelleMode = (mode: string) => {
  switch (mode) {
    case 'keep-all':
      return t('volunteers.auto_assignment.existing_mode_keep_all')
    case 'replace-all':
      return t('volunteers.auto_assignment.existing_mode_replace_all')
    default:
      return t('volunteers.auto_assignment.existing_mode_keep_manual')
  }
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

/**
 * Deux enveloppes qui ne rendent rien.
 *
 * `useApiAction` rend une promesse, qu'un gestionnaire de clic Vue n'accepte pas : le brancher
 * directement produit une erreur de typage. Celle du bouton « Aperçu » existait déjà ; autant la
 * refermer en posant la seconde plutôt que d'en ajouter une deuxième du même tonneau.
 */
const lancerLApercu = () => {
  void generatePreview()
}

const lancerLaRecherche = () => {
  void chercherUnMeilleurPlan()
}

const clearPreview = () => {
  previewResult.value = null
  planGlouton.value = null
  planAmeliore.value = null
  planChoisi.value = 'glouton'
}

// Émissions
const emit = defineEmits<{
  'assignments-applied': []
}>()
</script>
