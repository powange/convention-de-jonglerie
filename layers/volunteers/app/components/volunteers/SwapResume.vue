<template>
  <div class="space-y-1 text-sm">
    <div class="flex flex-wrap items-center gap-2">
      <UiUserDisplay :user="autre" size="xs" />
      <UBadge :color="couleurStatut" variant="subtle" size="xs">{{ libelleStatut }}</UBadge>
    </div>

    <!--
      Une phrase qui dit À QUI appartient chaque créneau, et non deux étiquettes « Cède / Reçoit ».
      Celles-ci étaient formulées du point de vue du lecteur, mais l'avatar juste au-dessus montre
      l'AUTRE personne : « Milou » suivi de « Cède » se lisait comme « Milou cède », c'est-à-dire
      l'inverse. Il fallait connaître la convention pour ne pas se tromper de sens — sur un écran
      où l'on clique ensuite « Accepter ».
    -->
    <p class="text-gray-600 dark:text-gray-400">{{ phraseDIntroduction }}</p>

    <!--
      La même carte que le planning personnel, plutôt qu'une ligne propre à cet écran : on
      reconnaît un créneau à sa forme — bordure colorée de l'équipe, horaire barré quand il est
      décalé, durée à droite. Deux représentations du même objet obligeaient à réapprendre à lire
      d'un écran à l'autre.

      L'étiquette est AU-DESSUS et non à côté : à côté, elle mangeait la largeur d'une carte déjà
      dense, et les deux créneaux ne s'alignaient plus.
    -->
    <dl class="space-y-2">
      <div>
        <dt class="mb-1 font-medium text-gray-600 dark:text-gray-400">
          {{ t('volunteers.swap_your_slot') }}
        </dt>
        <dd><VolunteersTimeSlotCard :time-slot="creneauCede" :fuseau="fuseau" show-duration /></dd>
      </div>
      <div>
        <dt class="mb-1 font-medium text-gray-600 dark:text-gray-400">
          {{ t('volunteers.swap_their_slot') }}
        </dt>
        <dd><VolunteersTimeSlotCard :time-slot="creneauRecu" :fuseau="fuseau" show-duration /></dd>
      </div>
    </dl>
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
  /** Fuseau de l'édition : un créneau s'annonce à l'heure du LIEU. */
  fuseau?: string | null
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

/**
 * Qui demande quoi, en toutes lettres.
 *
 * Le nom est repris DANS la phrase plutôt que laissé au seul avatar : c'est lui qui lève
 * l'ambiguïté sur le propriétaire de chaque créneau, et il se lit dans le même mouvement que
 * l'échange proposé.
 */
const phraseDIntroduction = computed(() =>
  jeSuisLeDemandeur.value
    ? t('volunteers.swap_sent_sentence', { nom: autre.value.pseudo })
    : t('volunteers.swap_received_sentence', { nom: autre.value.pseudo })
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
