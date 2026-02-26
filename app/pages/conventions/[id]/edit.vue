<template>
  <div class="max-w-4xl mx-auto">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-pencil" class="text-warning-500" size="24" />
          <h1 class="text-2xl font-bold">{{ $t('conventions.edit') }}</h1>
        </div>
        <p v-if="convention" class="text-gray-600 mt-2">
          {{ $t('pages.edit_convention.editing_convention', { name: convention.name }) }}
        </p>
      </template>

      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto mb-4" size="24" />
        <p>{{ $t('pages.edit_convention.loading_convention_data') }}</p>
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
          {{ $t('pages.edit_convention.convention_not_found_or_no_rights') }}
        </p>
        <UButton icon="i-heroicons-arrow-left" variant="outline" @click="router.back()">
          {{ $t('common.back') }}
        </UButton>
      </div>

      <ConventionForm
        v-else
        :initial-data="convention"
        :submit-button-text="$t('pages.edit_convention.submit_button')"
        :loading="updating"
        @submit="handleUpdateConvention"
        @cancel="handleCancel"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { Convention } from '~/types'

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected',
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const conventionId = parseInt(route.params.id as string)
const convention = ref<Convention | null>(null)
const loading = ref(true)
const pendingFormData = ref<Record<string, unknown> | null>(null)

onMounted(async () => {
  // La protection est gérée côté serveur par session et par middleware 'auth-protected'.

  try {
    convention.value = await $fetch(`/api/conventions/${conventionId}`)

    // Vérifier droits : admin global en mode admin, auteur ou organisateur avec droit editConvention
    const isAuthor = convention.value?.authorId && convention.value.authorId === authStore.user?.id
    const hasEditRight = convention.value?.organizers?.some(
      (collab) => collab.user.id === authStore.user?.id && collab.rights?.editConvention
    )
    const isAdminMode = authStore.isAdminModeActive

    if (!isAuthor && !hasEditRight && !isAdminMode) {
      throw {
        status: 403,
        message: "Vous n'avez pas les droits pour modifier cette convention",
      }
    }
  } catch (error: unknown) {
    console.error('Erreur lors du chargement de la convention:', error)

    const errorStatus =
      error && typeof error === 'object' && 'status' in error ? error.status : null

    if (errorStatus === 404) {
      toast.add({
        title: t('conventions.convention_not_found'),
        description: t('conventions.convention_not_found_description'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      })
    } else if (errorStatus === 403) {
      toast.add({
        title: t('pages.access_denied.title'),
        description: t('errors.convention_edit_denied'),
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

const { execute: executeUpdate, loading: updating } = useApiAction(
  `/api/conventions/${conventionId}`,
  {
    method: 'PUT',
    body: () => pendingFormData.value,
    silentSuccess: true,
    errorMessages: { default: t('errors.convention_update_error') },
    onSuccess: (result: Convention & { name: string }) => {
      convention.value = result
      toast.add({
        title: t('messages.convention_updated'),
        description: t('messages.convention_updated_desc', { name: result.name }),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      navigateTo('/my-conventions')
    },
  }
)

const handleUpdateConvention = (
  formData: Omit<Convention, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'author'>
) => {
  pendingFormData.value = formData
  executeUpdate()
}

const handleCancel = () => {
  router.back()
}
</script>
