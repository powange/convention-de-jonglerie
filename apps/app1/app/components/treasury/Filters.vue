<!--
  Les champs de filtrage de la trésorerie, extraits pour être rendus à deux endroits.

  Sur grand écran ils s'alignent dans la carte ; sur téléphone ils passent dans une modale, une
  rangée de quatre contrôles n'y tenant pas. Un composant plutôt qu'un balisage recopié : deux
  copies finissent toujours par diverger, et c'est alors le rendu mobile qui prend du retard,
  puisque c'est celui qu'on regarde le moins.
-->
<template>
  <div :class="empile ? 'flex flex-col gap-3' : 'flex flex-col gap-3 lg:flex-row lg:items-end'">
    <UFormField
      :label="t('gestion.treasury.filter_search')"
      :class="empile ? '' : 'min-w-0 flex-1'"
    >
      <UInput
        v-model="texte"
        icon="i-lucide-search"
        :placeholder="t('gestion.treasury.filter_search_placeholder')"
        class="w-full"
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
    <UFormField :label="t('gestion.treasury.filter_from')" :class="empile ? '' : 'w-full lg:w-48'">
      <UiDateField v-model="du" size="md" clearable class="w-full" />
    </UFormField>
    <UFormField :label="t('gestion.treasury.filter_to')" :class="empile ? '' : 'w-full lg:w-48'">
      <UiDateField v-model="au" size="md" clearable class="w-full" />
    </UFormField>

    <slot name="actions" />
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
const codes = defineModel<string[]>('codes', { required: true })
const du = defineModel<string>('du', { required: true })
const au = defineModel<string>('au', { required: true })

const { t } = useI18n()
</script>
