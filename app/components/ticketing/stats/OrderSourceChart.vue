<template>
  <div class="w-full h-96 flex items-center justify-center">
    <Doughnut v-if="chartData" :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Doughnut } from 'vue-chartjs'

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(ArcElement, Tooltip, Legend)

interface Props {
  data: {
    manual: number
    external: number
    total: number
  }
  showOrders?: boolean // Si true, affiche les commandes, sinon affiche les items
}

const props = withDefaults(defineProps<Props>(), {
  showOrders: false,
})

const { t } = useI18n()

// Calculer les pourcentages
const manualPercentage = computed(() => {
  if (props.data.total === 0) return 0
  return Math.round((props.data.manual / props.data.total) * 100)
})

const externalPercentage = computed(() => {
  if (props.data.total === 0) return 0
  return Math.round((props.data.external / props.data.total) * 100)
})

// Construire les données du graphique
const chartData = computed<ChartData<'doughnut'>>(() => ({
  labels: [
    t('gestion.ticketing.stats_source_manual'),
    t('gestion.ticketing.stats_source_external'),
  ],
  datasets: [
    {
      data: [props.data.manual, props.data.external],
      backgroundColor: [
        'rgba(16, 185, 129, 0.8)', // green-500 pour manuel
        'rgba(59, 130, 246, 0.8)', // blue-500 pour externe
      ],
      borderColor: ['rgba(16, 185, 129, 1)', 'rgba(59, 130, 246, 1)'],
      borderWidth: 2,
    },
  ],
}))

const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
          size: 14,
        },
      },
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          const label = context.label || ''
          const value = context.parsed
          const percentage =
            context.dataIndex === 0 ? manualPercentage.value : externalPercentage.value
          const itemType = props.showOrders
            ? value > 1
              ? t('gestion.ticketing.stats_orders')
              : t('gestion.ticketing.stats_order')
            : value > 1
              ? t('gestion.ticketing.stats_items')
              : t('gestion.ticketing.stats_item')
          return `${label}: ${value} ${itemType} (${percentage}%)`
        },
      },
    },
  },
  cutout: '60%', // Taille du trou au centre (pour le style donut)
}))
</script>
