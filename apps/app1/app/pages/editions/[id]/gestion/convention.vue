<template>
  <div>
    <!-- Loading initial -->
    <div v-if="initialLoading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <!-- Erreur : édition non trouvée -->
    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <!-- Erreur : accès refusé -->
    <div v-else-if="!canEditConvention || !convention">
      <UAlert
        icon="i-lucide-shield-alert"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('errors.convention_edit_denied')"
      />
    </div>

    <!-- Contenu principal -->
    <div v-else class="space-y-6">
      <!-- En-tête -->
      <div>
        <h1 class="text-2xl font-bold">{{ $t('gestion.convention.title') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.convention.description') }}
        </p>
      </div>

      <!-- Ces champs appartiennent à la convention, pas à l'édition : ils valent donc pour
           toutes ses éditions, passées comme à venir. Le dire évite la mauvaise surprise. -->
      <UAlert
        icon="i-lucide-info"
        color="info"
        variant="soft"
        :description="$t('gestion.convention.shared_notice', { name: convention?.name })"
      />

      <ConventionForm
        :initial-data="convention"
        :submit-button-text="$t('gestion.convention.submit')"
        :loading="saving"
        @submit="onSubmit"
        @cancel="navigateTo(`/editions/${editionId}/gestion`)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Convention } from '~/types'

definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const { t } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))
const convention = computed(() => edition.value?.convention)

const initialLoading = ref(true)

// Permissions : même règle que /conventions/:id/edit, et que le serveur applique de son côté.
const canEditConvention = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditConvention(edition.value, authStore.user.id)
})

const pendingFormData = ref<Record<string, unknown> | null>(null)

const { execute, loading: saving } = useApiAction(
  () => `/api/conventions/${convention.value?.id}`,
  {
    method: 'PUT',
    body: () => pendingFormData.value,
    successMessage: { title: t('gestion.convention.save_success') },
    errorMessages: { default: t('gestion.convention.save_error') },
    onSuccess: (updated: Convention) => {
      // Rafraîchir la convention portée par l'édition en mémoire : l'en-tête du tableau de bord
      // et le fil d'ariane affichent son nom et son logo.
      if (edition.value?.convention) {
        editionStore.setEdition({
          ...edition.value,
          convention: { ...edition.value.convention, ...updated },
        })
      }
    },
  }
)

const onSubmit = (
  formData: Omit<Convention, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'author'>
) => {
  pendingFormData.value = formData
  execute()
}

// Charger l'édition
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId.value, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  initialLoading.value = false
})
</script>
