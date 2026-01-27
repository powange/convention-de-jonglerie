<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <!-- En-tête -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ $t('pages.artists.open_calls_page_title') }}
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          {{ $t('pages.artists.open_calls_description') }}
        </p>
      </div>

      <!-- Bouton vers mes candidatures -->
      <UButton
        to="/my-artist-applications"
        color="primary"
        variant="outline"
        icon="i-heroicons-folder"
      >
        {{ $t('pages.artists.my_applications') }}
      </UButton>
    </div>

    <!-- Chargement -->
    <div v-if="pending" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" size="24" />
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="py-12 text-center">
      <UIcon
        name="i-heroicons-exclamation-triangle"
        class="mx-auto mb-4 text-error-500"
        size="48"
      />
      <h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
        {{ $t('common.error') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ $t('errors.loading_error') }}
      </p>
    </div>

    <!-- Contenu -->
    <template v-else>
      <!-- Liste des appels ouverts -->
      <div v-if="openCalls && openCalls.length > 0" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <UCard
            v-for="call in openCalls"
            :key="`call-${call.id}`"
            class="transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg"
          >
            <template #header>
              <div class="flex items-start gap-3">
                <!-- Image -->
                <div class="flex-shrink-0">
                  <img
                    v-if="call.edition.imageUrl"
                    :src="getImageUrl(call.edition.imageUrl, 'edition', call.edition.id) || ''"
                    :alt="getEditionDisplayName(call.edition)"
                    class="h-14 w-14 rounded-lg object-cover"
                  />
                  <img
                    v-else-if="call.edition.convention.logo"
                    :src="
                      getImageUrl(
                        call.edition.convention.logo,
                        'convention',
                        call.edition.convention.id
                      ) || ''
                    "
                    :alt="call.edition.convention.name"
                    class="h-14 w-14 rounded-lg object-cover"
                  />
                  <div
                    v-else
                    class="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700"
                  >
                    <UIcon name="i-heroicons-sparkles" class="text-gray-400" size="20" />
                  </div>
                </div>

                <div class="min-w-0 flex-1">
                  <h3 class="truncate font-semibold text-gray-900 dark:text-white">
                    {{ getEditionDisplayName(call.edition) }}
                  </h3>
                  <p class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <UIcon name="i-heroicons-map-pin" class="h-3 w-3" />
                    {{ call.edition.city }}, {{ call.edition.country }}
                  </p>
                  <p class="flex items-center gap-1 text-sm text-gray-500">
                    <UIcon name="i-heroicons-calendar-days" class="h-3 w-3" />
                    {{ formatDateRange(call.edition.startDate, call.edition.endDate) }}
                  </p>
                </div>
              </div>
            </template>

            <div class="space-y-3">
              <!-- Nom de l'appel -->
              <div
                v-if="call.name"
                class="text-sm font-medium text-primary-600 dark:text-primary-400"
              >
                {{ call.name }}
              </div>

              <!-- Description -->
              <p
                v-if="call.description"
                class="line-clamp-2 text-sm text-gray-600 dark:text-gray-400"
              >
                {{ call.description }}
              </p>

              <!-- Date limite -->
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  v-if="call.deadline"
                  :color="isDeadlineSoon(call.deadline) ? 'warning' : 'neutral'"
                  variant="soft"
                  size="sm"
                  class="flex items-center gap-1"
                >
                  <UIcon name="i-heroicons-clock" class="h-3 w-3" />
                  {{ $t('pages.artists.deadline') }}: {{ formatDate(call.deadline) }}
                </UBadge>
                <UBadge
                  v-if="
                    call.deadline &&
                    getDaysLeft(call.deadline) <= 7 &&
                    getDaysLeft(call.deadline) > 0
                  "
                  color="warning"
                  variant="solid"
                  size="sm"
                >
                  {{ $t('pages.artists.days_left', { count: getDaysLeft(call.deadline) }) }}
                </UBadge>
                <UBadge
                  v-if="hasAppliedToCall(call.id)"
                  color="success"
                  variant="soft"
                  size="sm"
                  class="flex items-center gap-1"
                >
                  <UIcon name="i-heroicons-check" class="h-3 w-3" />
                  {{ $t('pages.artists.already_applied_badge') }}
                </UBadge>
              </div>
            </div>

            <template #footer>
              <div class="flex gap-2">
                <UButton
                  v-if="call.mode === 'EXTERNAL' && call.externalUrl"
                  :href="call.externalUrl"
                  target="_blank"
                  size="sm"
                  color="primary"
                  variant="solid"
                  icon="i-heroicons-arrow-top-right-on-square"
                  class="flex-1"
                >
                  {{ $t('pages.artists.external_application') }}
                </UButton>
                <UButton
                  v-else-if="!hasAppliedToCall(call.id)"
                  :to="`/editions/${call.edition.id}/shows-call/${call.id}/apply`"
                  size="sm"
                  color="primary"
                  variant="solid"
                  icon="i-heroicons-paper-airplane"
                  class="flex-1"
                >
                  {{ $t('pages.artists.apply_now') }}
                </UButton>
                <UButton
                  v-else
                  :to="`/editions/${call.edition.id}/shows-call`"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-heroicons-eye"
                  class="flex-1"
                >
                  {{ $t('pages.artists.view_edition') }}
                </UButton>
              </div>
            </template>
          </UCard>
        </div>
      </div>

      <!-- État vide -->
      <div v-else class="py-12 text-center">
        <UIcon name="i-heroicons-megaphone" class="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
          {{ $t('pages.artists.no_open_calls') }}
        </h3>
        <p class="mb-4 text-gray-600 dark:text-gray-400">
          {{ $t('pages.artists.no_open_calls_description') }}
        </p>
        <UButton to="/" color="primary" icon="i-heroicons-magnifying-glass">
          {{ $t('pages.artists.browse_conventions') }}
        </UButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const { getImageUrl } = useImageUrl()

// Récupération des appels ouverts
const { data: openCallsData, pending, error } = await useFetch('/api/shows-call/open')

// Récupération des candidatures de l'utilisateur (pour savoir s'il a déjà candidaté)
const { data: applications } = await useFetch('/api/user/show-applications')

// Appels ouverts
const openCalls = computed(() => openCallsData.value?.showCalls || [])

// IDs des appels auxquels l'utilisateur a déjà candidaté
const appliedCallIds = computed(() => {
  if (!applications.value) return new Set<number>()
  return new Set(applications.value.map((app) => app.showCall.id))
})

// Vérifier si l'utilisateur a déjà candidaté à un appel
const hasAppliedToCall = (callId: number) => appliedCallIds.value.has(callId)

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

const getDaysLeft = (deadline: string) => {
  const now = new Date()
  const deadlineDate = new Date(deadline)
  const diffTime = deadlineDate.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const isDeadlineSoon = (deadline: string) => {
  return getDaysLeft(deadline) <= 7
}

// SEO
useSeoMeta({
  title: t('pages.artists.open_calls_page_title'),
  description: t('pages.artists.open_calls_description'),
})
</script>
