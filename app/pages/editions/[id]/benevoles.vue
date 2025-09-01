<template>
  <div v-if="edition">
    <EditionHeader
      :edition="edition"
      current-page="benevoles"
      :is-favorited="isFavorited(edition.id)"
      @toggle-favorite="toggleFavorite(edition.id)"
    />

    <UCard variant="soft" class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-hand-raised" class="text-primary-500" />
            {{ t('editions.volunteers_title') }}
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
        <!-- Description -->
        <div>
          <div class="prose dark:prose-invert max-w-none text-sm">
            <template v-if="volunteersInfo?.description">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div v-html="volunteersDescriptionHtml" />
            </template>
            <template v-else>
              <p class="text-gray-500">{{ t('editions.volunteers_no_description') }}</p>
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
            {{ t('editions.volunteers_apply') }}
          </UButton>
          <span class="text-xs text-gray-500 truncate max-w-full">{{
            volunteersInfo.externalUrl
          }}</span>
        </div>

        <!-- Candidature utilisateur (déplacé juste après description) -->
        <div v-if="authStore.isAuthenticated && volunteersMode === 'INTERNAL'">
          <div v-if="!volunteersInfo?.open" class="text-sm text-gray-500 flex items-center gap-2">
            <UIcon name="i-heroicons-lock-closed" /> {{ t('editions.volunteers_closed_message') }}
          </div>
          <div v-else>
            <UCard
              variant="subtle"
              class="border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40"
            >
              <template v-if="volunteersInfo?.myApplication">
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-semibold flex items-center gap-1">
                      <UIcon name="i-heroicons-user" class="text-primary-500" />
                      {{ t('editions.volunteers_my_application_title') }}
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
                      >{{ t('editions.volunteers_my_application_pending') }}</span
                    >
                    <span
                      v-else-if="volunteersInfo.myApplication.status === 'ACCEPTED'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers_my_application_accepted') }}</span
                    >
                    <span
                      v-else-if="volunteersInfo.myApplication.status === 'REJECTED'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers_my_application_rejected') }}</span
                    >
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <UButton
                      v-if="volunteersInfo.myApplication.status === 'PENDING'"
                      size="xs"
                      color="error"
                      variant="soft"
                      :loading="volunteersWithdrawing"
                      @click="withdrawApplication"
                    >
                      {{ t('editions.volunteers_withdraw') }}
                    </UButton>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center justify-between gap-4">
                  <div class="text-xs text-gray-600 dark:text-gray-400">
                    {{ t('editions.volunteers_apply_description') }}
                  </div>
                  <UButton
                    size="sm"
                    color="primary"
                    icon="i-heroicons-hand-raised"
                    @click="openApplyModal"
                  >
                    {{ t('editions.volunteers_apply') }}
                  </UButton>
                </div>
              </template>
            </UCard>
          </div>
        </div>
        <div
          v-else-if="!authStore.isAuthenticated && volunteersMode === 'INTERNAL'"
          class="text-sm text-gray-500"
        >
          {{ t('editions.volunteers_login_prompt') }}
        </div>
      </div>
    </UCard>

    <!-- Modal candidature bénévole -->
    <UModal
      v-model:open="showApplyModal"
      :title="t('editions.volunteers_apply')"
      :description="t('editions.volunteers_apply_description')"
      :dismissible="!volunteersApplying"
      :ui="{ content: 'max-w-xl rounded-none' }"
    >
      <template #body>
        <div class="space-y-4 w-full">
          <!-- Infos personnelles transmises -->
          <div
            class="space-y-2 text-gray-600 dark:text-gray-400 border rounded-md p-3 bg-gray-50 dark:bg-gray-800/40"
          >
            <div class="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              <UIcon name="i-heroicons-information-circle" class="text-primary-500" />
              <span>{{ t('editions.volunteers_personal_info_notice') }}</span>
            </div>
            <div class="space-y-2 text-[11px] sm:text-xs">
              <!-- Première ligne: Nom et Prénom -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span class="font-semibold">{{ t('editions.volunteers_first_name') }}:</span>
                  <span v-if="(authStore.user as any)?.prenom" class="ml-1">{{
                    (authStore.user as any).prenom
                  }}</span>
                  <span v-else class="ml-1 text-red-500">{{ t('common.required') }}</span>
                </div>
                <div>
                  <span class="font-semibold">{{ t('editions.volunteers_last_name') }}:</span>
                  <span v-if="(authStore.user as any)?.nom" class="ml-1">{{
                    (authStore.user as any).nom
                  }}</span>
                  <span v-else class="ml-1 text-red-500">{{ t('common.required') }}</span>
                </div>
              </div>
              <!-- Deuxième ligne: Email et Téléphone -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span class="font-semibold">{{ t('common.email') }}:</span>
                  <span class="ml-1">{{ authStore.user?.email }}</span>
                </div>
                <div>
                  <span class="font-semibold">{{ t('editions.volunteers_phone') }}:</span>
                  <span v-if="(authStore.user as any)?.phone" class="ml-1">{{
                    (authStore.user as any).phone
                  }}</span>
                  <span v-else class="ml-1 text-red-500">{{ t('common.required') }}</span>
                </div>
              </div>
            </div>
            <p class="mt-1 text-[11px] leading-snug">
              {{ t('editions.volunteers_personal_info_disclaimer') }}
            </p>
          </div>
          <!-- Champ téléphone si manquant -->
          <div v-if="needsPhone" class="space-y-2 w-full">
            <UFormField :label="t('editions.volunteers_phone_required')" class="w-full">
              <UInput v-model="volunteerPhone" autocomplete="tel" class="w-full" />
            </UFormField>
          </div>

          <!-- Champs nom/prénom si manquants -->
          <div
            v-if="!(authStore.user as any)?.prenom || !(authStore.user as any)?.nom"
            class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full"
          >
            <UFormField
              v-if="!(authStore.user as any)?.prenom"
              :label="t('editions.volunteers_first_name_required')"
              class="w-full"
            >
              <UInput v-model="volunteerFirstName" class="w-full" />
            </UFormField>
            <UFormField
              v-if="!(authStore.user as any)?.nom"
              :label="t('editions.volunteers_last_name_required')"
              class="w-full"
            >
              <UInput v-model="volunteerLastName" class="w-full" />
            </UFormField>
          </div>
          <div
            v-if="volunteersInfo?.askDiet && volunteersMode === 'INTERNAL'"
            class="space-y-2 w-full"
          >
            <UFormField :label="t('editions.volunteers_diet_label')">
              <USelect
                v-model="selectedDietPreference"
                :items="dietPreferenceItems"
                size="lg"
                class="w-full text-sm"
                :placeholder="t('diet.none')"
              />
            </UFormField>
          </div>
          <div
            v-if="volunteersInfo?.askAllergies && volunteersMode === 'INTERNAL'"
            class="space-y-2 w-full"
          >
            <UFormField :label="t('editions.volunteers_allergies_label')">
              <UInput
                v-model="volunteerAllergies"
                :placeholder="t('editions.volunteers_allergies_placeholder')"
                class="w-full"
                :maxlength="300"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">{{ t('editions.volunteers_allergies_hint') }}</p>
          </div>
          <div
            v-if="volunteersInfo?.askTimePreferences && volunteersMode === 'INTERNAL'"
            class="space-y-2 w-full"
          >
            <UFormField :label="t('editions.volunteers_time_preferences_label')">
              <UCheckboxGroup
                v-model="selectedTimePreferences"
                :items="timeSlotItems"
                class="grid grid-cols-1 sm:grid-cols-2 gap-2"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers_time_preferences_hint') }}
            </p>
          </div>
          <div
            v-if="
              volunteersInfo?.askTeamPreferences &&
              volunteersInfo?.teams &&
              volunteersInfo.teams.length > 0 &&
              volunteersMode === 'INTERNAL'
            "
            class="space-y-2 w-full"
          >
            <UFormField :label="t('editions.volunteers_team_preferences_label')">
              <UCheckboxGroup
                v-model="selectedTeamPreferences"
                :items="teamItems"
                class="grid grid-cols-1 gap-2"
              />
            </UFormField>
            <p class="text-[11px] text-gray-500">
              {{ t('editions.volunteers_team_preferences_hint') }}
            </p>
          </div>

          <!-- Motivation (déplacé en bas) -->
          <UFormField :label="t('editions.volunteers_motivation_label')" class="w-full">
            <div class="space-y-1 w-full">
              <UTextarea
                ref="motivationTextareaRef"
                v-model="volunteerMotivation"
                :rows="5"
                :placeholder="t('editions.volunteers_motivation_placeholder')"
                :maxlength="MOTIVATION_MAX"
                class="w-full"
              />
              <div class="flex justify-end text-xs" :class="{ 'text-red-500': motivationTooLong }">
                {{ volunteerMotivation.length }} / {{ MOTIVATION_MAX }}
              </div>
            </div>
          </UFormField>
          <p class="text-xs text-gray-500 whitespace-pre-line w-full">
            {{ t('editions.volunteers_motivation_hint', { max: MOTIVATION_MAX }) }}
          </p>
        </div>
      </template>
      <template #footer="{ close }">
        <div class="flex justify-end gap-2 w-full">
          <UButton
            size="lg"
            variant="ghost"
            :disabled="volunteersApplying"
            @click="
              () => {
                close()
                closeApplyModal()
              }
            "
            >{{ t('common.cancel') }}</UButton
          >
          <UButton
            size="lg"
            color="primary"
            :loading="volunteersApplying"
            :disabled="volunteersApplying || motivationTooLong"
            icon="i-heroicons-paper-airplane"
            @click="applyAsVolunteer"
          >
            {{ t('editions.volunteers_apply') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UCard v-if="canViewVolunteersTable" variant="soft" class="mb-6">
      <template #header>
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <UIcon name="i-heroicons-clipboard-document-list" class="text-primary-500" />
          {{ t('editions.volunteers_management_title') }}
        </h3>
      </template>

      <!-- Note visibilité + séparation avant statistiques & tableau organisateur -->
      <div v-if="volunteersMode === 'INTERNAL'">
        <UAlert
          icon="i-heroicons-shield-check"
          :title="
            canManageVolunteers
              ? t('editions.volunteers_admin_only_note')
              : t('editions.volunteers_view_only_note')
          "
          :description="canManageVolunteers ? null : t('editions.volunteers_view_only_description')"
          color="primary"
          variant="subtle"
        />

        <!-- Statistiques -->
        <div v-if="volunteersInfo" class="mt-3 mb-3 flex flex-wrap gap-3">
          <UBadge color="neutral" variant="soft"
            >{{ t('editions.volunteers_total') }}: {{ volunteersInfo.counts.total || 0 }}</UBadge
          >
          <UBadge color="warning" variant="soft"
            >{{ t('editions.volunteers_status_pending') }}:
            {{ volunteersInfo.counts.PENDING || 0 }}</UBadge
          >
          <UBadge color="success" variant="soft"
            >{{ t('editions.volunteers_status_accepted') }}:
            {{ volunteersInfo.counts.ACCEPTED || 0 }}</UBadge
          >
          <UBadge color="error" variant="soft"
            >{{ t('editions.volunteers_status_rejected') }}:
            {{ volunteersInfo.counts.REJECTED || 0 }}</UBadge
          >
        </div>
      </div>

      <div class="space-y-3">
        <template v-if="volunteersMode === 'INTERNAL'">
          <div class="space-y-4">
            <!-- Filtres -->
            <UCard variant="subtle">
              <div class="flex flex-wrap gap-3 items-end">
                <UFormField :label="t('editions.volunteers_filter_status')">
                  <USelect
                    v-model="applicationsFilterStatus"
                    :items="volunteerStatusItems"
                    :placeholder="t('editions.volunteers_status_all')"
                    icon="i-heroicons-funnel"
                    size="xs"
                    variant="soft"
                    class="w-48"
                    @change="onStatusFilterChange"
                  />
                </UFormField>
                <UFormField
                  v-if="volunteersInfo?.askTeamPreferences && volunteerTeamItems.length > 0"
                  :label="t('editions.volunteers_table_team_preferences')"
                >
                  <USelect
                    v-model="applicationsFilterTeams"
                    :items="volunteerTeamItems"
                    :placeholder="t('editions.volunteers_teams_empty')"
                    icon="i-heroicons-user-group"
                    size="xs"
                    variant="soft"
                    class="w-48"
                    multiple
                    @change="onTeamsFilterChange"
                  />
                </UFormField>
                <UFormField :label="t('editions.volunteers_search')">
                  <UInput
                    v-model="globalFilter"
                    :placeholder="t('editions.volunteers_search_placeholder')"
                    class="w-64"
                    @keydown.enter.prevent="applySearch"
                  />
                </UFormField>
                <UButton
                  size="xs"
                  variant="soft"
                  icon="i-heroicons-arrow-path"
                  :loading="applicationsLoading"
                  @click="refreshApplications"
                >
                  {{ t('common.refresh') }}
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  icon="i-heroicons-arrow-uturn-left"
                  @click="resetApplicationsFilters"
                >
                  {{ t('common.reset') }}
                </UButton>
                <span class="text-xs text-gray-500 italic">{{
                  $t('pages.benevoles.sort_tip')
                }}</span>
              </div>
            </UCard>

            <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
              <UTable
                ref="tableRef"
                v-model:sorting="sorting"
                :data="tableData"
                :columns="columns"
                :loading="applicationsLoading"
                class="flex-1"
                sticky
              />
              <div
                v-if="tableData.length === 0 && !applicationsLoading"
                class="text-xs text-gray-500 py-2"
              >
                {{ t('editions.volunteers_no_applications') }}
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-xs">
              <span>{{ filteredCountLabel }}</span>
              <span v-if="serverPagination.totalPages > 1" class="flex items-center gap-2">
                <UButton
                  size="xs"
                  variant="ghost"
                  :disabled="serverPagination.page === 1 || applicationsLoading"
                  icon="i-heroicons-chevron-left"
                  @click="goToPage(serverPagination.page - 1)"
                />
                <span>{{ serverPagination.page }} / {{ serverPagination.totalPages }}</span>
                <UButton
                  size="xs"
                  variant="ghost"
                  :disabled="
                    serverPagination.page === serverPagination.totalPages || applicationsLoading
                  "
                  icon="i-heroicons-chevron-right"
                  @click="goToPage(serverPagination.page + 1)"
                />
              </span>
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </div>
  <div v-else>
    <p>{{ t('editions.loading_details') }}</p>
  </div>
</template>

<script setup lang="ts">
// Vue & libs
import { ref, computed, watch, h, nextTick } from 'vue'
import { useRoute } from 'vue-router'

// App components & stores
import EditionHeader from '~/components/edition/EditionHeader.vue'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { markdownToHtml } from '~/utils/markdown'

// Types (externes) en dernier
import type { TableColumn } from '@nuxt/ui'
import type { Column } from '@tanstack/vue-table'

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

// Condition pour voir le tableau des bénévoles (tous les collaborateurs)
const canViewVolunteersTable = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Créateur de l'édition
  if (edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId === authStore.user.id) return true
  // Collaborateur de la convention
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  return !!collab
})

// Condition pour gérer les bénévoles (accepter/refuser candidatures)
const canManageVolunteers = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Créateur de l'édition
  if (edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId === authStore.user.id) return true
  // Collaborateur avec droit global de gérer les bénévoles
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  if (!collab) return false
  const rights = collab.rights || {}
  if (rights.manageVolunteers) return true
  // Collaborateur avec droit spécifique à cette édition
  const perEdition = (collab as any).perEdition || []
  const editionPerm = perEdition.find((p: any) => p.editionId === edition.value!.id)
  return editionPerm?.canManageVolunteers || false
})

// Ancien canManageEdition gardé pour compatibilité avec le bouton "Gérer"
const canManageEdition = computed(() => {
  if (!authStore.user || !edition.value) return false
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
  description: string | null
  mode: 'INTERNAL' | 'EXTERNAL'
  externalUrl: string | null
  counts: Record<string, number>
  myApplication: VolunteerApplication | null
  askDiet?: boolean
  askAllergies?: boolean
  askTimePreferences?: boolean
  askTeamPreferences?: boolean
  teams?: { name: string; slots?: number }[]
}
const volunteersInfo = ref<VolunteerInfo | null>(null)
const volunteersDescriptionHtml = ref('')
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
const MOTIVATION_MAX = 500
const motivationTextareaRef = ref(null)
const motivationTooLong = computed<boolean>(() => volunteerMotivation.value.length > MOTIVATION_MAX)
const volunteerMotivation = ref('')
const volunteerPhone = ref('')
const volunteerFirstName = ref('')
const volunteerLastName = ref('')
const selectedDietPreference = ref<'NONE' | 'VEGETARIAN' | 'VEGAN'>('NONE')
const volunteerAllergies = ref('')
const selectedTimePreferences = ref<string[]>([])
const selectedTeamPreferences = ref<string[]>([])

// Items de créneaux horaires pour UCheckboxGroup
const timeSlotItems = computed(() => [
  { label: t('editions.volunteers_time_slots.early_morning'), value: 'early_morning' },
  { label: t('editions.volunteers_time_slots.morning'), value: 'morning' },
  { label: t('editions.volunteers_time_slots.lunch'), value: 'lunch' },
  { label: t('editions.volunteers_time_slots.early_afternoon'), value: 'early_afternoon' },
  { label: t('editions.volunteers_time_slots.late_afternoon'), value: 'late_afternoon' },
  { label: t('editions.volunteers_time_slots.evening'), value: 'evening' },
  { label: t('editions.volunteers_time_slots.late_evening'), value: 'late_evening' },
  { label: t('editions.volunteers_time_slots.night'), value: 'night' },
])

// Items d'équipes pour UCheckboxGroup
const teamItems = computed(() => {
  if (!volunteersInfo.value?.teams) return []
  return volunteersInfo.value.teams.map((team) => ({
    label: team.name,
    value: team.name,
  }))
})

// Items du select régime : labels doivent être des chaînes (pas des fonctions) pour USelect
const dietPreferenceItems = computed<{ value: 'NONE' | 'VEGETARIAN' | 'VEGAN'; label: string }[]>(
  () => [
    { value: 'NONE', label: t('diet.none') },
    { value: 'VEGETARIAN', label: t('diet.vegetarian') },
    { value: 'VEGAN', label: t('diet.vegan') },
  ]
)
const needsPhone = computed(() => authStore.isAuthenticated && !(authStore.user as any)?.phone)
const volunteerStatusColor = (s: string) =>
  s === 'PENDING' ? 'warning' : s === 'ACCEPTED' ? 'success' : 'error'
const volunteerStatusLabel = (s: string) =>
  s === 'PENDING'
    ? t('editions.volunteers_status_pending')
    : s === 'ACCEPTED'
      ? t('editions.volunteers_status_accepted')
      : s === 'REJECTED'
        ? t('editions.volunteers_status_rejected')
        : s
const fetchVolunteersInfo = async () => {
  try {
    volunteersInfo.value = await $fetch(`/api/editions/${editionId}/volunteers/info`)
    if (volunteersInfo.value?.description) {
      volunteersDescriptionHtml.value = await markdownToHtml(volunteersInfo.value.description)
    }
  } catch {
    /* silent */
  }
}
await fetchVolunteersInfo()

// Fonctions d'édition/gestion supprimées de la page publique
const applyAsVolunteer = async () => {
  volunteersApplying.value = true
  try {
    const res: any = await $fetch(`/api/editions/${editionId}/volunteers/apply`, {
      method: 'POST',
      body: {
        motivation: volunteerMotivation.value.trim() || undefined,
        phone: needsPhone.value ? volunteerPhone.value.trim() || undefined : undefined,
        prenom: (authStore.user as any)?.prenom
          ? undefined
          : volunteerFirstName.value.trim() || undefined,
        nom: (authStore.user as any)?.nom ? undefined : volunteerLastName.value.trim() || undefined,
        dietaryPreference:
          volunteersInfo.value?.askDiet && selectedDietPreference.value !== 'NONE'
            ? selectedDietPreference.value
            : undefined,
        allergies:
          volunteersInfo.value?.askAllergies && volunteerAllergies.value.trim()
            ? volunteerAllergies.value.trim()
            : undefined,
        timePreferences:
          volunteersInfo.value?.askTimePreferences && selectedTimePreferences.value.length > 0
            ? selectedTimePreferences.value
            : undefined,
        teamPreferences:
          volunteersInfo.value?.askTeamPreferences && selectedTeamPreferences.value.length > 0
            ? selectedTeamPreferences.value
            : undefined,
      },
    } as any)
    if (res?.application && volunteersInfo.value)
      volunteersInfo.value.myApplication = res.application
    if (needsPhone.value && volunteerPhone.value.trim())
      (authStore.user as any).phone = volunteerPhone.value.trim()
    if (!(authStore.user as any)?.prenom && volunteerFirstName.value.trim())
      (authStore.user as any).prenom = volunteerFirstName.value.trim()
    if (!(authStore.user as any)?.nom && volunteerLastName.value.trim())
      (authStore.user as any).nom = volunteerLastName.value.trim()
    volunteerMotivation.value = ''
    volunteerPhone.value = ''
    volunteerFirstName.value = ''
    volunteerLastName.value = ''
    volunteerAllergies.value = ''
    selectedTimePreferences.value = []
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

// Applications list
interface VolunteerApplicationFull extends VolunteerApplication {
  createdAt: string
  motivation: string | null
  user: {
    id: number
    pseudo: string
    email: string
    phone?: string | null
    prenom?: string | null
    nom?: string | null
  }
}
const applications = ref<VolunteerApplicationFull[]>([])
const applicationsLoading = ref(false)
// Pagination serveur
const serverPagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
// Filtres
// Filtre statut: utiliser 'ALL' plutôt que null pour que USelect affiche une option
const applicationsFilterStatus = ref<string>('ALL')
const applicationsFilterTeams = ref<string[]>([])
const globalFilter = ref('')
// Tri multi-colonnes (TanStack sorting state)
const sorting = ref<{ id: string; desc: boolean }[]>([{ id: 'createdAt', desc: true }])
const applicationsActingId = ref<number | null>(null)
const actingAction = ref<'ACCEPTED' | 'REJECTED' | 'PENDING' | null>(null)
// (Anciennes options de tri supprimées, tri via entêtes de colonnes)
// Items pour USelect (API Nuxt UI v3)
const volunteerStatusItems = computed(() => [
  { label: t('editions.volunteers_status_all'), value: 'ALL' },
  { label: t('editions.volunteers_status_pending'), value: 'PENDING' },
  { label: t('editions.volunteers_status_accepted'), value: 'ACCEPTED' },
  { label: t('editions.volunteers_status_rejected'), value: 'REJECTED' },
])

const volunteerTeamItems = computed(() => {
  if (!volunteersInfo.value?.askTeamPreferences || !volunteersInfo.value?.teams?.length) {
    return []
  }
  return volunteersInfo.value.teams.map((team) => ({
    label: team.name,
    value: team.name,
  }))
})
const applySearch = () => {
  serverPagination.value.page = 1
  refreshApplications()
}
const onStatusFilterChange = () => {
  serverPagination.value.page = 1
  refreshApplications()
}
const onTeamsFilterChange = () => {
  serverPagination.value.page = 1
  refreshApplications()
}
const resetApplicationsFilters = () => {
  applicationsFilterStatus.value = 'ALL'
  applicationsFilterTeams.value = []
  globalFilter.value = ''
  sorting.value = [{ id: 'createdAt', desc: true }]
  serverPagination.value.page = 1
  refreshApplications()
}
const goToPage = (p: number) => {
  if (p < 1 || p > serverPagination.value.totalPages) return
  serverPagination.value.page = p
  refreshApplications()
}
const refreshApplications = async () => {
  if (!canViewVolunteersTable.value) return
  if (volunteersMode.value === 'EXTERNAL') return // Pas de tableau en mode externe
  applicationsLoading.value = true
  try {
    // Convert sorting state en paramètres existants (compat backend)
    const primary = sorting.value[0]
    const secondary = sorting.value.slice(1)
    const sortField = primary?.id || 'createdAt'
    const sortDir = primary?.desc ? 'desc' : 'asc'
    const sortSecondary =
      secondary.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',') || undefined
    const res: any = await $fetch(`/api/editions/${editionId}/volunteers/applications`, {
      query: {
        page: serverPagination.value.page,
        pageSize: serverPagination.value.pageSize,
        status:
          applicationsFilterStatus.value && applicationsFilterStatus.value !== 'ALL'
            ? applicationsFilterStatus.value
            : undefined,
        teams:
          applicationsFilterTeams.value.length > 0
            ? applicationsFilterTeams.value.join(',')
            : undefined,
        sortField,
        sortDir,
        sortSecondary,
        search: globalFilter.value || undefined,
      },
    } as any)
    applications.value = res.applications || []
    if (res.pagination) serverPagination.value = res.pagination
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    applicationsLoading.value = false
  }
}
await refreshApplications()
const decideApplication = async (
  app: VolunteerApplicationFull,
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING'
) => {
  applicationsActingId.value = app.id
  actingAction.value = status
  try {
    const res: any = await $fetch(`/api/editions/${editionId}/volunteers/applications/${app.id}`, {
      method: 'PATCH',
      body: { status },
    } as any)
    if (res?.application) {
      app.status = res.application.status
      await fetchVolunteersInfo()
    }
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    applicationsActingId.value = null
    actingAction.value = null
  }
}
const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
// Données aplaties pour le tableau
const tableData = computed(() =>
  applications.value.map((app) => ({
    ...app,
    pseudo: app.user.pseudo,
    email: app.user.email,
    phone: app.user.phone,
    prenom: app.user.prenom,
    nom: app.user.nom,
    dietaryPreference: (app as any).dietaryPreference,
    allergies: (app as any).allergies,
  }))
)

// Colonnes UTable
const columns: TableColumn<any>[] = [
  // Etat en premier
  {
    accessorKey: 'status',
    header: ({ column }) => getSortableHeader(column, t('common.status')),
    cell: ({ row }) =>
      h(
        resolveComponent('UBadge'),
        {
          color: volunteerStatusColor(row.original.status),
          variant: 'soft',
          class: 'uppercase text-xs px-2 py-1',
        },
        () => volunteerStatusLabel(row.original.status)
      ),
    size: 120,
  },
  // Infos utilisateur
  {
    accessorKey: 'pseudo',
    header: ({ column }) => getSortableHeader(column, t('editions.volunteers_table_user')),
    cell: ({ row }) =>
      h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium' }, row.original.user.pseudo),
        h('span', { class: 'text-xs text-gray-500' }, row.original.user.email),
        row.original.user.phone
          ? h('span', { class: 'text-xs text-gray-500' }, row.original.user.phone)
          : null,
      ]),
  },
  // Colonnes Prénom et Nom
  {
    accessorKey: 'prenom',
    header: t('editions.volunteers_table_first_name'),
    cell: ({ row }) => row.original.user.prenom || '—',
  },
  {
    accessorKey: 'nom',
    header: t('editions.volunteers_table_last_name'),
    cell: ({ row }) => row.original.user.nom || '—',
  },
  // Colonne régime si activée
  ...(volunteersInfo.value?.askDiet
    ? [
        {
          accessorKey: 'dietaryPreference',
          header: t('editions.volunteers_table_diet'),
          cell: ({ row }: any) => {
            const val = row.original.dietaryPreference || 'NONE'
            const key =
              val === 'VEGETARIAN'
                ? t('diet.vegetarian')
                : val === 'VEGAN'
                  ? t('diet.vegan')
                  : t('diet.none')
            return h('span', { class: 'text-xs' }, key)
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne allergies si activée
  ...(volunteersInfo.value?.askAllergies
    ? [
        {
          accessorKey: 'allergies',
          header: t('editions.volunteers_table_allergies'),
          cell: ({ row }: any) =>
            row.original.allergies
              ? h('span', { class: 'text-xs truncate block max-w-[160px]' }, row.original.allergies)
              : '—',
        } as TableColumn<any>,
      ]
    : []),
  // Colonne préférences horaires si activée
  ...(volunteersInfo.value?.askTimePreferences
    ? [
        {
          accessorKey: 'timePreferences',
          header: t('editions.volunteers_table_time_preferences'),
          cell: ({ row }: any) => {
            const preferences = row.original.timePreferences || []
            const allSlots = [
              'early_morning',
              'morning',
              'lunch',
              'early_afternoon',
              'late_afternoon',
              'evening',
              'late_evening',
              'night',
            ]

            return h(
              'div',
              { class: 'grid grid-cols-4 gap-1' },
              allSlots.map((slot) => {
                const isSelected = preferences.includes(slot)
                const label = t(`editions.volunteers_time_slots.${slot}`)

                return h(
                  resolveComponent('UTooltip'),
                  { text: label, openDelay: 200 },
                  {
                    default: () =>
                      h('div', {
                        class: `w-3 h-3 rounded border ${
                          isSelected
                            ? 'bg-green-500 border-green-600'
                            : 'bg-gray-200 border-gray-300 dark:bg-gray-600 dark:border-gray-500'
                        }`,
                        title: label,
                      }),
                  }
                )
              })
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne équipes préférées si activée
  ...(volunteersInfo.value?.askTeamPreferences
    ? [
        {
          accessorKey: 'teamPreferences',
          header: t('editions.volunteers_table_team_preferences'),
          cell: ({ row }: any) => {
            const preferences = row.original.teamPreferences || []
            if (preferences.length === 0) return h('span', '—')

            const teams = volunteersInfo.value?.teams || []
            const teamNames = preferences
              .map((teamId: string) => {
                const team = teams.find((t: any) => t.id === teamId)
                return team?.name || teamId
              })
              .join(', ')

            return h(
              resolveComponent('UTooltip'),
              { text: teamNames, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'max-w-xs truncate cursor-help text-xs',
                      title: teamNames,
                    },
                    teamNames
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  {
    accessorKey: 'createdAt',
    header: ({ column }) => getSortableHeader(column, t('common.date')),
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    id: 'motivation',
    header: t('editions.volunteers_table_motivation'),
    cell: ({ row }) => {
      const mot = row.original.motivation
      if (!mot) return h('span', '—')
      return h(
        resolveComponent('UTooltip'),
        { text: mot, openDelay: 200 },
        {
          default: () => h('div', { class: 'max-w-xs truncate cursor-help', title: mot }, mot),
        }
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      // N'afficher les actions que si l'utilisateur peut gérer les bénévoles
      if (!canManageVolunteers.value) {
        return h('span', { class: 'text-xs text-gray-500 italic' }, t('common.no_permission'))
      }

      const status = row.original.status
      if (status === 'PENDING') {
        return h('div', { class: 'flex gap-2' }, [
          h(
            resolveComponent('UButton'),
            {
              size: 'xs',
              color: 'success',
              variant: 'soft',
              loading:
                applicationsActingId.value === row.original.id && actingAction.value === 'ACCEPTED',
              onClick: () => decideApplication(row.original, 'ACCEPTED'),
            },
            () => t('editions.volunteers_action_accept')
          ),
          h(
            resolveComponent('UButton'),
            {
              size: 'xs',
              color: 'error',
              variant: 'soft',
              loading:
                applicationsActingId.value === row.original.id && actingAction.value === 'REJECTED',
              onClick: () => decideApplication(row.original, 'REJECTED'),
            },
            () => t('editions.volunteers_action_reject')
          ),
        ])
      }
      if (status === 'ACCEPTED' || status === 'REJECTED') {
        return h('div', { class: 'flex gap-2' }, [
          h(
            resolveComponent('UButton'),
            {
              size: 'xs',
              color: 'warning',
              variant: 'soft',
              loading:
                applicationsActingId.value === row.original.id && actingAction.value === 'PENDING',
              onClick: () => decideApplication(row.original, 'PENDING' as any),
            },
            () => t('editions.volunteers_action_back_pending')
          ),
        ])
      }
      return null
    },
  },
]

function getSortableHeader(column: Column<any>, label: string) {
  const isSorted = column.getIsSorted()
  return h(resolveComponent('UButton'), {
    color: 'neutral',
    variant: 'ghost',
    label,
    icon: isSorted
      ? isSorted === 'asc'
        ? 'i-lucide-arrow-up-narrow-wide'
        : 'i-lucide-arrow-down-wide-narrow'
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(isSorted === 'asc'),
  })
}

// Réagir aux changements de tri (déjà captés via sorting watcher plus bas)
watch(
  sorting,
  () => {
    serverPagination.value.page = 1
    refreshApplications()
  },
  { deep: true }
)

// Déclencheur de recherche global (debounce simple)
let searchTimeout: any
watch(globalFilter, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    serverPagination.value.page = 1
    refreshApplications()
  }, 350)
})

const filteredCountLabel = computed(() => {
  const filtered = serverPagination.value.total
  const total = volunteersInfo.value?.counts?.total ?? filtered
  const page = serverPagination.value.page
  const pageSize = serverPagination.value.pageSize
  const start = applications.value.length === 0 ? 0 : (page - 1) * pageSize + 1
  const end = (page - 1) * pageSize + applications.value.length
  const boundedEnd = Math.min(end, filtered)
  const boundedStart = Math.min(start, filtered === 0 ? 0 : filtered)
  return `${t('editions.volunteers_filtered_count', { filtered, total })} (${boundedStart}–${boundedEnd})`
})

// Gestion ouverture / fermeture modal candidature
const openApplyModal = () => {
  volunteerMotivation.value = ''
  volunteerPhone.value = ''
  selectedTimePreferences.value = []
  selectedTeamPreferences.value = []
  showApplyModal.value = true
  nextTick(() => {
    const textarea = motivationTextareaRef.value as any
    textarea?.$el?.focus()
  })
}
const closeApplyModal = () => {
  showApplyModal.value = false
}
</script>
