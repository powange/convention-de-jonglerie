<template>
  <EditionVolunteerCarteRepliable
    v-if="hasAssignedSlots"
    :titre="t('pages.volunteers.my_slots_title')"
    icone="i-heroicons-clock"
    classe-icone="text-blue-600 dark:text-blue-400"
    :repliable-sur-mobile="repliableSurMobile"
    :deplie-par-defaut="deplieParDefaut"
  >
    <!-- Proposé seulement quand il y a quelque chose à révéler : un interrupteur sans effet
         est une question posée pour rien. -->
    <USwitch
      v-if="creneauxPasses > 0"
      v-model="afficherPasses"
      :label="t('pages.volunteers.show_past_slots', { count: creneauxPasses })"
      class="mb-4"
    />

    <VolunteersTimeSlotsList
      v-if="creneauxAffiches.length > 0"
      :time-slots="creneauxAffiches"
      :volunteer-name="volunteerFullName"
      show-stats
    />

    <p v-else class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('pages.volunteers.no_upcoming_slots') }}
    </p>
  </EditionVolunteerCarteRepliable>
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

const props = withDefaults(
  defineProps<{
    editionId: number
    userId: number
    repliableSurMobile?: boolean
    deplieParDefaut?: boolean
  }>(),
  { repliableSurMobile: false, deplieParDefaut: false }
)

const { t } = useI18n()
const { user } = useUserSession()

// Récupérer les créneaux assignés à l'utilisateur
const assignedTimeSlots = ref<TimeSlotAssignment[]>([])
const loading = ref(false)

// Nom complet du bénévole (avec pronom si renseigné)
const volunteerFullName = computed(() => {
  if (!user.value) return undefined
  return formatUserFullName(user.value, t) || undefined
})

const hasAssignedSlots = computed(() => {
  return assignedTimeSlots.value && assignedTimeSlots.value.length > 0
})

// Extraire uniquement les time slots pour le composant
const timeSlots = computed(() => {
  return assignedTimeSlots.value.map((assignment) => assignment.timeSlot)
})

// Les créneaux déjà terminés encombrent la liste sans rien apprendre : masqués par défaut,
// consultables d'un geste. Le retard éventuel repousse la fin d'autant — un créneau décalé
// n'est pas passé tant qu'il ne l'est vraiment.
const afficherPasses = ref(false)

const estPasse = (creneau: TimeSlot) => {
  const fin = new Date(creneau.endDateTime).getTime()
  if (Number.isNaN(fin)) return false
  return fin + (creneau.delayMinutes || 0) * 60_000 < Date.now()
}

const creneauxPasses = computed(() => timeSlots.value.filter(estPasse).length)

const creneauxAffiches = computed(() =>
  afficherPasses.value ? timeSlots.value : timeSlots.value.filter((creneau) => !estPasse(creneau))
)

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
