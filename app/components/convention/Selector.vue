<template>
  <div v-if="props.conventions.length > 1" class="mb-6">
    <USelect
      :model-value="props.modelValue"
      :items="conventionOptions"
      value-key="value"
      icon="i-heroicons-building-library"
      :placeholder="t('forms.placeholders.select_convention')"
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

const getEditionsCount = (c: ConventionItem) => c._count?.editions ?? c.editions?.length ?? 0

const conventionOptions = computed(() =>
  props.conventions.map((c) => ({
    label: `${c.name} (${getEditionsCount(c)} ${t('conventions.editions').toLowerCase()})`,
    value: c.id,
  }))
)
</script>
