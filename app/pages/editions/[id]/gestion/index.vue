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

      <!-- Contenu de gestion -->
      <div class="space-y-6">
        <!-- Actions de gestion -->
        <UCard v-if="hasManagementActions">
          <div class="space-y-4">
            <h2 class="text-lg font-semibold">{{ $t('common.actions') }}</h2>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="canEdit"
                icon="i-heroicons-pencil"
                color="warning"
                :to="`/editions/${edition.id}/edit`"
              >
                {{ $t('pages.management.edit_edition') }}
              </UButton>
              <UButton
                v-if="canEdit && edition.isOnline"
                :icon="'i-heroicons-eye-slash'"
                color="secondary"
                variant="soft"
                @click="toggleOnlineStatus(false)"
              >
                {{ $t('editions.set_offline') }}
              </UButton>
              <UButton
                v-else-if="canEdit && !edition.isOnline"
                :icon="'i-heroicons-globe-alt'"
                color="primary"
                @click="toggleOnlineStatus(true)"
              >
                {{ $t('editions.set_online') }}
              </UButton>
              <UButton
                v-if="canDelete"
                icon="i-heroicons-trash"
                color="error"
                variant="soft"
                @click="deleteEdition(edition.id)"
              >
                {{ $t('pages.management.delete_edition') }}
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Collaborateurs -->
        <UCard v-if="canManageCollaborators">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-user-group" class="text-purple-500" />
                <h2 class="text-lg font-semibold">{{ $t('collaborators.title') }}</h2>
              </div>
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-heroicons-plus"
                @click="openAddCollaboratorModal"
              >
                {{ $t('common.add') }}
              </UButton>
            </div>

            <!-- Liste des collaborateurs -->
            <div
              v-if="
                edition.convention?.collaborators && edition.convention.collaborators.length > 0
              "
            >
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="collaborator in edition.convention?.collaborators"
                  :key="collaborator.id"
                  :color="getCollaboratorBadgeColor(collaborator)"
                  variant="subtle"
                  class="flex items-center gap-2 cursor-pointer hover:bg-opacity-80 transition-colors"
                  @click="openEditCollaboratorModal(collaborator)"
                >
                  <div class="flex items-center gap-1.5">
                    <UiUserAvatar :user="collaborator.user" size="sm" />
                    <span>{{ collaborator.user?.pseudo || '' }}</span>
                    <span
                      v-if="collaborator.title && collaborator.title.trim()"
                      class="text-xs opacity-75"
                    >
                      ({{ collaborator.title.trim() }})
                    </span>
                  </div>
                </UBadge>
              </div>
            </div>
            <div v-else class="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <UIcon name="i-heroicons-user-group" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">{{ $t('collaborators.no_collaborators') }}</p>
            </div>
          </div>
        </UCard>

        <!-- Gestion bénévole -->
        <UCard v-if="isCollaborator || isTeamLeaderValue">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user-group" class="text-primary-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('editions.ticketing.volunteer_management') }}
              </h2>
            </div>

            <!-- Mode de gestion des bénévoles -->
            <div
              v-if="canEdit || canManageVolunteers"
              class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
            >
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {{ $t('editions.volunteers.management_mode') }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Choisissez comment gérer les bénévoles pour cette édition
                  </p>
                </div>
                <UBadge
                  :color="volunteersModeLocal === 'INTERNAL' ? 'primary' : 'warning'"
                  variant="soft"
                  size="sm"
                >
                  {{ volunteersModeLocal === 'INTERNAL' ? 'Interne' : 'Externe' }}
                </UBadge>
              </div>

              <UFormField>
                <URadioGroup
                  v-model="volunteersModeLocal"
                  :items="volunteerModeItems"
                  size="lg"
                  class="flex flex-row gap-6"
                  :disabled="!(canEdit || canManageVolunteers)"
                  @update:model-value="handleChangeMode"
                />
              </UFormField>

              <!-- Lien externe pour mode externe -->
              <div v-if="volunteersModeLocal === 'EXTERNAL'" class="pt-2">
                <UFormField
                  :label="$t('editions.volunteers.external_link')"
                  :error="fieldErrors.externalUrl"
                >
                  <UInput
                    v-model="volunteersExternalUrlLocal"
                    :placeholder="$t('editions.volunteers.external_url_placeholder')"
                    :disabled="!(canEdit || canManageVolunteers)"
                    class="w-full"
                    @blur="(canEdit || canManageVolunteers) && persistVolunteerSettings()"
                    @keydown.enter.prevent="
                      (canEdit || canManageVolunteers) && persistVolunteerSettings()
                    "
                  />
                </UFormField>
                <p class="text-xs text-gray-500 mt-1">
                  Lien vers votre formulaire ou outil externe de gestion des bénévoles
                </p>
              </div>
            </div>

            <!-- Ouverture des candidatures -->
            <div
              v-if="canEdit || canManageVolunteers"
              class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
            >
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    Ouverture des candidatures
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Activez ou désactivez les candidatures de bénévoles
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge :color="volunteersOpenLocal ? 'success' : 'neutral'" variant="soft">
                    {{
                      volunteersOpenLocal
                        ? $t('common.active') || 'Actif'
                        : $t('common.inactive') || 'Inactif'
                    }}
                  </UBadge>
                </div>
              </div>

              <div v-if="canEdit || canManageVolunteers" class="flex items-center gap-3">
                <USwitch
                  v-model="volunteersOpenLocal"
                  :disabled="savingVolunteers"
                  color="primary"
                  @update:model-value="handleToggleOpen"
                />
                <span
                  :class="
                    volunteersOpenLocal
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  "
                >
                  {{
                    volunteersOpenLocal
                      ? $t('editions.volunteers.open')
                      : $t('editions.volunteers.closed_message')
                  }}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Page bénévoles -->
              <ManagementNavigationCard
                v-if="canEdit || canManageVolunteers"
                :to="`/editions/${edition.id}/gestion/volunteers/page`"
                icon="i-heroicons-clipboard-document-list"
                :title="$t('editions.volunteers.volunteer_page')"
                :description="$t('editions.volunteers.page_description')"
                color="indigo"
              />

              <!-- Liens visibles uniquement en mode interne -->
              <template v-if="volunteersModeLocal === 'INTERNAL'">
                <!-- Formulaire d'appel à bénévole -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers"
                  :to="`/editions/${edition.id}/gestion/volunteers/form`"
                  icon="i-heroicons-megaphone"
                  :title="$t('editions.volunteers.volunteer_form')"
                  :description="$t('editions.volunteers.form_description')"
                  color="blue"
                />

                <!-- Gestion des candidatures -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers"
                  :to="`/editions/${edition.id}/gestion/volunteers/applications`"
                  icon="i-heroicons-document-text"
                  :title="$t('editions.volunteers.application_management')"
                  description="Consulter et traiter les candidatures"
                  color="green"
                />

                <!-- Les équipes -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers"
                  :to="`/editions/${edition.id}/gestion/volunteers/teams`"
                  icon="i-heroicons-user-group"
                  :title="$t('editions.volunteers.teams')"
                  description="Organiser les équipes de bénévoles"
                  color="purple"
                />

                <!-- Planning (pas visible pour les team leaders seuls) -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers"
                  :to="`/editions/${edition.id}/gestion/volunteers/planning`"
                  icon="i-heroicons-calendar-days"
                  :title="$t('editions.volunteers.planning')"
                  description="Planifier les créneaux et missions"
                  color="orange"
                />

                <!-- Notifications bénévoles (visible pour les team leaders) -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers || isTeamLeaderValue"
                  :to="`/editions/${edition.id}/gestion/volunteers/notifications`"
                  icon="i-heroicons-bell"
                  :title="$t('editions.volunteers.volunteer_notifications')"
                  description="Envoyer des notifications aux bénévoles"
                  color="yellow"
                />

                <!-- Outils de gestion (pas visible pour les team leaders seuls) -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers"
                  :to="`/editions/${edition.id}/gestion/volunteers/tools`"
                  icon="i-heroicons-wrench-screwdriver"
                  :title="$t('editions.volunteers.management_tools')"
                  description="Outils avancés et génération de documents"
                  color="gray"
                />
              </template>
            </div>
          </div>
        </UCard>

        <!-- Repas -->
        <UCard v-if="isCollaborator">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cake" class="text-orange-500" />
              <h2 class="text-lg font-semibold">Repas</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Configuration des repas -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/meals`"
                icon="i-heroicons-cake"
                title="Configuration des repas"
                description="Gérer les repas pour bénévoles et artistes"
                color="orange"
              />
            </div>
          </div>
        </UCard>

        <!-- Billeterie -->
        <UCard v-if="isCollaborator">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-ticket" class="text-blue-500" />
              <h2 class="text-lg font-semibold">Billeterie</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Lier une billeterie externe -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/external`"
                icon="i-heroicons-link"
                title="Lier une billeterie externe"
                description="Connecter HelloAsso ou autre plateforme"
                color="purple"
              />

              <!-- Gérer les tarifs et options -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/tiers`"
                icon="i-heroicons-currency-euro"
                title="Tarifs, options & quotas"
                description="Gérer les tarifs, options, quotas et articles à restituer"
                color="orange"
              />

              <!-- Gérer les commandes -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/orders`"
                icon="i-heroicons-shopping-cart"
                title="Commandes"
                description="Consulter les commandes et participants"
                color="green"
              />

              <!-- Contrôle d'accès -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/access-control`"
                icon="i-heroicons-shield-check"
                title="Contrôle d'accès"
                description="Scanner et valider les billets à l'entrée"
                color="blue"
              />
            </div>
          </div>
        </UCard>

        <!-- Gestion des artistes -->
        <UCard v-if="isCollaborator">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-star" class="text-yellow-500" />
              <h2 class="text-lg font-semibold">{{ $t('edition.artists.title') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Liste des artistes -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/artists`"
                icon="i-heroicons-users"
                :title="$t('edition.artists.list_title')"
                :description="
                  $t(
                    'edition.artists.manage_artists_description',
                    'Gérer les artistes et leurs informations'
                  )
                "
                color="yellow"
              />

              <!-- Gestion des spectacles -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/artists/shows`"
                icon="i-heroicons-sparkles"
                :title="$t('edition.shows.list_title')"
                :description="
                  $t('edition.shows.manage_shows_description', 'Créer et organiser les spectacles')
                "
                color="purple"
              />
            </div>
          </div>
        </UCard>

        <!-- Workshops -->
        <UCard v-if="isCollaborator">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-academic-cap" class="text-green-500" />
                <h2 class="text-lg font-semibold">Workshops</h2>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  v-if="canEdit && workshopsEnabledLocal"
                  size="sm"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-photo"
                  @click="openImportWorkshopsModal"
                >
                  {{ $t('workshops.import_from_image') }}
                </UButton>
                <UBadge :color="workshopsEnabledLocal ? 'success' : 'neutral'" variant="soft">
                  {{
                    workshopsEnabledLocal
                      ? $t('common.active') || 'Actif'
                      : $t('common.inactive') || 'Inactif'
                  }}
                </UBadge>
              </div>
            </div>

            <div
              v-if="canEdit"
              class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
            >
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">Activer les workshops</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Permettre aux participants et bénévoles de créer des workshops
                </p>
              </div>
              <USwitch
                v-model="workshopsEnabledLocal"
                :disabled="savingWorkshops"
                color="primary"
                @update:model-value="handleToggleWorkshops"
              />
            </div>

            <div v-if="workshopsEnabledLocal">
              <UAlert
                title="Les workshops sont activés"
                description="Les participants et bénévoles peuvent maintenant créer des workshops pour cette édition"
                icon="i-heroicons-academic-cap"
                color="success"
                variant="subtle"
              />

              <!-- Gestion des lieux -->
              <div class="mt-6 space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="font-medium text-gray-900 dark:text-white">
                      {{ $t('workshops.locations') }}
                    </h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('workshops.locations_description') }}
                    </p>
                  </div>
                </div>

                <!-- Mode de saisie -->
                <div
                  v-if="canEdit"
                  class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                >
                  <div>
                    <h4 class="font-medium text-gray-900 dark:text-white">
                      {{ $t('workshops.location_mode') }}
                    </h4>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{
                        workshopLocationsFreeInputLocal
                          ? $t('workshops.location_mode_free_description')
                          : $t('workshops.location_mode_exclusive_description')
                      }}
                    </p>
                  </div>
                  <USwitch
                    v-model="workshopLocationsFreeInputLocal"
                    :disabled="savingLocationMode"
                    color="primary"
                    @update:model-value="handleToggleLocationMode"
                  />
                </div>

                <!-- Liste des lieux -->
                <div v-if="workshopLocations.length > 0" class="space-y-2">
                  <div
                    v-for="location in workshopLocations"
                    :key="location.id"
                    class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <span class="text-sm text-gray-900 dark:text-white">{{ location.name }}</span>
                    <UButton
                      v-if="canEdit"
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-heroicons-trash"
                      :loading="deletingLocationId === location.id"
                      @click="deleteLocation(location.id)"
                    />
                  </div>
                </div>

                <p v-else class="text-sm text-gray-500 dark:text-gray-400 italic">
                  {{ $t('workshops.no_locations') }}
                </p>

                <!-- Formulaire d'ajout -->
                <div v-if="canEdit" class="flex gap-2">
                  <UInput
                    v-model="newLocationName"
                    :placeholder="$t('workshops.location_name_placeholder')"
                    class="flex-1"
                    size="sm"
                    @keyup.enter="addLocation"
                  />
                  <UButton
                    size="sm"
                    icon="i-heroicons-plus"
                    :loading="addingLocation"
                    :disabled="!newLocationName.trim()"
                    @click="addLocation"
                  >
                    {{ $t('workshops.add_location') }}
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Objets trouvés (pas visible pour les team leaders seuls) -->
        <UCard v-if="!isTeamLeaderValue || canEdit || canManageVolunteers">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-magnifying-glass" class="text-amber-500" />
                <h2 class="text-lg font-semibold">{{ $t('editions.lost_found') }}</h2>
              </div>
              <UButton
                v-if="hasEditionStarted"
                size="sm"
                color="primary"
                variant="soft"
                icon="i-heroicons-arrow-right"
                :to="`/editions/${edition.id}/objets-trouves`"
              >
                {{ $t('common.manage') }}
              </UButton>
            </div>

            <div v-if="!hasEditionStarted">
              <UAlert
                :title="t('editions.lost_found_before_start')"
                :description="t('editions.items_appear_when_started')"
                icon="i-heroicons-clock"
                color="warning"
                variant="subtle"
              />
            </div>

            <div v-else>
              <UAlert
                :title="t('pages.management.manage_lost_found')"
                :description="t('pages.management.lost_found_active_description')"
                icon="i-heroicons-magnifying-glass"
                color="info"
                variant="subtle"
              />
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Modal d'ajout de collaborateur -->
    <UModal
      v-model:open="addCollaboratorModalOpen"
      :title="$t('conventions.add_collaborator')"
      size="lg"
    >
      <template #body>
        <div class="space-y-4">
          <div class="space-y-3">
            <!-- Recherche utilisateur -->
            <div>
              <label class="block text-sm font-medium mb-2">{{
                $t('conventions.select_user')
              }}</label>
              <UserSelector
                v-model="newCollaboratorUser"
                v-model:search-term="newCollaboratorSearchTerm"
                :searched-users="searchedUsers"
                :searching-users="searchingUsers"
                :placeholder="$t('conventions.search_user_placeholder')"
              />
            </div>

            <!-- Configuration des droits -->
            <div v-if="newCollaboratorUser">
              <label class="block text-sm font-medium mb-2">{{ $t('collaborators.rights') }}</label>
              <CollaboratorRightsFields
                v-model="newCollaboratorRights"
                :editions="[edition] as any[]"
                :convention-name="edition?.convention?.name"
                size="sm"
              />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="closeAddCollaboratorModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :disabled="!newCollaboratorUser" @click="addCollaborator">
            {{ $t('common.add') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal d'édition de collaborateur -->
    <UModal
      v-model:open="editCollaboratorModalOpen"
      :title="$t('collaborators.edit_collaborator')"
      size="lg"
    >
      <template #body>
        <div v-if="selectedCollaborator" class="space-y-4">
          <!-- Info collaborateur -->
          <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <UiUserAvatar :user="selectedCollaborator.user" size="md" />
            <div>
              <div class="font-medium">{{ selectedCollaborator.user?.pseudo }}</div>
              <div class="text-sm text-gray-500">{{ selectedCollaborator.user?.email }}</div>
            </div>
          </div>

          <!-- Configuration des droits -->
          <div>
            <label class="block text-sm font-medium mb-2">{{ $t('collaborators.rights') }}</label>
            <CollaboratorRightsFields
              v-model="editCollaboratorRights"
              :editions="[edition] as any[]"
              :convention-name="edition?.convention?.name"
              size="sm"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between">
          <UButton color="error" variant="soft" @click="removeCollaborator">
            {{ $t('common.remove') }}
          </UButton>
          <div class="flex gap-3">
            <UButton variant="ghost" @click="closeEditCollaboratorModal">
              {{ $t('common.cancel') }}
            </UButton>
            <UButton color="primary" :loading="savingCollaborator" @click="saveCollaboratorChanges">
              {{ $t('common.save') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Modal d'import de workshops depuis une image -->
    <WorkshopsImportFromImageModal
      v-model:open="importWorkshopsModalOpen"
      :edition-id="editionId"
      @success="handleWorkshopsImportSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useDebounce } from '~/composables/useDebounce'
import { useVolunteerSettings } from '~/composables/useVolunteerSettings'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { summarizeRights } from '~/utils/collaboratorRights'

// TODO: Ajouter le middleware d'authentification plus tard
// definePageMeta({
//   middleware: 'auth-protected'
// });

const route = useRoute()
const editionStore = useEditionStore()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Utiliser le composable pour les paramètres des bénévoles
const {
  settings: volunteersSettings,
  updating: savingVolunteers,
  fieldErrors,
  fetchSettings: fetchVolunteersSettings,
  updateSettings,
} = useVolunteerSettings(editionId)

// Fonction pour effacer l'erreur d'un champ spécifique
const clearFieldError = (fieldName: string) => {
  if (fieldErrors.value[fieldName]) {
    const newErrors = { ...fieldErrors.value }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete newErrors[fieldName]
    fieldErrors.value = newErrors
  }
}

const volunteersOpenLocal = ref(false)
const volunteersModeLocal = ref<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
const volunteersExternalUrlLocal = ref('')
const volunteersUpdatedAt = ref<Date | null>(null)
// Éviter d'envoyer des PATCH à l'initialisation quand on applique les valeurs serveur
const volunteersInitialized = ref(false)
// Nuxt UI URadioGroup utilise la prop `items` (pas `options`)
const volunteerModeItems = computed(() => [
  { value: 'INTERNAL', label: t('editions.volunteers.mode_internal') || 'Interne' },
  { value: 'EXTERNAL', label: t('editions.volunteers.mode_external') || 'Externe' },
])

// Watchers pour effacer les erreurs quand les champs sont modifiés
watch(volunteersExternalUrlLocal, () => clearFieldError('externalUrl'))

// Gestion de l'activation des workshops
const workshopsEnabledLocal = ref(false)
const savingWorkshops = ref(false)

// Initialiser workshopsEnabled depuis l'édition
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      workshopsEnabledLocal.value = newEdition.workshopsEnabled || false
    }
  },
  { immediate: true }
)

const handleToggleWorkshops = async (val: boolean) => {
  const previous = !val
  savingWorkshops.value = true

  try {
    await $fetch(`/api/editions/${editionId}`, {
      method: 'PUT',
      body: { workshopsEnabled: val },
    })

    // Recharger l'édition
    await editionStore.fetchEditionById(editionId, { force: true })

    toast.add({
      title: t('common.saved') || 'Sauvegardé',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    // Charger les lieux si workshops activés
    if (val) {
      await fetchWorkshopLocations()
    }
  } catch (e: any) {
    workshopsEnabledLocal.value = previous
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    savingWorkshops.value = false
  }
}

// Gestion des lieux de workshops
const workshopLocations = ref<any[]>([])
const newLocationName = ref('')
const addingLocation = ref(false)
const deletingLocationId = ref<number | null>(null)
const workshopLocationsFreeInputLocal = ref(false)
const savingLocationMode = ref(false)

// Initialiser workshopLocationsFreeInput depuis l'édition
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      workshopLocationsFreeInputLocal.value =
        (newEdition as any).workshopLocationsFreeInput || false
    }
  },
  { immediate: true }
)

const fetchWorkshopLocations = async () => {
  try {
    const data = await $fetch(`/api/editions/${editionId}/workshops/locations`)
    workshopLocations.value = data as any[]
  } catch (error) {
    console.error('Failed to fetch workshop locations:', error)
  }
}

const addLocation = async () => {
  if (!newLocationName.value.trim()) return

  addingLocation.value = true
  try {
    await $fetch(`/api/editions/${editionId}/workshops/locations`, {
      method: 'POST',
      body: { name: newLocationName.value.trim() },
    })

    toast.add({
      title: t('workshops.location_added'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    newLocationName.value = ''
    await fetchWorkshopLocations()
  } catch (error: any) {
    toast.add({
      title: error?.data?.message || t('workshops.location_error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    addingLocation.value = false
  }
}

const deleteLocation = async (locationId: number) => {
  if (!confirm(t('workshops.confirm_delete_location'))) {
    return
  }

  deletingLocationId.value = locationId
  try {
    await $fetch(`/api/editions/${editionId}/workshops/locations/${locationId}`, {
      method: 'DELETE',
    })

    toast.add({
      title: t('workshops.location_deleted'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    await fetchWorkshopLocations()
  } catch (error: any) {
    toast.add({
      title: error?.data?.message || t('workshops.location_error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    deletingLocationId.value = null
  }
}

const handleToggleLocationMode = async (val: boolean) => {
  const previous = !val
  savingLocationMode.value = true

  try {
    await $fetch(`/api/editions/${editionId}`, {
      method: 'PUT',
      body: { workshopLocationsFreeInput: val },
    })

    // Recharger l'édition
    await editionStore.fetchEditionById(editionId, { force: true })

    toast.add({
      title: t('common.saved') || 'Sauvegardé',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (e: any) {
    workshopLocationsFreeInputLocal.value = previous
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    savingLocationMode.value = false
  }
}

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  // Charger les paramètres des bénévoles
  await fetchVolunteersSettings()
  applyVolunteerSettings()

  // Charger les lieux si workshops activés
  if (edition.value?.workshopsEnabled) {
    await fetchWorkshopLocations()
  }

  // Vérifier si l'utilisateur est team leader
  if (authStore.user?.id) {
    isTeamLeaderValue.value = await editionStore.isTeamLeader(editionId, authStore.user.id)
  }
})

watch(volunteersSettings, () => {
  applyVolunteerSettings()
})

function applyVolunteerSettings() {
  if (volunteersSettings.value) {
    volunteersOpenLocal.value = !!volunteersSettings.value.open
    volunteersModeLocal.value = volunteersSettings.value.mode || 'INTERNAL'
    volunteersExternalUrlLocal.value = volunteersSettings.value.externalUrl || ''
    volunteersUpdatedAt.value = new Date()
    // marquer initialisation terminée (prochain changement utilisateur déclenchera watchers)
    volunteersInitialized.value = true
  }
}

// Handlers explicites pour éviter double PATCH au chargement
const handleToggleOpen = async (val: boolean) => {
  if (!volunteersInitialized.value) return
  const previous = !val

  try {
    const updatedSettings = await updateSettings({ open: val })

    if (updatedSettings) {
      volunteersUpdatedAt.value = new Date()
      await editionStore.fetchEditionById(editionId, { force: true })
      toast.add({
        title: t('common.saved') || 'Sauvegardé',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (e: any) {
    volunteersOpenLocal.value = previous
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  }
}

const handleChangeMode = async (_raw: any) => {
  if (!volunteersInitialized.value) return
  // volunteersModeLocal contient déjà la nouvelle valeur
  await persistVolunteerSettings()
}

const persistVolunteerSettings = async (options: { skipRefetch?: boolean } = {}) => {
  try {
    const body: any = {
      mode: volunteersModeLocal.value,
    }
    if (volunteersModeLocal.value === 'EXTERNAL') {
      body.externalUrl = volunteersExternalUrlLocal.value.trim() || undefined
    }

    const updatedSettings = await updateSettings(body)

    if (updatedSettings) {
      volunteersUpdatedAt.value = new Date()

      // Mettre à jour directement les données locales au lieu de re-fetch complet
      if (!options.skipRefetch && edition.value) {
        // Mettre à jour le store local
        await editionStore.fetchEditionById(editionId, { force: true })
      }

      toast.add({
        title: t('common.saved') || 'Sauvegardé',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (error: any) {
    // Les erreurs sont déjà gérées dans le composable
    if (fieldErrors.value && Object.keys(fieldErrors.value).length > 0) {
      toast.add({
        title: 'Erreurs de validation',
        description: 'Veuillez corriger les erreurs dans le formulaire',
        color: 'error',
        icon: 'i-heroicons-x-circle',
      })
    } else {
      toast.add({
        title: error?.data?.message || error?.message || t('common.error'),
        color: 'error',
        icon: 'i-heroicons-x-circle',
      })
    }
  }
}

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) return true

  // Utilisateurs avec des droits spécifiques
  if (canEdit.value || canManageVolunteers.value) return true

  // Responsables d'équipe de bénévoles
  if (isTeamLeaderValue.value) return true

  // Tous les collaborateurs de la convention (même sans droits)
  if (edition.value.convention?.collaborators) {
    return edition.value.convention.collaborators.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canDelete = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canDeleteEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

const canManageCollaborators = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageCollaborators(edition.value, authStore.user.id)
})

// Vérifier si l'utilisateur est collaborateur de la convention
const isCollaborator = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.isCollaborator(edition.value, authStore.user.id)
})

// État pour les modals de collaborateurs
const addCollaboratorModalOpen = ref(false)
const editCollaboratorModalOpen = ref(false)
const selectedCollaborator = ref<any>(null)
const newCollaboratorUser = ref<any>(null)
const newCollaboratorSearchTerm = ref('')
const searchedUsers = ref<any[]>([])
const searchingUsers = ref(false)
const savingCollaborator = ref(false)

// État pour la modal d'import de workshops
const importWorkshopsModalOpen = ref(false)

// État pour vérifier si l'utilisateur est team leader
const isTeamLeaderValue = ref(false)

const newCollaboratorRights = ref({
  rights: {
    editConvention: false,
    deleteConvention: false,
    manageCollaborators: false,
    manageVolunteers: false,
    addEdition: false,
    editAllEditions: false,
    deleteAllEditions: false,
  },
  title: '',
  perEdition: [],
})

const editCollaboratorRights = ref({
  rights: {},
  title: '',
  perEdition: [],
})

// Debounce pour la recherche d'utilisateurs
const debouncedSearchTerm = useDebounce(newCollaboratorSearchTerm, 300)

// Watchers pour la recherche d'utilisateurs
watch(debouncedSearchTerm, async (searchTerm) => {
  if (!searchTerm || searchTerm.length < 2) {
    searchedUsers.value = []
    return
  }

  searchingUsers.value = true
  try {
    const response = await $fetch<{ users: any[] }>('/api/users/search', {
      params: { q: searchTerm },
    })
    searchedUsers.value = response.users
  } catch (error) {
    console.error('Error searching users:', error)
    searchedUsers.value = []
  } finally {
    searchingUsers.value = false
  }
})

// Fonctions pour gérer les collaborateurs
const getCollaboratorBadgeColor = (collaborator: any) => {
  const summary = summarizeRights(collaborator)
  return summary.color === 'warning' ? 'error' : summary.color
}

const openAddCollaboratorModal = () => {
  newCollaboratorUser.value = null
  newCollaboratorSearchTerm.value = ''
  newCollaboratorRights.value = {
    rights: {
      editConvention: false,
      deleteConvention: false,
      manageCollaborators: false,
      manageVolunteers: false,
      addEdition: false,
      editAllEditions: false,
      deleteAllEditions: false,
    },
    title: '',
    perEdition: [],
  }
  searchedUsers.value = []
  addCollaboratorModalOpen.value = true
}

const closeAddCollaboratorModal = () => {
  addCollaboratorModalOpen.value = false
  newCollaboratorUser.value = null
  newCollaboratorSearchTerm.value = ''
  searchedUsers.value = []
}

const addCollaborator = async () => {
  if (!newCollaboratorUser.value || !edition.value) {
    return
  }

  try {
    await $fetch(`/api/conventions/${edition.value.convention?.id}/collaborators`, {
      method: 'POST',
      body: {
        userId: newCollaboratorUser.value.id,
        rights: newCollaboratorRights.value.rights,
        title: newCollaboratorRights.value.title,
        perEdition: newCollaboratorRights.value.perEdition || [],
      },
    })

    toast.add({
      title: t('collaborators.collaborator_added'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    closeAddCollaboratorModal()
    // Recharger l'édition pour mettre à jour la liste des collaborateurs
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error: any) {
    console.error('Error adding collaborator:', error)
    toast.add({
      title: t('errors.add_collaborator_error'),
      description: error.data?.message || error.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const openEditCollaboratorModal = (collaborator: any) => {
  selectedCollaborator.value = collaborator
  editCollaboratorRights.value = {
    rights: collaborator.rights || {},
    title: collaborator.title || '',
    perEdition: collaborator.perEditionRights || [],
  }
  editCollaboratorModalOpen.value = true
}

const closeEditCollaboratorModal = () => {
  editCollaboratorModalOpen.value = false
  selectedCollaborator.value = null
}

const saveCollaboratorChanges = async () => {
  if (!selectedCollaborator.value || !edition.value) {
    return
  }

  savingCollaborator.value = true
  try {
    await $fetch(
      `/api/conventions/${edition.value.convention?.id}/collaborators/${selectedCollaborator.value.id}`,
      {
        method: 'PATCH',
        body: {
          rights: editCollaboratorRights.value.rights,
          title: editCollaboratorRights.value.title,
          perEdition: editCollaboratorRights.value.perEdition,
        },
      }
    )

    toast.add({
      title: t('collaborators.collaborator_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    closeEditCollaboratorModal()
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error: any) {
    console.error('Error updating collaborator:', error)
    toast.add({
      title: t('errors.update_collaborator_error'),
      description: error.data?.message || error.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    savingCollaborator.value = false
  }
}

const removeCollaborator = async () => {
  if (!selectedCollaborator.value || !edition.value) {
    return
  }

  if (!confirm(t('collaborators.confirm_remove'))) {
    return
  }

  try {
    await $fetch(
      `/api/conventions/${edition.value.convention?.id}/collaborators/${selectedCollaborator.value.id}`,
      {
        method: 'DELETE',
      }
    )

    toast.add({
      title: t('collaborators.collaborator_removed'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    closeEditCollaboratorModal()
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error: any) {
    console.error('Error removing collaborator:', error)
    toast.add({
      title: t('errors.remove_collaborator_error'),
      description: error.data?.message || error.message || t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

// Vérifier s'il y a des actions de gestion disponibles
const hasManagementActions = computed(() => {
  return canEdit.value || canDelete.value
})

// Début d'édition
const hasEditionStarted = computed(() => {
  if (!edition.value) return false
  return new Date() >= new Date(edition.value.startDate)
})

const deleteEdition = async (id: number) => {
  if (confirm(t('pages.access_denied.confirm_delete_edition'))) {
    try {
      await editionStore.deleteEdition(id)
      toast.add({
        title: t('messages.edition_deleted'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      router.push('/')
    } catch (e: any) {
      toast.add({
        title: e?.message || t('errors.edition_deletion_failed'),
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  }
}

const toggleOnlineStatus = async (isOnline: boolean) => {
  if (!edition.value) return

  try {
    await $fetch(`/api/editions/${edition.value.id}/status`, {
      method: 'PATCH',
      body: { isOnline },
    })

    // Update local state immediately
    edition.value.isOnline = isOnline

    // Also update in store
    await editionStore.fetchEditionById(editionId, { force: true })

    const message = isOnline ? t('editions.edition_published') : t('editions.edition_set_offline')
    toast.add({
      title: message,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error) {
    console.error('Failed to toggle edition status:', error)
    toast.add({
      title: t('errors.status_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

// Fonctions pour la modal d'import de workshops
const openImportWorkshopsModal = () => {
  importWorkshopsModalOpen.value = true
}

const handleWorkshopsImportSuccess = () => {
  // La modal se ferme automatiquement
  // On pourrait recharger les données si nécessaire
  toast.add({
    title: t('workshops.import_complete'),
    description: t('workshops.import_complete_description'),
    icon: 'i-heroicons-check-circle',
    color: 'success',
  })
}
</script>
