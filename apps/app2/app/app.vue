<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- L'invitation à installer l'application (layer ui, partagée avec app1). Montée ici, sur
         toutes les pages : le navigateur n'émet qu'une fois l'événement qu'elle écoute. Montrée
         sur les pages d'un événement seulement : seul un événement s'installe. -->
    <div v-show="evenementDeLaPage">
      <PWAInstallBanner />
    </div>
  </UApp>
</template>

<script setup lang="ts">
/*
 * Le manifeste d'application n'est déclaré QUE sur les pages d'un événement
 * (server/api/events/[id]/manifest.webmanifest.get.ts) : « Installer » pose sur le téléphone
 * l'application de CET événement. Flowvent lui-même ne s'installe plus (décision du 28/11) : son
 * manifeste couvre tout le site, et une fois installé, Chrome tenait chaque événement pour déjà
 * installé. `/api/site.webmanifest` reste servi pour les installations antérieures.
 * `use-credentials` : le manifeste d'un événement non public n'est visible qu'avec la session.
 */
const route = useRoute()
const evenementDeLaPage = computed(() => evenementDuChemin(route.path))
useHead(() => ({
  link: evenementDeLaPage.value
    ? [
        {
          key: 'manifest',
          rel: 'manifest',
          href: `/api/events/${evenementDeLaPage.value}/manifest.webmanifest`,
          crossorigin: 'use-credentials' as const,
        },
      ]
    : [],
}))
</script>
