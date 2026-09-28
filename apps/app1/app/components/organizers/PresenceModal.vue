<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <div class="space-y-6">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('gestion.organizers.presence.description') }}
        </p>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField :label="$t('gestion.organizers.presence.arrival')">
            <USelect
              v-model="arrivee"
              :items="creneaux"
              value-key="value"
              :placeholder="$t('gestion.organizers.presence.not_declared')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('gestion.organizers.presence.departure')" :error="erreurDeDate">
            <USelect
              v-model="depart"
              :items="creneaux"
              value-key="value"
              :placeholder="$t('gestion.organizers.presence.not_declared')"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Ce que ces dates servent réellement : sans elles, l'organisateur est compté présent du
             premier au dernier jour, ce qui est le repli faute de mieux. -->
        <UAlert
          icon="i-heroicons-information-circle"
          color="neutral"
          variant="subtle"
          :description="$t('gestion.organizers.presence.affluence_notice')"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-between gap-2">
        <!-- Effacer les deux d'un geste : sans cela, un sélecteur posé par erreur ne se vide pas. -->
        <UButton color="neutral" variant="ghost" :disabled="!arrivee && !depart" @click="effacer">
          {{ $t('gestion.organizers.presence.clear') }}
        </UButton>

        <div class="flex gap-2">
          <UButton color="neutral" variant="soft" @click="isOpen = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton :loading="enregistrement" :disabled="!!erreurDeDate" @click="enregistrer">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { creneauxDePresence } from '~~/shared/utils/presence-benevole'

/**
 * Quand un organisateur arrive sur place, et quand il repart.
 *
 * Ces dates n'existaient pas : les bénévoles les déclarent dans leur candidature, les artistes
 * depuis leur espace, mais rien ne les portait pour un organisateur — et le graphique d'affluence le
 * comptait donc présent du premier au dernier jour.
 *
 * **Le format est celui des bénévoles**, `AAAA-MM-JJ_moment`, sur décision de l'utilisateur : c'est
 * ce qu'on déclare vraiment — « j'arrive samedi matin » — et le même util partagé en tire une
 * fenêtre pour les deux populations.
 *
 * Saisi ICI et non par l'intéressé : il n'existe aucun espace personnel d'organisateur sur une
 * édition, contrairement aux artistes et aux bénévoles qui en ont chacun un.
 */

interface OrganisateurConcerne {
  id: number
  arrivalDateTime?: string | null
  departureDateTime?: string | null
  user: { pseudo: string; prenom?: string | null; nom?: string | null; pronouns?: string | null }
}

const props = defineProps<{
  modelValue: boolean
  organizer: OrganisateurConcerne | null
  editionId: number
  /** Les bornes de l'édition, montage et démontage compris : un organisateur y est souvent. */
  debut: string | Date | null | undefined
  fin: string | Date | null | undefined
  timezone?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { t, locale } = useI18n()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const arrivee = ref<string | undefined>(undefined)
const depart = ref<string | undefined>(undefined)

const title = computed(() =>
  props.organizer
    ? t('gestion.organizers.presence.title', {
        name: formatUserFullName(props.organizer.user, t),
      })
    : ''
)

/**
 * Les créneaux proposés, jour par jour et moment par moment.
 *
 * La matière vient de l'util partagé — qui découpe les journées au fuseau de l'ÉDITION — et les
 * libellés sont composés ici, dans la langue du lecteur.
 */
const creneaux = computed(() => {
  if (!props.debut || !props.fin) return []

  return creneauxDePresence(props.debut, props.fin, props.timezone).map(
    ({ valeur, jour, moment }) => {
      const journee = new Date(`${jour}T12:00:00Z`).toLocaleDateString(locale.value, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      return {
        value: valeur,
        label: `${journee.charAt(0).toUpperCase()}${journee.slice(1)} — ${t(
          `edition.volunteers.time_granularity.${moment}`
        )}`,
      }
    }
  )
})

/**
 * Un départ antérieur à l'arrivée est une saisie, pas une donnée.
 *
 * Refusé ici ET par le serveur : la garde côté client explique, celle du serveur protège.
 */
const erreurDeDate = computed(() => {
  if (!arrivee.value || !depart.value) return undefined
  return depart.value.slice(0, 10) < arrivee.value.slice(0, 10)
    ? t('gestion.organizers.presence.departure_before_arrival')
    : undefined
})

const effacer = () => {
  arrivee.value = undefined
  depart.value = undefined
}

// Repartir de la ligne à chaque ouverture : sans cela, ouvrir la modale d'un second organisateur
// afficherait les dates du premier.
watch(
  () => [props.modelValue, props.organizer] as const,
  ([ouverte, organisateur]) => {
    if (!ouverte) return
    arrivee.value = organisateur?.arrivalDateTime ?? undefined
    depart.value = organisateur?.departureDateTime ?? undefined
  },
  { immediate: true }
)

const { execute: executerEnregistrement, loading: enregistrement } = useApiAction(
  () =>
    `/api/editions/${props.editionId}/organizers/edition-organizers/${props.organizer?.id}/presence`,
  {
    method: 'PUT',
    body: () => ({
      arrivalDateTime: arrivee.value ?? null,
      departureDateTime: depart.value ?? null,
    }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('gestion.organizers.presence.error_saving') },
    onSuccess: () => {
      emit('saved')
      isOpen.value = false
    },
  }
)

const enregistrer = () => {
  if (erreurDeDate.value) return
  executerEnregistrement()
}
</script>
