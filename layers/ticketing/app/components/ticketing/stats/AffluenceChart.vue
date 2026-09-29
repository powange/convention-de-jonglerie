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
      <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Chart as ChartJS,
  BarElement,
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
import { Bar } from 'vue-chartjs'

import {
  PILE_COMPAREE,
  PILE_COURANTE,
  basculerLesDeuxEditions,
  jeuCompare,
  jeuCourant,
  motifRaye,
  sansLesJumelles,
  type SerieDeGraphique,
} from '../../../utils/motifs-graphiques'

import { formaterJournee } from '~~/shared/utils/fuseau-edition'

/**
 * L'affluence : combien de PERSONNES sont sur place, tranche par tranche, et à quel titre.
 *
 * Des BARRES empilées, une par tranche.
 *
 * Ce graphique portait des aires empilées, au motif qu'il mesure un stock là où les arrivées
 * comptent un flux. L'argument tenait en théorie ; à l'usage il ne se lisait pas. Quatre aires
 * superposées en escalier se confondent dès que les tranches sont nombreuses, et l'on ne sait plus
 * lire une tranche précise — or c'est la question qu'on pose à ce graphique : « combien de monde à
 * ce moment-là ». Une barre isole la tranche et se compare à sa voisine d'un coup d'œil.
 *
 * Ce qu'on perd, et qu'il faut savoir : l'aire suggérait la continuité entre deux mesures, ce que
 * la barre ne fait pas. C'est plus honnête — entre deux tranches, on ne sait rien — mais la lecture
 * d'ensemble de la journée y est moins immédiate.
 *
 * La jauge attendue COMPLÈTE le bâton plutôt que d'en faire un second : l'écart entre présents et
 * attendus s'empile au-dessus, hachuré. Le bâton entier monte donc jusqu'à l'attendu, et la partie
 * hachurée se lit « ce qu'il aurait pu y avoir en plus » — l'écart est un segment, pas une
 * différence de hauteurs à estimer.
 *
 * Empiler n'est légitime que parce qu'une personne n'appartient qu'à UNE pile : la population
 * retenue est la plus engagée de ses titres (organisateur, puis artiste, puis bénévole, puis
 * participant), choix de l'utilisateur. Les quatre séries s'additionnent donc exactement au total,
 * et un test du serveur le vérifie tranche par tranche — sans quoi la hauteur de la pile dépasserait
 * le nombre de gens sur le site et l'échelle mentirait.
 */

ChartJS.register(
  BarElement,
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
  /**
   * Les repères de l'axe, quand on compare.
   *
   * En comparaison, l'axe ne porte plus des instants mais des repères relatifs à l'ouverture de
   * chaque édition : deux éditions qui n'ont pas eu lieu aux mêmes dates n'ont aucune date commune.
   * Absent, le composant compose ses étiquettes depuis les instants, comme sans comparaison.
   */
  etiquettes?: string[] | null
  /** L'édition comparée, déjà alignée sur le même axe, population par population. */
  comparaison?: {
    libelle: string
    series: Record<string, (number | null)[]>
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  timezone: null,
  etiquettes: null,
  comparaison: null,
})

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

const chartData = computed<ChartData<'bar'> | null>(() => {
  if (!props.data?.timestamps?.length) return null

  const comparaison = props.comparaison

  /*
   * Les quatre populations, dans la forme que les fabriques partagées attendent.
   *
   * Elles sont communes aux graphiques de cette page : couleurs, hachure de l'édition comparée,
   * bascule de la légende. Les recopier ici ferait diverger l'apparence d'un graphique à l'autre
   * sur un détail, exactement là où la comparaison exige qu'on reconnaisse une série d'un coup.
   */
  const series: SerieDeGraphique[] = piles.value.map((pile) => ({
    cle: pile.cle,
    label: pile.label,
    fond: pile.config.chartBgColor,
    bordure: pile.config.chartBorderColor,
    valeurs: props.data.parPopulation[pile.cle] ?? [],
  }))

  // Les deux piles l'une puis l'autre, et non entrelacées : Chart.js groupe par `stack`, et
  // l'ordre des jeux décide de l'empilement DANS chaque pile. Les mêmes populations doivent
  // s'empiler dans le même ordre des deux côtés pour se lire en vis-à-vis.
  const datasets: unknown[] = series.map((serie) => jeuCourant(serie))
  if (comparaison) {
    for (const serie of series) datasets.push(jeuCompare(serie, comparaison))
  }

  /*
   * La jauge attendue COMPLÈTE le bâton, elle n'en fait pas un second.
   *
   * On empile donc l'ÉCART — attendu moins présents — au-dessus des quatre populations, hachuré :
   * le bâton entier monte jusqu'à l'attendu, et la partie hachurée se lit « ce qu'il aurait pu y
   * avoir en plus ». Un bâton séparé obligeait à comparer deux hauteurs voisines ; une ligne
   * au-dessus, à estimer un écart vertical. Ici l'écart EST le segment.
   *
   * ⚠️ Borné à zéro, et ce n'est pas une précaution de principe. La jauge compte les personnes
   * ATTENDUES sur leur fenêtre prévue, l'affluence celles réellement présentes : un bénévole entré
   * un jour où on ne l'attendait pas compte dans la seconde et pas dans la première. L'affluence
   * peut donc dépasser l'attendu sur une tranche. Le bâton passe alors au-dessus de la jauge sans
   * segment hachuré — ce qui est exact et se voit —, là où un écart négatif aurait creusé la pile
   * et faussé l'échelle sans rien signaler.
   */
  const complement = (props.data.jauge ?? []).map((attendu, i) =>
    Math.max(0, (attendu ?? 0) - (props.data.affluence?.[i] ?? 0))
  )

  datasets.push({
    label: t('gestion.ticketing.affluence_gauge'),
    data: complement,
    // Hachuré et gris : ce n'est pas une catégorie de gens, c'est une absence.
    backgroundColor: motifRaye('rgba(107, 114, 128, 0.45)'),
    borderColor: 'rgba(107, 114, 128, 0.9)',
    borderWidth: 1,
    // LA MÊME pile que les populations : c'est ce qui en fait un complément et non un voisin.
    stack: PILE_COURANTE,
  })

  if (comparaison) {
    // Le même complément pour l'édition comparée, dans SA pile — sans quoi les deux bâtons ne
    // monteraient pas jusqu'au même repère et la comparaison se lirait de travers.
    const complementCompare = (comparaison.series.jauge ?? []).map((attendu, i) =>
      Math.max(0, (attendu ?? 0) - (comparaison.series.affluence?.[i] ?? 0))
    )
    datasets.push({
      label: t('gestion.ticketing.affluence_gauge'),
      data: complementCompare,
      backgroundColor: motifRaye('rgba(107, 114, 128, 0.25)'),
      borderColor: 'rgba(107, 114, 128, 0.9)',
      borderWidth: 1,
      stack: PILE_COMPAREE,
      comparaison: true,
    })
  }

  return {
    // Les repères relatifs quand on compare, les instants sinon.
    labels: props.etiquettes ?? props.data.timestamps.map(etiquetteDe),
    datasets: datasets as ChartData<'bar'>['datasets'],
  }
})

const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'top',
      // La légende ne montre QUE l'édition en cours : doubler les entrées n'apprendrait rien, les
      // jumelles portant les mêmes couleurs. Ce qui distingue les deux — la hachure — est dit une
      // fois au-dessus du graphique. Et un clic bascule les DEUX éditions d'une population, sans
      // quoi on masquerait un côté sans l'autre et la comparaison mentirait.
      labels: { usePointStyle: true, padding: 15, filter: sansLesJumelles },
      onClick: basculerLesDeuxEditions,
    },
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
