<template>
  <div class="space-y-4">
    <!-- Header avec titre et badge (optionnel) -->
    <h4
      v-if="showHeader"
      class="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2"
    >
      <UIcon name="i-heroicons-clock" class="text-blue-600 dark:text-blue-400" />
      {{ headerTitle || t('pages.volunteers.assigned_time_slots') }}
      <UBadge color="info" variant="soft" size="sm">
        {{ timeSlots.length }}
      </UBadge>
    </h4>

    <!-- Statistiques rapides avec bouton export (optionnel) -->
    <div v-if="showStats" class="space-y-3">
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-clock" class="text-blue-600" size="20" />
            <div>
              <p class="text-xs text-gray-600 dark:text-gray-400">Total heures</p>
              <p class="text-lg font-semibold text-blue-600">{{ totalHoursFormatted }}</p>
            </div>
          </div>
        </div>
        <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-calendar-days" class="text-green-600" size="20" />
            <div>
              <p class="text-xs text-gray-600 dark:text-gray-400">Créneaux</p>
              <p class="text-lg font-semibold text-green-600">{{ timeSlots.length }}</p>
            </div>
          </div>
        </div>
        <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-user-group" class="text-purple-600" size="20" />
            <div>
              <p class="text-xs text-gray-600 dark:text-gray-400">Équipes</p>
              <p class="text-lg font-semibold text-purple-600">{{ uniqueTeamsCount }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Boutons d'export -->
      <div class="flex gap-2">
        <UButton
          color="success"
          variant="outline"
          icon="i-heroicons-calendar"
          size="sm"
          @click="exportToIcal"
        >
          {{ t('pages.volunteers.export_ical') }}
        </UButton>
        <UButton
          color="primary"
          variant="outline"
          icon="i-heroicons-document-arrow-down"
          size="sm"
          :loading="exportEnCours"
          @click="exportToPdf"
        >
          {{ t('pages.volunteers.export_pdf') }}
        </UButton>
      </div>
    </div>

    <!-- Liste des créneaux -->
    <div class="space-y-3">
      <VolunteersTimeSlotCard
        v-for="slot in timeSlots"
        :key="slot.id"
        :time-slot="slot"
        :show-duration="showDuration"
        :fuseau="fuseau"
        :ouvrable="ouvrable"
        @ouvrir="(creneau: TimeSlot) => emit('ouvrir', creneau)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDurationCompact } from '~/utils/date'

import {
  lignesDePlanning,
  nomFichierPlanning,
  resumerPlanning,
  type CreneauDePlanning,
} from '../../utils/planning-pdf'

import { fuseauUtilisable } from '~~/shared/utils/fuseau-edition'

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
  coVolunteers?: Array<{
    id: number
    pseudo: string
    emailHash: string
    profilePicture?: string | null
    updatedAt?: string
  }>
}

const props = withDefaults(
  defineProps<{
    timeSlots: TimeSlot[]
    showHeader?: boolean
    headerTitle?: string
    showStats?: boolean
    showDuration?: boolean
    editionName?: string
    volunteerName?: string
    /** Fuseau de l'édition : un créneau s'annonce à l'heure du LIEU. */
    fuseau?: string | null
    /** Rend les créneaux cliquables. Faux là où personne n'écoute `ouvrir`. */
    ouvrable?: boolean
  }>(),
  {
    showHeader: false,
    headerTitle: undefined,
    showStats: false,
    showDuration: false,
    editionName: undefined,
    volunteerName: undefined,
  }
)

const emit = defineEmits<{ ouvrir: [creneau: TimeSlot] }>()

/**
 * La liste ne décide pas de ce qu'ouvre un clic : elle le signale.
 *
 * Sur la page de bénévolat, l'écran ouvre la MÊME modale que le planning, avec les mêmes
 * données — c'est le même créneau, il doit se lire pareil d'où qu'on vienne. Héberger ici une
 * modale nourrie des seules données de la liste en aurait fabriqué une seconde, plus pauvre.
 */

const { t } = useI18n()

// Fonction pour formater le total d'heures de manière lisible
const totalHoursFormatted = computed(() => {
  let totalMs = 0

  props.timeSlots.forEach((slot) => {
    const start = new Date(slot.startDateTime)
    const end = new Date(slot.endDateTime)
    totalMs += end.getTime() - start.getTime()
  })

  return formatDurationCompact(totalMs)
})

// Fonction pour calculer le nombre d'équipes uniques
const uniqueTeamsCount = computed(() => {
  const teamIds = new Set(
    props.timeSlots.filter((slot) => slot.team?.id).map((slot) => slot.team!.id)
  )
  return teamIds.size
})

// Fonction pour formater une date au format iCal (YYYYMMDDTHHMMSS)
const formatIcalDate = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

// Fonction pour exporter les créneaux au format iCal
const exportToIcal = () => {
  // Générer le contenu du fichier iCal
  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Convention de Jonglerie//Planning Bénévoles//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  // Ajouter chaque créneau comme événement
  props.timeSlots.forEach((slot) => {
    const start = new Date(slot.startDateTime)
    const end = new Date(slot.endDateTime)
    const now = new Date()

    // Appliquer le retard si présent
    if (slot.delayMinutes) {
      start.setMinutes(start.getMinutes() + slot.delayMinutes)
      end.setMinutes(end.getMinutes() + slot.delayMinutes)
    }

    // Construire la description
    let description = slot.description || ''
    if (slot.team) {
      description = `Équipe: ${slot.team.name}${description ? '\\n' + description : ''}`
    }

    // Générer un UID unique
    const uid = `${slot.id}@convention-de-jonglerie.fr`

    icalContent.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatIcalDate(now)}`,
      `DTSTART:${formatIcalDate(start)}`,
      `DTEND:${formatIcalDate(end)}`,
      `SUMMARY:${slot.title}`,
      description ? `DESCRIPTION:${description}` : '',
      slot.team?.name ? `LOCATION:${slot.team.name}` : '',
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT'
    )
  })

  icalContent.push('END:VCALENDAR')

  // Filtrer les lignes vides
  const icalString = icalContent.filter((line) => line).join('\r\n')

  // Créer un blob et télécharger
  const blob = new Blob([icalString], { type: 'text/calendar;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url

  // Nom du fichier
  const fileName = props.editionName
    ? `planning-${props.editionName.toLowerCase().replace(/\s+/g, '-')}.ics`
    : 'planning-benevole.ics'

  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * L'export du planning.
 *
 * Il ouvrait auparavant une fenêtre et y écrivait une page HTML complète par concaténation. Deux
 * défauts pour un seul geste : les bloqueurs de fenêtres le faisaient échouer sans rien dire, et
 * l'échappement des champs libres était écrit sur place. Il produit désormais un vrai PDF, comme
 * la fiche d'inventaire du matériel, et ce qui en sort se décide dans `planning-pdf.ts`, à côté
 * de ses tests.
 */
const exportEnCours = ref(false)

const exportToPdf = async () => {
  const zone = fuseauUtilisable(props.fuseau)
  const lignes = lignesDePlanning(props.timeSlots as CreneauDePlanning[], {
    debut: (date) =>
      date.toLocaleString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: zone,
      }),
    fin: (date) =>
      date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: zone }),
  })

  if (lignes.length === 0) {
    useToast().add({
      title: t('pages.volunteers.export_pdf_empty'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'warning',
    })
    return
  }

  exportEnCours.value = true
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)

    const doc = new jsPDF()
    const MARGE = 14

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(t('pages.volunteers.export_pdf_title'), MARGE, 16)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const sousTitre = [props.volunteerName, props.editionName].filter(Boolean).join(' - ')
    if (sousTitre) doc.text(sousTitre, MARGE, 22)

    // Le résumé reprend exactement les trois chiffres de l'écran : la feuille imprimée et la page
    // doivent se répondre, sinon on doute de celle qu'on a sous les yeux.
    const resume = resumerPlanning(props.timeSlots as CreneauDePlanning[])
    doc.setFontSize(9)
    doc.text(
      t('pages.volunteers.export_pdf_summary', {
        creneaux: resume.creneaux,
        heures: formatDurationCompact(resume.dureeTotaleMs),
        equipes: resume.equipes,
      }),
      MARGE,
      sousTitre ? 28 : 22
    )

    // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
    doc.autoTable({
      startY: sousTitre ? 33 : 27,
      margin: { left: MARGE, right: MARGE },
      styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [37, 99, 235] },
      head: [
        [
          t('pages.volunteers.export_pdf_column_when'),
          t('pages.volunteers.export_pdf_column_slot'),
          t('pages.volunteers.export_pdf_column_team'),
        ],
      ],
      body: lignes.map((ligne) => [
        // Le retard est collé à l'horaire, pas relégué dans une colonne : c'est l'heure réelle
        // qui intéresse, et l'annoncer ailleurs la ferait lire deux fois.
        ligne.retardMinutes
          ? `${ligne.debut} → ${ligne.fin}\n${t('pages.volunteers.export_pdf_delay', { minutes: ligne.retardMinutes })}`
          : `${ligne.debut} → ${ligne.fin}`,
        ligne.description ? `${ligne.titre}\n${ligne.description}` : ligne.titre,
        ligne.equipe,
      ]),
      columnStyles: { 0: { cellWidth: 62 }, 2: { cellWidth: 34 } },
      // La couleur de l'équipe est conservée de l'ancien imprimé : sur place, elle répond aux
      // couleurs des bracelets et des panneaux. Sans elle, la colonne « Équipe » devient un mot
      // de plus au milieu des autres.
      didParseCell: (donnees: any) => {
        if (donnees.section !== 'body' || donnees.column.index !== 2) return
        const ligne = lignes[donnees.row.index]
        if (ligne?.equipe) donnees.cell.styles.textColor = ligne.couleurEquipe
      },
    })

    doc.save(nomFichierPlanning(props.volunteerName, props.editionName))
  } catch (e: any) {
    useToast().add({
      title: e?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    exportEnCours.value = false
  }
}
</script>
