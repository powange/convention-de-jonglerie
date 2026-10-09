<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- En-tête -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ $t('pages.artists.my_applications') }}
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          {{ $t('pages.artists.applications_description') }}
        </p>
      </div>

      <!-- Boutons d'action -->
      <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        <!-- Bouton vers les appels ouverts -->
        <UButton to="/shows-call/open" color="primary" variant="solid" icon="i-heroicons-megaphone">
          {{ $t('pages.artists.browse_open_calls') }}
        </UButton>

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
    <div v-if="isLoading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" size="24" />
    </div>

    <!-- Erreur -->
    <div v-else-if="hasError" class="text-center py-12">
      <UIcon
        name="i-heroicons-exclamation-triangle"
        class="mx-auto mb-4 text-error-500"
        size="48"
      />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('common.error') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ $t('errors.loading_error') }}
      </p>
    </div>

    <!-- Contenu selon l'onglet actif -->
    <template v-else>
      <!-- Liste des candidatures filtrées -->
      <div v-if="filteredApplications && filteredApplications.length > 0" class="space-y-6">
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
                      v-if="application.showCall.edition.imageUrl"
                      :src="
                        getImageUrl(
                          application.showCall.edition.imageUrl,
                          'edition',
                          application.showCall.edition.id
                        ) || ''
                      "
                      :alt="getEditionDisplayName(application.showCall.edition)"
                      class="w-16 h-16 object-cover rounded-lg"
                    />
                    <img
                      v-else-if="application.showCall.edition.convention.logo"
                      :src="
                        getImageUrl(
                          application.showCall.edition.convention.logo,
                          'convention',
                          application.showCall.edition.convention.id
                        ) || ''
                      "
                      :alt="application.showCall.edition.convention.name"
                      class="w-16 h-16 object-cover rounded-lg"
                    />
                    <div
                      v-else
                      class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
                    >
                      <UIcon name="i-heroicons-sparkles" class="text-gray-400" size="24" />
                    </div>
                  </div>

                  <div class="flex-1">
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                      {{ getEditionDisplayName(application.showCall.edition) }}
                    </h3>
                    <p
                      v-if="application.showCall.name"
                      class="text-primary-600 dark:text-primary-400 flex items-center gap-2 mt-1 font-medium"
                    >
                      <UIcon name="i-heroicons-megaphone" class="w-4 h-4" />
                      {{ application.showCall.name }}
                    </p>
                    <p class="text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                      <UIcon name="i-heroicons-map-pin" class="w-4 h-4" />
                      {{ application.showCall.edition.city }},
                      {{ application.showCall.edition.country }}
                    </p>
                    <p class="text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                      <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
                      {{
                        formatDateRange(
                          application.showCall.edition.startDate,
                          application.showCall.edition.endDate
                        )
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
                    {{ getStatusLabel(application.status) }}
                  </UBadge>

                  <span class="text-sm text-gray-500">
                    {{ $t('pages.artists.applied_on') }} {{ formatDate(application.createdAt) }}
                  </span>

                  <span
                    v-if="application.decidedAt && application.status !== 'PENDING'"
                    class="text-sm text-gray-500"
                  >
                    {{ $t('pages.artists.decided_on') }} {{ formatDate(application.decidedAt) }}
                  </span>
                </div>
              </div>
            </template>

            <!-- Infos du spectacle -->
            <div class="space-y-4">
              <!-- Titre du spectacle -->
              <div class="flex items-start gap-3">
                <UIcon
                  name="i-heroicons-sparkles"
                  class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5"
                />
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ $t('pages.artists.show_title') }}
                  </p>
                  <p class="text-gray-600 dark:text-gray-400">{{ application.showTitle }}</p>
                </div>
              </div>

              <!-- Durée et catégorie -->
              <div class="flex flex-wrap gap-6">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-clock" class="w-4 h-4 text-gray-400" />
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ $t('pages.artists.duration') }}:
                    {{
                      $t('pages.artists.duration_minutes', { minutes: application.showDuration })
                    }}
                  </span>
                </div>
                <div v-if="application.showCategory" class="flex items-center gap-2">
                  <UIcon name="i-heroicons-tag" class="w-4 h-4 text-gray-400" />
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ $t('pages.artists.category') }}: {{ application.showCategory }}
                  </span>
                </div>
                <div
                  v-if="application.additionalPerformersCount > 0"
                  class="flex items-center gap-2"
                >
                  <UIcon name="i-heroicons-user-group" class="w-4 h-4 text-gray-400" />
                  <span class="text-gray-600 dark:text-gray-400">
                    {{
                      $t('pages.artists.additional_performers_count', {
                        count: application.additionalPerformersCount,
                      })
                    }}
                  </span>
                </div>
              </div>

              <!--
                Les notes de l'organisateur ne sont plus affichées ici : ce sont des notes internes
                à l'équipe d'organisation, et l'API ne les renvoie plus. Ce qu'un organisateur veut
                dire à l'artiste passe par la discussion, juste en dessous.
              -->

              <!-- Bouton pour ouvrir la discussion -->
              <UButton
                color="primary"
                variant="outline"
                icon="i-heroicons-chat-bubble-left-right"
                @click="openChatModal(application.id)"
              >
                {{ $t('pages.artists.open_discussion') }}
                <!-- Le compte des messages en attente, sur le bouton lui-même : c'est le seul
                     endroit de cette page qui mène à la discussion. -->
                <UBadge
                  v-if="(application.unreadMessages ?? 0) > 0"
                  color="primary"
                  variant="solid"
                  size="sm"
                  class="ml-1"
                >
                  {{ application.unreadMessages }}
                </UBadge>
              </UButton>

              <!-- Statut de l'appel -->
              <div class="flex items-center gap-2 text-sm">
                <UBadge
                  :color="
                    application.showCall.visibility === 'PUBLIC' ||
                    application.showCall.visibility === 'PRIVATE'
                      ? 'success'
                      : 'neutral'
                  "
                  variant="soft"
                  size="sm"
                >
                  {{
                    application.showCall.visibility === 'PUBLIC' ||
                    application.showCall.visibility === 'PRIVATE'
                      ? $t('pages.artists.call_open')
                      : $t('pages.artists.call_closed')
                  }}
                </UBadge>
                <span v-if="application.showCall.deadline" class="text-gray-500">
                  {{ $t('pages.artists.deadline') }}:
                  {{ formatDate(application.showCall.deadline) }}
                </span>
              </div>
            </div>

            <!-- Actions -->
            <template #footer>
              <div
                class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0"
              >
                <div class="flex flex-wrap gap-2">
                  <UButton
                    :to="`/editions/${application.showCall.edition.id}`"
                    size="sm"
                    color="primary"
                    variant="solid"
                    icon="i-heroicons-eye"
                    class="flex-1 sm:flex-none"
                  >
                    <span class="hidden sm:inline">{{ $t('pages.artists.view_edition') }}</span>
                    <span class="sm:hidden">{{ $t('pages.artists.view_edition_short') }}</span>
                  </UButton>

                  <UButton
                    v-if="peutModifier(application)"
                    :to="`/editions/${application.showCall.edition.id}/shows-call/${application.showCall.id}/apply`"
                    size="sm"
                    color="info"
                    variant="outline"
                    icon="i-heroicons-pencil"
                    class="flex-1 sm:flex-none"
                  >
                    <span class="hidden sm:inline">{{ $t('pages.artists.edit_application') }}</span>
                    <span class="sm:hidden">{{ $t('pages.artists.edit_application_short') }}</span>
                  </UButton>

                  <!-- ⚠️ `status === 'PENDING'` et NON `peutModifier` : le serveur n'exige que
                       l'attente pour un retrait, là où la modification demande aussi un appel
                       encore ouvert et une date limite non dépassée. Employer la même condition
                       pour les deux ferait disparaître le bouton de retrait sur un appel clos —
                       alors que le serveur l'accepte, et que c'est précisément là qu'un artiste
                       empêché en a besoin. -->
                  <UButton
                    v-if="application.status === 'PENDING'"
                    size="sm"
                    color="error"
                    variant="outline"
                    icon="i-heroicons-x-mark"
                    :loading="retraitEnCours === application.id"
                    class="flex-1 sm:flex-none"
                    @click="demanderLeRetrait(application)"
                  >
                    <span class="hidden sm:inline">{{ $t('pages.artists.withdraw') }}</span>
                    <span class="sm:hidden">{{ $t('pages.artists.withdraw_short') }}</span>
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
                  v-if="application.showCall.edition.imageUrl"
                  :src="
                    getImageUrl(
                      application.showCall.edition.imageUrl,
                      'edition',
                      application.showCall.edition.id
                    ) || ''
                  "
                  :alt="getEditionDisplayName(application.showCall.edition)"
                  class="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg"
                />
                <img
                  v-else-if="application.showCall.edition.convention.logo"
                  :src="
                    getImageUrl(
                      application.showCall.edition.convention.logo,
                      'convention',
                      application.showCall.edition.convention.id
                    ) || ''
                  "
                  :alt="application.showCall.edition.convention.name"
                  class="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg"
                />
                <div
                  v-else
                  class="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
                >
                  <UIcon name="i-heroicons-sparkles" class="text-gray-400" size="18" />
                </div>
              </div>

              <!-- Informations principales -->
              <div class="flex-1 min-w-0">
                <h3
                  class="font-semibold text-gray-900 dark:text-white truncate text-sm sm:text-base"
                >
                  {{ application.showTitle }}
                </h3>
                <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                  {{ getEditionDisplayName(application.showCall.edition) }}
                  <span
                    v-if="application.showCall.name"
                    class="text-primary-600 dark:text-primary-400"
                  >
                    · {{ application.showCall.name }}
                  </span>
                </p>
                <p class="text-xs text-gray-500 truncate">
                  {{ application.showCall.edition.city }},
                  {{ application.showCall.edition.country }}
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
                {{ getStatusLabel(application.status) }}
              </UBadge>

              <!-- Actions rapides -->
              <div class="flex flex-wrap gap-1 sm:gap-1 justify-start sm:justify-end">
                <UButton
                  :to="`/editions/${application.showCall.edition.id}`"
                  size="xs"
                  color="primary"
                  variant="ghost"
                  icon="i-heroicons-eye"
                  class="sm:w-auto w-8 h-8"
                  square
                />
                <UButton
                  v-if="peutModifier(application)"
                  :to="`/editions/${application.showCall.edition.id}/shows-call/${application.showCall.id}/apply`"
                  size="xs"
                  color="info"
                  variant="ghost"
                  icon="i-heroicons-pencil"
                  class="sm:w-auto w-8 h-8"
                  square
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
        <UButton to="/shows-call/open" color="primary" icon="i-heroicons-megaphone">
          {{ $t('pages.artists.browse_open_calls') }}
        </UButton>
      </div>
    </template>

    <!-- Modal de discussion -->
    <UModal
      v-model:open="isChatModalOpen"
      :title="$t('components.artist_application.chat.title')"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <UButton
        color="primary"
        variant="outline"
        icon="i-heroicons-chat-bubble-left-right"
        class="hidden"
      />

      <template #body>
        <ShowApplicationChat
          v-if="selectedApplicationId"
          :application-id="selectedApplicationId"
          class="h-[60vh]"
        />
      </template>
    </UModal>

    <!-- Une seule modale pour les confirmations de l'écran. Le retrait est définitif : la
         candidature et ses échanges partent ensemble. -->
    <UiConfirmationDemandee :confirmation="confirmation" />
  </div>
</template>

<script setup lang="ts">
import { candidatureModifiable } from '~~/shared/utils/candidature-spectacle'

definePageMeta({
  layout: 'profile',
  middleware: 'auth-protected',
})

const { t, locale } = useI18n()
const { getImageUrl } = useImageUrl()

/**
 * Le bouton « Modifier » suit exactement la règle du serveur
 * (`shows-call/[showCallId]/my-application.put.ts`), posée une seule fois dans
 * `shared/utils/candidature-spectacle.ts`.
 *
 * ⚠️ CE QUI N'ALLAIT PAS : la condition était
 * `(status === 'PENDING' && visibility === 'PUBLIC') || visibility === 'PRIVATE'`. La parenthèse
 * laisse `PRIVATE` SEUL, sans aucune exigence de statut : une candidature acceptée ou refusée sur
 * un appel privé affichait « Modifier », et le clic menait sur la page de candidature qui répond
 * « vous avez déjà candidaté ». Et la date limite n'était vérifiée dans aucun des deux cas, alors
 * que le serveur la refuse. Les deux vues, détaillée et compacte, portaient la même faute copiée.
 */
function peutModifier(application: {
  status: string
  showCall: { visibility: string; deadline?: string | null }
}): boolean {
  return candidatureModifiable({
    statut: application.status,
    visibiliteAppel: application.showCall.visibility,
    dateLimiteAppel: application.showCall.deadline,
  })
}

// États de la vue
const viewMode = ref<'detailed' | 'compact'>('detailed')
const activeTab = ref('all') // Par défaut sur toutes les candidatures

// Modal de discussion
const isChatModalOpen = ref(false)
const selectedApplicationId = ref<number | null>(null)

const openChatModal = (applicationId: number) => {
  selectedApplicationId.value = applicationId
  isChatModalOpen.value = true
}

// Récupération des candidatures
const {
  data: applications,
  pending: isLoading,
  error: hasError,
  refresh: rechargerLesCandidatures,
} = await useFetch('/api/user/show-applications')

const confirmation = useConfirmation()
const { succes, erreur } = useNotificateur()
const retraitEnCours = ref<number | null>(null)

/**
 * Retirer une candidature en attente.
 *
 * ## ⚠️ LA CONFIRMATION DIT CE QUI PART, PAS « ÊTES-VOUS SÛR ? »
 *
 * Le retrait emporte la candidature **et ses échanges** : `Conversation.showApplicationId` porte
 * `onDelete: Cascade`. Une confirmation qui ne nommerait pas cette seconde perte laisserait
 * l'artiste découvrir que sa discussion avec les organisateurs a disparu avec elle.
 *
 * ## 📍 CE QUI EST RAFRAÎCHI, ET CE QUI NE L'EST PAS
 *
 * La liste de la page, et elle seule. L'énoncé du constat demandait aussi
 * `rafraichirCompteurs('appels-spectacles')` — **cet appel ne ferait rien ici**, et il valait mieux
 * le vérifier que l'écrire : ce compteur est celui de la barre latérale d'une ÉDITION (il exige
 * `contexte.editionId` et compte les candidatures qu'un ORGANISATEUR doit trancher). Sur une page
 * de profil il n'y a pas de contexte d'édition, et `rafraichirCompteurs` sort alors en silence.
 */
function demanderLeRetrait(application: {
  id: number
  showTitle: string
  showCall: { id: number; edition: { id: number } }
}) {
  confirmation.demanderConfirmation({
    titre: t('pages.artists.withdraw'),
    description: t('pages.artists.withdraw_confirm', { title: application.showTitle }),
    libelleConfirmer: t('pages.artists.withdraw'),
    couleurConfirmer: 'error',
    agir: () => retirer(application),
  })
}

async function retirer(application: {
  id: number
  showCall: { id: number; edition: { id: number } }
}) {
  retraitEnCours.value = application.id
  try {
    await $fetch(
      `/api/editions/${application.showCall.edition.id}/shows-call/${application.showCall.id}/my-application`,
      { method: 'DELETE' }
    )
    succes(t('pages.artists.withdrawn'))
    await rechargerLesCandidatures()
  } catch (e) {
    erreur(t('pages.artists.withdraw_error'), { description: messageDErreurServeur(e) })
  } finally {
    // Dans les DEUX chemins : `useApiAction` n'a pas de crochet `finally`, et un indicateur laissé
    // allumé sur l'échec fige le bouton pour toujours.
    retraitEnCours.value = null
  }
}

// Applications filtrées selon l'onglet actif
const filteredApplications = computed(() => {
  if (!applications.value) return []

  switch (activeTab.value) {
    case 'pending':
      return applications.value.filter((app) => app.status === 'PENDING')
    case 'accepted':
      return applications.value.filter((app) => app.status === 'ACCEPTED')
    case 'rejected':
      return applications.value.filter((app) => app.status === 'REJECTED')
    case 'all':
      return applications.value
    default:
      return []
  }
})

// Configuration des onglets
const tabs = computed(() => [
  {
    id: 'all',
    label: t('common.all'),
    icon: 'i-heroicons-folder',
    count: applications.value?.length || 0,
    badgeColor: 'primary',
  },
  {
    id: 'pending',
    label: t('pages.artists.pending'),
    icon: 'i-heroicons-clock',
    count: applications.value?.filter((app) => app.status === 'PENDING').length || 0,
    badgeColor: 'warning',
  },
  {
    id: 'accepted',
    label: t('pages.artists.accepted'),
    icon: 'i-heroicons-check-circle',
    count: applications.value?.filter((app) => app.status === 'ACCEPTED').length || 0,
    badgeColor: 'success',
  },
  {
    id: 'rejected',
    label: t('pages.artists.rejected'),
    icon: 'i-heroicons-x-circle',
    count: applications.value?.filter((app) => app.status === 'REJECTED').length || 0,
    badgeColor: 'error',
  },
])

// Fonctions utilitaires
const getEditionDisplayName = (edition: any) => {
  return edition.name || edition.convention.name
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString(locale.value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const startStr = start.toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
  })

  const endStr = end.toLocaleDateString(locale.value, {
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
    default:
      return 'i-heroicons-question-mark-circle'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING':
      return t('pages.artists.pending')
    case 'ACCEPTED':
      return t('pages.artists.accepted')
    case 'REJECTED':
      return t('pages.artists.rejected')
    default:
      return status
  }
}

// États vides personnalisés
const getEmptyStateIcon = () => {
  switch (activeTab.value) {
    case 'pending':
      return 'i-heroicons-clock'
    case 'accepted':
      return 'i-heroicons-check-circle'
    case 'rejected':
      return 'i-heroicons-x-circle'
    default:
      return 'i-heroicons-sparkles'
  }
}

const getEmptyStateTitle = () => {
  switch (activeTab.value) {
    case 'pending':
      return t('pages.artists.no_pending_applications')
    case 'accepted':
      return t('pages.artists.no_accepted_applications')
    case 'rejected':
      return t('pages.artists.no_rejected_applications')
    default:
      return t('pages.artists.no_applications')
  }
}

const getEmptyStateDescription = () => {
  switch (activeTab.value) {
    case 'pending':
      return t('pages.artists.no_pending_description')
    case 'accepted':
      return t('pages.artists.no_accepted_description')
    case 'rejected':
      return t('pages.artists.no_rejected_description')
    default:
      return t('pages.artists.no_applications_description')
  }
}

// SEO
useSeoMeta({
  title: t('pages.artists.my_applications'),
  description: t('pages.artists.applications_description'),
})
</script>

<style scoped>
/* Amélioration du scroll horizontal pour les tabs */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
