<template>
  <!-- Cliquable pour ouvrir le détail : la consigne du poste n'a pas sa place dans la liste, qui
       doit rester lisible d'un coup d'œil, mais elle doit rester à un geste. `button` et non
       `div` : au clavier comme au lecteur d'écran, c'est une action, pas un paragraphe. -->
  <component
    :is="ouvrable ? 'button' : 'div'"
    :type="ouvrable ? 'button' : undefined"
    class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4"
    :class="
      ouvrable
        ? 'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer'
        : undefined
    "
    :style="{ borderLeftColor: couleurEquipe }"
    @click="ouvrable && emit('ouvrir', timeSlot)"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <p class="font-medium text-gray-900 dark:text-white text-sm mb-1">
          {{ timeSlot.title || t('volunteers.untitled_slot') }}
        </p>
        <div class="mb-2">
          <div class="flex items-center gap-2 text-xs mb-1">
            <UIcon name="i-heroicons-calendar-days" class="w-3 h-3" />
            <span
              :class="
                libelleDecalage
                  ? 'line-through text-gray-400 dark:text-gray-500'
                  : 'text-gray-600 dark:text-gray-400'
              "
            >
              {{ formatSlotDateTime(timeSlot.startDateTime, timeSlot.endDateTime) }}
            </span>
          </div>
          <div
            v-if="libelleDecalage"
            class="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400"
          >
            <UIcon name="i-heroicons-clock" class="w-3 h-3" />
            <span class="font-medium">
              {{
                formatSlotDateTime(
                  timeSlot.startDateTime,
                  timeSlot.endDateTime,
                  timeSlot.delayMinutes
                )
              }}
              <span class="text-orange-500 text-[10px]">({{ libelleDecalage }})</span>
            </span>
          </div>
        </div>
        <div v-if="timeSlot.team" class="flex items-center gap-2">
          <div
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ backgroundColor: timeSlot.team.color || '#6b7280' }"
          ></div>
          <span class="text-xs text-gray-600 dark:text-gray-400 truncate">
            {{ timeSlot.team.name }}
          </span>
        </div>

        <!-- Avec qui l'on tient ce poste : un créneau partagé se prépare autrement qu'un
             créneau tenu seul. -->
        <div v-if="timeSlot.coVolunteers?.length" class="mt-2">
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">
            {{ t('volunteers.with_you_on_slot', { count: timeSlot.coVolunteers.length }) }}
          </p>
          <div class="flex flex-wrap gap-x-3 gap-y-1">
            <UiUserDisplay
              v-for="coequipier in timeSlot.coVolunteers"
              :key="coequipier.id"
              :user="coequipier"
              size="xs"
            />
          </div>
        </div>
      </div>
      <div v-if="showDuration" class="text-right text-xs text-gray-500">
        {{ formatSlotDuration(timeSlot.startDateTime, timeSlot.endDateTime) }}
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import { formatDurationCompact } from '~/utils/date'

import { decalageTraduisible, horairesEffectifs } from '../../utils/retard-creneau'

import { fuseauUtilisable } from '~~/shared/utils/fuseau-edition'

/**
 * Ce que la carte lit d'un créneau.
 *
 * L'identifiant, le titre et l'identifiant d'équipe sont FACULTATIFS : la carte ne s'en sert pas
 * pour son rendu — le titre a déjà son repli, et l'identifiant ne voyage que dans l'événement
 * `ouvrir`. Les exiger fermait la carte aux écrans d'échange, dont la sélection serveur n'annonce
 * pas toujours l'équipe avec son identifiant, et obligeait à recopier un composant plutôt qu'à
 * l'employer.
 *
 * (Sans accents graves autour des chemins pointés : l'outillage i18n les prend pour des clés de
 * traduction manquantes.)
 */
interface TimeSlot {
  id?: string
  title?: string | null
  startDateTime: string
  endDateTime: string
  delayMinutes?: number | null
  description?: string
  team?: {
    id?: string
    name: string
    color?: string | null
  } | null
  /** Les autres bénévoles affectés au même créneau. Absente là où l'API ne la fournit pas. */
  coVolunteers?: Array<{
    id: number
    pseudo: string
    emailHash: string
    profilePicture?: string | null
    updatedAt?: string
  }>
}

const props = withDefaults(
  defineProps<{
    timeSlot: TimeSlot
    showDuration?: boolean
    /** Fuseau de l'édition : un créneau s'annonce à l'heure du LIEU. */
    fuseau?: string | null
    /**
     * Rend la carte cliquable. Faux là où aucune modale n'écoute : une carte qui réagit au clic
     * sans rien ouvrir est pire qu'une carte inerte.
     */
    ouvrable?: boolean
  }>(),
  {
    showDuration: false,
    ouvrable: false,
  }
)

const emit = defineEmits<{ ouvrir: [creneau: TimeSlot] }>()

const { t, locale } = useI18n()

/**
 * La couleur de l'équipe, en bordure gauche, comme dans la liste des créneaux d'un bénévole
 * côté gestion. Elle situe le créneau d'un coup d'œil, ce qu'un fond uniformément bleu ne
 * faisait pas : toutes les équipes s'y ressemblaient.
 *
 * Gris neutre en dernier recours — un créneau sans équipe ne doit pas emprunter la couleur du
 * précédent.
 */
const couleurEquipe = computed(() => props.timeSlot.team?.color || '#9ca3af')

/**
 * « retardé de 15 min », « avancé de 1 h » — ou rien si le créneau est à l'heure.
 *
 * Cette carte n'annonçait que les RETARDS (`delayMinutes > 0`), et en clair : « (+15min) ». Un
 * créneau avancé passait donc inaperçu, alors que le champ est signé et que les autres surfaces
 * l'annoncent depuis `decalageTraduisible`. Le libellé est en outre traduit, là où « min » était
 * écrit en dur.
 */
const libelleDecalage = computed(() => {
  const decalage = decalageTraduisible(props.timeSlot.delayMinutes)
  return decalage ? t(decalage.cle, decalage.valeurs) : ''
})

/**
 * « sam. 26 sept. • 14:00 - 16:00 », à l'heure du LIEU.
 *
 * Une seule fonction pour les deux cas : la version « avec retard » en était une copie mot pour
 * mot, au décalage près. Deux copies, c'est deux occasions d'en corriger une seule.
 */
const formatSlotDateTime = (startDateTime: string, endDateTime: string, delayMinutes = 0) => {
  // La règle du décalage vit dans `retard-creneau`, partagée avec les cinq autres surfaces.
  const horaires = horairesEffectifs(startDateTime, endDateTime, delayMinutes)
  if (!horaires) return ''
  const { debut, fin } = horaires

  const zone = fuseauUtilisable(props.fuseau)
  const jour = new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: zone,
  })
  const heure = new Intl.DateTimeFormat(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: zone,
  })

  return `${jour.format(debut)} • ${heure.format(debut)} - ${heure.format(fin)}`
}

/**
 * La durée, par le formateur du dépôt.
 *
 * Cette carte en avait le sien, écrit à la main : il rendait « 2h30m » et « 45m » là où le reste
 * du projet écrit « 2h30 » et « 45min », et « 3h5m » là où l'autre complète en « 3h05 ». La liste
 * qui contient cette carte importait pourtant déjà `formatDurationCompact` pour son total — les
 * deux formes se côtoyaient donc sur le même écran.
 */
const formatSlotDuration = (startDateTime: string, endDateTime: string) =>
  formatDurationCompact(new Date(endDateTime).getTime() - new Date(startDateTime).getTime())
</script>
