<template>
  <div class="max-w-4xl mx-auto">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-building-library" class="text-primary-500" size="24" />
          <h1 class="text-2xl font-bold">{{ $t('pages.add_convention.title') }}</h1>
        </div>
        <p class="text-gray-600 mt-2">
          {{ $t('pages.add_convention.description') }}
        </p>
      </template>

      <ConventionForm
        :submit-button-text="$t('pages.add_convention.submit_button')"
        :loading="loading"
        @submit="handleAddConvention"
        @cancel="handleCancel"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import type { ConventionFormData } from '~/types'

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected',
})

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

// Stockage temporaire des données du formulaire pour useApiAction
const pendingFormData = ref<ConventionFormData | null>(null)

// Action pour créer une convention
const { execute: executeCreate, loading } = useApiAction<ConventionFormData, { name: string }>(
  '/api/conventions',
  {
    method: 'POST',
    body: () => pendingFormData.value!,
    errorMessages: { default: t('errors.convention_creation_error') },
    silentSuccess: true, // On gère le toast manuellement pour avoir le nom
    onSuccess: (convention) => {
      toast.add({
        title: t('messages.convention_created'),
        description: t('messages.convention_created_desc', { name: convention.name }),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      router.push('/my-conventions')
    },
  }
)

const handleAddConvention = (formData: ConventionFormData) => {
  if (!authStore.user) {
    toast.add({
      title: t('errors.authentication_error'),
      description: t('errors.login_required_convention'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
    return
  }
  pendingFormData.value = formData
  executeCreate()
}

const handleCancel = () => {
  router.back()
}
</script>
