<template>
  <div class="text-center" :class="compact ? 'py-6' : 'py-12'">
    <UIcon :name="icone" class="mx-auto mb-3 size-12" :class="classeIcone" />
    <p class="font-medium text-gray-900 dark:text-white">{{ titre }}</p>
    <p v-if="description" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      {{ description }}
    </p>
    <!--
      L'action est un slot et non une prop : les écrans y mettent un `UButton` avec leur propre
      `to`, leur `@click` et leur icône. Une prop `actionLabel` + un `@action` aurait obligé chacun
      à reconstruire ce qu'il avait déjà.
    -->
    <div v-if="$slots.action" class="mt-4 flex justify-center">
      <slot name="action" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * « Il n'y a rien ici » — dit d'une seule façon, partout.
 *
 * ⚠️ POURQUOI CE COMPOSANT EXISTE. Vingt-six écrans de gestion d'une édition annoncent une liste
 * vide, et ils le faisaient chacun à leur manière : icône de taille différente, marge différente,
 * texte parfois en gris moyen et parfois en gris clair, parfois dans une carte et parfois non.
 * Vingt d'entre eux partageaient déjà la MÊME forme — une icône au-dessus d'un texte centré —
 * recopiée vingt fois avec vingt variantes de classes.
 *
 * 📍 L'ÉNONCÉ DU RAPPORT DISAIT L'INVERSE : « 19 écrans affichent un UAlert pour le vide, 7 un
 * bloc centré à la main ». Mesuré le 1er octobre 2026 : vingt blocs centrés écrits à la main,
 * TROIS `UAlert`. C'est donc la forme centrée qui devient le standard, et non l'encart.
 *
 * ⚠️ UN ÉTAT VIDE N'EST PAS UN CHARGEMENT, et c'est tout l'enjeu : une liste vide qui n'affiche
 * rien ne se distingue pas d'une panne. Le texte est donc obligatoire — on ne peut pas employer ce
 * composant sans dire ce qui manque.
 *
 * Ce qu'il ne fait PAS : remplacer les trois `UAlert`. Un encart dit « attention » ; il convient
 * quand le vide est un problème à régler (aucun tarif importé, aucune journée de programme), pas
 * quand il est normal (aucun emprunt en cours). Les convertir mélangerait les deux sens.
 */
withDefaults(
  defineProps<{
    /** Le titre : ce qui manque, dit en clair. Toujours une clé i18n côté appelant. */
    titre: string
    /** Une phrase de plus, quand le titre ne suffit pas à dire quoi faire. */
    description?: string
    icone?: string
    /**
     * La couleur de l'icône, en classes Tailwind.
     *
     * Le défaut est neutre, et c'est voulu : un vide est le plus souvent un simple constat. Les
     * écrans où le vide est une BONNE nouvelle — plus aucun emprunt à relancer, plus aucun doublon
     * de repas — passent une teinte verte, qui est l'information.
     */
    classeIcone?: string
    /** Resserre les marges, pour un vide à l'intérieur d'une carte ou d'un onglet. */
    compact?: boolean
  }>(),
  {
    description: undefined,
    icone: 'i-heroicons-inbox',
    classeIcone: 'text-gray-400',
    compact: false,
  }
)
</script>
