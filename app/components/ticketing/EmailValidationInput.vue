<template>
  <div>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
      {{ $t('edition.ticketing.email') }}
    </p>
    <UInput
      :model-value="modelValue"
      type="email"
      :placeholder="$t('edition.ticketing.email')"
      icon="i-heroicons-envelope"
      size="sm"
      :color="emailValidation.isValid ? undefined : 'error'"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <p
      v-if="emailValidation.message"
      class="text-xs mt-1"
      :class="{
        'text-green-600 dark:text-green-400': emailValidation.isValid && !emailValidation.checking,
        'text-red-600 dark:text-red-400': !emailValidation.isValid && !emailValidation.checking,
        'text-gray-500 dark:text-gray-400': emailValidation.checking,
      }"
    >
      {{ emailValidation.message }}
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string | null
  originalEmail?: string | null
  userId?: number | null
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()

// Validation de l'email en temps réel
const emailValidation = ref<{
  checking: boolean
  isValid: boolean
  message: string
}>({
  checking: false,
  isValid: true,
  message: '',
})

// Exposer l'état de validation pour le parent
defineExpose({
  emailValidation,
})

// Debounce pour la vérification d'email
let emailCheckTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.modelValue,
  async (newEmail) => {
    // Réinitialiser le timeout précédent
    if (emailCheckTimeout) {
      clearTimeout(emailCheckTimeout)
    }

    // Réinitialiser la validation si l'email est vide ou identique à l'original
    if (!newEmail || !newEmail.trim()) {
      emailValidation.value = { checking: false, isValid: true, message: '' }
      return
    }

    // Vérifier si l'email a changé par rapport à l'original
    if (newEmail === props.originalEmail) {
      emailValidation.value = { checking: false, isValid: true, message: '' }
      return
    }

    // Vérifier le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      emailValidation.value = {
        checking: false,
        isValid: false,
        message: "Format d'email invalide",
      }
      return
    }

    // Attendre 500ms avant de vérifier (debounce)
    emailValidation.value = { checking: true, isValid: true, message: 'Vérification...' }

    emailCheckTimeout = setTimeout(async () => {
      try {
        const response = await $fetch('/api/auth/check-email', {
          method: 'POST',
          body: {
            email: newEmail,
            excludeUserIds: props.userId ? [props.userId] : [],
          },
        })

        if (response.exists) {
          emailValidation.value = {
            checking: false,
            isValid: false,
            message: 'Cet email est déjà utilisé par un autre utilisateur',
          }
        } else {
          emailValidation.value = {
            checking: false,
            isValid: true,
            message: 'Email disponible',
          }
        }
      } catch (error) {
        console.error("Erreur lors de la vérification de l'email:", error)
        emailValidation.value = {
          checking: false,
          isValid: false,
          message: 'Erreur lors de la vérification',
        }
      }
    }, 500)
  }
)
</script>
