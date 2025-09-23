<template>
  <UModal v-model:open="isOpen">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon :name="iconName" :class="iconColor" />
        <span class="font-semibold">{{ computedTitle }}</span>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <p class="text-gray-700 dark:text-gray-300">
          {{ computedDescription }}
        </p>

        <!-- Champ de validation par nom -->
        <div v-if="requireNameConfirmation" class="space-y-2">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('common.type_to_confirm', { name: expectedName }) }}
          </p>
          <UFormField>
            <UInput
              v-model="nameInput"
              :placeholder="computedNamePlaceholder"
              :color="isNameValid ? 'primary' : 'error'"
              class="w-full"
              autofocus
            />
          </UFormField>
        </div>
      </div>
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
          :disabled="requireNameConfirmation && !isNameValid"
          class="flex-1"
          @click="handleConfirm"
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
  // Validation par nom
  requireNameConfirmation?: boolean
  expectedName?: string
  nameConfirmationPlaceholder?: string
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
  requireNameConfirmation: false,
})

// Valeurs par défaut avec i18n
const computedTitle = computed(() => props.title || t('common.confirmation'))
const computedDescription = computed(() => props.description || t('common.are_you_sure'))
const computedConfirmLabel = computed(() => props.confirmLabel || t('common.confirm'))
const computedCancelLabel = computed(() => props.cancelLabel || t('common.cancel'))
const computedNamePlaceholder = computed(
  () => props.nameConfirmationPlaceholder || t('common.type_name_to_confirm')
)

// État pour la validation par nom
const nameInput = ref('')
const isNameValid = computed(() => {
  if (!props.requireNameConfirmation) return true
  return nameInput.value.trim() === props.expectedName?.trim()
})

const emit = defineEmits<Emits>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
    // Réinitialiser la saisie quand on ferme le modal
    if (!value) {
      nameInput.value = ''
    }
  },
})

// Gestion de la confirmation avec validation
const handleConfirm = () => {
  if (props.requireNameConfirmation && !isNameValid.value) {
    return
  }
  emit('confirm')
}
</script>
