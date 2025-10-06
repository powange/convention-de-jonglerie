<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
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
      <EditionHeader :edition="edition" current-page="gestion" />

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
                  {{ t('editions.volunteers.management_title') }}
                </h3>
                <p
                  v-if="volunteersMode === 'INTERNAL'"
                  class="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2"
                >
                  <UIcon name="i-heroicons-information-circle" class="text-blue-500" size="16" />
                  {{
                    canManageVolunteers
                      ? t('editions.volunteers.admin_only_note')
                      : t('editions.volunteers.view_only_note')
                  }}
                </p>
              </div>
              <UButton
                v-if="canManageVolunteers && volunteersMode === 'INTERNAL'"
                color="primary"
                icon="i-heroicons-user-plus"
                @click="showAddVolunteerModal = true"
              >
                {{ t('editions.volunteers.add_volunteer') }}
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
                >{{ t('editions.volunteers.status_pending') }}:
                {{ volunteersInfo.counts.PENDING || 0 }}</UBadge
              >
              <UBadge color="success" variant="soft"
                >{{ t('editions.volunteers.status_accepted') }}:
                {{ volunteersInfo.counts.ACCEPTED || 0 }}</UBadge
              >
              <UBadge color="error" variant="soft"
                >{{ t('editions.volunteers.status_rejected') }}:
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
                  :can-manage-volunteers="canManageVolunteers"
                  @refresh-volunteers-info="fetchVolunteersInfo"
                  @refresh-team-assignments="fetchTeamAssignments"
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
                  {{ t('editions.volunteers.external_mode_note') }}
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
                  <UIcon name="i-heroicons-user-group" class="text-blue-600" />
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
              <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-user-group" class="text-blue-600" size="24" />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('pages.volunteers.team_distribution.stats.total_teams') }}
                    </p>
                    <p class="text-xl font-semibold text-blue-600">{{ volunteerTeams.length }}</p>
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
                    <div
                      v-for="volunteer in unassignedVolunteers"
                      :key="volunteer.id"
                      draggable="true"
                      class="flex items-center gap-3 text-sm cursor-move hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded"
                      @dragstart="handleDragStart(volunteer)"
                      @dragend="handleDragEnd"
                    >
                      <UIcon name="i-heroicons-bars-3" class="text-gray-400" size="16" />
                      <UiUserAvatar :user="volunteer.user" size="sm" class="flex-shrink-0" />
                      <div class="min-w-0 flex-1">
                        <p class="text-gray-700 dark:text-gray-300 font-medium truncate">
                          {{ volunteer.user.prenom }} {{ volunteer.user.nom }}
                        </p>
                        <p class="text-xs text-gray-500 truncate">{{ volunteer.user.email }}</p>
                        <div class="flex items-center gap-1 mt-1">
                          <div
                            v-if="volunteer.teamPreferences && volunteer.teamPreferences.length > 0"
                            class="flex items-center gap-1"
                          >
                            <UIcon name="i-heroicons-heart" class="text-red-500" size="12" />
                            <span class="text-xs text-gray-600 dark:text-gray-400">
                              {{ $t('pages.volunteers.team_distribution.preferences_label') }}
                              {{ getTeamNamesFromPreferences(volunteer.teamPreferences) }}
                            </span>
                          </div>
                          <div v-else class="flex items-center gap-1">
                            <UIcon name="i-heroicons-globe-alt" class="text-blue-500" size="12" />
                            <span class="text-xs text-blue-600 dark:text-blue-400">
                              {{ $t('pages.volunteers.team_distribution.all_teams') }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
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
                    dragOverTeam === team.id,
                  'opacity-50 cursor-not-allowed':
                    draggedVolunteer && !isTeamInVolunteerPreferences(draggedVolunteer, team.id),
                  'border-green-300 dark:border-green-600':
                    draggedVolunteer && isTeamInVolunteerPreferences(draggedVolunteer, team.id),
                }"
                @dragover.prevent="handleDragOver(team.id)"
                @dragleave="handleDragLeave"
                @drop="handleDrop(team.id)"
              >
                <div
                  class="px-4 py-3 border-l-4 flex items-center justify-between transition-colors"
                  :class="{
                    'bg-primary-100 dark:bg-primary-900/30': dragOverTeam === team.id,
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
                    <div
                      v-for="volunteer in team.volunteers"
                      :key="volunteer.id"
                      draggable="true"
                      class="relative flex items-center gap-3 text-sm cursor-move hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded group"
                      @dragstart="handleDragStart(volunteer, team.id)"
                      @dragend="handleDragEnd"
                    >
                      <UIcon name="i-heroicons-bars-3" class="text-gray-400" size="16" />
                      <UiUserAvatar :user="volunteer.user" size="sm" class="flex-shrink-0" />
                      <div class="min-w-0 flex-1">
                        <p class="text-gray-700 dark:text-gray-300 font-medium truncate">
                          {{ volunteer.user.prenom }} {{ volunteer.user.nom }}
                        </p>
                        <p class="text-xs text-gray-500 truncate">{{ volunteer.user.email }}</p>
                        <div class="flex items-center gap-1 mt-1">
                          <div
                            v-if="volunteer.teamPreferences && volunteer.teamPreferences.length > 0"
                            class="flex items-center gap-1"
                          >
                            <UIcon name="i-heroicons-heart" class="text-red-500" size="12" />
                            <span class="text-xs text-gray-600 dark:text-gray-400">
                              {{ $t('pages.volunteers.team_distribution.preferences_label') }}
                              {{ getTeamNamesFromPreferences(volunteer.teamPreferences) }}
                            </span>
                          </div>
                          <div v-else class="flex items-center gap-1">
                            <UIcon name="i-heroicons-globe-alt" class="text-blue-500" size="12" />
                            <span class="text-xs text-blue-600 dark:text-blue-400">
                              {{ $t('pages.volunteers.team_distribution.all_teams') }}
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- Badge responsable visible si leader -->
                      <UBadge
                        v-if="isTeamLeader(volunteer, team.id)"
                        color="warning"
                        size="sm"
                        class="ml-auto"
                      >
                        <UIcon name="i-heroicons-star-solid" size="12" />
                        {{ $t('pages.volunteers.team_distribution.leader_badge') }}
                      </UBadge>

                      <!-- Boutons au survol -->
                      <div
                        class="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                      >
                        <!-- Toggle responsable -->
                        <UButton
                          :icon="
                            isTeamLeader(volunteer, team.id)
                              ? 'i-heroicons-star-solid'
                              : 'i-heroicons-star'
                          "
                          size="sm"
                          :color="isTeamLeader(volunteer, team.id) ? 'warning' : 'neutral'"
                          variant="outline"
                          :title="
                            isTeamLeader(volunteer, team.id)
                              ? $t('pages.volunteers.team_distribution.remove_as_leader')
                              : $t('pages.volunteers.team_distribution.set_as_leader')
                          "
                          @click.stop="toggleTeamLeader(volunteer, team.id)"
                        />
                        <!-- Désassigner -->
                        <UButton
                          icon="material-symbols-light:delete-outline"
                          size="sm"
                          color="error"
                          variant="outline"
                          @click.stop="unassignFromTeam(volunteer, team.id)"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Message pour équipe vide avec zone de drop -->
                <div
                  v-else
                  class="px-4 py-6 bg-gray-50 dark:bg-gray-800/50 text-center border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg mx-4 mb-4"
                  :class="{
                    'border-primary-400 bg-primary-50 dark:bg-primary-900/20':
                      dragOverTeam === team.id,
                    'border-green-400 bg-green-50 dark:bg-green-900/20':
                      draggedVolunteer && isTeamInVolunteerPreferences(draggedVolunteer, team.id),
                  }"
                >
                  <UIcon name="i-heroicons-users" class="text-gray-400 mx-auto mb-2" size="24" />
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ $t('pages.volunteers.team_distribution.empty_team') }}
                  </p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
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
                    {{ draggedVolunteer.teamAssignments.map((t) => t.team.name).join(', ') }} →
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
                    class="w-full flex items-start gap-3 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 text-left group"
                    :disabled="isProcessingMove"
                    @click="processMove('move')"
                  >
                    <div class="flex-shrink-0 mt-1">
                      <UIcon
                        name="i-heroicons-arrow-right"
                        class="text-blue-500 group-hover:text-blue-600"
                        size="16"
                      />
                    </div>
                    <div>
                      <p
                        class="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400"
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useVolunteerSettings } from '~/composables/useVolunteerSettings'
import { useVolunteerTeams } from '~/composables/useVolunteerTeams'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

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
const isProcessingMove = ref(false)
const showAddVolunteerModal = ref(false)

// Fonction pour récupérer les assignations d'équipes
const fetchTeamAssignments = async () => {
  try {
    const response = await $fetch(`/api/editions/${editionId}/volunteers/applications`, {
      query: { includeTeams: 'true', status: 'ACCEPTED' },
    })
    const applications = (response as any).applications || response

    console.log('📊 Applications récupérées:', applications.length)
    console.log('📊 Première application:', applications[0])

    acceptedVolunteers.value = applications.filter((app: any) => app.status === 'ACCEPTED')
    teamAssignments.value = applications.filter(
      (app: any) =>
        app.status === 'ACCEPTED' && app.teamAssignments && app.teamAssignments.length > 0
    )

    console.log('✅ Accepted volunteers:', acceptedVolunteers.value.length)
    console.log('✅ Team assignments:', teamAssignments.value.length)
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
    let team = teamDistribution.value.find((t) => t.id === sourceTeamId.value)
    if (team) {
      return team.name
    }

    // Sinon chercher dans volunteerTeams (données originales)
    team = volunteerTeams.value.find((t) => t.id === sourceTeamId.value)
    if (team) {
      return team.name
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
  let team = teamDistribution.value.find((t) => t.id === targetTeamId.value)
  if (team) {
    return team.name
  }

  // Sinon chercher dans volunteerTeams (données originales)
  team = volunteerTeams.value.find((t) => t.id === targetTeamId.value)
  if (team) {
    return team.name
  }

  return 'Équipe inconnue'
})

const moveModalTitle = computed(() => {
  if (!draggedVolunteer.value) return 'Déplacer un bénévole'
  return `Déplacer ${draggedVolunteer.value.user.prenom} ${draggedVolunteer.value.user.nom}`
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
  // Collaborateur
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  return !!collab
})

// Fonctions de drag and drop
const handleDragStart = (volunteer: any, fromTeamId?: string) => {
  draggedVolunteer.value = volunteer
  sourceTeamId.value = fromTeamId || null
}

const handleDragEnd = () => {
  dragOverTeam.value = null

  // Ne pas reset les variables si la modal est ouverte
  // car ces valeurs sont nécessaires pour les actions dans la modal
  if (!showMoveModal.value) {
    draggedVolunteer.value = null
    sourceTeamId.value = null
    targetTeamId.value = null
  }
}

// Fonction pour gérer la fermeture de la modal
const handleModalClose = () => {
  // Nettoyer toutes les variables quand la modal se ferme
  draggedVolunteer.value = null
  dragOverTeam.value = null
  sourceTeamId.value = null
  targetTeamId.value = null
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
    title: t('editions.volunteers.volunteer_added_success'),
    color: 'success',
  })
  // Recharger les données
  await fetchVolunteersInfo()
  await fetchTeamAssignments()
  // Rafraîchir le tableau
  if (volunteerTableRef.value?.refresh) {
    volunteerTableRef.value.refresh()
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

// Métadonnées de la page
useSeoMeta({
  title: 'Gestion des candidatures - ' + (edition.value?.name || 'Édition'),
  description: 'Gestion et traitement des candidatures de bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
