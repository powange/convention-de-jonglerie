<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" :aria-label="$t('navigation.breadcrumb')">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
              {{ $t('admin.config.title') }}
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-cog-6-tooth" class="text-gray-600" />
        {{ $t('admin.config.title') }}
      </h1>
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <!-- Erreur -->
    <UAlert
      v-else-if="error"
      icon="i-heroicons-x-circle"
      color="error"
      :title="$t('common.error')"
      :description="error.message"
    />

    <!-- Contenu -->
    <div v-else-if="config" class="space-y-6">
      <!-- Configuration Serveur -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-server" class="text-gray-500" />
            {{ $t('admin.config.server') }}
          </h2>
        </template>

        <div class="space-y-6">
          <!-- Environnement -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ $t('admin.config.environment') }}
            </h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Node ENV:</span>
                <span class="ml-2 font-mono">{{ config.server.nodeEnv }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Nuxt:</span>
                <span class="ml-2 font-mono">{{ config.server.nuxtVersion }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Prisma:</span>
                <span class="ml-2 font-mono">{{ config.server.prismaVersion }}</span>
              </div>
            </div>
          </div>

          <!-- IA -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ $t('admin.config.ai') }}
            </h3>
            <div class="space-y-2 text-sm">
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
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ $t('admin.config.email') }}
            </h3>
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
          <!-- OAuth -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">OAuth</h3>
            <div class="space-y-2 text-sm">
              <div
                class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800"
              >
                <div class="font-medium text-blue-700 dark:text-blue-300 mb-2">Google</div>
                <div class="space-y-1">
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Client ID:</span>
                    <span class="font-mono text-xs">{{ config.server.oauth.googleClientId }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Client Secret:</span>
                    <span class="font-mono text-xs">{{
                      config.server.oauth.googleClientSecret
                    }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Redirect URL:</span>
                    <span class="font-mono text-xs">{{
                      config.server.oauth.googleRedirectUrl
                    }}</span>
                  </div>
                </div>
              </div>
              <div
                class="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded border border-indigo-200 dark:border-indigo-800"
              >
                <div class="font-medium text-indigo-700 dark:text-indigo-300 mb-2">Facebook</div>
                <div class="space-y-1">
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Client ID:</span>
                    <span class="font-mono text-xs">{{
                      config.server.oauth.facebookClientId
                    }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Client Secret:</span>
                    <span class="font-mono text-xs">{{
                      config.server.oauth.facebookClientSecret
                    }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Redirect URL:</span>
                    <span class="font-mono text-xs">{{
                      config.server.oauth.facebookRedirectUrl
                    }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- reCAPTCHA -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">reCAPTCHA</h3>
            <div class="space-y-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Secret Key:</span>
                <span class="ml-2 font-mono">{{ config.server.recaptcha.secretKey }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Min Score:</span>
                <span class="ml-2 font-mono">{{ config.server.recaptcha.minScore }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Dev Bypass:</span>
                <span class="ml-2 font-mono">{{ config.server.recaptcha.devBypass }}</span>
              </div>
            </div>
          </div>

          <!-- Base de données -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Base de données
            </h3>
            <div class="space-y-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">DATABASE_URL:</span>
                <span class="ml-2 font-mono">{{ config.server.database.url }}</span>
              </div>
            </div>
          </div>

          <!-- Session & Chiffrement -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Session & Chiffrement
            </h3>
            <div class="space-y-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Session Password:</span>
                <span class="ml-2 font-mono">{{ config.server.session.password }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Encryption Secret:</span>
                <span class="ml-2 font-mono">{{ config.server.encryption.secret }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Encryption Salt:</span>
                <span class="ml-2 font-mono">{{ config.server.encryption.salt }}</span>
              </div>
            </div>
          </div>

          <!-- Services externes -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Services externes
            </h3>
            <div class="space-y-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Browserless URL:</span>
                <span class="ml-2 font-mono">{{ config.server.browserless.url }}</span>
              </div>
            </div>
          </div>

          <!-- VAPID & Notifications push -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notifications push (VAPID)
            </h3>
            <div class="space-y-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Private Key:</span>
                <span class="ml-2 font-mono">{{ config.server.vapid.privateKey }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Subject:</span>
                <span class="ml-2 font-mono">{{ config.server.vapid.subject }}</span>
              </div>
            </div>
          </div>

          <!-- Cron -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cron</h3>
            <div class="space-y-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Enabled:</span>
                <span class="ml-2 font-mono">{{ config.server.cron.enabled }}</span>
              </div>
            </div>
          </div>

          <!-- Firebase Admin -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Firebase Admin
            </h3>
            <div class="space-y-2 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Project ID:</span>
                <span class="ml-2 font-mono">{{ config.server.firebase.projectId }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Client Email:</span>
                <span class="ml-2 font-mono">{{ config.server.firebase.clientEmail }}</span>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <span class="text-gray-600 dark:text-gray-400">Private Key:</span>
                <span class="ml-2 font-mono">{{ config.server.firebase.privateKey }}</span>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Configuration Publique -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-globe-alt" class="text-blue-500" />
            {{ $t('admin.config.public') }}
          </h2>
        </template>

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
          <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <span class="text-gray-600 dark:text-gray-400">Firebase API Key:</span>
            <span class="ml-2 font-mono">{{ config.public.firebaseApiKey }}</span>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <span class="text-gray-600 dark:text-gray-400">Firebase Project ID:</span>
            <span class="ml-2 font-mono">{{ config.public.firebaseProjectId }}</span>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <span class="text-gray-600 dark:text-gray-400">Firebase VAPID Key:</span>
            <span class="ml-2 font-mono">{{ config.public.firebaseVapidKey }}</span>
          </div>
        </div>
      </UCard>

      <!-- Variables d'environnement brutes -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-command-line" class="text-green-500" />
            {{ $t('admin.config.env_variables') }}
          </h2>
        </template>

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
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['authenticated', 'super-admin'],
})

const { t } = useI18n()

const { data: config, pending: loading, error } = await useFetch('/api/admin/config')

useSeoMeta({
  title: `${t('admin.config.title')} - Administration`,
})
</script>
