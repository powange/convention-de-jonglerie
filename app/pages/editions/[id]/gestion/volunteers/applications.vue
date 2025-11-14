<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-document-text" class="text-green-600 dark:text-green-400" />
          Gestion des candidatures
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Consulter et traiter les candidatures de bénévoles
        </p>
      </div>

      <!-- Contenu de la gestion des candidatures -->
      <div class="space-y-6">
        <!-- Gestion des candidatures -->
        <UCard v-if="canViewVolunteersTable" variant="soft">
          <template #header>
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-2 flex-1">
                <h3 class="text-lg font-semibold flex items-center gap-2">
                  <UIcon name="i-heroicons-clipboard-document-list" class="text-primary-500" />
                  {{ t('edition.volunteers.management_title') }}
                </h3>
                <p
                  v-if="volunteersMode === 'INTERNAL'"
                  :class="`text-sm ${volunteerConfig.textClass} ${volunteerConfig.darkTextClass} flex items-center gap-2`"
                >
                  <UIcon
                    name="i-heroicons-information-circle"
                    :class="volunteerConfig.iconColorClass"
                    size="16"
                  />
                  {{
                    canManageVolunteers
                      ? t('edition.volunteers.admin_only_note')
                      : t('edition.volunteers.view_only_note')
                  }}
                </p>
              </div>
              <UButton
                v-if="canManageVolunteers && volunteersMode === 'INTERNAL'"
                color="primary"
                icon="i-heroicons-user-plus"
                @click="showAddVolunteerModal = true"
              >
                {{ t('edition.volunteers.add_volunteer') }}
              </UButton>
            </div>
          </template>

          <!-- Note visibilité + séparation avant statistiques & tableau organisateur -->
          <div v-if="volunteersMode === 'INTERNAL'">
            <!-- Statistiques -->
            <div v-if="volunteersInfo" class="mt-3 mb-3 flex flex-wrap gap-3">
              <UBadge color="neutral" variant="soft"
                >{{ t('common.total') }}: {{ volunteersInfo.counts.total || 0 }}</UBadge
              >
              <UBadge color="warning" variant="soft"
                >{{ t('edition.volunteers.status_pending') }}:
                {{ volunteersInfo.counts.PENDING || 0 }}</UBadge
              >
              <UBadge color="success" variant="soft"
                >{{ t('edition.volunteers.status_accepted') }}:
                {{ volunteersInfo.counts.ACCEPTED || 0 }}</UBadge
              >
              <UBadge color="error" variant="soft"
                >{{ t('edition.volunteers.status_rejected') }}:
                {{ volunteersInfo.counts.REJECTED || 0 }}</UBadge
              >
            </div>
          </div>

          <div class="space-y-3">
            <template v-if="volunteersMode === 'INTERNAL'">
              <div class="space-y-4">
                <!-- Tableau des bénévoles avec filtres -->
                <EditionVolunteerTable
                  v-if="isVolunteersDataReady"
                  ref="volunteerTableRef"
                  :volunteers-info="volunteersInfo"
                  :edition-id="editionId"
                  :edition="edition"
                  :can-manage-volunteers="canManageVolunteers"
                  @refresh-volunteers-info="fetchVolunteersInfo"
                  @refresh-team-assignments="fetchTeamAssignments"
                  @open-meals-modal="handleOpenMealsModal"
                />
                <div v-else class="flex justify-center py-8">
                  <p class="text-gray-500">{{ $t('common.loading') }}...</p>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="text-center py-8">
                <UIcon name="i-heroicons-link" class="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p class="text-gray-600 dark:text-gray-400 text-sm">
                  {{ t('edition.volunteers.external_mode_note') }}
                </p>
              </div>
            </template>
          </div>
        </UCard>

        <!-- Répartition par équipes (nouveau système) -->
        <UCard
          v-if="
            canViewVolunteersTable && volunteersMode === 'INTERNAL' && volunteerTeams.length > 0
          "
          variant="soft"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <div class="space-y-2">
                <h3 class="text-lg font-semibold flex items-center gap-2">
                  <UIcon :name="volunteerConfig.icon" :class="volunteerConfig.iconColorClass" />
                  {{ $t('pages.volunteers.team_distribution.title') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('pages.volunteers.team_distribution.description') }}
                </p>
              </div>
              <UButton
                :to="`/editions/${editionId}/gestion/volunteers/teams`"
                color="primary"
                variant="soft"
                size="sm"
                icon="i-heroicons-cog-6-tooth"
              >
                {{ $t('pages.volunteers.team_distribution.manage_teams') }}
              </UButton>
            </div>
          </template>

          <div v-if="acceptedVolunteers.length === 0" class="text-center py-8">
            <UIcon name="i-heroicons-user-group" class="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ $t('pages.volunteers.team_distribution.no_assignments') }}
            </p>
            <p class="text-xs text-gray-500 mt-1">
              {{ $t('pages.volunteers.team_distribution.no_assignments_description') }}
            </p>
          </div>

          <div v-else class="space-y-4">
            <!-- Statistiques générales -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div
                :class="`${volunteerConfig.bgClass} ${volunteerConfig.darkBgClass} rounded-lg p-4`"
              >
                <div class="flex items-center gap-3">
                  <UIcon
                    :name="volunteerConfig.icon"
                    :class="volunteerConfig.iconColorClass"
                    size="24"
                  />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('pages.volunteers.team_distribution.stats.total_teams') }}
                    </p>
                    <p :class="`text-xl font-semibold ${volunteerConfig.textClass}`">
                      {{ volunteerTeams.length }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-users" class="text-green-600" size="24" />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('pages.volunteers.team_distribution.stats.assigned_volunteers') }}
                    </p>
                    <p class="text-xl font-semibold text-green-600">{{ teamAssignments.length }}</p>
                  </div>
                </div>
              </div>
              <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <UIcon
                    name="i-heroicons-exclamation-triangle"
                    class="text-orange-600"
                    size="24"
                  />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('pages.volunteers.team_distribution.stats.unassigned') }}
                    </p>
                    <p class="text-xl font-semibold text-orange-600">
                      {{ unassignedVolunteers.length }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-chart-bar" class="text-purple-600" size="24" />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('pages.volunteers.team_distribution.stats.total_assignments') }}
                    </p>
                    <p class="text-xl font-semibold text-purple-600">
                      {{
                        teamAssignments.reduce(
                          (total, app) => total + (app.teamAssignments?.length || 0),
                          0
                        )
                      }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Liste des bénévoles non assignés -->
            <div v-if="unassignedVolunteers.length > 0" class="space-y-4">
              <div
                class="border border-orange-200 dark:border-orange-700 rounded-lg overflow-hidden"
              >
                <div
                  class="px-4 py-3 border-l-4 border-l-orange-400 flex items-center justify-between bg-orange-50 dark:bg-orange-900/20"
                >
                  <div class="flex items-center gap-3">
                    <UIcon
                      name="i-heroicons-exclamation-triangle"
                      class="text-orange-600"
                      size="20"
                    />
                    <div>
                      <h4 class="font-medium text-gray-900 dark:text-white">
                        {{ $t('pages.volunteers.team_distribution.unassigned_volunteers') }}
                      </h4>
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        {{ $t('pages.volunteers.team_distribution.unassigned_description') }}
                      </p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-medium">
                      {{
                        $t('pages.volunteers.team_distribution.volunteers_count', {
                          count: unassignedVolunteers.length,
                        })
                      }}
                    </p>
                  </div>
                </div>

                <!-- Liste des bénévoles non assignés -->
                <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <VolunteersVolunteerCard
                      v-for="volunteer in unassignedVolunteers"
                      :key="volunteer.id"
                      :volunteer="volunteer"
                      :team-preferences-text="
                        getTeamNamesFromPreferences(volunteer.teamPreferences)
                      "
                      :is-mobile="isMobile"
                      @click="handleVolunteerClick"
                      @dragstart="handleDragStart"
                      @dragend="handleDragEnd"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Liste des équipes avec leurs bénévoles -->
            <div class="space-y-4">
              <div
                v-for="team in teamDistribution"
                :key="team.id"
                class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all"
                :class="{
                  'border-primary-500 bg-primary-50 dark:bg-primary-900/20':
                    !isMobile && dragOverTeam === team.id,
                  'opacity-50 cursor-not-allowed':
                    !isMobile &&
                    draggedVolunteer &&
                    !isTeamInVolunteerPreferences(draggedVolunteer, team.id),
                  'border-green-300 dark:border-green-600':
                    !isMobile &&
                    draggedVolunteer &&
                    isTeamInVolunteerPreferences(draggedVolunteer, team.id),
                }"
                @dragover.prevent="!isMobile && handleDragOver(team.id)"
                @dragleave="!isMobile && handleDragLeave()"
                @drop="!isMobile && handleDrop(team.id)"
              >
                <div
                  class="px-4 py-3 border-l-4 flex items-center justify-between transition-colors"
                  :class="{
                    'bg-primary-100 dark:bg-primary-900/30': !isMobile && dragOverTeam === team.id,
                  }"
                  :style="{ borderLeftColor: team.color }"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-4 h-4 rounded-full" :style="{ backgroundColor: team.color }" />
                    <h4 class="font-medium text-gray-900 dark:text-white">{{ team.name }}</h4>
                  </div>
                  <div class="flex items-center gap-4">
                    <div class="text-right">
                      <p class="text-sm font-medium">
                        {{
                          $t('pages.volunteers.team_distribution.volunteers_count', {
                            count: team.count,
                          })
                        }}
                      </p>
                      <p v-if="team.maxVolunteers" class="text-xs text-gray-500">
                        {{ $t('pages.volunteers.team_distribution.max_label') }}
                        {{ team.maxVolunteers }}
                        <span v-if="team.utilizationRate !== null" class="ml-1">
                          ({{ team.utilizationRate }}%)
                        </span>
                      </p>
                    </div>
                    <div v-if="team.utilizationRate !== null" class="w-16">
                      <div class="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          class="h-2 rounded-full transition-all"
                          :class="{
                            'bg-green-500': team.utilizationRate <= 80,
                            'bg-yellow-500':
                              team.utilizationRate > 80 && team.utilizationRate <= 100,
                            'bg-red-500': team.utilizationRate > 100,
                          }"
                          :style="{ width: Math.min(team.utilizationRate, 100) + '%' }"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Liste des bénévoles de cette équipe -->
                <div
                  v-if="team.volunteers.length > 0"
                  class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50"
                >
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <VolunteersVolunteerCard
                      v-for="volunteer in team.volunteers"
                      :key="volunteer.id"
                      :volunteer="volunteer"
                      :team-id="team.id"
                      :team-preferences-text="
                        getTeamNamesFromPreferences(volunteer.teamPreferences)
                      "
                      :is-mobile="isMobile"
                      @click="handleVolunteerClick"
                      @dragstart="handleDragStart"
                      @dragend="handleDragEnd"
                      @toggle-leader="toggleTeamLeader"
                      @unassign="unassignFromTeam"
                    />
                  </div>
                </div>

                <!-- Message pour équipe vide avec zone de drop -->
                <div
                  v-else
                  class="px-4 py-6 bg-gray-50 dark:bg-gray-800/50 text-center border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg mx-4 mb-4"
                  :class="{
                    'border-primary-400 bg-primary-50 dark:bg-primary-900/20':
                      !isMobile && dragOverTeam === team.id,
                    'border-green-400 bg-green-50 dark:bg-green-900/20':
                      !isMobile &&
                      draggedVolunteer &&
                      isTeamInVolunteerPreferences(draggedVolunteer, team.id),
                  }"
                >
                  <UIcon name="i-heroicons-users" class="text-gray-400 mx-auto mb-2" size="24" />
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ $t('pages.volunteers.team_distribution.empty_team') }}
                  </p>
                  <p v-if="!isMobile" class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {{ $t('pages.volunteers.team_distribution.drop_volunteers_here') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Message si pas les permissions -->
        <UCard v-else>
          <div class="text-center py-12">
            <UIcon name="i-heroicons-lock-closed" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 class="text-xl font-semibold mb-2">Accès restreint</h2>
            <p class="text-gray-600 dark:text-gray-400">
              Vous n'avez pas les permissions nécessaires pour voir les candidatures de bénévoles.
            </p>
          </div>
        </UCard>

        <!-- Modal de sélection d'équipe -->
        <UModal
          v-model:open="showTeamSelectionModal"
          :title="teamSelectionModalTitle"
          @close="handleTeamSelectionModalClose"
        >
          <template #body>
            <div class="space-y-4">
              <div class="text-center">
                <UiUserAvatar
                  v-if="draggedVolunteer"
                  :user="draggedVolunteer.user"
                  size="lg"
                  class="mx-auto mb-3"
                />
                <h4 class="text-lg font-medium text-gray-900 dark:text-white">
                  {{ draggedVolunteer?.user?.prenom }} {{ draggedVolunteer?.user?.nom }}
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('pages.volunteers.team_distribution.select_team_instruction') }}
                </p>
              </div>

              <!-- Liste des équipes disponibles -->
              <div class="space-y-2 max-h-96 overflow-y-auto">
                <button
                  v-for="team in availableTeamsForSelection"
                  :key="team.id"
                  class="w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 text-left"
                  :class="{
                    'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20':
                      isTeamInVolunteerPreferences(draggedVolunteer, team.id),
                    'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed':
                      !isTeamInVolunteerPreferences(draggedVolunteer, team.id),
                  }"
                  :disabled="!isTeamInVolunteerPreferences(draggedVolunteer, team.id)"
                  @click="handleTeamSelection(team.id)"
                >
                  <div
                    class="w-4 h-4 rounded-full flex-shrink-0"
                    :style="{ backgroundColor: team.color }"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-900 dark:text-white truncate">
                      {{ team.name }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ team.count || 0 }}
                      {{
                        $t('pages.volunteers.team_distribution.volunteers_count', {
                          count: team.count || 0,
                        })
                      }}
                      <span v-if="team.maxVolunteers"> / {{ team.maxVolunteers }} </span>
                    </p>
                  </div>
                  <UIcon
                    v-if="isTeamInVolunteerPreferences(draggedVolunteer, team.id)"
                    name="i-heroicons-chevron-right"
                    class="text-gray-400"
                    size="20"
                  />
                </button>
              </div>
            </div>
          </template>

          <template #footer="{ close }">
            <div class="flex justify-center">
              <UButton color="neutral" variant="soft" @click="close">
                {{ $t('common.cancel') }}
              </UButton>
            </div>
          </template>
        </UModal>

        <!-- Modal de choix déplacer/ajouter -->
        <UModal v-model:open="showMoveModal" :title="moveModalTitle" @close="handleModalClose">
          <template #body>
            <div class="space-y-4">
              <div class="text-center">
                <UiUserAvatar
                  v-if="draggedVolunteer"
                  :user="draggedVolunteer.user"
                  size="lg"
                  class="mx-auto mb-3"
                />
                <h4 class="text-lg font-medium text-gray-900 dark:text-white">
                  {{ draggedVolunteer?.user?.prenom }} {{ draggedVolunteer?.user?.nom }}
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  <template v-if="draggedVolunteer?.teamAssignments?.length > 1">
                    {{ draggedVolunteer.teamAssignments.map((t: any) => t.team.name).join(', ') }} →
                    {{ targetTeamName }}
                  </template>
                  <template v-else> {{ sourceTeamName }} → {{ targetTeamName }} </template>
                </p>
              </div>

              <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  {{ $t('pages.volunteers.team_distribution.modal.question') }}
                </p>

                <div class="space-y-3">
                  <!-- Option Déplacer -->
                  <button
                    :class="`w-full flex items-start gap-3 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 ${volunteerConfig.hoverBgClass} ${volunteerConfig.darkHoverBgClass} transition-all duration-200 text-left group`"
                    :disabled="isProcessingMove"
                    @click="processMove('move')"
                  >
                    <div class="flex-shrink-0 mt-1">
                      <UIcon
                        name="i-heroicons-arrow-right"
                        class="text-primary-500 group-hover:text-primary-600"
                        size="16"
                      />
                    </div>
                    <div>
                      <p
                        class="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400"
                      >
                        {{ $t('pages.volunteers.team_distribution.modal.move') }}
                      </p>
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        <template v-if="draggedVolunteer?.teamAssignments?.length > 1">
                          {{
                            $t(
                              'pages.volunteers.team_distribution.modal.move_description_multiple',
                              { targetTeam: targetTeamName }
                            )
                          }}
                        </template>
                        <template v-else>
                          {{
                            $t('pages.volunteers.team_distribution.modal.move_description_single', {
                              sourceTeam: sourceTeamName,
                              targetTeam: targetTeamName,
                            })
                          }}
                        </template>
                      </p>
                    </div>
                  </button>

                  <!-- Option Ajouter -->
                  <button
                    class="w-full flex items-start gap-3 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-200 text-left group"
                    :disabled="isProcessingMove"
                    @click="processMove('add')"
                  >
                    <div class="flex-shrink-0 mt-1">
                      <UIcon
                        name="i-heroicons-plus"
                        class="text-green-500 group-hover:text-green-600"
                        size="16"
                      />
                    </div>
                    <div>
                      <p
                        class="font-medium text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400"
                      >
                        {{ $t('pages.volunteers.team_distribution.modal.add') }}
                      </p>
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        <template v-if="draggedVolunteer?.teamAssignments?.length > 1">
                          {{
                            $t(
                              'pages.volunteers.team_distribution.modal.add_description_multiple',
                              { targetTeam: targetTeamName }
                            )
                          }}
                        </template>
                        <template v-else>
                          {{
                            $t('pages.volunteers.team_distribution.modal.add_description_single', {
                              sourceTeam: sourceTeamName,
                              targetTeam: targetTeamName,
                            })
                          }}
                        </template>
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </template>

          <template #footer="{ close }">
            <div class="flex justify-center">
              <UButton color="neutral" variant="soft" @click="close">
                {{ $t('pages.volunteers.team_distribution.modal.cancel') }}
              </UButton>
            </div>
          </template>
        </UModal>
      </div>
    </div>

    <!-- Modale d'ajout de bénévole -->
    <VolunteersAddVolunteerModal
      v-model:open="showAddVolunteerModal"
      :edition-id="editionId"
      @volunteer-added="handleVolunteerAdded"
    />

    <!-- Modal de gestion des repas -->
    <VolunteersMealsModal
      v-if="selectedVolunteerForMeals"
      v-model="showVolunteerMealsModal"
      :edition-id="editionId"
      :volunteer="selectedVolunteerForMeals"
      @meals-saved="handleMealsUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useVolunteerSettings } from '~/composables/useVolunteerSettings'
import { useVolunteerTeams } from '~/composables/useVolunteerTeams'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  layout: 'edition-dashboard',
})

// Utiliser le composable pour obtenir la configuration des bénévoles
const { getParticipantTypeConfig } = useParticipantTypes()
const volunteerConfig = getParticipantTypeConfig('volunteer')

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Utiliser le composable pour les paramètres des bénévoles
const { settings: volunteersInfo, fetchSettings: fetchVolunteersInfo } =
  useVolunteerSettings(editionId)

// Variables pour le tableau des bénévoles
const volunteerTableRef = ref<any>(null)

// Mode des bénévoles
const volunteersMode = computed(() => volunteersInfo.value?.mode || 'INTERNAL')

// Computed pour vérifier que toutes les données nécessaires sont chargées
const isVolunteersDataReady = computed(() => {
  return !!(volunteersInfo.value && typeof volunteersInfo.value.askDiet !== 'undefined')
})

// Récupération des équipes et des assignations pour la nouvelle répartition
const { teams: volunteerTeams } = useVolunteerTeams(editionId)
const teamAssignments = ref<any[]>([])
const acceptedVolunteers = ref<any[]>([])
const draggedVolunteer = ref<any>(null)
const dragOverTeam = ref<string | null>(null)
const sourceTeamId = ref<string | null>(null)
const targetTeamId = ref<string | null>(null)
const showMoveModal = ref(false)
const showTeamSelectionModal = ref(false)
const isProcessingMove = ref(false)
const showAddVolunteerModal = ref(false)
const showVolunteerMealsModal = ref(false)
const selectedVolunteerForMeals = ref<any>(null)
const isMobile = ref(false)

// Fonction pour récupérer les assignations d'équipes
// Utilise une route dédiée sans pagination pour récupérer tous les bénévoles acceptés
const fetchTeamAssignments = async () => {
  try {
    const applications = await $fetch(`/api/editions/${editionId}/volunteers/team-assignments`)

    acceptedVolunteers.value = applications
    teamAssignments.value = applications.filter(
      (app: any) => app.teamAssignments && app.teamAssignments.length > 0
    )
  } catch (error) {
    console.error('Failed to fetch team assignments:', error)
  }
}

// Vérifier si une équipe est dans les préférences du bénévole
const isTeamInVolunteerPreferences = (volunteer: any, teamId: string): boolean => {
  if (
    !volunteer.teamPreferences ||
    !Array.isArray(volunteer.teamPreferences) ||
    volunteer.teamPreferences.length === 0
  ) {
    // Si pas de préférences, le bénévole peut être assigné à n'importe quelle équipe
    return true
  }

  // teamPreferences est un tableau JSON avec les IDs ou noms des équipes préférées
  // Trouver l'équipe par son ID
  const team = volunteerTeams.value.find((t) => t.id === teamId)
  if (!team) return false

  // Vérifier si l'ID ou le nom de l'équipe est dans les préférences
  return volunteer.teamPreferences.includes(teamId) || volunteer.teamPreferences.includes(team.name)
}

// Convertir les IDs/noms d'équipes en noms lisibles
const getTeamNamesFromPreferences = (teamPreferences: string[]): string => {
  if (!teamPreferences || !Array.isArray(teamPreferences)) return ''

  const names = teamPreferences.map((pref) => {
    // Chercher d'abord par ID
    const teamById = volunteerTeams.value.find((t) => t.id === pref)
    if (teamById) return teamById.name

    // Si ce n'est pas un ID, c'est peut-être déjà un nom
    const teamByName = volunteerTeams.value.find((t) => t.name === pref)
    if (teamByName) return teamByName.name

    // Si on ne trouve pas l'équipe, retourner la préférence telle quelle
    return pref
  })

  return names.join(', ')
}

// Computed pour les bénévoles non assignés
const unassignedVolunteers = computed(() => {
  if (!acceptedVolunteers.value.length) {
    return []
  }

  return acceptedVolunteers.value.filter(
    (volunteer: any) => !volunteer.teamAssignments || volunteer.teamAssignments.length === 0
  )
})

// Computed pour la répartition par équipes
const teamDistribution = computed(() => {
  if (!volunteerTeams.value.length) {
    return []
  }

  return volunteerTeams.value
    .map((team) => {
      const assignedVolunteers = teamAssignments.value.filter((app) =>
        app.teamAssignments.some((t: any) => t.teamId === team.id)
      )

      // Trier les bénévoles : responsables en premier, puis par ordre alphabétique (prénom + nom)
      const sortedVolunteers = assignedVolunteers.sort((a, b) => {
        const aIsLeader = isTeamLeader(a, team.id)
        const bIsLeader = isTeamLeader(b, team.id)

        // D'abord trier par statut de leader
        if (aIsLeader && !bIsLeader) return -1
        if (!aIsLeader && bIsLeader) return 1

        // Ensuite trier alphabétiquement par prénom + nom
        const aName = `${a.user.prenom || ''} ${a.user.nom || ''}`.trim().toLowerCase()
        const bName = `${b.user.prenom || ''} ${b.user.nom || ''}`.trim().toLowerCase()
        return aName.localeCompare(bName, 'fr')
      })

      return {
        ...team,
        volunteers: sortedVolunteers,
        count: assignedVolunteers.length,
        utilizationRate: team.maxVolunteers
          ? Math.round((assignedVolunteers.length / team.maxVolunteers) * 100)
          : null,
      }
    })
    .sort((a, b) => b.count - a.count) // Trier par nombre de bénévoles décroissant
})

// Computed pour les noms des équipes dans le modal
const sourceTeamName = computed(() => {
  // Si on a sourceTeamId (cas normal), utiliser celui-ci
  if (sourceTeamId.value) {
    // Chercher d'abord dans teamDistribution (données affichées)
    const teamInDistribution = teamDistribution.value.find((t) => t.id === sourceTeamId.value)
    if (teamInDistribution) {
      return teamInDistribution.name
    }

    // Sinon chercher dans volunteerTeams (données originales)
    const teamInList = volunteerTeams.value.find((t) => t.id === sourceTeamId.value)
    if (teamInList) {
      return teamInList.name
    }

    return 'Équipe inconnue'
  }

  // Sinon, vérifier si le bénévole a des équipes
  if (
    !draggedVolunteer.value?.teamAssignments ||
    draggedVolunteer.value.teamAssignments.length === 0
  ) {
    return 'Non assigné'
  }

  // Prendre la première équipe du bénévole
  const firstTeam = draggedVolunteer.value.teamAssignments[0]?.team
  return firstTeam?.name || 'Équipe inconnue'
})

const targetTeamName = computed(() => {
  if (!targetTeamId.value) return 'Équipe cible'

  // Chercher d'abord dans teamDistribution (données affichées)
  const teamInDistribution = teamDistribution.value.find((t) => t.id === targetTeamId.value)
  if (teamInDistribution) {
    return teamInDistribution.name
  }

  // Sinon chercher dans volunteerTeams (données originales)
  const teamInList = volunteerTeams.value.find((t) => t.id === targetTeamId.value)
  if (teamInList) {
    return teamInList.name
  }

  return 'Équipe inconnue'
})

const moveModalTitle = computed(() => {
  if (!draggedVolunteer.value) return 'Déplacer un bénévole'
  return `Déplacer ${draggedVolunteer.value.user.prenom} ${draggedVolunteer.value.user.nom}`
})

const teamSelectionModalTitle = computed(() => {
  if (!draggedVolunteer.value) return 'Sélectionner une équipe'
  return `Assigner ${draggedVolunteer.value.user.prenom} ${draggedVolunteer.value.user.nom}`
})

// Liste des équipes disponibles pour la sélection (exclure l'équipe source si elle existe)
const availableTeamsForSelection = computed(() => {
  return teamDistribution.value.filter((team) => team.id !== sourceTeamId.value)
})

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return (
    canEdit.value || canManageVolunteers.value || authStore.user?.id === edition.value?.creatorId
  )
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Condition pour voir le tableau des bénévoles
const canViewVolunteersTable = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  // Créateur de l'édition
  if (edition.value.creatorId && edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId && edition.value.convention.authorId === authStore.user.id)
    return true
  // Organisateur
  const collab = edition.value.convention?.organizers?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  return !!collab
})

// Détection du mobile
const checkIfMobile = () => {
  isMobile.value = window.innerWidth < 768 // Breakpoint md de Tailwind
}

// Fonction pour gérer le clic sur un bénévole (mobile uniquement)
const handleVolunteerClick = (volunteer: any, fromTeamId?: string) => {
  if (!isMobile.value) return // Ne rien faire sur desktop

  draggedVolunteer.value = volunteer
  sourceTeamId.value = fromTeamId || null
  showTeamSelectionModal.value = true
}

// Fonctions de drag and drop (desktop uniquement)
const handleDragStart = (volunteer: any, fromTeamId?: string) => {
  draggedVolunteer.value = volunteer
  sourceTeamId.value = fromTeamId || null
}

const handleDragEnd = () => {
  dragOverTeam.value = null

  // Ne pas reset les variables si la modal est ouverte
  if (!showMoveModal.value && !showTeamSelectionModal.value) {
    draggedVolunteer.value = null
    sourceTeamId.value = null
    targetTeamId.value = null
  }
}

const handleDragOver = (teamId: string) => {
  // Ne permettre le survol que si l'équipe est dans les préférences du bénévole
  if (draggedVolunteer.value && isTeamInVolunteerPreferences(draggedVolunteer.value, teamId)) {
    dragOverTeam.value = teamId
  }
}

const handleDragLeave = () => {
  dragOverTeam.value = null
}

const handleDrop = async (teamId: string) => {
  if (!draggedVolunteer.value) return

  // Vérifier que l'équipe est valide pour le bénévole (préférences ou pas de préférences)
  if (!isTeamInVolunteerPreferences(draggedVolunteer.value, teamId)) {
    toast.add({
      title: 'Action non autorisée',
      description: "Ce bénévole ne peut être assigné qu'aux équipes de sa préférence",
      icon: 'i-heroicons-exclamation-triangle',
      color: 'warning',
    })
    draggedVolunteer.value = null
    dragOverTeam.value = null
    return
  }

  // Vérifier si on glisse dans la même équipe - ne rien faire
  if (sourceTeamId.value === teamId) {
    draggedVolunteer.value = null
    dragOverTeam.value = null
    sourceTeamId.value = null
    targetTeamId.value = null
    return
  }

  // IMPORTANT: Définir targetTeamId AVANT d'ouvrir la modal
  targetTeamId.value = teamId

  // Si le bénévole vient d'une équipe (sourceTeamId existe) et ce n'est pas la même équipe,
  // ouvrir la modal pour choisir déplacer ou ajouter
  // Aussi vérifier si le bénévole a des équipes dans ses données
  const hasExistingTeams =
    draggedVolunteer.value.teamAssignments && draggedVolunteer.value.teamAssignments.length > 0

  if (
    (sourceTeamId.value && sourceTeamId.value !== teamId) ||
    (hasExistingTeams && !sourceTeamId.value)
  ) {
    // Utiliser nextTick pour s'assurer que les valeurs sont mises à jour avant d'ouvrir la modal
    await nextTick()
    showMoveModal.value = true
    dragOverTeam.value = null
    return
  }

  // Sinon, procéder directement à l'assignation (bénévole non assigné)
  await directAssign(teamId)
}

// Fonction pour gérer la fermeture de la modal
const handleModalClose = () => {
  // Nettoyer toutes les variables quand la modal se ferme
  draggedVolunteer.value = null
  dragOverTeam.value = null
  sourceTeamId.value = null
  targetTeamId.value = null
}

// Fonction pour gérer la fermeture de la modal de sélection d'équipe
const handleTeamSelectionModalClose = () => {
  draggedVolunteer.value = null
  dragOverTeam.value = null
  sourceTeamId.value = null
  targetTeamId.value = null
}

// Fonction pour gérer la sélection d'une équipe dans la modal
const handleTeamSelection = async (teamId: string) => {
  if (!draggedVolunteer.value) return

  // Vérifier si on sélectionne la même équipe que la source
  if (sourceTeamId.value === teamId) {
    showTeamSelectionModal.value = false
    draggedVolunteer.value = null
    sourceTeamId.value = null
    return
  }

  // Définir l'équipe cible
  targetTeamId.value = teamId

  // Fermer la modal de sélection
  showTeamSelectionModal.value = false

  // Vérifier si le bénévole a déjà des équipes assignées
  const hasExistingTeams =
    draggedVolunteer.value.teamAssignments && draggedVolunteer.value.teamAssignments.length > 0

  if (hasExistingTeams) {
    // Ouvrir la modal de choix déplacer/ajouter
    await nextTick()
    showMoveModal.value = true
  } else {
    // Assignation directe pour les bénévoles non assignés
    await directAssign(teamId)
  }
}

// Fonction pour désassigner un bénévole d'une équipe spécifique
const unassignFromTeam = async (volunteer: any, teamId: string) => {
  try {
    const volunteerName = `${volunteer.user.prenom} ${volunteer.user.nom}`
    const volunteerId = volunteer.id

    // Récupérer les équipes actuelles du bénévole
    const currentTeams = volunteer.teamAssignments?.map((t: any) => t.teamId) || []

    // Retirer l'équipe spécifiée
    const newTeams = currentTeams.filter((id: string) => id !== teamId)

    // Appeler l'API pour mettre à jour les assignations
    await $fetch(`/api/editions/${editionId}/volunteers/applications/${volunteerId}/teams`, {
      method: 'PATCH',
      body: {
        teams: newTeams,
      },
    })

    // Rafraîchir les données
    await fetchTeamAssignments()
    await fetchVolunteersInfo()

    // Rafraîchir le tableau des bénévoles
    if (volunteerTableRef.value && volunteerTableRef.value.refreshApplications) {
      await volunteerTableRef.value.refreshApplications()
    }

    // Trouver le nom de l'équipe
    const team = volunteerTeams.value.find((t) => t.id === teamId)
    const teamName = team?.name || "l'équipe"

    toast.add({
      title: 'Bénévole désassigné',
      description: `${volunteerName} a été retiré de ${teamName}`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Failed to unassign volunteer from team:', error)

    const errorMessage =
      error?.data?.message || error?.message || 'Impossible de désassigner le bénévole'

    toast.add({
      title: 'Erreur',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

// Vérifier si un bénévole est leader d'une équipe
const isTeamLeader = (volunteer: any, teamId: string): boolean => {
  if (!volunteer.teamAssignments) return false
  const assignment = volunteer.teamAssignments.find((a: any) => a.teamId === teamId)
  return assignment?.isLeader || false
}

// Toggle le statut de leader d'un bénévole pour une équipe
const toggleTeamLeader = async (volunteer: any, teamId: string) => {
  try {
    const volunteerName = `${volunteer.user.prenom} ${volunteer.user.nom}`
    const isCurrentlyLeader = isTeamLeader(volunteer, teamId)

    await $fetch(
      `/api/editions/${editionId}/volunteers/applications/${volunteer.id}/teams/${teamId}/leader`,
      {
        method: 'PATCH',
        body: {
          isLeader: !isCurrentlyLeader,
        },
      }
    )

    // Rafraîchir les données
    await fetchTeamAssignments()
    await fetchVolunteersInfo()

    // Trouver le nom de l'équipe
    const team = volunteerTeams.value.find((t) => t.id === teamId)
    const teamName = team?.name || "l'équipe"

    toast.add({
      title: isCurrentlyLeader
        ? $t('pages.volunteers.team_distribution.leader_removed')
        : $t('pages.volunteers.team_distribution.leader_added'),
      description: isCurrentlyLeader
        ? `${volunteerName} n'est plus responsable de ${teamName}`
        : `${volunteerName} est maintenant responsable de ${teamName}`,
      icon: 'i-heroicons-star',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Failed to toggle team leader:', error)

    const errorMessage =
      error?.data?.message || error?.message || 'Impossible de modifier le statut de responsable'

    toast.add({
      title: 'Erreur',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

// Fonction d'assignation directe (pour les bénévoles non assignés)
const directAssign = async (teamId: string) => {
  if (!draggedVolunteer.value) return

  try {
    // Sauvegarder les infos du bénévole avant de l'assigner
    const volunteerName = `${draggedVolunteer.value.user.prenom} ${draggedVolunteer.value.user.nom}`
    const volunteerId = draggedVolunteer.value.id

    // Assigner le bénévole à l'équipe
    await $fetch(`/api/editions/${editionId}/volunteers/applications/${volunteerId}/teams`, {
      method: 'PATCH',
      body: {
        teams: [teamId],
      },
    })

    // Rafraîchir les données
    await fetchTeamAssignments()
    await fetchVolunteersInfo()

    // Rafraîchir le tableau des bénévoles
    if (volunteerTableRef.value && volunteerTableRef.value.refreshApplications) {
      await volunteerTableRef.value.refreshApplications()
    }

    // Trouver le nom de l'équipe
    const team = volunteerTeams.value.find((t) => t.id === teamId)
    const teamName = team?.name || "l'équipe"

    toast.add({
      title: 'Bénévole assigné',
      description: `${volunteerName} a été assigné à ${teamName}`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Failed to assign volunteer to team:', error)

    // Si l'erreur contient un message spécifique, l'afficher
    const errorMessage =
      error?.data?.message || error?.message || "Impossible d'assigner le bénévole à l'équipe"

    toast.add({
      title: 'Erreur',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    draggedVolunteer.value = null
    dragOverTeam.value = null
    sourceTeamId.value = null
    targetTeamId.value = null
  }
}

// Fonction pour traiter les actions de déplacer/ajouter depuis la modal
const handleVolunteerAdded = async () => {
  toast.add({
    title: t('edition.volunteers.volunteer_added_success'),
    color: 'success',
  })
  // Recharger les données
  await fetchVolunteersInfo()
  await fetchTeamAssignments()
  // Rafraîchir le tableau si la méthode existe
  if (volunteerTableRef.value?.refreshApplications) {
    await volunteerTableRef.value.refreshApplications()
  }
}

// Fonction pour ouvrir le modal de gestion des repas
const handleOpenMealsModal = (volunteer: any) => {
  selectedVolunteerForMeals.value = volunteer
  showVolunteerMealsModal.value = true
}

// Fonction après la mise à jour des repas
const handleMealsUpdated = async () => {
  // Rafraîchir le tableau si la méthode existe
  if (volunteerTableRef.value?.refreshApplications) {
    await volunteerTableRef.value.refreshApplications()
  }
}

const processMove = async (action: 'move' | 'add') => {
  if (!draggedVolunteer.value || !targetTeamId.value) return

  isProcessingMove.value = true

  try {
    const volunteerName = `${draggedVolunteer.value.user.prenom} ${draggedVolunteer.value.user.nom}`
    const volunteerId = draggedVolunteer.value.id

    let newTeams: string[] = []

    if (action === 'move') {
      // Déplacer : assigner uniquement à la nouvelle équipe
      newTeams = [targetTeamId.value]
    } else {
      // Ajouter : garder les équipes existantes et ajouter la nouvelle
      const currentTeams = draggedVolunteer.value.teamAssignments?.map((t: any) => t.teamId) || []
      newTeams = [...currentTeams, targetTeamId.value]
      // Enlever les doublons au cas où
      newTeams = [...new Set(newTeams)]
    }

    // Appeler l'API pour mettre à jour les assignations
    await $fetch(`/api/editions/${editionId}/volunteers/applications/${volunteerId}/teams`, {
      method: 'PATCH',
      body: {
        teams: newTeams,
      },
    })

    // Rafraîchir les données
    await fetchTeamAssignments()
    await fetchVolunteersInfo()

    // Rafraîchir le tableau des bénévoles
    if (volunteerTableRef.value && volunteerTableRef.value.refreshApplications) {
      await volunteerTableRef.value.refreshApplications()
    }

    // Message de succès
    const actionText = action === 'move' ? 'déplacé vers' : 'ajouté à'
    toast.add({
      title: 'Opération réussie',
      description: `${volunteerName} a été ${actionText} ${targetTeamName.value}`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Fermer la modal et nettoyer les variables
    showMoveModal.value = false
    draggedVolunteer.value = null
    dragOverTeam.value = null
    sourceTeamId.value = null
    targetTeamId.value = null
  } catch (error: any) {
    console.error('Failed to process move/add:', error)

    const errorMessage =
      error?.data?.message || error?.message || "Impossible de traiter l'opération"

    toast.add({
      title: 'Erreur',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    // En cas d'erreur, fermer quand même la modal et nettoyer
    showMoveModal.value = false
    draggedVolunteer.value = null
    dragOverTeam.value = null
    sourceTeamId.value = null
    targetTeamId.value = null
  } finally {
    isProcessingMove.value = false
  }
}

// Watcher pour nettoyer les variables quand la modal se ferme
watch(showMoveModal, (newValue) => {
  if (!newValue) {
    // Nettoyer les variables quand la modal se ferme
    draggedVolunteer.value = null
    dragOverTeam.value = null
    sourceTeamId.value = null
    targetTeamId.value = null
    isProcessingMove.value = false
  }
})

// Charger l'édition si nécessaire
onMounted(async () => {
  // Détecter si on est sur mobile
  checkIfMobile()
  window.addEventListener('resize', checkIfMobile)

  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  // Charger les informations des bénévoles
  await fetchVolunteersInfo()
  // Charger les assignations d'équipes
  await fetchTeamAssignments()
})

// Nettoyer le listener au démontage
onUnmounted(() => {
  window.removeEventListener('resize', checkIfMobile)
})

// Métadonnées de la page
useSeoMeta({
  title: 'Gestion des candidatures - ' + (edition.value?.name || 'Édition'),
  description: 'Gestion et traitement des candidatures de bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
