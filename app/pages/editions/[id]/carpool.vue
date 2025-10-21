<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <EditionHeader :edition="edition" current-page="carpool" />

      <!-- Contenu du covoiturage -->
      <EditionCarpoolSection :edition-id="edition.id" :highlight-offer-id="highlightOfferId" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'

// Auto-imported: EditionCarpoolSection
import { useEditionStore } from '~/stores/editions'
import { getEditionDisplayName } from '~/utils/editionName'

// TODO: Ajouter le middleware d'authentification plus tard
// definePageMeta({
//   middleware: 'auth-protected'
// });

const route = useRoute()
const editionStore = useEditionStore()
const { t, locale } = useI18n()
const { formatDateTimeRange } = useDateFormat()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Charger l'édition si pas encore dans le store
onMounted(async () => {
  try {
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error) {
    console.error('Failed to fetch edition:', error)
  }
})

// SEO - Métadonnées pour la page covoiturage
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      const editionName = getEditionDisplayName(newEdition)
      const conventionName = newEdition.convention?.name || ''
      const dateRange = formatDateTimeRange(newEdition.startDate, newEdition.endDate)

      useSeoMeta({
        title: () => t('seo.carpool.title', { name: editionName }),
        description: () =>
          t('seo.carpool.description', {
            name: editionName,
            date: dateRange,
            location: newEdition.location || '',
          }),
        keywords: () =>
          t('seo.carpool.keywords', {
            convention: conventionName,
            location: newEdition.location || '',
          }),
        ogTitle: () => t('seo.carpool.og_title', { name: editionName }),
        ogDescription: () =>
          t('seo.carpool.og_description', {
            name: editionName,
            date: dateRange,
          }),
        ogType: 'website',
        ogLocale: () => locale.value,
        twitterCard: 'summary',
        twitterTitle: () => t('seo.carpool.twitter_title', { name: editionName }),
        twitterDescription: () =>
          t('seo.carpool.twitter_description', {
            name: editionName,
          }),
      })
    }
  },
  { immediate: true }
)

// Paramètre pour mettre en évidence une offre spécifique
const highlightOfferId = computed(() => {
  const offerId = route.query.offerId
  return offerId ? parseInt(offerId as string) : null
})

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId)
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
})
</script>
