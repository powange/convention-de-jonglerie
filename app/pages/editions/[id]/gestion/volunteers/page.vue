<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <EditionHeader :edition="edition" current-page="gestion" />

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon
            name="i-heroicons-clipboard-document-list"
            class="text-indigo-600 dark:text-indigo-400"
          />
          {{ $t('editions.volunteers.volunteer_page') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('editions.volunteers.page_description') }}
        </p>
      </div>

      <!-- Contenu de la page bénévolat -->
      <div class="space-y-6">
        <!-- Description pour les bénévoles -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="text-blue-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('editions.volunteers.volunteer_description_title') }}
              </h2>
            </div>

            <UAlert
              icon="i-heroicons-information-circle"
              color="info"
              variant="soft"
              :description="$t('editions.volunteers.volunteer_description_help')"
            />

            <!-- Description des bénévoles (Markdown) -->
            <div class="space-y-2">
              <UFormField
                :label="$t('common.description')"
                class="w-full"
                :error="fieldErrors.description"
              >
                <div v-if="canEdit || canManageVolunteers" class="space-y-2">
                  <MinimalMarkdownEditor
                    v-model="volunteersDescriptionLocal"
                    :preview="true"
                    :disabled="savingVolunteers || !(canEdit || canManageVolunteers)"
                  />
                </div>
                <div v-else class="prose dark:prose-invert max-w-none text-sm">
                  <template v-if="volunteersDescriptionHtml">
                    <!-- HTML déjà sanitizé via utils/markdown (rehype-sanitize) -->
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div v-html="volunteersDescriptionHtml" />
                  </template>
                  <template v-else>
                    <p class="text-gray-500">{{ $t('editions.volunteers.no_description') }}</p>
                  </template>
                </div>
              </UFormField>
              <div
                v-if="canEdit || canManageVolunteers"
                class="flex items-center justify-between text-[11px] text-gray-500"
              >
                <span>{{ remainingVolunteerDescriptionChars }} / 5000</span>
                <div v-if="volunteersDescriptionDirty" class="flex gap-2">
                  <UButton
                    size="xs"
                    variant="ghost"
                    :disabled="savingVolunteers"
                    @click="resetVolunteerDescription"
                  >
                    {{ t('common.cancel') }}
                  </UButton>
                  <UButton
                    size="xs"
                    color="primary"
                    :loading="savingVolunteers"
                    :disabled="volunteersDescriptionLocal.length > 5000"
                    @click="saveVolunteerDescription"
                  >
                    {{ t('common.save') }}
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { markdownToHtml } from '~/utils/markdown'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Gestion des erreurs de validation par champ
const fieldErrors = ref<Record<string, string>>({})

// Variables pour la description des bénévoles
const volunteersDescriptionLocal = ref('')
const volunteersDescriptionOriginal = ref('')
const volunteersDescriptionHtml = ref('')
const savingVolunteers = ref(false)

const volunteersDescriptionDirty = computed(
  () => volunteersDescriptionLocal.value !== volunteersDescriptionOriginal.value
)
const remainingVolunteerDescriptionChars = computed(
  () => `${volunteersDescriptionLocal.value.length}`
)

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return (
    canEdit.value || canManageVolunteers.value || authStore.user?.id === edition.value?.creatorId
  )
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Fonctions pour la gestion de la description
const saveVolunteerDescription = async () => {
  if (volunteersDescriptionLocal.value.length > 5000) return

  if (!edition.value) return

  savingVolunteers.value = true
  try {
    const res: any = await $fetch(`/api/editions/${edition.value.id}/volunteers/settings`, {
      method: 'PATCH',
      body: { description: volunteersDescriptionLocal.value.trim() || null },
    })

    if (res?.settings) {
      volunteersDescriptionOriginal.value = volunteersDescriptionLocal.value
      toast.add({
        title: t('common.saved') || 'Sauvegardé',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (e: any) {
    toast.add({
      title: e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    savingVolunteers.value = false
  }
}

const resetVolunteerDescription = () => {
  volunteersDescriptionLocal.value = volunteersDescriptionOriginal.value
  renderVolunteerDescriptionHtml()
}

const renderVolunteerDescriptionHtml = async () => {
  if (!volunteersDescriptionLocal.value) {
    volunteersDescriptionHtml.value = ''
    return
  }
  try {
    volunteersDescriptionHtml.value = await markdownToHtml(volunteersDescriptionLocal.value)
  } catch {
    volunteersDescriptionHtml.value = ''
  }
}

const applyEditionVolunteerFields = (src: any) => {
  volunteersDescriptionLocal.value = src.volunteersDescription || ''
  volunteersDescriptionOriginal.value = volunteersDescriptionLocal.value
  renderVolunteerDescriptionHtml()
}

// Watchers
watch(volunteersDescriptionLocal, () => {
  renderVolunteerDescriptionHtml()
})

watch(edition, (val) => {
  if (val) {
    applyEditionVolunteerFields(val as any)
  }
})

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  if (edition.value) {
    applyEditionVolunteerFields(edition.value as any)
  }
})

// Métadonnées de la page
useSeoMeta({
  title: 'Page bénévolat - ' + (edition.value?.name || 'Édition'),
  description: 'Page de gestion du bénévolat pour cette édition',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
