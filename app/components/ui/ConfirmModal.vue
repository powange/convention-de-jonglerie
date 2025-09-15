<template>
  <UModal v-model:open="isOpen">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon :name="iconName" :class="iconColor" />
        <span class="font-semibold">{{ computedTitle }}</span>
      </div>
    </template>

    <template #body>
      <p class="text-gray-700 dark:text-gray-300">
        {{ computedDescription }}
      </p>
    </template>

    <template #footer>
      <div class="flex gap-3 w-full">
        <UButton
          :color="cancelColor"
          :variant="cancelVariant"
          class="flex-1"
          @click="$emit('cancel')"
        >
          {{ computedCancelLabel }}
        </UButton>
        <UButton
          :color="confirmColor"
          :variant="confirmVariant"
          :icon="confirmIcon"
          :loading="loading"
          class="flex-1"
          @click="$emit('confirm')"
        >
          {{ computedConfirmLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
  confirmVariant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  confirmIcon?: string
  cancelColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
  cancelVariant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  iconName?: string
  iconColor?: string
  loading?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm' | 'cancel'): void
}

const { t } = useI18n()

const props = withDefaults(defineProps<Props>(), {
  confirmColor: 'primary',
  confirmVariant: 'solid',
  cancelColor: 'neutral',
  cancelVariant: 'ghost',
  iconName: 'i-heroicons-exclamation-triangle',
  iconColor: 'text-orange-500',
  loading: false,
})

// Valeurs par défaut avec i18n
const computedTitle = computed(() => props.title || t('common.confirmation'))
const computedDescription = computed(() => props.description || t('common.are_you_sure'))
const computedConfirmLabel = computed(() => props.confirmLabel || t('common.confirm'))
const computedCancelLabel = computed(() => props.cancelLabel || t('common.cancel'))

const emit = defineEmits<Emits>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>
