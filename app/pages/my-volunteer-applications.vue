<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- En-tête -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ $t('pages.volunteers.my_applications') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          {{ $t('pages.volunteers.applications_description') }}
        </p>
      </div>

      <!-- Contrôles d'affichage -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <!-- Toggle vue compacte/détaillée -->
        <UFieldGroup size="sm" class="w-full sm:w-auto">
          <UButton
            :variant="viewMode === 'detailed' ? 'solid' : 'ghost'"
            icon="i-heroicons-squares-2x2"
            class="flex-1 sm:flex-none"
            @click="viewMode = 'detailed'"
          >
            <span class="hidden sm:inline">{{ $t('pages.volunteers.view_detailed_short') }}</span>
            <span class="sm:hidden">{{ $t('pages.volunteers.view_detailed') }}</span>
          </UButton>
          <UButton
            :variant="viewMode === 'compact' ? 'solid' : 'ghost'"
            icon="i-heroicons-list-bullet"
            class="flex-1 sm:flex-none"
            @click="viewMode = 'compact'"
          >
            <span class="hidden sm:inline">{{ $t('pages.volunteers.view_compact_short') }}</span>
            <span class="sm:hidden">{{ $t('pages.volunteers.view_compact') }}</span>
          </UButton>
        </UFieldGroup>
      </div>
    </div>

    <!-- Navigation par tabs sticky -->
    <div
      class="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 -mx-4 px-4 sm:-mx-6 sm:px-6"
    >
      <nav class="flex space-x-1 sm:space-x-4 overflow-x-auto pb-0 scrollbar-hide">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="[
            'py-3 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex items-center gap-1 sm:gap-2 transition-all duration-200 min-w-0 flex-shrink-0 rounded-t-lg',
            activeTab === tab.id
              ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800',
          ]"
          @click="activeTab = tab.id"
        >
          <UIcon :name="tab.icon" class="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
          <span class="truncate">{{ tab.label }}</span>
          <UBadge
            v-if="tab.count > 0"
            :color="tab.badgeColor"
            variant="soft"
            size="sm"
            class="flex-shrink-0 ml-1"
          >
            {{ tab.count }}
          </UBadge>
        </button>
      </nav>
    </div>

    <!-- Chargement -->
    <div v-if="pending" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" size="24" />
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="text-center py-12">
      <UIcon
        name="i-heroicons-exclamation-triangle"
        class="mx-auto mb-4 text-error-500"
        size="48"
      />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('common.error') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ error.message || $t('errors.loading_error') }}
      </p>
    </div>

    <!-- Liste des candidatures filtrées -->
    <div v-else-if="filteredApplications && filteredApplications.length > 0" class="space-y-6">
      <!-- Vue détaillée -->
      <div v-if="viewMode === 'detailed'" class="space-y-6">
        <UCard
          v-for="application in filteredApplications"
          :key="`application-${application.id}`"
          class="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out"
        >
          <template #header>
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-4">
                <!-- Logo de la convention ou image de l'édition -->
                <div class="flex-shrink-0">
                  <img
                    v-if="application.edition.imageUrl"
                    :src="
                      getImageUrl(
                        application.edition.imageUrl,
                        'edition',
                        application.edition.id
                      ) || ''
                    "
                    :alt="getEditionDisplayName(application.edition)"
                    class="w-16 h-16 object-cover rounded-lg"
                  />
                  <img
                    v-else-if="application.edition.convention.logo"
                    :src="
                      getImageUrl(
                        application.edition.convention.logo,
                        'convention',
                        application.edition.convention.id
                      ) || ''
                    "
                    :alt="application.edition.convention.name"
                    class="w-16 h-16 object-cover rounded-lg"
                  />
                  <div
                    v-else
                    class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
                  >
                    <UIcon name="i-heroicons-calendar-days" class="text-gray-400" size="24" />
                  </div>
                </div>

                <div class="flex-1">
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                    {{ getEditionDisplayName(application.edition) }}
                  </h3>
                  <p class="text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <UIcon name="i-heroicons-map-pin" class="w-4 h-4" />
                    {{ application.edition.city }}, {{ application.edition.country }}
                  </p>
                  <p class="text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
                    {{
                      formatDateRange(application.edition.startDate, application.edition.endDate)
                    }}
                  </p>
                </div>
              </div>

              <div class="flex flex-col items-end gap-2">
                <UBadge
                  :color="getStatusColor(application.status)"
                  :variant="getStatusVariant(application.status)"
                  class="flex items-center gap-1.5"
                  size="lg"
                >
                  <UIcon :name="getStatusIcon(application.status)" class="w-3.5 h-3.5" />
                  {{ $t(`edition.volunteers.status.${application.status.toLowerCase()}`) }}
                </UBadge>

                <!-- Équipes assignées dans le header -->
                <div
                  v-if="
                    application.status === 'ACCEPTED' &&
                    application.assignedTeams &&
                    Array.isArray(application.assignedTeams) &&
                    application.assignedTeams.length > 0
                  "
                  class="flex flex-wrap gap-1 justify-end"
                >
                  <UBadge
                    v-for="team in application.assignedTeams"
                    :key="team"
                    color="info"
                    variant="solid"
                  >
                    {{ team }}
                  </UBadge>
                </div>

                <span class="text-sm text-gray-500">
                  {{ $t('pages.volunteers.applied_on') }} {{ formatDate(application.createdAt) }}
                </span>
              </div>
            </div>
          </template>

          <!-- Bouton pour afficher les détails -->
          <div class="flex justify-end mt-3">
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-heroicons-document-text"
              @click="showApplicationDetails(application)"
            >
              {{ $t('pages.volunteers.view_details') }}
            </UButton>
          </div>

          <div class="space-y-4">
            <!-- Créneaux assignés -->
            <VolunteersTimeSlotsList
              v-if="
                application.status === 'ACCEPTED' &&
                application.assignedTimeSlots &&
                application.assignedTimeSlots.length > 0
              "
              :time-slots="getTimeSlotsFromAssignments(application.assignedTimeSlots)"
              :volunteer-name="volunteerFullName"
              show-header
              show-stats
            />

            <!-- Note d'acceptation -->
            <div
              v-if="application.status === 'ACCEPTED' && application.acceptanceNote"
              class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
            >
              <h4
                class="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-2"
              >
                <UIcon name="i-heroicons-check-circle" class="text-green-600 dark:text-green-400" />
                {{ $t('edition.volunteers.acceptance_note_title') }}
              </h4>
              <p class="text-sm text-green-700 dark:text-green-300">
                {{ application.acceptanceNote }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <template #footer>
            <div
              class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0"
            >
              <div class="flex flex-wrap gap-2">
                <UButton
                  :to="`/editions/${application.edition.id}`"
                  size="sm"
                  color="primary"
                  variant="solid"
                  icon="i-heroicons-eye"
                  class="flex-1 sm:flex-none"
                >
                  <span class="hidden sm:inline">{{ $t('pages.volunteers.view_edition') }}</span>
                  <span class="sm:hidden">Voir</span>
                </UButton>

                <UButton
                  v-if="
                    application.status === 'ACCEPTED' && application.assignedTimeSlots?.length > 0
                  "
                  :to="`/editions/${application.edition.id}/volunteers`"
                  size="sm"
                  color="info"
                  variant="outline"
                  icon="i-heroicons-calendar-days"
                  class="flex-1 sm:flex-none"
                >
                  <span class="hidden sm:inline">{{ $t('pages.volunteers.view_planning') }}</span>
                  <span class="sm:hidden">Planning</span>
                </UButton>

                <UButton
                  v-if="application.status === 'ACCEPTED'"
                  size="sm"
                  color="success"
                  variant="outline"
                  icon="i-heroicons-chat-bubble-bottom-center-text"
                  class="flex-1 sm:flex-none"
                  @click="contactOrganizer(application)"
                >
                  <span class="hidden sm:inline">{{
                    $t('pages.volunteers.contact_organizer')
                  }}</span>
                  <span class="sm:hidden">Contact</span>
                </UButton>

                <UButton
                  v-if="application.status === 'ACCEPTED'"
                  size="sm"
                  color="primary"
                  variant="outline"
                  icon="i-heroicons-qr-code"
                  class="flex-1 sm:flex-none"
                  @click="showQrCode(application)"
                >
                  <span class="hidden sm:inline">Mon QR code</span>
                  <span class="sm:hidden">QR</span>
                </UButton>
              </div>

              <!-- Actions critiques séparées -->
              <div v-if="application.status === 'PENDING'" class="flex gap-2 justify-end">
                <UButton
                  size="sm"
                  color="error"
                  variant="soft"
                  icon="i-heroicons-trash"
                  class="flex-1 sm:flex-none"
                  @click="withdrawApplication(application.id)"
                >
                  <span class="hidden sm:inline">{{ $t('pages.volunteers.withdraw') }}</span>
                  <span class="sm:hidden">Retirer</span>
                </UButton>
              </div>
            </div>
          </template>
        </UCard>
      </div>

      <!-- Vue compacte -->
      <div v-else class="space-y-3">
        <div
          v-for="application in filteredApplications"
          :key="application.id"
          class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary-300 hover:-translate-y-0.5 transition-all duration-200 ease-out touch-manipulation"
        >
          <div class="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <!-- Image -->
            <div class="flex-shrink-0">
              <img
                v-if="application.edition.imageUrl"
                :src="
                  getImageUrl(application.edition.imageUrl, 'edition', application.edition.id) || ''
                "
                :alt="getEditionDisplayName(application.edition)"
                class="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg"
              />
              <img
                v-else-if="application.edition.convention.logo"
                :src="
                  getImageUrl(
                    application.edition.convention.logo,
                    'convention',
                    application.edition.convention.id
                  ) || ''
                "
                :alt="application.edition.convention.name"
                class="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg"
              />
              <div
                v-else
                class="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
              >
                <UIcon name="i-heroicons-calendar-days" class="text-gray-400" size="18" />
              </div>
            </div>

            <!-- Informations principales -->
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-gray-900 dark:text-white truncate text-sm sm:text-base">
                {{ getEditionDisplayName(application.edition) }}
              </h3>
              <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {{ application.edition.city }}, {{ application.edition.country }}
              </p>
              <p class="text-xs text-gray-500 truncate sm:hidden">
                {{ formatDateRange(application.edition.startDate, application.edition.endDate) }}
              </p>
              <p class="text-xs sm:text-sm text-gray-500 truncate hidden sm:block">
                {{ formatDateRange(application.edition.startDate, application.edition.endDate) }}
              </p>
            </div>
          </div>

          <!-- Statut et actions -->
          <div
            class="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto"
          >
            <UBadge
              :color="getStatusColor(application.status)"
              :variant="getStatusVariant(application.status)"
              class="flex items-center gap-1"
            >
              <UIcon :name="getStatusIcon(application.status)" class="w-3 h-3" />
              {{ $t(`edition.volunteers.status.${application.status.toLowerCase()}`) }}
            </UBadge>

            <!-- Actions rapides -->
            <div class="flex flex-wrap gap-1 sm:gap-1 justify-start sm:justify-end">
              <UButton
                :to="`/editions/${application.edition.id}`"
                size="xs"
                color="primary"
                variant="ghost"
                icon="i-heroicons-eye"
                class="sm:w-auto w-8 h-8"
                square
              />
              <UButton
                v-if="
                  application.status === 'ACCEPTED' && application.assignedTimeSlots?.length > 0
                "
                size="xs"
                color="info"
                variant="ghost"
                icon="i-heroicons-calendar-days"
                class="sm:w-auto w-8 h-8"
                square
                @click="showPlanning(application)"
              />
              <UButton
                v-if="application.status === 'ACCEPTED'"
                size="xs"
                color="success"
                variant="ghost"
                icon="i-heroicons-chat-bubble-bottom-center-text"
                class="sm:w-auto w-8 h-8"
                square
                @click="contactOrganizer(application)"
              />
              <UButton
                v-if="application.status === 'ACCEPTED'"
                size="xs"
                color="primary"
                variant="ghost"
                icon="i-heroicons-qr-code"
                class="sm:w-auto w-8 h-8"
                square
                @click="showQrCode(application)"
              />
              <UButton
                v-if="application.status === 'PENDING'"
                size="xs"
                color="error"
                variant="ghost"
                icon="i-heroicons-trash"
                class="sm:w-auto w-8 h-8"
                square
                @click="withdrawApplication(application.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- État vide -->
    <div v-else class="text-center py-12">
      <UIcon :name="getEmptyStateIcon()" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ getEmptyStateTitle() }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ getEmptyStateDescription() }}
      </p>
      <UButton to="/" color="primary" icon="i-heroicons-magnifying-glass">
        {{ $t('pages.volunteers.browse_conventions') }}
      </UButton>
    </div>

    <!-- Modal Détails de la candidature -->
    <VolunteersApplicationDetailsModal
      v-model="detailsModalOpen"
      :application="selectedApplicationForDetails"
    />

    <!-- Modal QR Code -->
    <VolunteersQrCodeModal
      v-model:open="qrCodeModalOpen"
      :application="selectedApplicationForQrCode"
    />
  </div>
</template>

<script setup lang="ts">
import { withdrawVolunteerApplication } from '~/utils/volunteer-application-api'

// Interface pour les applications enrichies avec les settings
interface ApplicationWithSettings {
  [key: string]: any
  volunteersSettings?: any
}

interface ContactOrganizerResponse {
  conversationId: number
}

definePageMeta({
  middleware: 'auth-protected',
})

const { t } = useI18n()
const { getImageUrl } = useImageUrl()
const toast = useToast()
const { user } = useUserSession()

// Nom complet du bénévole
const volunteerFullName = computed(() => {
  if (!user.value) return undefined
  return `${user.value.prenom} ${user.value.nom}`
})

// Cache pour les settings des bénévoles par édition
const volunteersSettingsCache = ref<Map<number, any>>(new Map())

// Fonction pour récupérer les settings d'une édition
const getVolunteerSettings = async (editionId: number) => {
  if (volunteersSettingsCache.value.has(editionId)) {
    return volunteersSettingsCache.value.get(editionId)
  }

  try {
    const response = await $fetch(`/api/editions/${editionId}/volunteers/settings`)
    const settings = (response as any)?.settings || response
    volunteersSettingsCache.value.set(editionId, settings)
    return settings
  } catch {
    return null
  }
}

// États de la vue
const viewMode = ref<'detailed' | 'compact'>('detailed')
const activeTab = ref('all')
const detailsModalOpen = ref(false)
const selectedApplicationForDetails = ref<any>(null)
const qrCodeModalOpen = ref(false)
const selectedApplicationForQrCode = ref<any>(null)

// Récupération des candidatures
const {
  data: applications,
  pending,
  error,
  refresh,
} = await useFetch('/api/user/volunteer-applications')

// Applications enrichies avec les settings de bénévoles et état d'affichage
const applicationsWithSettings = computed((): ApplicationWithSettings[] => {
  if (!applications.value) return []

  return applications.value.map((app) => ({
    ...app,
    volunteersSettings: volunteersSettingsCache.value.get(app.edition.id) || null,
    showDetails: false, // Masqué par défaut
  })) as ApplicationWithSettings[]
})

// Séparer les applications futures/en cours et passées
const now = new Date()
const futureOrCurrentApplications = computed(() => {
  return applicationsWithSettings.value.filter((app) => {
    const endDate = new Date(app.edition.endDate)
    return endDate >= now
  })
})

// Pour une utilisation future si besoin de séparer les applications passées
// const pastApplications = computed(() => {
//   return applicationsWithSettings.value.filter((app) => {
//     const endDate = new Date(app.edition.endDate)
//     return endDate < now
//   })
// })

// Précharger les settings pour toutes les éditions des candidatures
watchEffect(async () => {
  if (applications.value) {
    const editionIds = [...new Set(applications.value.map((app) => app.edition.id))]
    await Promise.all(editionIds.map((id) => getVolunteerSettings(id)))
  }
})

// Applications filtrées selon l'onglet actif
const filteredApplications = computed(() => {
  if (!applicationsWithSettings.value) return []

  switch (activeTab.value) {
    case 'pending':
      return futureOrCurrentApplications.value.filter((app) => app.status === 'PENDING')
    case 'accepted':
      return futureOrCurrentApplications.value.filter((app) => app.status === 'ACCEPTED')
    case 'rejected':
      return futureOrCurrentApplications.value.filter((app) => app.status === 'REJECTED')
    case 'history':
      // Historique : toutes les candidatures WITHDRAWN + toutes les candidatures des éditions passées
      return applicationsWithSettings.value.filter((app) => {
        const endDate = new Date(app.edition.endDate)
        return app.status === 'WITHDRAWN' || endDate < now
      })
    default:
      // Onglet "Tout" : uniquement éditions futures/en cours
      return futureOrCurrentApplications.value
  }
})

// Configuration des onglets
const tabs = computed(() => [
  {
    id: 'all',
    label: t('common.all'),
    icon: 'i-heroicons-folder',
    count: futureOrCurrentApplications.value?.length || 0,
    badgeColor: 'primary',
  },
  {
    id: 'pending',
    label: t('pages.volunteers.pending'),
    icon: 'i-heroicons-clock',
    count: futureOrCurrentApplications.value?.filter((app) => app.status === 'PENDING').length || 0,
    badgeColor: 'warning',
  },
  {
    id: 'accepted',
    label: t('pages.volunteers.accepted'),
    icon: 'i-heroicons-check-circle',
    count:
      futureOrCurrentApplications.value?.filter((app) => app.status === 'ACCEPTED').length || 0,
    badgeColor: 'success',
  },
  {
    id: 'rejected',
    label: t('pages.volunteers.rejected'),
    icon: 'i-heroicons-x-circle',
    count:
      futureOrCurrentApplications.value?.filter((app) => app.status === 'REJECTED').length || 0,
    badgeColor: 'error',
  },
  {
    id: 'history',
    label: t('pages.volunteers.history'),
    icon: 'i-heroicons-archive-box',
    count:
      applicationsWithSettings.value?.filter((app) => {
        const endDate = new Date(app.edition.endDate)
        return app.status === 'WITHDRAWN' || endDate < now
      }).length || 0,
    badgeColor: 'gray',
  },
])

// Fonctions utilitaires
const getEditionDisplayName = (edition: any) => {
  return edition.name || edition.convention.name
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const startStr = start.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })

  const endStr = end.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return `${startStr} - ${endStr}`
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'warning'
    case 'ACCEPTED':
      return 'success'
    case 'REJECTED':
      return 'error'
    case 'WITHDRAWN':
      return 'neutral'
    default:
      return 'neutral'
  }
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'ACCEPTED':
      return 'solid'
    case 'REJECTED':
      return 'solid'
    default:
      return 'soft'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'i-heroicons-clock'
    case 'ACCEPTED':
      return 'i-heroicons-check-circle'
    case 'REJECTED':
      return 'i-heroicons-x-circle'
    case 'WITHDRAWN':
      return 'i-heroicons-arrow-uturn-left'
    default:
      return 'i-heroicons-question-mark-circle'
  }
}

// Fonction helper pour extraire les time slots des assignments
const getTimeSlotsFromAssignments = (assignments: any[]) => {
  return assignments.map((assignment) => assignment.timeSlot)
}

// Fonction pour retirer une candidature
const withdrawApplication = async (applicationId: number) => {
  if (!confirm(t('pages.volunteers.confirm_withdraw'))) {
    return
  }

  try {
    // Utiliser l'utilitaire pour retirer la candidature
    const editionId = applications.value?.find((app) => app.id === applicationId)?.edition.id
    if (!editionId) throw new Error('Edition introuvable')

    await withdrawVolunteerApplication(editionId)

    toast.add({
      title: t('pages.volunteers.withdrawal_success'),
      color: 'success',
    })

    // Rafraîchir la liste
    await refresh()
  } catch (_error: unknown) {
    const error = _error as { data?: { message?: string } }
    toast.add({
      title: t('common.error'),
      description: error.data?.message || t('pages.volunteers.withdrawal_error'),
      color: 'error',
    })
  }
}

// Fonction pour afficher les détails de l'application
const showApplicationDetails = (application: any) => {
  selectedApplicationForDetails.value = application
  detailsModalOpen.value = true
}

// Fonction pour contacter les responsables bénévoles
const contactOrganizerEditionId = ref<number | null>(null)

const { execute: executeContactOrganizer } = useApiAction<
  { editionId: number },
  ContactOrganizerResponse
>('/api/messenger/volunteer-to-organizers', {
  method: 'POST',
  body: () => ({ editionId: contactOrganizerEditionId.value! }),
  silent: true,
  onSuccess: (result: ContactOrganizerResponse) => {
    navigateTo(`/messenger?conversation=${result.conversationId}`)
  },
  onError: () => {
    toast.add({
      title: t('common.error'),
      description: t('pages.volunteers.contact_organizer_error'),
      color: 'error',
    })
  },
})

const contactOrganizer = (application: any) => {
  contactOrganizerEditionId.value = application.edition.id
  executeContactOrganizer()
}

// Fonction pour afficher le QR code
const showQrCode = (application: any) => {
  selectedApplicationForQrCode.value = application
  qrCodeModalOpen.value = true
}

// Fonction pour basculer l'affichage des détails (non utilisée après simplification)
// const toggleDetails = (application: any) => {
//   application.showDetails = !application.showDetails
// }

// États vides personnalisés
const getEmptyStateIcon = () => {
  switch (activeTab.value) {
    case 'pending':
      return 'i-heroicons-clock'
    case 'accepted':
      return 'i-heroicons-check-circle'
    case 'rejected':
      return 'i-heroicons-x-circle'
    case 'history':
      return 'i-heroicons-archive-box'
    default:
      return 'i-heroicons-hand-raised'
  }
}

const getEmptyStateTitle = () => {
  switch (activeTab.value) {
    case 'pending':
      return t('pages.volunteers.no_pending_applications')
    case 'accepted':
      return t('pages.volunteers.no_accepted_applications')
    case 'rejected':
      return t('pages.volunteers.no_rejected_applications')
    case 'history':
      return t('pages.volunteers.no_history')
    default:
      return t('pages.volunteers.no_applications')
  }
}

const getEmptyStateDescription = () => {
  switch (activeTab.value) {
    case 'pending':
      return t('pages.volunteers.no_pending_description')
    case 'accepted':
      return t('pages.volunteers.no_accepted_description')
    case 'rejected':
      return t('pages.volunteers.no_rejected_description')
    case 'history':
      return t('pages.volunteers.no_history_description')
    default:
      return t('pages.volunteers.no_applications_description')
  }
}

// const getEmptyStateActions = () => {
//   const actions = []

//   switch (activeTab.value) {
//     case 'pending':
//       actions.push({
//         label: t('pages.volunteers.browse_conventions'),
//         to: '/',
//         color: 'primary',
//         variant: 'solid',
//         icon: 'i-heroicons-magnifying-glass'
//       })
//       break
//     case 'accepted':
//       actions.push({
//         label: t('pages.volunteers.browse_conventions'),
//         to: '/',
//         color: 'primary',
//         variant: 'solid',
//         icon: 'i-heroicons-magnifying-glass'
//       })
//       break
//     case 'history':
//       actions.push({
//         label: t('pages.volunteers.browse_conventions'),
//         to: '/',
//         color: 'primary',
//         variant: 'outline',
//         icon: 'i-heroicons-magnifying-glass'
//       })
//       if (acceptedApplications.value.length > 0) {
//         actions.unshift({
//           label: t('common.accepted'),
//           to: '#',
//           color: 'success',
//           variant: 'solid',
//           icon: 'i-heroicons-check-circle'
//         })
//       }
//       break
//     default:
//       actions.push({
//         label: t('pages.volunteers.browse_conventions'),
//         to: '/',
//         color: 'primary',
//         variant: 'solid',
//         icon: 'i-heroicons-magnifying-glass'
//       })
//   }

//   return actions
// }

// SEO
useSeoMeta({
  title: t('pages.volunteers.my_applications'),
  description: t('pages.volunteers.applications_description'),
})
</script>

<style scoped>
/* Animations et transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}

/* Amélioration du scroll horizontal pour les tabs */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Animation pour les badges de statut */
.status-badge {
  transition: all 0.2s ease;
}

.status-badge:hover {
  transform: scale(1.05);
}

/* Animation pour le collapse des détails */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: scaleY(0.95) translateY(-10px);
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  transform: scaleY(1) translateY(0);
}
</style>
