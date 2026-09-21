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
      <!--
        Une adresse VÉRIFIÉE ne se corrige plus ici.

        Ce champ existe pour rattraper la faute de frappe d'une personne ajoutée à la main, dont
        le compte vient d'être créé et n'a jamais servi. Dès que l'adresse est vérifiée, le compte
        appartient à quelqu'un : le réécrire depuis le guichet permettait d'en demander la
        réinitialisation du mot de passe, donc de le prendre.

        Le champ est montré en lecture seule plutôt que masqué : savoir quelle adresse est
        enregistrée sert au comptoir, et une case qui disparaît se lit comme un défaut.
      -->
      <div v-if="isEmailVerified">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {{ $t('edition.ticketing.email') }}
        </p>
        <UInput
          :model-value="email"
          type="email"
          icon="i-heroicons-envelope"
          size="sm"
          readonly
          :ui="{ base: 'cursor-default' }"
        />
      </div>
      <EmailValidationInput
        v-else
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
        <UiPhoneInput
          :model-value="phone"
          placeholder="06 12 34 56 78"
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
  /**
   * L'adresse du compte est-elle vérifiée ?
   *
   * Absente, on suppose qu'elle NE l'est PAS — le champ reste donc modifiable. C'est le serveur
   * qui tranche pour de bon : une interface trop permissive fait échouer une écriture, une
   * interface trop stricte empêche la correction qui justifie ce champ.
   */
  isEmailVerified?: boolean
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
