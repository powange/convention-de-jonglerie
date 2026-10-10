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

    <!-- Ce que veut dire la hachure. Dit une fois, en clair : la légende du graphique porte les
         catégories, pas les éditions, et un aplat contre une hachure ne se devine pas. -->
    <div
      v-if="comparaison"
      class="flex flex-wrap items-center justify-center gap-4 mb-3 text-sm text-gray-600 dark:text-gray-400"
    >
      <span class="flex items-center gap-1.5">
        <span
          class="w-4 h-4 rounded-sm shrink-0 ring-1 ring-black/10 dark:ring-white/20"
          :style="APLAT_CSS"
        />
        {{ $t('gestion.ticketing.stats_compare_current') }}
      </span>
      <span class="flex items-center gap-1.5">
        <span
          class="w-4 h-4 rounded-sm shrink-0 ring-1 ring-black/10 dark:ring-white/20"
          :style="MOTIF_CSS"
        />
        {{ comparaison.libelle }}
      </span>
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

import { etiquettesDesAchats } from '../../../utils/etiquettes-dachats'
import {
  APLAT_CSS,
  MOTIF_CSS,
  basculerLesDeuxEditions,
  jeuCompare,
  jeuCourant,
  sansLesJumelles,
  type SerieDeGraphique,
} from '../../../utils/motifs-graphiques'

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface Props {
  data: {
    /**
     * Les instants de début de chaque tranche. Le serveur ne compose plus les libellés : la langue
     * de l'axe est celle du lecteur, et l'heure celle du LIEU.
     */
    timestamps: string[]
    /** Le fuseau dans lequel les tranches ont été découpées. */
    timezone?: string | null
    participantsManual: number[]
    participantsExternal: number[]
    othersManual: number[]
    othersExternal: number[]
  }
  /**
   * La granularité choisie, en minutes — elle décide de la FORME de l'étiquette.
   *
   * Une tranche de douze heures a besoin de son heure, une tranche d'un mois n'a que faire du jour
   * de la semaine. Le serveur composait ces quatre formes lui-même ; il rend maintenant des
   * instants, et c'est ici qu'on sait laquelle convient.
   */
  granularite?: number
  showParticipants?: boolean
  showOthers?: boolean
  /**
   * Les étiquettes de l'axe, quand la page en impose.
   *
   * En comparaison, l'axe ne porte plus des dates mais des repères — « J1 », « J-30 » —, parce que
   * deux éditions qui n'ont pas eu lieu aux mêmes dates n'ont aucune date commune. Absent, le
   * composant compose les siennes depuis les instants.
   */
  etiquettes?: string[] | null
  /**
   * L'édition à laquelle on se compare, déjà alignée sur le même axe que `data`, série par série.
   *
   * Et non son seul total : une comparaison qui ne dit pas D'OÙ vient l'écart n'apprend presque
   * rien — vendre autant que l'an dernier en ayant basculé du guichet vers la billetterie en
   * ligne n'est pas la même nouvelle. Chaque série retrouve donc sa jumelle, dans sa propre
   * couleur, hachurée, dans une pile posée à côté de celle de l'édition en cours.
   */
  comparaison?: {
    libelle: string
    series: Record<string, (number | null)[]>
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  granularite: 1440,
  showParticipants: true,
  showOthers: true,
  etiquettes: null,
  comparaison: null,
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
    const title = t('gestion.ticketing.stats_purchases_chart_title')
    const filename = `achats-billets-${new Date().toISOString().split('T')[0]}`
    await exportChartToPDF(chartContainer.value, filename, title)
  } catch (error) {
    console.error("Erreur lors de l'export PDF:", error)
  } finally {
    exporting.value = false
  }
}

// Récupérer les configurations de couleurs
const ticketConfig = getParticipantTypeConfig('ticket')

/**
 * Les étiquettes des tranches, composées ICI.
 *
 * Le serveur rendait « Lun 15/06 » avec `setLocale('fr')` et l'heure d'UTC : la langue de l'axe
 * était décidée par le serveur, et un achat passé à 0 h 30 sur place s'affichait la veille. Il rend
 * désormais des instants, et le fuseau dans lequel il les a découpés.
 *
 * La règle de mise en forme vit dans `etiquettes-dachats`, avec ses tests : ici on ne fait que lui
 * donner la langue de l'écran et la façon de dire « Semaine du … », qu'elle ne peut pas traduire
 * elle-même.
 */
const etiquettes = computed(() =>
  etiquettesDesAchats(
    props.data.timestamps,
    props.granularite,
    props.data.timezone,
    locale.value,
    (date) => t('gestion.ticketing.stats_week_of', { date })
  )
)

/**
 * Les étiquettes réellement tracées : celles que la page impose en comparaison, sinon les dates.
 *
 * Déclarée ICI, au-dessus de son unique lecteur : un `computed` déclaré plus bas que son usage a
 * déjà cassé une page de ce dépôt, par zone morte temporelle.
 */
const etiquettesAffichees = computed(() => props.etiquettes ?? etiquettes.value)

/**
 * Les séries visibles, décrites une fois.
 *
 * La description précède le dessin parce qu'il y a désormais DEUX éditions à tracer avec les
 * mêmes couleurs et les mêmes libellés : la jumelle hachurée se déduit de la série, au lieu
 * d'être une seconde liste à tenir en phase avec la première.
 */
const seriesVisibles = computed<SerieDeGraphique[]>(() => {
  const series: SerieDeGraphique[] = []
  const manuel = t('gestion.ticketing.stats_source_manual')
  const externe = t('gestion.ticketing.stats_source_external')

  if (props.showParticipants) {
    series.push({
      cle: 'participantsManual',
      label: `${t('gestion.ticketing.stats_participants')} (${manuel})`,
      fond: ticketConfig.chartBgColor,
      bordure: ticketConfig.chartBorderColor,
      valeurs: props.data.participantsManual,
    })
    series.push({
      cle: 'participantsExternal',
      label: `${t('gestion.ticketing.stats_participants')} (${externe})`,
      fond: 'rgba(99, 102, 241, 0.6)', // indigo-500 plus transparent
      bordure: 'rgba(99, 102, 241, 1)',
      valeurs: props.data.participantsExternal,
    })
  }

  if (props.showOthers) {
    series.push({
      cle: 'othersManual',
      label: `${t('gestion.ticketing.stats_others')} (${manuel})`,
      fond: 'rgba(107, 114, 128, 0.8)', // gray-500
      bordure: 'rgba(107, 114, 128, 1)',
      valeurs: props.data.othersManual,
    })
    series.push({
      cle: 'othersExternal',
      label: `${t('gestion.ticketing.stats_others')} (${externe})`,
      fond: 'rgba(107, 114, 128, 0.5)', // gray-500 plus transparent
      bordure: 'rgba(107, 114, 128, 1)',
      valeurs: props.data.othersExternal,
    })
  }

  return series
})

const chartData = computed<ChartData<'bar'>>(() => {
  const comparaison = props.comparaison
  // Les deux piles l'une après l'autre, et non entrelacées : Chart.js groupe les barres par
  // `stack`, et l'ordre des jeux décide de l'empilement DANS chaque pile. Les mêmes séries
  // doivent s'empiler dans le même ordre des deux côtés pour se lire en vis-à-vis.
  const datasets: unknown[] = seriesVisibles.value.map((serie) => jeuCourant(serie))
  if (comparaison) {
    for (const serie of seriesVisibles.value) datasets.push(jeuCompare(serie, comparaison))
  }

  return {
    labels: etiquettesAffichees.value,
    datasets: datasets as ChartData<'bar'>['datasets'],
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
        filter: sansLesJumelles,
      },
      onClick: basculerLesDeuxEditions,
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
