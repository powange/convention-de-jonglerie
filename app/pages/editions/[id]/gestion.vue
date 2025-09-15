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
        <UCard v-if="hasManagementActions">
          <div class="space-y-4">
            <h2 class="text-lg font-semibold">{{ $t('common.actions') }}</h2>
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
                v-if="canEdit && edition.isOnline"
                :icon="'i-heroicons-eye-slash'"
                color="secondary"
                variant="soft"
                @click="toggleOnlineStatus(false)"
              >
                {{ $t('editions.set_offline') }}
              </UButton>
              <UButton
                v-else-if="canEdit && !edition.isOnline"
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
                <h2 class="text-lg font-semibold">{{ $t('editions.lost_found') }}</h2>
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
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-users" class="text-primary-500" />
                  <h2 class="text-lg font-semibold">
                    {{ $t('pages.management.volunteer_management') }}
                  </h2>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-xs ml-7">
                  <UBadge :color="volunteersOpenLocal ? 'success' : 'neutral'" variant="soft">
                    {{
                      volunteersOpenLocal
                        ? $t('common.active') || 'Actif'
                        : $t('common.inactive') || 'Inactif'
                    }}
                    ·
                    {{
                      volunteersModeLocal === 'EXTERNAL'
                        ? t('editions.volunteers.mode_external') || 'Externe'
                        : t('editions.volunteers.mode_internal') || 'Interne'
                    }}
                  </UBadge>
                  <span v-if="volunteersUpdatedAt" class="text-gray-500 dark:text-gray-400">
                    {{
                      $t('common.updated_at', { date: formatRelative(volunteersUpdatedAt) }) ||
                      formatRelative(volunteersUpdatedAt)
                    }}
                  </span>
                </div>
              </div>
              <div v-if="canEdit || canManageVolunteers" class="flex items-center gap-3">
                <USwitch
                  v-model="volunteersOpenLocal"
                  :disabled="savingVolunteers"
                  color="primary"
                  @update:model-value="handleToggleOpen"
                />
                <span
                  :class="
                    volunteersOpenLocal
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  "
                >
                  {{
                    volunteersOpenLocal
                      ? $t('editions.volunteers.open')
                      : $t('editions.volunteers.closed_message')
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
                <UFormField
                  :label="t('editions.volunteers.description_label')"
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
                      <p class="text-gray-500">{{ t('editions.volunteers.no_description') }}</p>
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

              <!-- Mode de gestion -->
              <div class="space-y-2">
                <h3 class="font-semibold text-gray-700 dark:text-gray-300">
                  {{ t('editions.volunteers.mode_label') }}
                </h3>

                <UFormField>
                  <URadioGroup
                    v-model="volunteersModeLocal"
                    :items="volunteerModeItems"
                    size="lg"
                    class="flex flex-col gap-1"
                    :disabled="!(canEdit || canManageVolunteers)"
                    @update:model-value="handleChangeMode"
                  />
                </UFormField>
              </div>

              <!-- Options spécifiques au mode externe -->
              <div v-if="(canEdit || canManageVolunteers) && volunteersModeLocal === 'EXTERNAL'">
                <div v-if="canEdit" class="mt-4 mb-2">
                  <h3 class="font-semibold text-gray-700 dark:text-gray-300">
                    {{ t('editions.external_mode_options') }}
                  </h3>
                </div>

                <!-- Lien externe -->
                <div class="pl-1">
                  <UFormField
                    :label="t('editions.volunteers.external_url_label')"
                    :error="fieldErrors.externalUrl"
                  >
                    <UInput
                      v-model="volunteersExternalUrlLocal"
                      :placeholder="'https://...'"
                      :disabled="!(canEdit || canManageVolunteers)"
                      class="w-full"
                      @blur="(canEdit || canManageVolunteers) && persistVolunteerSettings()"
                      @keydown.enter.prevent="
                        (canEdit || canManageVolunteers) && persistVolunteerSettings()
                      "
                    />
                  </UFormField>
                  <p class="text-[11px] text-gray-500">
                    {{
                      t('editions.volunteers.external_url_hint') ||
                      'Lien vers votre formulaire ou outil externe.'
                    }}
                  </p>
                </div>
              </div>

              <!-- Options spécifiques au mode interne -->
              <div v-if="(canEdit || canManageVolunteers) && volunteersModeLocal === 'INTERNAL'">
                <UCard variant="soft">
                  <EditionVolunteerInternalModeOptions
                    :edition-id="editionId"
                    :initial-data="volunteersInternalData"
                    :edition-start-date="edition?.startDate"
                    :edition-end-date="edition?.endDate"
                    @updated="handleVolunteerInternalOptionsUpdated"
                  />
                </UCard>
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
import { type DateValue, fromDate, toCalendarDate } from '@internationalized/date'
import { onMounted, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EditionHeader from '~/components/edition/EditionHeader.vue'
// Auto-imported: EditionVolunteerInternalModeOptions
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

// Données pour le composant des options internes
const volunteersInternalData = computed(() => {
  if (!edition.value) return {}
  return {
    setupStartDate: edition.value.volunteersSetupStartDate
      ? fromDate(new Date(edition.value.volunteersSetupStartDate), 'UTC')
      : null,
    teardownEndDate: edition.value.volunteersTeardownEndDate
      ? fromDate(new Date(edition.value.volunteersTeardownEndDate), 'UTC')
      : null,
    askSetup: edition.value.volunteersAskSetup,
    askTeardown: edition.value.volunteersAskTeardown,
    askDiet: edition.value.volunteersAskDiet,
    askAllergies: edition.value.volunteersAskAllergies,
    askPets: edition.value.volunteersAskPets,
    askMinors: edition.value.volunteersAskMinors,
    askVehicle: edition.value.volunteersAskVehicle,
    askCompanion: edition.value.volunteersAskCompanion,
    askAvoidList: edition.value.volunteersAskAvoidList,
    askSkills: edition.value.volunteersAskSkills,
    askExperience: edition.value.volunteersAskExperience,
    askTimePreferences: edition.value.volunteersAskTimePreferences,
    askTeamPreferences: edition.value.volunteersAskTeamPreferences,
    teams: edition.value.volunteersTeams || [],
  }
})

// Gestion des erreurs de validation par champ
const fieldErrors = ref<Record<string, string>>({})

// Fonction pour effacer l'erreur d'un champ spécifique
const clearFieldError = (fieldName: string) => {
  if (fieldErrors.value[fieldName]) {
    const newErrors = { ...fieldErrors.value }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete newErrors[fieldName]
    fieldErrors.value = newErrors
  }
}

const volunteersOpenLocal = ref(false)
const volunteersModeLocal = ref<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
const volunteersExternalUrlLocal = ref('')
const volunteersDescriptionLocal = ref('')
const volunteersDescriptionOriginal = ref('')
const volunteersDescriptionHtml = ref('')
const volunteersAskDietLocal = ref(false)
const volunteersAskAllergiesLocal = ref(false)
const volunteersAskTimePreferencesLocal = ref(false)
const volunteersAskTeamPreferencesLocal = ref(false)
const volunteersAskPetsLocal = ref(false)
const volunteersAskMinorsLocal = ref(false)
const volunteersAskVehicleLocal = ref(false)
const volunteersAskCompanionLocal = ref(false)
const volunteersAskAvoidListLocal = ref(false)
const volunteersAskSkillsLocal = ref(false)
const volunteersAskExperienceLocal = ref(false)
const volunteersSetupStartDateLocal = ref<DateValue | null>(null)
const volunteersTeardownEndDateLocal = ref<DateValue | null>(null)
const volunteersAskSetupLocal = ref(false)
const volunteersAskTeardownLocal = ref(false)
const volunteersTeamsLocal = ref<{ name: string; slots?: number }[]>([])
const volunteersUpdatedAt = ref<Date | null>(null)
const savingVolunteers = ref(false)
// Éviter d'envoyer des PATCH à l'initialisation quand on applique les valeurs serveur
const volunteersInitialized = ref(false)
// Nuxt UI URadioGroup utilise la prop `items` (pas `options`)
const volunteerModeItems = computed(() => [
  { value: 'INTERNAL', label: t('editions.volunteers.mode_internal') || 'Interne' },
  { value: 'EXTERNAL', label: t('editions.volunteers.mode_external') || 'Externe' },
])

const volunteersDescriptionDirty = computed(
  () => volunteersDescriptionLocal.value !== volunteersDescriptionOriginal.value
)
const remainingVolunteerDescriptionChars = computed(
  () => `${volunteersDescriptionLocal.value.length}`
)

// Watchers pour effacer les erreurs quand les champs sont modifiés
watch(volunteersDescriptionLocal, () => clearFieldError('description'))
watch(volunteersExternalUrlLocal, () => clearFieldError('externalUrl'))

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
  volunteersAskTimePreferencesLocal.value = !!src.volunteersAskTimePreferences
  volunteersAskTeamPreferencesLocal.value = !!src.volunteersAskTeamPreferences
  volunteersAskPetsLocal.value = !!src.volunteersAskPets
  volunteersAskMinorsLocal.value = !!src.volunteersAskMinors
  volunteersAskVehicleLocal.value = !!src.volunteersAskVehicle
  volunteersAskCompanionLocal.value = !!src.volunteersAskCompanion
  volunteersAskAvoidListLocal.value = !!src.volunteersAskAvoidList
  volunteersAskSkillsLocal.value = !!src.volunteersAskSkills
  volunteersAskExperienceLocal.value = !!src.volunteersAskExperience
  volunteersSetupStartDateLocal.value = src.volunteersSetupStartDate
    ? fromDate(new Date(src.volunteersSetupStartDate), 'UTC')
    : null
  volunteersTeardownEndDateLocal.value = src.volunteersTeardownEndDate
    ? fromDate(new Date(src.volunteersTeardownEndDate), 'UTC')
    : null
  volunteersAskSetupLocal.value = !!src.volunteersAskSetup
  volunteersAskTeardownLocal.value = !!src.volunteersAskTeardown
  volunteersTeamsLocal.value = src.volunteersTeams
    ? JSON.parse(JSON.stringify(src.volunteersTeams))
    : []
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

const persistVolunteerSettings = async (options: { skipRefetch?: boolean } = {}) => {
  if (!edition.value) return
  savingVolunteers.value = true

  try {
    const body: any = {
      mode: volunteersModeLocal.value,
      description: volunteersDescriptionLocal.value.trim() || null,
      askDiet: volunteersAskDietLocal.value,
      askAllergies: volunteersAskAllergiesLocal.value,
      askTimePreferences: volunteersAskTimePreferencesLocal.value,
      askTeamPreferences: volunteersAskTeamPreferencesLocal.value,
      askPets: volunteersAskPetsLocal.value,
      askMinors: volunteersAskMinorsLocal.value,
      askVehicle: volunteersAskVehicleLocal.value,
      askCompanion: volunteersAskCompanionLocal.value,
      askAvoidList: volunteersAskAvoidListLocal.value,
      askSkills: volunteersAskSkillsLocal.value,
      askExperience: volunteersAskExperienceLocal.value,
      setupStartDate: volunteersSetupStartDateLocal.value
        ? new Date(toCalendarDate(volunteersSetupStartDateLocal.value).toString()).toISOString()
        : null,
      setupEndDate: volunteersTeardownEndDateLocal.value
        ? new Date(toCalendarDate(volunteersTeardownEndDateLocal.value).toString()).toISOString()
        : null,
      askSetup: volunteersAskSetupLocal.value,
      askTeardown: volunteersAskTeardownLocal.value,
      teams: volunteersTeamsLocal.value.filter((team) => team.name.trim()),
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

      // Mettre à jour directement les données locales au lieu de re-fetch complet
      if (!options.skipRefetch && edition.value) {
        // Mettre à jour seulement les champs bénévoles dans le store local
        Object.assign(edition.value, {
          volunteersMode: res.settings.volunteersMode,
          volunteersDescription: res.settings.volunteersDescription,
          volunteersAskDiet: res.settings.volunteersAskDiet,
          volunteersAskAllergies: res.settings.volunteersAskAllergies,
          volunteersAskTimePreferences: res.settings.volunteersAskTimePreferences,
          volunteersAskTeamPreferences: res.settings.volunteersAskTeamPreferences,
          volunteersAskPets: res.settings.volunteersAskPets,
          volunteersAskMinors: res.settings.volunteersAskMinors,
          volunteersAskVehicle: res.settings.volunteersAskVehicle,
          volunteersAskCompanion: res.settings.volunteersAskCompanion,
          volunteersAskAvoidList: res.settings.volunteersAskAvoidList,
          volunteersAskSkills: res.settings.volunteersAskSkills,
          volunteersAskExperience: res.settings.volunteersAskExperience,
          volunteersTeams: res.settings.volunteersTeams,
          volunteersUpdatedAt: res.settings.volunteersUpdatedAt,
        })
      }
      toast.add({
        title: t('common.saved') || 'Sauvegardé',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (e: any) {
    // Gérer les erreurs de validation par champ
    if (e?.data?.data?.errors) {
      fieldErrors.value = e.data.data.errors
      toast.add({
        title: e.data.data.message || 'Erreurs de validation',
        description: 'Veuillez corriger les erreurs dans le formulaire',
        color: 'error',
        icon: 'i-heroicons-x-circle',
      })
    } else {
      // Erreur générale
      fieldErrors.value = {}
      toast.add({
        title: e?.data?.statusMessage || e?.statusMessage || t('common.error'),
        color: 'error',
        icon: 'i-heroicons-x-circle',
      })
    }
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

// Gestionnaire pour les mises à jour du composant des options internes
const handleVolunteerInternalOptionsUpdated = async (settings: any) => {
  // Mettre à jour les données locales avec les nouvelles valeurs du serveur
  if (edition.value) {
    Object.assign(edition.value, settings)
    volunteersUpdatedAt.value = new Date()
  }
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
  return (
    canEdit.value || canManageVolunteers.value || authStore.user?.id === edition.value?.creatorId
  )
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

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Vérifier s'il y a des actions de gestion disponibles
const hasManagementActions = computed(() => {
  return canEdit.value || canDelete.value
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
