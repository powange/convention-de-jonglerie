<template>
  <UCard v-if="hasAssignedSlots" variant="soft">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <UIcon name="i-heroicons-clock" class="text-blue-600 dark:text-blue-400" />
          {{ t('pages.volunteers.my_slots_title') }}
          <UBadge color="info" variant="soft" size="sm">
            {{ assignedTimeSlots.length }}
          </UBadge>
        </h3>
      </div>
    </template>

    <div class="space-y-4">
      <!-- Statistiques rapides -->
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-clock" class="text-blue-600" size="20" />
            <div>
              <p class="text-xs text-gray-600 dark:text-gray-400">Total heures</p>
              <p class="text-lg font-semibold text-blue-600">{{ totalHours }}h</p>
            </div>
          </div>
        </div>
        <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-calendar-days" class="text-green-600" size="20" />
            <div>
              <p class="text-xs text-gray-600 dark:text-gray-400">Créneaux</p>
              <p class="text-lg font-semibold text-green-600">{{ assignedTimeSlots.length }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Liste des créneaux -->
      <div class="space-y-3">
        <VolunteersTimeSlotCard
          v-for="assignment in assignedTimeSlots"
          :key="assignment.id"
          :time-slot="assignment.timeSlot"
        />
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface TimeSlotAssignment {
  id: string
  timeSlot: {
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
}

const props = defineProps<{
  editionId: number
  userId: number
}>()

const { t } = useI18n()

// Récupérer les créneaux assignés à l'utilisateur
const assignedTimeSlots = ref<TimeSlotAssignment[]>([])
const loading = ref(false)

const hasAssignedSlots = computed(() => {
  return assignedTimeSlots.value && assignedTimeSlots.value.length > 0
})

// Fonction pour calculer le total d'heures
const totalHours = computed(() => {
  let totalMs = 0

  assignedTimeSlots.value.forEach((assignment) => {
    const start = new Date(assignment.timeSlot.startDateTime)
    const end = new Date(assignment.timeSlot.endDateTime)
    totalMs += end.getTime() - start.getTime()
  })

  const totalHours = totalMs / (1000 * 60 * 60)
  return totalHours.toFixed(1)
})

// Charger les créneaux assignés
const fetchAssignedSlots = async () => {
  loading.value = true
  try {
    const application = await $fetch(`/api/editions/${props.editionId}/volunteers/my-application`)
    if (application && application.assignedTimeSlots) {
      assignedTimeSlots.value = application.assignedTimeSlots
    }
  } catch (error) {
    console.error('Erreur lors du chargement des créneaux:', error)
    assignedTimeSlots.value = []
  } finally {
    loading.value = false
  }
}

// Charger les créneaux au montage du composant
onMounted(() => {
  fetchAssignedSlots()
})
</script>
