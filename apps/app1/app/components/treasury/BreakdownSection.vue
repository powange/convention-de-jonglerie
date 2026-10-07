<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ titre }}</h2>
        <UBadge color="neutral" variant="subtle" size="sm">
          {{ $t('gestion.treasury.breakdown_codes_count', { count: groupes.length }) }}
        </UBadge>
      </div>
    </template>

    <p v-if="!groupes.length" class="text-sm text-gray-500 dark:text-gray-400">
      {{ $t('gestion.treasury.breakdown_empty') }}
    </p>

    <!-- Les montants ne se coupent pas : sur un téléphone c'est le tableau qui défile, et non la
         page entière qui part de travers. -->
    <div v-else class="overflow-x-auto">
      <table class="w-full table-fixed text-sm min-w-[32rem]">
        <!--
          ⚠️ DES LARGEURS FIGÉES, ET C'EST TOUT L'INTÉRÊT DE CE `colgroup`.

          Sans `table-fixed`, chaque section calcule ses colonnes sur SON propre contenu : un
          libellé long du côté des charges — « Sous-traitance impression textiles » — élargit la
          colonne, et les deux tableaux ne s'alignent plus l'un sous l'autre. Or on lit cette page
          en comparant une colonne de haut en bas, d'une section à l'autre.
        -->
        <colgroup>
          <col class="w-32" />
          <col />
          <col class="w-36" />
          <col class="w-36" />
        </colgroup>
        <thead>
          <tr class="text-left text-gray-500 dark:text-gray-400">
            <th class="py-2 pr-3 font-medium">{{ $t('gestion.treasury.export_code') }}</th>
            <th class="py-2 pr-3 font-medium">{{ $t('gestion.treasury.export_code_label') }}</th>
            <th class="py-2 pl-3 font-medium text-right">
              {{ $t('gestion.treasury.export_engaged') }}
            </th>
            <th class="py-2 pl-3 font-medium text-right">
              {{ $t('gestion.treasury.export_settled') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="groupe of rangees" :key="groupe.code || SANS_CODE" class="odd:bg-elevated">
            <!--
              L'INDENTATION DIT LA HIÉRARCHIE : 601, puis 6011 d'un cran, puis 60111 de deux. Sans
              elle, vingt comptes de rangs différents paraissent de même niveau.

              Un style en ligne et non une classe Tailwind : une classe composée à l'exécution
              (`pl-${n}`) n'existe pas dans la feuille produite, et ne s'appliquerait jamais.
            -->
            <td
              class="py-2 pr-3 font-medium tabular-nums"
              :style="{ paddingLeft: `${groupe.profondeur * 0.75}rem` }"
            >
              <!-- Un code vide n'est pas un compte : c'est le fourre-tout, et il se nomme. -->
              <span v-if="groupe.code" class="inline-flex items-center gap-1">
                <!--
                  La flèche d'arborescence, seulement sur un SOUS-compte. Le décalage seul se
                  confond avec une irrégularité de mise en page ; la flèche dit que c'est voulu.
                  `aria-hidden` : elle redit ce que la hiérarchie des codes porte déjà, et un
                  lecteur d'écran n'a pas à l'annoncer vingt fois.
                -->
                <UIcon
                  v-if="groupe.profondeur > 0"
                  name="i-lucide-corner-down-right"
                  aria-hidden="true"
                  class="size-3 shrink-0 text-gray-400 dark:text-gray-500"
                />
                {{ groupe.code }}
              </span>
              <span v-else class="text-gray-500 dark:text-gray-400 italic">
                {{ $t('gestion.treasury.export_without_code') }}
              </span>
            </td>
            <td class="py-2 pr-3 text-gray-600 dark:text-gray-400">{{ groupe.libelle }}</td>
            <td class="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
              {{ money(groupe.engage) }}
            </td>
            <td class="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
              {{ money(groupe.regle) }}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-default font-semibold">
            <td class="py-2 pr-3" colspan="2">{{ $t('gestion.treasury.export_total') }}</td>
            <td class="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
              {{ money(total.engage) }}
            </td>
            <td class="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
              {{ money(total.regle) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import {
  profondeurDuCode,
  SANS_CODE,
  type GroupeDeCode,
  type TotalDeNature,
} from '~/utils/export-tresorerie'

/**
 * Une nature — charges ou produits — répartie par code d'imputation.
 *
 * ⚠️ UN `<table>` ET NON UN `UTable`. Ce tableau n'a ni tri, ni sélection, ni colonnes masquables,
 * ni ligne cliquable : tout ce que `UTable` apporte, et qui n'a pas de sens ici. Il lui faut en
 * revanche un `<tfoot>` qui tienne au bas du tableau — un total posé dans une rangée ordinaire se
 * trierait avec les autres le jour où quelqu'un ajouterait le tri.
 *
 * 📍 Le total vient des GROUPES, pas des lignes : c'est `totalDesGroupes` qui le calcule, de sorte
 * que le chiffre du bas soit par construction la somme de ce que le lecteur a sous les yeux.
 */
const props = defineProps<{
  titre: string
  groupes: GroupeDeCode[]
  total: TotalDeNature
  /** Le formateur de la page : la devise appartient à l'édition, pas à ce composant. */
  money: (cents: number) => string
}>()

/**
 * Les groupes, avec leur PROFONDEUR calculée une fois.
 *
 * La mesure se fait sur les codes de CETTE section seulement : un compte de produits n'est jamais
 * le sous-compte d'un compte de charges, et les mêler décalerait des lignes sans raison.
 *
 * Calculé ici plutôt qu'appelé depuis le modèle : la fonction y aurait tourné deux fois par
 * rangée — une pour le décalage, une pour la flèche —, sur une liste qui en compte déjà vingt.
 */
const rangees = computed(() => {
  const codes = props.groupes.map((groupe) => groupe.code)
  return props.groupes.map((groupe) => ({
    ...groupe,
    profondeur: profondeurDuCode(groupe.code, codes),
  }))
})
</script>
