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
      <EditionHeader
        :edition="edition"
        current-page="gestion"
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />

      <!-- Contenu de gestion -->
      <div class="space-y-6">
        <!-- Actions de gestion -->
        <UCard>
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">{{ $t('pages.management.actions') }}</h3>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="canEdit"
                icon="i-heroicons-pencil"
                color="warning"
                :to="`/editions/${edition.id}/edit`"
              >
                {{ $t('pages.management.edit_edition') }}
              </UButton>
              <UButton
                v-if="edition.isOnline"
                :icon="'i-heroicons-eye-slash'"
                color="secondary"
                variant="soft"
                @click="toggleOnlineStatus(false)"
              >
                {{ $t('editions.set_offline') }}
              </UButton>
              <UButton
                v-else
                :icon="'i-heroicons-globe-alt'"
                color="primary"
                @click="toggleOnlineStatus(true)"
              >
                {{ $t('editions.set_online') }}
              </UButton>
              <UButton
                v-if="canDelete"
                icon="i-heroicons-trash"
                color="error"
                variant="soft"
                @click="deleteEdition(edition.id)"
              >
                {{ $t('pages.management.delete_edition') }}
              </UButton>
            </div>
          </div>
        </UCard>
        <!-- Objets trouvés -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-magnifying-glass" class="text-amber-500" />
                <h3 class="text-lg font-semibold">{{ $t('editions.lost_found') }}</h3>
              </div>
              <UButton
                v-if="hasEditionStarted"
                size="sm"
                color="primary"
                variant="soft"
                icon="i-heroicons-arrow-right"
                :to="`/editions/${edition.id}/objets-trouves`"
              >
                {{ $t('pages.management.manage') }}
              </UButton>
            </div>

            <div v-if="!hasEditionStarted">
              <UAlert
                :title="t('editions.lost_found_before_start')"
                :description="t('editions.items_appear_when_started')"
                icon="i-heroicons-clock"
                color="warning"
                variant="subtle"
              />
            </div>

            <div v-else>
              <UAlert
                :title="t('pages.management.manage_lost_found')"
                :description="t('pages.management.lost_found_active_description')"
                icon="i-heroicons-magnifying-glass"
                color="info"
                variant="subtle"
              />
            </div>
          </div>
        </UCard>

        <!-- Gestion des bénévoles -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-users" class="text-primary-500" />
                <h3 class="text-lg font-semibold">
                  {{ $t('pages.management.volunteer_management') }}
                </h3>
              </div>
              <div v-if="canEdit" class="flex items-center gap-3">
                <USwitch
                  v-model="volunteersOpenLocal"
                  :disabled="savingVolunteers"
                  color="primary"
                  @update:model-value="handleToggleOpen"
                />
                <span
                  class="text-sm"
                  :class="
                    volunteersOpenLocal
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  "
                >
                  {{
                    volunteersOpenLocal
                      ? $t('editions.volunteers_open') || 'Ouvert'
                      : $t('editions.volunteers_closed_message') || 'Fermé'
                  }}
                </span>
              </div>
            </div>
            <div class="space-y-3">
              <UAlert
                icon="i-heroicons-information-circle"
                color="info"
                variant="soft"
                :description="
                  $t('pages.management.volunteer_description_active') ||
                  $t('pages.management.volunteer_description')
                "
              />
              <!-- Description des bénévoles (Markdown) -->
              <div class="space-y-2">
                <UFormField :label="t('editions.volunteers_description_label')" class="w-full">
                  <div v-if="canEdit" class="space-y-2">
                    <MinimalMarkdownEditor
                      v-model="volunteersDescriptionLocal"
                      :preview="true"
                      :disabled="savingVolunteers || !canEdit"
                    />
                  </div>
                  <div v-else class="prose dark:prose-invert max-w-none text-sm">
                    <template v-if="volunteersDescriptionHtml">
                      <!-- HTML déjà sanitizé via utils/markdown (rehype-sanitize) -->
                      <!-- eslint-disable-next-line vue/no-v-html -->
                      <div v-html="volunteersDescriptionHtml" />
                    </template>
                    <template v-else>
                      <p class="text-gray-500">{{ t('editions.volunteers_no_description') }}</p>
                    </template>
                  </div>
                </UFormField>
                <div
                  v-if="canEdit"
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
              <div class="space-y-2">
                <UFormField :label="t('editions.volunteers_mode_label') || 'Mode de gestion'">
                  <URadioGroup
                    v-model="volunteersModeLocal"
                    :items="volunteerModeItems"
                    size="sm"
                    class="flex flex-col gap-1"
                    :disabled="!canEdit"
                    @update:model-value="handleChangeMode"
                  />
                </UFormField>
                <div v-if="volunteersModeLocal === 'EXTERNAL'" class="pl-1">
                  <UFormField :label="t('editions.volunteers_external_url_label') || 'URL externe'">
                    <UInput
                      v-model="volunteersExternalUrlLocal"
                      :placeholder="'https://...'"
                      :disabled="!canEdit"
                      class="w-full"
                      @blur="canEdit && persistVolunteerSettings()"
                      @keydown.enter.prevent="canEdit && persistVolunteerSettings()"
                    />
                  </UFormField>
                  <p class="text-[11px] text-gray-500">
                    {{
                      t('editions.volunteers_external_url_hint') ||
                      'Lien vers votre formulaire ou outil externe.'
                    }}
                  </p>
                </div>
                <!-- Switch demander régime alimentaire (mode interne uniquement) -->
                <div
                  v-if="canEdit && volunteersModeLocal === 'INTERNAL'"
                  class="flex items-center gap-3 pt-1"
                >
                  <USwitch
                    v-model="volunteersAskDietLocal"
                    :disabled="savingVolunteers"
                    color="primary"
                    @update:model-value="persistVolunteerSettings"
                  />
                  <span class="text-sm">{{ t('editions.volunteers_ask_diet_label') }}</span>
                </div>
                <div
                  v-if="canEdit && volunteersModeLocal === 'INTERNAL'"
                  class="flex items-center gap-3 pt-1"
                >
                  <USwitch
                    v-model="volunteersAskAllergiesLocal"
                    :disabled="savingVolunteers"
                    color="primary"
                    @update:model-value="persistVolunteerSettings"
                  />
                  <span class="text-sm">{{ t('editions.volunteers_ask_allergies_label') }}</span>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <UBadge :color="volunteersOpenLocal ? 'success' : 'neutral'" variant="soft">
                  {{
                    volunteersOpenLocal
                      ? $t('common.active') || 'Actif'
                      : $t('common.inactive') || 'Inactif'
                  }}
                  ·
                  {{
                    volunteersModeLocal === 'EXTERNAL'
                      ? t('editions.volunteers_mode_external') || 'Externe'
                      : t('editions.volunteers_mode_internal') || 'Interne'
                  }}
                </UBadge>
                <span v-if="volunteersUpdatedAt" class="text-gray-500 dark:text-gray-400">
                  {{
                    $t('common.updated_at', { date: formatRelative(volunteersUpdatedAt) }) ||
                    formatRelative(volunteersUpdatedAt)
                  }}
                </span>
              </div>
              <div v-if="canEdit" class="flex gap-2">
                <span v-if="savingVolunteers" class="text-xs text-gray-500 flex items-center gap-1">
                  <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
                  {{ $t('common.saving') || 'Enregistrement...' }}
                </span>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EditionHeader from '~/components/edition/EditionHeader.vue'
import MinimalMarkdownEditor from '~/components/MinimalMarkdownEditor.vue'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { markdownToHtml } from '~/utils/markdown'

// TODO: Ajouter le middleware d'authentification plus tard
// definePageMeta({
//   middleware: 'auth-protected'
// });

const route = useRoute()
const editionStore = useEditionStore()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))
const volunteersOpenLocal = ref(false)
const volunteersModeLocal = ref<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
const volunteersExternalUrlLocal = ref('')
const volunteersDescriptionLocal = ref('')
const volunteersDescriptionOriginal = ref('')
const volunteersDescriptionHtml = ref('')
const volunteersAskDietLocal = ref(false)
const volunteersAskAllergiesLocal = ref(false)
const volunteersUpdatedAt = ref<Date | null>(null)
const savingVolunteers = ref(false)
// Éviter d'envoyer des PATCH à l'initialisation quand on applique les valeurs serveur
const volunteersInitialized = ref(false)
// Nuxt UI URadioGroup utilise la prop `items` (pas `options`)
const volunteerModeItems = computed(() => [
  { value: 'INTERNAL', label: t('editions.volunteers_mode_internal') || 'Interne' },
  { value: 'EXTERNAL', label: t('editions.volunteers_mode_external') || 'Externe' },
])

const volunteersDescriptionDirty = computed(
  () => volunteersDescriptionLocal.value !== volunteersDescriptionOriginal.value
)
const remainingVolunteerDescriptionChars = computed(
  () => `${volunteersDescriptionLocal.value.length}`
)

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  if (edition.value) applyEditionVolunteerFields(edition.value as any)
})

watch(edition, (val) => {
  if (val) {
    applyEditionVolunteerFields(val as any)
  }
})

function applyEditionVolunteerFields(src: any) {
  volunteersOpenLocal.value = !!src.volunteersOpen
  volunteersModeLocal.value = src.volunteersMode || 'INTERNAL'
  volunteersExternalUrlLocal.value = src.volunteersExternalUrl || ''
  volunteersDescriptionLocal.value = src.volunteersDescription || ''
  volunteersAskDietLocal.value = !!src.volunteersAskDiet
  volunteersAskAllergiesLocal.value = !!src.volunteersAskAllergies
  volunteersDescriptionOriginal.value = volunteersDescriptionLocal.value
  renderVolunteerDescriptionHtml()
  const vu = src.volunteersUpdatedAt
  volunteersUpdatedAt.value = vu ? new Date(vu) : null
  // marquer initialisation terminée (prochain changement utilisateur déclenchera watchers)
  volunteersInitialized.value = true
}

// Handlers explicites pour éviter double PATCH au chargement
const handleToggleOpen = async (val: boolean) => {
  if (!edition.value || !volunteersInitialized.value) return
  savingVolunteers.value = true
  const previous = !val
  try {
    const res: any = await $fetch(`/api/editions/${edition.value.id}/volunteers/settings`, {
      method: 'PATCH' as any,
      body: { open: val },
    })
    if (res?.settings) {
      volunteersUpdatedAt.value = new Date()
      await editionStore.fetchEditionById(editionId, { force: true })
      toast.add({
        title: t('common.saved') || 'Sauvegardé',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (e: any) {
    volunteersOpenLocal.value = previous
    toast.add({
      title: e?.statusMessage || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    savingVolunteers.value = false
  }
}

const handleChangeMode = async (_raw: any) => {
  if (!edition.value || !volunteersInitialized.value) return
  // éviter PATCH si pas de changement réel (comparaison avec valeur locale précédente déjà mise à jour par v-model)
  // volunteersModeLocal contient déjà la nouvelle valeur; si description/URL pas modifiée inutile ? On laisse sauvegarde car le mode change effectivement côté serveur.
  await persistVolunteerSettings()
}

const persistVolunteerSettings = async () => {
  if (!edition.value) return
  savingVolunteers.value = true
  try {
    const body: any = {
      mode: volunteersModeLocal.value,
      description: volunteersDescriptionLocal.value.trim() || null,
      askDiet: volunteersAskDietLocal.value,
      askAllergies: volunteersAskAllergiesLocal.value,
    }
    if (volunteersModeLocal.value === 'EXTERNAL')
      body.externalUrl = volunteersExternalUrlLocal.value.trim() || null
    const res: any = await $fetch(`/api/editions/${edition.value.id}/volunteers/settings`, {
      method: 'PATCH' as any,
      body,
    })
    if (res?.settings) {
      volunteersUpdatedAt.value = new Date()
      volunteersDescriptionOriginal.value = volunteersDescriptionLocal.value
      await editionStore.fetchEditionById(editionId, { force: true })
      toast.add({
        title: t('common.saved') || 'Sauvegardé',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (e: any) {
    toast.add({
      title: e?.statusMessage || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    savingVolunteers.value = false
  }
}

const saveVolunteerDescription = async () => {
  // validation simple longueur côté client
  if (volunteersDescriptionLocal.value.length > 5000) return
  await persistVolunteerSettings()
}

const resetVolunteerDescription = () => {
  volunteersDescriptionLocal.value = volunteersDescriptionOriginal.value
  renderVolunteerDescriptionHtml()
}

const formatRelative = (date: Date) => {
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

async function renderVolunteerDescriptionHtml() {
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

watch(volunteersDescriptionLocal, () => {
  renderVolunteerDescriptionHtml()
})

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return canEdit.value || authStore.user?.id === edition.value?.creatorId
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canDelete = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canDeleteEdition(edition.value, authStore.user.id)
})

// Début d'édition
const hasEditionStarted = computed(() => {
  if (!edition.value) return false
  return new Date() >= new Date(edition.value.startDate)
})

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy.some((u) => u.id === authStore.user?.id)
})

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
    toast.add({
      title: t('messages.favorite_status_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: e?.statusMessage || t('errors.favorite_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const deleteEdition = async (id: number) => {
  if (confirm(t('pages.access_denied.confirm_delete_edition'))) {
    try {
      await editionStore.deleteEdition(id)
      toast.add({
        title: t('messages.edition_deleted'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      router.push('/')
    } catch (e: any) {
      toast.add({
        title: e?.statusMessage || t('errors.edition_deletion_failed'),
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  }
}

const toggleOnlineStatus = async (isOnline: boolean) => {
  if (!edition.value) return

  try {
    await $fetch(`/api/editions/${edition.value.id}/status`, {
      method: 'PATCH',
      body: { isOnline },
    })

    // Update local state
    await editionStore.fetchEditionById(editionId)

    const message = isOnline ? t('editions.edition_published') : t('editions.edition_set_offline')
    toast.add({
      title: message,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error) {
    console.error('Failed to toggle edition status:', error)
    toast.add({
      title: t('errors.status_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}
</script>
