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
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 rounded-full" :style="{ backgroundColor: team.color }" />
              <h4 class="font-medium">{{ team.name }}</h4>
            </div>
            <UDropdown
              :items="[
                [
                  {
                    label: t('common.edit'),
                    icon: 'i-heroicons-pencil',
                    click: () => openEditTeamModal(team),
                  },
                  {
                    label: t('common.delete'),
                    icon: 'i-heroicons-trash',
                    click: () => confirmDeleteTeam(team),
                  },
                ],
              ]"
            >
              <UButton
                variant="ghost"
                color="gray"
                icon="i-heroicons-ellipsis-vertical"
                size="xs"
              />
            </UDropdown>
          </div>

          <p v-if="team.description" class="text-sm text-gray-600 mb-2">
            {{ team.description }}
          </p>

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
        <UForm :schema="teamSchema" :state="teamFormState" class="space-y-4" @submit="onTeamSubmit">
          <!-- Nom de l'équipe -->
          <UFormField name="name" :label="t('editions.volunteers.team_name')">
            <UInput v-model="teamFormState.name" placeholder="Ex: Accueil" />
          </UFormField>

          <!-- Description -->
          <UFormField name="description" :label="t('common.description')">
            <UTextarea
              v-model="teamFormState.description"
              :placeholder="t('editions.volunteers.team_description_placeholder')"
              :rows="3"
            />
          </UFormField>

          <!-- Couleur -->
          <UFormField name="color" :label="t('editions.volunteers.team_color')">
            <div class="flex items-center gap-3">
              <input
                v-model="teamFormState.color"
                type="color"
                class="w-12 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <UInput v-model="teamFormState.color" placeholder="#3b82f6" class="flex-1" />
            </div>
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
            />
          </UFormField>
        </UForm>
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

// API
const { teams, createTeam, updateTeam, deleteTeam } = useVolunteerTeams(props.editionId)

// Schéma de validation
const teamSchema = z.object({
  name: z.string().min(1, t('errors.required_field')),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, t('errors.invalid_color')),
  maxVolunteers: z.number().int().positive().optional(),
})

// État du formulaire
const teamFormState = ref({
  name: '',
  description: '',
  color: '#3b82f6',
  maxVolunteers: undefined as number | undefined,
})

// Computed
const teamModalTitle = computed(() =>
  editingTeam.value ? t('editions.volunteers.edit_team') : t('editions.volunteers.create_team')
)

// Actions
const openCreateTeamModal = () => {
  editingTeam.value = null
  teamFormState.value = {
    name: '',
    description: '',
    color: '#3b82f6',
    maxVolunteers: undefined,
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
  } catch (error) {
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

const confirmDeleteTeam = async (team: VolunteerTeam) => {
  if (confirm(t('editions.volunteers.confirm_delete_team', { name: team.name }))) {
    try {
      loading.value = true
      await deleteTeam(team.id)
      toast.add({
        title: t('editions.volunteers.team_deleted'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      closeTeamModal()
    } catch (error) {
      toast.add({
        title: t('errors.error_occurred'),
        description: error.message || 'Erreur lors de la suppression',
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    } finally {
      loading.value = false
    }
  }
}
</script>
