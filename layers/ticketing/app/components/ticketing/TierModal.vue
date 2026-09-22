<template>
  <UModal
    v-model:open="isOpen"
    :title="tier ? 'Modifier le tarif' : 'Ajouter un tarif'"
    :ui="{ width: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form class="space-y-6" @submit.prevent="handleSubmit">
        <UAlert
          v-if="isHelloAssoTier"
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          :title="$t('ticketing.tiers.modal.title')"
          description="Ce tarif est synchronisé depuis HelloAsso. Seuls les articles à remettre et les dates de validité peuvent être modifiés."
        />

        <UFormField
          :label="
            isHelloAssoTier ? 'Nom original (HelloAsso)' : $t('ticketing.tiers.modal.name_label')
          "
          name="name"
          :required="!isHelloAssoTier"
        >
          <UInput
            v-model="form.name"
            :disabled="isHelloAssoTier"
            :placeholder="$t('ticketing.tiers.modal.name_placeholder')"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="isHelloAssoTier ? 'Nom personnalisé (optionnel)' : 'Nom d\'affichage (optionnel)'"
          name="customName"
          :help="
            isHelloAssoTier
              ? 'Laissez vide pour utiliser le nom HelloAsso'
              : 'Laissez vide pour utiliser le nom principal'
          "
        >
          <UInput
            v-model="form.customName"
            placeholder="Nom personnalisé pour l'affichage"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('ticketing.tiers.modal.description_label')" name="description">
          <UTextarea
            v-model="form.description"
            :disabled="isHelloAssoTier"
            :placeholder="$t('ticketing.tiers.modal.description_placeholder')"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <!-- Prix fixe (masqué si tarif libre) -->
        <UFormField
          v-if="!form.isFree"
          :label="$t('ticketing.tiers.modal.price_label')"
          name="price"
          required
        >
          <UInput
            v-model="form.priceInEuros"
            :disabled="isHelloAssoTier"
            type="number"
            step="0.01"
            min="0"
            :placeholder="$t('ticketing.tiers.modal.price_placeholder')"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <div
          class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <UFormField :label="$t('ticketing.tiers.modal.free_price_label')" name="isFree">
            <div class="flex items-start gap-3">
              <USwitch v-model="form.isFree" :disabled="isHelloAssoTier" class="mt-1" />
              <div class="flex-1">
                <label for="isFree" class="text-sm font-medium text-gray-900 dark:text-white">
                  Permettre au participant de choisir le montant
                </label>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Le participant pourra choisir le montant qu'il souhaite payer
                </p>
              </div>
            </div>
          </UFormField>

          <div v-if="form.isFree" class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <UFormField
              :label="$t('ticketing.tiers.modal.min_amount_label')"
              name="minAmount"
              help="Peut être à 0 pour permettre la participation gratuite"
            >
              <UInput
                v-model="form.minAmountInEuros"
                :disabled="isHelloAssoTier"
                type="number"
                step="0.01"
                min="0"
                :placeholder="$t('ticketing.tiers.modal.min_amount_placeholder')"
                class="w-full"
              />
            </UFormField>

            <UFormField
              :label="$t('ticketing.tiers.modal.max_amount_label')"
              name="maxAmount"
              help="Laissez vide pour un don sans limite haute"
            >
              <UInput
                v-model="form.maxAmountInEuros"
                :disabled="isHelloAssoTier"
                type="number"
                step="0.01"
                min="0"
                :placeholder="$t('ticketing.tiers.modal.max_amount_placeholder')"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField
            :label="$t('ticketing.tiers.modal.position_label')"
            name="position"
            help="Ordre d'affichage (0 = premier)"
          >
            <UInput
              v-model.number="form.position"
              :disabled="isHelloAssoTier"
              type="number"
              min="0"
              :placeholder="$t('ticketing.tiers.modal.position_placeholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('ticketing.tiers.modal.status_label')" name="isActive">
            <div class="flex items-start gap-3 pt-2">
              <USwitch v-model="form.isActive" :disabled="isHelloAssoTier" class="mt-1" />
              <div class="flex-1">
                <label for="isActive" class="text-sm font-medium text-gray-900 dark:text-white">
                  Tarif actif
                </label>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Visible et sélectionnable par les participants
                </p>
              </div>
            </div>
          </UFormField>
        </div>

        <UFormField label="Comptabilisation des participants" name="countAsParticipant">
          <div class="flex items-start gap-3">
            <UCheckbox v-model="form.countAsParticipant" class="mt-1" />
            <div class="flex-1">
              <label
                for="countAsParticipant"
                class="text-sm font-medium text-gray-900 dark:text-white"
              >
                Compter comme participant dans les statistiques
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Décochez cette option si ce tarif ne représente pas un participant physique (ex:
                don, prestation annexe)
              </p>
            </div>
          </div>
        </UFormField>

        <div
          class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
            Dates de validité (optionnel)
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Définissez une période pendant laquelle ce tarif sera disponible à l'achat
          </p>

          <!-- Option "Toute la journée" -->
          <div class="mb-4">
            <UFormField name="isAllDay">
              <div class="flex items-start gap-3">
                <USwitch v-model="form.isAllDay" class="mt-1" />
                <div class="flex-1">
                  <label for="isAllDay" class="text-sm font-medium text-gray-900 dark:text-white">
                    Toute la journée
                  </label>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Date de début à 00h00 et date de fin à 23h59
                  </p>
                </div>
              </div>
            </UFormField>
          </div>

          <!-- `clearable` sur les quatre champs : ces bornes sont FACULTATIVES — leur texte à
               vide dit « Aucune limite » — et rien ne permettait de les retirer une fois
               posées. Ni le calendrier ni le sélecteur ne se vident d'eux-mêmes. -->
          <UFormField label="Date de début" name="validFrom">
            <UiDateField
              v-if="form.isAllDay"
              v-model="validFromForField"
              placeholder="Aucune limite"
              clearable
            />
            <UiDateTimePicker
              v-else
              v-model="validFromForDateTime"
              placeholder="Aucune limite"
              clearable
            />
          </UFormField>

          <UFormField label="Date de fin" name="validUntil">
            <UiDateField
              v-if="form.isAllDay"
              v-model="validUntilForField"
              placeholder="Aucune limite"
              clearable
            />
            <UiDateTimePicker
              v-else
              v-model="validUntilForDateTime"
              placeholder="Aucune limite"
              clearable
            />
          </UFormField>
        </div>

        <UFormField
          v-if="edition?.mealsEnabled"
          :label="$t('ticketing.tiers.modal.meals_label')"
          name="meals"
        >
          <USelectMenu
            v-model="form.mealIds"
            :items="mealsOptions"
            value-key="value"
            multiple
            searchable
            :placeholder="$t('ticketing.tiers.modal.meals_placeholder')"
            class="w-full"
          >
            <template #default>
              <span v-if="form.mealIds.length === 0">{{
                $t('ticketing.tiers.modal.no_meal_selected')
              }}</span>
              <span v-else>{{ form.mealIds.length }} repas sélectionné(s)</span>
            </template>
          </USelectMenu>
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton color="neutral" variant="soft" @click="isOpen = false"> Annuler </UButton>
        <UButton color="primary" icon="i-heroicons-check" :loading="saving" @click="handleSubmit">
          {{ tier ? 'Enregistrer' : 'Ajouter' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useEditionStore } from '~/stores/editions'
import { entierPositifDuChamp } from '~/utils/champ-numerique'

import { isFreePrice } from '../../utils/ticketing/tiers'

import { versChampLocal, versInstant } from '~~/shared/utils/fuseau-edition'

interface TicketingTier {
  id: number
  name: string
  customName?: string
  originalName?: string // Nom original HelloAsso si applicable
  description?: string
  price: number
  minAmount?: number
  maxAmount?: number
  isActive: boolean
  countAsParticipant?: boolean
  position: number
  validFrom?: string | Date | null
  validUntil?: string | Date | null
  helloAssoTierId?: number
  quotas?: any[]
  handoutItems?: any[]
}

const props = defineProps<{
  open: boolean
  tier?: TicketingTier
  editionId: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const editionStore = useEditionStore()
const edition = computed(() => editionStore.getEditionById(props.editionId))

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

/**
 * Le fuseau de l'édition : les dates de validité d'un tarif sont celles du LIEU.
 *
 * Un tarif qui s'ouvre « le 2 octobre à 18 h » s'ouvre à 18 h sur place, quel que soit l'endroit
 * d'où l'organisateur le saisit ou le relit.
 */
const fuseauEdition = computed(() => (edition.value as { timezone?: string | null })?.timezone)

/**
 * L'instant stocké, ramené à l'heure murale de l'édition pour le formulaire.
 *
 * Remplace une conversion qui passait par `getTimezoneOffset()`, c'est-à-dire par le fuseau du
 * NAVIGATEUR. Conjuguée à une écriture sans fuseau, elle décalait les horaires de deux heures en
 * été — mesuré : 18 h saisi ressortait à 20 h.
 */
const versHeureDeLEdition = (instant: string | Date) => versChampLocal(instant, fuseauEdition.value)

/**
 * Les deux bornes couvrent-elles des journées entières ?
 *
 * Lu sur la chaîne elle-même — `2026-10-02T00:00` — et non sur un objet `Date` : ces valeurs sont
 * déjà l'heure du lieu, et les relire par `getHours()` les ferait repasser par le fuseau de la
 * machine, ce que ce correctif s'emploie justement à supprimer.
 */
const isAllDayDates = (validFrom: string | null, validUntil: string | null) => {
  if (!validFrom || !validUntil) return false
  return validFrom.slice(11, 16) === '00:00' && validUntil.slice(11, 16) === '23:59'
}

// Fonction pour convertir une date en "toute la journée"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setAllDayTimes = (dateFrom: string | null, dateUntil: string | null) => {
  if (!dateFrom || !dateUntil) return { from: dateFrom, until: dateUntil }

  // Extraire seulement la partie date et ajouter les heures
  const fromDateOnly = dateFrom.slice(0, 10)
  const untilDateOnly = dateUntil.slice(0, 10)

  return {
    from: `${fromDateOnly}T00:00`,
    until: `${untilDateOnly}T23:59`,
  }
}

// Vérifie si c'est un tarif HelloAsso (lecture seule sauf articles à remettre et dates)
const isHelloAssoTier = computed(
  () => props.tier?.helloAssoTierId !== null && props.tier?.helloAssoTierId !== undefined
)

const form = ref({
  name: '',
  customName: '',
  description: '',
  priceInEuros: '0',
  minAmountInEuros: '',
  maxAmountInEuros: '',
  position: 0,
  isActive: true,
  countAsParticipant: true,
  isFree: false,
  validFrom: null as string | null,
  validUntil: null as string | null,
  isAllDay: false,
  mealIds: [] as number[],
})

// Proxies pour UiDateField / UiDateTimePicker (qui attendent string non-null)
// On stocke null en interne quand le champ est vide pour rester compatible
// avec le payload existant et le watcher isAllDay.
const validFromForField = computed<string>({
  get: () => form.value.validFrom || '',
  set: (v) => {
    form.value.validFrom = v || null
  },
})
const validFromForDateTime = validFromForField
const validUntilForField = computed<string>({
  get: () => form.value.validUntil || '',
  set: (v) => {
    form.value.validUntil = v || null
  },
})
const validUntilForDateTime = validUntilForField

// Charger les repas disponibles
const meals = ref<any[]>([])

// Utiliser les utilitaires meals pour formater les labels
const { getMealTypeLabel } = useMealTypeLabel()
const { getPhasesLabel } = useMealPhaseLabel()

// Computed pour formater les options de repas
const mealsOptions = computed(() => {
  return meals.value.map((meal) => {
    const dateStr = new Date(meal.date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    const mealTypeLabel = getMealTypeLabel(meal.mealType)
    const phasesLabel = getPhasesLabel(meal.phases)

    return {
      label: `${dateStr} - ${mealTypeLabel} (${phasesLabel})`,
      value: meal.id,
    }
  })
})

const loadQuotasAndItems = async () => {
  if (!edition.value?.mealsEnabled) return
  try {
    const mealsResponse: any = await $fetch(`/api/editions/${props.editionId}/volunteers/meals`)
    meals.value = Array.isArray(mealsResponse?.data?.meals) ? mealsResponse.data.meals : []
  } catch (error) {
    console.error('Failed to load meals:', error)
  }
}

// Réinitialiser le formulaire quand la modal s'ouvre
watch(
  () => props.open,
  async (newValue) => {
    if (newValue) {
      await loadQuotasAndItems()

      if (props.tier) {
        // Mode édition
        const validFromLocal = props.tier.validFrom
          ? versHeureDeLEdition(props.tier.validFrom)
          : null
        const validUntilLocal = props.tier.validUntil
          ? versHeureDeLEdition(props.tier.validUntil)
          : null
        const isAllDay = isAllDayDates(validFromLocal, validUntilLocal)

        form.value = {
          name: props.tier.originalName || props.tier.name,
          customName: props.tier.customName || '',
          description: props.tier.description || '',
          priceInEuros: (props.tier.price / 100).toFixed(2),
          minAmountInEuros:
            props.tier.minAmount != null ? (props.tier.minAmount / 100).toFixed(2) : '',
          maxAmountInEuros:
            props.tier.maxAmount != null ? (props.tier.maxAmount / 100).toFixed(2) : '',
          position: props.tier.position,
          isActive: props.tier.isActive,
          countAsParticipant: props.tier.countAsParticipant ?? true,
          isFree: isFreePrice(props.tier),
          validFrom: validFromLocal,
          validUntil: validUntilLocal,
          isAllDay,
          mealIds: props.tier.meals?.map((m: any) => m.mealId) || [],
        }
      } else {
        // Mode création
        form.value = {
          name: '',
          customName: '',
          description: '',
          priceInEuros: '0',
          minAmountInEuros: '',
          maxAmountInEuros: '',
          position: 0,
          isActive: true,
          countAsParticipant: true,
          isFree: false,
          validFrom: null,
          validUntil: null,
          isAllDay: false,
          mealIds: [],
        }
      }
    }
  }
)

// Watcher pour gérer automatiquement les heures quand "Toute la journée" est activé/désactivé
watch(
  () => form.value.isAllDay,
  (isAllDay, wasAllDay) => {
    // Les heures tombent ou reviennent ; les JOURNÉES, elles, ne bougent pas. Cocher la case
    // écrasait la date de fin avec celle de début : un tarif valable du 1er au 2 octobre se
    // retrouvait valable le 1er seulement, sans que rien ne le signale.
    const journee = (valeur: string | null) => (valeur ? valeur.slice(0, 10) : null)

    if (isAllDay && !wasAllDay) {
      const debut = journee(form.value.validFrom)
      const fin = journee(form.value.validUntil)

      // Chaque borne garde la sienne. Celle qui manque emprunte à l'autre — c'était l'intention
      // d'origine, et elle est utile : une seule date saisie décrit bien une journée entière.
      form.value.validFrom = debut ?? fin
      form.value.validUntil = fin ?? debut
    } else if (!isAllDay && wasAllDay) {
      // `journee()` avant de concaténer : un tarif enregistré en journée entière se recharge
      // avec ses heures — `2026-10-01T00:00` —, et coller un second suffixe produisait
      // `2026-10-01T00:00T00:00`, que plus rien ne sait relire.
      const debut = journee(form.value.validFrom)
      const fin = journee(form.value.validUntil)

      if (debut) form.value.validFrom = `${debut}T00:00`
      if (fin) form.value.validUntil = `${fin}T23:59`
    }
  }
)

// Watcher pour pré-remplir minAmount quand on active "Tarif libre"
watch(
  () => form.value.isFree,
  (isFree, wasFree) => {
    if (isFree && !wasFree) {
      // Activation du tarif libre : pré-remplir minAmount avec le prix actuel si > 0
      const currentPrice = parseFloat(form.value.priceInEuros)
      if (currentPrice > 0 && !form.value.minAmountInEuros) {
        form.value.minAmountInEuros = form.value.priceInEuros
      }
    }
  }
)

// Computed pour obtenir les dates finales avec les bonnes heures
/**
 * Les bornes telles qu'elles partent au serveur : un INSTANT, pas une heure murale.
 *
 * C'est ici que se jouait le défaut. La chaîne `2026-10-02T18:00` partait nue, et le serveur —
 * qui tourne en UTC — la lisait comme 18 h UTC, soit 20 h à Paris. `versInstant` l'ancre dans le
 * fuseau de l'édition avant l'envoi, et le serveur n'a plus rien à deviner.
 *
 * `versInstant` rend une chaîne vide plutôt qu'un instant inventé si le fuseau annoncé est
 * inconnu ou la saisie illisible : l'API refusera, ce qui vaut mieux qu'une date fausse en base.
 */
const versInstantDeLEdition = (heureLocale: string) =>
  versInstant(heureLocale, fuseauEdition.value) || null

/** L'heure murale retenue, avant ancrage : 00:00 et 23:59 en mode « toute la journée ». */
const heureLocaleValidFrom = computed(() => {
  if (!form.value.validFrom) return null
  if (!form.value.isAllDay) return form.value.validFrom
  return `${form.value.validFrom.slice(0, 10)}T00:00`
})

const heureLocaleValidUntil = computed(() => {
  if (!form.value.validUntil) return null
  if (!form.value.isAllDay) return form.value.validUntil
  return `${form.value.validUntil.slice(0, 10)}T23:59`
})

const finalValidFrom = computed(() =>
  heureLocaleValidFrom.value ? versInstantDeLEdition(heureLocaleValidFrom.value) : null
)

const finalValidUntil = computed(() =>
  heureLocaleValidUntil.value ? versInstantDeLEdition(heureLocaleValidUntil.value) : null
)

// Construit les données du formulaire pour l'API
const buildFormData = () => {
  // En mode tarif libre, utiliser minAmount comme prix de référence (ou 0 si non défini)
  const priceValue = form.value.isFree
    ? form.value.minAmountInEuros
      ? Math.round(parseFloat(form.value.minAmountInEuros) * 100)
      : 0
    : Math.round(parseFloat(form.value.priceInEuros) * 100)

  return {
    name: form.value.name.trim(),
    customName: form.value.customName.trim() || null,
    description: form.value.description.trim() || null,
    price: priceValue,
    minAmount:
      form.value.isFree && form.value.minAmountInEuros != null && form.value.minAmountInEuros !== ''
        ? Math.round(parseFloat(form.value.minAmountInEuros) * 100)
        : null,
    maxAmount:
      form.value.isFree && form.value.maxAmountInEuros != null && form.value.maxAmountInEuros !== ''
        ? Math.round(parseFloat(form.value.maxAmountInEuros) * 100)
        : null,
    // Vider le champ ne doit pas faire échouer l'enregistrement.
    //
    // `v-model.number` n'est pas la garantie qu'on croit : Vue passe la valeur à `parseFloat`
    // et, quand le résultat est `NaN`, **rend la chaîne d'origine**. Un champ vidé donne donc
    // `''`, que le schéma refuse — « expected number, received string », 400 en production sur
    // un formulaire où l'on n'avait touché qu'à ce champ-là pour l'effacer.
    //
    // Zéro plutôt qu'une erreur, parce que c'est déjà ce que le serveur fait d'une position
    // absente (`.default(0)`) : effacer le champ et ne pas le remplir doivent vouloir dire la
    // même chose. Les montants, juste au-dessus, prennent la même précaution.
    position: entierPositifDuChamp(form.value.position),
    isActive: form.value.isActive,
    countAsParticipant: form.value.countAsParticipant,
    validFrom: finalValidFrom.value,
    validUntil: finalValidUntil.value,
    // Pas de `quotaIds` : les quotas se règlent sur la page dédiée, et l'endpoint ne les
    // accepte plus du tout — il n'y a donc qu'un seul chemin pour les modifier.
    mealIds: form.value.mealIds,
  }
}

// Callbacks communs
const onSaveSuccess = () => {
  emit('saved')
  isOpen.value = false
}

// Action pour créer un tarif
const { execute: executeCreate, loading: isCreating } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/tiers`,
  {
    method: 'POST',
    body: buildFormData,
    successMessage: { title: t('ticketing.tiers.created') },
    errorMessages: { default: t('ticketing.tiers.error_saving') },
    onSuccess: onSaveSuccess,
  }
)

// Action pour mettre à jour un tarif
const { execute: executeUpdate, loading: isUpdating } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/tiers/${props.tier?.id}`,
  {
    method: 'PUT',
    body: buildFormData,
    successMessage: { title: t('ticketing.tiers.updated') },
    errorMessages: { default: t('ticketing.tiers.error_saving') },
    onSuccess: onSaveSuccess,
  }
)

// État de chargement combiné
const saving = computed(() => isCreating.value || isUpdating.value)

const handleSubmit = () => {
  const toast = useToast()

  if (!form.value.name.trim()) {
    toast.add({
      title: t('common.error'),
      description: t('ticketing.tiers.name_required'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  if (props.tier) {
    executeUpdate()
  } else {
    executeCreate()
  }
}
</script>
