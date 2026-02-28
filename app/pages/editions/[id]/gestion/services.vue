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
    <div v-else-if="!canEdit">
      <UAlert
        icon="i-lucide-shield-alert"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>

    <!-- Contenu principal -->
    <div v-else class="space-y-6">
      <!-- En-tête -->
      <div>
        <h1 class="text-2xl font-bold">{{ $t('gestion.services.title') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.services.description') }}
        </p>
      </div>

      <!-- Services par catégorie -->
      <div class="space-y-8">
        <div v-for="category in servicesByCategory" :key="category.category" class="space-y-4">
          <div class="border-b border-gray-200 dark:border-gray-700 pb-2">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ category.label }}
            </h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <UCheckbox
              v-for="service in category.services"
              :key="service.key"
              :model-value="serviceValues[service.key]"
              indicator="end"
              variant="card"
              @update:model-value="(val: boolean) => (serviceValues[service.key] = val)"
            >
              <template #label>
                <div class="flex items-center gap-2">
                  <UIcon :name="service.icon" :class="service.color" size="20" />
                  <span>{{ service.label }}</span>
                </div>
              </template>
            </UCheckbox>
          </div>
        </div>
      </div>

      <!-- Bouton enregistrer -->
      <div class="flex justify-end">
        <UButton
          icon="i-lucide-save"
          :label="$t('gestion.services.save')"
          :loading="saving"
          @click="save()"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const { t } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

const initialLoading = ref(true)

// Permissions
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// Services traduits par catégorie
const { getTranslatedServicesByCategory } = useTranslatedConventionServices()
const servicesByCategory = getTranslatedServicesByCategory

// État local des services (réactif)
const serviceValues = reactive<Record<string, boolean>>({})

// Synchroniser les valeurs avec l'édition chargée
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      for (const category of servicesByCategory.value) {
        for (const service of category.services) {
          serviceValues[service.key] = !!(newEdition as Record<string, any>)[service.key]
        }
      }
    }
  },
  { immediate: true }
)

// Sauvegarde
const { execute: save, loading: saving } = useApiAction(() => `/api/editions/${editionId.value}`, {
  method: 'PUT',
  body: () => ({ ...serviceValues }),
  successMessage: { title: t('gestion.services.save_success') },
  errorMessages: { default: t('gestion.services.save_error') },
  onSuccess: (response: any) => {
    if (response && edition.value) {
      editionStore.setEdition({ ...edition.value, ...response })
    }
  },
})

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
