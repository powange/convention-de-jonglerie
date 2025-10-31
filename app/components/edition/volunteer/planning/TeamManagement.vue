<template>
  <UCard variant="soft">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <UIcon name="i-heroicons-user-group" class="text-primary-500" />
          {{ t('editions.volunteers.team_management') }}
        </h3>
        <UButton size="sm" color="primary" icon="i-heroicons-plus" @click="openCreateTeamModal">
          {{ t('editions.volunteers.create_team') }}
        </UButton>
      </div>
    </template>

    <div class="space-y-4">
      <!-- Liste des équipes -->
      <div v-if="teams.length === 0" class="text-center py-8 text-gray-500">
        <UIcon name="i-heroicons-user-group" size="48" class="mx-auto mb-4 opacity-50" />
        <p>{{ t('editions.volunteers.no_teams') }}</p>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="team in teams"
          :key="team.id"
          class="border rounded-lg p-4 hover:shadow-md transition-shadow"
          :style="{ borderColor: team.color }"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2 cursor-pointer" @click="openEditTeamModal(team)">
              <div class="w-4 h-4 rounded-full" :style="{ backgroundColor: team.color }" />
              <h4 class="font-medium">{{ team.name }}</h4>
              <UBadge v-if="team.isRequired" color="primary" variant="soft" size="xs">
                {{ t('common.required') }}
              </UBadge>
            </div>
            <div @click.stop>
              <UDropdownMenu
                :items="[
                  [
                    {
                      label: t('common.edit'),
                      icon: 'i-heroicons-pencil',
                      onSelect: () => openEditTeamModal(team),
                    },
                    {
                      label: t('common.delete'),
                      icon: 'i-heroicons-trash',
                      onSelect: () => confirmDeleteTeam(team),
                    },
                  ],
                ]"
              >
                <UButton
                  variant="ghost"
                  color="neutral"
                  icon="i-heroicons-ellipsis-vertical"
                  size="xs"
                />
              </UDropdownMenu>
            </div>
          </div>

          <div v-if="team.description" class="mb-2">
            <div v-if="!expandedTeams[team.id]" class="relative">
              <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 whitespace-pre-line">
                {{ team.description }}
              </p>
              <button
                v-if="team.description.length > 100 || team.description.includes('\n')"
                class="text-xs text-primary-500 hover:text-primary-600 mt-1"
                @click.stop="toggleExpand(team.id)"
              >
                {{ t('common.show_more') }}
              </button>
            </div>
            <div v-else>
              <p class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {{ team.description }}
              </p>
              <button
                class="text-xs text-primary-500 hover:text-primary-600 mt-1"
                @click.stop="toggleExpand(team.id)"
              >
                {{ t('common.show_less') }}
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs text-gray-500">
            <span v-if="team.maxVolunteers">
              {{ t('editions.volunteers.max_volunteers') }}: {{ team.maxVolunteers }}
            </span>
            <span v-if="team._count">
              {{ team._count.timeSlots }} {{ t('editions.volunteers.time_slots') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de création/édition d'équipe -->
    <UModal v-model:open="teamModalOpen" :title="teamModalTitle">
      <template #body>
        <div class="space-y-6">
          <!-- Aperçu de l'équipe -->
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
            <div class="flex items-center gap-3 mb-2">
              <div
                class="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                :style="{ backgroundColor: teamFormState.color }"
              />
              <h3 class="font-medium text-lg">
                {{ teamFormState.name || t('editions.volunteers.team_preview') }}
              </h3>
            </div>
            <p
              v-if="teamFormState.description"
              class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line"
            >
              {{ teamFormState.description }}
            </p>
            <p v-else class="text-sm text-gray-500 italic">
              {{ t('editions.volunteers.no_description_preview') }}
            </p>
            <div v-if="teamFormState.maxVolunteers" class="mt-2 text-xs text-gray-500">
              <UIcon name="i-heroicons-users" class="w-3 h-3 inline mr-1" />
              {{ t('editions.volunteers.max_volunteers') }}: {{ teamFormState.maxVolunteers }}
            </div>
          </div>

          <UForm
            :schema="teamSchema"
            :state="teamFormState"
            class="space-y-5"
            @submit="onTeamSubmit"
          >
            <!-- Nom de l'équipe -->
            <UFormField name="name" :label="t('editions.volunteers.team_name')" required>
              <UInput
                v-model="teamFormState.name"
                placeholder="Ex: Accueil, Sécurité, Logistique..."
                icon="i-heroicons-user-group"
                class="w-full"
              />
              <template #hint>
                <span class="text-xs text-gray-500">{{
                  t('editions.volunteers.team_name_hint')
                }}</span>
              </template>
            </UFormField>

            <!-- Description -->
            <UFormField name="description" :label="t('common.description')">
              <UTextarea
                v-model="teamFormState.description"
                :placeholder="t('editions.volunteers.team_description_placeholder')"
                :rows="3"
                class="w-full"
              />
              <template #hint>
                <span class="text-xs text-gray-500">{{
                  t('editions.volunteers.team_description_hint')
                }}</span>
              </template>
            </UFormField>

            <!-- Couleur avec palette -->
            <UFormField name="color" :label="t('editions.volunteers.team_color')" required>
              <!-- Palette de couleurs prédéfinies -->
              <div class="space-y-3">
                <div class="grid grid-cols-8 gap-2 mb-3">
                  <button
                    v-for="color in predefinedColors"
                    :key="color"
                    type="button"
                    class="w-8 h-8 rounded-full border-2 shadow-sm hover:scale-110 transition-transform"
                    :class="
                      teamFormState.color === color
                        ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-500'
                        : 'border-gray-300'
                    "
                    :style="{ backgroundColor: color }"
                    @click="teamFormState.color = color"
                  />
                </div>

                <!-- Sélecteur de couleur personnalisé -->
                <div class="flex items-center gap-3">
                  <label class="block">
                    <span class="sr-only">{{ t('editions.volunteers.custom_color') }}</span>
                    <input
                      v-model="teamFormState.color"
                      type="color"
                      class="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                    />
                  </label>
                  <UInput
                    v-model="teamFormState.color"
                    placeholder="#3b82f6"
                    class="flex-1"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              </div>
              <template #hint>
                <span class="text-xs text-gray-500">{{
                  t('editions.volunteers.team_color_hint')
                }}</span>
              </template>
            </UFormField>

            <!-- Nombre max de bénévoles -->
            <UFormField
              name="maxVolunteers"
              :label="t('editions.volunteers.max_volunteers_optional')"
            >
              <UInput
                v-model.number="teamFormState.maxVolunteers"
                type="number"
                min="1"
                max="100"
                placeholder="Pas de limite"
                icon="i-heroicons-users"
                class="w-full"
              />
              <template #hint>
                <span class="text-xs text-gray-500">{{
                  t('editions.volunteers.max_volunteers_hint')
                }}</span>
              </template>
            </UFormField>

            <!-- Équipe obligatoire -->
            <UFormField name="isRequired" :label="t('editions.volunteers.required_team')">
              <USwitch v-model="teamFormState.isRequired">
                <template #label>
                  <span class="text-sm text-gray-600 dark:text-gray-400">
                    {{ t('editions.volunteers.required_team_hint') }}
                  </span>
                </template>
              </USwitch>
            </UFormField>

            <!-- Équipe de contrôle d'accès -->
            <UFormField
              name="isAccessControlTeam"
              :label="t('editions.volunteers.access_control_team')"
            >
              <USwitch v-model="teamFormState.isAccessControlTeam">
                <template #label>
                  <span class="text-sm text-gray-600 dark:text-gray-400">
                    {{ t('editions.volunteers.access_control_team_hint') }}
                  </span>
                </template>
              </USwitch>
            </UFormField>

            <!-- Équipe de validation des repas -->
            <UFormField
              name="isMealValidationTeam"
              :label="t('editions.volunteers.meal_validation_team')"
            >
              <USwitch v-model="teamFormState.isMealValidationTeam">
                <template #label>
                  <span class="text-sm text-gray-600 dark:text-gray-400">
                    {{ t('editions.volunteers.meal_validation_team_hint') }}
                  </span>
                </template>
              </USwitch>
            </UFormField>

            <!-- Visibilité pour les bénévoles -->
            <UFormField name="isVisibleToVolunteers" label="Visibilité pour les bénévoles">
              <USwitch v-model="teamFormState.isVisibleToVolunteers">
                <template #label>
                  <span class="text-sm text-gray-600 dark:text-gray-400">
                    Cette équipe est visible lors de la candidature des bénévoles
                  </span>
                </template>
              </USwitch>
            </UFormField>
          </UForm>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between">
          <div>
            <UButton
              v-if="editingTeam"
              color="error"
              variant="ghost"
              icon="i-heroicons-trash"
              @click="confirmDeleteTeam(editingTeam)"
            >
              {{ t('common.delete') }}
            </UButton>
          </div>
          <div class="flex gap-3">
            <UButton variant="ghost" @click="closeTeamModal">
              {{ t('common.cancel') }}
            </UButton>
            <UButton color="primary" :loading="loading" @click="onTeamSubmit">
              {{ editingTeam ? t('common.save') : t('common.create') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Modal de confirmation pour suppression -->
    <UiConfirmModal
      v-model="showDeleteModal"
      :title="t('editions.volunteers.confirm_delete')"
      :description="
        teamToDelete
          ? t('editions.volunteers.confirm_delete_team', { name: teamToDelete.name })
          : ''
      "
      :confirm-label="t('common.delete')"
      :cancel-label="t('common.cancel')"
      confirm-color="error"
      icon-name="i-heroicons-trash"
      icon-color="text-red-500"
      @confirm="executeDeleteTeam"
      @cancel="showDeleteModal = false"
    />
  </UCard>
</template>

<script setup lang="ts">
import { z } from 'zod'

import type { VolunteerTeam } from '~/composables/useVolunteerTeams'

// Props
interface Props {
  editionId: number
}

const props = defineProps<Props>()

// i18n
const { t } = useI18n()
const toast = useToast()

// États
const teamModalOpen = ref(false)
const editingTeam = ref<VolunteerTeam | null>(null)
const loading = ref(false)
const expandedTeams = ref<Record<string, boolean>>({})

// API
const { teams, createTeam, updateTeam, deleteTeam } = useVolunteerTeams(props.editionId)

// Schéma de validation
const teamSchema = z.object({
  name: z.string().min(1, t('errors.required_field')),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, t('errors.invalid_color')),
  maxVolunteers: z.number().int().positive().optional(),
  isRequired: z.boolean().optional(),
  isAccessControlTeam: z.boolean().optional(),
  isMealValidationTeam: z.boolean().optional(),
  isVisibleToVolunteers: z.boolean().optional(),
})

// État du formulaire
const teamFormState = ref({
  name: '',
  description: '',
  color: '#3b82f6',
  maxVolunteers: undefined as number | undefined,
  isRequired: false,
  isAccessControlTeam: false,
  isMealValidationTeam: false,
  isVisibleToVolunteers: true,
})

// Couleurs prédéfinies pour la palette
const predefinedColors = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#0ea5e9', // sky-500
  '#6366f1', // indigo-500
  '#a855f7', // purple-500
  '#f43f5e', // rose-500
  '#84cc16', // lime-500
  '#64748b', // slate-500
]

// Computed
const teamModalTitle = computed(() =>
  editingTeam.value ? t('editions.volunteers.edit_team') : t('editions.volunteers.create_team')
)

// Actions
const toggleExpand = (teamId: string) => {
  expandedTeams.value[teamId] = !expandedTeams.value[teamId]
}

const openCreateTeamModal = () => {
  editingTeam.value = null
  // Choisir une couleur aléatoire parmi celles qui ne sont pas déjà utilisées
  const usedColors = teams.value.map((team) => team.color)
  const availableColors = predefinedColors.filter((color) => !usedColors.includes(color))
  const randomColor: string =
    availableColors.length > 0
      ? availableColors[Math.floor(Math.random() * availableColors.length)]
      : predefinedColors[Math.floor(Math.random() * predefinedColors.length)]

  teamFormState.value = {
    name: '',
    description: '',
    color: randomColor,
    maxVolunteers: undefined,
    isRequired: false,
    isAccessControlTeam: false,
    isMealValidationTeam: false,
    isVisibleToVolunteers: true,
  }
  teamModalOpen.value = true
}

const openEditTeamModal = (team: VolunteerTeam) => {
  editingTeam.value = team
  teamFormState.value = {
    name: team.name,
    description: team.description || '',
    color: team.color,
    maxVolunteers: team.maxVolunteers,
    isRequired: team.isRequired || false,
    isAccessControlTeam: team.isAccessControlTeam || false,
    isMealValidationTeam: team.isMealValidationTeam || false,
    isVisibleToVolunteers: team.isVisibleToVolunteers ?? true,
  }
  teamModalOpen.value = true
}

const closeTeamModal = () => {
  teamModalOpen.value = false
  editingTeam.value = null
}

const onTeamSubmit = async () => {
  try {
    loading.value = true

    const teamData = {
      name: teamFormState.value.name,
      description: teamFormState.value.description || undefined,
      color: teamFormState.value.color,
      maxVolunteers: teamFormState.value.maxVolunteers,
      isRequired: teamFormState.value.isRequired,
      isAccessControlTeam: teamFormState.value.isAccessControlTeam,
      isMealValidationTeam: teamFormState.value.isMealValidationTeam,
      isVisibleToVolunteers: teamFormState.value.isVisibleToVolunteers,
    }

    if (editingTeam.value) {
      await updateTeam(editingTeam.value.id, teamData)
      toast.add({
        title: t('editions.volunteers.team_updated'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else {
      await createTeam(teamData)
      toast.add({
        title: t('editions.volunteers.team_created'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }

    closeTeamModal()
  } catch (error: any) {
    toast.add({
      title: t('errors.error_occurred'),
      description: error.message || 'Erreur lors de la sauvegarde',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

// Modal de confirmation pour suppression
const showDeleteModal = ref(false)
const teamToDelete = ref<VolunteerTeam | null>(null)

const confirmDeleteTeam = (team: VolunteerTeam) => {
  teamToDelete.value = team
  showDeleteModal.value = true
}

const executeDeleteTeam = async () => {
  if (!teamToDelete.value) return

  try {
    loading.value = true
    await deleteTeam(teamToDelete.value.id)
    toast.add({
      title: t('editions.volunteers.team_deleted'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    closeTeamModal()
  } catch (error: any) {
    toast.add({
      title: t('errors.error_occurred'),
      description: error.message || 'Erreur lors de la suppression',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
    showDeleteModal.value = false
    teamToDelete.value = null
  }
}
</script>
