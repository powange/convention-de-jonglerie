<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('conventions.features_card_title')"
    :description="$t('conventions.features_card_subtitle')"
  >
    <template #body>
      <div class="p-4">
        <ConventionsFeaturesContent variant="modal" />
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex justify-end gap-3">
        <UButton color="neutral" variant="outline" :label="$t('common.close')" @click="close" />
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          :label="$t('conventions.create_first_convention')"
          to="/conventions/add"
          @click="close"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>
