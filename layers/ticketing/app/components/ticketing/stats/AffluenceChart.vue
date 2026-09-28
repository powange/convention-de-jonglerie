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
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('gestion.ticketing.affluence_expected_total', { count: data.personnesAttendues }) }}
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
 * L'affluence : combien de PERSONNES sont sur place, tranche par tranche, et à quel titre.
 *
 * Des aires EMPILÉES et non des barres, contrairement au graphique des arrivées juste au-dessus :
 * celui-là compte un flux, additif par nature. Celui-ci mesure un stock, une même personne
 * apparaissant dans toutes les tranches où elle est présente — une aire dit mieux « il y avait tant
 * de monde à ce moment ».
 *
 * Empiler n'est légitime que parce qu'une personne n'appartient qu'à UNE pile : la population
 * retenue est la plus engagée de ses titres (organisateur, puis artiste, puis bénévole, puis
 * participant), choix de l'utilisateur. Les quatre séries s'additionnent donc exactement au total,
 * et un test du serveur le vérifie tranche par tranche — sans quoi la hauteur de la pile dépasserait
 * le nombre de gens sur le site et l'échelle mentirait.
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
    /** Le total, qui est la somme exacte des quatre piles. */
    affluence: number[]
    parPopulation: {
      organisateurs: number[]
      artistes: number[]
      benevoles: number[]
      participants: number[]
    }
    /** La jauge attendue : qui devrait être là, validations d'entrée mises de côté. */
    jauge: number[]
    sommet: { valeur: number; debut: string | null }
    personnesDistinctes: number
    entreesRetenues: number
    personnesAttendues: number
  }
  /** Le fuseau dans lequel les tranches ont été découpées. */
  timezone?: string | null
  /** La granularité en minutes, qui décide si l'étiquette porte une heure. */
  granularite: number
}

const props = defineProps<Props>()

const { t, locale } = useI18n()
const { getParticipantTypeConfig } = useParticipantTypes()
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
 * L'écart entre titres et personnes est-il trop grand pour être crédible ?
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

/**
 * L'étiquette d'une tranche.
 *
 * À la journée, l'heure est du bruit : elle vaut toujours minuit et allonge l'axe sans rien dire. En
 * dessous, elle est l'essentiel.
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

const libelleDuSommet = computed(() =>
  props.data.sommet.debut
    ? t('gestion.ticketing.affluence_peak_at', { moment: etiquetteDe(props.data.sommet.debut) })
    : null
)

/**
 * Les quatre piles, décrites une fois.
 *
 * Couleurs et libellés viennent des mêmes sources que le graphique des arrivées : deux graphiques
 * voisins où le vert ne désignerait pas la même population seraient pires que pas de couleur du
 * tout.
 *
 * L'ordre d'empilement suit la priorité d'attribution — les organisateurs au fond, les participants
 * au-dessus : c'est la pile la plus nombreuse et la plus variable, et elle se lit mieux en haut.
 */
const piles = computed(() => [
  {
    cle: 'organisateurs' as const,
    label: t('gestion.ticketing.stats_organizers'),
    config: getParticipantTypeConfig('organizer'),
  },
  {
    cle: 'artistes' as const,
    label: t('gestion.ticketing.stats_artists'),
    config: getParticipantTypeConfig('artist'),
  },
  {
    cle: 'benevoles' as const,
    label: t('gestion.ticketing.stats_volunteers'),
    config: getParticipantTypeConfig('volunteer'),
  },
  {
    cle: 'participants' as const,
    label: t('gestion.ticketing.stats_participants'),
    config: getParticipantTypeConfig('ticket'),
  },
])

const chartData = computed<ChartData<'line'> | null>(() => {
  if (!props.data?.timestamps?.length) return null

  return {
    labels: props.data.timestamps.map(etiquetteDe),
    datasets: [
      ...piles.value.map((pile) => ({
        label: pile.label,
        data: props.data.parPopulation[pile.cle] ?? [],
        borderColor: pile.config.chartBorderColor,
        backgroundColor: pile.config.chartBgColor,
        fill: true,
        // Une courbe en escalier, et non lissée : entre deux tranches, on ne sait rien. Une
        // interpolation douce inventerait des valeurs intermédiaires qui n'ont pas été mesurées.
        stepped: true,
        pointRadius: props.data.timestamps.length > 60 ? 0 : 2,
        // Les quatre populations forment UNE pile, celle des gens présents.
        stack: 'presents',
      })),
      {
        label: t('gestion.ticketing.affluence_gauge'),
        data: props.data.jauge ?? [],
        borderColor: 'rgba(107, 114, 128, 1)', // gray-500
        backgroundColor: 'transparent',
        // Ni remplie ni empilée : c'est un PLAFOND qu'on compare à la pile, pas une part de plus.
        // `stack` propre à ce jeu de données — Chart.js forme une pile distincte par groupe, et sans
        // cela la jauge s'ajouterait aux quatre aires et doublerait la hauteur du graphique.
        stack: 'jauge',
        fill: false,
        stepped: true,
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  }
})

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'top' },
    tooltip: {
      callbacks: {
        // Le total dans le pied de l'infobulle : empilées, les quatre valeurs ne se somment pas à
        // l'œil, et c'est le total qu'on cherche d'abord.
        footer: (elements) => {
          const i = elements[0]?.dataIndex ?? 0
          return [
            t('gestion.ticketing.affluence_tooltip', { count: props.data.affluence[i] ?? 0 }),
            t('gestion.ticketing.affluence_gauge_tooltip', { count: props.data.jauge?.[i] ?? 0 }),
          ]
        },
      },
    },
  },
  scales: {
    y: {
      stacked: true,
      beginAtZero: true,
      // Des personnes : un demi-participant n'existe pas, et Chart.js en propose sur de petites
      // amplitudes.
      ticks: { precision: 0 },
      title: { display: true, text: t('gestion.ticketing.affluence_axis') },
    },
    x: {
      stacked: true,
      ticks: { autoSkip: true, maxRotation: 60 },
    },
  },
}))
</script>
