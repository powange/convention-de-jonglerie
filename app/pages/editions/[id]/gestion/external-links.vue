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
        <h1 class="text-2xl font-bold">{{ $t('gestion.external_links.title') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.external_links.description') }}
        </p>
      </div>

      <!-- Formulaire -->
      <div class="space-y-6">
        <!-- Section Billetterie -->
        <div class="space-y-4">
          <div class="border-b border-gray-200 dark:border-gray-700 pb-2">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ $t('components.edition_form.ticketing_section_title') }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('components.edition_form.ticketing_section_description') }}
            </p>
          </div>
          <UFormField
            :label="$t('components.edition_form.official_website_link')"
            name="officialWebsiteUrl"
          >
            <UInput
              v-model="officialWebsiteUrl"
              type="url"
              placeholder="https://www.mon-site-officiel.org"
              class="w-full"
              @blur="officialWebsiteUrl = officialWebsiteUrl?.trim() || ''"
            >
              <template #leading>
                <UIcon name="i-heroicons-globe-alt" />
              </template>
            </UInput>
          </UFormField>
          <UFormField :label="$t('components.edition_form.ticketing_link')" name="ticketingUrl">
            <UInput
              v-model="ticketingUrl"
              type="url"
              placeholder="https://billetterie.com/ma-convention"
              class="w-full"
              @blur="ticketingUrl = ticketingUrl?.trim() || ''"
            >
              <template #leading>
                <UIcon name="i-heroicons-ticket" />
              </template>
            </UInput>
          </UFormField>
        </div>

        <!-- Section Réseaux sociaux -->
        <div class="space-y-4">
          <div class="border-b border-gray-200 dark:border-gray-700 pb-2">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ $t('components.edition_form.social_networks_title') }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('components.edition_form.social_networks_description') }}
            </p>
          </div>
          <div class="space-y-4">
            <UFormField :label="$t('components.edition_form.facebook_page')" name="facebookUrl">
              <UInput
                v-model="facebookUrl"
                type="url"
                placeholder="https://facebook.com/ma-convention"
                class="w-full"
                @blur="facebookUrl = facebookUrl?.trim() || ''"
              >
                <template #leading>
                  <UIcon name="i-simple-icons-facebook" class="text-blue-600" />
                </template>
              </UInput>
            </UFormField>
            <UFormField
              :label="$t('components.edition_form.instagram_account')"
              name="instagramUrl"
            >
              <UInput
                v-model="instagramUrl"
                type="url"
                placeholder="https://instagram.com/ma-convention"
                class="w-full"
                @blur="instagramUrl = instagramUrl?.trim() || ''"
              >
                <template #leading>
                  <UIcon name="i-simple-icons-instagram" class="text-pink-600" />
                </template>
              </UInput>
            </UFormField>
          </div>
        </div>
      </div>

      <!-- Bouton enregistrer -->
      <div class="flex justify-end">
        <UButton
          icon="i-lucide-save"
          :label="$t('gestion.external_links.save')"
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

// État local
const officialWebsiteUrl = ref('')
const ticketingUrl = ref('')
const facebookUrl = ref('')
const instagramUrl = ref('')

// Synchroniser les valeurs avec l'édition chargée
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      officialWebsiteUrl.value = newEdition.officialWebsiteUrl || ''
      ticketingUrl.value = newEdition.ticketingUrl || ''
      facebookUrl.value = newEdition.facebookUrl || ''
      instagramUrl.value = newEdition.instagramUrl || ''
    }
  },
  { immediate: true }
)

// Sauvegarde
const { execute: save, loading: saving } = useApiAction(() => `/api/editions/${editionId.value}`, {
  method: 'PUT',
  body: () => ({
    officialWebsiteUrl: officialWebsiteUrl.value?.trim() || null,
    ticketingUrl: ticketingUrl.value?.trim() || null,
    facebookUrl: facebookUrl.value?.trim() || null,
    instagramUrl: instagramUrl.value?.trim() || null,
  }),
  successMessage: { title: t('gestion.external_links.save_success') },
  errorMessages: { default: t('gestion.external_links.save_error') },
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
