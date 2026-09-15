<template>
  <div>
    <div class="flex items-center justify-between gap-3">
      <h4 class="font-medium">{{ titre }}</h4>
      <UButton
        icon="i-heroicons-pencil"
        color="neutral"
        variant="ghost"
        :title="libelleEdition"
        @click="emit('editer')"
      />
    </div>
    <p class="text-sm text-dimmed">{{ aide }}</p>

    <div v-if="loading" class="text-center py-4">
      <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 text-gray-400 animate-spin" />
    </div>
    <div v-else-if="quotas.length" class="flex flex-wrap gap-1 mt-2">
      <UBadge v-for="quota in quotas" :key="quota.id" color="warning" variant="subtle">
        {{ quota.title }}
      </UBadge>
    </div>
    <span v-else class="text-dimmed">
      {{ $t('gestion.ticketing.assign_quotas_none') }}
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * La ligne « ce qui vaut pour tout le monde », commune aux trois familles de personnes.
 *
 * Organisateurs, bénévoles et artistes ont chacun leur bloc global, et les trois disent la même
 * chose de la même façon : un titre, une phrase d'explication, un bouton, puis les quotas en
 * étiquettes. Trois copies auraient fini par diverger — c'est le motif qui revient le plus
 * souvent dans ce dépôt, et celui qu'on cherche à ne plus reproduire.
 *
 * Le bloc n'est pas une liste : une ligne globale n'a pas d'éléments à énumérer, elle vise « tous
 * ceux de cette famille ». D'où un composant distinct de `QuotaAssociationList`, qui, lui, rend
 * une ligne par cible nommée.
 */
defineProps<{
  titre: string
  aide: string
  libelleEdition: string
  quotas: Array<{ id: number; title: string }>
  loading: boolean
}>()

const emit = defineEmits<{ editer: [] }>()
</script>
