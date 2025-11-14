<template>
  <div class="w-full h-96">
    <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
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

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface Props {
  data: {
    labels: string[]
    participants: number[]
    volunteers: number[]
    artists: number[]
    organizers: number[]
    others: number[]
  }
  showParticipants?: boolean
  showVolunteers?: boolean
  showArtists?: boolean
  showOrganizers?: boolean
  showOthers?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showParticipants: true,
  showVolunteers: true,
  showArtists: true,
  showOrganizers: true,
  showOthers: true,
})

const { t } = useI18n()
const { getParticipantTypeConfig } = useParticipantTypes()

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

  return {
    labels: props.data.labels,
    datasets,
  }
})

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
          const value = context.parsed.y
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
