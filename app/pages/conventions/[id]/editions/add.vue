<template>
  <div class="max-w-6xl mx-auto">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-calendar-days" class="text-primary-500" size="24" />
          <h1 class="text-2xl font-bold">{{ $t('pages.add_edition.title') }}</h1>
        </div>
        <p v-if="convention" class="text-gray-600 mt-2">
          {{ $t('pages.add_edition_for_convention.for_convention', { name: convention.name }) }}
        </p>
      </template>

      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto mb-4" size="24" />
        <p>{{ $t('pages.add_edition_for_convention.loading_convention') }}</p>
      </div>

      <div v-else-if="!convention" class="text-center py-8">
        <UIcon
          name="i-heroicons-exclamation-triangle"
          class="mx-auto mb-4 text-error-500"
          size="24"
        />
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          {{ $t('conventions.convention_not_found') }}
        </h3>
        <p class="text-gray-500 mb-4">
          {{ $t('pages.add_edition_for_convention.convention_not_found_description') }}
        </p>
        <UButton icon="i-heroicons-arrow-left" variant="outline" @click="router.back()">
          {{ $t('common.back') }}
        </UButton>
      </div>

      <EditionForm
        v-else
        :initial-data="{ conventionId: convention.id }"
        :submit-button-text="$t('pages.add_edition_for_convention.submit_button')"
        :loading="submitting"
        @submit="handleAddEdition"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Convention, EditionFormData, HttpError } from '~/types'

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected',
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const toast = useToast()
const { t } = useI18n()

const conventionId = parseInt(route.params.id as string)
const convention = ref<Convention | null>(null)
const loading = ref(true)
const submitting = ref(false)

onMounted(async () => {
  try {
    convention.value = await $fetch(`/api/conventions/${conventionId}`)

    // Vérifier que l'utilisateur est l'auteur de la convention
    if (convention.value.authorId !== authStore.user?.id) {
      throw {
        status: 403,
        message: t('errors.edition_add_denied'),
      }
    }
  } catch (error: unknown) {
    console.error('Erreur lors du chargement de la convention:', error)

    const httpError = error as HttpError
    if (httpError.status === 404) {
      toast.add({
        title: t('conventions.convention_not_found'),
        description: t('conventions.convention_not_found_description'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      })
    } else if (httpError.status === 403) {
      toast.add({
        title: t('pages.access_denied.title'),
        description: t('errors.edition_add_denied'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      })
    } else {
      toast.add({
        title: t('errors.loading_error'),
        description: t('errors.cannot_load_convention'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      })
    }
  } finally {
    loading.value = false
  }
})

const handleAddEdition = async (data: EditionFormData) => {
  submitting.value = true

  try {
    await editionStore.addEdition(data)

    toast.add({
      title: t('messages.edition_created'),
      description: t('messages.edition_created_successfully'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Rediriger vers la page des conventions de l'utilisateur
    router.push('/my-conventions')
  } catch (error: unknown) {
    console.error('Error creating edition:', error)

    const httpError = error as HttpError
    const errorMessage =
      httpError.data?.message || httpError.message || t('errors.edition_creation_error')

    toast.add({
      title: t('errors.creation_error'),
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    submitting.value = false
  }
}
</script>
