<template>
  <div class="space-y-6">
    <!-- Gestionnaire de notifications (bouton + modal) -->
    <EditionVolunteerNotificationsManager
      :edition-id="editionId"
      :edition="edition"
      :volunteers-info="volunteersInfo"
      :can-manage-volunteers="canManageVolunteers"
      :accepted-volunteers-count="acceptedVolunteersCount"
      @notification-sent="onNotificationSent"
    />

    <!-- Historique des notifications -->
    <EditionVolunteerNotificationsHistory ref="historyRef" :edition-id="editionId" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  editionId: number
  edition: any
  volunteersInfo: any
  canManageVolunteers: boolean
  acceptedVolunteersCount: number
}

defineProps<Props>()

// Référence au composant historique
const historyRef = ref()

// Gestion des événements
const onNotificationSent = () => {
  // Rafraîchir l'historique des notifications
  if (historyRef.value) {
    historyRef.value.refresh()
  }
}

// Méthode pour rafraîchir depuis le parent
const refresh = () => {
  if (historyRef.value) {
    historyRef.value.refresh()
  }
}

// Exposer la méthode refresh pour le parent
defineExpose({
  refresh,
})
</script>
