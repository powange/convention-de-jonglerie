<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
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
      <EditionHeader
        :edition="edition"
        current-page="details"
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />

      <!-- Contenu des détails -->
      <UCard variant="subtle">
        <template #header>
          <!-- Affiche de l'édition et description -->
          <div class="flex flex-col sm:flex-row gap-6">
            <div v-if="edition.imageUrl" class="flex-shrink-0 self-center sm:self-start">
              <img
                :src="getImageUrl(edition.imageUrl, 'edition', edition.id) || ''"
                :alt="t('editions.poster_of', { name: getEditionDisplayName(edition) })"
                class="w-full sm:w-48 h-auto max-w-xs object-contain rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                @click="showImageOverlay = true"
              />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold mb-2">{{ $t('editions.about_this_edition') }}</h3>
              <div
                v-if="edition.description && descriptionHtml"
                class="prose prose-sm max-w-none text-gray-700 dark:text-gray-300"
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
        </template>

        <div class="space-y-6">
          <!-- Informations pratiques -->
          <div class="space-y-3">
            <h3 class="text-lg font-semibold">{{ $t('editions.practical_info') }}</h3>
            <p class="text-sm text-gray-600">
              <UIcon name="i-heroicons-map-pin" class="inline mr-1" />
              <a
                :href="getGoogleMapsUrl(edition)"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
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
                  <UserAvatar :user="collaborator.user" size="xs" />
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
          </div>

          <!-- Liens externes -->
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
            <div class="flex gap-2">
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
                >{{ $t('editions.ticketing') }}</UButton
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

          <!-- Services -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">{{ $t('editions.services_offered') }}</h3>
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
                <div class="flex flex-wrap gap-3">
                  <UBadge
                    v-for="service in category.services"
                    :key="service.key"
                    color="neutral"
                    variant="soft"
                    size="xl"
                    class="px-4 py-3"
                  >
                    <UIcon :name="service.icon" :class="service.color" size="24" class="mr-2" />
                    <span class="text-base font-medium">{{ service.label }}</span>
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

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
          class="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          @click="showImageOverlay = false"
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
              class="absolute top-4 right-4"
              @click="showImageOverlay = false"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

import EditionHeader from '~/components/edition/EditionHeader.vue'
import UserAvatar from '~/components/ui/UserAvatar.vue'
import { useTranslatedConventionServices } from '~/composables/useConventionServices'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Edition } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'
import { markdownToHtml } from '~/utils/markdown'

const { formatDateTimeRange } = useDateFormat()

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()
const { getTranslatedServicesByCategory } = useTranslatedConventionServices()

const editionId = parseInt(route.params.id as string)
const showImageOverlay = ref(false)
const { getImageUrl } = useImageUrl()

// (Bloc bénévolat déplacé dans la page benevoles.vue)

// Charger l'édition côté serveur ET client
try {
  await editionStore.fetchEditionById(editionId)
} catch (error) {
  console.error('Failed to fetch edition:', error)
}

// Maintenant utiliser directement le store qui est réactif
const edition = computed(() => editionStore.getEditionById(editionId))

// Description en HTML (rendu Markdown)
const descriptionHtml = computedAsync(async () => {
  if (!edition.value?.description) {
    return ''
  }
  return await markdownToHtml(edition.value.description)
}, '')

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy.some((u) => u.id === authStore.user?.id)
})

// Check if user can manage edition
const canManageEdition = computed(() => {
  if (!authStore.user || !edition.value) return false
  if (edition.value.creatorId === authStore.user.id) return true
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
    await editionStore.fetchEditionById(editionId)

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

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
    toast.add({
      title: t('messages.favorite_status_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: unknown) {
    const errorMessage =
      e && typeof e === 'object' && 'statusMessage' in e && typeof e.statusMessage === 'string'
        ? e.statusMessage
        : t('errors.favorite_update_failed')
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
