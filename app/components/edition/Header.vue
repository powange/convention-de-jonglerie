<template>
  <div class="mb-6">
    <!-- En-tête avec le nom de l'édition -->
    <div class="mb-4">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="flex items-start gap-4">
          <div v-if="edition.convention?.logo" class="flex-shrink-0">
            <img
              :src="
                getImageUrl(edition.convention.logo, 'convention', edition.convention?.id) || ''
              "
              :alt="edition.convention.name"
              class="w-16 h-auto object-contain rounded-lg shadow-md"
            />
          </div>
          <div
            v-else
            class="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center shadow-md"
          >
            <UIcon name="i-heroicons-building-library" class="text-gray-400" size="24" />
          </div>
          <div class="flex-1">
            <div class="flex items-start justify-between sm:block">
              <div>
                <h1 class="text-2xl sm:text-3xl font-bold">{{ getEditionDisplayName(edition) }}</h1>
                <div
                  class="flex flex-col sm:flex-row sm:items-center sm:gap-4 mt-2 text-gray-500 text-sm sm:text-base"
                >
                  <span>{{ edition.city }}, {{ edition.country }}</span>
                  <span class="hidden sm:inline">•</span>
                  <span>{{ formatDateRange(edition.startDate, edition.endDate) }}</span>
                </div>

                <!-- Boutons actions -->
                <div class="mt-3 flex flex-wrap gap-2">
                  <UButton
                    variant="ghost"
                    size="sm"
                    icon="i-heroicons-information-circle"
                    color="info"
                    @click="showConventionModal = true"
                  >
                    {{ $t('editions.learn_more_about_convention') }}
                  </UButton>

                  <UDropdownMenu :items="calendarOptions">
                    <UButton
                      variant="ghost"
                      size="sm"
                      icon="material-symbols:calendar-add-on"
                      color="neutral"
                    >
                      {{ $t('calendar.add_to_calendar') }}
                    </UButton>
                  </UDropdownMenu>
                </div>
              </div>

              <!-- Actions mobile -->
              <ClientOnly>
                <div v-if="authStore.isAuthenticated" class="sm:hidden flex items-center gap-2">
                  <!-- Bouton favori mobile -->
                  <UButton
                    :icon="isFavorited ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                    :color="isFavorited ? 'warning' : 'neutral'"
                    variant="ghost"
                    size="sm"
                    class="flex-shrink-0"
                    @click="toggleFavorite"
                  />
                </div>
              </ClientOnly>
            </div>
          </div>
        </div>

        <!-- Actions desktop -->
        <ClientOnly>
          <div v-if="authStore.isAuthenticated" class="hidden sm:flex gap-3">
            <!-- Bouton revendication -->

            <!-- Modale de revendication -->
            <ConventionClaimModal
              v-if="canClaimConvention"
              :convention="edition.convention"
              @claimed="handleConventionClaimed"
            />

            <!-- Bouton favori -->
            <UButton
              :icon="isFavorited ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
              :color="isFavorited ? 'warning' : 'neutral'"
              variant="ghost"
              size="md"
              @click="toggleFavorite"
            >
              {{ isFavorited ? t('common.added') : t('common.add') }}
            </UButton>
          </div>
        </ClientOnly>
      </div>
    </div>

    <!-- Navigation par onglets -->
    <div class="border-b border-gray-200">
      <nav
        class="flex justify-center sm:justify-start space-x-2 sm:space-x-8"
        :aria-label="$t('navigation.tabs')"
      >
        <NuxtLink
          :to="`/editions/${edition.id}`"
          :class="[
            'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'details'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          :title="t('editions.about_this_edition')"
        >
          <UIcon
            name="i-heroicons-information-circle"
            :class="['sm:mr-1']"
            size="24"
            class="sm:!w-4 sm:!h-4"
          />
          <span class="hidden sm:inline">{{ t('editions.about_this_edition') }}</span>
        </NuxtLink>

        <NuxtLink
          :to="`/editions/${edition.id}/commentaires`"
          :class="[
            'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'commentaires'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          :title="t('editions.posts')"
        >
          <UIcon
            name="i-heroicons-chat-bubble-left-right"
            :class="['sm:mr-1']"
            size="24"
            class="sm:!w-4 sm:!h-4"
          />
          <span class="hidden sm:inline">{{ t('editions.posts') }}</span>
        </NuxtLink>

        <NuxtLink
          :to="`/editions/${edition.id}/carpool`"
          :class="[
            'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'carpool'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          :title="t('editions.carpool')"
        >
          <UIcon name="i-heroicons-truck" :class="['sm:mr-1']" size="24" class="sm:!w-4 sm:!h-4" />
          <span class="hidden sm:inline">{{ t('editions.carpool') }}</span>
        </NuxtLink>

        <NuxtLink
          v-if="volunteersTabVisible"
          :to="`/editions/${edition.id}/volunteers`"
          :class="[
            'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'volunteers'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          :title="t('editions.volunteers.title')"
        >
          <UIcon
            name="i-heroicons-hand-raised"
            :class="['sm:mr-1']"
            size="24"
            class="sm:!w-4 sm:!h-4"
          />
          <span class="hidden sm:inline">{{ t('editions.volunteers.title') }}</span>
        </NuxtLink>

        <NuxtLink
          v-if="workshopsTabVisible"
          :to="`/editions/${edition.id}/workshops`"
          :class="[
            'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'workshops'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          title="Workshops"
        >
          <UIcon
            name="i-heroicons-academic-cap"
            :class="['sm:mr-1']"
            size="24"
            class="sm:!w-4 sm:!h-4"
          />
          <span class="hidden sm:inline">Workshops</span>
        </NuxtLink>

        <NuxtLink
          v-if="hasEditionStarted"
          :to="`/editions/${edition.id}/objets-trouves`"
          :class="[
            'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'objets-trouves'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          :title="t('editions.lost_found')"
        >
          <UIcon
            name="i-heroicons-magnifying-glass"
            :class="['sm:mr-1']"
            size="24"
            class="sm:!w-4 sm:!h-4"
          />
          <span class="hidden sm:inline">{{ t('editions.lost_found') }}</span>
        </NuxtLink>

        <ClientOnly>
          <NuxtLink
            v-if="canAccess"
            :to="`/editions/${edition.id}/gestion`"
            :class="[
              'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
              currentPage === 'gestion'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
            :title="t('editions.management')"
          >
            <UIcon name="i-heroicons-cog" :class="['sm:mr-1']" size="24" class="sm:!w-4 sm:!h-4" />
            <span class="hidden sm:inline">{{ t('editions.management') }}</span>
          </NuxtLink>
        </ClientOnly>
      </nav>

      <!-- Titre de la page courante sur mobile -->
      <div class="sm:hidden text-center py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ getPageTitle(currentPage) }}
      </div>
    </div>

    <!-- Modale d'informations sur la convention -->
    <UModal v-model:open="showConventionModal" :title="edition.convention?.name" size="md">
      <template #body>
        <div class="space-y-4">
          <!-- Logo de la convention -->
          <div v-if="edition.convention?.logo" class="flex justify-center">
            <img
              :src="
                getImageUrl(edition.convention.logo, 'convention', edition.convention?.id) || ''
              "
              :alt="$t('conventions.logo_alt', { name: edition.convention.name })"
              class="max-w-32 max-h-32 object-contain"
            />
          </div>

          <!-- Description de la convention -->
          <div
            v-if="edition.convention?.description && conventionDescriptionHtml"
            class="prose prose-sm max-w-none text-gray-700 dark:text-gray-300"
          >
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-html="conventionDescriptionHtml" />
          </div>
          <p v-else class="text-gray-700 dark:text-gray-300 text-center">
            {{ $t('conventions.no_description_available') }}
          </p>
        </div>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end">
          <UButton variant="outline" @click="close">
            {{ $t('common.close') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { useFavoritesEditionsStore } from '~/stores/favoritesEditions'
import type { Edition } from '~/types'
import { getCalendarOptions, type CalendarEventData } from '~/utils/calendar'
import { getEditionDisplayName } from '~/utils/editionName'
import { markdownToHtml } from '~/utils/markdown'

const { t } = useI18n()

const { getImageUrl } = useImageUrl()

interface Props {
  edition: Edition
  currentPage:
    | 'details'
    | 'commentaires'
    | 'carpool'
    | 'gestion'
    | 'objets-trouves'
    | 'volunteers'
    | 'workshops'
}

const props = defineProps<Props>()

const authStore = useAuthStore()
const editionStore = useEditionStore()
const favoritesStore = useFavoritesEditionsStore()
const toast = useToast()

// État des modales
const showConventionModal = ref(false)

// État pour vérifier si l'utilisateur est team leader
const isTeamLeaderValue = ref(false)

// Description de la convention en HTML (rendu Markdown)
const conventionDescriptionHtml = computedAsync(async () => {
  if (!props.edition?.convention?.description) {
    return ''
  }
  return await markdownToHtml(props.edition.convention.description)
}, '')

// Vérifier l'accès à la page gestion
const canAccess = computed(() => {
  if (!props.edition || !authStore.user?.id) return false

  // Les admins globaux en mode admin peuvent accéder à la gestion
  if (authStore.isAdminModeActive) {
    return true
  }

  // Les admins peuvent accéder aux conventions orphelines (sans auteur)
  if (authStore.user.isGlobalAdmin && !props.edition.convention?.authorId) {
    return true
  }

  // Créateur de l'édition
  if (authStore.user.id === props.edition.creatorId) {
    return true
  }

  // Utilisateurs avec des droits spécifiques
  const canEdit = editionStore.canEditEdition(props.edition, authStore.user.id)
  const canManageVolunteers = editionStore.canManageVolunteers(props.edition, authStore.user.id)
  if (canEdit || canManageVolunteers) {
    return true
  }

  // Responsables d'équipe de bénévoles
  if (isTeamLeaderValue.value) {
    return true
  }

  // Tous les collaborateurs de la convention (même sans droits)
  if (props.edition.convention?.collaborators) {
    return props.edition.convention.collaborators.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

// Vérifier si l'utilisateur peut revendiquer la convention
const canClaimConvention = computed(() => {
  if (!authStore.isAuthenticated || !props.edition?.convention) return false

  // La convention doit ne pas avoir de créateur et avoir un email
  const convention = props.edition.convention
  return !convention.authorId && !!convention.email
})

// Visibilité onglet bénévoles: ouvert OU utilisateur peut éditer/gérer bénévoles
const volunteersTabVisible = computed<boolean>(() => {
  if (!props.edition) return false
  // Toujours visible pour les éditeurs et gestionnaires de bénévoles (gestion interne même fermé au public)
  if (authStore.user?.id) {
    const canEdit = editionStore.canEditEdition(props.edition, authStore.user.id)
    const canManageVolunteers = editionStore.canManageVolunteers(props.edition, authStore.user.id)
    if (canEdit || canManageVolunteers) return true
  }
  // Visible publiquement uniquement si ouvert
  // edition.volunteersOpen peut ne pas encore être dans le type Edition (ajout récent), cast temporaire
  return (props.edition as any).volunteersOpen === true
})

// Vérifier si l'édition a commencé (affichage onglet objets trouvés dès le début)
const hasEditionStarted = computed(() => {
  if (!props.edition) return false
  return new Date() >= new Date(props.edition.startDate)
})

// Visibilité onglet workshops: activé
const workshopsTabVisible = computed<boolean>(() => {
  if (!props.edition) return false
  return (props.edition as any).workshopsEnabled === true
})

// Gestion des favoris - Initialisation automatique si utilisateur connecté
watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated && !favoritesStore.isInitialized) {
      await favoritesStore.ensureInitialized()
    }

    // Vérifier si l'utilisateur est team leader quand il se connecte
    if (isAuthenticated && authStore.user?.id && props.edition?.id) {
      isTeamLeaderValue.value = await editionStore.isTeamLeader(props.edition.id, authStore.user.id)
    } else {
      isTeamLeaderValue.value = false
    }
  },
  { immediate: true }
)

const isFavorited = computed(() => {
  return favoritesStore.isFavorite(props.edition.id)
})

const toggleFavorite = async () => {
  if (!authStore.isAuthenticated) return

  try {
    await favoritesStore.toggleFavorite(props.edition.id)
    toast.add({
      title: t('messages.favorite_status_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: unknown) {
    const errorMessage =
      e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
        ? e.message
        : t('errors.favorite_update_failed')
    toast.add({
      title: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

// Formatter la plage de dates
const formatDateRange = (start: string, end: string) => {
  const { locale } = useI18n()
  const startDate = new Date(start)
  const endDate = new Date(end)
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }

  if (startDate.toDateString() === endDate.toDateString()) {
    return startDate.toLocaleDateString(locale.value, options)
  }

  return `${startDate.toLocaleDateString(locale.value, { day: 'numeric', month: 'long' })} - ${endDate.toLocaleDateString(locale.value, options)}`
}

// Obtenir le titre de la page selon la page courante
const getPageTitle = (page: string) => {
  const titles: Record<string, string> = {
    details: t('editions.about_this_edition'),
    commentaires: t('editions.posts'),
    carpool: t('editions.carpool'),
    'objets-trouves': t('editions.lost_found'),
    volunteers: t('editions.volunteers.title'),
    workshops: 'Workshops',
    gestion: t('editions.management'),
  }
  return titles[page] || t('editions.about_this_edition')
}

// Données de l'événement pour le calendrier
const calendarEventData = computed<CalendarEventData>(() => {
  const editionName = getEditionDisplayName(props.edition)
  const conventionName = props.edition.convention?.name || ''

  // Construire une adresse complète pour le calendrier
  const locationParts = []
  if (props.edition.addressLine1) locationParts.push(props.edition.addressLine1)
  if (props.edition.addressLine2) locationParts.push(props.edition.addressLine2)
  if (props.edition.postalCode) locationParts.push(props.edition.postalCode)
  if (props.edition.city) locationParts.push(props.edition.city)
  if (props.edition.region) locationParts.push(props.edition.region)
  if (props.edition.country) locationParts.push(props.edition.country)

  const location = locationParts.join(', ')

  return {
    title: editionName,
    description: `${conventionName} - ${editionName}`,
    location,
    startDate: props.edition.startDate,
    endDate: props.edition.endDate,
    url: import.meta.client
      ? `${window.location.origin}/editions/${props.edition.id}`
      : `https://juggling-convention.com/editions/${props.edition.id}`,
  }
})

// Options de calendrier
const calendarOptions = computed(() => {
  const options = getCalendarOptions(calendarEventData.value, t)
  return options.map((option) => ({
    label: option.label,
    icon: option.icon,
    onSelect: option.action,
  }))
})

// Gérer la revendication réussie
const handleConventionClaimed = async () => {
  // Recharger les données de l'édition pour refléter le nouveau propriétaire
  try {
    await editionStore.fetchEditionById(props.edition.id)
    useToast().add({
      title: t('conventions.claim.verification_success'),
      description: t('conventions.claim.verification_success_description'),
      color: 'success',
    })
  } catch (error) {
    console.error("Erreur lors du rechargement de l'édition:", error)
  }
}
</script>
