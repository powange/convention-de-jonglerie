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

import {
  APLAT_CSS,
  MOTIF_CSS,
  basculerLesDeuxEditions,
  jeuCompare,
  jeuCourant,
  sansLesJumelles,
  type SerieDeGraphique,
} from '../../../utils/motifs-graphiques'

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
  /**
   * Les étiquettes de l'axe, quand la page en impose.
   *
   * En comparaison, l'axe ne porte plus des dates mais des repères — « J1 », « J-30 » —, parce
   * que deux éditions qui n'ont pas eu lieu aux mêmes dates n'ont aucune date commune. Absent,
   * le composant compose les siennes depuis les instants, comme avant.
   */
  etiquettes?: string[] | null
  /**
   * L'édition comparée, déjà alignée sur le même axe, série par série.
   *
   * Et non son seul total : une comparaison qui ne dit pas D'OÙ vient l'écart n'apprend presque
   * rien. Chaque série retrouve donc sa jumelle, dans sa propre couleur, hachurée — les deux
   * piles se lisent côte à côte, catégorie par catégorie.
   */
  comparaison?: {
    libelle: string
    series: Record<string, (number | null)[]>
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  showParticipants: true,
  showVolunteers: true,
  showArtists: true,
  showOrganizers: true,
  showOthers: true,
  showCancellations: true,
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

/**
 * Les étiquettes réellement tracées.
 *
 * Celles que la page impose quand elle compare deux éditions — « J1 », « J-30 » —, sinon les
 * dates composées ci-dessus. Déclarée ICI, au-dessus de son unique lecteur : un `computed`
 * déclaré plus bas que son usage a déjà cassé une page de ce dépôt, par zone morte temporelle.
 */
const etiquettesAffichees = computed(() => props.etiquettes ?? etiquettes.value)

/**
 * Les séries visibles, décrites une fois.
 *
 * Chaque série était construite en place dans `chartData`, ce qui allait tant qu'il n'y avait
 * qu'une édition à tracer. Dès qu'il faut en tracer DEUX avec les mêmes couleurs et les mêmes
 * libellés, la description doit précéder le dessin : la jumelle hachurée se déduit alors de la
 * série, au lieu d'être une seconde liste à tenir en phase avec la première.
 */
const seriesVisibles = computed<SerieDeGraphique[]>(() => {
  const series: SerieDeGraphique[] = []

  if (props.showParticipants) {
    series.push({
      cle: 'participants',
      label: t('gestion.ticketing.stats_participants'),
      fond: ticketConfig.chartBgColor,
      bordure: ticketConfig.chartBorderColor,
      valeurs: props.data.participants,
    })
  }

  if (props.showVolunteers) {
    series.push({
      cle: 'volunteers',
      label: t('gestion.ticketing.stats_volunteers'),
      fond: volunteerConfig.chartBgColor,
      bordure: volunteerConfig.chartBorderColor,
      valeurs: props.data.volunteers,
    })
  }

  if (props.showArtists) {
    series.push({
      cle: 'artists',
      label: t('gestion.ticketing.stats_artists'),
      fond: artistConfig.chartBgColor,
      bordure: artistConfig.chartBorderColor,
      valeurs: props.data.artists,
    })
  }

  if (props.showOrganizers) {
    series.push({
      cle: 'organizers',
      label: t('gestion.ticketing.stats_organizers'),
      fond: organizerConfig.chartBgColor,
      bordure: organizerConfig.chartBorderColor,
      valeurs: props.data.organizers,
    })
  }

  if (props.showOthers) {
    series.push({
      cle: 'others',
      label: t('gestion.ticketing.stats_others'),
      fond: 'rgba(107, 114, 128, 0.8)', // gray-500
      bordure: 'rgba(107, 114, 128, 1)',
      valeurs: props.data.others,
    })
  }

  if (props.showCancellations && props.data.cancellations?.some((n) => n > 0)) {
    // Une série à part, et seulement quand il y en a : sur une édition antérieure au 19/09/2026,
    // la reprise du journal n'a reconstitué aucune annulation — une série vide s'y lirait comme
    // « personne n'a jamais annulé », alors qu'on ne peut plus le savoir.
    series.push({
      cle: 'cancellations',
      label: t('gestion.ticketing.stats_cancellations'),
      fond: 'rgba(220, 38, 38, 0.8)', // red-600
      bordure: 'rgba(220, 38, 38, 1)',
      valeurs: props.data.cancellations,
    })
  }

  return series
})

const chartData = computed<ChartData<'bar'>>(() => {
  const comparaison = props.comparaison
  // Les deux piles d'abord l'une puis l'autre, et non entrelacées : Chart.js groupe les barres
  // par `stack`, et l'ordre des jeux décide de l'empilement DANS chaque pile. Les mêmes séries
  // doivent donc s'empiler dans le même ordre des deux côtés pour se lire en vis-à-vis.
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
