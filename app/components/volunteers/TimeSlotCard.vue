<template>
  <div
    class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <p class="font-medium text-blue-900 dark:text-blue-100 text-sm mb-1">
          {{ timeSlot.title || t('pages.volunteers.unnamed_slot') }}
        </p>
        <div class="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 mb-2">
          <UIcon name="i-heroicons-calendar-days" class="w-3 h-3" />
          <span>
            {{ formatSlotDateTime(timeSlot.startDateTime, timeSlot.endDateTime) }}
          </span>
        </div>
        <div v-if="timeSlot.team" class="flex items-center gap-2">
          <div
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ backgroundColor: timeSlot.team.color || '#6b7280' }"
          ></div>
          <span class="text-xs text-gray-600 dark:text-gray-400 truncate">
            {{ timeSlot.team.name }}
          </span>
        </div>
        <p v-if="timeSlot.description" class="text-xs text-gray-500 mt-2">
          {{ timeSlot.description }}
        </p>
      </div>
      <div v-if="showDuration" class="text-right text-xs text-gray-500">
        {{ formatSlotDuration(timeSlot.startDateTime, timeSlot.endDateTime) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TimeSlot {
  id: string
  title: string
  startDateTime: string
  endDateTime: string
  description?: string
  team?: {
    id: string
    name: string
    color?: string
  }
}

withDefaults(
  defineProps<{
    timeSlot: TimeSlot
    showDuration?: boolean
  }>(),
  {
    showDuration: false,
  }
)

const { t } = useI18n()

// Fonction pour formater les dates et heures des créneaux
const formatSlotDateTime = (startDateTime: string, endDateTime: string) => {
  const start = new Date(startDateTime)
  const end = new Date(endDateTime)

  const dateStr = start.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  const startTimeStr = start.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const endTimeStr = end.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${dateStr} • ${startTimeStr} - ${endTimeStr}`
}

// Fonction pour formater la durée d'un créneau
const formatSlotDuration = (startDateTime: string, endDateTime: string) => {
  const start = new Date(startDateTime)
  const end = new Date(endDateTime)
  const durationMs = end.getTime() - start.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`
  }
  return `${minutes}m`
}
</script>
