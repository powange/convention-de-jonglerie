<template>
  <div>
    <div v-if="initialLoading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6">
        <ManagementPageHeader
          :titre="$t('edition.volunteers.planning')"
          :description="$t('gestion.volunteers.planning_description')"
        />
      </div>

      <div class="space-y-6">
        <!-- Publier le planning.
             Tant qu'il ne l'est pas, les bénévoles ne voient ni leurs créneaux ni celui de
             l'édition : un responsable construit ses plannings par itérations, et voir apparaître
             puis disparaître des services donne des informations fausses qu'on note dans son
             agenda. Le filtre est serveur ; cet interrupteur ne fait que le commander. -->
        <UCard>
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <UIcon
                  :name="planningPublie ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'"
                  :class="planningPublie ? 'text-green-600' : 'text-gray-400'"
                />
                {{ t('volunteers.planning_publish_label') }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{
                  planningPublie
                    ? t('volunteers.planning_publish_on_hint')
                    : t('volunteers.planning_publish_off_hint')
                }}
              </p>
            </div>
            <USwitch
              :model-value="planningPublie"
              :loading="publicationEnCours"
              :disabled="publicationEnCours"
              @update:model-value="basculerPublication"
            />
          </div>
        </UCard>

        <!-- Contenu du planning -->
        <EditionVolunteerPlanningCard
          :edition="edition"
          :teams="teams"
          :time-slots="timeSlots"
          :can-manage-volunteers="canManageVolunteers"
          :refreshing="refreshing"
          :volunteers-stats="volunteersStats"
          :volunteers-stats-by-day="volunteersStatsByDay"
          :volunteers-stats-individual="volunteersStatsIndividual"
          :format-date="formatDate"
          :format-date-time-range="formatDateTimeRange"
          @create-slot="handleCreateSlot"
          @slot-click="handleSlotClick"
          @slot-update="handleSlotUpdate"
          @slot-delete="handleSlotDelete"
          @refresh="refreshData"
        />

        <!-- Alerte pour les chevauchements de créneaux -->
        <EditionVolunteerPlanningOverlapWarningsAlert
          :overlap-warnings="overlapWarnings"
          :preference-warnings="preferenceWarnings"
          :meal-time-warnings="mealTimeWarnings"
          :show-conflict-warnings="showConflictWarnings"
          :can-manage-volunteers="canManageVolunteers"
          :format-date-time-range="formatDateTimeRange"
          :format-date-time="formatDateTime"
        />

        <!-- Panneau d'auto-assignation -->
        <AutoAssignmentPanel
          v-if="canManageVolunteers && acceptedVolunteers.length > 0"
          :edition-id="editionId"
          :volunteers="acceptedVolunteers"
          :time-slots="convertedTimeSlots"
          :teams="[...teams]"
          :fuseau="fuseauEdition"
          class="mt-6"
          @assignments-applied="refreshData"
        />

        <!-- Résumé des bénévoles par jour -->
        <EditionVolunteerPlanningVolunteersSummary
          :can-manage-volunteers="canManageVolunteers"
          :volunteers-stats="volunteersStats"
          :volunteers-stats-by-day="volunteersStatsByDay"
          :volunteers-stats-individual="volunteersStatsIndividual"
          :volunteers-stats-by-team="volunteersStatsByTeam"
          :effectif-des-periodes="effectifDesPeriodes"
          :periodes-declarees="periodesDeclarees"
          :active-stats-tab="activeStatsTab"
          :format-date="formatDate"
          @volunteer-click="ouvrirCreneauxDuBenevole"
        />
      </div>

      <!-- Modal de détails du créneau (point d'entrée) -->
      <!-- Le détail des créneaux d'une personne, ouvert depuis le relevé par bénévole. -->
      <EditionVolunteerPlanningVolunteerSlotsModal
        v-model="creneauxBenevoleModalOpen"
        :user="benevoleObserve"
        :time-slots="convertedTimeSlots"
        :teams="convertedTeams"
        :format-date="formatDate"
        :fuseau="fuseauEdition"
        @slot-click="handleSlotClick"
      />

      <EditionVolunteerPlanningSlotDetailsModal
        v-model="slotDetailsModalOpen"
        :time-slot="selectedTimeSlot"
        :teams="[...teams]"
        :read-only="!canManageVolunteers"
        :fuseau="fuseauEdition"
        @edit-slot="handleEditSlotFromDetails"
        @manage-assignments="handleManageAssignments"
        @manage-delay="handleManageDelay"
      />

      <!-- Modal de gestion des assignations -->
      <EditionVolunteerPlanningAssignmentsModal
        v-model="assignmentsModalOpen"
        :edition-id="editionId"
        :time-slot="selectedTimeSlot"
        :fuseau="fuseauEdition"
        @refresh="refreshData"
      />

      <!-- Modal de gestion des retards -->
      <EditionVolunteerPlanningDelayModal
        v-model="delayModalOpen"
        :edition-id="editionId"
        :time-slot="selectedTimeSlot"
        :fuseau="fuseauEdition"
        @refresh="refreshData"
      />

      <!-- Modal de création/édition de créneau -->
      <SlotModal
        v-model="slotModalOpen"
        :teams="[...teams]"
        :edition-id="editionId"
        :initial-slot="slotModalData"
        :fuseau="fuseauEdition"
        :a-montage-ou-demontage="aMontageOuDemontage"
        @save="handleSlotSave"
        @delete="handleSlotDelete"
      />
    </div>

    <!-- Une seule modale pour les confirmations de l'écran. `confirm()` bloquait la page, ne
         suivait pas la langue choisie et ne disait jamais sur quoi portait l'action. -->
    <UiConfirmationDemandee :confirmation="confirmation" />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { effectifParPeriode, PERIODES } from '~/utils/effectif-par-periode'
import { detecterSpectaclesManques } from '~/utils/spectacles-manques'
import {
  calculateVolunteersStats,
  calculateVolunteersStatsByDay,
  calculateVolunteersStatsIndividual,
  calculateVolunteersStatsByTeam,
} from '~/utils/volunteer-stats'

import {
  EditionVolunteerPlanningSlotModal as SlotModal,
  EditionVolunteerAutoAssignmentPanel as AutoAssignmentPanel,
} from '#components'
import type { VolunteerTimeSlot, VolunteerTeamCalendar } from '#imports'

import { listeTronquee, pagesRestantes } from '../../../../../utils/pagination-complete'

import { fuseauUtilisable, versChampLocal } from '~~/shared/utils/fuseau-edition'

const { t } = useI18n()
const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const editionId = parseInt(route.params.id as string)

/**
 * Publier ou masquer le planning aux bénévoles.
 *
 * Passe par `useVolunteerSettings`, comme les autres réglages bénévoles — le même PATCH, la même
 * validation côté serveur. Rien de particulier ici : c'est un booléen de plus, et c'est
 * volontairement le cas, parce que tout ce qui protège vit côté serveur.
 */
const {
  settings: reglagesBenevoles,
  updating: publicationEnCours,
  fetchSettings: chargerReglagesBenevoles,
  updateSettings: enregistrerReglagesBenevoles,
} = useVolunteerSettings(editionId)

const planningPublie = computed(() => reglagesBenevoles.value?.planningPublished === true)

/**
 * Même forme que les interrupteurs de l'écran de configuration des bénévoles :
 * `updateSettings` relance l'erreur, et un échec avalé laisserait le responsable croire le
 * planning publié alors qu'il ne l'est pas — la pire des issues pour un réglage dont tout
 * l'intérêt est de savoir ce que les bénévoles voient.
 *
 * Pas de reprise de l'état à la main, en revanche : l'interrupteur lit `reglagesBenevoles`, que
 * `updateSettings` ne touche qu'en cas de succès. Il revient donc seul à sa position.
 */
const basculerPublication = async (publier: boolean) => {
  try {
    const enregistre = await enregistrerReglagesBenevoles({ planningPublished: publier })
    // Absent quand le serveur répond `{ unchanged }` : annoncer une publication qui n'a rien
    // changé induirait en erreur.
    if (!enregistre) return

    toast.add({
      title: publier
        ? t('volunteers.planning_published_toast')
        : t('volunteers.planning_unpublished_toast'),
      color: publier ? 'success' : 'neutral',
      icon: publier ? 'i-heroicons-eye' : 'i-heroicons-eye-slash',
    })
  } catch (e: any) {
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  }
}

const edition = computed(() => editionStore.getEditionById(editionId))

// État du composant
const refreshing = ref(false)
const initialLoading = ref(true)

// État des onglets de statistiques
const activeStatsTab = ref('hours-per-volunteer') // heures par bénévole par défaut

// Données des bénévoles
const volunteers = ref<any[]>([]) // Applications de bénévoles

// Programmation des spectacles, pour repérer ceux qu'un bénévole ne pourra voir sous aucune
// de leurs représentations
const spectacles = ref<any[]>([])

// État des modals
const slotDetailsModalOpen = ref(false)
/**
 * Typée, et non `ref<any>` : c'est ce `any` qui laissait lire `.start` sur un créneau qui n'en a
 * pas — le compilateur validait la ligne, et le champ arrivait `undefined` jusqu'à l'écran.
 */
const selectedTimeSlot = ref<VolunteerTimeSlot | null>(null)
const assignmentsModalOpen = ref(false)
const delayModalOpen = ref(false)
const slotModalOpen = ref(false)
const slotModalData = ref<any>(null)

// Utilisation des vraies APIs
const { teams, fetchTeams } = useVolunteerTeams(editionId)

// L'étendue « montage et démontage compris » n'a de sens que si l'édition en déclare au moins un
const aMontageOuDemontage = computed(() =>
  Boolean(
    (edition.value as any)?.volunteersSetupStartDate ||
    (edition.value as any)?.volunteersTeardownEndDate
  )
)
const { timeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot, fetchTimeSlots } =
  useVolunteerTimeSlots(editionId)

// Conversion des données API pour compatibilité avec FullCalendar
const convertedTimeSlots = computed(() => {
  return timeSlots.value.map(
    (slot): VolunteerTimeSlot => ({
      id: slot.id,
      title: slot.title,
      startDateTime: slot.startDateTime,
      endDateTime: slot.endDateTime,
      teamId: slot.teamId,
      maxVolunteers: slot.maxVolunteers,
      assignedVolunteers: slot.assignedVolunteers,
      color: slot.color,
      description: slot.description,
      delayMinutes: slot.delayMinutes,
      assignedVolunteersList: [...(slot.assignments || [])], // Copie directe des assignments
      assignedOrganizersList: [...(slot.organizerAssignments || [])],
      editionId, // Ajouter l'editionId au slot
    })
  )
})

const convertedTeams = computed(() => {
  return teams.value.map(
    (team): VolunteerTeamCalendar => ({
      id: team.id,
      name: team.name,
      color: team.color,
    })
  )
})

// Permissions calculées
const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Handlers pour les événements du composant de planning
const handleCreateSlot = (data: { startDateTime: string; endDateTime: string; teamId: string }) => {
  slotModalData.value = {
    title: '',
    description: '',
    teamId: data.teamId || '',
    startDateTime: versChampLocal(data.startDateTime, fuseauEdition.value),
    endDateTime: versChampLocal(data.endDateTime, fuseauEdition.value),
    maxVolunteers: 3,
  }
  slotModalOpen.value = true
}

// Le relevé par bénévole ouvre le détail de ses créneaux ; un clic sur l'un d'eux revient à
// l'avoir cliqué dans le planning.
const creneauxBenevoleModalOpen = ref(false)
const benevoleObserve = ref<any>(null)

const ouvrirCreneauxDuBenevole = (user: any) => {
  benevoleObserve.value = user
  creneauxBenevoleModalOpen.value = true
}

const handleSlotClick = (slot: any) => {
  // Ouvrir la modal de détails (point d'entrée)
  selectedTimeSlot.value = slot
  slotDetailsModalOpen.value = true
}

const handleEditSlotFromDetails = () => {
  // Préparer les données pour la modal d'édition
  if (selectedTimeSlot.value) {
    slotModalData.value = {
      id: selectedTimeSlot.value.id,
      title: selectedTimeSlot.value.title,
      description: selectedTimeSlot.value.description || '',
      teamId: selectedTimeSlot.value.teamId || '',
      // `startDateTime` / `endDateTime`, et non `start` / `end` : c'est le nom que l'API rend
      // depuis l'unification (cf. `VolunteerTimeSlot`). L'ancien nom ne levait aucune erreur —
      // il valait `undefined`, que `versChampLocal` traduit en chaîne vide. Les deux champs de
      // plage horaire s'ouvraient donc vides, et `isFormValid` laissait le bouton « Enregistrer »
      // désactivé : un créneau existant n'était plus modifiable du tout.
      startDateTime: versChampLocal(selectedTimeSlot.value.startDateTime, fuseauEdition.value),
      endDateTime: versChampLocal(selectedTimeSlot.value.endDateTime, fuseauEdition.value),
      maxVolunteers: selectedTimeSlot.value.maxVolunteers,
    }
    slotModalOpen.value = true
  }
}

const handleManageAssignments = () => {
  assignmentsModalOpen.value = true
}

const handleManageDelay = () => {
  delayModalOpen.value = true
}

const handleSlotUpdate = async (data: {
  id: string
  title: string
  description?: string
  teamId?: string
  startDateTime: string
  endDateTime: string
  maxVolunteers: number
}) => {
  try {
    await updateTimeSlot(data.id, {
      title: data.title,
      description: data.description,
      teamId: data.teamId,
      startDateTime: data.startDateTime,
      endDateTime: data.endDateTime,
      maxVolunteers: data.maxVolunteers,
    })
    toast.add({
      title: t('volunteers.slot_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string; statusText?: string }
    toast.add({
      title: t('errors.error_occurred'),
      description:
        err.data?.message || err.message || err.statusText || 'Erreur lors de la mise à jour',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const confirmation = useConfirmation()

const handleSlotDelete = (slotId: string) => {
  confirmation.demanderConfirmation({
    titre: t('common.delete'),
    description: t('volunteers.confirm_delete_slot'),
    libelleConfirmer: t('common.delete'),
    agir: () => performSlotDelete(slotId),
  })
}

const performSlotDelete = async (slotId: string) => {
  try {
    await deleteTimeSlot(slotId)
    toast.add({
      title: t('volunteers.slot_deleted'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string; statusText?: string }
    toast.add({
      title: t('errors.error_occurred'),
      description:
        err.data?.message || err.message || err.statusText || 'Erreur lors de la suppression',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

// Handlers pour la modal
const handleSlotSave = async (slotData: any) => {
  try {
    if (slotData.id) {
      // Mise à jour d'un créneau existant
      await updateTimeSlot(slotData.id, {
        title: slotData.title,
        description: slotData.description,
        teamId: slotData.teamId || undefined,
        startDateTime: slotData.start,
        endDateTime: slotData.end,
        maxVolunteers: slotData.maxVolunteers,
      })
      toast.add({
        title: t('volunteers.slot_updated'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else {
      // Création d'un nouveau créneau, éventuellement répété sur chaque journée
      const avant = timeSlots.value.length
      await createTimeSlot({
        title: slotData.title,
        description: slotData.description,
        teamId: slotData.teamId || undefined,
        startDateTime: slotData.start,
        endDateTime: slotData.end,
        maxVolunteers: slotData.maxVolunteers,
        recurrence: slotData.recurrence,
      })
      const crees = timeSlots.value.length - avant
      toast.add({
        // Une répétition crée plusieurs créneaux d'un coup : le dire évite d'avoir à les compter
        title:
          crees > 1
            ? t('volunteers.slots_created', { count: crees })
            : t('volunteers.slot_created'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string; statusText?: string }
    toast.add({
      title: t('errors.error_occurred'),
      description:
        err.data?.message || err.message || err.statusText || 'Erreur lors de la sauvegarde',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
  slotModalData.value = null
}

const refreshData = async () => {
  refreshing.value = true
  try {
    // Recharger les données depuis l'API en utilisant les fonctions déjà définies
    await Promise.all([
      fetchTeams(),
      fetchTimeSlots(),
      fetchAcceptedVolunteers(),
      fetchSpectacles(),
    ])
  } catch {
    toast.add({
      title: t('errors.error_occurred'),
      description: 'Erreur lors du rechargement des données',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    refreshing.value = false
  }
}

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) {
    return true
  }

  // Droit dédié « gérer les bénévoles » (convention ou édition).
  // Ni le droit d'éditer l'édition ni le simple statut d'organisateur ne
  // suffisent : le planning expose les données des bénévoles, et l'API
  // (canManageEditionVolunteers) applique la même règle.
  return canManageVolunteers.value
})

// Fonction utilitaire pour formater les dates
const formatDate = (dateStr: string) => {
  // `new Date('2026-09-25')` est lu comme MINUIT UTC, puis rendu dans le fuseau du navigateur :
  // à l'ouest de Greenwich, l'étiquette affichait la veille. Ces clés sont des dates de calendrier
  // sans heure — on les ancre donc à minuit LOCAL. Elles ne passent PAS par le fuseau de
  // l'édition : une clé de jour n'a pas d'instant, il n'y a donc rien à y convertir.
  const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * « mar. 2 oct. 14:00 - 16:00 » — dans le fuseau de l'ÉDITION.
 *
 * L'ancienne version extrayait les composants un à un pour « éviter les conversions de fuseau ».
 * Elle évitait surtout de choisir : elle lisait dans celui du navigateur. Un même créneau
 * s'annonçait donc à des heures différentes selon qui consultait le planning, et pouvait même
 * changer de JOUR en fin de soirée.
 *
 * `Intl` avec un `timeZone` fait le travail en deux formateurs. Sans fuseau déclaré, `undefined`
 * rend la machine — le comportement d'avant, conservé pour les éditions qui n'en ont pas.
 */
const formatDateTimeRange = (start: string, end: string) => {
  const zone = fuseauUtilisable(fuseauEdition.value)
  const debut = new Date(start.includes('T') ? start : `${start}T00:00:00`)
  const arrivee = new Date(end.includes('T') ? end : `${end}T00:00:00`)
  if (Number.isNaN(debut.getTime()) || Number.isNaN(arrivee.getTime())) return ''

  const jour = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: zone,
  })
  const heure = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: zone,
  })

  const jourDebut = jour.format(debut)
  const jourFin = jour.format(arrivee)

  // Le jour n'est répété que si le créneau franchit minuit — sur place, pas chez le lecteur.
  return jourDebut === jourFin
    ? `${jourDebut} ${heure.format(debut)} - ${heure.format(arrivee)}`
    : `${jourDebut} ${heure.format(debut)} - ${jourFin} ${heure.format(arrivee)}`
}

/**
 * Un instant seul, sans plage. Une représentation dont la durée n'est pas renseignée n'a pas de
 * fin connue : afficher « 20:00 - 20:00 » laisserait croire à un spectacle de durée nulle.
 * Même lecture locale des composants que ci-dessus, pour ne pas décaler d'un fuseau.
 */
const formatDateTime = (value: string) => {
  const instant = new Date(value.includes('T') ? value : value + 'T00:00:00')
  const jour = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(instant.getFullYear(), instant.getMonth(), instant.getDate()))
  const heures = instant.getHours().toString().padStart(2, '0')
  const minutes = instant.getMinutes().toString().padStart(2, '0')
  return `${jour} ${heures}:${minutes}`
}

// Détection des chevauchements de créneaux
const overlapWarnings = computed(() => {
  const warnings: Array<{
    volunteerId: number
    volunteer: any
    slot1: any
    slot2: any
  }> = []

  // Regrouper tous les créneaux par bénévole
  const volunteerSlots = new Map<number, Array<{ slot: any; assignment: any }>>()

  convertedTimeSlots.value.forEach((slot) => {
    // Vérifications basiques seulement
    if (!slot || !slot.id) return
    if (!slot.assignedVolunteersList || slot.assignedVolunteersList.length === 0) return

    slot.assignedVolunteersList.forEach((assignment) => {
      if (!assignment || !assignment.user || !assignment.user.id) return

      const userId = assignment.user.id
      if (!volunteerSlots.has(userId)) {
        volunteerSlots.set(userId, [])
      }
      volunteerSlots.get(userId)!.push({ slot, assignment })
    })
  })

  // Vérifier les chevauchements pour chaque bénévole
  volunteerSlots.forEach((slots, volunteerId) => {
    if (slots.length < 2) return // Pas de chevauchement possible avec moins de 2 créneaux

    // Comparer tous les couples de créneaux
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const slot1 = slots[i]?.slot
        const slot2 = slots[j]?.slot

        // Vérifications minimales
        if (!slot1 || !slot2 || slot1.id === slot2.id) continue

        // Vérifier si les créneaux se chevauchent
        const start1 = new Date(slot1.startDateTime)
        const end1 = new Date(slot1.endDateTime)
        const start2 = new Date(slot2.startDateTime)
        const end2 = new Date(slot2.endDateTime)

        // Condition de chevauchement : start1 < end2 && start2 < end1
        if (start1 < end2 && start2 < end1) {
          // Trouver les noms des équipes
          const team1 = convertedTeams.value.find((t) => t.id === slot1.teamId)
          const team2 = convertedTeams.value.find((t) => t.id === slot2.teamId)

          warnings.push({
            volunteerId,
            volunteer: slots[i]?.assignment?.user,
            slot1: {
              id: slot1.id,
              title: slot1.title || 'Sans titre',
              startDateTime: slot1.startDateTime,
              endDateTime: slot1.endDateTime,
              teamName: team1?.name || null,
            },
            slot2: {
              id: slot2.id,
              title: slot2.title || 'Sans titre',
              startDateTime: slot2.startDateTime,
              endDateTime: slot2.endDateTime,
              teamName: team2?.name || null,
            },
          })
        }
      }
    }
  })

  return warnings
})

// Détection des conflits de préférences d'équipe
const preferenceWarnings = computed(() => {
  const warnings: Array<{
    volunteerId: number
    volunteer: any
    slot: any
    teamName: string
  }> = []

  // Créer un map des préférences d'équipe par bénévole
  const volunteerTeamPreferences = new Map<number, string[]>()
  acceptedVolunteers.value.forEach((volunteer) => {
    if (volunteer.teamPreferences && Array.isArray(volunteer.teamPreferences)) {
      volunteerTeamPreferences.set(volunteer.user.id, volunteer.teamPreferences)
    }
  })

  // Vérifier chaque assignation
  convertedTimeSlots.value.forEach((slot) => {
    if (!slot || !slot.id || !slot.teamId) return
    if (!slot.assignedVolunteersList || slot.assignedVolunteersList.length === 0) return

    // Relevé ici plutôt que relu dans la boucle : le rétrécissement de type opéré par le garde
    // ci-dessus ne franchit pas la fonction imbriquée, et `teamId` y redevenait optionnel.
    const teamId = slot.teamId

    slot.assignedVolunteersList.forEach((assignment) => {
      if (!assignment || !assignment.user || !assignment.user.id) return

      const userId = assignment.user.id
      const preferences = volunteerTeamPreferences.get(userId)

      // Si le bénévole a des préférences d'équipe et que l'équipe du créneau n'en fait pas partie
      if (preferences && preferences.length > 0 && !preferences.includes(teamId)) {
        const team = convertedTeams.value.find((t) => t.id === teamId)

        warnings.push({
          volunteerId: userId,
          volunteer: assignment.user,
          slot: {
            id: slot.id,
            title: slot.title || 'Sans titre',
            startDateTime: slot.startDateTime,
            endDateTime: slot.endDateTime,
            teamName: team?.name || null,
          },
          teamName: team?.name || 'Équipe inconnue',
        })
      }
    })
  })

  return warnings
})

// Détection des conflits de repas (créneaux qui empêchent de manger)
const mealTimeWarnings = computed(() => {
  const warnings: Array<{
    volunteerId: number
    volunteer: any
    slot: any
    mealPeriod: 'lunch' | 'dinner'
  }> = []

  // Définir les périodes de repas
  const LUNCH_START = { hour: 11, minute: 30 }
  const LUNCH_END = { hour: 14, minute: 0 }
  const DINNER_START = { hour: 19, minute: 30 }
  const DINNER_END = { hour: 22, minute: 0 }

  // Fonction pour vérifier si un créneau couvre entièrement une période de repas
  const coversEntireMealPeriod = (
    slotStart: string,
    slotEnd: string,
    mealStart: { hour: number; minute: number },
    mealEnd: { hour: number; minute: number }
  ) => {
    const start = new Date(slotStart)
    const end = new Date(slotEnd)

    const mealStartTime = new Date(start)
    mealStartTime.setHours(mealStart.hour, mealStart.minute, 0, 0)

    const mealEndTime = new Date(start)
    mealEndTime.setHours(mealEnd.hour, mealEnd.minute, 0, 0)

    // Le créneau couvre la période de repas s'il commence avant ou au début du repas
    // et se termine après ou à la fin du repas
    return start <= mealStartTime && end >= mealEndTime
  }

  // Vérifier chaque assignation
  convertedTimeSlots.value.forEach((slot) => {
    if (!slot || !slot.id) return
    if (!slot.assignedVolunteersList || slot.assignedVolunteersList.length === 0) return

    slot.assignedVolunteersList.forEach((assignment) => {
      if (!assignment || !assignment.user || !assignment.user.id) return

      const userId = assignment.user.id

      // Vérifier si le créneau couvre la période du déjeuner
      if (coversEntireMealPeriod(slot.startDateTime, slot.endDateTime, LUNCH_START, LUNCH_END)) {
        const team = convertedTeams.value.find((t) => t.id === slot.teamId)

        warnings.push({
          volunteerId: userId,
          volunteer: assignment.user,
          slot: {
            id: slot.id,
            title: slot.title || 'Sans titre',
            startDateTime: slot.startDateTime,
            endDateTime: slot.endDateTime,
            teamName: team?.name || null,
          },
          mealPeriod: 'lunch',
        })
      }

      // Vérifier si le créneau couvre la période du dîner
      if (coversEntireMealPeriod(slot.startDateTime, slot.endDateTime, DINNER_START, DINNER_END)) {
        const team = convertedTeams.value.find((t) => t.id === slot.teamId)

        warnings.push({
          volunteerId: userId,
          volunteer: assignment.user,
          slot: {
            id: slot.id,
            title: slot.title || 'Sans titre',
            startDateTime: slot.startDateTime,
            endDateTime: slot.endDateTime,
            teamName: team?.name || null,
          },
          mealPeriod: 'dinner',
        })
      }
    })
  })

  return warnings
})

// Données pour le composant d'auto-assignation
const acceptedVolunteers = computed(() => {
  if (!volunteers.value || !Array.isArray(volunteers.value)) {
    return []
  }
  return volunteers.value.filter((v) => v.status === 'ACCEPTED')
})

// Fonction pour récupérer les bénévoles acceptés
/** La plus grande page que le point d'API accepte. Au-delà, il la ramène à cette valeur. */
const TAILLE_DE_PAGE = 100

/**
 * TOUTES les candidatures acceptées, et non la première page.
 *
 * ⚠️ Ce point d'API PAGINE — 20 par défaut. L'appel ne demandait rien : sur une édition de 42
 * acceptés, la page n'en voyait que 20. Le calculateur d'effectif l'annonçait tel quel, la moyenne
 * d'heures était calculée sur un effectif tronqué, et les acceptés au-delà du vingtième
 * disparaissaient du relevé individuel dès lors qu'ils ne tenaient aucun créneau. Rien ne le
 * signalait.
 *
 * ⚠️ Les équipes sont indispensables ici, alors que la page ne les affiche pas : ce sont elles qui
 * disent qui est bénévole VOLANT. Sans elles, les volants restaient comptés dans l'effectif et
 * dans la moyenne d'heures, et aucun repère ne les distinguait — le réglage paraissait sans effet.
 */
const fetchAcceptedVolunteers = async () => {
  const demanderPage = async (page: number) => {
    const reponse: any = await $fetch(`/api/editions/${editionId}/volunteers/applications`, {
      query: {
        status: 'ACCEPTED',
        includeTeams: 'true',
        page,
        pageSize: TAILLE_DE_PAGE,
      },
    })
    // L'API rend { success: true, data: [...], pagination: {...} }
    const liste = reponse?.data ?? reponse?.applications ?? reponse
    return {
      candidatures: Array.isArray(liste) ? liste : [],
      total: Number(reponse?.pagination?.total ?? NaN),
    }
  }

  try {
    const premiere = await demanderPage(1)
    const toutes = [...premiere.candidatures]

    for (const page of pagesRestantes(premiere.total, TAILLE_DE_PAGE)) {
      const suivante = await demanderPage(page)
      toutes.push(...suivante.candidatures)
    }

    // Se taire sur une liste incomplète, c'est afficher un effectif faux avec aplomb — le
    // défaut même que ce chargement corrige.
    if (listeTronquee(toutes.length, premiere.total)) {
      console.warn(
        `Candidatures acceptées : ${toutes.length} reçues sur ${premiere.total} annoncées.`
      )
    }

    volunteers.value = toutes
  } catch {
    volunteers.value = []
  }
}

// Les spectacles ne sont pas indispensables au planning : s'ils manquent, l'avertissement
// correspondant se tait plutôt que de faire échouer la page entière.
const fetchSpectacles = async () => {
  try {
    const response: any = await $fetch(`/api/editions/${editionId}/volunteers/shows-schedule`)
    const liste = response?.data ?? response
    spectacles.value = Array.isArray(liste) ? liste : []
  } catch {
    spectacles.value = []
  }
}

// Bénévoles dont les créneaux couvrent toutes les représentations d'un même spectacle
const showConflictWarnings = computed(() =>
  detecterSpectaclesManques(
    spectacles.value,
    convertedTimeSlots.value,
    (teamId) => convertedTeams.value.find((team) => team.id === teamId)?.name || null
  )
)

// Calcul des statistiques des bénévoles en utilisant les utilitaires
const volunteersStats = computed(() =>
  calculateVolunteersStats(convertedTimeSlots.value, acceptedVolunteers.value)
)

/**
 * Le fuseau de l'édition, qui décide à quelle journée appartient chaque créneau.
 *
 * Sans lui, les relevés découpaient les jours en UTC quand le planning les affichait en heure
 * locale : un créneau de 00h30 était compté la veille. Voir `jour-edition`.
 *
 * Il sert aussi à remplir la modale de créneau : ce qu'elle affiche doit être l'heure du LIEU,
 * la même que celle lue sur le calendrier juste à côté.
 */
const fuseauEdition = computed(() => edition.value?.timezone ?? null)

/**
 * Les bornes des trois périodes : montage, événement, démontage.
 *
 * Le montage et le démontage sont facultatifs. Quand leurs dates manquent, la période n'existe
 * pas — ce n'est pas la même chose qu'une période sans créneau, et la modale le dit.
 */
const bornesDesPeriodes = computed(() => ({
  startDate: edition.value?.startDate ?? '',
  endDate: edition.value?.endDate ?? '',
  setupStartDate: reglagesBenevoles.value?.setupStartDate ?? null,
  teardownEndDate: reglagesBenevoles.value?.teardownEndDate ?? null,
}))

const periodesDeclarees = computed(() =>
  PERIODES.filter((periode) => {
    if (periode === 'evenement') return true
    const borne =
      periode === 'montage'
        ? bornesDesPeriodes.value.setupStartDate
        : bornesDesPeriodes.value.teardownEndDate
    return !!borne
  })
)

/** Le dimensionnement de chaque période, pour le calculateur d'effectif. */
const effectifDesPeriodes = computed(() =>
  effectifParPeriode(
    convertedTimeSlots.value,
    teams.value ?? [],
    bornesDesPeriodes.value,
    acceptedVolunteers.value
  )
)

const volunteersStatsByDay = computed(() =>
  calculateVolunteersStatsByDay(
    convertedTimeSlots.value,
    acceptedVolunteers.value,
    fuseauEdition.value
  )
)

// Les équipes servent à nommer et colorer les lignes ; le libellé de repli est traduit ici,
// l'utilitaire de calcul ne connaissant pas l'i18n.
const volunteersStatsByTeam = computed(() =>
  calculateVolunteersStatsByTeam(
    convertedTimeSlots.value,
    teams.value ?? [],
    t('volunteers.no_team'),
    fuseauEdition.value
  )
)

const volunteersStatsIndividual = computed(() =>
  calculateVolunteersStatsIndividual(
    convertedTimeSlots.value,
    acceptedVolunteers.value,
    fuseauEdition.value
  )
)

// Permissions calculées
// Charger l'édition si nécessaire
onMounted(async () => {
  try {
    await Promise.all([
      edition.value ? Promise.resolve() : editionStore.fetchEditionById(editionId, { force: true }),
      fetchAcceptedVolunteers(),
      fetchTeams(),
      fetchTimeSlots(),
      fetchSpectacles(),
      // Sans ce chargement, l'interrupteur s'afficherait éteint sur une édition publiée : le
      // réglage vient d'ici, pas de l'objet édition.
      chargerReglagesBenevoles(),
    ])
  } catch {
    toast.add({
      title: t('errors.error_occurred'),
      description: t('volunteers.loading_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    initialLoading.value = false
  }
})

// Métadonnées de la page
useSeoMeta({
  title: 'Planning des bénévoles - ' + (edition.value?.name || 'Édition'),
  description: 'Planification des créneaux et missions des bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
