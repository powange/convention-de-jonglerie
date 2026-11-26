<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- L'invitation à installer l'application (layers/ui, partagée avec app1). Montée ici parce
         que c'est le seul composant présent sur toutes les pages : le navigateur ne propose
         l'installation qu'une fois, un composant de page pourrait manquer l'événement. -->
    <PWAInstallBanner />
  </UApp>
</template>
