<template>
  <div class="text-left">
    <UBadge
      v-if="entree.zone"
      :style="teinte(entree.zone.couleur)"
      variant="subtle"
      size="sm"
      class="max-w-full"
    >
      <UIcon name="i-heroicons-map" class="mr-1 shrink-0" />
      <span class="truncate">{{ entree.zone.nom }}</span>
    </UBadge>
    <UBadge
      v-else-if="entree.repere"
      :style="teinte(entree.repere.couleur)"
      variant="subtle"
      size="sm"
      class="max-w-full"
    >
      <UIcon name="i-heroicons-map-pin" class="mr-1 shrink-0" />
      <span class="truncate">{{ entree.repere.nom }}</span>
    </UBadge>

    <!-- Le texte libre s'ajoute sous l'étiquette au lieu de la remplacer : « côté buvette » précise
         la zone, il ne la désigne pas. -->
    <span
      v-if="entree.lieuTexte"
      class="text-sm text-gray-600 dark:text-gray-400"
      :class="{ 'mt-1 block': entree.zone || entree.repere }"
    >
      {{ entree.lieuTexte }}
    </span>

    <span v-if="!entree.zone && !entree.repere && !entree.lieuTexte" class="text-sm text-gray-400">
      —
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * Lieu d'une entrée du programme, présenté comme sur la page des spectacles : une étiquette
 * colorée pour la zone ou le repère, et la précision libre en dessous.
 *
 * L'affichage vit dans son propre composant pour que la frise et son éditeur en place montrent
 * exactement la même chose — le second n'étant que le premier, rendu cliquable.
 */
import type { EntreeProgramme } from '~~/shared/utils/program-timeline'

defineProps<{ entree: EntreeProgramme }>()

/**
 * Couleur du lieu, en fond très atténué et en texte.
 *
 * Le `20` final est l'opacité en hexadécimal (~12 %) : la même convention que la page des
 * spectacles, pour que deux écrans qui montrent la même zone lui donnent la même teinte.
 *
 * Un repère peut n'avoir aucune couleur propre — il suit alors celle de son type, que la frise ne
 * connaît pas — d'où le gris de repli plutôt qu'une étiquette transparente.
 */
const teinte = (couleur: string | null) => {
  const base = couleur || '#6b7280'
  return { backgroundColor: `${base}20`, color: base }
}
</script>
