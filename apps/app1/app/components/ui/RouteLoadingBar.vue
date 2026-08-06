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
/**
 * Les réglages par défaut retardaient la barre de part et d'autre du chargement, au point qu'elle
 * semblait n'apparaître qu'une fois la page arrivée :
 *
 * - `throttle` (200 ms par défaut) diffère l'apparition, pour éviter un clignotement sur les
 *   navigations instantanées. Ramené à zéro : le clic doit se voir tout de suite, c'est la raison
 *   d'être de cette barre. Une navigation immédiate garde de toute façon `hideDelay` avant de
 *   disparaître, donc la barre reste perceptible plutôt que clignotante.
 * - `hideDelay` (500 ms par défaut) la maintient affichée après l'arrivée de la page ; c'est cette
 *   traîne, pendant laquelle la progression finit sa course jusqu'à 100 %, qu'on prenait pour un
 *   affichage tardif. Raccourcie.
 *
 * `hideDelay` n'est pas documenté mais bien lu par `createLoadingIndicator` (voir
 * `nuxt/dist/app/composables/loading-indicator.js`) : à revérifier lors d'une montée de version.
 */
const { isLoading, progress } = useLoadingIndicator({ throttle: 0, hideDelay: 150 })
const { t } = useI18n()
</script>

<template>
  <!-- `fixed` et non `sticky` : la barre doit tenir le bas de la fenêtre quel que soit le
       défilement, y compris sur une page plus courte que l'écran. -->
  <Transition
    enter-active-class="transition-opacity duration-75"
    leave-active-class="transition-opacity duration-300"
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
      <!-- Largeur plancher : la progression estimée part de zéro et ne dépasse 1 % qu'après une
           poignée de millisecondes. Sans ce minimum, le clic n'afficherait qu'un trait vide. -->
      <div
        class="h-full bg-primary transition-[width] duration-150 ease-out"
        :style="{ width: `${Math.max(progress, 3)}%` }"
      />
    </div>
  </Transition>
</template>
