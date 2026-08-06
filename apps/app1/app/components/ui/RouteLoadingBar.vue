<script setup lang="ts">
/**
 * Barre de progression pendant les navigations.
 *
 * Cliquer sur une édition depuis l'accueil ne donnait aucun signe de vie le temps du chargement :
 * sur une connexion lente — celle d'une convention — on ne sait pas si le clic a été pris en
 * compte, et on reclique.
 *
 * Le composant `NuxtLoadingIndicator` fait ce travail mais s'affiche en haut de la fenêtre. Le
 * composable officiel qui l'alimente permet la même chose en bas, où la barre gêne moins la
 * lecture du contenu qui arrive.
 */
const { isLoading, progress } = useLoadingIndicator()
const { t } = useI18n()
</script>

<template>
  <!-- `fixed` et non `sticky` : la barre doit tenir le bas de la fenêtre quel que soit le
       défilement, y compris sur une page plus courte que l'écran. -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-500"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isLoading"
      class="fixed inset-x-0 bottom-0 z-50 h-0.5 bg-primary/15 pointer-events-none"
      role="progressbar"
      :aria-label="t('common.loading')"
      :aria-valuenow="Math.round(progress)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="h-full bg-primary transition-[width] duration-150 ease-out"
        :style="{ width: `${progress}%` }"
      />
    </div>
  </Transition>
</template>
