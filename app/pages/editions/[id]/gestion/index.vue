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

        <!-- Gestion bénévole -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user-group" class="text-primary-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('editions.volunteers.volunteer_management') }}
              </h2>
            </div>

            <!-- Mode de gestion des bénévoles -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {{ $t('editions.volunteers.management_mode') }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Choisissez comment gérer les bénévoles pour cette édition
                  </p>
                </div>
                <UBadge
                  :color="volunteersModeLocal === 'INTERNAL' ? 'primary' : 'orange'"
                  variant="soft"
                  size="sm"
                >
                  {{ volunteersModeLocal === 'INTERNAL' ? 'Interne' : 'Externe' }}
                </UBadge>
              </div>

              <UFormField>
                <URadioGroup
                  v-model="volunteersModeLocal"
                  :items="volunteerModeItems"
                  size="lg"
                  class="flex flex-row gap-6"
                  :disabled="!(canEdit || canManageVolunteers)"
                  @update:model-value="handleChangeMode"
                />
              </UFormField>

              <!-- Lien externe pour mode externe -->
              <div v-if="volunteersModeLocal === 'EXTERNAL'" class="pt-2">
                <UFormField
                  :label="$t('editions.volunteers.external_link')"
                  :error="fieldErrors.externalUrl"
                >
                  <UInput
                    v-model="volunteersExternalUrlLocal"
                    :placeholder="$t('editions.volunteers.external_url_placeholder')"
                    :disabled="!(canEdit || canManageVolunteers)"
                    class="w-full"
                    @blur="(canEdit || canManageVolunteers) && persistVolunteerSettings()"
                    @keydown.enter.prevent="
                      (canEdit || canManageVolunteers) && persistVolunteerSettings()
                    "
                  />
                </UFormField>
                <p class="text-xs text-gray-500 mt-1">
                  Lien vers votre formulaire ou outil externe de gestion des bénévoles
                </p>
              </div>
            </div>

            <!-- Ouverture des candidatures -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    Ouverture des candidatures
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Activez ou désactivez les candidatures de bénévoles
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge :color="volunteersOpenLocal ? 'success' : 'neutral'" variant="soft">
                    {{
                      volunteersOpenLocal
                        ? $t('common.active') || 'Actif'
                        : $t('common.inactive') || 'Inactif'
                    }}
                  </UBadge>
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

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Page bénévoles -->
              <NuxtLink :to="`/editions/${edition.id}/gestion/volunteers/page`" class="block">
                <UCard
                  class="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <UIcon
                          name="i-heroicons-clipboard-document-list"
                          class="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                        />
                      </div>
                      <div>
                        <h3 class="font-medium">{{ $t('editions.volunteers.volunteer_page') }}</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                          {{ $t('editions.volunteers.page_description') }}
                        </p>
                      </div>
                    </div>
                    <UIcon name="i-heroicons-arrow-right" class="h-4 w-4 text-gray-400" />
                  </div>
                </UCard>
              </NuxtLink>

              <!-- Liens visibles uniquement en mode interne -->
              <template v-if="volunteersModeLocal === 'INTERNAL'">
                <!-- Formulaire d'appel à bénévole -->
                <NuxtLink :to="`/editions/${edition.id}/gestion/volunteers/form`" class="block">
                  <UCard
                    class="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <UIcon
                            name="i-heroicons-megaphone"
                            class="h-5 w-5 text-blue-600 dark:text-blue-400"
                          />
                        </div>
                        <div>
                          <h3 class="font-medium">
                            {{ $t('editions.volunteers.volunteer_form') }}
                          </h3>
                          <p class="text-sm text-gray-600 dark:text-gray-400">
                            {{ $t('editions.volunteers.form_description') }}
                          </p>
                        </div>
                      </div>
                      <UIcon name="i-heroicons-arrow-right" class="h-4 w-4 text-gray-400" />
                    </div>
                  </UCard>
                </NuxtLink>

                <!-- Gestion des candidatures -->
                <NuxtLink
                  :to="`/editions/${edition.id}/gestion/volunteers/applications`"
                  class="block"
                >
                  <UCard
                    class="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <UIcon
                            name="i-heroicons-document-text"
                            class="h-5 w-5 text-green-600 dark:text-green-400"
                          />
                        </div>
                        <div>
                          <h3 class="font-medium">
                            {{ $t('editions.volunteers.application_management') }}
                          </h3>
                          <p class="text-sm text-gray-600 dark:text-gray-400">
                            Consulter et traiter les candidatures
                          </p>
                        </div>
                      </div>
                      <UIcon name="i-heroicons-arrow-right" class="h-4 w-4 text-gray-400" />
                    </div>
                  </UCard>
                </NuxtLink>

                <!-- Les équipes -->
                <NuxtLink :to="`/editions/${edition.id}/gestion/volunteers/teams`" class="block">
                  <UCard
                    class="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <UIcon
                            name="i-heroicons-user-group"
                            class="h-5 w-5 text-purple-600 dark:text-purple-400"
                          />
                        </div>
                        <div>
                          <h3 class="font-medium">{{ $t('editions.volunteers.teams') }}</h3>
                          <p class="text-sm text-gray-600 dark:text-gray-400">
                            Organiser les équipes de bénévoles
                          </p>
                        </div>
                      </div>
                      <UIcon name="i-heroicons-arrow-right" class="h-4 w-4 text-gray-400" />
                    </div>
                  </UCard>
                </NuxtLink>

                <!-- Planning -->
                <NuxtLink :to="`/editions/${edition.id}/gestion/volunteers/planning`" class="block">
                  <UCard
                    class="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                          <UIcon
                            name="i-heroicons-calendar-days"
                            class="h-5 w-5 text-orange-600 dark:text-orange-400"
                          />
                        </div>
                        <div>
                          <h3 class="font-medium">{{ $t('editions.volunteers.planning') }}</h3>
                          <p class="text-sm text-gray-600 dark:text-gray-400">
                            Planifier les créneaux et missions
                          </p>
                        </div>
                      </div>
                      <UIcon name="i-heroicons-arrow-right" class="h-4 w-4 text-gray-400" />
                    </div>
                  </UCard>
                </NuxtLink>

                <!-- Notifications bénévoles -->
                <NuxtLink
                  :to="`/editions/${edition.id}/gestion/volunteers/notifications`"
                  class="block"
                >
                  <UCard
                    class="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                          <UIcon
                            name="i-heroicons-bell"
                            class="h-5 w-5 text-yellow-600 dark:text-yellow-400"
                          />
                        </div>
                        <div>
                          <h3 class="font-medium">
                            {{ $t('editions.volunteers.volunteer_notifications') }}
                          </h3>
                          <p class="text-sm text-gray-600 dark:text-gray-400">
                            Envoyer des notifications aux bénévoles
                          </p>
                        </div>
                      </div>
                      <UIcon name="i-heroicons-arrow-right" class="h-4 w-4 text-gray-400" />
                    </div>
                  </UCard>
                </NuxtLink>

                <!-- Outils de gestion -->
                <NuxtLink :to="`/editions/${edition.id}/gestion/volunteers/tools`" class="block">
                  <UCard
                    class="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="p-2 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                          <UIcon
                            name="i-heroicons-wrench-screwdriver"
                            class="h-5 w-5 text-gray-600 dark:text-gray-400"
                          />
                        </div>
                        <div>
                          <h3 class="font-medium">
                            {{ $t('editions.volunteers.management_tools') }}
                          </h3>
                          <p class="text-sm text-gray-600 dark:text-gray-400">
                            Outils avancés et génération de documents
                          </p>
                        </div>
                      </div>
                      <UIcon name="i-heroicons-arrow-right" class="h-4 w-4 text-gray-400" />
                    </div>
                  </UCard>
                </NuxtLink>
              </template>
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

// Auto-imported: EditionVolunteerInternalModeOptions
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

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
const volunteersUpdatedAt = ref<Date | null>(null)
const savingVolunteers = ref(false)
// Éviter d'envoyer des PATCH à l'initialisation quand on applique les valeurs serveur
const volunteersInitialized = ref(false)
// Nuxt UI URadioGroup utilise la prop `items` (pas `options`)
const volunteerModeItems = computed(() => [
  { value: 'INTERNAL', label: t('editions.volunteers.mode_internal') || 'Interne' },
  { value: 'EXTERNAL', label: t('editions.volunteers.mode_external') || 'Externe' },
])

// Watchers pour effacer les erreurs quand les champs sont modifiés
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
    }
    if (volunteersModeLocal.value === 'EXTERNAL')
      body.externalUrl = volunteersExternalUrlLocal.value.trim() || null
    const res: any = await $fetch(`/api/editions/${edition.value.id}/volunteers/settings`, {
      method: 'PATCH' as any,
      body,
    })
    if (res?.settings) {
      volunteersUpdatedAt.value = new Date()

      // Mettre à jour directement les données locales au lieu de re-fetch complet
      if (!options.skipRefetch && edition.value) {
        // Mettre à jour seulement les champs bénévoles dans le store local
        Object.assign(edition.value, {
          volunteersMode: res.settings.volunteersMode,
          volunteersExternalUrl: res.settings.volunteersExternalUrl,
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
