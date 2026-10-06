<template>
  <div class="space-y-6">
    <!-- Badge artiste -->
    <div
      :class="`flex items-center justify-between p-4 rounded-lg ${artistConfig.bgClass} ${artistConfig.darkBgClass}`"
    >
      <div class="flex items-center gap-3">
        <UIcon :name="artistConfig.icon" :class="artistConfig.iconColorClass" size="32" />
        <div>
          <p :class="`text-sm ${artistConfig.textClass} ${artistConfig.darkTextClass}`">
            {{ $t('edition.ticketing.access_type') }}
          </p>
          <p class="text-lg font-semibold text-gray-900 dark:text-white">Artiste</p>
        </div>
      </div>
      <UBadge color="warning" variant="soft" size="lg"> Artiste invité </UBadge>
    </div>

    <!-- Statut de validation d'entrée -->
    <div
      v-if="artist.entryValidated"
      class="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800"
    >
      <div class="flex items-start gap-3">
        <UIcon
          name="i-heroicons-check-circle-solid"
          class="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
        />
        <div class="flex-1">
          <p class="font-medium text-green-900 dark:text-green-100">
            {{ $t('ticketing.participant.entry_validated') }}
          </p>
          <p class="text-sm text-green-700 dark:text-green-300 mt-1">
            <span v-if="nomDuValidateur">
              {{ $t('ticketing.participant.validated_by', { name: nomDuValidateur }) }}
            </span>
            {{
              dateDeValidation
                ? $t('ticketing.participant.validated_on', { date: dateDeValidation })
                : ''
            }}
          </p>
        </div>
      </div>
    </div>

    <!-- Informations de l'artiste -->
    <TicketingUserInfoSection
      ref="userInfoSection"
      title="Artiste"
      :first-name="editableFirstName"
      :last-name="editableLastName"
      :email="editableEmail"
      :phone="editablePhone"
      :original-email="artist.user.email"
      :is-email-verified="artist.user.isEmailVerified"
      :user-id="artist.user.id"
      @update:first-name="$emit('update:firstName', $event)"
      @update:last-name="$emit('update:lastName', $event)"
      @update:email="$emit('update:email', $event)"
      @update:phone="$emit('update:phone', $event)"
    />

    <!-- Spectacles assignés -->
    <div class="space-y-4">
      <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <UIcon name="i-heroicons-star" class="text-yellow-600 dark:text-yellow-400" />
        <h4 class="font-semibold text-gray-900 dark:text-white">Spectacles</h4>
      </div>

      <div v-if="artist.shows && artist.shows.length > 0" class="space-y-2">
        <div
          v-for="show in artist.shows"
          :key="show.id"
          class="p-3 rounded-lg bg-gray-50 dark:bg-gray-900"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="h-4 w-4 text-yellow-500 flex-shrink-0" />
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ show.title }}
              </span>
            </div>
          </div>
          <!-- Un spectacle peut être joué plusieurs fois : l'accueil doit voir tous ses passages -->
          <div
            v-for="performance in show.performances"
            :key="performance.id"
            class="text-xs text-gray-600 dark:text-gray-400 ml-6"
          >
            {{ horaireDeLaRepresentation(performance.startDateTime) }}
            <span v-if="performance.location"> - {{ performance.location }}</span>
          </div>
        </div>
      </div>

      <!-- Message si aucun spectacle -->
      <div
        v-else
        class="p-4 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg"
      >
        <UIcon name="i-heroicons-star" class="mx-auto h-8 w-8 mb-2 text-gray-400" />
        <p class="text-sm">Aucun spectacle assigné</p>
      </div>
    </div>

    <!-- Repas de l'artiste -->
    <TicketingMealsDisplaySection :meals="artist.meals" />

    <!-- Boutons d'action. La condition d'origine — `!x || x` — était toujours vraie, donc sans
         effet ; elle dit maintenant ce qu'elle voulait dire : afficher le conteneur quand il
         porte un bouton.

         ⚠️ MÊME HABILLAGE QUE LES DEUX AUTRES CARTES. Celle-ci alignait son bouton à gauche, sur
         toute la largeur et sans filet de séparation, là où bénévole et organisateur le posent en
         bas à droite. Trois cartes voisines dans une même fiche qui ne placent pas leur action au
         même endroit se lisent comme trois écrans différents. -->
    <div
      v-if="artist.entryValidated"
      class="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700"
    >
      <!--
        ⚠️ CETTE CARTE NE VALIDE PLUS, elle ne fait que DÉVALIDER.

        Le pied de la fiche porte désormais la validation pour toutes les natures, et plus
        seulement pour les billets : deux boutons voisins annonçaient donc deux gestes différents
        — « Valider l'entrée » et « Valider l'entrée (1) » — alors que le premier déclenchait le
        second. Le doublon existait même avec UN seul titre, ce que j'avais d'abord manqué.

        📍 La dévalidation reste ici : elle ne concerne que ce titre, et le pied ne sait pas la
        faire. C'est pourquoi le bouton n'a pas disparu, seulement sa face « valider ».
      -->
      <UButton
        v-if="artist.entryValidated"
        color="error"
        icon="i-heroicons-x-circle"
        :loading="validating"
        @click="$emit('invalidate')"
      >
        Dévalider l'entrée
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type TicketingUserInfoSection from './TicketingUserInfoSection.vue'

import { formaterDateHeure, formaterJournee } from '~~/shared/utils/fuseau-edition'

// Utiliser le composable pour obtenir la configuration des artistes
const { getParticipantTypeConfig } = useParticipantTypes()
const artistConfig = getParticipantTypeConfig('artist')

interface Artist {
  id: number
  user: {
    id: number
    firstName: string
    lastName: string
    email: string
    phone?: string | null
  }
  shows: Array<{
    id: number
    title: string
    /** Les passages du spectacle : chacun a sa date et son lieu. */
    performances: { id: number; startDateTime: Date | string; location: string | null }[]
  }>
  handoutItems?: Array<{
    id: number
    name: string
  }>
  meals?: Array<{
    id: number
    date: Date | string
    mealType: string
    phase: string
  }>
  entryValidated?: boolean
  entryValidatedAt?: Date | string
  entryValidatedBy?: {
    firstName: string
    lastName: string
  }
}

const props = defineProps<{
  artist: Artist
  editableFirstName: string | null
  editableLastName: string | null
  editableEmail: string | null
  editablePhone: string | null
  validating: boolean
  /** Fuseau de l'édition : une entrée se date à l'heure du LIEU, pas du navigateur. */
  fuseau?: string | null
}>()

const emit = defineEmits<{
  'update:firstName': [value: string | null]
  'update:lastName': [value: string | null]
  'update:email': [value: string | null]
  'update:phone': [value: string | null]
  validate: []
  invalidate: []
  /**
   * ⚠️ LA VALIDITÉ DE L'ADRESSE REMONTE, et ce n'est pas un raffinement. Le bouton de cette carte
   * refusait de valider tant que l'adresse corrigée au guichet était invalide ; il a cédé sa place
   * au bouton du pied, qui n'a pas cette garde. Sans ce signal, on validerait une entrée avec une
   * adresse en erreur, sans rien pour l'empêcher.
   */
  'update:email-valid': [valide: boolean]
}>()

const { locale } = useI18n()

/**
 * L'horaire d'une représentation, dans le fuseau de l'ÉDITION.
 *
 * ⚠️ MÊME DÉFAUT QUE DANS LA CARTE DES BÉNÉVOLES, et dans la MÊME modale : un
 * `toLocaleString('fr-FR')` figeait la langue et lisait l'heure dans le fuseau du NAVIGATEUR.
 * Signalé sur les créneaux d'un bénévole ; les représentations d'un artiste sont à un clic de là
 * et portaient la faute à l'identique. Le commentaire d'`entryValidatedAt`, plus bas, décrivait
 * déjà cette correction — elle n'avait pas été reportée sur ce bloc.
 *
 * 📍 Le format compact est conservé : c'est le fuseau qui était faux, pas la mise en forme.
 */
const horaireDeLaRepresentation = (instant: Date | string) =>
  formaterJournee(instant, props.fuseau, locale.value, {
    dateStyle: 'short',
    timeStyle: 'short',
  })

/**
 * Qui a validé, et quand — à l'heure du lieu.
 *
 * Les trois cartes composaient ces deux lignes en français dans le gabarit, et dataient avec
 * `toLocaleDateString('fr-FR')` : la langue était figée pour tout le monde, et l'horodatage était
 * celui du navigateur. Un contrôle d'accès se relit sur place ; une entrée validée à 23 h se
 * serait affichée au lendemain pour qui consulte depuis un fuseau plus à l'est.
 */
const nomDuValidateur = computed(() =>
  props.artist.entryValidatedBy
    ? `${props.artist.entryValidatedBy.firstName} ${props.artist.entryValidatedBy.lastName}`
    : ''
)

const dateDeValidation = computed(() =>
  props.artist.entryValidatedAt
    ? formaterDateHeure(props.artist.entryValidatedAt, props.fuseau, locale.value)
    : ''
)

// Référence au composant TicketingUserInfoSection qui contient EmailValidationInput
const userInfoSection = ref<InstanceType<typeof TicketingUserInfoSection> | null>(null)

// Computed pour vérifier si l'email est valide en accédant à emailInput via userInfoSection
const isEmailValid = computed(() => {
  return userInfoSection.value?.emailInput?.emailValidation?.isValid ?? true
})

/*
 * ⚠️ `immediate` : sans lui, le parent n'apprendrait la validité qu'au PREMIER changement. Une
 * fiche ouverte puis validée sans qu'on touche au champ laisserait le parent sans réponse, et il
 * devrait supposer — dans un sens ou dans l'autre, c'est une supposition de trop au guichet.
 */
watch(isEmailValid, (valide) => emit('update:email-valid', valide), { immediate: true })
</script>
