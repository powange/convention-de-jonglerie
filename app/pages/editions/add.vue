<template>
  <div class="max-w-6xl mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">{{ $t('pages.add_edition.title') }}</h1>
      </template>
      <EditionEditionForm
        :submit-button-text="$t('pages.add_edition.submit_button')"
        :loading="editionStore.loading"
        :initial-data="initialData"
        @submit="handleAddEdition"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useEditionStore } from '~/stores/editions'
import type { Edition } from '~/types'

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected',
})

const editionStore = useEditionStore()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

// Pré-remplir avec la convention si passée en paramètre
const initialData = computed(() => {
  const conventionId = route.query.conventionId
  if (conventionId) {
    return {
      conventionId: parseInt(conventionId as string),
    }
  }
  return undefined
})

const handleAddEdition = async (formData: Edition) => {
  try {
    await editionStore.addEdition(formData)
    toast.add({
      title: t('messages.edition_created'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    router.push('/')
  } catch (e: unknown) {
    toast.add({
      title: e.statusMessage || t('errors.edition_creation_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}
</script>
