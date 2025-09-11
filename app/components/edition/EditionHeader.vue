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
              class="w-16 h-16 object-cover rounded-lg shadow-md"
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
              </div>

              <!-- Bouton favori mobile -->
              <UButton
                v-if="authStore.isAuthenticated"
                :icon="isFavorited ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                :color="isFavorited ? 'warning' : 'neutral'"
                variant="ghost"
                size="sm"
                class="sm:hidden flex-shrink-0"
                @click="$emit('toggle-favorite')"
              />
            </div>
          </div>
        </div>

        <!-- Bouton favori desktop -->
        <UButton
          v-if="authStore.isAuthenticated"
          :icon="isFavorited ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
          :color="isFavorited ? 'warning' : 'neutral'"
          variant="ghost"
          size="lg"
          class="hidden sm:flex"
          @click="$emit('toggle-favorite')"
        >
          {{ isFavorited ? t('profile.favorites') : t('common.add') }}
        </UButton>
      </div>
    </div>

    <div>
      <!-- Bouton En savoir plus -->
      <div class="mt-3">
        <UButton
          variant="ghost"
          size="sm"
          icon="i-heroicons-information-circle"
          @click="showConventionModal = true"
        >
          {{ $t('editions.learn_more_about_convention') }}
        </UButton>
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
      </nav>

      <!-- Titre de la page courante sur mobile -->
      <div class="sm:hidden text-center py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ getPageTitle(currentPage) }}
      </div>
    </div>

    <!-- Modale d'informations sur la convention -->
    <UModal
      v-model:open="showConventionModal"
      :title="$t('editions.about_convention')"
      :description="$t('editions.about_convention_description')"
      size="md"
    >
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

          <!-- Nom de la convention -->
          <h3 class="text-lg font-semibold text-center">
            {{ edition.convention?.name }}
          </h3>

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
import { computed, ref } from 'vue'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Edition } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'
import { markdownToHtml } from '~/utils/markdown'

const { t } = useI18n()

const { getImageUrl } = useImageUrl()

interface Props {
  edition: Edition
  currentPage: 'details' | 'commentaires' | 'carpool' | 'gestion' | 'objets-trouves' | 'volunteers'
  isFavorited?: boolean
}

const props = defineProps<Props>()
defineEmits<{
  'toggle-favorite': []
}>()
const authStore = useAuthStore()
const editionStore = useEditionStore()

// État de la modal
const showConventionModal = ref(false)

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

  const canEdit = editionStore.canEditEdition(props.edition, authStore.user.id)
  const canManageVolunteers = editionStore.canManageVolunteers(props.edition, authStore.user.id)
  return canEdit || canManageVolunteers || authStore.user?.id === props.edition?.creatorId
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
    gestion: t('editions.management'),
  }
  return titles[page] || t('editions.about_this_edition')
}
</script>
