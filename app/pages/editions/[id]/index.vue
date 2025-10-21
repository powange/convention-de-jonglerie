<template>
  <div>
    <div v-if="loading" role="status" aria-live="polite">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition" role="alert">
      <p>{{ $t('editions.not_found') }}</p>
    </div>
    <div v-else>
      <!-- Message si l'édition est hors ligne -->
      <UAlert
        v-if="!edition.isOnline && canManageEdition"
        icon="i-heroicons-eye-slash"
        color="warning"
        variant="soft"
        class="mb-4"
      >
        <template #title>
          {{ $t('editions.offline_edition') }}
        </template>
        <template #description>
          <div class="flex items-center justify-between">
            <span>{{ $t('editions.offline_edition_message') }}</span>
            <UButton color="primary" size="sm" icon="i-heroicons-globe-alt" @click="publishEdition">
              {{ $t('editions.publish_edition') }}
            </UButton>
          </div>
        </template>
      </UAlert>

      <!-- En-tête avec navigation -->
      <EditionHeader :edition="edition" current-page="details" />

      <!-- Contenu des détails en grille responsive -->
      <main class="grid xl:grid-cols-5 2xl:grid-cols-5 gap-6" role="main">
        <!-- Contenu principal "A propos de cette édition" -->
        <div class="xl:col-span-4 2xl:col-span-4 flex flex-col space-y-6">
          <UCard variant="subtle">
            <!-- Affiche de l'édition et description -->
            <div class="flex flex-col sm:flex-row gap-6">
              <div v-if="edition.imageUrl" class="flex-shrink-0 self-center sm:self-start">
                <img
                  :src="getImageUrl(edition.imageUrl, 'edition', edition.id) || ''"
                  :alt="t('editions.poster_of', { name: getEditionDisplayName(edition) })"
                  role="button"
                  tabindex="0"
                  :aria-label="`${$t('editions.click_to_enlarge_poster')} ${getEditionDisplayName(edition)}`"
                  class="w-full sm:w-48 h-auto max-w-xs object-contain rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500"
                  @click="showImageOverlay = true"
                  @keydown.enter="showImageOverlay = true"
                  @keydown.space.prevent="showImageOverlay = true"
                />
              </div>
              <div class="flex-1">
                <h3 id="about-heading" class="text-lg font-semibold mb-2">
                  {{ $t('editions.about_this_edition') }}
                </h3>
                <div
                  v-if="edition.description && descriptionHtml"
                  class="prose prose-sm max-w-none text-gray-700 dark:text-gray-300"
                  aria-labelledby="about-heading"
                >
                  <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize) -->
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <div v-html="descriptionHtml" />
                </div>
                <p v-else class="text-gray-700 dark:text-gray-300">
                  {{ t('editions.no_description_available') }}
                </p>
              </div>
            </div>
          </UCard>

          <!-- Programme de l'édition -->
          <UCard v-if="edition.program && programHtml" variant="subtle">
            <div class="space-y-4">
              <h3 class="text-lg font-semibold">{{ $t('editions.program') }}</h3>
              <div
                class="prose prose-sm max-w-none text-gray-700 dark:text-gray-300"
                aria-labelledby="program-heading"
              >
                <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize) -->
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-html="programHtml" />
              </div>
            </div>
          </UCard>

          <UCard variant="subtle">
            <!-- Services -->
            <section class="space-y-4" aria-labelledby="services-heading">
              <h3 id="services-heading" class="text-lg font-semibold">
                {{ $t('editions.services_offered') }}
              </h3>
              <div
                v-if="getActiveServicesByCategory(edition).length === 0"
                class="text-gray-500 text-sm"
              >
                {{ $t('editions.no_services') }}
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="category in getActiveServicesByCategory(edition)"
                  :key="category.category"
                  class="space-y-3"
                >
                  <h4
                    class="text-lg font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2"
                  >
                    {{ category.label }}
                  </h4>
                  <div class="flex flex-wrap gap-3" role="list">
                    <UBadge
                      v-for="service in category.services"
                      :key="service.key"
                      color="neutral"
                      variant="soft"
                      size="xl"
                      class="px-4 py-3"
                      role="listitem"
                    >
                      <UIcon
                        :name="service.icon"
                        :class="service.color"
                        size="24"
                        class="mr-2"
                        aria-hidden="true"
                      />
                      <span class="text-base font-medium">{{ service.label }}</span>
                    </UBadge>
                  </div>
                </div>
              </div>
            </section>
          </UCard>
        </div>

        <!-- Liste des participants -->
        <div class="xl:col-span-1 2xl:col-span-1 flex flex-col space-y-6">
          <!-- Informations pratiques -->
          <UCard variant="subtle">
            <section class="space-y-3" aria-labelledby="practical-info-heading">
              <h3 id="practical-info-heading" class="text-lg font-semibold">
                {{ $t('editions.practical_info') }}
              </h3>
              <p class="text-sm text-gray-600">
                <UIcon name="i-heroicons-map-pin" class="inline mr-1" />
                <a
                  :href="getGoogleMapsUrl(edition)"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="`${$t('editions.view_on_map')} - ${edition.city} (${$t('common.opens_in_new_tab')})`"
                  class="text-blue-600 hover:text-blue-800 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {{ edition.addressLine1
                  }}<span v-if="edition.addressLine2">, {{ edition.addressLine2 }}</span
                  >, {{ edition.postalCode }} {{ edition.city
                  }}<span v-if="edition.region">, {{ edition.region }}</span
                  >, {{ edition.country }}
                </a>
              </p>
              <p class="text-sm text-gray-600">
                <UIcon name="i-heroicons-calendar" class="inline mr-1" />
                {{ formatDateTimeRange(edition.startDate, edition.endDate) }}
              </p>

              <!-- Email de contact de la convention -->
              <p v-if="edition.convention?.email" class="text-sm text-gray-600">
                <UIcon name="i-heroicons-envelope" class="inline mr-1" />
                <a
                  :href="`mailto:${edition.convention.email}`"
                  class="text-primary-600 hover:text-primary-700 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  :aria-label="`${$t('common.contact_email')}: ${edition.convention.email}`"
                >
                  {{ edition.convention.email }}
                </a>
              </p>

              <!-- Collaborateurs -->
              <div v-if="getAllCollaborators(edition).length > 0" class="pt-2">
                <div class="flex items-center gap-2 mb-2">
                  <UIcon name="i-heroicons-users" class="text-gray-400" />
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
                    $t('editions.organizing_team')
                  }}</span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="collaborator in getAllCollaborators(edition)"
                    :key="collaborator.id"
                    class="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-full text-sm"
                    :title="collaboratorTitleTooltip(collaborator)"
                  >
                    <UiUserAvatar :user="collaborator.user" size="xs" />
                    <span class="text-gray-700 dark:text-gray-300">{{ collaborator.pseudo }}</span>
                    <UBadge
                      v-if="displayCollaboratorBadge(collaborator)"
                      size="xs"
                      color="neutral"
                      variant="soft"
                    >
                      {{ displayCollaboratorBadge(collaborator) }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </section>
          </UCard>

          <!-- Liens externes -->
          <UCard variant="subtle">
            <div
              v-if="
                edition.officialWebsiteUrl ||
                edition.ticketingUrl ||
                edition.facebookUrl ||
                edition.instagramUrl
              "
              class="space-y-2"
            >
              <h3 class="text-lg font-semibold">{{ $t('editions.useful_links') }}</h3>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-if="edition.officialWebsiteUrl"
                  icon="i-heroicons-globe-alt"
                  :to="edition.officialWebsiteUrl"
                  target="_blank"
                  size="sm"
                  color="primary"
                  >{{ $t('editions.official_website') }}</UButton
                >
                <UButton
                  v-if="edition.ticketingUrl"
                  icon="i-heroicons-ticket"
                  :to="edition.ticketingUrl"
                  target="_blank"
                  size="sm"
                  >{{ $t('editions.ticketing_title') }}</UButton
                >
                <UButton
                  v-if="edition.facebookUrl"
                  icon="i-simple-icons-facebook"
                  :to="edition.facebookUrl"
                  target="_blank"
                  size="sm"
                  color="info"
                  >Facebook</UButton
                >
                <UButton
                  v-if="edition.instagramUrl"
                  icon="i-simple-icons-instagram"
                  :to="edition.instagramUrl"
                  target="_blank"
                  size="sm"
                  color="error"
                  >Instagram</UButton
                >
              </div>
            </div>
          </UCard>

          <!-- Mon billet (si l'utilisateur est connecté et a un billet) -->
          <EditionMyTicketCard v-if="authStore.isAuthenticated" :edition-id="edition.id" />

          <EditionParticipantsCard
            :participants="edition.attendingUsers"
            :is-attending="isAttending(edition.id)"
            :is-authenticated="authStore.isAuthenticated"
            @toggle-attendance="toggleAttendance(edition.id)"
          />
        </div>
      </main>

      <!-- Overlay pour l'affiche en grand -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition-opacity duration-300"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-300"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showImageOverlay && edition?.imageUrl"
            role="dialog"
            aria-modal="true"
            :aria-label="$t('editions.poster_modal')"
            class="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
            @click="showImageOverlay = false"
            @keydown.escape="showImageOverlay = false"
          >
            <div class="relative max-w-6xl max-h-[90vh]">
              <img
                :src="getImageUrl(edition.imageUrl, 'edition', edition.id) || ''"
                :alt="t('editions.poster_of', { name: getEditionDisplayName(edition) })"
                class="max-w-full max-h-[90vh] object-contain rounded-lg"
                @click.stop
              />
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                size="lg"
                :aria-label="$t('common.close')"
                class="absolute top-4 right-4"
                @click="showImageOverlay = false"
              />
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

import { useTranslatedConventionServices } from '~/composables/useConventionServices'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Edition } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'
import { markdownToHtml } from '~/utils/markdown'

const { formatDateTimeRange } = useDateFormat()

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const toast = useToast()
const { t, locale } = useI18n()
const { getTranslatedServicesByCategory } = useTranslatedConventionServices()

const editionId = parseInt(route.params.id as string)
const showImageOverlay = ref(false)
const { getImageUrl } = useImageUrl()

const useRequestURLOrigin = useRequestURL().origin

// (Bloc bénévolat déplacé dans la page volunteers.vue)

// Charger l'édition côté serveur ET client pour SSR/SEO
const {
  data: edition,
  pending: loading,
  error,
  refresh: refreshEdition,
} = await useFetch<Edition>(`/api/editions/${editionId}`)

// Gestion des erreurs
if (error.value) {
  console.error('Failed to fetch edition:', error.value)
  throw createError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.statusMessage || 'Edition not found',
  })
}

// Synchroniser le store avec les données useFetch pour la compatibilité avec les autres pages
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      editionStore.setEdition(newEdition)
    }
  },
  { immediate: true }
)

// SEO - Métadonnées dynamiques pour l'édition
// Utiliser computed pour garantir que les valeurs sont réactives et disponibles pendant le SSR
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))
const conventionName = computed(() => edition.value?.convention?.name || '')
const editionDescription = computed(
  () => edition.value?.description || edition.value?.convention?.description || ''
)
const editionImageUrl = computed(() =>
  edition.value?.imageUrl
    ? getImageUrl(edition.value.imageUrl, 'edition', edition.value.id)
    : undefined
)
const editionDateRange = computed(() =>
  edition.value ? formatDateTimeRange(edition.value.startDate, edition.value.endDate) : ''
)

// Définir les métadonnées pour SSR
// Après await useFetch, passer directement les computed (sans arrow functions) à useSeoMeta
// Solution de: https://github.com/nuxt/nuxt/issues/23470#issuecomment-1741174856
// Note: Le module @nuxtjs/seo ajoute automatiquement ogSiteName au titre, donc on ne l'ajoute pas ici
const seoTitle = computed(() => editionName.value)
const seoDescription = computed(() =>
  t('seo.edition.description', {
    name: editionName.value,
    date: editionDateRange.value,
    location: edition.value?.location || '',
  })
)
const seoKeywords = computed(() =>
  t('seo.edition.keywords', {
    convention: conventionName.value,
    location: edition.value?.location || '',
  })
)
const seoOgDescription = computed(() =>
  t('seo.edition.og_description', {
    name: editionName.value,
    date: editionDateRange.value,
  })
)
const seoTwitterTitle = computed(() => t('seo.edition.twitter_title', { name: editionName.value }))
const seoTwitterDescription = computed(() =>
  t('seo.edition.twitter_description', {
    name: editionName.value,
    date: editionDateRange.value,
  })
)

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  keywords: seoKeywords,
  ogTitle: editionName,
  ogDescription: seoOgDescription,
  ogType: 'article',
  ogLocale: locale,
  ogImage: editionImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: seoTwitterTitle,
  twitterDescription: seoTwitterDescription,
  twitterImage: editionImageUrl,
})

// Schema.org Event pour l'édition
useSchemaOrg([
  defineEvent({
    name: () => editionName.value,
    description: () =>
      editionDescription.value.substring(0, 200) +
      (editionDescription.value.length > 200 ? '...' : ''),
    startDate: () => edition.value?.startDate || '',
    endDate: () => edition.value?.endDate || '',
    location: () =>
      edition.value?.location
        ? {
            '@type': 'Place',
            name: edition.value.location,
            address: edition.value.location,
          }
        : undefined,
    image: () => (editionImageUrl.value ? [editionImageUrl.value] : undefined),
    url: () => `${useRequestURLOrigin}/editions/${edition.value?.id || editionId}`,
    eventStatus: () =>
      edition.value?.status === 'published' ? 'EventScheduled' : 'EventCancelled',
    organizer: () => ({
      '@type': 'Organization',
      name: conventionName.value,
      url: edition.value?.convention
        ? `${useRequestURLOrigin}/conventions/${edition.value.convention.id}`
        : undefined,
    }),
    offers: () =>
      edition.value?.registrationPrice
        ? {
            '@type': 'Offer',
            price: edition.value.registrationPrice,
            priceCurrency: 'EUR',
            availability: 'InStock',
          }
        : undefined,
  }),
])

// Description en HTML (rendu Markdown)
const descriptionHtml = computedAsync(async () => {
  if (!edition.value?.description) {
    return ''
  }
  return await markdownToHtml(edition.value.description)
}, '')

// Programme en HTML (rendu Markdown)
const programHtml = computedAsync(async () => {
  if (!edition.value?.program) {
    return ''
  }
  return await markdownToHtml(edition.value.program)
}, '')

const isAttending = computed(() => (_editionId: number) => {
  return edition.value?.attendingUsers?.some((u) => u.id === authStore.user?.id) || false
})

// Check if user can manage edition
const canManageEdition = computed(() => {
  if (!authStore.user || !edition.value) return false
  if (edition.value.creatorId && edition.value.creatorId === authStore.user.id) return true
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => authStore.user && c.user.id === authStore.user.id
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

// Publish edition (make it online)
const publishEdition = async () => {
  if (!edition.value) return

  try {
    await $fetch(`/api/editions/${edition.value.id}/status`, {
      method: 'PATCH',
      body: { isOnline: true },
    })

    // Update local state
    await refreshEdition()

    toast.add({
      title: t('editions.edition_published'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error) {
    console.error('Failed to publish edition:', error)
    toast.add({
      title: t('errors.publish_edition_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const toggleAttendance = async (id: number) => {
  try {
    const response = await $fetch(`/api/editions/${id}/attendance`, {
      method: 'POST',
    })

    // Recharger l'édition pour mettre à jour les données (forcer le rafraîchissement)
    await refreshEdition()

    // Afficher le message traduit selon l'état
    const message = response.isAttending
      ? t('messages.attendance_added')
      : t('messages.attendance_removed')

    toast.add({
      title: message,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: unknown) {
    const errorMessage =
      e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
        ? e.message
        : t('errors.attendance_update_failed')
    toast.add({ title: errorMessage, icon: 'i-heroicons-x-circle', color: 'error' })
  }
}

const getGoogleMapsUrl = (edition: Edition) => {
  const addressParts = [
    edition.addressLine1,
    edition.addressLine2,
    edition.postalCode,
    edition.city,
    edition.region,
    edition.country,
  ].filter(Boolean)

  const fullAddress = addressParts.join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
}

const getActiveServicesByCategory = (edition: Edition) => {
  if (!edition) return []

  const servicesByCategory = getTranslatedServicesByCategory.value
  return servicesByCategory
    .map((category) => ({
      ...category,
      services: category.services.filter((service) => (edition as any)[service.key]),
    }))
    .filter((category) => category.services.length > 0)
}

// Obtenir tous les collaborateurs en préservant éventuel titre custom
const getAllCollaborators = (edition: Edition) => {
  if (!edition) return []

  const collaborators: any[] = []

  // Ajouter les collaborateurs de la convention
  if (edition.convention?.collaborators) {
    edition.convention.collaborators.forEach((collab) => {
      if (!collaborators.some((c) => c.id === collab.user.id)) {
        collaborators.push({
          id: collab.user.id,
          user: collab.user,
          pseudo: collab.user.pseudo,
          isCreator: false,
          rights: collab.rights || {},
          title: (collab as any).title || null,
        } as any)
      }
    })
  }

  return collaborators
}

// Tooltip: afficher titre custom si présent sinon rien de spécial
const collaboratorTitleTooltip = (collaborator: any) => {
  if (collaborator.title) return `${collaborator.pseudo} - ${collaborator.title}`
  if (collaborator.isCreator) return `${collaborator.pseudo}`
  return collaborator.pseudo
}

// Texte du badge: titre custom uniquement
const displayCollaboratorBadge = (collaborator: any): string | null => {
  return collaborator.title ? collaborator.title : null
}
</script>
