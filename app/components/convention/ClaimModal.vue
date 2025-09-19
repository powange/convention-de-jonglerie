<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('conventions.claim.modal_title')"
    close-icon="i-heroicons-x-mark-20-solid"
  >
    <UButton
      color="warning"
      variant="soft"
      size="sm"
      icon="i-heroicons-hand-raised"
      class="flex-shrink-0"
      @click="isOpen = true"
    >
      {{ $t('conventions.claim.button_short') }}
    </UButton>

    <template #body>
      <div class="p-4">
        <!-- Étape 1: Confirmation et envoi du code -->
        <div v-if="step === 'confirm'" class="space-y-4">
          <div class="text-center">
            <UIcon name="i-heroicons-building-library" class="mx-auto h-12 w-12 text-blue-500" />
            <h4 class="mt-2 text-lg font-medium text-gray-900 dark:text-white">
              {{ convention.name }}
            </h4>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {{ $t('conventions.claim.confirm_message') }}
            </p>
          </div>

          <UAlert color="info" variant="soft" :ui="{ description: 'text-sm' }">
            <template #title>{{ $t('conventions.claim.info_title') }}</template>
            <template #description>
              {{ $t('conventions.claim.info_description', { email: convention.email }) }}
            </template>
          </UAlert>

          <UAlert
            v-if="hasExistingRequest"
            color="warning"
            variant="soft"
            :ui="{ description: 'text-sm' }"
          >
            <template #title>{{ $t('conventions.claim.existing_request_title') }}</template>
            <template #description>
              {{ $t('conventions.claim.existing_request_description') }}
            </template>
          </UAlert>

          <div class="flex justify-end gap-3">
            <UButton color="neutral" variant="soft" @click="isOpen = false">
              {{ $t('common.cancel') }}
            </UButton>
            <UButton color="primary" :loading="loading" @click="sendClaimCode">
              {{
                hasExistingRequest
                  ? $t('conventions.claim.resend_code')
                  : $t('conventions.claim.send_code')
              }}
            </UButton>
          </div>
        </div>

        <!-- Étape 2: Saisie du code -->
        <div v-else-if="step === 'verify'" class="space-y-4">
          <div class="text-center">
            <UIcon name="i-heroicons-envelope" class="mx-auto h-12 w-12 text-green-500" />
            <h4 class="mt-2 text-lg font-medium text-gray-900 dark:text-white">
              {{ $t('conventions.claim.code_sent') }}
            </h4>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {{ $t('conventions.claim.code_sent_message', { email: convention.email }) }}
            </p>
          </div>

          <UFormGroup :label="$t('conventions.claim.verification_code')" required>
            <div class="flex justify-center">
              <UPinInput v-model="verificationCode" :length="6" placeholder="0" size="lg" />
            </div>
          </UFormGroup>

          <div v-if="codeExpiry" class="text-center text-sm text-gray-500">
            {{ $t('conventions.claim.expires_at', { time: formatTime(codeExpiry) }) }}
          </div>

          <div class="flex justify-end gap-3">
            <UButton color="neutral" variant="soft" @click="step = 'confirm'">
              {{ $t('common.back') }}
            </UButton>
            <UButton
              color="primary"
              :loading="loading"
              :disabled="verificationCode.length !== 6"
              @click="verifyCode"
            >
              {{ $t('conventions.claim.verify') }}
            </UButton>
          </div>
        </div>

        <!-- Étape 3: Succès -->
        <div v-else-if="step === 'success'" class="space-y-4">
          <div class="text-center">
            <UIcon name="i-heroicons-check-circle" class="mx-auto h-12 w-12 text-green-500" />
            <h4 class="mt-2 text-lg font-medium text-gray-900 dark:text-white">
              {{ $t('conventions.claim.success_title') }}
            </h4>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {{ $t('conventions.claim.success_message', { name: convention.name }) }}
            </p>
          </div>

          <div class="flex justify-center">
            <UButton color="primary" @click="handleSuccess">
              {{ $t('common.continue') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Convention {
  id: number
  name: string
  email?: string
}

interface Props {
  convention: Convention
}

interface Emits {
  (e: 'claimed'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const { $fetch } = useNuxtApp()

const isOpen = ref(false)

const step = ref<'confirm' | 'verify' | 'success'>('confirm')
const loading = ref(false)
const verificationCode = ref('')
const codeExpiry = ref<Date | null>(null)
const hasExistingRequest = ref(false)

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const sendClaimCode = async () => {
  try {
    loading.value = true
    const response = await $fetch(`/api/conventions/${props.convention.id}/claim`, {
      method: 'POST',
    })

    codeExpiry.value = new Date(response.expiresAt)
    step.value = 'verify'
    hasExistingRequest.value = false

    useToast().add({
      title: t('conventions.claim.code_sent_toast'),
      description: t('conventions.claim.code_sent_toast_description'),
      color: 'success',
    })
  } catch (error: any) {
    // Si c'est une erreur de demande existante, on active le flag
    if (error?.data?.message?.includes('déjà en cours')) {
      hasExistingRequest.value = true
    }

    useToast().add({
      title: t('common.error'),
      description: error?.data?.message || t('conventions.claim.error_sending_code'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const verifyCode = async () => {
  try {
    loading.value = true
    await $fetch(`/api/conventions/${props.convention.id}/claim/verify`, {
      method: 'POST',
      body: {
        code: verificationCode.value,
      },
    })

    step.value = 'success'

    useToast().add({
      title: t('conventions.claim.verification_success'),
      description: t('conventions.claim.verification_success_description'),
      color: 'success',
    })
  } catch (error: any) {
    useToast().add({
      title: t('common.error'),
      description: error?.data?.message || t('conventions.claim.error_verifying_code'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const handleSuccess = () => {
  emit('claimed')
  isOpen.value = false
}

// Réinitialiser lors de l'ouverture
watch(isOpen, (newValue) => {
  if (newValue) {
    step.value = 'confirm'
    verificationCode.value = ''
    codeExpiry.value = null
    loading.value = false
    hasExistingRequest.value = false
  }
})
</script>
