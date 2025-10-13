<template>
  <div>
    <!-- Section notification des bénévoles -->
    <div class="mb-6">
      <!-- Bouton envoyer notification -->
      <div v-if="canManageVolunteers && acceptedVolunteersCount > 0" class="flex justify-center">
        <UButton
          size="lg"
          color="primary"
          variant="solid"
          icon="i-heroicons-bell"
          @click="openNotificationModal"
        >
          {{ t('editions.volunteers.send_notification') }}
        </UButton>
      </div>
    </div>

    <!-- Modal notification bénévoles -->
    <EditionVolunteerNotificationsModal
      v-model="showNotificationModal"
      :edition="edition"
      :volunteers-info="volunteersInfo"
      :volunteer-applications="volunteerApplications"
      @close="closeNotificationModal"
      @sent="onNotificationSent"
    />
  </div>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue'

interface Props {
  editionId: number
  edition: any
  volunteersInfo: any
  canManageVolunteers: boolean
  acceptedVolunteersCount: number
}

interface Emits {
  (e: 'notificationSent'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

// Modal notification
const showNotificationModal = ref(false)
const volunteerApplications = shallowRef<any[]>([])

// Gestion de la modal de notification
const openNotificationModal = async () => {
  // Charger les bénévoles acceptés avec leurs équipes assignées
  try {
    const applications = await $fetch(
      `/api/editions/${props.editionId}/volunteers/team-assignments`
    )

    // Transformer les teamAssignments en assignedTeams (tableau de noms d'équipes)
    volunteerApplications.value = applications.map((app: any) => ({
      ...app,
      status: 'ACCEPTED', // Tous sont acceptés par cette route
      assignedTeams: app.teamAssignments?.map((ta: any) => ta.team.name) || [],
    }))

    showNotificationModal.value = true
  } catch (error) {
    console.error('Erreur lors du chargement des applications:', error)
    showNotificationModal.value = true // Ouvrir quand même la modal
  }
}

const closeNotificationModal = () => {
  showNotificationModal.value = false
  volunteerApplications.value = []
}

const onNotificationSent = (data: any) => {
  // Notification envoyée avec succès
  console.log('Notification envoyée:', data)

  // Émettre l'événement pour informer le parent
  emit('notificationSent')
}
</script>
