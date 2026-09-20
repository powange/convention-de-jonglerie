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

    <!-- Lequel des deux anneaux est lequel. Un cercle n'a pas d'axe où l'écrire, et rien dans la
         légende ne le disait : elle porte les sources, pas les éditions. -->
    <div
      v-if="comparaison"
      class="flex flex-wrap items-center justify-center gap-4 mb-3 text-sm text-gray-600 dark:text-gray-400"
    >
      <span class="flex items-center gap-1.5">
        <span
          class="w-4 h-4 rounded-sm shrink-0 ring-1 ring-black/10 dark:ring-white/20"
          :style="APLAT_CSS"
        />
        {{ $t('gestion.ticketing.stats_compare_inner') }}
      </span>
      <span class="flex items-center gap-1.5">
        <span
          class="w-4 h-4 rounded-sm shrink-0 ring-1 ring-black/10 dark:ring-white/20"
          :style="MOTIF_CSS"
        />
        {{
          $t('gestion.ticketing.stats_compare_outer', {
            edition: comparaison.libelle,
          })
        }}
      </span>
    </div>

    <!-- Graphique -->
    <div ref="chartContainer" class="w-full h-96 flex items-center justify-center">
      <Doughnut
        v-if="chartData"
        :data="chartData"
        :options="chartOptions"
        :plugins="chartPlugins"
      />
    </div>
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

import { APLAT_CSS, MOTIF_CSS, motifRaye } from '../../../utils/motifs-graphiques'

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(ArcElement, Tooltip, Legend)

/** Les couleurs des deux sources, communes aux deux anneaux : seule la texture les distingue. */
const COULEURS = ['rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)'] // blue-500, green-500
const BORDURES = ['rgba(59, 130, 246, 1)', 'rgba(16, 185, 129, 1)']

interface Props {
  data: {
    manual: number
    external: number
    total: number
  }
  showOrders?: boolean // Si true, affiche les commandes, sinon affiche les items
  /**
   * L'édition à laquelle on se compare.
   *
   * Un anneau n'a pas d'axe : la comparaison s'y lit comme un SECOND ANNEAU concentrique, à
   * l'extérieur. C'est la façon idiomatique de comparer deux touts — deux camemberts côte à côte
   * obligeraient à faire l'aller-retour du regard pour comparer des angles.
   *
   * Il reprend les MÊMES couleurs, hachurées : un anneau simplement plus pâle ne disait pas
   * lequel des deux était lequel, et rien dans la légende ne pouvait l'apprendre.
   */
  comparaison?: { libelle: string; manual: number; external: number } | null
}

const props = withDefaults(defineProps<Props>(), {
  showOrders: false,
  comparaison: null,
})

const { t } = useI18n()
const { exportChartToPDF } = useChartExport()

// Référence au conteneur du graphique
const chartContainer = ref<HTMLElement | null>(null)
const exporting = ref(false)

// Fonction d'export
const handleExport = async () => {
  if (!chartContainer.value) return

  exporting.value = true
  try {
    const title = props.showOrders
      ? t('gestion.ticketing.stats_order_sources_title')
      : t('gestion.ticketing.stats_order_sources_title')
    const filename = `sources-commandes-${new Date().toISOString().split('T')[0]}`
    await exportChartToPDF(chartContainer.value, filename, title)
  } catch (error) {
    console.error("Erreur lors de l'export PDF:", error)
  } finally {
    exporting.value = false
  }
}

/**
 * La part d'une valeur dans un tout.
 *
 * Prend son total en argument, et c'est le point : les pourcentages étaient calculés sur
 * le total de la propriété `data` — celui de l'édition en cours — puis écrits sur les DEUX
 * anneaux. L'anneau
 * comparé affichait donc ses vraies valeurs assorties des parts de l'autre édition. Un chiffre
 * faux mais plausible, que rien ne signalait.
 */
const part = (valeur: number, total: number) =>
  total === 0 ? 0 : Math.round((valeur / total) * 100)

/** Le total de l'édition comparée, tel qu'il se lit au centre et sert aux parts de son anneau. */
const totalCompare = computed(() =>
  props.comparaison ? props.comparaison.manual + props.comparaison.external : 0
)

// Construire les données du graphique
const chartData = computed<ChartData<'doughnut'>>(() => {
  const datasets: ChartData<'doughnut'>['datasets'] = [
    {
      label: props.comparaison ? t('gestion.ticketing.stats_compare_current') : undefined,
      data: [props.data.manual, props.data.external],
      backgroundColor: COULEURS,
      borderColor: BORDURES,
      borderWidth: 2,
    } as any,
  ]

  if (props.comparaison) {
    // Placé APRÈS, donc dessiné à l'extérieur : l'année en cours reste au centre, là où le
    // regard se pose d'abord.
    datasets.push({
      label: props.comparaison.libelle,
      data: [props.comparaison.manual, props.comparaison.external],
      backgroundColor: COULEURS.map((couleur) => motifRaye(couleur)),
      borderColor: BORDURES,
      borderWidth: 2,
    } as any)
  }

  return {
    labels: [
      t('gestion.ticketing.stats_source_manual'),
      t('gestion.ticketing.stats_source_external'),
    ],
    datasets,
  }
})

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
        // Le survol d'un anneau dit d'abord DE QUELLE ÉDITION il s'agit : deux anneaux
        // concentriques portent les mêmes libellés de source, et rien ne les distinguait.
        title: (contexts) => contexts[0]?.dataset?.label ?? '',
        label: (context) => {
          const label = context.label || ''
          const value = context.parsed
          // La part se calcule sur le total de l'anneau survolé, pas sur celui de l'édition en
          // cours : sinon l'anneau comparé affiche ses vraies valeurs et les parts de l'autre.
          const totalDeLAnneau = (context.dataset.data as number[]).reduce(
            (somme, n) => somme + (typeof n === 'number' ? n : 0),
            0
          )
          const percentage = part(value, totalDeLAnneau)
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

        // Le total de CET anneau : ses parts se calculent sur lui, pas sur l'édition en cours.
        const valeurs = dataset.data as number[]
        const totalDeLAnneau = valeurs.reduce(
          (somme, n) => somme + (typeof n === 'number' ? n : 0),
          0
        )
        // L'anneau comparé est hachuré, donc bien plus pâle : du blanc y serait illisible en
        // mode clair. Le premier anneau, lui, reste un aplat sur lequel le blanc tranche.
        const estCompare = datasetIndex > 0

        ctx.save()
        ctx.fillStyle = estCompare ? (isDark.value ? '#f9fafb' : '#111827') : '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        meta.data.forEach((element: any, index: number) => {
          const data = valeurs[index] as number
          if (data === 0) return // Ne pas afficher les segments à 0

          // Calculer la position au milieu de l'arc
          const { x, y } = element.tooltipPosition()

          const percentage = part(data, totalDeLAnneau)

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

      // En comparaison, le total de l'autre édition juste en dessous : c'est le chiffre qu'on
      // vient chercher, et le lire en additionnant les segments d'un anneau n'a rien d'évident.
      if (props.comparaison) {
        ctx.font = '13px sans-serif'
        ctx.fillText(`${props.comparaison.libelle} : ${totalCompare.value}`, centerX, centerY + 48)
      }

      ctx.restore()
    },
  },
])
</script>
