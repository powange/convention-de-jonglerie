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
          description="Ce tarif est synchronisé depuis HelloAsso. Seuls les quotas, articles à restituer et dates de validité peuvent être modifiés."
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
              help="Peut être à 0€ pour permettre la participation gratuite"
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

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Date de début" name="validFrom">
              <UInput
                v-model="form.validFrom"
                :type="form.isAllDay ? 'date' : 'datetime-local'"
                icon="i-heroicons-calendar"
                placeholder="Aucune limite"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Date de fin" name="validUntil">
              <UInput
                v-model="form.validUntil"
                :type="form.isAllDay ? 'date' : 'datetime-local'"
                icon="i-heroicons-calendar"
                placeholder="Aucune limite"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <UFormField :label="$t('ticketing.tiers.modal.quotas_label')" name="quotas">
          <USelectMenu
            v-model="form.quotaIds"
            :items="(quotas || []).map((q) => ({ label: q.title, value: q.id }))"
            value-key="value"
            multiple
            searchable
            :placeholder="$t('ticketing.tiers.modal.quotas_placeholder')"
            class="w-full"
          >
            <template #label>
              <span v-if="form.quotaIds.length === 0">{{
                $t('ticketing.tiers.modal.no_quota_selected')
              }}</span>
              <span v-else>{{ form.quotaIds.length }} quota(s) sélectionné(s)</span>
            </template>
          </USelectMenu>
        </UFormField>

        <UFormField
          :label="$t('ticketing.tiers.modal.returnable_items_label')"
          name="returnableItems"
        >
          <USelectMenu
            v-model="form.returnableItemIds"
            :items="(returnableItems || []).map((item) => ({ label: item.name, value: item.id }))"
            value-key="value"
            multiple
            searchable
            :placeholder="$t('ticketing.tiers.modal.returnable_items_placeholder')"
            class="w-full"
          >
            <template #label>
              <span v-if="form.returnableItemIds.length === 0">{{
                $t('ticketing.tiers.modal.no_item_selected')
              }}</span>
              <span v-else>{{ form.returnableItemIds.length }} article(s) sélectionné(s)</span>
            </template>
          </USelectMenu>
        </UFormField>

        <UFormField :label="$t('ticketing.tiers.modal.meals_label')" name="meals">
          <USelectMenu
            v-model="form.mealIds"
            :items="mealsOptions"
            value-key="value"
            multiple
            searchable
            :placeholder="$t('ticketing.tiers.modal.meals_placeholder')"
            class="w-full"
          >
            <template #label>
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

import { createTier, isFreePrice, updateTier } from '~/utils/ticketing/tiers'

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
  returnableItems?: any[]
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

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const saving = ref(false)

// Fonction pour convertir une date en format datetime-local sans décalage horaire
const toDateTimeLocal = (dateString: string | Date) => {
  const date = new Date(dateString)
  // Créer une nouvelle date en ajustant pour le fuseau horaire local
  const tzOffset = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - tzOffset)
  return localDate.toISOString().slice(0, 16)
}

// Fonction pour convertir une date en format date (sans heure)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const toDateOnly = (dateString: string | Date) => {
  const date = new Date(dateString)
  const tzOffset = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - tzOffset)
  return localDate.toISOString().slice(0, 10)
}

// Fonction pour détecter si les dates correspondent à "toute la journée"
const isAllDayDates = (validFrom: string | null, validUntil: string | null) => {
  if (!validFrom || !validUntil) return false

  const startDate = new Date(validFrom)
  const endDate = new Date(validUntil)

  // Vérifier si l'heure de début est 00:00 et l'heure de fin est 23:59
  return (
    startDate.getHours() === 0 &&
    startDate.getMinutes() === 0 &&
    endDate.getHours() === 23 &&
    endDate.getMinutes() === 59
  )
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

// Vérifie si c'est un tarif HelloAsso (lecture seule sauf quotas et items)
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
  quotaIds: [] as number[],
  returnableItemIds: [] as number[],
  mealIds: [] as number[],
})

// Charger les quotas, items et repas disponibles
const quotas = ref<any[]>([])
const returnableItems = ref<any[]>([])
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
  try {
    const [quotasData, itemsResponse, mealsResponse] = await Promise.all([
      $fetch(`/api/editions/${props.editionId}/ticketing/quotas`),
      $fetch(`/api/editions/${props.editionId}/ticketing/returnable-items`),
      $fetch(`/api/editions/${props.editionId}/volunteers/meals`),
    ])
    quotas.value = Array.isArray(quotasData) ? quotasData : []
    returnableItems.value = Array.isArray(itemsResponse?.returnableItems)
      ? itemsResponse.returnableItems
      : []
    meals.value = Array.isArray(mealsResponse?.meals) ? mealsResponse.meals : []
  } catch (error) {
    console.error('Failed to load quotas, items and meals:', error)
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
        const validFromLocal = props.tier.validFrom ? toDateTimeLocal(props.tier.validFrom) : null
        const validUntilLocal = props.tier.validUntil
          ? toDateTimeLocal(props.tier.validUntil)
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
          quotaIds: props.tier.quotas?.map((q: any) => q.quotaId) || [],
          returnableItemIds: props.tier.returnableItems?.map((r: any) => r.returnableItemId) || [],
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
          quotaIds: [],
          returnableItemIds: [],
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
    if (isAllDay && !wasAllDay) {
      // Passage vers "toute la journée"
      let fromDate = null
      let untilDate = null

      // Extraire les dates existantes (enlever les heures si elles existent)
      if (form.value.validFrom) {
        fromDate = form.value.validFrom.slice(0, 10)
      }
      if (form.value.validUntil) {
        untilDate = form.value.validUntil.slice(0, 10)
      }

      // Si on a au moins une date, configurer les deux
      if (fromDate || untilDate) {
        const targetDate = fromDate || untilDate
        form.value.validFrom = targetDate
        form.value.validUntil = targetDate
      }
    } else if (!isAllDay && wasAllDay) {
      // Passage vers datetime précis - on garde les dates mais on ajoute des heures par défaut
      if (form.value.validFrom) {
        form.value.validFrom = `${form.value.validFrom}T00:00`
      }
      if (form.value.validUntil) {
        form.value.validUntil = `${form.value.validUntil}T23:59`
      }
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
const finalValidFrom = computed(() => {
  if (!form.value.validFrom) return null

  if (form.value.isAllDay) {
    // En mode "toute la journée", assurer les heures 00:00
    return form.value.validFrom.length === 10
      ? `${form.value.validFrom}T00:00`
      : form.value.validFrom.slice(0, 10) + 'T00:00'
  }

  return form.value.validFrom
})

const finalValidUntil = computed(() => {
  if (!form.value.validUntil) return null

  if (form.value.isAllDay) {
    // En mode "toute la journée", assurer les heures 23:59
    return form.value.validUntil.length === 10
      ? `${form.value.validUntil}T23:59`
      : form.value.validUntil.slice(0, 10) + 'T23:59'
  }

  return form.value.validUntil
})

const handleSubmit = async () => {
  const toast = useToast()

  if (!form.value.name.trim()) {
    toast.add({
      title: 'Erreur',
      description: 'Le nom du tarif est obligatoire',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  saving.value = true
  try {
    // En mode tarif libre, utiliser minAmount comme prix de référence (ou 0 si non défini)
    const priceValue = form.value.isFree
      ? form.value.minAmountInEuros
        ? Math.round(parseFloat(form.value.minAmountInEuros) * 100)
        : 0
      : Math.round(parseFloat(form.value.priceInEuros) * 100)

    const data = {
      name: form.value.name.trim(),
      customName: form.value.customName.trim() || null,
      description: form.value.description.trim() || null,
      price: priceValue,
      minAmount:
        form.value.isFree &&
        form.value.minAmountInEuros != null &&
        form.value.minAmountInEuros !== ''
          ? Math.round(parseFloat(form.value.minAmountInEuros) * 100)
          : null,
      maxAmount:
        form.value.isFree &&
        form.value.maxAmountInEuros != null &&
        form.value.maxAmountInEuros !== ''
          ? Math.round(parseFloat(form.value.maxAmountInEuros) * 100)
          : null,
      position: form.value.position,
      isActive: form.value.isActive,
      countAsParticipant: form.value.countAsParticipant,
      validFrom: finalValidFrom.value,
      validUntil: finalValidUntil.value,
      quotaIds: form.value.quotaIds,
      returnableItemIds: form.value.returnableItemIds,
      mealIds: form.value.mealIds,
    }

    if (props.tier) {
      // Mode édition
      await updateTier(props.editionId, props.tier.id, data)
      toast.add({
        title: 'Tarif modifié',
        description: 'Le tarif a été modifié avec succès',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else {
      // Mode création
      await createTier(props.editionId, data)
      toast.add({
        title: 'Tarif créé',
        description: 'Le tarif a été créé avec succès',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }

    emit('saved')
    isOpen.value = false
  } catch (error: any) {
    console.error('Failed to save tier:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible d'enregistrer le tarif",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
