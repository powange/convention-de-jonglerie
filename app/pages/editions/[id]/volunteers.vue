<template>
  <div v-if="edition">
    <EditionHeader
      :edition="edition"
      current-page="volunteers"
      :is-favorited="isFavorited(edition.id)"
      @toggle-favorite="toggleFavorite(edition.id)"
    />

    <UCard variant="soft" class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-hand-raised" class="text-primary-500" />
            {{ t('editions.volunteers.title') }}
          </h3>
          <div v-if="canManageEdition" class="flex items-center gap-2">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-heroicons-cog-6-tooth"
              :to="`/editions/${edition?.id}/gestion`"
            >
              {{ t('common.manage') || 'Gérer' }}
            </UButton>
          </div>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Description -->
        <div>
          <div class="prose dark:prose-invert max-w-none text-sm">
            <template v-if="volunteersInfo?.description">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div v-html="volunteersDescriptionHtml" />
            </template>
            <template v-else>
              <p class="text-gray-500">{{ t('editions.volunteers.no_description') }}</p>
            </template>
          </div>
        </div>

        <!-- Mode EXTERNAL: bouton accessible à tous -->
        <div
          v-if="
            volunteersMode === 'EXTERNAL' && volunteersInfo?.open && volunteersInfo?.externalUrl
          "
          class="flex items-center gap-3"
        >
          <UButton
            size="sm"
            color="primary"
            icon="i-heroicons-arrow-top-right-on-square"
            :to="volunteersInfo.externalUrl"
            target="_blank"
          >
            {{ t('editions.volunteers.apply') }}
          </UButton>
          <span class="text-xs text-gray-500 truncate max-w-full">{{
            volunteersInfo.externalUrl
          }}</span>
        </div>

        <!-- Candidature utilisateur (déplacé juste après description) -->
        <div v-if="authStore.isAuthenticated && volunteersMode === 'INTERNAL'">
          <div v-if="!volunteersInfo?.open" class="text-sm text-gray-500 flex items-center gap-2">
            <UIcon name="i-heroicons-lock-closed" /> {{ t('editions.volunteers.closed_message') }}
          </div>
          <div v-else>
            <UCard
              variant="subtle"
              class="border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40"
            >
              <template v-if="volunteersInfo?.myApplication">
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-semibold flex items-center gap-1">
                      <UIcon name="i-heroicons-user" class="text-primary-500" />
                      {{ t('editions.volunteers.my_application_title') }}
                    </h4>
                    <UBadge
                      :color="volunteerStatusColor(volunteersInfo.myApplication.status)"
                      variant="soft"
                      class="uppercase"
                    >
                      {{ volunteerStatusLabel(volunteersInfo.myApplication.status) }}
                    </UBadge>
                  </div>
                  <div class="text-xs space-y-1">
                    <span
                      v-if="volunteersInfo.myApplication.status === 'PENDING'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers.my_application_pending') }}</span
                    >
                    <span
                      v-else-if="volunteersInfo.myApplication.status === 'ACCEPTED'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers.my_application_accepted') }}</span
                    >
                    <span
                      v-else-if="volunteersInfo.myApplication.status === 'REJECTED'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers.my_application_rejected') }}</span
                    >
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <UButton
                      v-if="volunteersInfo.myApplication.status === 'PENDING'"
                      size="xs"
                      color="error"
                      variant="soft"
                      :loading="volunteersWithdrawing"
                      @click="withdrawApplication"
                    >
                      {{ t('editions.volunteers.withdraw') }}
                    </UButton>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center justify-between gap-4">
                  <div class="text-xs text-gray-600 dark:text-gray-400">
                    {{ t('editions.volunteers.apply_description') }}
                  </div>
                  <UButton
                    size="sm"
                    color="primary"
                    icon="i-heroicons-hand-raised"
                    @click="openApplyModal"
                  >
                    {{ t('editions.volunteers.apply') }}
                  </UButton>
                </div>
              </template>
            </UCard>
          </div>
        </div>
        <div
          v-else-if="!authStore.isAuthenticated && volunteersMode === 'INTERNAL'"
          class="text-sm text-gray-500"
        >
          {{ t('editions.volunteers.login_prompt') }}
        </div>
      </div>
    </UCard>

    <!-- Modal candidature bénévole -->
    <VolunteerApplicationModal
      v-model="showApplyModal"
      :volunteers-info="volunteersInfo"
      :edition="edition"
      :user="authStore.user as any"
      :applying="volunteersApplying"
      @close="closeApplyModal"
      @submit="applyAsVolunteer"
    />

    <UCard v-if="canViewVolunteersTable" variant="soft" class="mb-6">
      <template #header>
        <div class="space-y-2">
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
      </template>

      <!-- Note visibilité + séparation avant statistiques & tableau organisateur -->
      <div v-if="volunteersMode === 'INTERNAL'">
        <!-- Statistiques -->
        <div v-if="volunteersInfo" class="mt-3 mb-3 flex flex-wrap gap-3">
          <UBadge color="neutral" variant="soft"
            >{{ t('editions.volunteers.total') }}: {{ volunteersInfo.counts.total || 0 }}</UBadge
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
            <!-- Filtres -->
            <UCard variant="subtle">
              <div class="flex flex-wrap gap-3 items-end">
                <UFormField :label="t('editions.volunteers.filter_status')">
                  <USelect
                    v-model="applicationsFilterStatus"
                    :items="volunteerStatusItems"
                    :placeholder="t('editions.volunteers.status_all')"
                    icon="i-heroicons-funnel"
                    size="xs"
                    variant="soft"
                    class="w-48"
                    @change="onStatusFilterChange"
                  />
                </UFormField>
                <UFormField
                  v-if="volunteersInfo?.askTeamPreferences && volunteerTeamItems.length > 0"
                  :label="t('editions.volunteers.table_team_preferences')"
                >
                  <USelect
                    v-model="applicationsFilterTeams"
                    :items="volunteerTeamItems"
                    :placeholder="t('editions.volunteers.teams_empty')"
                    icon="i-heroicons-user-group"
                    size="xs"
                    variant="soft"
                    class="w-48"
                    multiple
                    @change="onTeamsFilterChange"
                  />
                </UFormField>
                <UFormField :label="t('editions.volunteers.search')">
                  <UInput
                    v-model="globalFilter"
                    :placeholder="t('editions.volunteers.search_placeholder')"
                    class="w-64"
                    @keydown.enter.prevent="applySearch"
                  />
                </UFormField>
                <UButton
                  size="xs"
                  variant="soft"
                  icon="i-heroicons-arrow-path"
                  :loading="applicationsLoading"
                  @click="refreshApplications"
                >
                  {{ t('common.refresh') }}
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  icon="i-heroicons-arrow-uturn-left"
                  @click="resetApplicationsFilters"
                >
                  {{ t('common.reset') }}
                </UButton>
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-arrow-down-tray"
                  :loading="exportingApplications"
                  @click="exportApplications"
                >
                  {{ t('editions.volunteers.export') }}
                </UButton>
                <span class="text-xs text-gray-500 italic">{{ $t('common.sort_tip') }}</span>
              </div>
            </UCard>

            <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
              <UTable
                ref="tableRef"
                v-model:sorting="sorting"
                :data="tableData"
                :columns="columns"
                :loading="applicationsLoading"
                class="flex-1"
                sticky
              />
              <div
                v-if="tableData.length === 0 && !applicationsLoading"
                class="text-xs text-gray-500 py-2"
              >
                {{ t('editions.volunteers.no_applications') }}
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-xs">
              <span>{{ filteredCountLabel }}</span>
              <span v-if="serverPagination.totalPages > 1" class="flex items-center gap-2">
                <UButton
                  size="xs"
                  variant="ghost"
                  :disabled="serverPagination.page === 1 || applicationsLoading"
                  icon="i-heroicons-chevron-left"
                  @click="goToPage(serverPagination.page - 1)"
                />
                <span>{{ serverPagination.page }} / {{ serverPagination.totalPages }}</span>
                <UButton
                  size="xs"
                  variant="ghost"
                  :disabled="
                    serverPagination.page === serverPagination.totalPages || applicationsLoading
                  "
                  icon="i-heroicons-chevron-right"
                  @click="goToPage(serverPagination.page + 1)"
                />
              </span>
            </div>

            <!-- Interface génération informations restauration -->
            <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between mb-4">
                <h4
                  class="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2"
                >
                  <UIcon name="i-heroicons-document-text" class="text-gray-500" />
                  {{ t('editions.volunteers.catering_info') }}
                </h4>
              </div>
              <UButtonGroup>
                <USelect
                  v-model="selectedCateringDate"
                  :items="cateringDateOptions"
                  value-attribute="value"
                  option-attribute="label"
                  :placeholder="t('editions.volunteers.select_date')"
                  :ui="{ content: 'min-w-fit' }"
                  class="min-w-[200px]"
                />
                <UButton
                  color="primary"
                  :disabled="!selectedCateringDate"
                  :loading="generatingCateringPdf"
                  @click="generateCateringPdf"
                >
                  {{ t('editions.volunteers.generate') }}
                </UButton>
              </UButtonGroup>
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </div>
  <div v-else>
    <p>{{ t('editions.loading_details') }}</p>
  </div>
</template>

<script setup lang="ts">
// Vue & libs
import { ref, computed, watch, h } from 'vue'
import { useRoute } from 'vue-router'

// App components & stores
import EditionHeader from '~/components/edition/EditionHeader.vue'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { markdownToHtml } from '~/utils/markdown'

// Types (externes) en dernier
import type { TableColumn } from '@nuxt/ui'
import type { Column } from '@tanstack/vue-table'

const { t } = useI18n()
const { formatDateTimeWithGranularity } = useDateFormat()
const toast = useToast()
const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const editionId = parseInt(route.params.id as string)

// Expose constants early (avant tout await)
defineExpose({})
await editionStore.fetchEditionById(editionId)
const edition = computed(() => editionStore.getEditionById(editionId))

const isFavorited = computed(() => (_id: number) => {
  return edition.value?.favoritedBy.some((u) => u.id === authStore.user?.id)
})
const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
  } catch {
    /* silent */
  }
}

// Condition pour voir le tableau des bénévoles (tous les collaborateurs)
const canViewVolunteersTable = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  // Créateur de l'édition
  if (edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId === authStore.user.id) return true
  // Collaborateur de la convention
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  return !!collab
})

// Condition pour gérer les bénévoles (accepter/refuser candidatures)
const canManageVolunteers = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  // Créateur de l'édition
  if (edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId === authStore.user.id) return true
  // Collaborateur avec droit global de gérer les bénévoles
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  if (!collab) return false
  const rights = collab.rights || {}
  if (rights.manageVolunteers) return true
  // Collaborateur avec droit spécifique à cette édition
  const perEdition = (collab as any).perEdition || []
  const editionPerm = perEdition.find((p: any) => p.editionId === edition.value!.id)
  return editionPerm?.canManageVolunteers || false
})

// Ancien canManageEdition gardé pour compatibilité avec le bouton "Gérer"
const canManageEdition = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  if (edition.value.creatorId === authStore.user.id) return true
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  if (!collab) return false
  const rights = collab.rights || {}
  return !!(
    rights.editAllEditions ||
    rights.deleteAllEditions ||
    rights.manageCollaborators ||
    rights.editConvention
  )
})

// Volunteer logic reused
interface VolunteerApplication {
  id: number
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
}
interface VolunteerInfo {
  open: boolean
  description?: string
  mode: 'INTERNAL' | 'EXTERNAL'
  externalUrl?: string
  counts: Record<string, number>
  myApplication: VolunteerApplication | null
  askDiet?: boolean
  askAllergies?: boolean
  askTimePreferences?: boolean
  askTeamPreferences?: boolean
  askPets?: boolean
  askMinors?: boolean
  askVehicle?: boolean
  askCompanion?: boolean
  askAvoidList?: boolean
  askSkills?: boolean
  askExperience?: boolean
  askSetup?: boolean
  askTeardown?: boolean
  setupStartDate?: string
  teardownEndDate?: string
  teams?: { name: string; slots?: number }[]
}
const volunteersInfo = ref<VolunteerInfo | null>(null)
const volunteersDescriptionHtml = ref('')
// Computed simple pour le mode afin d'éviter des cascades de types lourdes
const volunteersMode = computed<'INTERNAL' | 'EXTERNAL' | null>(
  () => volunteersInfo.value?.mode || null
)
// Références de gestion (édition supprimée sur page publique)
// const volunteersLoadingAction = ref(false) // supprimé
// const volunteersSaving = ref(false) // supprimé
const volunteersApplying = ref(false)
const volunteersWithdrawing = ref(false)
// Suppression édition publique : editingVolunteers retiré
const showApplyModal = ref(false)
// Modal candidature helpers
// Variables du formulaire déplacées dans VolunteerApplicationModal
const volunteerStatusColor = (s: string) =>
  s === 'PENDING' ? 'warning' : s === 'ACCEPTED' ? 'success' : 'error'
const volunteerStatusLabel = (s: string) =>
  s === 'PENDING'
    ? t('editions.volunteers.status_pending')
    : s === 'ACCEPTED'
      ? t('editions.volunteers.status_accepted')
      : s === 'REJECTED'
        ? t('editions.volunteers.status_rejected')
        : s
const fetchVolunteersInfo = async () => {
  try {
    volunteersInfo.value = (await $fetch(`/api/editions/${editionId}/volunteers/info`)) as any
    if (volunteersInfo.value?.description) {
      volunteersDescriptionHtml.value = await markdownToHtml(volunteersInfo.value.description)
    }
  } catch {
    /* silent */
  }
}
await fetchVolunteersInfo()

// Fonctions d'édition/gestion supprimées de la page publique
const applyAsVolunteer = async (formData?: any) => {
  volunteersApplying.value = true
  try {
    const res: any = await $fetch(`/api/editions/${editionId}/volunteers/apply`, {
      method: 'POST',
      body: {
        motivation: formData?.motivation?.trim() || undefined,
        phone: formData?.phone?.trim() || undefined,
        prenom: (authStore.user as any)?.prenom
          ? undefined
          : formData?.firstName?.trim() || undefined,
        nom: (authStore.user as any)?.nom ? undefined : formData?.lastName?.trim() || undefined,
        dietaryPreference:
          volunteersInfo.value?.askDiet &&
          formData?.dietPreference !== 'NONE' &&
          formData?.dietPreference
            ? formData.dietPreference
            : undefined,
        allergies:
          volunteersInfo.value?.askAllergies && formData?.allergies?.trim()
            ? formData.allergies.trim()
            : undefined,
        timePreferences:
          volunteersInfo.value?.askTimePreferences && formData?.timePreferences?.length > 0
            ? formData.timePreferences
            : undefined,
        teamPreferences:
          volunteersInfo.value?.askTeamPreferences && formData?.teamPreferences?.length > 0
            ? formData.teamPreferences
            : undefined,
        hasPets: volunteersInfo.value?.askPets ? formData?.hasPets || undefined : undefined,
        petsDetails:
          volunteersInfo.value?.askPets && formData?.hasPets && formData?.petsDetails?.trim()
            ? formData.petsDetails.trim()
            : undefined,
        hasMinors: volunteersInfo.value?.askMinors ? formData?.hasMinors || undefined : undefined,
        minorsDetails:
          volunteersInfo.value?.askMinors && formData?.hasMinors && formData?.minorsDetails?.trim()
            ? formData.minorsDetails.trim()
            : undefined,
        hasVehicle: volunteersInfo.value?.askVehicle
          ? formData?.hasVehicle || undefined
          : undefined,
        vehicleDetails:
          volunteersInfo.value?.askVehicle &&
          formData?.hasVehicle &&
          formData?.vehicleDetails?.trim()
            ? formData.vehicleDetails.trim()
            : undefined,
        companionName:
          volunteersInfo.value?.askCompanion && formData?.companionName?.trim()
            ? formData.companionName.trim()
            : undefined,
        avoidList:
          volunteersInfo.value?.askAvoidList && formData?.avoidList?.trim()
            ? formData.avoidList.trim()
            : undefined,
        skills:
          volunteersInfo.value?.askSkills && formData?.skills?.trim()
            ? formData.skills.trim()
            : undefined,
        hasExperience: volunteersInfo.value?.askExperience ? formData?.hasExperience : undefined,
        experienceDetails:
          volunteersInfo.value?.askExperience &&
          formData?.hasExperience &&
          formData?.experienceDetails?.trim()
            ? formData.experienceDetails.trim()
            : undefined,
        setupAvailability: volunteersInfo.value?.askSetup ? formData?.setupAvailability : undefined,
        teardownAvailability: volunteersInfo.value?.askTeardown
          ? formData?.teardownAvailability
          : undefined,
        eventAvailability: formData?.eventAvailability || undefined,
        arrivalDateTime: formData?.arrivalDateTime || undefined,
        departureDateTime: formData?.departureDateTime || undefined,
      },
    } as any)
    if (res?.application && volunteersInfo.value)
      volunteersInfo.value.myApplication = res.application

    // Mettre à jour les infos utilisateur si nécessaire
    if (formData?.phone?.trim()) (authStore.user as any).phone = formData.phone.trim()
    if (!(authStore.user as any)?.prenom && formData?.firstName?.trim())
      (authStore.user as any).prenom = formData.firstName.trim()
    if (!(authStore.user as any)?.nom && formData?.lastName?.trim())
      (authStore.user as any).nom = formData.lastName.trim()

    showApplyModal.value = false
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    volunteersApplying.value = false
  }
}
const withdrawApplication = async () => {
  volunteersWithdrawing.value = true
  try {
    await $fetch(`/api/editions/${editionId}/volunteers/apply`, { method: 'DELETE' } as any)
    if (volunteersInfo.value) volunteersInfo.value.myApplication = null
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    volunteersWithdrawing.value = false
  }
}

// Applications list
interface VolunteerApplicationFull extends VolunteerApplication {
  createdAt: string
  motivation: string | null
  user: {
    id: number
    pseudo: string
    email: string
    phone?: string | null
    prenom?: string | null
    nom?: string | null
  }
}
const applications = ref<VolunteerApplicationFull[]>([])
const applicationsLoading = ref(false)
const exportingApplications = ref(false)
// Pagination serveur
const serverPagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
// Filtres
// Filtre statut: utiliser 'ALL' plutôt que null pour que USelect affiche une option
const applicationsFilterStatus = ref<string>('ALL')
const applicationsFilterTeams = ref<string[]>([])
const globalFilter = ref('')

// Variables pour génération informations restauration
const selectedCateringDate = ref<string | undefined>(undefined)
const generatingCateringPdf = ref(false)
// Tri multi-colonnes (TanStack sorting state)
const sorting = ref<{ id: string; desc: boolean }[]>([{ id: 'createdAt', desc: true }])
const applicationsActingId = ref<number | null>(null)
const actingAction = ref<'ACCEPTED' | 'REJECTED' | 'PENDING' | null>(null)
// (Anciennes options de tri supprimées, tri via entêtes de colonnes)
// Items pour USelect (API Nuxt UI v3)
const volunteerStatusItems = computed(() => [
  { label: t('editions.volunteers.status_all'), value: 'ALL' },
  { label: t('editions.volunteers.status_pending'), value: 'PENDING' },
  { label: t('editions.volunteers.status_accepted'), value: 'ACCEPTED' },
  { label: t('editions.volunteers.status_rejected'), value: 'REJECTED' },
])

const volunteerTeamItems = computed(() => {
  if (!volunteersInfo.value?.askTeamPreferences || !volunteersInfo.value?.teams?.length) {
    return []
  }
  return volunteersInfo.value.teams.map((team) => ({
    label: team.name,
    value: team.name,
  }))
})

// Options pour le select de génération des informations restauration
const cateringDateOptions = computed(() => {
  if (!edition.value || !volunteersInfo.value) return []

  const options = []
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const startDate = new Date(edition.value.startDate)
  const endDate = new Date(edition.value.endDate)

  // Ajouter les jours de montage si définis
  if (volunteersInfo.value?.setupStartDate) {
    const setupStart = new Date(volunteersInfo.value.setupStartDate)
    const currentDate = new Date(setupStart)

    while (currentDate.toISOString().split('T')[0] < startDate.toISOString().split('T')[0]) {
      const dateValue = currentDate.toISOString().split('T')[0]
      options.push({
        label: `${formatDate(currentDate)} (Montage)`,
        value: dateValue,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  // Ajouter les jours de l'événement principal
  const currentEventDate = new Date(startDate)
  while (currentEventDate <= endDate) {
    options.push({
      label: formatDate(currentEventDate),
      value: currentEventDate.toISOString().split('T')[0],
    })
    currentEventDate.setDate(currentEventDate.getDate() + 1)
  }

  // Ajouter les jours de démontage si définis
  if (volunteersInfo.value?.teardownEndDate) {
    const teardownEnd = new Date(volunteersInfo.value.teardownEndDate)
    const currentDate = new Date(endDate)
    currentDate.setDate(currentDate.getDate() + 1)

    while (currentDate.toISOString().split('T')[0] <= teardownEnd.toISOString().split('T')[0]) {
      const dateValue = currentDate.toISOString().split('T')[0]
      options.push({
        label: `${formatDate(currentDate)} (Démontage)`,
        value: dateValue,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  return options
})
const applySearch = () => {
  serverPagination.value.page = 1
  refreshApplications()
}
const onStatusFilterChange = () => {
  serverPagination.value.page = 1
  refreshApplications()
}
const onTeamsFilterChange = () => {
  serverPagination.value.page = 1
  refreshApplications()
}
const resetApplicationsFilters = () => {
  applicationsFilterStatus.value = 'ALL'
  applicationsFilterTeams.value = []
  globalFilter.value = ''
  sorting.value = [{ id: 'createdAt', desc: true }]
  serverPagination.value.page = 1
  refreshApplications()
}
const goToPage = (p: number) => {
  if (p < 1 || p > serverPagination.value.totalPages) return
  serverPagination.value.page = p
  refreshApplications()
}
const refreshApplications = async () => {
  if (!canViewVolunteersTable.value) return
  if (volunteersMode.value === 'EXTERNAL') return // Pas de tableau en mode externe
  applicationsLoading.value = true
  try {
    // Convert sorting state en paramètres existants (compat backend)
    const primary = sorting.value[0]
    const secondary = sorting.value.slice(1)
    const sortField = primary?.id || 'createdAt'
    const sortDir = primary?.desc ? 'desc' : 'asc'
    const sortSecondary =
      secondary.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',') || undefined
    const res: any = await $fetch(`/api/editions/${editionId}/volunteers/applications`, {
      query: {
        page: serverPagination.value.page,
        pageSize: serverPagination.value.pageSize,
        status:
          applicationsFilterStatus.value && applicationsFilterStatus.value !== 'ALL'
            ? applicationsFilterStatus.value
            : undefined,
        teams:
          applicationsFilterTeams.value.length > 0
            ? applicationsFilterTeams.value.join(',')
            : undefined,
        sortField,
        sortDir,
        sortSecondary,
        search: globalFilter.value || undefined,
      },
    } as any)
    applications.value = res.applications || []
    if (res.pagination) serverPagination.value = res.pagination
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    applicationsLoading.value = false
  }
}
await refreshApplications()

const exportApplications = async () => {
  if (!canViewVolunteersTable.value) return
  if (volunteersMode.value === 'EXTERNAL') return

  exportingApplications.value = true
  try {
    // Convert sorting state en paramètres existants (compat backend)
    const primary = sorting.value[0]
    const secondary = sorting.value.slice(1)
    const sortField = primary?.id || 'createdAt'
    const sortDir = primary?.desc ? 'desc' : 'asc'
    const sortSecondary =
      secondary.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',') || undefined

    const params = {
      export: 'true', // Paramètre spécial pour l'export
      status:
        applicationsFilterStatus.value && applicationsFilterStatus.value !== 'ALL'
          ? applicationsFilterStatus.value
          : undefined,
      teams:
        applicationsFilterTeams.value.length > 0
          ? applicationsFilterTeams.value.join(',')
          : undefined,
      sortField,
      sortDir,
      sortSecondary,
      search: globalFilter.value || undefined,
    }

    // Créer l'URL avec les paramètres
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, value]) => value !== undefined) as [string, string][]
    ).toString()

    const url = `/api/editions/${editionId}/volunteers/applications?${queryString}`

    // Télécharger le fichier
    const link = document.createElement('a')
    link.href = url
    link.download = `candidatures-benevoles-edition-${editionId}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.add({
      title: t('common.export_success'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: e?.statusMessage || t('common.error'),
      color: 'error',
    })
  } finally {
    exportingApplications.value = false
  }
}

const generateCateringPdf = async () => {
  if (!selectedCateringDate.value) return

  generatingCateringPdf.value = true
  try {
    // Importer jsPDF dynamiquement
    const { jsPDF } = await import('jspdf')

    // Récupérer les données depuis l'API
    const cateringData = (await $fetch(
      `/api/editions/${editionId}/volunteers/catering/${selectedCateringDate.value}`
    )) as any

    // Créer le PDF
    const doc = new jsPDF()
    let yPosition = 20

    // Titre du document
    doc.setFontSize(18)
    doc.text(
      `Informations Restauration - ${new Date(selectedCateringDate.value).toLocaleDateString(
        'fr-FR',
        {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }
      )}`,
      20,
      yPosition
    )
    yPosition += 15

    // Type de date
    doc.setFontSize(12)
    const dateTypeLabel =
      (cateringData as any).dateType === 'setup'
        ? 'Montage'
        : (cateringData as any).dateType === 'teardown'
          ? 'Démontage'
          : 'Événement'
    doc.text(`Type: ${dateTypeLabel}`, 20, yPosition)
    yPosition += 20

    // Traiter chaque créneau
    const timeSlotLabels = {
      morning: 'MATIN',
      noon: 'MIDI',
      evening: 'SOIR',
    }

    const dietaryLabels = {
      NONE: 'Aucun régime spécial',
      VEGETARIAN: 'Végétarien',
      VEGAN: 'Végétalien',
    }

    for (const [slotKey, slotLabel] of Object.entries(timeSlotLabels)) {
      const slotData = (cateringData as any).slots[slotKey]

      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }

      // Titre du créneau
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`${slotLabel}`, 20, yPosition)
      yPosition += 10

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)

      // Nombre total de bénévoles
      doc.text(`Total bénévoles: ${slotData.totalVolunteers}`, 25, yPosition)
      yPosition += 8

      // Répartition par régime
      if (Object.keys(slotData.dietaryCounts).length > 0) {
        doc.text('Régimes alimentaires:', 25, yPosition)
        yPosition += 6

        // Ordre spécifique : NONE, VEGETARIAN, VEGAN
        const dietOrder = ['NONE', 'VEGETARIAN', 'VEGAN']
        for (const diet of dietOrder) {
          if (slotData.dietaryCounts[diet]) {
            const label = dietaryLabels[diet as keyof typeof dietaryLabels] || diet
            doc.text(`  • ${label}: ${slotData.dietaryCounts[diet]} personne(s)`, 30, yPosition)
            yPosition += 6
          }
        }
      }

      // Liste des allergies
      if (slotData.allergies.length > 0) {
        yPosition += 3
        doc.text('Allergies:', 25, yPosition)
        yPosition += 6

        for (const allergy of slotData.allergies) {
          const name =
            allergy.volunteer.prenom && allergy.volunteer.nom
              ? `${allergy.volunteer.prenom} ${allergy.volunteer.nom}`
              : allergy.volunteer.pseudo

          doc.text(`  • ${name}: ${allergy.allergies}`, 30, yPosition)
          yPosition += 6

          if (yPosition > 270) {
            doc.addPage()
            yPosition = 20
          }
        }
      }

      yPosition += 10
    }

    // Télécharger le PDF
    const fileName = `restauration-${edition.value?.name?.replace(/[^a-zA-Z0-9]/g, '-') || 'edition'}-${selectedCateringDate.value}.pdf`
    doc.save(fileName)

    toast.add({
      title: t('common.export_success'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: e?.statusMessage || t('common.error'),
      color: 'error',
    })
  } finally {
    generatingCateringPdf.value = false
  }
}

const decideApplication = async (
  app: VolunteerApplicationFull,
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING'
) => {
  applicationsActingId.value = app.id
  actingAction.value = status
  try {
    const res: any = await $fetch(`/api/editions/${editionId}/volunteers/applications/${app.id}`, {
      method: 'PATCH',
      body: { status },
    } as any)
    if (res?.application) {
      app.status = res.application.status
      await fetchVolunteersInfo()
    }
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    applicationsActingId.value = null
    actingAction.value = null
  }
}
const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// Données aplaties pour le tableau
const tableData = computed(() =>
  applications.value.map((app) => ({
    ...app,
    pseudo: app.user.pseudo,
    email: app.user.email,
    phone: app.user.phone,
    prenom: app.user.prenom,
    nom: app.user.nom,
    dietaryPreference: (app as any).dietaryPreference,
    allergies: (app as any).allergies,
    hasPets: (app as any).hasPets,
    petsDetails: (app as any).petsDetails,
    hasMinors: (app as any).hasMinors,
    minorsDetails: (app as any).minorsDetails,
    hasVehicle: (app as any).hasVehicle,
    vehicleDetails: (app as any).vehicleDetails,
    companionName: (app as any).companionName,
    avoidList: (app as any).avoidList,
  }))
)

// Colonnes UTable
const columns: TableColumn<any>[] = [
  // Etat en premier
  {
    accessorKey: 'status',
    header: ({ column }) => getSortableHeader(column, t('common.status')),
    cell: ({ row }) =>
      h(
        resolveComponent('UBadge'),
        {
          color: volunteerStatusColor(row.original.status),
          variant: 'soft',
          class: 'uppercase text-xs px-2 py-1',
        },
        () => volunteerStatusLabel(row.original.status)
      ),
    size: 120,
  },
  // Infos utilisateur
  {
    accessorKey: 'pseudo',
    header: ({ column }) => getSortableHeader(column, t('editions.volunteers.table_user')),
    cell: ({ row }) =>
      h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium' }, row.original.user.pseudo),
        h('span', { class: 'text-xs text-gray-500' }, row.original.user.email),
        row.original.user.phone
          ? h('span', { class: 'text-xs text-gray-500' }, row.original.user.phone)
          : null,
      ]),
  },
  // Colonnes Prénom et Nom
  {
    accessorKey: 'prenom',
    header: ({ column }) => getSortableHeader(column, t('editions.volunteers.table_first_name')),
    cell: ({ row }) => row.original.user.prenom || '—',
  },
  {
    accessorKey: 'nom',
    header: ({ column }) => getSortableHeader(column, t('editions.volunteers.table_last_name')),
    cell: ({ row }) => row.original.user.nom || '—',
  },
  // Colonne présence
  {
    accessorKey: 'presence',
    header: t('editions.volunteers.table_presence'),
    cell: ({ row }: any) => {
      const hasSetupAvailability = row.original.setupAvailability
      const hasTeardownAvailability = row.original.teardownAvailability
      const hasEventAvailability = row.original.eventAvailability
      const arrivalDateTime = row.original.arrivalDateTime
      const departureDateTime = row.original.departureDateTime

      if (
        !hasSetupAvailability &&
        !hasTeardownAvailability &&
        !hasEventAvailability &&
        !arrivalDateTime &&
        !departureDateTime
      ) {
        return h('span', '—')
      }

      // Construire les lignes d'affichage
      const lines = []

      // 1. Disponibilités (montage/événement/démontage)
      const availabilities = []
      if (hasSetupAvailability) availabilities.push('Montage')
      if (hasEventAvailability) availabilities.push('Événement')
      if (hasTeardownAvailability) availabilities.push('Démontage')

      if (availabilities.length > 0) {
        lines.push(
          h(
            'div',
            { class: 'text-xs font-medium text-gray-900 dark:text-gray-100' },
            availabilities.join(' • ')
          )
        )
      }

      // 2. Date d'arrivée avec granularité et icône
      if (arrivalDateTime) {
        lines.push(
          h('div', { class: 'flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400' }, [
            h(resolveComponent('UIcon'), {
              name: 'i-heroicons-arrow-right-end-on-rectangle',
              class: 'text-gray-500',
              size: '12',
            }),
            h('span', formatDateTimeWithGranularity(arrivalDateTime)),
          ])
        )
      }

      // 3. Date de départ avec granularité et icône
      if (departureDateTime) {
        lines.push(
          h('div', { class: 'flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400' }, [
            h(resolveComponent('UIcon'), {
              name: 'i-heroicons-arrow-left-start-on-rectangle',
              class: 'text-gray-500',
              size: '12',
            }),
            h('span', formatDateTimeWithGranularity(departureDateTime)),
          ])
        )
      }

      return h(
        'div',
        {
          class: 'flex flex-col gap-1 py-1',
        },
        lines
      )
    },
    size: 180,
  } as TableColumn<any>,
  // Colonne régime si activée
  ...(volunteersInfo.value?.askDiet
    ? [
        {
          accessorKey: 'dietaryPreference',
          header: t('editions.volunteers.table_diet'),
          cell: ({ row }: any) => {
            const val = row.original.dietaryPreference || 'NONE'
            const key =
              val === 'VEGETARIAN'
                ? t('diet.vegetarian')
                : val === 'VEGAN'
                  ? t('diet.vegan')
                  : t('diet.none')
            return h('span', { class: 'text-xs' }, key)
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne allergies si activée
  ...(volunteersInfo.value?.askAllergies
    ? [
        {
          accessorKey: 'allergies',
          header: ({ column }: any) =>
            getSortableHeader(column, t('editions.volunteers.table_allergies')),
          cell: ({ row }: any) =>
            row.original.allergies
              ? h('span', { class: 'text-xs truncate block max-w-[160px]' }, row.original.allergies)
              : '—',
        } as TableColumn<any>,
      ]
    : []),
  // Colonne animaux de compagnie si activée
  ...(volunteersInfo.value?.askPets
    ? [
        {
          accessorKey: 'hasPets',
          header: t('editions.volunteers.table_pets'),
          cell: ({ row }: any) => {
            if (!row.original.hasPets) return h('span', '—')
            const petsDetails = row.original.petsDetails
            if (!petsDetails) return h('span', { class: 'text-xs' }, t('common.yes'))
            return h(
              resolveComponent('UTooltip'),
              { text: petsDetails, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs' }, t('common.yes')),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne personnes mineures si activée
  ...(volunteersInfo.value?.askMinors
    ? [
        {
          accessorKey: 'hasMinors',
          header: t('editions.volunteers.table_minors'),
          cell: ({ row }: any) => {
            if (!row.original.hasMinors) return h('span', '—')
            const minorsDetails = row.original.minorsDetails
            if (!minorsDetails) return h('span', { class: 'text-xs' }, t('common.yes'))
            return h(
              resolveComponent('UTooltip'),
              { text: minorsDetails, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs' }, t('common.yes')),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne véhicule si activée
  ...(volunteersInfo.value?.askVehicle
    ? [
        {
          accessorKey: 'hasVehicle',
          header: t('editions.volunteers.table_vehicle'),
          cell: ({ row }: any) => {
            if (!row.original.hasVehicle) return h('span', '—')
            const vehicleDetails = row.original.vehicleDetails
            if (!vehicleDetails) return h('span', { class: 'text-xs' }, t('common.yes'))
            return h(
              resolveComponent('UTooltip'),
              { text: vehicleDetails, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs' }, t('common.yes')),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne compagnon si activée
  ...(volunteersInfo.value?.askCompanion
    ? [
        {
          accessorKey: 'companionName',
          header: t('editions.volunteers.table_companion'),
          cell: ({ row }: any) => {
            const companionName = row.original.companionName
            if (!companionName) return h('span', '—')
            return h('span', { class: 'text-xs' }, companionName)
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne liste à éviter si activée
  ...(volunteersInfo.value?.askAvoidList
    ? [
        {
          accessorKey: 'avoidList',
          header: t('editions.volunteers.table_avoid_list'),
          cell: ({ row }: any) => {
            const avoidList = row.original.avoidList
            if (!avoidList) return h('span', '—')
            return h(
              resolveComponent('UTooltip'),
              { text: avoidList, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs max-w-[100px] truncate' }, avoidList),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne compétences si activée
  ...(volunteersInfo.value?.askSkills
    ? [
        {
          accessorKey: 'skills',
          header: t('editions.volunteers.table_skills'),
          cell: ({ row }: any) => {
            const skills = row.original.skills
            if (!skills) return h('span', '—')
            return h(
              resolveComponent('UTooltip'),
              { text: skills, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs max-w-[150px] truncate' }, skills),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne préférences horaires si activée
  ...(volunteersInfo.value?.askTimePreferences
    ? [
        {
          accessorKey: 'timePreferences',
          header: t('editions.volunteers.table_time_preferences'),
          cell: ({ row }: any) => {
            const preferences = row.original.timePreferences || []
            const allSlots = [
              'early_morning',
              'morning',
              'lunch',
              'early_afternoon',
              'late_afternoon',
              'evening',
              'late_evening',
              'night',
            ]

            return h(
              'div',
              { class: 'grid grid-cols-4 gap-1' },
              allSlots.map((slot) => {
                const isSelected = preferences.includes(slot)
                const label = t(`editions.volunteers.time_slots.${slot}`)

                return h(
                  resolveComponent('UTooltip'),
                  { text: label, openDelay: 200 },
                  {
                    default: () =>
                      h('div', {
                        class: `w-3 h-3 rounded border ${
                          isSelected
                            ? 'bg-green-500 border-green-600'
                            : 'bg-gray-200 border-gray-300 dark:bg-gray-600 dark:border-gray-500'
                        }`,
                        title: label,
                      }),
                  }
                )
              })
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne équipes préférées si activée
  ...(volunteersInfo.value?.askTeamPreferences
    ? [
        {
          accessorKey: 'teamPreferences',
          header: t('editions.volunteers.table_team_preferences'),
          cell: ({ row }: any) => {
            const preferences = row.original.teamPreferences || []
            if (preferences.length === 0) return h('span', '—')

            const teams = volunteersInfo.value?.teams || []
            const teamNames = preferences
              .map((teamId: string) => {
                const team = teams.find((t: any) => t.id === teamId)
                return team?.name || teamId
              })
              .join(', ')

            return h(
              resolveComponent('UTooltip'),
              { text: teamNames, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'max-w-xs truncate cursor-help text-xs',
                      title: teamNames,
                    },
                    teamNames
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  {
    accessorKey: 'createdAt',
    header: ({ column }) => getSortableHeader(column, t('common.date')),
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    id: 'motivation',
    header: t('editions.volunteers.table_motivation'),
    cell: ({ row }) => {
      const mot = row.original.motivation
      if (!mot) return h('span', '—')
      return h(
        resolveComponent('UTooltip'),
        { text: mot, openDelay: 200 },
        {
          default: () => h('div', { class: 'max-w-xs truncate cursor-help', title: mot }, mot),
        }
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      // N'afficher les actions que si l'utilisateur peut gérer les bénévoles
      if (!canManageVolunteers.value) {
        return h('span', { class: 'text-xs text-gray-500 italic' }, t('common.no_permission'))
      }

      const status = row.original.status
      if (status === 'PENDING') {
        return h('div', { class: 'flex gap-2' }, [
          h(
            resolveComponent('UButton'),
            {
              size: 'xs',
              color: 'success',
              variant: 'soft',
              loading:
                applicationsActingId.value === row.original.id && actingAction.value === 'ACCEPTED',
              onClick: () => decideApplication(row.original, 'ACCEPTED'),
            },
            () => t('editions.volunteers.action_accept')
          ),
          h(
            resolveComponent('UButton'),
            {
              size: 'xs',
              color: 'error',
              variant: 'soft',
              loading:
                applicationsActingId.value === row.original.id && actingAction.value === 'REJECTED',
              onClick: () => decideApplication(row.original, 'REJECTED'),
            },
            () => t('editions.volunteers.action_reject')
          ),
        ])
      }
      if (status === 'ACCEPTED' || status === 'REJECTED') {
        return h('div', { class: 'flex gap-2' }, [
          h(
            resolveComponent('UButton'),
            {
              size: 'xs',
              color: 'warning',
              variant: 'soft',
              loading:
                applicationsActingId.value === row.original.id && actingAction.value === 'PENDING',
              onClick: () => {
                if (confirm(t('editions.volunteers.confirm_back_pending'))) {
                  decideApplication(row.original, 'PENDING' as any)
                }
              },
            },
            () => t('editions.volunteers.action_back_pending')
          ),
        ])
      }
      return null
    },
  },
]

function getSortableHeader(column: Column<any>, label: string) {
  const isSorted = column.getIsSorted()
  return h(resolveComponent('UButton'), {
    color: 'neutral',
    variant: 'ghost',
    label,
    icon: isSorted
      ? isSorted === 'asc'
        ? 'i-lucide-arrow-up-narrow-wide'
        : 'i-lucide-arrow-down-wide-narrow'
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(isSorted === 'asc'),
  })
}

// Réagir aux changements de tri (déjà captés via sorting watcher plus bas)
watch(
  sorting,
  () => {
    serverPagination.value.page = 1
    refreshApplications()
  },
  { deep: true }
)

// Déclencheur de recherche global (debounce simple)
let searchTimeout: any
watch(globalFilter, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    serverPagination.value.page = 1
    refreshApplications()
  }, 350)
})

const filteredCountLabel = computed(() => {
  const filtered = serverPagination.value.total
  const total = volunteersInfo.value?.counts?.total ?? filtered
  const page = serverPagination.value.page
  const pageSize = serverPagination.value.pageSize
  const start = applications.value.length === 0 ? 0 : (page - 1) * pageSize + 1
  const end = (page - 1) * pageSize + applications.value.length
  const boundedEnd = Math.min(end, filtered)
  const boundedStart = Math.min(start, filtered === 0 ? 0 : filtered)
  return `${t('editions.volunteers.filtered_count', { filtered, total })} (${boundedStart}–${boundedEnd})`
})

// Gestion ouverture / fermeture modal candidature
const openApplyModal = () => {
  showApplyModal.value = true
}
const closeApplyModal = () => {
  showApplyModal.value = false
}
</script>
