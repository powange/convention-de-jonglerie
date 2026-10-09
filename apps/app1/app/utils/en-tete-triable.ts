import { h } from 'vue'

import { UButton } from '#components'

import type { Column } from '@tanstack/vue-table'

/**
 * L'en-tête d'une colonne qu'on peut trier d'un clic.
 *
 * ## ⚠️ POURQUOI CET UTIL EXISTE : CINQ COPIES IDENTIQUES
 *
 * Mesuré le 09/10/2026 : cinq fichiers portaient cette fonction, **identiques au nom de leurs
 * variables près** — `treasury/index.vue`, `stock/missing.vue`, `stock/[groupId].vue`,
 * `artists/index.vue` et `volunteer/Table.vue`. Mêmes trois icônes, même `-mx-2.5`, même
 * `toggleSorting(sens === 'asc')`.
 *
 * Le `CLAUDE.md` du dépôt en fait une règle : « Si un pattern se répète 3+ fois, créer un nouveau
 * helper ». Il se répétait cinq fois.
 *
 * 📍 Ce n'est pas qu'une économie de lignes. Cinq copies, c'est cinq endroits où corriger le jour
 * où l'une des flèches ne tourne plus — et c'est aussi la raison pour laquelle **la moitié des
 * tableaux de gestion n'avaient pas de tri du tout** : l'ajouter imposait de recopier une
 * sixième fois.
 *
 * ## Les trois états, et pourquoi trois icônes
 *
 * Non trié, croissant, décroissant. La flèche double (`arrow-up-down`) dit « cette colonne est
 * triable » sans prétendre qu'elle l'est ; sans elle, rien ne distingue une colonne triable d'une
 * colonne ordinaire, et personne ne pense à cliquer.
 *
 * ⚠️ Les icônes sont des `i-lucide-*`, contrairement au reste du dépôt qui emploie massivement
 * `i-heroicons-*`. C'est conservé TEL QUEL : harmoniser les deux familles est une décision qui
 * engage tout le dépôt (333 fichiers contre 47), et elle fait l'objet d'une fiche à part. Changer
 * ces trois icônes au passage trancherait cette question sans le dire.
 *
 * ## Emploi
 *
 * ```ts
 * { id: 'name', header: ({ column }) => enTeteTriable(column, t('common.name')),
 *   accessorFn: (ligne) => ligne.name }
 * ```
 *
 * ⚠️ Un `accessorKey` ou un `accessorFn` est INDISPENSABLE : sans valeur à comparer, TanStack
 * n'a rien à trier et le clic ne fait rien — en silence. Un `id` seul avec un gabarit de cellule
 * ne suffit pas.
 */
export function enTeteTriable(column: Column<never>, libelle: string) {
  const sens = column.getIsSorted()

  /*
   * ⚠️ `UButton` IMPORTÉ DEPUIS `#components`, ET SURTOUT PAS `resolveComponent('UButton')`.
   *
   * Les cinq copies d'origine employaient `resolveComponent`, et cela marchait — parce qu'elles
   * vivaient dans des `.vue`, où le module `components` de Nuxt RÉÉCRIT cet appel en import
   * statique à la compilation. Dans un `.ts`, cette réécriture n'a pas lieu : `resolveComponent`
   * s'exécute alors à l'exécution, hors contexte de rendu, et rend la CHAÎNE « UButton ».
   *
   * Le résultat, constaté en CI : les en-têtes se rendaient VIDES. Pas d'erreur, pas de page
   * blanche — seulement des colonnes sans titre et sans bouton, à côté desquelles les en-têtes
   * restés de simples chaînes s'affichaient normalement. L'instantané Playwright le disait d'un
   * coup d'œil :
   *
   *     - columnheader [ref=e185]        ← enTeteTriable, vide
   *     - columnheader "Tags" [ref=e187] ← chaîne simple, intacte
   */
  return h(UButton, {
    color: 'neutral',
    variant: 'ghost',
    label: libelle,
    icon: sens
      ? sens === 'asc'
        ? 'i-lucide-arrow-up-narrow-wide'
        : 'i-lucide-arrow-down-wide-narrow'
      : 'i-lucide-arrow-up-down',
    // Compense le rembourrage du bouton, pour que le libellé reste aligné sur ceux des colonnes
    // non triables. Sans cela, une colonne triable décale visiblement sa voisine.
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(sens === 'asc'),
  })
}
