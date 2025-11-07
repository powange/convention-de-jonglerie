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
  }
  showParticipants?: boolean
  showVolunteers?: boolean
  showArtists?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showParticipants: true,
  showVolunteers: true,
  showArtists: true,
})

const { t } = useI18n()

// Construire les datasets en fonction des filtres
const chartData = computed<ChartData<'bar'>>(() => {
  const datasets = []

  if (props.showParticipants) {
    datasets.push({
      label: t('gestion.ticketing.stats_participants'),
      data: props.data.participants,
      backgroundColor: 'rgba(59, 130, 246, 0.8)', // blue-500
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1,
    })
  }

  if (props.showVolunteers) {
    datasets.push({
      label: t('gestion.ticketing.stats_volunteers'),
      data: props.data.volunteers,
      backgroundColor: 'rgba(16, 185, 129, 0.8)', // green-500
      borderColor: 'rgba(16, 185, 129, 1)',
      borderWidth: 1,
    })
  }

  if (props.showArtists) {
    datasets.push({
      label: t('gestion.ticketing.stats_artists'),
      data: props.data.artists,
      backgroundColor: 'rgba(245, 158, 11, 0.8)', // amber-500
      borderColor: 'rgba(245, 158, 11, 1)',
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
      stacked: false,
      grid: {
        display: false,
      },
    },
    y: {
      stacked: false,
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
