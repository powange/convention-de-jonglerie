<template>
  <div v-if="edition">
    <EditionHeader
      :edition="edition"
      current-page="volunteers"
      :is-favorited="isFavorited(edition.id)"
      @toggle-favorite="toggleFavorite(edition.id)"
    />

    <UCard variant="soft" class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-hand-raised" class="text-primary-500" />
            {{ t('editions.volunteers.title') }}
          </h3>
          <div v-if="canManageEdition" class="flex items-center gap-2">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-heroicons-cog-6-tooth"
              :to="`/editions/${edition?.id}/gestion`"
            >
              {{ t('common.manage') || 'Gérer' }}
            </UButton>
          </div>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Candidature existante (affichée en premier si l'utilisateur a postulé) -->
        <div
          v-if="
            authStore.isAuthenticated &&
            volunteersMode === 'INTERNAL' &&
            volunteersInfo?.myApplication
          "
        >
          <UCard
            variant="subtle"
            class="border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold flex items-center gap-1">
                  <UIcon name="i-heroicons-user" class="text-primary-500" />
                  {{ t('editions.volunteers.my_application_title') }}
                </h4>
                <UBadge
                  :color="volunteerStatusColor(volunteersInfo.myApplication.status)"
                  variant="soft"
                  class="uppercase"
                >
                  {{ volunteerStatusLabel(volunteersInfo.myApplication.status) }}
                </UBadge>
              </div>
              <div class="text-xs space-y-1">
                <span
                  v-if="volunteersInfo.myApplication.status === 'PENDING'"
                  class="block text-gray-600 dark:text-gray-400"
                  >{{ t('editions.volunteers.my_application_pending') }}</span
                >
                <span
                  v-else-if="volunteersInfo.myApplication.status === 'ACCEPTED'"
                  class="block text-gray-600 dark:text-gray-400"
                  >{{ t('editions.volunteers.my_application_accepted') }}</span
                >
                <span
                  v-else-if="volunteersInfo.myApplication.status === 'REJECTED'"
                  class="block text-gray-600 dark:text-gray-400"
                  >{{ t('editions.volunteers.my_application_rejected') }}</span
                >
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UButton
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-list-bullet"
                  :to="'/my-volunteer-applications'"
                >
                  {{ t('editions.volunteers.view_all_applications') || 'Voir mes candidatures' }}
                </UButton>
                <UButton
                  v-if="volunteersInfo.myApplication.status === 'PENDING'"
                  size="xs"
                  color="error"
                  variant="soft"
                  :loading="volunteersWithdrawing"
                  @click="withdrawApplication"
                >
                  {{ t('editions.volunteers.withdraw') }}
                </UButton>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Description -->
        <div>
          <div class="prose dark:prose-invert max-w-none text-sm">
            <template v-if="volunteersInfo?.description">
              <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize) -->
              <!-- eslint-disable vue/no-v-html -->
              <div
                :class="[shouldReduceDescription && !showFullDescription ? 'overflow-hidden' : '']"
                :style="
                  shouldReduceDescription && !showFullDescription
                    ? {
                        display: '-webkit-box',
                        WebkitLineClamp: '3',
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }
                    : {}
                "
                v-html="volunteersDescriptionHtml"
              />
              <!-- eslint-enable vue/no-v-html -->
              <div v-if="shouldReduceDescription && volunteersInfo?.description" class="mt-2">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="primary"
                  :icon="
                    showFullDescription ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'
                  "
                  @click="showFullDescription = !showFullDescription"
                >
                  {{ showFullDescription ? t('common.show_less') : t('common.show_more') }}
                </UButton>
              </div>
            </template>
            <template v-else>
              <p class="text-gray-500">{{ t('editions.volunteers.no_description') }}</p>
            </template>
          </div>
        </div>

        <!-- Mode EXTERNAL: bouton accessible à tous -->
        <div
          v-if="
            volunteersMode === 'EXTERNAL' && volunteersInfo?.open && volunteersInfo?.externalUrl
          "
          class="flex items-center gap-3"
        >
          <UButton
            size="sm"
            color="primary"
            icon="i-heroicons-arrow-top-right-on-square"
            :to="volunteersInfo.externalUrl"
            target="_blank"
          >
            {{ t('editions.volunteers.apply') }}
          </UButton>
          <span class="text-xs text-gray-500 truncate max-w-full">{{
            volunteersInfo.externalUrl
          }}</span>
        </div>

        <!-- Bouton pour postuler (seulement si l'utilisateur n'a pas encore postulé) -->
        <div
          v-if="
            authStore.isAuthenticated &&
            volunteersMode === 'INTERNAL' &&
            !volunteersInfo?.myApplication
          "
        >
          <div v-if="!volunteersInfo?.open" class="text-sm text-gray-500 flex items-center gap-2">
            <UIcon name="i-heroicons-lock-closed" /> {{ t('editions.volunteers.closed_message') }}
          </div>
          <div v-else>
            <UCard
              variant="subtle"
              class="border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40"
            >
              <div class="flex items-center justify-between gap-4">
                <div class="text-xs text-gray-600 dark:text-gray-400">
                  {{ t('editions.volunteers.apply_description') }}
                </div>
                <UButton
                  size="sm"
                  color="primary"
                  icon="i-heroicons-hand-raised"
                  @click="openApplyModal"
                >
                  {{ t('editions.volunteers.apply') }}
                </UButton>
              </div>
            </UCard>
          </div>
        </div>
        <div
          v-else-if="!authStore.isAuthenticated && volunteersMode === 'INTERNAL'"
          class="text-sm text-gray-500"
        >
          {{ t('editions.volunteers.login_prompt') }}
        </div>
      </div>
    </UCard>

    <!-- Modal candidature bénévole -->
    <EditionVolunteerApplicationModal
      v-model="showApplyModal"
      :volunteers-info="volunteersInfo"
      :edition="edition"
      :user="authStore.user"
      :applying="volunteersApplying"
      @close="closeApplyModal"
      @submit="applyAsVolunteer"
    />
  </div>
  <div v-else>
    <p>{{ t('editions.loading_details') }}</p>
  </div>
</template>

<script setup lang="ts">
// Vue & libs
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

// App components & stores
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { markdownToHtml } from '~/utils/markdown'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const editionId = parseInt(route.params.id as string)

// Expose constants early (avant tout await)
defineExpose({})
await editionStore.fetchEditionById(editionId)
const edition = computed(() => editionStore.getEditionById(editionId))

const isFavorited = computed(() => (_id: number) => {
  return edition.value?.favoritedBy.some((u) => u.id === authStore.user?.id)
})
const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
  } catch {
    /* silent */
  }
}

// Condition pour réduire la description (maintenant toujours false pour afficher entièrement)
const shouldReduceDescription = computed(() => {
  // Afficher toujours la description entièrement
  return false
})

// Ancien canManageEdition gardé pour compatibilité avec le bouton "Gérer"
const canManageEdition = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  if (edition.value.creatorId === authStore.user.id) return true
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  if (!collab) return false
  const rights = collab.rights || {}
  return !!(
    rights.editAllEditions ||
    rights.deleteAllEditions ||
    rights.manageCollaborators ||
    rights.editConvention
  )
})

// Volunteer logic reused
interface VolunteerApplication {
  id: number
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
}
interface VolunteerInfo {
  open: boolean
  description?: string
  mode: 'INTERNAL' | 'EXTERNAL'
  externalUrl?: string
  counts: Record<string, number>
  myApplication: VolunteerApplication | null
  askDiet?: boolean
  askAllergies?: boolean
  askTimePreferences?: boolean
  askTeamPreferences?: boolean
  askPets?: boolean
  askMinors?: boolean
  askVehicle?: boolean
  askCompanion?: boolean
  askAvoidList?: boolean
  askSkills?: boolean
  askExperience?: boolean
  askSetup?: boolean
  askTeardown?: boolean
  setupStartDate?: string
  teardownEndDate?: string
  teams?: { name: string; slots?: number }[]
}
const volunteersInfo = ref<VolunteerInfo | null>(null)
const volunteersDescriptionHtml = ref('')
const showFullDescription = ref(false)
// Computed simple pour le mode afin d'éviter des cascades de types lourdes
const volunteersMode = computed<'INTERNAL' | 'EXTERNAL' | null>(
  () => volunteersInfo.value?.mode || null
)
// Références de gestion (édition supprimée sur page publique)
// const volunteersLoadingAction = ref(false) // supprimé
// const volunteersSaving = ref(false) // supprimé
const volunteersApplying = ref(false)
const volunteersWithdrawing = ref(false)
// Suppression édition publique : editingVolunteers retiré
const showApplyModal = ref(false)

// Modal candidature helpers
// Variables du formulaire déplacées dans EditionVolunteerApplicationModal
const volunteerStatusColor = (s: string) =>
  s === 'PENDING' ? 'warning' : s === 'ACCEPTED' ? 'success' : 'error'
const volunteerStatusLabel = (s: string) =>
  s === 'PENDING'
    ? t('editions.volunteers.status_pending')
    : s === 'ACCEPTED'
      ? t('editions.volunteers.status_accepted')
      : s === 'REJECTED'
        ? t('editions.volunteers.status_rejected')
        : s
const fetchVolunteersInfo = async () => {
  try {
    volunteersInfo.value = (await $fetch(`/api/editions/${editionId}/volunteers/info`)) as any
    if (volunteersInfo.value?.description) {
      volunteersDescriptionHtml.value = await markdownToHtml(volunteersInfo.value.description)
    }
  } catch {
    /* silent */
  }
}
await fetchVolunteersInfo()

// Fonctions d'édition/gestion supprimées de la page publique
const applyAsVolunteer = async (formData?: any) => {
  volunteersApplying.value = true
  try {
    const res: any = await $fetch(`/api/editions/${editionId}/volunteers/apply`, {
      method: 'POST',
      body: {
        motivation: formData?.motivation?.trim() || undefined,
        phone: formData?.phone?.trim() || undefined,
        prenom: (authStore.user as any)?.prenom
          ? undefined
          : formData?.firstName?.trim() || undefined,
        nom: (authStore.user as any)?.nom ? undefined : formData?.lastName?.trim() || undefined,
        dietaryPreference:
          volunteersInfo.value?.askDiet &&
          formData?.dietPreference !== 'NONE' &&
          formData?.dietPreference
            ? formData.dietPreference
            : undefined,
        allergies:
          volunteersInfo.value?.askAllergies && formData?.allergies?.trim()
            ? formData.allergies.trim()
            : undefined,
        timePreferences:
          volunteersInfo.value?.askTimePreferences && formData?.timePreferences?.length > 0
            ? formData.timePreferences
            : undefined,
        teamPreferences:
          volunteersInfo.value?.askTeamPreferences && formData?.teamPreferences?.length > 0
            ? formData.teamPreferences
            : undefined,
        hasPets: volunteersInfo.value?.askPets ? formData?.hasPets || undefined : undefined,
        petsDetails:
          volunteersInfo.value?.askPets && formData?.hasPets && formData?.petsDetails?.trim()
            ? formData.petsDetails.trim()
            : undefined,
        hasMinors: volunteersInfo.value?.askMinors ? formData?.hasMinors || undefined : undefined,
        minorsDetails:
          volunteersInfo.value?.askMinors && formData?.hasMinors && formData?.minorsDetails?.trim()
            ? formData.minorsDetails.trim()
            : undefined,
        hasVehicle: volunteersInfo.value?.askVehicle
          ? formData?.hasVehicle || undefined
          : undefined,
        vehicleDetails:
          volunteersInfo.value?.askVehicle &&
          formData?.hasVehicle &&
          formData?.vehicleDetails?.trim()
            ? formData.vehicleDetails.trim()
            : undefined,
        companionName:
          volunteersInfo.value?.askCompanion && formData?.companionName?.trim()
            ? formData.companionName.trim()
            : undefined,
        avoidList:
          volunteersInfo.value?.askAvoidList && formData?.avoidList?.trim()
            ? formData.avoidList.trim()
            : undefined,
        skills:
          volunteersInfo.value?.askSkills && formData?.skills?.trim()
            ? formData.skills.trim()
            : undefined,
        hasExperience: volunteersInfo.value?.askExperience ? formData?.hasExperience : undefined,
        experienceDetails:
          volunteersInfo.value?.askExperience &&
          formData?.hasExperience &&
          formData?.experienceDetails?.trim()
            ? formData.experienceDetails.trim()
            : undefined,
        setupAvailability: volunteersInfo.value?.askSetup ? formData?.setupAvailability : undefined,
        teardownAvailability: volunteersInfo.value?.askTeardown
          ? formData?.teardownAvailability
          : undefined,
        eventAvailability: formData?.eventAvailability || undefined,
        arrivalDateTime: formData?.arrivalDateTime || undefined,
        departureDateTime: formData?.departureDateTime || undefined,
      },
    } as any)
    if (res?.application && volunteersInfo.value)
      volunteersInfo.value.myApplication = res.application

    // Mettre à jour les infos utilisateur si nécessaire
    if (formData?.phone?.trim()) (authStore.user as any).phone = formData.phone.trim()
    if (!(authStore.user as any)?.prenom && formData?.firstName?.trim())
      (authStore.user as any).prenom = formData.firstName.trim()
    if (!(authStore.user as any)?.nom && formData?.lastName?.trim())
      (authStore.user as any).nom = formData.lastName.trim()

    showApplyModal.value = false
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    volunteersApplying.value = false
  }
}
const withdrawApplication = async () => {
  volunteersWithdrawing.value = true
  try {
    await $fetch(`/api/editions/${editionId}/volunteers/apply`, { method: 'DELETE' } as any)
    if (volunteersInfo.value) volunteersInfo.value.myApplication = null
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    volunteersWithdrawing.value = false
  }
}

// Gestion ouverture / fermeture modal candidature
const openApplyModal = () => {
  showApplyModal.value = true
}
const closeApplyModal = () => {
  showApplyModal.value = false
}
</script>
