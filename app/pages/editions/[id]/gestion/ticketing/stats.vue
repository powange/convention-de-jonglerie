<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
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
      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-chart-bar" class="text-primary-600" />
          {{ $t('gestion.ticketing.stats_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.ticketing.stats_description') }}
        </p>
      </div>

      <!-- Placeholder pour les statistiques futures -->
      <div class="text-center py-12">
        <UIcon name="i-heroicons-chart-bar" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {{ $t('gestion.ticketing.stats_coming_soon') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          {{ $t('gestion.ticketing.stats_coming_soon_description') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  layout: 'edition-dashboard',
})

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Vérifier l'accès à cette page (organisateurs seulement)
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.isOrganizer(edition.value, authStore.user.id)
})

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
})

// Métadonnées de la page
useSeoMeta({
  title: t('gestion.ticketing.stats_title') + ' - ' + (edition.value?.name || 'Édition'),
  description: t('gestion.ticketing.stats_description'),
})
</script>
