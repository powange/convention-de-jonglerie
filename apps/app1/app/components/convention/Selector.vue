<template>
  <div v-if="props.conventions.length > 1" class="mb-6">
    <USelectMenu
      :model-value="props.modelValue"
      :items="conventionOptions"
      value-key="value"
      icon="i-heroicons-building-library"
      :placeholder="t('forms.placeholders.select_convention')"
      :search-input="rechercheProposee"
      class="w-full max-w-md"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
interface ConventionItem {
  id: number
  name: string
  _count?: { editions: number }
  editions?: any[]
}

interface Props {
  conventions: ConventionItem[]
  modelValue: number | null
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const { t } = useI18n()

/**
 * Au-delà de ce nombre de conventions, la liste ne se parcourt plus d'un coup d'œil.
 *
 * En dessous, le champ de recherche coûterait plus qu'il ne rapporte : il ouvre le clavier
 * virtuel sur téléphone pour quatre entrées déjà toutes visibles.
 */
const SEUIL_DE_RECHERCHE = 4

/**
 * Ce que `USelectMenu` attend : un objet pour afficher la recherche, `false` pour la masquer.
 * La propriété vaut `true` par défaut — sans cette valeur explicite, le champ apparaîtrait dès
 * deux conventions.
 */
const rechercheProposee = computed(() =>
  props.conventions.length > SEUIL_DE_RECHERCHE ? { placeholder: t('common.search') } : false
)

const getEditionsCount = (c: ConventionItem) => c._count?.editions ?? c.editions?.length ?? 0

const conventionOptions = computed(() =>
  props.conventions.map((c) => ({
    label: `${c.name} (${getEditionsCount(c)} ${t('conventions.editions').toLowerCase()})`,
    value: c.id,
  }))
)
</script>
