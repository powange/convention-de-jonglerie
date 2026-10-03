<template>
  <UCard>
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-chart-bar" class="text-purple-500" />
        <h2 class="text-lg font-semibold">{{ $t('edition.ticketing.entry_stats') }}</h2>
      </div>

      <!--
        ⚠️ PAS DE NOMBRE DE COLONNES FIGÉ, et c'est la correction de fond.

        La grille était `grid-cols-1 md:grid-cols-2 lg:grid-cols-5`. Or le nombre de cartes VARIE
        de deux à cinq : bénévoles, artistes et organisateurs ne s'affichent que si l'édition en
        compte. Cinq colonnes imposées laissaient donc trois colonnes vides sur une édition sans
        bénévoles ni artistes, et deux colonnes pour cinq cartes entre 768 et 1024 px — le cas le
        plus courant, une fenêtre de portable à demi réduite ou une tablette.

        `auto-fit` + `minmax` laisse le NAVIGATEUR décider combien de cartes tiennent, à partir
        d'une largeur minimale lisible. Plus aucun point de rupture : la mise en page suit la
        largeur réelle du conteneur, à toutes les tailles, et s'adapte d'elle-même au nombre de
        cartes présentes. C'est aussi ce qui évite de caler quoi que ce soit sur une taille
        d'écran mesurée.
      -->
      <div class="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
        <!-- Total des entrées validées -->
        <div
          class="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-white dark:border-white"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
                {{ $t('edition.ticketing.total_entries') }}
              </p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {{ totalValide }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ totalAujourdhui }}
                {{ $t('edition.ticketing.validated_today').toLowerCase() }}
              </p>
            </div>
            <UIcon
              name="i-heroicons-users"
              class="text-gray-600 dark:text-gray-400 shrink-0"
              size="32"
            />
          </div>
        </div>

        <!-- Participants : par billet, ou regroupés par personne au clic -->
        <button
          :class="`p-4 ${ticketConfig.bgClass} ${ticketConfig.darkBgClass} ${ticketConfig.hoverBgClass} ${ticketConfig.darkHoverBgClass} rounded-lg transition-colors cursor-pointer text-left w-full`"
          :aria-pressed="parPersonne"
          :title="$t('ticketing.stats.count_toggle_hint')"
          type="button"
          @click="parPersonne = !parPersonne"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
                {{ $t('ticketing.stats.participants') }}
              </p>
              <p
                :class="`text-2xl font-bold tabular-nums ${ticketConfig.textClass} ${ticketConfig.darkTextClass}`"
              >
                {{ participantsValides }} / {{ participantsTotal }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ participantsAujourdhui }} aujourd'hui
              </p>
              <!-- Le mode est écrit, jamais deviné : sans cette ligne, deux chiffres différents
                   s'affichent au même endroit sans que rien ne dise pourquoi. -->
              <p
                class="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center gap-1 font-medium"
              >
                <UIcon :name="parPersonne ? 'i-heroicons-user' : 'i-heroicons-ticket'" />
                {{
                  parPersonne
                    ? $t('ticketing.stats.count_per_person')
                    : $t('ticketing.stats.count_per_ticket')
                }}
              </p>
            </div>
            <UIcon
              :name="ticketConfig.icon"
              :class="[ticketConfig.iconColorClass, 'shrink-0']"
              size="32"
            />
          </div>
        </button>

        <!-- Bénévoles -->
        <button
          v-if="stats.totalVolunteers > 0"
          :class="`p-4 ${volunteerConfig.bgClass} ${volunteerConfig.darkBgClass} ${volunteerConfig.hoverBgClass} ${volunteerConfig.darkHoverBgClass} rounded-lg transition-colors cursor-pointer text-left w-full`"
          @click="$emit('show-volunteers-not-validated')"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
                {{ $t('ticketing.stats.volunteers') }}
              </p>
              <p
                :class="`text-2xl font-bold tabular-nums ${volunteerConfig.textClass} ${volunteerConfig.darkTextClass}`"
              >
                {{ stats.volunteersValidated }} / {{ stats.totalVolunteers }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.volunteersValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon
              :name="volunteerConfig.icon"
              :class="[volunteerConfig.iconColorClass, 'shrink-0']"
              size="32"
            />
          </div>
        </button>

        <!-- Artistes -->
        <button
          v-if="stats.totalArtists > 0"
          :class="`p-4 ${artistConfig.bgClass} ${artistConfig.darkBgClass} ${artistConfig.hoverBgClass} ${artistConfig.darkHoverBgClass} rounded-lg transition-colors cursor-pointer text-left w-full`"
          @click="$emit('show-artists-not-validated')"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
                {{ $t('ticketing.stats.artists') }}
              </p>
              <p
                :class="`text-2xl font-bold tabular-nums ${artistConfig.textClass} ${artistConfig.darkTextClass}`"
              >
                {{ stats.artistsValidated }} / {{ stats.totalArtists }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.artistsValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon
              :name="artistConfig.icon"
              :class="[artistConfig.iconColorClass, 'shrink-0']"
              size="32"
            />
          </div>
        </button>

        <!-- Organisateurs -->
        <button
          v-if="stats.totalOrganizers > 0"
          :class="`p-4 ${organizerConfig.bgClass} ${organizerConfig.darkBgClass} ${organizerConfig.hoverBgClass} ${organizerConfig.darkHoverBgClass} rounded-lg transition-colors cursor-pointer text-left w-full`"
          @click="$emit('show-organizers-not-validated')"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
                {{ $t('ticketing.stats.organizers') }}
              </p>
              <p
                :class="`text-2xl font-bold tabular-nums ${organizerConfig.textClass} ${organizerConfig.darkTextClass}`"
              >
                {{ stats.organizersValidated }} / {{ stats.totalOrganizers }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.organizersValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon
              :name="organizerConfig.icon"
              :class="[organizerConfig.iconColorClass, 'shrink-0']"
              size="32"
            />
          </div>
        </button>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface EntryStats {
  validatedToday: number
  totalValidated: number
  ticketsValidated: number
  volunteersValidated: number
  artistsValidated: number
  organizersValidated: number
  ticketsValidatedToday: number
  volunteersValidatedToday: number
  artistsValidatedToday: number
  organizersValidatedToday: number
  totalTickets: number
  /** Les mêmes participants comptés par personne : deux billets au même nom font un. */
  personnesValidated: number
  personnesValidatedToday: number
  totalPersonnes: number
  totalVolunteers: number
  totalArtists: number
  totalOrganizers: number
}

const props = defineProps<{
  stats: EntryStats
}>()

defineEmits<{
  'show-volunteers-not-validated': []
  'show-artists-not-validated': []
  'show-organizers-not-validated': []
}>()

// Utiliser le composable pour obtenir les configurations des types de participants
const { getParticipantTypeConfig } = useParticipantTypes()

const ticketConfig = getParticipantTypeConfig('ticket')
const volunteerConfig = getParticipantTypeConfig('volunteer')
const artistConfig = getParticipantTypeConfig('artist')
const organizerConfig = getParticipantTypeConfig('organizer')

/*
 * Compter par personne plutôt que par billet.
 *
 * Quelqu'un qui prend un billet vendredi et un billet samedi comptait deux fois — au numérateur
 * comme au dénominateur. Les deux lectures sont vraies et répondent à deux questions : combien de
 * billets ont été scannés, combien de personnes sont entrées. Un clic sur la tuile passe de l'une
 * à l'autre, un second revient ; le mode par billet reste celui de départ.
 *
 * Les deux jeux de chiffres arrivent ensemble dans `stats` : la bascule n'attend aucune requête.
 */
const CLE_DE_MEMOIRE = 'cdj-controle-acces-par-personne'
const parPersonne = ref(false)

// Lu au montage et non pendant le `setup` : le serveur ne connaît pas ce choix, et un rendu qui en
// dépendrait ne correspondrait pas à celui du navigateur.
onMounted(() => {
  try {
    parPersonne.value = localStorage.getItem(CLE_DE_MEMOIRE) === '1'
  } catch {
    // Navigation privée, stockage refusé : le mode par billet fait un défaut acceptable.
  }
})

watch(parPersonne, (actif) => {
  try {
    localStorage.setItem(CLE_DE_MEMOIRE, actif ? '1' : '0')
  } catch {
    // Sans mémoire, la bascule vaut pour la visite en cours — c'est déjà l'essentiel.
  }
})

const participantsValides = computed(() =>
  parPersonne.value ? props.stats.personnesValidated : props.stats.ticketsValidated
)
const participantsTotal = computed(() =>
  parPersonne.value ? props.stats.totalPersonnes : props.stats.totalTickets
)
const participantsAujourdhui = computed(() =>
  parPersonne.value ? props.stats.personnesValidatedToday : props.stats.ticketsValidatedToday
)

/*
 * La tuile « Total » suit le même mode, sans quoi deux tuiles voisines se contrediraient : elle
 * additionne billets, bénévoles, artistes et organisateurs, et continuerait de compter les billets
 * en double.
 *
 * On échange la seule part des billets au lieu de refaire la somme : si une catégorie s'ajoute un
 * jour au total, elle sera reprise sans que ce calcul ait à le savoir.
 */
const totalValide = computed(() =>
  parPersonne.value
    ? props.stats.totalValidated - props.stats.ticketsValidated + props.stats.personnesValidated
    : props.stats.totalValidated
)
const totalAujourdhui = computed(() =>
  parPersonne.value
    ? props.stats.validatedToday -
      props.stats.ticketsValidatedToday +
      props.stats.personnesValidatedToday
    : props.stats.validatedToday
)
</script>
