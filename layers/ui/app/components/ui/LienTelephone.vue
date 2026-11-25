<template>
  <a v-if="numero" :href="`tel:${numero}`" :class="classeDuLien">{{ numero }}</a>
  <span v-else-if="vide" :class="classeDuTexte">{{ vide }}</span>
</template>

<script setup lang="ts">
/**
 * Un numéro de téléphone, qui appelle d'un geste.
 *
 * ⚠️ POURQUOI UN COMPOSANT POUR UNE BALISE. Le dépôt comptait déjà sept `tel:` écrits à la main,
 * chacun avec ses classes, et dix écrans affichaient encore un numéro en texte brut. Ce sont
 * souvent des écrans de terrain — relancer un bénévole qui n'a pas confirmé, joindre un contact
 * d'urgence — où recopier dix chiffres à la main, debout, n'a aucun sens.
 *
 * 📍 CE QU'IL NE FAUT PAS FAIRE, et c'est la moitié de l'analyse : cinq autres écrans affichent un
 * numéro dans un CHAMP DE SAISIE — le guichet de billetterie, la fiche artiste, la candidature
 * bénévole, le formulaire d'appel à spectacles, son propre profil. Un lien y serait une gêne, pas
 * un service. Ce composant ne s'emploie que là où le numéro se LIT.
 */
withDefaults(
  defineProps<{
    numero?: string | null
    /** Ce qu'on affiche à défaut de numéro. Vide par défaut : la ligne disparaît alors. */
    vide?: string | null
    /** Classes du lien, pour épouser la typographie de l'écran appelant. */
    classeDuLien?: string
    /** Classes du texte de remplacement. */
    classeDuTexte?: string
  }>(),
  {
    numero: null,
    vide: null,
    classeDuLien: 'text-primary-600 dark:text-primary-400 hover:underline',
    classeDuTexte: 'text-gray-400',
  }
)
</script>
