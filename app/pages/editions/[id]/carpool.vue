<template>
  <div>
    <div v-if="editionLoading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
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
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useEditionStore } from '~/stores/editions'
import type { Edition } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'

const route = useRoute()
const editionStore = useEditionStore()
const { formatDateTimeRange } = useDateFormat()

const editionId = parseInt(route.params.id as string)

// Charger l'édition côté serveur ET client pour SSR/SEO
const {
  data: edition,
  pending: editionLoading,
  error,
} = await useFetch<Edition>(`/api/editions/${editionId}`)

// Gestion des erreurs
if (error.value) {
  console.error('Failed to fetch edition:', error.value)
  throw createError({
    statusCode: error.value.statusCode || 404,
    statusText: error.value.statusMessage || 'Edition not found',
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

// Paramètre pour mettre en évidence une offre spécifique
const highlightOfferId = computed(() => {
  const offerId = route.query.offerId
  return offerId ? parseInt(offerId as string) : null
})

// Métadonnées SEO avec le nom de l'édition
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))

const editionDateRange = computed(() =>
  edition.value ? formatDateTimeRange(edition.value.startDate, edition.value.endDate) : ''
)

const seoTitle = computed(() => {
  if (!edition.value) return 'Covoiturage'
  return `Covoiturage - ${editionName.value}`
})

const seoDescription = computed(() => {
  if (!edition.value) return ''
  const name = editionName.value
  const date = editionDateRange.value
  const location = edition.value.city || ''
  return `Organisez votre covoiturage pour ${name}. Trouvez des compagnons de route ou proposez vos places libres pour ${date} à ${location}.`
})

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
})
</script>
