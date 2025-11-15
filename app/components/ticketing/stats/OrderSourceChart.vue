<template>
  <div class="w-full h-96 flex items-center justify-center">
    <Doughnut v-if="chartData" :data="chartData" :options="chartOptions" :plugins="chartPlugins" />
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
  type Plugin,
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
        'rgba(59, 130, 246, 0.8)', // blue-500 pour manuel
        'rgba(16, 185, 129, 0.8)', // green-500 pour externe
      ],
      borderColor: ['rgba(59, 130, 246, 1)', 'rgba(16, 185, 129, 1)'],
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

// Détecter le mode sombre
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

// Plugin personnalisé pour afficher le total au centre et les valeurs sur les segments
const chartPlugins = computed<Plugin<'doughnut'>[]>(() => [
  {
    id: 'customLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex)
        if (!meta.data) return

        ctx.save()
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        meta.data.forEach((element: any, index: number) => {
          const data = dataset.data[index] as number
          if (data === 0) return // Ne pas afficher les segments à 0

          // Calculer la position au milieu de l'arc
          const { x, y } = element.tooltipPosition()

          // Calculer le pourcentage
          const percentage = index === 0 ? manualPercentage.value : externalPercentage.value

          // Dessiner le nombre (valeur absolue)
          ctx.font = 'bold 18px sans-serif'
          ctx.fillText(data.toString(), x, y - 10)

          // Dessiner le pourcentage
          ctx.font = 'bold 14px sans-serif'
          ctx.fillText(`(${percentage}%)`, x, y + 12)
        })

        ctx.restore()
      })
    },
    beforeDraw(chart) {
      const { ctx, chartArea } = chart
      if (!chartArea) return

      const centerX = (chartArea.left + chartArea.right) / 2
      const centerY = (chartArea.top + chartArea.bottom) / 2

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Afficher le nombre total
      ctx.font = 'bold 36px sans-serif'
      ctx.fillStyle = isDark.value ? '#f9fafb' : '#111827' // gray-50 en dark, gray-900 en light
      ctx.fillText(props.data.total.toString(), centerX, centerY - 10)

      // Afficher le label "Total"
      ctx.font = '14px sans-serif'
      ctx.fillStyle = isDark.value ? '#9ca3af' : '#6b7280' // gray-400 en dark, gray-500 en light
      ctx.fillText(t('gestion.ticketing.stats_total'), centerX, centerY + 25)

      ctx.restore()
    },
  },
])
</script>
