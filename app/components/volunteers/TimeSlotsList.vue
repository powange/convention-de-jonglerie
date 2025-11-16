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
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDurationCompact } from '~/utils/date'

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

const props = withDefaults(
  defineProps<{
    timeSlots: TimeSlot[]
    showHeader?: boolean
    headerTitle?: string
    showStats?: boolean
    showDuration?: boolean
    editionName?: string
    volunteerName?: string
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

// Fonction pour exporter en PDF
const exportToPdf = () => {
  // Créer un contenu HTML pour l'impression
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  // Générer le HTML
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Planning - ${props.editionName || 'Convention de Jonglerie'}</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          color: #1f2937;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 10px;
        }
        .stats {
          display: flex;
          gap: 20px;
          margin: 20px 0;
          padding: 15px;
          background: #f3f4f6;
          border-radius: 8px;
        }
        .stat {
          flex: 1;
        }
        .stat-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
        }
        .time-slot {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
          page-break-inside: avoid;
        }
        .time-slot-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .time-slot-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }
        .time-slot-time {
          color: #6b7280;
          font-size: 14px;
        }
        .time-slot-team {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 500;
          margin-top: 8px;
        }
        .time-slot-description {
          color: #4b5563;
          margin-top: 8px;
          font-size: 14px;
        }
        .delay-badge {
          display: inline-block;
          background: #fef3c7;
          color: #92400e;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          margin-left: 8px;
        }
        @media print {
          body { padding: 0; }
          .time-slot { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>Planning Bénévole${props.volunteerName ? ` - ${props.volunteerName}` : ''}${props.editionName ? ` - ${props.editionName}` : ''}</h1>

      <div class="stats">
        <div class="stat">
          <div class="stat-label">Total heures</div>
          <div class="stat-value">${totalHoursFormatted.value}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Créneaux</div>
          <div class="stat-value">${props.timeSlots.length}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Équipes</div>
          <div class="stat-value">${uniqueTeamsCount.value}</div>
        </div>
      </div>

      <div class="time-slots">
  `

  // Ajouter chaque créneau
  props.timeSlots.forEach((slot) => {
    const start = new Date(slot.startDateTime)
    const end = new Date(slot.endDateTime)

    // Appliquer le retard si présent
    if (slot.delayMinutes) {
      start.setMinutes(start.getMinutes() + slot.delayMinutes)
      end.setMinutes(end.getMinutes() + slot.delayMinutes)
    }

    const formatTime = (date: Date) => {
      return date.toLocaleString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    const teamColor = slot.team?.color || '#3b82f6'

    html += `
      <div class="time-slot">
        <div class="time-slot-header">
          <div class="time-slot-title">
            ${slot.title}
            ${slot.delayMinutes ? `<span class="delay-badge">Retard: ${slot.delayMinutes}min</span>` : ''}
          </div>
        </div>
        <div class="time-slot-time">
          ${formatTime(start)} → ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        ${slot.team ? `<div class="time-slot-team" style="background-color: ${teamColor}22; color: ${teamColor};">${slot.team.name}</div>` : ''}
        ${slot.description ? `<div class="time-slot-description">${slot.description}</div>` : ''}
      </div>
    `
  })

  html += `
      </div>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()

  // Attendre que le contenu soit chargé avant d'imprimer
  printWindow.onload = () => {
    printWindow.print()
    printWindow.onafterprint = () => {
      printWindow.close()
    }
  }
}
</script>
