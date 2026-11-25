<template>
  <div v-if="edition" class="mb-6">
    <UButton
      :to="`/events/${edition.publicId}`"
      variant="link"
      color="neutral"
      icon="i-heroicons-arrow-left"
      :label="edition.name"
      class="-ml-2 mb-2"
    />
    <div class="flex flex-wrap gap-3 text-sm text-muted">
      <span v-if="edition.location" class="flex items-center gap-1">
        <UIcon name="i-heroicons-map-pin" /> {{ edition.location }}
      </span>
      <span v-if="dates" class="flex items-center gap-1">
        <UIcon name="i-heroicons-calendar" /> {{ dates }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * En-tête d'un événement au-dessus des pages BÉNÉVOLE du layer (candidater, mes créneaux,
 * échanges) — contrat d'hôte côté interface : le layer attend un composant `EditionHeader`, et
 * chaque app fournit le sien. Celui d'app1 porte les onglets de toute une édition (programme,
 * covoiturage, billetterie…) ; Flowvent n'a que les bénévoles : un retour vers l'événement, son
 * lieu et ses dates suffisent.
 *
 * `currentPage` est accepté pour garder la signature d'app1, sans usage ici : il n'y a pas
 * d'onglet à mettre en évidence.
 */
import type { EditionFlowvent } from '~/stores/editions'

const props = defineProps<{
  edition: EditionFlowvent | null | undefined
  currentPage?: string
}>()

const dates = computed(() => (props.edition ? periodeEvenement(props.edition) : ''))
</script>
