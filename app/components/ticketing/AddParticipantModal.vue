<template>
  <UModal
    v-model:open="isOpen"
    :title="currentStepTitle"
    size="xl"
    :prevent-close="loading"
    @close="closeModal"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Indicateur d'étapes -->
        <UStepper v-model="currentStep" :items="stepperItems" class="mb-6" />

        <!-- Étape 1 : Informations acheteur -->
        <div v-if="currentStep === 0" class="space-y-4">
          <UFormField
            :label="$t('editions.ticketing.payer_first_name')"
            required
            :error="errors.payerFirstName"
          >
            <UInput
              v-model="form.payerFirstName"
              :placeholder="$t('editions.ticketing.first_name_placeholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="$t('editions.ticketing.payer_last_name')"
            required
            :error="errors.payerLastName"
          >
            <UInput
              v-model="form.payerLastName"
              :placeholder="$t('editions.ticketing.last_name_placeholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="$t('editions.ticketing.payer_email')"
            required
            :error="errors.payerEmail"
          >
            <UInput
              v-model="form.payerEmail"
              type="email"
              :placeholder="$t('editions.ticketing.email_placeholder')"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Étape 2 : Sélection des tarifs -->
        <div v-if="currentStep === 1" class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('editions.ticketing.select_tiers_description') }}
          </p>

          <div v-if="loadingTiers" class="flex justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-gray-400" />
          </div>

          <div v-else-if="availableTiers.length === 0" class="text-center py-8">
            <p class="text-gray-500">{{ $t('editions.ticketing.no_tiers_available') }}</p>
          </div>

          <div v-else class="space-y-3">
            <!-- Switch pour afficher tous les tarifs -->
            <USwitch
              v-model="showAllTiers"
              label="Afficher tous les tarifs"
              description="Y compris les tarifs hors période de validité"
            />
            <div
              v-for="tier in availableTiers"
              :key="tier.id"
              class="p-4 border rounded-lg dark:border-gray-700"
            >
              <div class="flex items-center justify-between gap-4">
                <div class="flex-1">
                  <h4 class="font-medium text-gray-900 dark:text-white">{{ tier.name }}</h4>
                  <p v-if="tier.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {{ tier.description }}
                  </p>
                  <!-- Prix fixe ou fourchette de prix libre -->
                  <p
                    v-if="!tier.minAmount && !tier.maxAmount"
                    class="text-sm font-semibold text-primary-600 dark:text-primary-400 mt-2"
                  >
                    {{ formatPrice(tier.price) }}
                  </p>
                  <p
                    v-else
                    class="text-sm font-semibold text-primary-600 dark:text-primary-400 mt-2"
                  >
                    Prix libre
                    <span v-if="tier.minAmount" class="text-xs text-gray-500">
                      (min: {{ formatPrice(tier.minAmount) }})
                    </span>
                    <span v-if="tier.maxAmount" class="text-xs text-gray-500">
                      (max: {{ formatPrice(tier.maxAmount) }})
                    </span>
                  </p>
                </div>
                <div class="w-24">
                  <UFormField :label="$t('common.quantity')">
                    <UInput
                      v-model.number="tierQuantities[tier.id]"
                      type="number"
                      min="0"
                      :placeholder="'0'"
                    />
                  </UFormField>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Étape 3 : Récapitulatif et personnalisation -->
        <div v-if="currentStep === 2" class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('editions.ticketing.customize_participants_description') }}
          </p>

          <div class="space-y-4">
            <div
              v-for="(item, index) in selectedItems"
              :key="`${item.tierId}-${index}`"
              class="p-4 border rounded-lg dark:border-gray-700"
            >
              <div class="space-y-3">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-medium text-gray-900 dark:text-white">{{ item.tierName }}</h4>
                    <p
                      v-if="!item.minAmount && !item.maxAmount"
                      class="text-sm text-gray-600 dark:text-gray-400"
                    >
                      {{ formatPrice(item.price) }}
                    </p>
                    <p v-else class="text-sm text-gray-600 dark:text-gray-400">Prix libre</p>
                  </div>
                  <UBadge color="primary" variant="soft"
                    >{{ $t('common.item') }} {{ index + 1 }}</UBadge
                  >
                </div>

                <!-- Champ de montant personnalisé pour les tarifs à prix libre -->
                <div v-if="item.minAmount || item.maxAmount">
                  <UFormField label="Montant (€)" :error="getItemAmountError(item)">
                    <UInput
                      :model-value="item.price / 100"
                      type="number"
                      :min="item.minAmount ? item.minAmount / 100 : 0"
                      :max="item.maxAmount ? item.maxAmount / 100 : undefined"
                      step="0.01"
                      placeholder="Montant en euros"
                      @update:model-value="
                        (value: number) => (item.price = Math.round(value * 100))
                      "
                    />
                  </UFormField>
                  <p v-if="item.minAmount || item.maxAmount" class="text-xs text-gray-500 mt-1">
                    <span v-if="item.minAmount"> Min: {{ formatPrice(item.minAmount) }} </span>
                    <span v-if="item.minAmount && item.maxAmount"> - </span>
                    <span v-if="item.maxAmount"> Max: {{ formatPrice(item.maxAmount) }} </span>
                  </p>
                </div>

                <UCheckbox
                  v-model="item.isDifferentParticipant"
                  :label="$t('editions.ticketing.different_participant')"
                />

                <div
                  v-if="item.isDifferentParticipant"
                  class="space-y-3 pl-6 border-l-2 border-primary-200"
                >
                  <UFormField :label="$t('editions.ticketing.participant_first_name')" required>
                    <UInput
                      v-model="item.firstName"
                      :placeholder="$t('editions.ticketing.first_name_placeholder')"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField :label="$t('editions.ticketing.participant_last_name')" required>
                    <UInput
                      v-model="item.lastName"
                      :placeholder="$t('editions.ticketing.last_name_placeholder')"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField :label="$t('editions.ticketing.participant_email')" required>
                    <UInput
                      v-model="item.email"
                      type="email"
                      :placeholder="$t('editions.ticketing.email_placeholder')"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <div class="flex items-center justify-between">
              <span class="font-medium text-gray-900 dark:text-white">
                {{ $t('common.total') }}
              </span>
              <span class="text-lg font-bold text-primary-600 dark:text-primary-400">
                {{ formatPrice(totalAmount) }}
              </span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ selectedItems.length }} {{ $t('common.items') }}
            </p>
          </div>
        </div>

        <!-- Étape 4 : Confirmation du paiement -->
        <div v-if="currentStep === 3" class="space-y-4">
          <div class="text-center py-6">
            <div
              class="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4"
            >
              <UIcon
                name="i-heroicons-credit-card"
                class="h-8 w-8 text-blue-600 dark:text-blue-400"
              />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Paiement de la commande
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Souhaitez-vous marquer cette commande comme payée ?
            </p>
          </div>

          <div class="space-y-3">
            <div
              class="p-4 rounded-lg border-2 cursor-pointer transition-all"
              :class="
                paymentConfirmed
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
              "
              @click="paymentConfirmed = true"
            >
              <div class="flex items-center gap-3">
                <UIcon
                  :name="paymentConfirmed ? 'i-heroicons-check-circle' : 'i-heroicons-circle'"
                  :class="
                    paymentConfirmed
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-400 dark:text-gray-600'
                  "
                  class="h-6 w-6"
                />
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">Paiement reçu</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Le participant a payé {{ formatPrice(totalAmount) }}
                  </p>
                </div>
              </div>
            </div>

            <div
              class="p-4 rounded-lg border-2 cursor-pointer transition-all"
              :class="
                !paymentConfirmed
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
              "
              @click="paymentConfirmed = false"
            >
              <div class="flex items-center gap-3">
                <UIcon
                  :name="!paymentConfirmed ? 'i-heroicons-check-circle' : 'i-heroicons-circle'"
                  :class="
                    !paymentConfirmed
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-gray-400 dark:text-gray-600'
                  "
                  class="h-6 w-6"
                />
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    Paiement non reçu (inscription en attente)
                  </p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    La commande sera enregistrée mais marquée comme non payée
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Message d'erreur -->
        <UAlert v-if="error" color="error" variant="soft" :title="error" />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between">
        <UButton v-if="currentStep > 0" color="neutral" variant="ghost" @click="previousStep">
          {{ $t('common.previous') }}
        </UButton>
        <div v-else />

        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" @click="closeModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton v-if="currentStep < 3" color="primary" :disabled="!canGoNext" @click="nextStep">
            {{ $t('common.next') }}
          </UButton>
          <UButton
            v-else
            color="primary"
            :disabled="loading"
            :loading="loading"
            @click="submitOrder"
          >
            {{ $t('editions.ticketing.create_order') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface TicketingTier {
  id: number
  name: string
  price: number
  description: string | null
  minAmount: number | null
  maxAmount: number | null
}

interface SelectedItem {
  tierId: number
  tierName: string
  price: number
  minAmount: number | null
  maxAmount: number | null
  isDifferentParticipant: boolean
  firstName: string
  lastName: string
  email: string
}

interface Props {
  open: boolean
  editionId: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'order-created', qrCode: string): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const currentStep = ref(0)
const loading = ref(false)
const loadingTiers = ref(false)
const error = ref('')
const paymentConfirmed = ref(true)

const stepperItems = computed(() => [
  { title: t('editions.ticketing.buyer_info') },
  { title: t('editions.ticketing.select_tiers') },
  { title: t('editions.ticketing.summary') },
  { title: 'Paiement' },
])

const currentStepTitle = computed(() => {
  if (currentStep.value === 0) return t('editions.ticketing.add_participant_title')
  if (currentStep.value === 1) return t('editions.ticketing.select_tiers')
  if (currentStep.value === 2) return t('editions.ticketing.summary_and_customize')
  return 'Confirmation du paiement'
})

const form = ref({
  payerFirstName: '',
  payerLastName: '',
  payerEmail: '',
})

const errors = ref({
  payerFirstName: '',
  payerLastName: '',
  payerEmail: '',
})

const availableTiers = ref<TicketingTier[]>([])
const tierQuantities = ref<Record<number, number>>({})
const selectedItems = ref<SelectedItem[]>([])
const showAllTiers = ref(false)

const canGoNext = computed(() => {
  if (currentStep.value === 0) {
    return (
      form.value.payerFirstName.trim().length > 0 &&
      form.value.payerLastName.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.payerEmail)
    )
  }
  if (currentStep.value === 1) {
    // Au moins un tarif sélectionné
    return Object.values(tierQuantities.value).some((qty) => qty > 0)
  }
  if (currentStep.value === 2) {
    // Vérifier que tous les montants personnalisés sont valides
    return selectedItems.value.every((item) => {
      // Vérifier les montants pour les tarifs à prix libre
      if (item.minAmount || item.maxAmount) {
        if (getItemAmountError(item)) return false
      }
      // Vérifier les infos participant si différent de l'acheteur
      if (item.isDifferentParticipant) {
        return (
          item.firstName.trim().length > 0 &&
          item.lastName.trim().length > 0 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)
        )
      }
      return true
    })
  }
  return true
})

// La validation est faite dans canGoNext pour l'étape 2
const canSubmit = computed(() => true)

const totalAmount = computed(() => {
  return selectedItems.value.reduce((sum, item) => sum + item.price, 0)
})

const formatPrice = (priceInCents: number) => {
  return (priceInCents / 100).toFixed(2) + ' €'
}

const getItemAmountError = (item: SelectedItem) => {
  if (!item.price || item.price < 0) {
    return 'Veuillez saisir un montant valide'
  }
  const minAmount = item.minAmount ?? 0
  if (item.price < minAmount) {
    return `Le montant minimum est ${formatPrice(minAmount)}`
  }
  if (item.maxAmount && item.price > item.maxAmount) {
    return `Le montant maximum est ${formatPrice(item.maxAmount)}`
  }
  return ''
}

const fetchTiers = async () => {
  loadingTiers.value = true
  try {
    const response = await $fetch<{ tiers: TicketingTier[] }>(
      `/api/editions/${props.editionId}/ticketing/tiers/available`,
      {
        query: {
          showAll: showAllTiers.value ? 'true' : 'false',
        },
      }
    )
    availableTiers.value = response.tiers
    // Initialiser les quantités à 0
    tierQuantities.value = response.tiers.reduce(
      (acc, tier) => {
        acc[tier.id] = 0
        return acc
      },
      {} as Record<number, number>
    )
  } catch (err: any) {
    console.error('Error fetching tiers:', err)
    error.value = t('editions.ticketing.error_loading_tiers')
  } finally {
    loadingTiers.value = false
  }
}

const nextStep = () => {
  if (!canGoNext.value) return

  if (currentStep.value === 1) {
    // Générer la liste des items sélectionnés pour l'étape 3
    selectedItems.value = []
    for (const tier of availableTiers.value) {
      const quantity = tierQuantities.value[tier.id] || 0
      // Déterminer le prix initial : minimum pour les prix libres, sinon prix du tarif
      let itemPrice = tier.price
      if (tier.minAmount || tier.maxAmount) {
        // Pour les prix libres, initialiser au minimum (ou 0 si pas de minimum)
        itemPrice = tier.minAmount ?? 0
      }

      for (let i = 0; i < quantity; i++) {
        selectedItems.value.push({
          tierId: tier.id,
          tierName: tier.name,
          price: itemPrice,
          minAmount: tier.minAmount,
          maxAmount: tier.maxAmount,
          isDifferentParticipant: false,
          firstName: form.value.payerFirstName,
          lastName: form.value.payerLastName,
          email: form.value.payerEmail,
        })
      }
    }
  }

  currentStep.value++
}

const previousStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const submitOrder = async () => {
  if (!canSubmit.value) return

  loading.value = true
  error.value = ''

  try {
    // Grouper les items par tarif et montant personnalisé
    const itemsByTierAndPrice: Record<
      string,
      { tierId: number; quantity: number; customAmount?: number; customParticipants: any[] }
    > = {}

    for (const item of selectedItems.value) {
      // Créer une clé unique basée sur le tarif et le prix
      const key = `${item.tierId}-${item.price}`

      if (!itemsByTierAndPrice[key]) {
        itemsByTierAndPrice[key] = {
          tierId: item.tierId,
          quantity: 0,
          customAmount: item.price, // Le prix est déjà en centimes
          customParticipants: [],
        }
      }
      itemsByTierAndPrice[key].quantity++
      if (item.isDifferentParticipant) {
        itemsByTierAndPrice[key].customParticipants.push({
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
        })
      }
    }

    const response = await $fetch<{ success: boolean; qrCode: string }>(
      `/api/editions/${props.editionId}/ticketing/add-participant-manually`,
      {
        method: 'POST',
        body: {
          payerFirstName: form.value.payerFirstName,
          payerLastName: form.value.payerLastName,
          payerEmail: form.value.payerEmail,
          items: Object.values(itemsByTierAndPrice),
          isPaid: paymentConfirmed.value,
        },
      }
    )

    // Émettre l'événement avec le QR code pour redirection
    emit('order-created', response.qrCode)
    closeModal()
  } catch (err: any) {
    console.error('Error creating order:', err)
    error.value = err.data?.message || t('editions.ticketing.add_error')
  } finally {
    loading.value = false
  }
}

const closeModal = () => {
  isOpen.value = false
  currentStep.value = 0
  paymentConfirmed.value = true
  form.value = {
    payerFirstName: '',
    payerLastName: '',
    payerEmail: '',
  }
  errors.value = {
    payerFirstName: '',
    payerLastName: '',
    payerEmail: '',
  }
  tierQuantities.value = {}
  selectedItems.value = []
  error.value = ''
}

// Charger les tarifs quand le modal s'ouvre
watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      fetchTiers()
    }
  }
)

// Recharger les tarifs quand on change le filtre de validité
watch(showAllTiers, () => {
  fetchTiers()
})
</script>
