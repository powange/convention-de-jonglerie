<template>
  <div v-if="edition">
    <EditionHeader :edition="edition" current-page="shows-call" />

    <div class="max-w-3xl mx-auto space-y-6">
      <!-- État de chargement -->
      <div v-if="loading" class="flex justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <!-- Erreur -->
      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
      >
        <template #title>
          {{ t('common.error') }}
        </template>
        <template #description>
          {{ error.message || t('shows_call.load_error') }}
        </template>
      </UAlert>

      <!-- Contenu de l'appel -->
      <template v-else-if="showCall">
        <!-- Carte principale -->
        <UCard variant="soft">
          <template #header>
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <UButton
                  icon="i-heroicons-arrow-left"
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  :to="`/editions/${editionId}/shows-call`"
                />
                <div>
                  <h1 class="text-xl font-bold">{{ showCall.name }}</h1>
                  <p class="text-sm text-gray-500">
                    {{ getEditionDisplayName(edition) }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <UBadge v-if="showCall.mode === 'EXTERNAL'" color="info" variant="soft" size="xs">
                  {{ t('gestion.shows_call.mode_external_badge') }}
                </UBadge>
                <UBadge
                  :color="
                    showCall.visibility === 'PUBLIC' || showCall.visibility === 'PRIVATE'
                      ? 'success'
                      : 'neutral'
                  "
                  variant="soft"
                  size="xs"
                >
                  {{
                    showCall.visibility === 'PUBLIC' || showCall.visibility === 'PRIVATE'
                      ? t('shows_call.open')
                      : t('shows_call.closed')
                  }}
                </UBadge>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <!-- Description -->
            <div v-if="descriptionHtml" class="prose prose-sm dark:prose-invert max-w-none">
              <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize) -->
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div v-html="descriptionHtml" />
            </div>

            <!-- Date limite -->
            <div v-if="showCall.deadline" class="flex items-center gap-2 text-sm">
              <UIcon name="i-heroicons-clock" class="text-gray-400" />
              <span class="text-gray-600 dark:text-gray-400">
                {{ t('shows_call.deadline') }} :
                <strong :class="isDeadlinePassed ? 'text-red-500' : ''">
                  {{ formatDate(showCall.deadline) }}
                </strong>
              </span>
            </div>

            <!-- Champs demandés -->
            <div class="flex flex-wrap gap-1">
              <UBadge v-if="showCall.askPortfolioUrl" color="neutral" variant="outline" size="xs">
                {{ t('gestion.shows_call.field_portfolio') }}
              </UBadge>
              <UBadge v-if="showCall.askVideoUrl" color="neutral" variant="outline" size="xs">
                {{ t('gestion.shows_call.field_video') }}
              </UBadge>
              <UBadge v-if="showCall.askTechnicalNeeds" color="neutral" variant="outline" size="xs">
                {{ t('gestion.shows_call.field_technical') }}
              </UBadge>
              <UBadge v-if="showCall.askAccommodation" color="neutral" variant="outline" size="xs">
                {{ t('gestion.shows_call.field_accommodation') }}
              </UBadge>
            </div>
          </div>
        </UCard>

        <!-- Messages d'alerte -->
        <UAlert
          v-if="!authStore.isAuthenticated"
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
        >
          <template #title>
            {{ t('shows_call.login_required') }}
          </template>
          <template #description>
            <div class="flex items-center gap-4">
              <span>{{ t('shows_call.login_required_desc') }}</span>
              <UButton
                color="primary"
                size="sm"
                icon="i-heroicons-arrow-right-on-rectangle"
                :to="`/login?redirect=/editions/${editionId}/shows-call/${showCallId}`"
              >
                {{ t('shows_call.login_button') }}
              </UButton>
            </div>
          </template>
        </UAlert>

        <UAlert
          v-else-if="!authStore.isArtist"
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="soft"
        >
          <template #title>
            {{ t('shows_call.artist_required') }}
          </template>
          <template #description>
            <div class="flex items-center gap-4">
              <span>{{ t('shows_call.artist_required_desc') }}</span>
              <UButton color="primary" size="sm" icon="i-heroicons-user-circle" to="/profile">
                {{ t('shows_call.update_profile') }}
              </UButton>
            </div>
          </template>
        </UAlert>

        <!-- Bouton d'action -->
        <div v-else>
          <!-- Mode externe -->
          <UButton
            v-if="
              showCall.mode === 'EXTERNAL' &&
              showCall.externalUrl &&
              (showCall.visibility === 'PUBLIC' || showCall.visibility === 'PRIVATE')
            "
            :to="showCall.externalUrl"
            target="_blank"
            color="primary"
            icon="i-heroicons-arrow-top-right-on-square"
            block
            size="lg"
          >
            {{ t('shows_call.apply_external') }}
          </UButton>

          <!-- Mode interne -->
          <UButton
            v-else-if="
              showCall.mode === 'INTERNAL' &&
              (showCall.visibility === 'PUBLIC' || showCall.visibility === 'PRIVATE') &&
              authStore.isArtist
            "
            :to="`/editions/${editionId}/shows-call/${showCallId}/apply`"
            color="primary"
            icon="i-heroicons-pencil-square"
            block
            size="lg"
            :disabled="isDeadlinePassed"
          >
            <template v-if="isDeadlinePassed">
              {{ t('shows_call.deadline_passed') }}
            </template>
            <template v-else>
              {{ t('shows_call.apply') }}
            </template>
          </UButton>

          <!-- Appel fermé -->
          <UButton
            v-else-if="showCall.visibility === 'CLOSED' || showCall.visibility === 'OFFLINE'"
            color="neutral"
            variant="soft"
            icon="i-heroicons-lock-closed"
            block
            size="lg"
            disabled
          >
            {{ t('shows_call.closed') }}
          </UButton>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Edition, EditionShowCallPublic } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'
import { markdownToHtml } from '~/utils/markdown'

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const { t } = useI18n()
const { formatDate } = useDateFormat()

const editionId = parseInt(route.params.id as string)
const showCallId = parseInt(route.params.showCallId as string)

// Charger l'édition
const {
  data: edition,
  pending: _editionLoading,
  error: _editionError,
} = await useFetch<Edition>(`/api/editions/${editionId}`)

// Synchroniser avec le store
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      editionStore.setEdition(newEdition)
    }
  },
  { immediate: true }
)

// Charger les détails de l'appel à spectacles
const {
  data: showCall,
  pending: loading,
  error,
} = await useFetch<EditionShowCallPublic>(
  `/api/editions/${editionId}/shows-call/${showCallId}/public`
)

const isDeadlinePassed = computed(() => {
  if (!showCall.value?.deadline) return false
  return new Date() > new Date(showCall.value.deadline)
})

// Rendu markdown de la description
const descriptionHtml = ref('')

async function renderDescription() {
  if (!showCall.value?.description) {
    descriptionHtml.value = ''
    return
  }
  try {
    descriptionHtml.value = await markdownToHtml(showCall.value.description)
  } catch {
    descriptionHtml.value = ''
  }
}

watch(() => showCall.value?.description, renderDescription, { immediate: true })

// SEO
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))
useSeoMeta({
  title: computed(() =>
    showCall.value ? `${showCall.value.name} - ${editionName.value}` : t('shows_call.title')
  ),
  description: computed(
    () =>
      showCall.value?.description || t('shows_call.seo_description', { name: editionName.value })
  ),
})
</script>
