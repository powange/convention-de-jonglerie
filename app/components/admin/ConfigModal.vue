<template>
  <UModal v-model:open="isOpen" :title="$t('admin.config.title')" size="xl">
    <template #body>
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <div v-else-if="error" class="space-y-4">
        <UAlert
          icon="i-heroicons-x-circle"
          color="error"
          :title="$t('common.error')"
          :description="error"
        />
      </div>

      <div v-else-if="config" class="space-y-6">
        <!-- Configuration Serveur -->
        <div>
          <h3 class="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            {{ $t('admin.config.server') }}
          </h3>

          <!-- Environnement -->
          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ $t('admin.config.environment') }}
            </h4>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Node ENV:</span>
                <span class="ml-2 font-mono">{{ config.server.nodeEnv }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Nuxt:</span>
                <span class="ml-2 font-mono">{{ config.server.nuxtVersion }}</span>
              </div>
            </div>
          </div>

          <!-- IA -->
          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ $t('admin.config.ai') }}
            </h4>
            <div class="space-y-2 text-sm">
              <!-- Provider actif -->
              <div
                class="bg-gray-50 dark:bg-gray-800 p-2 rounded flex items-center justify-between"
              >
                <span class="text-gray-600 dark:text-gray-400">Provider actif:</span>
                <UBadge
                  :color="
                    config.server.ai.provider === 'lmstudio'
                      ? 'success'
                      : config.server.ai.provider === 'anthropic'
                        ? 'info'
                        : 'warning'
                  "
                  variant="soft"
                >
                  {{ config.server.ai.provider }}
                </UBadge>
              </div>

              <!-- Anthropic -->
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Anthropic API Key:</span>
                <span class="ml-2 font-mono">{{ config.server.ai.anthropicApiKey }}</span>
              </div>

              <!-- LM Studio -->
              <div
                class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800"
              >
                <div class="font-medium text-blue-700 dark:text-blue-300 mb-2">LM Studio</div>
                <div class="space-y-1">
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">URL:</span>
                    <span class="font-mono text-xs">{{ config.server.ai.lmstudioBaseUrl }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-gray-600 dark:text-gray-400">Vision (images):</span>
                    <UBadge color="purple" variant="soft" size="xs">
                      {{ config.server.ai.lmstudioModel }}
                    </UBadge>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-gray-600 dark:text-gray-400">Texte (JSON):</span>
                    <UBadge color="success" variant="soft" size="xs">
                      {{ config.server.ai.lmstudioTextModel }}
                    </UBadge>
                  </div>
                </div>
              </div>

              <!-- Ollama -->
              <div
                class="bg-orange-50 dark:bg-orange-900/20 p-3 rounded border border-orange-200 dark:border-orange-800"
              >
                <div class="font-medium text-orange-700 dark:text-orange-300 mb-2">Ollama</div>
                <div class="space-y-1">
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">URL:</span>
                    <span class="font-mono text-xs">{{ config.server.ai.ollamaBaseUrl }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Model:</span>
                    <span class="font-mono text-xs">{{ config.server.ai.ollamaModel }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Email -->
          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ $t('admin.config.email') }}
            </h4>
            <div class="space-y-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Enabled:</span>
                <span class="ml-2 font-mono">{{ config.server.email.enabled }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">SMTP User:</span>
                <span class="ml-2 font-mono">{{ config.server.email.smtpUser }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">SMTP Pass:</span>
                <span class="ml-2 font-mono">{{ config.server.email.smtpPass }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Configuration Publique -->
        <div>
          <h3 class="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            {{ $t('admin.config.public') }}
          </h3>
          <div class="space-y-2 text-sm">
            <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <span class="text-gray-600 dark:text-gray-400">Site URL:</span>
              <span class="ml-2 font-mono">{{ config.public.siteUrl }}</span>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <span class="text-gray-600 dark:text-gray-400">reCAPTCHA Site Key:</span>
              <span class="ml-2 font-mono">{{ config.public.recaptchaSiteKey }}</span>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <span class="text-gray-600 dark:text-gray-400">VAPID Public Key:</span>
              <span class="ml-2 font-mono">{{ config.public.vapidPublicKey }}</span>
            </div>
          </div>
        </div>

        <!-- Variables d'environnement brutes -->
        <div>
          <h3 class="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            {{ $t('admin.config.env_variables') }}
          </h3>
          <div class="space-y-2 text-sm">
            <div
              v-for="(value, key) in config.env"
              :key="key"
              class="bg-gray-50 dark:bg-gray-800 p-2 rounded"
            >
              <span class="text-gray-600 dark:text-gray-400">{{ key }}:</span>
              <span class="ml-2 font-mono">{{ value }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton variant="ghost" @click="isOpen = false">
          {{ $t('common.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Props {
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const loading = ref(false)
const error = ref('')
const config = ref<any>(null)

// Charger la config au montage
watch(
  () => props.open,
  async (newValue) => {
    if (newValue && !config.value) {
      await loadConfig()
    }
  },
  { immediate: true }
)

const loadConfig = async () => {
  loading.value = true
  error.value = ''

  try {
    config.value = await $fetch('/api/admin/config')
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || t('admin.config.load_error')
  } finally {
    loading.value = false
  }
}
</script>
