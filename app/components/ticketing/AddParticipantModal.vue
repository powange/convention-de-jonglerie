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
                  <p class="text-sm font-semibold text-primary-600 dark:text-primary-400 mt-2">
                    {{ formatPrice(tier.price) }}
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
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ formatPrice(item.price) }}
                    </p>
                  </div>
                  <UBadge color="primary" variant="soft"
                    >{{ $t('common.item') }} {{ index + 1 }}</UBadge
                  >
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
          <UButton v-if="currentStep < 2" color="primary" :disabled="!canGoNext" @click="nextStep">
            {{ $t('common.next') }}
          </UButton>
          <UButton
            v-else
            color="primary"
            :disabled="!canSubmit || loading"
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

interface Tier {
  id: number
  name: string
  price: number
  description: string | null
}

interface SelectedItem {
  tierId: number
  tierName: string
  price: number
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

const stepperItems = computed(() => [
  { title: t('editions.ticketing.buyer_info') },
  { title: t('editions.ticketing.select_tiers') },
  { title: t('editions.ticketing.summary') },
])

const currentStepTitle = computed(() => {
  if (currentStep.value === 0) return t('editions.ticketing.add_participant_title')
  if (currentStep.value === 1) return t('editions.ticketing.select_tiers')
  return t('editions.ticketing.summary_and_customize')
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

const availableTiers = ref<Tier[]>([])
const tierQuantities = ref<Record<number, number>>({})
const selectedItems = ref<SelectedItem[]>([])

const canGoNext = computed(() => {
  if (currentStep.value === 0) {
    return (
      form.value.payerFirstName.trim().length > 0 &&
      form.value.payerLastName.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.payerEmail)
    )
  }
  if (currentStep.value === 1) {
    return Object.values(tierQuantities.value).some((qty) => qty > 0)
  }
  return true
})

const canSubmit = computed(() => {
  return selectedItems.value.every((item) => {
    if (!item.isDifferentParticipant) return true
    return (
      item.firstName.trim().length > 0 &&
      item.lastName.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)
    )
  })
})

const totalAmount = computed(() => {
  return selectedItems.value.reduce((sum, item) => sum + item.price, 0)
})

const formatPrice = (priceInCents: number) => {
  return (priceInCents / 100).toFixed(2) + ' €'
}

const fetchTiers = async () => {
  loadingTiers.value = true
  try {
    const response = await $fetch<{ tiers: Tier[] }>(
      `/api/editions/${props.editionId}/ticketing/tiers/available`
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
      for (let i = 0; i < quantity; i++) {
        selectedItems.value.push({
          tierId: tier.id,
          tierName: tier.name,
          price: tier.price,
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
    // Grouper les items par tarif avec participants personnalisés
    const itemsByTier: Record<
      number,
      { tierId: number; quantity: number; customParticipants: any[] }
    > = {}

    for (const item of selectedItems.value) {
      if (!itemsByTier[item.tierId]) {
        itemsByTier[item.tierId] = {
          tierId: item.tierId,
          quantity: 0,
          customParticipants: [],
        }
      }
      itemsByTier[item.tierId].quantity++
      if (item.isDifferentParticipant) {
        itemsByTier[item.tierId].customParticipants.push({
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
          items: Object.values(itemsByTier),
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
</script>
