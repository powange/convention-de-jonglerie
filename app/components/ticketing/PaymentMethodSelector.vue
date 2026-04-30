<template>
  <div class="space-y-4">
    <p v-if="showTitle" class="text-sm text-gray-600 dark:text-gray-400 text-center">
      {{ $t('ticketing.payment.selectMethod') }}
    </p>

    <div class="grid grid-cols-2 gap-3">
      <!-- Paiement liquide -->
      <div
        v-if="props.enabledMethods.includes('cash')"
        class="p-4 rounded-lg border-2 cursor-pointer transition-all"
        :class="
          modelValue === 'cash'
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
        "
        @click="selectMethod('cash')"
      >
        <div class="flex items-center gap-3">
          <UIcon
            name="i-lucide-coins"
            :class="
              modelValue === 'cash'
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-400 dark:text-gray-600'
            "
            class="h-6 w-6"
          />
          <div class="flex-1">
            <p class="font-medium text-gray-900 dark:text-white">
              {{ $t('ticketing.payment.methods.cash') }}
            </p>
            <p v-if="amount !== undefined" class="text-xs text-gray-600 dark:text-gray-400">
              {{ formatPrice(amount) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Paiement carte bancaire -->
      <div
        v-if="props.enabledMethods.includes('card')"
        class="p-4 rounded-lg border-2 cursor-pointer transition-all"
        :class="
          modelValue === 'card'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
        "
        @click="selectMethod('card')"
      >
        <div class="flex items-center gap-3">
          <UIcon
            name="i-heroicons-credit-card"
            :class="
              modelValue === 'card'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-600'
            "
            class="h-6 w-6"
          />
          <div class="flex-1">
            <p class="font-medium text-gray-900 dark:text-white">
              {{ $t('ticketing.payment.methods.card') }}
            </p>
            <p v-if="amount !== undefined" class="text-xs text-gray-600 dark:text-gray-400">
              {{ formatPrice(amount) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Paiement chèque -->
      <div
        v-if="props.enabledMethods.includes('check')"
        class="p-4 rounded-lg border-2 cursor-pointer transition-all"
        :class="
          modelValue === 'check'
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
        "
        @click="selectMethod('check')"
      >
        <div class="flex items-center gap-3">
          <UIcon
            name="i-picon-paycheck"
            :class="
              modelValue === 'check'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-400 dark:text-gray-600'
            "
            class="h-6 w-6"
          />
          <div class="flex-1">
            <p class="font-medium text-gray-900 dark:text-white">
              {{ $t('ticketing.payment.methods.check') }}
            </p>
            <p v-if="amount !== undefined" class="text-xs text-gray-600 dark:text-gray-400">
              {{ formatPrice(amount) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Paiement non reçu -->
      <div
        class="p-4 rounded-lg border-2 cursor-pointer transition-all"
        :class="
          modelValue === null
            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
        "
        @click="selectMethod(null)"
      >
        <div class="flex items-center gap-3">
          <UIcon
            name="i-heroicons-question-mark-circle"
            :class="
              modelValue === null
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-gray-400 dark:text-gray-600'
            "
            class="h-6 w-6"
          />
          <div class="flex-1">
            <p class="font-medium text-gray-900 dark:text-white">
              {{ $t('ticketing.payment.methods.pending') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ $t('ticketing.payment.methods.pendingSubtitle') }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Bouton SumUp pour paiement par carte -->
    <div v-if="modelValue === 'card' && props.sumupEnabled && amount && amount > 0" class="mt-4">
      <UButton
        icon="i-heroicons-device-phone-mobile"
        color="primary"
        variant="soft"
        class="w-full justify-center"
        :disabled="!sumupAppLink"
        @click="openSumup"
      >
        {{ $t('ticketing.payment.open_sumup') }}
      </UButton>
      <p class="text-xs text-gray-500 mt-2 text-center">
        {{ $t('ticketing.payment.sumup_hint') }}
      </p>
      <UAlert
        v-if="!sumupAppLink"
        class="mt-2"
        icon="i-heroicons-exclamation-triangle"
        color="warning"
        variant="soft"
        :description="$t('ticketing.payment.sumup_not_configured')"
      />
    </div>

    <!-- Champ pour le numéro de chèque -->
    <div v-if="modelValue === 'check'" class="mt-4">
      <UFormField :label="$t('ticketing.payment.checkNumber')" required>
        <UInput
          :model-value="checkNumber"
          placeholder="Ex: 1234567"
          class="w-full"
          @update:model-value="$emit('update:checkNumber', $event)"
        />
      </UFormField>
    </div>

    <!-- Calculateur de monnaie pour paiement en espèces -->
    <div v-if="modelValue === 'cash' && amount !== undefined && amount > 0" class="mt-4">
      <UFormField :label="$t('ticketing.payment.cash_received')">
        <UInput
          :model-value="cashReceivedInput"
          inputmode="decimal"
          :placeholder="formatPrice(amount)"
          class="w-full"
          icon="i-lucide-coins"
          @update:model-value="handleCashReceivedInput"
        />
      </UFormField>
      <div v-if="cashReceivedInput && cashReceivedCents > 0" class="mt-2">
        <div
          v-if="changeToGive >= 0"
          class="flex items-center justify-between p-3 rounded-lg"
          :class="
            changeToGive > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/50'
          "
        >
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('ticketing.payment.change_to_give') }}
          </span>
          <span class="text-lg font-bold text-green-600 dark:text-green-400">
            {{ formatPrice(changeToGive) }}
          </span>
        </div>
        <div
          v-else
          class="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20"
        >
          <span class="text-sm font-medium text-red-700 dark:text-red-300">
            {{ $t('ticketing.payment.insufficient_amount') }}
          </span>
          <span class="text-lg font-bold text-red-600 dark:text-red-400">
            {{ formatPrice(Math.abs(changeToGive)) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

export type PaymentMethod = 'cash' | 'card' | 'check' | null

const props = withDefaults(
  defineProps<{
    modelValue: PaymentMethod
    checkNumber?: string
    amount?: number
    showTitle?: boolean
    enabledMethods?: ('cash' | 'card' | 'check')[]
    sumupEnabled?: boolean
    sumupTitle?: string
    /** Clé d'affiliation SumUp (déchiffrée côté serveur, requise pour pré-remplir le montant) */
    sumupAffiliateKey?: string
    /** App ID déclaré sur le dashboard SumUp (requise sur Android) */
    sumupAppId?: string
  }>(),
  {
    enabledMethods: () => ['cash', 'card', 'check'],
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: PaymentMethod]
  'update:checkNumber': [value: string]
}>()

// Calculateur de monnaie pour paiement en espèces
const cashReceivedInput = ref('')
const handleCashReceivedInput = (value: string) => {
  cashReceivedInput.value = value
}
const cashReceivedCents = computed(() => {
  const normalized = cashReceivedInput.value.replace(',', '.')
  const val = parseFloat(normalized)
  return isNaN(val) ? 0 : Math.round(val * 100)
})
const changeToGive = computed(() => cashReceivedCents.value - (props.amount || 0))

function selectMethod(method: PaymentMethod) {
  emit('update:modelValue', method)
  // Réinitialiser les champs annexes
  if (method !== 'check') {
    emit('update:checkNumber', '')
  }
  if (method !== 'cash') {
    cashReceivedInput.value = ''
  }
}

// Lien SumUp App Link
// Doc : https://github.com/sumup/sumup-ios-url-scheme et sumup-android-api
// Paramètres requis : affiliate-key, app-id (Android), total OU amount, currency
// On envoie `total` ET `amount` pour compatibilité (total sur app ≥ 1.88, amount sur anciennes)
const sumupAppLink = computed(() => {
  if (!props.amount || props.amount <= 0) return ''
  if (!props.sumupAffiliateKey || !props.sumupAppId) return ''

  const amountInEuros = (props.amount / 100).toFixed(2)
  // Limiter le titre à 100 caractères (limite sûre pour SumUp et l'URL deep link)
  const safeTitle = (props.sumupTitle || 'Billetterie').substring(0, 100)
  const params = new URLSearchParams({
    'affiliate-key': props.sumupAffiliateKey,
    'app-id': props.sumupAppId,
    total: amountInEuros,
    amount: amountInEuros,
    currency: 'EUR',
    title: safeTitle,
  })
  return `sumupmerchant://pay/1.0?${params.toString()}`
})

function openSumup() {
  if (sumupAppLink.value) {
    window.location.href = sumupAppLink.value
  }
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2) + ' €'
}
</script>
