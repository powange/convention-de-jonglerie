<template>
  <div>
    <!-- Ce que le chiffre veut dire, dit AVANT le graphique. Une courbe d'affluence se lit comme une
         mesure ; celle-ci est une estimation, et le lecteur doit le savoir avant d'en tirer une
         conclusion, pas après. -->
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('gestion.ticketing.affluence_peak') }}
        </span>
        <span class="text-2xl font-semibold tabular-nums">{{ data.sommet.valeur }}</span>
        <span v-if="libelleDuSommet" class="text-sm text-gray-600 dark:text-gray-400">
          {{ libelleDuSommet }}
        </span>
      </div>

      <UButton
        icon="i-heroicons-arrow-down-tray"
        variant="outline"
        size="sm"
        :loading="exporting"
        @click="handleExport"
      >
        {{ $t('gestion.ticketing.stats_export_pdf') }}
      </UButton>
    </div>

    <UAlert
      v-if="data.entreesRetenues > data.personnesDistinctes"
      icon="i-heroicons-information-circle"
      color="neutral"
      variant="subtle"
      class="mb-4"
      :description="
        $t('gestion.ticketing.affluence_dedup_notice', {
          entrees: data.entreesRetenues,
          personnes: data.personnesDistinctes,
        }) + (ecartSuspect ? ' ' + $t('gestion.ticketing.affluence_dedup_warning') : '')
      "
    />

    <div ref="chartContainer" class="w-full h-96">
      <Line v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'vue-chartjs'

import { formaterJournee } from '~~/shared/utils/fuseau-edition'

/**
 * L'affluence : combien de PERSONNES sont sur place, tranche par tranche.
 *
 * Une COURBE et non des barres, contrairement au graphique des arrivées juste au-dessus : celui-là
 * compte un flux, additif par nature — des barres empilées s'y lisent bien. Celui-ci mesure un
 * stock, une même personne apparaissant dans toutes les tranches où elle est présente. Empiler
 * n'aurait aucun sens, et une aire remplie dit mieux « il y avait tant de monde à ce moment ».
 *
 * Une seule série, également voulue : une personne présente à deux titres devrait sinon être
 * attribuée à une population, et toute règle d'attribution serait une invention. La répartition par
 * population existe sur le graphique voisin, où chaque entrée compte pour elle-même.
 */

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend
)

interface Props {
  data: {
    /**
     * Les instants de début de chaque tranche. Le serveur ne compose aucun libellé : la langue de
     * l'écran est celle du lecteur, et l'heure celle du LIEU.
     */
    timestamps: string[]
    affluence: number[]
    sommet: { valeur: number; debut: string | null }
    personnesDistinctes: number
    entreesRetenues: number
  }
  /** Le fuseau dans lequel les tranches ont été découpées. */
  timezone?: string | null
  /** La granularité en minutes, qui décide si l'étiquette porte une heure. */
  granularite: number
}

const props = defineProps<Props>()

const { t, locale } = useI18n()
const { exportChartToPDF } = useChartExport()

const chartContainer = ref<HTMLElement | null>(null)
const exporting = ref(false)

const handleExport = async () => {
  if (!chartContainer.value) return

  exporting.value = true
  try {
    await exportChartToPDF(
      chartContainer.value,
      `affluence-${new Date().toISOString().split('T')[0]}`,
      t('gestion.ticketing.affluence_title')
    )
  } catch (error) {
    console.error("Erreur lors de l'export PDF:", error)
  } finally {
    exporting.value = false
  }
}

/**
 * L'étiquette d'une tranche.
 *
 * À la journée, l'heure est du bruit : elle vaut toujours minuit et allonge l'axe sans rien dire.
 * En dessous, elle est l'essentiel.
 */
const etiquetteDe = (instant: string) =>
  formaterJournee(
    instant,
    props.timezone,
    locale.value,
    props.granularite >= 1440
      ? { weekday: 'short', day: '2-digit', month: '2-digit' }
      : { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
  )

/**
 * L'écart entre entrées et personnes est-il trop grand pour être crédible ?
 *
 * Mesuré : sur l'édition 9 de la base de développement, 225 entrées pour 68 personnes — un rapport
 * de 3,3, qu'aucune convention réelle ne produit. Ce sont des billets importés qui portent tous
 * l'adresse de l'acheteur, et qui se confondent donc.
 *
 * Le seuil est un tiers de personnes en moins : au-delà, le chiffre mérite une explication plutôt
 * qu'une lecture au premier degré.
 */
const ecartSuspect = computed(
  () =>
    props.data.entreesRetenues > 0 &&
    props.data.personnesDistinctes < props.data.entreesRetenues * (2 / 3)
)

const libelleDuSommet = computed(() =>
  props.data.sommet.debut
    ? t('gestion.ticketing.affluence_peak_at', { moment: etiquetteDe(props.data.sommet.debut) })
    : null
)

const chartData = computed<ChartData<'line'> | null>(() => {
  if (!props.data?.timestamps?.length) return null

  return {
    labels: props.data.timestamps.map(etiquetteDe),
    datasets: [
      {
        label: t('gestion.ticketing.affluence_series'),
        data: props.data.affluence,
        borderColor: 'rgb(14, 116, 144)',
        backgroundColor: 'rgba(14, 116, 144, 0.18)',
        fill: true,
        // Une courbe en escalier, et non lissée : entre deux tranches, on ne sait rien. Une
        // interpolation douce inventerait des valeurs intermédiaires qui n'ont pas été mesurées.
        stepped: true,
        pointRadius: props.data.timestamps.length > 60 ? 0 : 3,
      },
    ],
  }
})

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' },
    tooltip: {
      callbacks: {
        label: (contexte) =>
          t('gestion.ticketing.affluence_tooltip', { count: Number(contexte.parsed.y) }),
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      // Des personnes : un demi-participant n'existe pas, et Chart.js en propose sur de petites
      // amplitudes.
      ticks: { precision: 0 },
      title: { display: true, text: t('gestion.ticketing.affluence_axis') },
    },
    x: {
      ticks: {
        autoSkip: true,
        maxRotation: 60,
      },
    },
  },
}))
</script>
