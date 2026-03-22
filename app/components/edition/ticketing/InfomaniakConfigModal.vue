<template>
  <UModal v-model:open="isOpen" size="2xl">
    <template #header>
      <div class="flex items-center gap-3">
        <img src="~/assets/img/infomaniak/logo.svg" alt="Infomaniak" class="w-10 h-10 rounded-lg" />
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ isEditing ? 'Modifier' : 'Configurer' }} Infomaniak
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ isEditing ? 'Mettre à jour la configuration' : 'Connectez votre billetterie' }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Étape 1 : Clé API -->
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <div
              class="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold text-sm"
            >
              1
            </div>
            <h3 class="font-semibold text-base">
              {{ $t('gestion.ticketing.infomaniak_step_api') }}
            </h3>
          </div>

          <div
            class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
          >
            <div class="flex items-start gap-2">
              <UIcon
                name="i-heroicons-information-circle"
                class="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0"
              />
              <div class="text-sm">
                <p class="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  {{ $t('gestion.ticketing.infomaniak_api_guide_title') }}
                </p>
                <p class="text-blue-700 dark:text-blue-300">
                  {{ $t('gestion.ticketing.infomaniak_api_guide_text') }}
                  <a
                    href="https://www.infomaniak.com/fr/support/faq/2661/ticketing-use-the-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline hover:text-blue-600 font-medium"
                  >
                    {{ $t('gestion.ticketing.infomaniak_api_guide_link') }}
                  </a>
                </p>
              </div>
            </div>
          </div>

          <UFormField
            :label="$t('gestion.ticketing.infomaniak_api_key')"
            :hint="$t('gestion.ticketing.infomaniak_api_key_hint')"
            required
          >
            <UInput
              v-model="localConfig.apiKey"
              :placeholder="isEditing ? '••••••••••••••••' : ''"
              icon="i-heroicons-key"
              type="password"
              size="lg"
              class="font-mono w-full"
            />
          </UFormField>

          <UFormField
            :label="$t('gestion.ticketing.infomaniak_currency')"
            :hint="$t('gestion.ticketing.infomaniak_currency_hint')"
            required
          >
            <USelect v-model="localConfig.currency" :items="currencyOptions" size="lg" />
          </UFormField>
        </div>

        <!-- Étape 2 : Sélection de l'événement (après test réussi) -->
        <div v-if="availableEvents.length > 0" class="space-y-4">
          <div class="flex items-center gap-2">
            <div
              class="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold text-sm"
            >
              2
            </div>
            <h3 class="font-semibold text-base">
              {{ $t('gestion.ticketing.infomaniak_step_event') }}
            </h3>
          </div>

          <div
            class="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-4"
          >
            <div class="flex items-start gap-2">
              <UIcon
                name="i-heroicons-check-circle"
                class="text-success-600 dark:text-success-400 mt-0.5 shrink-0"
              />
              <p class="text-sm text-success-700 dark:text-success-300">
                {{
                  $t('gestion.ticketing.infomaniak_connection_ok', {
                    count: availableEvents.length,
                  })
                }}
              </p>
            </div>
          </div>

          <UFormField
            :label="$t('gestion.ticketing.infomaniak_event_select')"
            :hint="$t('gestion.ticketing.infomaniak_event_select_hint')"
          >
            <USelect
              v-model="selectedEventId"
              :items="eventOptions"
              :placeholder="$t('gestion.ticketing.infomaniak_event_placeholder')"
              size="lg"
            />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-col sm:flex-row gap-3 justify-between w-full">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-x-mark"
          size="lg"
          @click="handleCancel"
        >
          {{ $t('common.cancel') }}
        </UButton>
        <!-- Avant connexion : bouton Se connecter -->
        <UButton
          v-if="!connected"
          color="primary"
          icon="i-heroicons-arrow-right-circle"
          :disabled="!canTest"
          :loading="testing"
          size="lg"
          @click="handleTest"
        >
          {{ $t('gestion.ticketing.infomaniak_connect') }}
        </UButton>
        <!-- Après connexion : bouton Enregistrer -->
        <UButton
          v-else
          color="primary"
          icon="i-heroicons-check-circle"
          :disabled="!canSave"
          :loading="saving"
          size="lg"
          @click="handleSave"
        >
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export interface InfomaniakConfig {
  apiKey: string
  currency: string
  eventId?: number
  eventName?: string
}

interface InfomaniakEventSummary {
  event_id: number
  name: string
  date: string
  status: string
  city?: string
}

interface Props {
  open: boolean
  config?: InfomaniakConfig
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'save', config: InfomaniakConfig): void
  (e: 'test', config: { apiKey: string; currency: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const localConfig = ref<InfomaniakConfig>({
  apiKey: '',
  currency: '2',
})

const currencyOptions = [
  { label: 'EUR (€)', value: '2' },
  { label: 'CHF (Fr.)', value: '1' },
]

const availableEvents = ref<InfomaniakEventSummary[]>([])
const selectedEventId = ref<number | undefined>()

// Réinitialiser la connexion si la clé API ou la devise change
watch(
  () => [localConfig.value.apiKey, localConfig.value.currency],
  () => {
    if (availableEvents.value.length > 0) {
      availableEvents.value = []
      selectedEventId.value = undefined
    }
  }
)

const eventOptions = computed(() =>
  availableEvents.value.map((e) => ({
    label: `${e.name}${e.city ? ` — ${e.city}` : ''}`,
    value: e.event_id,
  }))
)

const isEditing = computed(() => !!props.config)
const saving = ref(false)
const testing = ref(false)
const connected = computed(() => availableEvents.value.length > 0)

const canTest = computed(() => localConfig.value.apiKey.trim() !== '')
const canSave = computed(() => localConfig.value.apiKey.trim() !== '' && !!selectedEventId.value)

watch(
  () => props.config,
  (newConfig) => {
    if (newConfig) {
      localConfig.value = { ...newConfig }
      if (newConfig.eventId) {
        selectedEventId.value = newConfig.eventId
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (props.config) {
        localConfig.value = { ...props.config }
        selectedEventId.value = props.config.eventId
      } else {
        localConfig.value = { apiKey: '', currency: '2' }
        selectedEventId.value = undefined
        availableEvents.value = []
      }
      saving.value = false
      testing.value = false
    }
  }
)

const handleCancel = () => {
  isOpen.value = false
}

const handleTest = () => {
  if (!canTest.value) return
  testing.value = true
  emit('test', {
    apiKey: localConfig.value.apiKey,
    currency: localConfig.value.currency,
  })
}

const handleSave = () => {
  if (!canSave.value) return
  saving.value = true
  const selectedEvent = availableEvents.value.find((e) => e.event_id === selectedEventId.value)
  emit('save', {
    ...localConfig.value,
    eventId: selectedEventId.value,
    eventName: selectedEvent?.name,
  })
}

defineExpose({
  setSaving: (value: boolean) => {
    saving.value = value
  },
  setTesting: (value: boolean) => {
    testing.value = value
  },
  setEvents: (events: InfomaniakEventSummary[]) => {
    availableEvents.value = events
  },
})
</script>
