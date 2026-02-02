<template>
  <div class="max-w-6xl mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">{{ $t('edition.edit') }}</h1>
      </template>
      <div v-if="editionStore.loading">
        <p>{{ $t('edition.loading_details') }}</p>
      </div>
      <div v-else-if="!edition">
        <p>{{ $t('edition.not_found') }}</p>
      </div>
      <EditionForm
        v-else
        :initial-data="edition"
        :submit-button-text="$t('pages.edit_edition.submit_button')"
        :loading="editionStore.loading"
        @submit="handleUpdateConvention"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Edition } from '~/types'

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected',
})

const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = ref(null)

onMounted(async () => {
  try {
    // Récupérer l'édition spécifique avec force: true pour avoir les données complètes
    // (notamment convention.organizers pour la vérification des permissions)
    const foundEdition = await editionStore.fetchEditionById(editionId, { force: true })

    // Vérifier que l'utilisateur peut modifier cette édition
    if (!editionStore.canEditEdition(foundEdition, authStore.user?.id || 0)) {
      toast.add({
        title: t('pages.access_denied.title'),
        description: t('errors.edition_edit_denied'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      })
      router.push('/')
      return
    }

    edition.value = foundEdition
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('edition.not_found'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
    router.push('/')
  }
})

const handleUpdateConvention = async (formData: Edition) => {
  try {
    await editionStore.updateEdition(editionId, formData)
    toast.add({
      title: t('messages.edition_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    router.push(`/editions/${editionId}`)
  } catch (e: unknown) {
    const err = e as { message?: string }
    toast.add({
      title: err?.message || t('errors.edition_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}
</script>
