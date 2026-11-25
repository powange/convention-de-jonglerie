<template>
  <div class="space-y-3" role="status" :aria-label="libelle">
    <div
      v-for="ligne in lignes"
      :key="ligne"
      class="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
    >
      <USkeleton v-if="avecAvatar" class="size-10 shrink-0 rounded-full" />
      <div class="flex-1 space-y-2">
        <USkeleton class="h-4" :class="largeurs[(ligne - 1) % largeurs.length]" />
        <USkeleton class="h-3 w-1/3" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Ce qui va arriver, pendant que ça arrive.
 *
 * ⚠️ POURQUOI PAS UNE ROUE. Trente des cinquante-sept écrans de gestion affichent une roue qui
 * tourne pendant le chargement d'une liste, et un seul un squelette (mesuré le 1er octobre 2026 ;
 * le rapport annonçait trente-cinq). Une roue ne dit rien : ni combien de temps, ni ce qui va
 * s'afficher. Et surtout, sur une liste qui revient VIDE, elle ne se distingue pas d'une panne —
 * on attend, la roue disparaît, il ne reste rien, et l'on ne sait pas si c'est la réponse ou
 * l'échec. Un squelette annonce la forme de ce qui vient, puis cède la place au contenu ou à
 * l'état vide, qui lui est explicite.
 *
 * ⚠️ CE COMPOSANT NE REMPLACE PAS LES ROUES DES BOUTONS. Un bouton qui tourne dit « ton clic est
 * parti », ce qui est une autre information, au bon endroit. Seules les roues qui occupent la place
 * d'une LISTE sont concernées.
 *
 * ⚠️ `role="status"` et un libellé : sans eux, un lecteur d'écran annonce une douzaine de blocs
 * vides et rien d'utile. Le libellé par défaut est traduit par l'appelant.
 *
 * Les largeurs varient d'une ligne à l'autre, volontairement : des barres de longueur identique
 * lisent comme un tableau figé, pas comme du texte en attente.
 */
withDefaults(
  defineProps<{
    /** Combien de lignes feindre. Cinq suffisent à remplir un écran sans mentir sur le volume. */
    lignes?: number
    /** Une pastille ronde à gauche, pour les listes de personnes. */
    avecAvatar?: boolean
    /**
     * Ce qu'un lecteur d'écran annonce.
     *
     * ⚠️ PAS DE DÉFAUT ÉCRIT ICI : un libellé français dans le code s'afficherait tel quel à un
     * lecteur allemand, et c'est justement le genre de reste que ce dépôt traque. L'appelant passe
     * `$t('common.loading')`, ou rien — et l'on retombe alors sur l'attribut absent, ce qui vaut
     * mieux qu'un mot dans la mauvaise langue.
     */
    libelle?: string
  }>(),
  { lignes: 5, avecAvatar: false, libelle: undefined }
)

const largeurs = ['w-3/4', 'w-2/3', 'w-5/6', 'w-1/2', 'w-4/5']
</script>
