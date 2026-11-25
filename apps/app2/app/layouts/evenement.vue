<template>
  <NuxtLayout name="default">
    <!-- Les pages BÉNÉVOLE du layer (candidater, mes créneaux, échanges) ne posent pas leur propre
         conteneur : dans app1, c'est le layout par défaut qui le fait. Celui de Flowvent laisse
         chaque page le poser — d'où ce layout, attribué à ces seules pages par `routeRules`. -->
    <UContainer class="py-8">
      <slot />
    </UContainer>
  </NuxtLayout>
</template>
