<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- L'invitation à installer l'application (layer ui, partagée avec app1). Montée ici, sur
         toutes les pages : le navigateur n'émet qu'une fois l'événement qu'elle écoute. -->
    <PWAInstallBanner />
  </UApp>
</template>

<script setup lang="ts">
/*
 * Le manifeste d'application : celui de Flowvent partout, sauf sur les pages d'un événement, qui
 * déclarent le sien (server/api/events/[id]/manifest.webmanifest.get.ts). « Installer » depuis une
 * page de l'événement pose donc sur le téléphone l'application de CET événement.
 * `use-credentials` : le manifeste d'un événement non public n'est visible qu'avec la session.
 */
const route = useRoute()
const evenementDeLaPage = computed(() => evenementDuChemin(route.path))
useHead(() => ({
  link: [
    evenementDeLaPage.value
      ? {
          key: 'manifest',
          rel: 'manifest',
          href: `/api/events/${evenementDeLaPage.value}/manifest.webmanifest`,
          crossorigin: 'use-credentials' as const,
        }
      : { key: 'manifest', rel: 'manifest', href: '/api/site.webmanifest?v=2' },
  ],
}))
</script>
