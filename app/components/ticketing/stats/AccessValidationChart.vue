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
    others: number[]
  }
  showParticipants?: boolean
  showVolunteers?: boolean
  showArtists?: boolean
  showOthers?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showParticipants: true,
  showVolunteers: true,
  showArtists: true,
  showOthers: true,
})

const { t } = useI18n()

// Construire les datasets en fonction des filtres
const chartData = computed<ChartData<'bar'>>(() => {
  const datasets = []

  if (props.showParticipants) {
    datasets.push({
      label: t('gestion.ticketing.stats_participants'),
      data: props.data.participants,
      backgroundColor: 'rgba(251, 146, 60, 0.8)', // orange-500
      borderColor: 'rgba(251, 146, 60, 1)',
      borderWidth: 1,
    })
  }

  if (props.showVolunteers) {
    datasets.push({
      label: t('gestion.ticketing.stats_volunteers'),
      data: props.data.volunteers,
      backgroundColor: 'rgba(168, 85, 247, 0.8)', // purple-500
      borderColor: 'rgba(168, 85, 247, 1)',
      borderWidth: 1,
    })
  }

  if (props.showArtists) {
    datasets.push({
      label: t('gestion.ticketing.stats_artists'),
      data: props.data.artists,
      backgroundColor: 'rgba(34, 197, 94, 0.8)', // green-500
      borderColor: 'rgba(34, 197, 94, 1)',
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
