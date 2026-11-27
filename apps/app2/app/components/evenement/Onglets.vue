<template>
  <!-- Les sections publiques de l'événement, comme les onglets d'une édition d'app1. Rien à
       afficher s'il n'y a que la page d'informations. -->
  <UNavigationMenu
    v-if="items.length > 1"
    :items="items"
    orientation="horizontal"
    highlight
    class="-mx-1 overflow-x-auto border-b border-default"
    :ui="{ list: 'min-w-max', link: 'whitespace-nowrap' }"
    aria-label="Sections de l'événement"
  />
</template>

<script setup lang="ts">
/**
 * Les onglets publics d'un événement Flowvent : informations, programme, carte du site, FAQ,
 * bénévoles — chacun seulement s'il est publié. Les drapeaux viennent de qui affiche les onglets
 * (API publique sur la page de l'événement, store de l'édition sur les pages des layers).
 */
import type { NavigationMenuItem } from '@nuxt/ui'

const props = defineProps<{
  publicId: string
  programme?: boolean
  carte?: boolean
  faq?: boolean
  benevoles?: boolean
}>()

const items = computed<NavigationMenuItem[]>(() => {
  const base = `/events/${props.publicId}`
  return [
    { label: 'Informations', icon: 'i-heroicons-information-circle', to: base, exact: true },
    ...(props.programme
      ? [{ label: 'Programme', icon: 'i-heroicons-calendar-days', to: `${base}/program` }]
      : []),
    ...(props.carte
      ? [{ label: 'Carte du site', icon: 'i-heroicons-map', to: `${base}/map` }]
      : []),
    ...(props.faq
      ? [{ label: 'FAQ', icon: 'i-heroicons-question-mark-circle', to: `${base}/faq` }]
      : []),
    ...(props.benevoles
      ? [{ label: 'Bénévoles', icon: 'i-heroicons-hand-raised', to: `${base}/volunteers` }]
      : []),
  ]
})
</script>
