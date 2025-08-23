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

import ConventionForm from '~/components/convention/ConventionForm.vue'
import { useAuthStore } from '~/stores/auth'
import type { ConventionFormData, HttpError } from '~/types'

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected',
})

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const loading = ref(false)

const handleAddConvention = async (formData: ConventionFormData) => {
  if (!authStore.user) {
    toast.add({
      title: t('errors.authentication_error'),
      description: t('errors.login_required_convention'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
    return
  }

  loading.value = true

  try {
    // Créer la convention (l'upload d'image se fait automatiquement via ImageUpload)
    const convention = await $fetch('/api/conventions', {
      method: 'POST',
      body: formData,
    })

    toast.add({
      title: t('messages.convention_created'),
      description: t('messages.convention_created_desc', { name: convention.name }),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Rediriger vers la page des conventions de l'utilisateur
    router.push('/my-conventions')
  } catch (error: unknown) {
    console.error('Error creating convention:', error)

    const httpError = error as HttpError
    const errorMessage =
      httpError.data?.message || httpError.message || t('errors.convention_creation_error')

    toast.add({
      title: t('errors.creation_error'),
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.back()
}
</script>
