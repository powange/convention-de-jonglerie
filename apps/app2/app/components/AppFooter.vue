<template>
  <footer class="mt-12 border-t border-default py-6">
    <UContainer
      class="flex flex-col items-center justify-between gap-1 text-sm text-muted sm:flex-row"
    >
      <span class="flex items-center gap-3">
        <span>© Flowvent — démonstration</span>
        <ULink to="/privacy-policy" class="hover:underline">Confidentialité</ULink>
      </span>
      <span class="flex items-center gap-1">
        <UIcon name="i-heroicons-information-circle" />
        Paiement simulé · aucune transaction réelle
      </span>
    </UContainer>
  </footer>
</template>
