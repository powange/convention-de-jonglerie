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
    participantsManual: number[]
    participantsExternal: number[]
    othersManual: number[]
    othersExternal: number[]
  }
  showParticipants?: boolean
  showOthers?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showParticipants: true,
  showOthers: true,
})

const { t } = useI18n()
const { getParticipantTypeConfig } = useParticipantTypes()

// Récupérer les configurations de couleurs
const ticketConfig = getParticipantTypeConfig('ticket')

// Construire les datasets en fonction des filtres
const chartData = computed<ChartData<'bar'>>(() => {
  const datasets = []

  if (props.showParticipants) {
    datasets.push({
      label:
        t('gestion.ticketing.stats_participants') +
        ' (' +
        t('gestion.ticketing.stats_source_manual') +
        ')',
      data: props.data.participantsManual,
      backgroundColor: ticketConfig.chartBgColor,
      borderColor: ticketConfig.chartBorderColor,
      borderWidth: 1,
    })
    datasets.push({
      label:
        t('gestion.ticketing.stats_participants') +
        ' (' +
        t('gestion.ticketing.stats_source_external') +
        ')',
      data: props.data.participantsExternal,
      backgroundColor: 'rgba(99, 102, 241, 0.6)', // indigo-500 plus transparent
      borderColor: 'rgba(99, 102, 241, 1)',
      borderWidth: 1,
    })
  }

  if (props.showOthers) {
    datasets.push({
      label:
        t('gestion.ticketing.stats_others') +
        ' (' +
        t('gestion.ticketing.stats_source_manual') +
        ')',
      data: props.data.othersManual,
      backgroundColor: 'rgba(107, 114, 128, 0.8)', // gray-500
      borderColor: 'rgba(107, 114, 128, 1)',
      borderWidth: 1,
    })
    datasets.push({
      label:
        t('gestion.ticketing.stats_others') +
        ' (' +
        t('gestion.ticketing.stats_source_external') +
        ')',
      data: props.data.othersExternal,
      backgroundColor: 'rgba(107, 114, 128, 0.5)', // gray-500 plus transparent
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
          return `${label}: ${value} ${value > 1 ? t('gestion.ticketing.stats_purchases') : t('gestion.ticketing.stats_purchase')}`
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
        text: t('gestion.ticketing.stats_purchases_count'),
      },
    },
  },
}))
</script>
