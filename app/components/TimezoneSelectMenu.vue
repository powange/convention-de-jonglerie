<template>
  <USelectMenu
    v-model="model"
    v-model:search-term="search"
    :items="items"
    :placeholder="placeholder ?? t('forms.placeholders.select_timezone')"
    value-key="value"
    ignore-filter
    :size="size"
    class="w-full"
    :ui="{ content: 'max-h-80' }"
  >
    <template #leading>
      <UIcon name="i-heroicons-globe-alt" class="text-gray-400" />
    </template>
    <template #item-label="{ item }">
      <div class="flex items-center gap-2">
        <span class="font-medium">{{ item.city }}</span>
        <span class="text-muted text-xs">{{ item.region }}</span>
        <span class="text-muted text-xs ml-auto">{{ item.offset }}</span>
      </div>
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
import { useTimezones } from '~/composables/useTimezones'

defineProps<{
  /** Texte affiché quand aucun fuseau n'est sélectionné (défaut : clé i18n select_timezone) */
  placeholder?: string
  /** Taille du USelectMenu */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>()

// Valeur du fuseau horaire (nom IANA, ex. "Europe/Paris")
const model = defineModel<string | null>()

const { t } = useI18n()
const { getSelectMenuItems } = useTimezones()

// Terme de recherche : le filtrage (suppression des groupes vides, tri par catégorie)
// est géré par le composable, d'où `ignore-filter` sur le USelectMenu.
const search = ref('')
const items = computed(() => getSelectMenuItems(search.value))
</script>
