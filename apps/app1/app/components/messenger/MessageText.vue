<template>
  <!--
    Tout sur une ligne : le parent est en `whitespace-pre-wrap`, et le moindre saut de ligne entre
    deux balises s'afficherait comme un blanc au milieu du message.
  -->
  <span
    ><template v-for="(morceau, index) in morceaux" :key="index"
      ><ULink
        v-if="morceau.type === 'lien'"
        :to="morceau.href"
        target="_blank"
        rel="noopener noreferrer nofollow"
        external
        raw
        class="underline underline-offset-2 break-all hover:opacity-80"
        @click.stop
        >{{ morceau.texte }}</ULink
      ><template v-else>{{ morceau.texte }}</template></template
    ></span
  >
</template>

<script setup lang="ts">
import { decouperLiensMessage } from '~~/shared/utils/liens-message'

/**
 * Le texte d'un message, ses adresses rendues cliquables (nouvel onglet).
 *
 * Chaque morceau passe par l'interpolation de Vue, donc échappé : voir `liens-message.ts` pour
 * pourquoi on ne produit pas de HTML.
 */
const props = defineProps<{ texte: string }>()

const morceaux = computed(() => decouperLiensMessage(props.texte))
</script>
