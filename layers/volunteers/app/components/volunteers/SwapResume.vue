<template>
  <div class="space-y-1 text-sm">
    <div class="flex flex-wrap items-center gap-2">
      <UiUserDisplay :user="autre" size="xs" />
      <UBadge :color="couleurStatut" variant="subtle" size="xs">{{ libelleStatut }}</UBadge>
    </div>

    <!-- Toujours formulé du point de vue de qui lit : « vous cédez / vous recevez ». Nommer les
         deux personnes obligerait à relire deux fois pour savoir de quel côté on est. -->
    <div class="flex gap-2 text-gray-600 dark:text-gray-400">
      <span class="shrink-0 font-medium">{{ t('volunteers.swap_gives') }}</span>
      <VolunteersCreneauLigne :creneau="creneauCede" />
    </div>
    <div class="flex gap-2 text-gray-600 dark:text-gray-400">
      <span class="shrink-0 font-medium">{{ t('volunteers.swap_receives') }}</span>
      <VolunteersCreneauLigne :creneau="creneauRecu" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CreneauLisible } from '../../composables/useCreneauLisible'

interface Affectation {
  timeSlot: CreneauLisible
  user?: { id: number; pseudo: string }
}

const props = defineProps<{
  demande: {
    status: string
    requester: { id: number; pseudo: string }
    target: { id: number; pseudo: string }
    requesterAssignment: Affectation
    targetAssignment: Affectation
  }
  /** `sent` : je suis le demandeur. `received` : la proposition m'est adressée. */
  pointDeVue: 'sent' | 'received'
}>()

const { t } = useI18n()

const jeSuisLeDemandeur = computed(() => props.pointDeVue === 'sent')

const autre = computed(() =>
  jeSuisLeDemandeur.value ? props.demande.target : props.demande.requester
)

/** Ce que JE cède, et ce que JE reçois — les rôles s'inversent selon le côté. */
const creneauCede = computed(() =>
  jeSuisLeDemandeur.value
    ? props.demande.requesterAssignment.timeSlot
    : props.demande.targetAssignment.timeSlot
)
const creneauRecu = computed(() =>
  jeSuisLeDemandeur.value
    ? props.demande.targetAssignment.timeSlot
    : props.demande.requesterAssignment.timeSlot
)

const libelleStatut = computed(() =>
  t(`volunteers.swap_status_${props.demande.status.toLowerCase()}`)
)

const couleurStatut = computed(
  () =>
    (
      ({
        PENDING_PEER: 'warning',
        PENDING_MANAGER: 'info',
        ACCEPTED: 'success',
        REFUSED: 'error',
        CANCELLED: 'neutral',
        EXPIRED: 'neutral',
      }) as Record<string, 'warning' | 'info' | 'success' | 'error' | 'neutral'>
    )[props.demande.status] ?? 'neutral'
)
</script>
