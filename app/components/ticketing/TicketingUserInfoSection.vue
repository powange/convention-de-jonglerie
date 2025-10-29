<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
      <UIcon name="i-heroicons-user" class="text-primary-600 dark:text-primary-400" />
      <h4 class="font-semibold text-gray-900 dark:text-white">
        {{ title }}
      </h4>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {{ $t('ticketing.participant.first_name') }}
        </p>
        <UInput
          :model-value="firstName"
          type="text"
          :placeholder="$t('ticketing.participant.first_name')"
          icon="i-heroicons-user"
          size="sm"
          @update:model-value="$emit('update:firstName', $event)"
        />
      </div>
      <div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {{ $t('ticketing.participant.last_name') }}
        </p>
        <UInput
          :model-value="lastName"
          type="text"
          :placeholder="$t('ticketing.participant.last_name')"
          icon="i-heroicons-user"
          size="sm"
          @update:model-value="$emit('update:lastName', $event)"
        />
      </div>
      <EmailValidationInput
        ref="emailInput"
        :model-value="email"
        :original-email="originalEmail"
        :user-id="userId"
        @update:model-value="$emit('update:email', $event)"
      />
      <div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {{ $t('ticketing.participant.phone') }}
        </p>
        <UInput
          :model-value="phone"
          type="tel"
          placeholder="06 12 34 56 78"
          icon="i-heroicons-phone"
          size="sm"
          @update:model-value="$emit('update:phone', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import EmailValidationInput from './EmailValidationInput.vue'

defineProps<{
  title: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  originalEmail: string
  userId: number
}>()

defineEmits<{
  'update:firstName': [value: string | null]
  'update:lastName': [value: string | null]
  'update:email': [value: string | null]
  'update:phone': [value: string | null]
}>()

// Référence au composant de validation d'email pour accès externe
const emailInput = ref<InstanceType<typeof EmailValidationInput> | null>(null)

// Exposer la référence pour que les parents puissent y accéder
defineExpose({
  emailInput,
})
</script>
