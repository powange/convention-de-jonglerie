<template>
  <div class="mb-6">
    <!-- En-tête avec le nom de l'édition -->
    <div class="mb-4">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
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
            <div class="flex items-start justify-between gap-1">
              <h1 class="text-2xl md:text-3xl font-bold">{{ getEditionDisplayName(edition) }}</h1>
              <ClientOnly>
                <UButton
                  v-if="authStore.isAuthenticated"
                  :icon="isFavorited ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                  :color="isFavorited ? 'warning' : 'neutral'"
                  variant="ghost"
                  size="sm"
                  class="shrink-0 md:hidden"
                  @click="toggleFavorite"
                />
              </ClientOnly>
            </div>
            <div
              class="flex flex-col md:flex-row md:items-center md:gap-4 mt-2 text-gray-500 text-sm md:text-base"
            >
              <span class="inline-flex items-center gap-1">
                {{ edition.city }},
                <FlagIcon :code="getCountryCode(edition.country)" size="sm" />
                {{ translateCountryName(edition.country) }}
              </span>
              <span class="hidden md:inline">•</span>
              <span class="inline-flex items-center gap-1">
                {{ formatDateRange(edition.startDate, edition.endDate) }}
                <UDropdownMenu :items="calendarOptions">
                  <UButton
                    variant="ghost"
                    size="xs"
                    icon="material-symbols:calendar-add-on"
                    color="neutral"
                    :title="$t('calendar.add_to_calendar')"
                  />
                </UDropdownMenu>
              </span>
            </div>
          </div>
        </div>

        <!-- Actions desktop -->
        <ClientOnly>
          <div v-if="authStore.isAuthenticated" class="hidden md:flex gap-3">
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

      <!-- Boutons actions (hors du conteneur logo pour pleine largeur mobile) -->
      <div class="mt-2 md:mt-3 md:ml-20 flex flex-wrap gap-2">
        <UButton
          variant="ghost"
          size="sm"
          icon="i-heroicons-information-circle"
          color="info"
          @click="showConventionModal = true"
        >
          {{ $t('edition.learn_more_about_convention') }}
        </UButton>

        <EditionManageButton :edition="edition" variant="soft" size="sm" color="primary" />

        <ClientOnly>
          <ConventionClaimModal
            v-if="canClaimConvention"
            :convention="edition.convention"
            class="md:hidden"
            @claimed="handleConventionClaimed"
          />
        </ClientOnly>
      </div>
    </div>

    <!-- Navigation par onglets -->
    <div class="border-b border-gray-200">
      <!-- Mobile : select navigation -->
      <nav class="md:hidden p-3" :aria-label="$t('navigation.tabs')">
        <ClientOnly>
          <USelect
            :model-value="props.currentPage"
            :items="mobileTabItems"
            :aria-label="$t('navigation.tabs')"
            size="xl"
            color="neutral"
            class="w-full"
            :ui="{ content: 'max-h-[70vh]', viewport: 'max-h-[70vh]' }"
            @update:model-value="onMobileTabChange"
          >
            <template #leading>
              <UIcon v-if="currentTabIcon" :name="currentTabIcon" class="size-6 text-primary-500" />
            </template>
            <template #item-leading="{ item: opt }">
              <UIcon :name="(opt as { icon: string }).icon" class="size-5" />
            </template>
          </USelect>
        </ClientOnly>
      </nav>

      <nav
        class="hidden md:flex flex-wrap justify-start gap-x-8 gap-y-1"
        :aria-label="$t('navigation.tabs')"
      >
        <NuxtLink
          :to="`/editions/${edition.id}`"
          :class="[
            'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'details'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          :title="t('edition.about_this_edition')"
        >
          <UIcon
            name="i-heroicons-information-circle"
            :class="['md:mr-1']"
            size="24"
            class="md:w-4! md:h-4!"
          />
          <span class="hidden md:inline">{{ t('edition.about_this_edition') }}</span>
        </NuxtLink>

        <NuxtLink
          v-if="mapTabVisible"
          :to="`/editions/${edition.id}/map`"
          :class="[
            'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'map'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          :title="t('gestion.map.title')"
        >
          <UIcon name="i-lucide-map" :class="['md:mr-1']" size="24" class="md:w-4! md:h-4!" />
          <span class="hidden md:inline">{{ t('gestion.map.title') }}</span>
        </NuxtLink>

        <NuxtLink
          v-if="faqTabVisible"
          :to="`/editions/${edition.id}/faq`"
          :class="[
            'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'faq'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          :title="t('faq.title')"
        >
          <UIcon
            name="i-heroicons-question-mark-circle"
            :class="['md:mr-1']"
            size="24"
            class="md:w-4! md:h-4!"
          />
          <span class="hidden md:inline">{{ t('faq.title') }}</span>
        </NuxtLink>

        <NuxtLink
          :to="`/editions/${edition.id}/commentaires`"
          :class="[
            'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'commentaires'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          :title="t('edition.posts')"
        >
          <UIcon
            name="i-heroicons-chat-bubble-left-right"
            :class="['md:mr-1']"
            size="24"
            class="md:w-4! md:h-4!"
          />
          <span class="hidden md:inline">{{ t('edition.posts') }}</span>
        </NuxtLink>

        <NuxtLink
          :to="`/editions/${edition.id}/carpool`"
          :class="[
            'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'carpool'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          :title="t('edition.carpool')"
        >
          <UIcon name="i-heroicons-truck" :class="['md:mr-1']" size="24" class="md:w-4! md:h-4!" />
          <span class="hidden md:inline">{{ t('edition.carpool') }}</span>
        </NuxtLink>

        <!-- Onglets sans dépendance auth (rendus en SSR) -->
        <NuxtLink
          v-if="workshopsTabVisible"
          :to="`/editions/${edition.id}/workshops`"
          :class="[
            'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'workshops'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          title="Workshops"
        >
          <UIcon
            name="i-heroicons-academic-cap"
            :class="['md:mr-1']"
            size="24"
            class="md:w-4! md:h-4!"
          />
          <span class="hidden md:inline">Workshops</span>
        </NuxtLink>

        <!-- Onglets conditionnels dépendant de l'auth ou de Date.now() (rendu côté client pour éviter le mismatch d'hydration) -->
        <ClientOnly>
          <NuxtLink
            v-if="myTasksTabVisible"
            :to="`/editions/${edition.id}/mes-taches`"
            :class="[
              'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
              currentPage === 'my-tasks'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
            :title="t('gestion.tasks.my_tasks.title')"
          >
            <UIcon
              name="i-heroicons-clipboard-document-check"
              :class="['md:mr-1']"
              size="24"
              class="md:w-4! md:h-4!"
            />
            <span class="hidden md:inline">{{ t('gestion.tasks.my_tasks.title') }}</span>
          </NuxtLink>

          <NuxtLink
            v-if="volunteersTabVisible"
            :to="`/editions/${edition.id}/volunteers`"
            :class="[
              'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
              currentPage === 'volunteers'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
            :title="t('edition.volunteers.title')"
          >
            <UIcon
              name="i-heroicons-hand-raised"
              :class="['md:mr-1']"
              size="24"
              class="md:w-4! md:h-4!"
            />
            <span class="hidden md:inline">{{ t('edition.volunteers.title') }}</span>
          </NuxtLink>

          <NuxtLink
            v-if="hasEditionStarted"
            :to="`/editions/${edition.id}/lost-found`"
            :class="[
              'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
              currentPage === 'lost-found'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
            :title="t('edition.lost_found')"
          >
            <UIcon
              name="i-heroicons-magnifying-glass"
              :class="['md:mr-1']"
              size="24"
              class="md:w-4! md:h-4!"
            />
            <span class="hidden md:inline">{{ t('edition.lost_found') }}</span>
          </NuxtLink>

          <NuxtLink
            v-if="showsCallTabVisible"
            :to="`/editions/${edition.id}/shows-call`"
            :class="[
              'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
              currentPage === 'shows-call'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
            :title="t('shows_call.title')"
          >
            <UIcon
              name="i-heroicons-megaphone"
              :class="['md:mr-1']"
              size="24"
              class="md:w-4! md:h-4!"
            />
            <span class="hidden md:inline">{{ t('shows_call.title') }}</span>
          </NuxtLink>

          <NuxtLink
            v-if="artistSpaceTabVisible"
            :to="`/editions/${edition.id}/artist-space`"
            :class="[
              'py-3 px-3 md:py-2 md:px-1 border-b-2 font-medium text-sm flex items-center',
              currentPage === 'artist-space'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
            :title="t('edition.artist_space')"
          >
            <UIcon name="i-heroicons-star" :class="['md:mr-1']" size="24" class="md:w-4! md:h-4!" />
            <span class="hidden md:inline">{{ t('edition.artist_space') }}</span>
          </NuxtLink>
        </ClientOnly>
      </nav>
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
        <div class="flex justify-center w-full">
          <UButton
            variant="soft"
            color="primary"
            icon="i-heroicons-calendar-days"
            @click="openEditionsList(close)"
          >
            {{ $t('edition.view_convention_editions') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modale de la liste des éditions de la convention -->
    <ConventionEditionsListModal
      v-if="edition.convention"
      v-model:open="showEditionsListModal"
      :convention-id="edition.convention.id"
      :title="$t('edition.convention_editions_title', { name: edition.convention.name })"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { useFavoritesEditionsStore } from '~/stores/favoritesEditions'
import type { Edition } from '~/types'
import { getCalendarOptions, type CalendarEventData } from '~/utils/calendar'
import { getCountryCode } from '~/utils/countries'
import { getEditionDisplayName } from '~/utils/editionName'
import { markdownToHtml } from '~/utils/markdown'

const { t } = useI18n()
const { translateCountryName } = useCountryTranslation()

const { getImageUrl } = useImageUrl()

interface Props {
  edition: Edition
  currentPage:
    | 'details'
    | 'commentaires'
    | 'carpool'
    | 'gestion'
    | 'lost-found'
    | 'volunteers'
    | 'workshops'
    | 'shows-call'
    | 'map'
    | 'artist-space'
    | 'faq'
    | 'my-tasks'
}

const props = defineProps<Props>()

const authStore = useAuthStore()
const editionStore = useEditionStore()
const favoritesStore = useFavoritesEditionsStore()
const toast = useToast()

// État des modales
const showConventionModal = ref(false)
const showEditionsListModal = ref(false)

const openEditionsList = (close: () => void) => {
  close()
  showEditionsListModal.value = true
}

// État pour vérifier si l'utilisateur est un bénévole accepté
const isAcceptedVolunteer = ref(false)

// État pour vérifier si l'utilisateur est un artiste enregistré pour cette édition
const isEditionArtist = ref(false)

// Vérifier s'il y a des appels à spectacles (utilise _count de la réponse API)
const hasShowCalls = computed(() => {
  return (props.edition as any)?._count?.showCalls > 0
})

// Description de la convention en HTML (rendu Markdown)
const conventionDescriptionHtml = computedAsync(async () => {
  if (!props.edition?.convention?.description) {
    return ''
  }
  return await markdownToHtml(props.edition.convention.description)
}, '')

// Vérifier si l'utilisateur peut revendiquer la convention
const canClaimConvention = computed(() => {
  if (!authStore.isAuthenticated || !props.edition?.convention) return false

  // La convention doit ne pas avoir de créateur et avoir un email
  const convention = props.edition.convention
  return !convention.authorId && !!convention.email
})

// Visibilité onglet bénévoles: ouvert OU utilisateur peut éditer/gérer bénévoles OU utilisateur est bénévole accepté
const volunteersTabVisible = computed<boolean>(() => {
  if (!props.edition) return false
  // Toujours visible pour les éditeurs et gestionnaires de bénévoles (gestion interne même fermé au public)
  if (authStore.user?.id) {
    const canEdit = editionStore.canEditEdition(props.edition, authStore.user.id)
    const canManageVolunteers = editionStore.canManageVolunteers(props.edition, authStore.user.id)
    if (canEdit || canManageVolunteers) return true

    // Visible pour les bénévoles acceptés même si les candidatures sont fermées
    if (isAcceptedVolunteer.value) return true
  }
  // Visible publiquement uniquement si ouvert
  return props.edition.volunteersOpen === true
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

// Visibilité onglet appels à spectacles: visible pour les artistes s'il y a des appels
const showsCallTabVisible = computed<boolean>(() => {
  if (!hasShowCalls.value) return false
  if (!authStore.isAuthenticated) return false
  return authStore.isArtist
})

// Visibilité onglet espace artiste: visible pour les artistes enregistrés de cette édition
const artistSpaceTabVisible = computed<boolean>(() => {
  if (!authStore.isAuthenticated) return false
  return isEditionArtist.value
})

// Liste unifiée des onglets pour le select mobile (filtrée selon les permissions)
const mobileTabItems = computed<{ label: string; value: string; icon: string; path: string }[]>(
  () => {
    const editionId = props.edition?.id
    if (!editionId) return []
    const items: { label: string; value: string; icon: string; path: string }[] = [
      {
        label: t('edition.about_this_edition'),
        value: 'details',
        icon: 'i-heroicons-information-circle',
        path: `/editions/${editionId}`,
      },
    ]
    if (mapTabVisible.value) {
      items.push({
        label: t('gestion.map.title'),
        value: 'map',
        icon: 'i-lucide-map',
        path: `/editions/${editionId}/map`,
      })
    }
    if (faqTabVisible.value) {
      items.push({
        label: t('faq.title'),
        value: 'faq',
        icon: 'i-heroicons-question-mark-circle',
        path: `/editions/${editionId}/faq`,
      })
    }
    items.push(
      {
        label: t('edition.posts'),
        value: 'commentaires',
        icon: 'i-heroicons-chat-bubble-left-right',
        path: `/editions/${editionId}/commentaires`,
      },
      {
        label: t('edition.carpool'),
        value: 'carpool',
        icon: 'i-heroicons-truck',
        path: `/editions/${editionId}/carpool`,
      }
    )
    if (workshopsTabVisible.value) {
      items.push({
        label: 'Workshops',
        value: 'workshops',
        icon: 'i-heroicons-academic-cap',
        path: `/editions/${editionId}/workshops`,
      })
    }
    if (volunteersTabVisible.value) {
      items.push({
        label: t('edition.volunteers.title'),
        value: 'volunteers',
        icon: 'i-heroicons-hand-raised',
        path: `/editions/${editionId}/volunteers`,
      })
    }
    if (myTasksTabVisible.value) {
      items.push({
        label: t('gestion.tasks.my_tasks.title'),
        value: 'my-tasks',
        icon: 'i-heroicons-clipboard-document-check',
        path: `/editions/${editionId}/mes-taches`,
      })
    }
    if (hasEditionStarted.value) {
      items.push({
        label: t('edition.lost_found'),
        value: 'lost-found',
        icon: 'i-heroicons-magnifying-glass',
        path: `/editions/${editionId}/lost-found`,
      })
    }
    if (showsCallTabVisible.value) {
      items.push({
        label: t('shows_call.title'),
        value: 'shows-call',
        icon: 'i-heroicons-megaphone',
        path: `/editions/${editionId}/shows-call`,
      })
    }
    if (artistSpaceTabVisible.value) {
      items.push({
        label: t('edition.artist_space'),
        value: 'artist-space',
        icon: 'i-heroicons-star',
        path: `/editions/${editionId}/artist-space`,
      })
    }
    return items
  }
)

const currentTabIcon = computed<string | null>(
  () => mobileTabItems.value.find((i) => i.value === props.currentPage)?.icon || null
)

function onMobileTabChange(value: string) {
  const target = mobileTabItems.value.find((i) => i.value === value)
  if (target && target.value !== props.currentPage) {
    navigateTo(target.path)
  }
}

// Visibilité onglet FAQ : module activé ET page publique activée.
// On ne pré-charge pas les entrées ici : la page /faq retourne 404
// si la page n'est pas publique ou si le module est désactivé.
const faqTabVisible = computed<boolean>(() => {
  if (!props.edition) return false
  const ed = props.edition as { faqEnabled?: boolean; faqPagePublic?: boolean }
  return ed.faqEnabled === true && ed.faqPagePublic === true
})

// Visibilité onglet « Mes tâches » : module activé + utilisateur authentifié.
// L'endpoint /tasks/mine filtre lui-même par utilisateur, et la page affiche un
// empty state si l'utilisateur n'a aucune tâche assignée.
const myTasksTabVisible = computed<boolean>(() => {
  if (!props.edition) return false
  if (!authStore.isAuthenticated) return false
  return (props.edition as { tasksEnabled?: boolean }).tasksEnabled === true
})

// Visibilité onglet carte: visible si siteMapEnabled + mapPublic sont activés et l'édition a des coordonnées définies
const mapTabVisible = computed<boolean>(() => {
  if (!props.edition) return false
  return !!(
    props.edition.siteMapEnabled &&
    props.edition.mapPublic &&
    props.edition.latitude &&
    props.edition.longitude
  )
})

// Gestion des favoris - Initialisation automatique si utilisateur connecté
watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated && !favoritesStore.isInitialized) {
      await favoritesStore.ensureInitialized()
    }

    // Charger les statuts spécifiques à l'utilisateur pour cette édition
    if (isAuthenticated && authStore.user?.id && props.edition?.id) {
      // Vérifier si l'utilisateur est un bénévole accepté
      try {
        const response = await $fetch(
          `/api/editions/${props.edition.id}/volunteers/applications/status`
        )
        isAcceptedVolunteer.value = response.status === 'ACCEPTED'
      } catch {
        isAcceptedVolunteer.value = false
      }

      // Vérifier si l'utilisateur est un artiste enregistré pour cette édition
      try {
        const response = await $fetch<{ isArtist: boolean }>(
          `/api/editions/${props.edition.id}/my-artist-status`
        )
        isEditionArtist.value = response.isArtist
      } catch {
        isEditionArtist.value = false
      }
    } else {
      isAcceptedVolunteer.value = false
      isEditionArtist.value = false
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

// Formatter la plage de dates avec support du fuseau horaire
const formatDateRange = (start: string, end: string) => {
  const { locale } = useI18n()
  const startDate = new Date(start)
  const endDate = new Date(end)
  const timezone = props.edition.timezone || undefined

  const baseOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  }

  const shortOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  }

  // Vérifier si les dates sont le même jour (en tenant compte du fuseau horaire)
  const startFormatted = new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: timezone,
  }).format(startDate)

  const endFormatted = new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: timezone,
  }).format(endDate)

  if (startFormatted === endFormatted) {
    return new Intl.DateTimeFormat(locale.value, baseOptions).format(startDate)
  }

  return `${new Intl.DateTimeFormat(locale.value, shortOptions).format(startDate)} - ${new Intl.DateTimeFormat(locale.value, baseOptions).format(endDate)}`
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
