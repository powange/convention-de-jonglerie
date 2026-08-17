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
              {{ $t('admin.ai_config') }}
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-cpu-chip" class="text-purple-600" />
        {{ $t('admin.ai_config') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ $t('admin.ai_config_description') }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="configPending" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-400" />
    </div>

    <div v-else class="space-y-6">
      <!-- Provider par défaut -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-heroicons-cog-6-tooth"
              class="h-5 w-5 text-gray-600 dark:text-gray-400"
            />
            <h2 class="font-semibold text-lg">{{ $t('admin.ai_default_provider') }}</h2>
          </div>
        </template>

        <UFormField :label="$t('admin.ai_provider_label')">
          <USelect v-model="form.provider" class="w-64" :items="providerOptions" />
        </UFormField>
      </UCard>

      <!-- LM Studio -->
      <!-- Les deux serveurs LM Studio, chacun avec son adresse, son catalogue et ses modèles.
           Deux machines distinctes n'hébergent pas forcément les mêmes modèles : réclamer à
           celle de secours ceux de la principale la ferait échouer alors qu'elle répondait. -->
      <AdminAiLmStudioCard
        v-model:base-url="form.lmstudioBaseUrl"
        v-model:vision-model="form.lmstudioModelId"
        v-model:text-model="form.lmstudioTextModelId"
        serveur="principal"
        :titre="$t('admin.ai_lmstudio_primary_title')"
        :libelle-adresse="$t('admin.ai_lmstudio_base_url')"
        icone="i-heroicons-computer-desktop"
        couleur-icone="text-blue-600 dark:text-blue-400"
        placeholder-adresse="http://host.docker.internal:1234"
        :placeholder-modele="$t('admin.ai_select_model')"
        :badge="
          form.provider === 'lmstudio'
            ? { texte: $t('admin.ai_active'), couleur: 'success' }
            : undefined
        "
      />

      <AdminAiLmStudioCard
        v-model:base-url="form.lmstudioBackupBaseUrl"
        v-model:vision-model="form.lmstudioBackupModelId"
        v-model:text-model="form.lmstudioBackupTextModelId"
        serveur="secours"
        :titre="$t('admin.ai_lmstudio_backup_title')"
        :libelle-adresse="$t('admin.ai_lmstudio_backup_base_url')"
        icone="i-heroicons-lifebuoy"
        couleur-icone="text-purple-600 dark:text-purple-400"
        :introduction="$t('admin.ai_lmstudio_backup_intro')"
        :aide-adresse="$t('admin.ai_lmstudio_backup_base_url_help')"
        :aide-modeles="$t('admin.ai_lmstudio_backup_model_help')"
        placeholder-adresse="http://192.168.0.12:1234"
        :placeholder-modele="$t('admin.ai_lmstudio_backup_same_as_primary')"
        effacable
        :libelle-effacer="$t('admin.ai_lmstudio_backup_same_as_primary')"
        :badge="
          form.lmstudioBackupBaseUrl
            ? { texte: $t('admin.ai_lmstudio_backup_configured'), couleur: 'success' }
            : { texte: $t('admin.ai_lmstudio_backup_none'), couleur: 'neutral' }
        "
      />

      <!-- Anthropic -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-sparkles" class="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 class="font-semibold text-lg">Anthropic (Claude)</h2>
            <UBadge v-if="form.provider === 'anthropic'" color="success" variant="subtle" size="sm">
              {{ $t('admin.ai_active') }}
            </UBadge>
          </div>
        </template>

        <UFormField :label="$t('admin.ai_anthropic_api_key')">
          <div class="flex items-center gap-2">
            <UInput
              v-model="form.anthropicApiKey"
              type="password"
              class="w-full max-w-md"
              placeholder="sk-ant-..."
            />
            <UButton
              v-if="form.anthropicApiKey"
              color="error"
              variant="ghost"
              size="sm"
              icon="i-heroicons-x-mark"
              @click="form.anthropicApiKey = ''"
            />
          </div>
          <p v-if="form.anthropicApiKey === '****'" class="text-xs text-gray-500 mt-1">
            {{ $t('admin.ai_api_key_already_set') }}
          </p>
        </UFormField>
      </UCard>

      <!-- Ollama -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-cube" class="h-5 w-5 text-green-600 dark:text-green-400" />
            <h2 class="font-semibold text-lg">Ollama</h2>
            <UBadge v-if="form.provider === 'ollama'" color="success" variant="subtle" size="sm">
              {{ $t('admin.ai_active') }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <UFormField :label="$t('admin.ai_ollama_base_url')">
            <UInput
              v-model="form.ollamaBaseUrl"
              class="w-full max-w-md"
              placeholder="http://localhost:11434"
            />
          </UFormField>

          <UFormField :label="$t('admin.ai_ollama_model')">
            <div class="flex items-center gap-2 max-w-md">
              <USelectMenu
                v-model="form.ollamaModel"
                class="flex-1"
                :items="ollamaModelItems"
                :placeholder="$t('admin.ai_ollama_model_placeholder')"
                create-item
                :search-input="{ placeholder: $t('admin.ai_select_model') }"
                @create="onOllamaModelCreate"
              />
              <UButton
                variant="outline"
                icon="i-heroicons-magnifying-glass"
                :loading="ollamaDetecting"
                @click="detectOllamaModels"
              >
                {{ $t('admin.ai_detect_models') }}
              </UButton>
            </div>
          </UFormField>
        </div>
      </UCard>

      <!-- Délai commun à tous les fournisseurs : c'est la lenteur du modèle qui le dicte, pas
           le fournisseur choisi. -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-clock" class="text-orange-500" />
            {{ $t('admin.ai_timeout_title') }}
          </h2>
        </template>

        <UFormField
          :label="$t('admin.ai_timeout_label')"
          :description="$t('admin.ai_timeout_help')"
        >
          <!-- step-snapping désactivé : le pas de 30 s aide au réglage grossier, mais sans cela
               la saisie est ramenée au multiple le plus proche et une valeur comme 45 s est
               impossible à entrer. -->
          <UInputNumber
            v-model="form.llmTimeoutSeconds"
            :min="30"
            :max="1800"
            :step="30"
            :step-snapping="false"
            class="w-40"
          />
        </UFormField>

        <!-- Un modèle qui raisonne avant de répondre consomme ce budget en réflexion : trop bas,
             il se fait couper avant d'écrire quoi que ce soit, et la réponse revient vide. -->
        <UFormField
          :label="$t('admin.ai_max_tokens_label')"
          :description="$t('admin.ai_max_tokens_help')"
          class="mt-6"
        >
          <UInputNumber
            v-model="form.llmMaxTokens"
            :min="512"
            :max="32768"
            :step="512"
            :step-snapping="false"
            class="w-40"
          />
        </UFormField>
      </UCard>

      <!-- Bouton Enregistrer -->
      <div class="flex justify-end">
        <UButton size="lg" icon="i-heroicons-check" :loading="saving" @click="saveConfig">
          {{ $t('admin.ai_save_config') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()

// --- État ---

const form = reactive({
  provider: 'lmstudio',
  lmstudioBaseUrl: 'http://host.docker.internal:1234',
  lmstudioBackupBaseUrl: '',
  lmstudioModelId: '' as string,
  lmstudioTextModelId: '' as string,
  // Vides, les modèles du serveur principal s'appliquent au secours.
  lmstudioBackupModelId: '' as string,
  lmstudioBackupTextModelId: '' as string,
  anthropicApiKey: '' as string,
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llava',
  // Saisi en secondes : demander des millisecondes à un administrateur est une invitation à
  // se tromper d'un facteur mille.
  llmTimeoutSeconds: 180,
  // Jetons accordés à la réponse du modèle.
  llmMaxTokens: 4096,
})

// --- Options ---

const providerOptions = [
  { label: 'LM Studio', value: 'lmstudio' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'Ollama', value: 'ollama' },
]

// --- Chargement initial ---

const { pending: configPending } = await useLazyFetch('/api/admin/ai/config', {
  onResponse({ response }) {
    if (response._data) {
      const cfg = response._data.config
      form.provider = cfg.provider || 'lmstudio'
      form.lmstudioBaseUrl = cfg.lmstudioBaseUrl || 'http://host.docker.internal:1234'
      form.lmstudioBackupBaseUrl = cfg.lmstudioBackupBaseUrl || ''
      form.lmstudioModelId = cfg.lmstudioModelId ?? ''
      form.lmstudioTextModelId = cfg.lmstudioTextModelId ?? ''
      form.lmstudioBackupModelId = cfg.lmstudioBackupModelId ?? ''
      form.lmstudioBackupTextModelId = cfg.lmstudioBackupTextModelId ?? ''
      form.anthropicApiKey = cfg.anthropicApiKey ?? ''
      form.ollamaBaseUrl = cfg.ollamaBaseUrl || 'http://localhost:11434'
      form.ollamaModel = cfg.ollamaModel || 'llava'
      form.llmTimeoutSeconds = Math.round((cfg.llmTimeoutMs || 180000) / 1000)
      form.llmMaxTokens = cfg.llmMaxTokens || 4096
    }
  },
})

// --- Ollama : détection des modèles installés ---

const ollamaModels = ref<string[]>([])

// Inclut toujours la valeur courante pour qu'elle reste affichée même si non détectée
const ollamaModelItems = computed(() => {
  const items = [...ollamaModels.value]
  if (form.ollamaModel && !items.includes(form.ollamaModel)) {
    items.unshift(form.ollamaModel)
  }
  return items
})

function onOllamaModelCreate(value: string) {
  if (!ollamaModels.value.includes(value)) {
    ollamaModels.value.push(value)
  }
  form.ollamaModel = value
}

const { execute: executeOllamaDetect, loading: ollamaDetecting } = useApiAction(
  '/api/admin/ai/models/ollama',
  {
    method: 'POST',
    body: () => ({ baseUrl: form.ollamaBaseUrl }),
    silentSuccess: true,
    errorMessages: { default: t('admin.ai_detect_error_ollama') },
    onSuccess: (result) => {
      const detected: Array<{ modelId: string }> = result.models || []
      ollamaModels.value = detected.map((m) => m.modelId)
      if (ollamaModels.value.length === 0) {
        useToast().add({ title: t('admin.ai_no_models_detected_ollama'), color: 'warning' })
      }
    },
  }
)

async function detectOllamaModels() {
  await executeOllamaDetect()
}

// --- Actions : sauvegarde config ---

const { execute: executeSave, loading: saving } = useApiAction('/api/admin/ai/config', {
  method: 'PUT',
  body: () => ({
    provider: form.provider,
    lmstudioBaseUrl: form.lmstudioBaseUrl,
    lmstudioBackupBaseUrl: form.lmstudioBackupBaseUrl,
    lmstudioModelId: form.lmstudioModelId || null,
    lmstudioTextModelId: form.lmstudioTextModelId || null,
    lmstudioBackupModelId: form.lmstudioBackupModelId || null,
    lmstudioBackupTextModelId: form.lmstudioBackupTextModelId || null,
    anthropicApiKey: form.anthropicApiKey || null,
    ollamaBaseUrl: form.ollamaBaseUrl,
    ollamaModel: form.ollamaModel,
    // Saisi en secondes côté interface, stocké en millisecondes.
    llmTimeoutMs: form.llmTimeoutSeconds * 1000,
    llmMaxTokens: form.llmMaxTokens,
  }),
  successMessage: { title: t('admin.ai_config_saved') },
  errorMessages: { default: t('admin.ai_config_save_error') },
})

async function saveConfig() {
  await executeSave()
}
</script>
