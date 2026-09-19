<template>
  <div>
    <!-- Bouton d'export -->
    <div class="flex justify-end mb-4">
      <UButton
        icon="i-heroicons-arrow-down-tray"
        variant="outline"
        :loading="exporting"
        @click="handleExport"
      >
        {{ $t('gestion.ticketing.stats_export_pdf') }}
      </UButton>
    </div>

    <!-- Graphique -->
    <div ref="chartContainer" class="w-full h-96">
      <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Bar } from 'vue-chartjs'

import { formaterJournee } from '~~/shared/utils/fuseau-edition'

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface Props {
  data: {
    /** Les instants de début de chaque tranche. Le serveur ne compose plus les libellés : la
     *  langue de l'écran est celle du lecteur, et l'heure celle du LIEU. */
    timestamps: string[]
    /** Le fuseau dans lequel les tranches ont été découpées. */
    timezone?: string | null
    participants: number[]
    volunteers: number[]
    artists: number[]
    organizers: number[]
    others: number[]
    /** Les annulations d'entrée, série à part : elles ne se retranchent pas des arrivées. */
    cancellations?: number[]
  }
  showParticipants?: boolean
  showVolunteers?: boolean
  showArtists?: boolean
  showOrganizers?: boolean
  showOthers?: boolean
  showCancellations?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showParticipants: true,
  showVolunteers: true,
  showArtists: true,
  showOrganizers: true,
  showOthers: true,
  showCancellations: true,
})

const { t, locale } = useI18n()
const { getParticipantTypeConfig } = useParticipantTypes()
const { exportChartToPDF } = useChartExport()

// Référence au conteneur du graphique
const chartContainer = ref<HTMLElement | null>(null)
const exporting = ref(false)

// Fonction d'export
const handleExport = async () => {
  if (!chartContainer.value) return

  exporting.value = true
  try {
    const title = t('gestion.ticketing.stats_chart_title')
    const filename = `validations-acces-${new Date().toISOString().split('T')[0]}`
    await exportChartToPDF(chartContainer.value, filename, title)
  } catch (error) {
    console.error("Erreur lors de l'export PDF:", error)
  } finally {
    exporting.value = false
  }
}

// Récupérer les configurations de couleurs
const ticketConfig = getParticipantTypeConfig('ticket')
const volunteerConfig = getParticipantTypeConfig('volunteer')
const artistConfig = getParticipantTypeConfig('artist')
const organizerConfig = getParticipantTypeConfig('organizer')

// Construire les datasets en fonction des filtres
const chartData = computed<ChartData<'bar'>>(() => {
  const datasets = []

  if (props.showParticipants) {
    datasets.push({
      label: t('gestion.ticketing.stats_participants'),
      data: props.data.participants,
      backgroundColor: ticketConfig.chartBgColor,
      borderColor: ticketConfig.chartBorderColor,
      borderWidth: 1,
    })
  }

  if (props.showVolunteers) {
    datasets.push({
      label: t('gestion.ticketing.stats_volunteers'),
      data: props.data.volunteers,
      backgroundColor: volunteerConfig.chartBgColor,
      borderColor: volunteerConfig.chartBorderColor,
      borderWidth: 1,
    })
  }

  if (props.showArtists) {
    datasets.push({
      label: t('gestion.ticketing.stats_artists'),
      data: props.data.artists,
      backgroundColor: artistConfig.chartBgColor,
      borderColor: artistConfig.chartBorderColor,
      borderWidth: 1,
    })
  }

  if (props.showOrganizers) {
    datasets.push({
      label: t('gestion.ticketing.stats_organizers'),
      data: props.data.organizers,
      backgroundColor: organizerConfig.chartBgColor,
      borderColor: organizerConfig.chartBorderColor,
      borderWidth: 1,
    })
  }

  if (props.showOthers) {
    datasets.push({
      label: t('gestion.ticketing.stats_others'),
      data: props.data.others,
      backgroundColor: 'rgba(107, 114, 128, 0.8)', // gray-500
      borderColor: 'rgba(107, 114, 128, 1)',
      borderWidth: 1,
    })
  }

  if (props.showCancellations && props.data.cancellations?.some((n) => n > 0)) {
    // Une série à part, et seulement quand il y en a : sur une édition antérieure au 19/09/2026,
    // la reprise du journal n'a reconstitué aucune annulation — une série vide s'y lirait comme
    // « personne n'a jamais annulé », alors qu'on ne peut plus le savoir.
    datasets.push({
      label: t('gestion.ticketing.stats_cancellations'),
      data: props.data.cancellations,
      backgroundColor: 'rgba(220, 38, 38, 0.8)', // red-600
      borderColor: 'rgba(220, 38, 38, 1)',
      borderWidth: 1,
    })
  }

  return {
    labels: etiquettes.value,
    datasets,
  }
})

/**
 * Les étiquettes des tranches, composées ICI.
 *
 * Le serveur rendait « Lun 15/06 14h » avec `setLocale('fr')` et l'heure d'UTC : la langue était
 * décidée par le serveur, et un afflux à 18 h sur place s'affichait à 16 h. Il rend désormais des
 * instants, et le fuseau dans lequel il les a découpés.
 */
const etiquettes = computed(() =>
  props.data.timestamps.map((instant) =>
    formaterJournee(instant, props.data.timezone, locale.value, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  )
)

const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        usePointStyle: true,
        padding: 15,
      },
    },
    title: {
      display: false,
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: (context) => {
          const label = context.dataset.label || ''
          // `?? 0` : un point sans valeur affichait « null » dans l'infobulle.
          const value = context.parsed.y ?? 0
          return `${label}: ${value} ${value > 1 ? t('gestion.ticketing.stats_validations') : t('gestion.ticketing.stats_validation')}`
        },
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      grid: {
        display: false,
      },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      ticks: {
        stepSize: 1,
      },
      title: {
        display: true,
        text: t('gestion.ticketing.stats_validations_count'),
      },
    },
  },
}))
</script>
