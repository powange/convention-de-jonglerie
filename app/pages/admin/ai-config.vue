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
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-heroicons-computer-desktop"
              class="h-5 w-5 text-blue-600 dark:text-blue-400"
            />
            <h2 class="font-semibold text-lg">LM Studio</h2>
            <UBadge v-if="form.provider === 'lmstudio'" color="success" variant="subtle" size="sm">
              {{ $t('admin.ai_active') }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-6">
          <!-- URL de base -->
          <UFormField :label="$t('admin.ai_lmstudio_base_url')">
            <UInput
              v-model="form.lmstudioBaseUrl"
              class="w-full max-w-md"
              placeholder="http://host.docker.internal:1234"
            />
          </UFormField>

          <!-- Liste des modèles -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {{ $t('admin.ai_models_list') }}
            </h3>

            <div v-if="models.length === 0" class="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {{ $t('admin.ai_no_models') }}
            </div>

            <div v-else class="space-y-2 mb-3">
              <div
                v-for="model in models"
                :key="model.id"
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div>
                  <span class="font-medium text-sm">{{ model.name }}</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 ml-2"
                    >({{ model.modelId }})</span
                  >
                </div>
                <UButton
                  color="error"
                  variant="ghost"
                  size="xs"
                  icon="i-heroicons-trash"
                  :loading="isDeletingModel(model.id)"
                  @click="confirmDeleteModel(model)"
                />
              </div>
            </div>

            <!-- Actions modèles -->
            <div class="flex flex-wrap gap-2">
              <UButton
                variant="outline"
                size="sm"
                icon="i-heroicons-plus"
                @click="showAddModel = true"
              >
                {{ $t('admin.ai_add_model') }}
              </UButton>
              <UButton
                variant="outline"
                size="sm"
                icon="i-heroicons-magnifying-glass"
                :loading="detecting"
                @click="detectModels"
              >
                {{ $t('admin.ai_detect_models') }}
              </UButton>
            </div>

            <!-- Formulaire d'ajout inline -->
            <div
              v-if="showAddModel"
              class="mt-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div class="flex flex-col sm:flex-row gap-3">
                <UFormField :label="$t('admin.ai_model_id')" class="flex-1">
                  <UInput v-model="newModel.modelId" placeholder="gemma-3-12b-it" />
                </UFormField>
                <UFormField :label="$t('admin.ai_model_name')" class="flex-1">
                  <UInput v-model="newModel.name" placeholder="Gemma 3 12B IT" />
                </UFormField>
              </div>
              <div class="flex gap-2 mt-3">
                <UButton size="sm" :loading="addingModel" @click="addModel">
                  {{ $t('common.add') }}
                </UButton>
                <UButton size="sm" variant="ghost" @click="showAddModel = false">
                  {{ $t('common.cancel') }}
                </UButton>
              </div>
            </div>

            <!-- Résultats auto-détection -->
            <div
              v-if="detectedModels.length > 0"
              class="mt-3 p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20"
            >
              <h4 class="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                {{ $t('admin.ai_detected_models', { count: detectedModels.length }) }}
              </h4>
              <div class="space-y-2">
                <div
                  v-for="detected in detectedModels"
                  :key="detected.modelId"
                  class="flex items-center justify-between"
                >
                  <div>
                    <span class="text-sm font-medium">{{ detected.modelId }}</span>
                    <span v-if="detected.contextLength" class="text-xs text-gray-500 ml-2">
                      ({{ detected.contextLength }} tokens)
                    </span>
                  </div>
                  <UButton
                    v-if="!isModelRegistered(detected.modelId)"
                    size="xs"
                    variant="soft"
                    icon="i-heroicons-plus"
                    @click="addDetectedModel(detected)"
                  >
                    {{ $t('common.add') }}
                  </UButton>
                  <UBadge v-else color="success" variant="subtle" size="sm">
                    {{ $t('admin.ai_already_added') }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>

          <!-- Sélection du modèle vision -->
          <UFormField :label="$t('admin.ai_lmstudio_vision_model')">
            <USelect
              v-model="form.lmstudioModelId"
              class="w-full max-w-md"
              :items="modelSelectItems"
              :placeholder="$t('admin.ai_select_model')"
            />
          </UFormField>

          <!-- Sélection du modèle texte -->
          <UFormField :label="$t('admin.ai_lmstudio_text_model')">
            <USelect
              v-model="form.lmstudioTextModelId"
              class="w-full max-w-md"
              :items="modelSelectItems"
              :placeholder="$t('admin.ai_select_model')"
            />
          </UFormField>
        </div>
      </UCard>

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
            <UInput v-model="form.ollamaModel" class="w-full max-w-md" placeholder="llava" />
          </UFormField>
        </div>
      </UCard>

      <!-- Bouton Enregistrer -->
      <div class="flex justify-end">
        <UButton size="lg" icon="i-heroicons-check" :loading="saving" @click="saveConfig">
          {{ $t('admin.ai_save_config') }}
        </UButton>
      </div>
    </div>

    <!-- Modal de confirmation de suppression -->
    <UiConfirmModal
      v-model="showDeleteModal"
      :title="$t('admin.ai_model_confirm_delete_title')"
      :description="$t('admin.ai_model_confirm_delete', { name: modelToDelete?.name })"
      :confirm-label="$t('common.delete')"
      :cancel-label="$t('common.cancel')"
      confirm-color="error"
      icon-name="i-heroicons-trash"
      icon-color="text-red-500"
      @confirm="executeDeleteModel"
      @cancel="showDeleteModal = false"
    />
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
  lmstudioModelId: '' as string,
  lmstudioTextModelId: '' as string,
  anthropicApiKey: '' as string,
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llava',
})

const models = ref<Array<{ id: number; provider: string; modelId: string; name: string }>>([])
const showAddModel = ref(false)
const newModel = reactive({ modelId: '', name: '' })
const detectedModels = ref<Array<{ modelId: string; name: string; contextLength: number | null }>>(
  []
)

// --- Confirmation suppression ---

const showDeleteModal = ref(false)
const modelToDelete = ref<{ id: number; name: string; modelId: string } | null>(null)

function confirmDeleteModel(model: { id: number; name: string; modelId: string }) {
  modelToDelete.value = model
  showDeleteModal.value = true
}

// --- Options ---

const providerOptions = [
  { label: 'LM Studio', value: 'lmstudio' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'Ollama', value: 'ollama' },
]

const modelSelectItems = computed(() => {
  return models.value.map((m) => ({
    label: m.name,
    value: m.modelId,
  }))
})

// --- Chargement initial ---

const { pending: configPending } = await useLazyFetch('/api/admin/ai/config', {
  onResponse({ response }) {
    if (response._data) {
      const cfg = response._data.config
      form.provider = cfg.provider || 'lmstudio'
      form.lmstudioBaseUrl = cfg.lmstudioBaseUrl || 'http://host.docker.internal:1234'
      form.lmstudioModelId = cfg.lmstudioModelId ?? ''
      form.lmstudioTextModelId = cfg.lmstudioTextModelId ?? ''
      form.anthropicApiKey = cfg.anthropicApiKey ?? ''
      form.ollamaBaseUrl = cfg.ollamaBaseUrl || 'http://localhost:11434'
      form.ollamaModel = cfg.ollamaModel || 'llava'
    }
  },
})

await useLazyFetch('/api/admin/ai/models', {
  query: { provider: 'lmstudio' },
  onResponse({ response }) {
    if (response._data?.models) {
      models.value = response._data.models
    }
  },
})

// --- Actions : ajout de modèle ---

const { execute: executeAddModel, loading: addingModel } = useApiAction('/api/admin/ai/models', {
  method: 'POST',
  body: () => ({
    provider: 'lmstudio',
    modelId: newModel.modelId.trim(),
    name: newModel.name.trim() || newModel.modelId.trim(),
  }),
  successMessage: { title: t('admin.ai_model_added') },
  errorMessages: { default: t('admin.ai_model_add_error') },
  onSuccess: (result) => {
    const model = result.data?.model || result.model
    if (model && !models.value.find((m) => m.modelId === model.modelId)) {
      models.value.push(model)
    }
    newModel.modelId = ''
    newModel.name = ''
    showAddModel.value = false
  },
})

async function addModel() {
  if (!newModel.modelId.trim()) return
  await executeAddModel()
}

// --- Actions : suppression de modèle ---

const { execute: executeDeleteById, isLoading: isDeletingModel } = useApiActionById(
  (id) => `/api/admin/ai/models/${id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('admin.ai_model_deleted') },
    errorMessages: { default: t('admin.ai_model_delete_error') },
    onSuccess: () => {
      if (modelToDelete.value) {
        const deleted = modelToDelete.value
        models.value = models.value.filter((m) => m.id !== deleted.id)
        if (form.lmstudioModelId === deleted.modelId) form.lmstudioModelId = ''
        if (form.lmstudioTextModelId === deleted.modelId) form.lmstudioTextModelId = ''
      }
      showDeleteModal.value = false
      modelToDelete.value = null
    },
  }
)

async function executeDeleteModel() {
  if (!modelToDelete.value) return
  await executeDeleteById(modelToDelete.value.id)
}

// --- Actions : auto-détection ---

const { execute: executeDetect, loading: detecting } = useApiAction('/api/admin/ai/models/detect', {
  method: 'POST',
  body: () => ({ baseUrl: form.lmstudioBaseUrl }),
  silentSuccess: true,
  errorMessages: { default: t('admin.ai_detect_error') },
  onSuccess: (result) => {
    detectedModels.value = result.models || []
    if (detectedModels.value.length === 0) {
      useToast().add({ title: t('admin.ai_no_models_detected'), color: 'warning' })
    }
  },
})

async function detectModels() {
  detectedModels.value = []
  await executeDetect()
}

// --- Actions : ajout de modèle détecté ---

async function addDetectedModel(detected: { modelId: string; name: string }) {
  newModel.modelId = detected.modelId
  newModel.name = detected.name
  await executeAddModel()
}

function isModelRegistered(modelId: string): boolean {
  return models.value.some((m) => m.modelId === modelId)
}

// --- Actions : sauvegarde config ---

const { execute: executeSave, loading: saving } = useApiAction('/api/admin/ai/config', {
  method: 'PUT',
  body: () => ({
    provider: form.provider,
    lmstudioBaseUrl: form.lmstudioBaseUrl,
    lmstudioModelId: form.lmstudioModelId || null,
    lmstudioTextModelId: form.lmstudioTextModelId || null,
    anthropicApiKey: form.anthropicApiKey || null,
    ollamaBaseUrl: form.ollamaBaseUrl,
    ollamaModel: form.ollamaModel,
  }),
  successMessage: { title: t('admin.ai_config_saved') },
  errorMessages: { default: t('admin.ai_config_save_error') },
})

async function saveConfig() {
  await executeSave()
}
</script>
