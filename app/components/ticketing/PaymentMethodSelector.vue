<template>
  <div class="space-y-4">
    <p v-if="showTitle" class="text-sm text-gray-600 dark:text-gray-400 text-center">
      {{ $t('ticketing.payment.selectMethod') }}
    </p>

    <div class="grid grid-cols-2 gap-3">
      <!-- Paiement liquide -->
      <div
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
            :name="modelValue === 'cash' ? 'i-heroicons-check-circle' : 'i-lucide-circle'"
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
            :name="modelValue === 'card' ? 'i-heroicons-check-circle' : 'i-lucide-circle'"
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
            :name="modelValue === 'check' ? 'i-heroicons-check-circle' : 'i-lucide-circle'"
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
            :name="modelValue === null ? 'i-heroicons-check-circle' : 'i-lucide-circle'"
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
  </div>
</template>

<script setup lang="ts">
export type PaymentMethod = 'cash' | 'card' | 'check' | null

defineProps<{
  modelValue: PaymentMethod
  checkNumber?: string
  amount?: number
  showTitle?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PaymentMethod]
  'update:checkNumber': [value: string]
}>()

function selectMethod(method: PaymentMethod) {
  emit('update:modelValue', method)
  // Réinitialiser le numéro de chèque si on change de méthode (sauf pour chèque)
  if (method !== 'check') {
    emit('update:checkNumber', '')
  }
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2) + ' €'
}
</script>
