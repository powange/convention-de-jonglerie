<template>
  <div class="space-y-6">
    <!-- Type d'accès -->
    <div
      :class="`flex items-center justify-between p-4 rounded-lg ${volunteerConfig.bgClass} ${volunteerConfig.darkBgClass}`"
    >
      <div class="flex items-center gap-3">
        <UIcon :name="volunteerConfig.icon" :class="volunteerConfig.iconColorClass" size="32" />
        <div>
          <p :class="`text-sm ${volunteerConfig.textClass} ${volunteerConfig.darkTextClass}`">
            {{ $t('edition.ticketing.access_type') }}
          </p>
          <p class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ $t('edition.ticketing.volunteer') }}
          </p>
        </div>
      </div>
      <UBadge color="primary" variant="soft" size="lg">
        {{ $t('edition.ticketing.volunteer_accepted') }}
      </UBadge>
    </div>

    <!-- Statut de validation d'entrée -->
    <div
      v-if="volunteer.entryValidated"
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
            <span v-else>{{ $t('ticketing.participant.volunteer_validated') }}</span>
            {{
              dateDeValidation
                ? $t('ticketing.participant.validated_on', { date: dateDeValidation })
                : ''
            }}
          </p>
        </div>
      </div>
    </div>

    <!-- Informations du bénévole -->
    <TicketingUserInfoSection
      ref="userInfoSection"
      :title="$t('edition.ticketing.volunteer')"
      :first-name="editableFirstName"
      :last-name="editableLastName"
      :email="editableEmail"
      :phone="editablePhone"
      :original-email="volunteer.user.email"
      :is-email-verified="volunteer.user.isEmailVerified"
      :user-id="volunteer.user.id"
      @update:first-name="$emit('update:firstName', $event)"
      @update:last-name="$emit('update:lastName', $event)"
      @update:email="$emit('update:email', $event)"
      @update:phone="$emit('update:phone', $event)"
    />

    <!-- Équipes assignées -->
    <div v-if="volunteer.teams && volunteer.teams.length > 0" class="space-y-4">
      <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <UIcon :name="volunteerConfig.icon" :class="volunteerConfig.iconColorClass" />
        <h4 class="font-semibold text-gray-900 dark:text-white">
          {{ $t('edition.ticketing.teams') }}
        </h4>
      </div>

      <div class="space-y-2">
        <div
          v-for="team in volunteer.teams"
          :key="team.id"
          class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900"
        >
          <div class="flex items-center gap-2">
            <UIcon
              :name="volunteerConfig.icon"
              :class="`h-4 w-4 ${volunteerConfig.iconColorClass}`"
            />
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ team.name }}
            </span>
          </div>
          <UBadge v-if="team.isLeader" color="primary" variant="soft" size="sm">
            Responsable
          </UBadge>
        </div>
      </div>
    </div>

    <!-- Créneaux assignés -->
    <div class="space-y-4">
      <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <UIcon name="i-heroicons-clock" class="text-orange-600 dark:text-orange-400" />
        <h4 class="font-semibold text-gray-900 dark:text-white">
          {{ $t('edition.ticketing.time_slots') }}
        </h4>
      </div>

      <div v-if="volunteer.timeSlots && volunteer.timeSlots.length > 0" class="space-y-2">
        <div
          v-for="slot in volunteer.timeSlots"
          :key="slot.id"
          class="p-3 rounded-lg bg-gray-50 dark:bg-gray-900"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-calendar" class="h-4 w-4 text-orange-500 flex-shrink-0" />
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ slot.title }}
              </span>
            </div>
            <UBadge v-if="slot.team" color="neutral" variant="subtle" size="xs">
              {{ slot.team }}
            </UBadge>
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-400 ml-6">
            {{ debutDuCreneau(slot.startDateTime) }} - {{ finDuCreneau(slot.endDateTime) }}
          </div>
        </div>
      </div>

      <div
        v-else
        class="p-4 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg"
      >
        <UIcon name="i-heroicons-calendar-days" class="mx-auto h-8 w-8 mb-2 text-gray-400" />
        <p class="text-sm">{{ $t('ticketing.participant.no_slot_assigned') }}</p>
      </div>
    </div>

    <!-- Repas du bénévole -->
    <TicketingMealsDisplaySection :meals="volunteer.meals" />

    <!-- Boutons d'action. Le conteneur suit son bouton : vide, il laisserait un trait et une
         marge sous la fiche, qu'on lirait comme un bloc qui n'a pas fini de charger. -->
    <div
      v-if="volunteer.entryValidated"
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
        v-if="volunteer.entryValidated"
        :color="volunteer.entryValidated ? 'error' : 'success'"
        :icon="volunteer.entryValidated ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle'"
        :loading="validating"
        :disabled="!volunteer.entryValidated && !isEmailValid"
        @click="volunteer.entryValidated ? $emit('invalidate') : $emit('validate')"
      >
        {{ volunteer.entryValidated ? "Dévalider l'entrée" : "Valider l'entrée" }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type TicketingUserInfoSection from './TicketingUserInfoSection.vue'

import { formaterDateHeure, formaterHeure, formaterJournee } from '~~/shared/utils/fuseau-edition'

// Utiliser le composable pour obtenir la configuration des bénévoles
const { getParticipantTypeConfig } = useParticipantTypes()
const volunteerConfig = getParticipantTypeConfig('volunteer')

interface Volunteer {
  id: number
  user: {
    id: number
    firstName: string
    lastName: string
    email: string
    phone?: string | null
  }
  teams: Array<{
    id: number
    name: string
    isLeader: boolean
  }>
  timeSlots?: Array<{
    id: number
    title: string
    team?: string
    startDateTime: Date | string
    endDateTime: Date | string
  }>
  meals?: Array<{
    id: number
    date: Date | string
    mealType: string
    phases?: string[]
  }>
  entryValidated?: boolean
  entryValidatedAt?: Date | string
  entryValidatedBy?: {
    firstName: string
    lastName: string
  }
}

const props = defineProps<{
  volunteer: Volunteer
  editableFirstName: string | null
  editableLastName: string | null
  editableEmail: string | null
  editablePhone: string | null
  validating?: boolean
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
 * Les horaires d'un créneau, dans le fuseau de l'ÉDITION.
 *
 * ⚠️ CE QUI ÉTAIT ÉCRIT ICI : `new Date(slot.startDateTime).toLocaleString('fr-FR', …)`. Deux
 * défauts d'un coup, et c'est exactement ceux que le commentaire d'`entryValidatedAt`, vingt
 * lignes plus bas, décrit comme corrigés — la correction n'avait pas été reportée sur le bloc du
 * dessus : la langue était figée pour tout le monde, et l'heure était lue dans le fuseau du
 * NAVIGATEUR. Au guichet d'une convention à l'étranger, ou simplement pour un organisateur en
 * déplacement, les créneaux s'affichaient décalés — sans rien qui le signale.
 *
 * 📍 Le format compact est conservé tel quel (`01/08/26 14:00`) : la ligne est en `text-xs` à côté
 * du titre du créneau, et c'est le FUSEAU qui était faux, pas la mise en forme.
 */
const debutDuCreneau = (instant: Date | string) =>
  formaterJournee(instant, props.fuseau, locale.value, {
    dateStyle: 'short',
    timeStyle: 'short',
  })

const finDuCreneau = (instant: Date | string) => formaterHeure(instant, props.fuseau, locale.value)

/**
 * Qui a validé, et quand — à l'heure du lieu.
 *
 * Les trois cartes composaient ces deux lignes en français dans le gabarit, et dataient avec
 * `toLocaleDateString('fr-FR')` : la langue était figée pour tout le monde, et l'horodatage était
 * celui du navigateur. Un contrôle d'accès se relit sur place ; une entrée validée à 23 h se
 * serait affichée au lendemain pour qui consulte depuis un fuseau plus à l'est.
 */
const nomDuValidateur = computed(() =>
  props.volunteer.entryValidatedBy
    ? `${props.volunteer.entryValidatedBy.firstName} ${props.volunteer.entryValidatedBy.lastName}`
    : ''
)

const dateDeValidation = computed(() =>
  props.volunteer.entryValidatedAt
    ? formaterDateHeure(props.volunteer.entryValidatedAt, props.fuseau, locale.value)
    : ''
)

// Référence au composant TicketingUserInfoSection qui contient EmailValidationInput
const userInfoSection = ref<InstanceType<typeof TicketingUserInfoSection> | null>(null)

// Vérifier si l'email est valide en accédant à emailInput via userInfoSection
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
