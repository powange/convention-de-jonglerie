<template>
  <div
    :draggable="!isMobile"
    class="relative flex items-center gap-3 text-sm p-2 rounded group hover:bg-gray-100 dark:hover:bg-gray-700"
    :class="isMobile ? 'cursor-pointer' : 'cursor-move'"
    @click="handleClick"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <UIcon name="i-heroicons-bars-3" class="text-gray-400" size="16" />
    <UiUserAvatar :user="volunteer.user" size="lg" class="flex-shrink-0" />
    <div class="min-w-0 flex-1">
      <p class="text-gray-700 dark:text-gray-300 font-medium truncate">
        {{ volunteer.user.prenom }} {{ volunteer.user.nom }}
      </p>
      <p class="text-xs text-gray-500 truncate">{{ volunteer.user.email }}</p>
      <div class="flex items-center gap-1 mt-1">
        <div
          v-if="volunteer.teamPreferences && volunteer.teamPreferences.length > 0"
          class="flex items-center gap-1"
        >
          <UIcon name="i-heroicons-heart" class="text-red-500" size="12" />
          <span class="text-xs text-gray-600 dark:text-gray-400">
            {{ $t('pages.volunteers.team_distribution.preferences_label') }}
            {{ teamPreferencesText }}
          </span>
        </div>
        <div v-else class="flex items-center gap-1">
          <UIcon name="i-heroicons-globe-alt" class="text-blue-500" size="12" />
          <span class="text-xs text-blue-600 dark:text-blue-400">
            {{ $t('pages.volunteers.team_distribution.all_teams') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Badge responsable visible si leader (uniquement si teamId fourni) -->
    <UBadge v-if="teamId && isLeader" color="warning" size="sm" class="ml-auto mt-5">
      <UIcon name="i-heroicons-star-solid" size="12" />
      {{ $t('pages.volunteers.team_distribution.leader_badge') }}
    </UBadge>

    <!-- Boutons au survol (uniquement si teamId fourni pour les actions) -->
    <div
      v-if="teamId"
      class="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
    >
      <!-- Toggle responsable -->
      <UButton
        :icon="isLeader ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
        size="sm"
        :color="isLeader ? 'warning' : 'neutral'"
        variant="outline"
        :title="
          isLeader
            ? $t('pages.volunteers.team_distribution.remove_as_leader')
            : $t('pages.volunteers.team_distribution.set_as_leader')
        "
        @click.stop="$emit('toggle-leader', volunteer, teamId)"
      />
      <!-- Désassigner -->
      <UButton
        icon="material-symbols-light:delete-outline"
        size="sm"
        color="error"
        variant="outline"
        @click.stop="$emit('unassign', volunteer, teamId)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  volunteer: any
  teamId?: string
  teamPreferencesText?: string
  isMobile?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  teamId: undefined,
  teamPreferencesText: '',
  isMobile: false,
})

const emit = defineEmits<{
  click: [volunteer: any, teamId?: string]
  dragstart: [volunteer: any, teamId?: string]
  dragend: []
  'toggle-leader': [volunteer: any, teamId: string]
  unassign: [volunteer: any, teamId: string]
}>()

// Vérifier si le bénévole est leader de l'équipe
const isLeader = computed(() => {
  if (!props.teamId || !props.volunteer.teamAssignments) return false
  const assignment = props.volunteer.teamAssignments.find((a: any) => a.teamId === props.teamId)
  return assignment?.isLeader || false
})

const handleClick = () => {
  emit('click', props.volunteer, props.teamId)
}

const handleDragStart = () => {
  emit('dragstart', props.volunteer, props.teamId)
}

const handleDragEnd = () => {
  emit('dragend')
}
</script>
