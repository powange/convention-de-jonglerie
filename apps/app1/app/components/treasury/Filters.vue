<!--
  Les champs de filtrage de la trésorerie, extraits pour être rendus à deux endroits.

  Sur grand écran ils s'alignent dans la carte ; sur téléphone ils passent dans une modale, une
  rangée de quatre contrôles n'y tenant pas. Un composant plutôt qu'un balisage recopié : deux
  copies finissent toujours par diverger, et c'est alors le rendu mobile qui prend du retard,
  puisque c'est celui qu'on regarde le moins.
-->
<template>
  <div class="flex flex-col gap-1">
    <div :class="empile ? 'flex flex-col gap-3' : 'flex flex-col gap-3 lg:flex-row lg:items-end'">
      <UFormField
        :label="t('gestion.treasury.filter_search')"
        :class="empile ? '' : 'min-w-0 flex-1'"
      >
        <UInput
          v-model="saisie"
          icon="i-lucide-search"
          :placeholder="t('gestion.treasury.filter_search_placeholder')"
          class="w-full"
          @keydown.enter="appliquer"
        />
      </UFormField>

      <UFormField
        :label="t('gestion.treasury.filter_code')"
        :class="empile ? '' : 'w-full lg:w-72'"
        data-testid="treasury-filter-code"
      >
        <!-- Sélection multiple : une trésorerie se lit souvent par familles de comptes, et
             l'alternative — un code puis un autre — obligerait à refaire l'export à chaque fois.
             Rien de coché vaut « tous les codes », ce qui évite une entrée pour le dire. -->
        <USelectMenu
          v-model="codes"
          multiple
          value-key="value"
          :items="choixDeCode"
          :placeholder="t('gestion.treasury.filter_code_all')"
          :search-input="{ placeholder: t('gestion.treasury.code_search_all') }"
          class="w-full"
        />
      </UFormField>

      <!-- Une période, pas un jour : c'est ce qu'on interroge dans une trésorerie. Les deux bornes
           sont indépendantes — renseigner « du » seul se lit « depuis ». -->
      <!--
        Les ÉTATS d'une ligne : avancée par quelqu'un, prévisionnelle.
        Un multi-select et non deux cases à cocher — c'est ce que fait déjà la page d'un groupe de
        stock pour ses états, et deux cases auraient pris deux fois la place dans une barre qui
        tient sur une ligne.
      -->
      <UFormField
        :label="t('gestion.treasury.filter_state')"
        :class="empile ? '' : 'w-full lg:w-56'"
      >
        <USelectMenu
          v-model="etats"
          multiple
          :items="choixDEtat"
          value-key="value"
          label-key="label"
          :placeholder="t('gestion.treasury.filter_state_all')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('gestion.treasury.filter_from')"
        :class="empile ? '' : 'w-full lg:w-48'"
      >
        <UiDateField v-model="du" size="md" clearable class="w-full" />
      </UFormField>
      <UFormField :label="t('gestion.treasury.filter_to')" :class="empile ? '' : 'w-full lg:w-48'">
        <UiDateField v-model="au" size="md" clearable class="w-full" />
      </UFormField>

      <slot name="actions" />
    </div>

    <!--
      ⚠️ L'AIDE VA SOUS LA BARRE, pas dans un `UFormField :help` autour du champ de texte.

      La rangée est alignée par le bas (`lg:items-end`), et les quatre libellés n'ont pas la même
      hauteur. Un `help` sous le seul champ de texte l'aurait rendu plus haut que les trois autres,
      remontant sa saisie au-dessus de la leur. Le cas jumeau a été MESURÉ sur les filtres du
      stock, par un test Playwright qui compare les ordonnées : vingt pixels d'écart.
    -->
    <p class="text-xs text-gray-500 dark:text-gray-400">
      {{ t('gestion.treasury.filter_search_help') }}
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /** Les entrées du select d'imputation, composées par la page qui connaît ses codes. */
  choixDeCode: { value: string; label: string }[]
  /** Empile les champs les uns sous les autres : le rendu de la modale, sur téléphone. */
  empile?: boolean
}>()

const texte = defineModel<string>('texte', { required: true })

/*
 * ⚠️ TEMPORISÉE, et le coût évité n'est pas seulement celui du filtrage.
 *
 * La page parcourt toutes ses lignes pour chaque caractère — elle les détient toutes, il n'y a pas
 * de pagination — MAIS elle écrit aussi l'adresse à chaque changement de filtre. Une recherche de
 * dix lettres produisait donc dix écritures d'adresse, sur un écran où l'on tape volontiers un
 * libellé entier.
 *
 * Le champ, lui, reste immédiat : c'est tout l'intérêt de séparer la saisie du modèle.
 */
const { saisie, appliquer } = useSaisieTemporisee(texte)
const codes = defineModel<string[]>('codes', { required: true })
const etats = defineModel<string[]>('etats', { required: true })

/*
 * Les libellés vivent ici et les valeurs dans `ETATS_DE_TRESORERIE` : la liste du sélecteur ne peut
 * donc pas proposer un état que le filtre ne sait pas traiter — un test unitaire garde ce lien.
 */
const choixDEtat = computed(() => [
  { value: 'avancee', label: t('gestion.treasury.filter_state_advanced') },
  { value: 'previsionnelle', label: t('gestion.treasury.filter_state_forecast') },
])

const du = defineModel<string>('du', { required: true })
const au = defineModel<string>('au', { required: true })

const { t } = useI18n()
</script>
