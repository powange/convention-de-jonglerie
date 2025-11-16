<template>
  <UCard v-if="hasAssignedSlots" variant="soft">
    <template #header>
      <h3 class="text-lg font-semibold flex items-center gap-2">
        <UIcon name="i-heroicons-clock" class="text-blue-600 dark:text-blue-400" />
        {{ t('pages.volunteers.my_slots_title') }}
      </h3>
    </template>

    <VolunteersTimeSlotsList
      v-if="timeSlots.length > 0"
      :time-slots="timeSlots"
      :volunteer-name="volunteerFullName"
      show-stats
    />
  </UCard>
</template>

<script setup lang="ts">
interface TimeSlot {
  id: string
  title: string
  startDateTime: string
  endDateTime: string
  delayMinutes?: number | null
  description?: string
  team?: {
    id: string
    name: string
    color?: string
  }
}

interface TimeSlotAssignment {
  id: string
  timeSlot: TimeSlot
}

const props = defineProps<{
  editionId: number
  userId: number
}>()

const { t } = useI18n()
const { user } = useUserSession()

// Récupérer les créneaux assignés à l'utilisateur
const assignedTimeSlots = ref<TimeSlotAssignment[]>([])
const loading = ref(false)

// Nom complet du bénévole
const volunteerFullName = computed(() => {
  if (!user.value) return undefined
  return `${user.value.prenom} ${user.value.nom}`
})

const hasAssignedSlots = computed(() => {
  return assignedTimeSlots.value && assignedTimeSlots.value.length > 0
})

// Extraire uniquement les time slots pour le composant
const timeSlots = computed(() => {
  return assignedTimeSlots.value.map((assignment) => assignment.timeSlot)
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
