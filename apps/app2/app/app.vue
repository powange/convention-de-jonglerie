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
