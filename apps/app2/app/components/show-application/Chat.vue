<template>
  <span v-if="false" />
</template>

<script setup lang="ts">
/**
 * `ShowApplicationChat` — la conversation d'une candidature à un appel à spectacles, qu'affichent les
 * pages du layer artistes. Flowvent n'a PAS de messagerie (décision de l'utilisateur, 25/11/2026) :
 * ce composant n'affiche rien. Il existe pour que le nom se résolve — sans lui, Vue avertit à chaque
 * rendu de la page « Mes candidatures ».
 */
defineProps<{ applicationId?: number }>()
</script>
