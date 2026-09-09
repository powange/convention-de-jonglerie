<!--
  Les trois filtres de la liste du matériel, écrits une seule fois.

  Ils servent à deux dispositions : en ligne sur écran large, empilés dans une modale sur écran
  étroit, où trois champs côte à côte ne tiennent pas. Les dupliquer aurait garanti qu'une
  correction n'atteigne qu'une des deux.

  La disposition vient du parent, par les classes qu'il pose sur ce composant : lui seul sait s'il
  affiche une ligne ou une colonne.
-->
<template>
  <div>
    <UFormField :label="$t('gestion.stock.item_name')" class="flex-1 min-w-0">
      <UInput
        v-model="nom"
        icon="i-heroicons-magnifying-glass"
        :placeholder="$t('gestion.stock.name_filter_placeholder')"
        class="w-full"
      >
        <template v-if="nom" #trailing>
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            icon="i-heroicons-x-mark"
            :aria-label="$t('common.clear')"
            @click="nom = ''"
          />
        </template>
      </UInput>
    </UFormField>

    <UFormField :label="$t('gestion.stock.tags.filter_label')" class="flex-1 min-w-0">
      <USelectMenu
        v-model="tags"
        :items="tagItems"
        multiple
        :placeholder="$t('gestion.stock.tags.filter_placeholder')"
        searchable
        :searchable-placeholder="$t('common.search')"
        class="w-full"
        :ui="{ content: 'min-w-fit' }"
      >
        <template #default="{ modelValue: selected }">
          <span v-if="!selected?.length" class="text-gray-400">
            {{ $t('gestion.stock.tags.filter_placeholder') }}
          </span>
          <div v-else class="flex flex-wrap gap-1">
            <StockTagBadge
              v-for="tg in selected"
              :key="tg.value"
              :tag="{ name: tg.label, color: tg.color }"
            />
          </div>
        </template>
        <template #item-leading="{ item: option }">
          <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: option.color }" />
        </template>
      </USelectMenu>
    </UFormField>

    <UFormField :label="$t('gestion.stock.external_loan')" class="flex-1 min-w-0">
      <USelectMenu
        v-model="etats"
        :items="etatsItems"
        multiple
        :placeholder="$t('gestion.stock.tags.filter_placeholder')"
        class="w-full"
        :ui="{ content: 'min-w-fit' }"
      />
    </UFormField>

    <UFormField :label="$t('gestion.stock.loan_place_filter')" class="flex-1 min-w-0">
      <UInput
        v-model="lieu"
        icon="i-heroicons-magnifying-glass"
        :placeholder="$t('gestion.stock.loan_place_filter_placeholder')"
        class="w-full"
      >
        <template v-if="lieu" #trailing>
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            icon="i-heroicons-x-mark"
            :aria-label="$t('common.clear')"
            @click="lieu = ''"
          />
        </template>
      </UInput>
    </UFormField>
  </div>
</template>

<script setup lang="ts">
interface OptionTag {
  label: string
  value: number
  color: string
}
interface OptionEtat {
  label: string
  value: string
}

defineProps<{
  tagItems: OptionTag[]
  etatsItems: OptionEtat[]
}>()

const nom = defineModel<string>('nom', { required: true })
const tags = defineModel<OptionTag[]>('tags', { required: true })
const etats = defineModel<OptionEtat[]>('etats', { required: true })
const lieu = defineModel<string>('lieu', { required: true })
</script>
