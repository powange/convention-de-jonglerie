<template>
  <div class="space-y-1 text-sm">
    <div class="flex flex-wrap items-center gap-2">
      <UiUserDisplay :user="autre" size="xs" />
      <UBadge :color="couleurStatut" variant="subtle" size="xs">{{ libelleStatut }}</UBadge>
    </div>

    <!-- Toujours formulé du point de vue de qui lit : « vous cédez / vous recevez ». Nommer les
         deux personnes obligerait à relire deux fois pour savoir de quel côté on est. -->
    <p class="text-gray-600 dark:text-gray-400">
      <span class="font-medium">{{ t('volunteers.swap_gives') }}</span>
      {{ formatCreneau(creneauCede) }}
    </p>
    <p class="text-gray-600 dark:text-gray-400">
      <span class="font-medium">{{ t('volunteers.swap_receives') }}</span>
      {{ formatCreneau(creneauRecu) }}
    </p>
  </div>
</template>

<script setup lang="ts">
interface Creneau {
  startDateTime: string
  endDateTime: string
  title?: string | null
}

interface Affectation {
  timeSlot: Creneau
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

const formatCreneau = (c: Creneau) => {
  const d = new Date(c.startDateTime)
  const f = new Date(c.endDateTime)
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  const heure = (x: Date) => x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${jour} ${heure(d)}–${heure(f)}${c.title ? ` · ${c.title}` : ''}`
}

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
