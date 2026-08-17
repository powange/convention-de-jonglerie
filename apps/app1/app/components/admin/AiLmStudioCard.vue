<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon :name="icone" class="h-5 w-5" :class="couleurIcone" />
        <h2 class="font-semibold text-lg">{{ titre }}</h2>
        <UBadge v-if="badge" :color="badge.couleur" variant="subtle" size="sm">
          {{ badge.texte }}
        </UBadge>
      </div>
    </template>

    <div class="space-y-6">
      <p v-if="introduction" class="text-sm text-gray-500 dark:text-gray-400">
        {{ introduction }}
      </p>

      <!-- Adresse du serveur -->
      <UFormField :label="libelleAdresse" :description="aideAdresse">
        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
          <UInput
            :model-value="baseUrl"
            class="w-full sm:flex-1 sm:min-w-0 sm:max-w-md"
            :placeholder="placeholderAdresse"
            @update:model-value="$emit('update:baseUrl', String($event))"
          />
          <!-- Une adresse qu'on ne peut pas éprouver est une fausse assurance : sur le secours,
               on découvrirait qu'elle est fausse au moment précis où la première tombe. -->
          <UButton
            variant="soft"
            class="w-full sm:w-auto sm:shrink-0 justify-center"
            :loading="testEnCours"
            :disabled="!baseUrl"
            @click="testerAdresse"
          >
            {{ $t('admin.ai_base_url_test') }}
          </UButton>
        </div>
      </UFormField>

      <!-- Catalogue propre à CE serveur : deux machines LM Studio n'hébergent pas les mêmes
           modèles, et proposer ceux de l'autre mènerait à réclamer un modèle absent. -->
      <div>
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {{ $t('admin.ai_models_list') }}
        </h3>

        <div v-if="modeles.length === 0" class="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {{ $t('admin.ai_no_models') }}
        </div>

        <div v-else class="space-y-2 mb-3">
          <div
            v-for="modele in modeles"
            :key="modele.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div class="min-w-0">
              <span class="font-medium text-sm">{{ modele.name }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">
                ({{ modele.modelId }})
              </span>
            </div>
            <UButton
              color="error"
              variant="ghost"
              size="xs"
              icon="i-heroicons-trash"
              class="shrink-0"
              :loading="suppressionEnCours(modele.id)"
              @click="demanderSuppression(modele)"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton variant="outline" size="sm" icon="i-heroicons-plus" @click="ajoutOuvert = true">
            {{ $t('admin.ai_add_model') }}
          </UButton>
          <UButton
            variant="outline"
            size="sm"
            icon="i-heroicons-magnifying-glass"
            :loading="detectionEnCours"
            :disabled="!baseUrl"
            @click="detecter"
          >
            {{ $t('admin.ai_detect_models') }}
          </UButton>
        </div>

        <!-- Ajout manuel -->
        <div
          v-if="ajoutOuvert"
          class="mt-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div class="flex flex-col sm:flex-row gap-3">
            <UFormField :label="$t('admin.ai_model_id')" class="flex-1">
              <UInput v-model="nouveauModele.modelId" placeholder="gemma-3-12b-it" />
            </UFormField>
            <UFormField :label="$t('admin.ai_model_name')" class="flex-1">
              <UInput v-model="nouveauModele.name" placeholder="Gemma 3 12B IT" />
            </UFormField>
          </div>
          <div class="flex gap-2 mt-3">
            <UButton size="sm" :loading="ajoutEnCours" @click="ajouterModele">
              {{ $t('common.add') }}
            </UButton>
            <UButton size="sm" variant="ghost" @click="ajoutOuvert = false">
              {{ $t('common.cancel') }}
            </UButton>
          </div>
        </div>

        <!-- Résultats de la détection -->
        <div
          v-if="modelesDetectes.length > 0"
          class="mt-3 p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20"
        >
          <h4 class="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
            {{ $t('admin.ai_detected_models', { count: modelesDetectes.length }) }}
          </h4>
          <div class="space-y-2">
            <div
              v-for="detecte in modelesDetectes"
              :key="detecte.modelId"
              class="flex items-center justify-between gap-2"
            >
              <div class="min-w-0">
                <span class="text-sm font-medium">{{ detecte.modelId }}</span>
                <span v-if="detecte.contextLength" class="text-xs text-gray-500 ml-2">
                  ({{ detecte.contextLength }} tokens)
                </span>
              </div>
              <UButton
                v-if="!dejaEnregistre(detecte.modelId)"
                size="xs"
                variant="soft"
                icon="i-heroicons-plus"
                class="shrink-0"
                @click="ajouterModeleDetecte(detecte)"
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

      <!-- Modèle vision -->
      <UFormField :label="$t('admin.ai_lmstudio_vision_model')" :description="aideModeles">
        <div class="flex items-center gap-2">
          <USelect
            :model-value="visionModel"
            class="w-full max-w-md min-w-0"
            :items="choixModeles"
            :disabled="!baseUrl"
            :placeholder="placeholderModele"
            @update:model-value="$emit('update:visionModel', String($event ?? ''))"
          />
          <!-- Revenir au placeholder — « comme le serveur principal » pour le secours. Une
               option de valeur vide serait plus directe, mais USelect la refuse. -->
          <UButton
            v-if="effacable && visionModel"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-x-mark"
            class="shrink-0"
            :title="libelleEffacer"
            @click="$emit('update:visionModel', '')"
          />
        </div>
      </UFormField>

      <!-- Modèle texte -->
      <UFormField :label="$t('admin.ai_lmstudio_text_model')">
        <div class="flex items-center gap-2">
          <USelect
            :model-value="textModel"
            class="w-full max-w-md min-w-0"
            :items="choixModeles"
            :disabled="!baseUrl"
            :placeholder="placeholderModele"
            @update:model-value="$emit('update:textModel', String($event ?? ''))"
          />
          <UButton
            v-if="effacable && textModel"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-x-mark"
            class="shrink-0"
            :title="libelleEffacer"
            @click="$emit('update:textModel', '')"
          />
        </div>
      </UFormField>
    </div>

    <UiConfirmModal
      v-model="suppressionOuverte"
      :title="$t('admin.ai_model_confirm_delete_title')"
      :description="$t('admin.ai_model_confirm_delete', { name: modeleASupprimer?.name })"
      :confirm-label="$t('common.delete')"
      :cancel-label="$t('common.cancel')"
      confirm-color="error"
      icon-name="i-heroicons-trash"
      icon-color="text-red-500"
      @confirm="supprimerModele"
      @cancel="suppressionOuverte = false"
    />
  </UCard>
</template>

<script setup lang="ts">
interface ModeleEnregistre {
  id: number
  provider: string
  serveur: string
  modelId: string
  name: string
}

interface ModeleDetecte {
  modelId: string
  name: string
  contextLength: number | null
}

const props = defineProps<{
  /** Quel des deux serveurs LM Studio cette carte décrit. */
  serveur: 'principal' | 'secours'
  titre: string
  /** Intitulé du champ d'adresse : « URL de base » ne dit rien du serveur de secours. */
  libelleAdresse: string
  icone: string
  couleurIcone: string
  introduction?: string
  aideAdresse?: string
  aideModeles?: string
  placeholderAdresse: string
  placeholderModele: string
  badge?: { texte: string; couleur: 'success' | 'neutral' }
  baseUrl: string
  visionModel: string
  textModel: string
  /**
   * Autorise à revider la sélection. Le secours en a besoin : sans cela, un modèle choisi par
   * erreur ne pourrait plus être retiré, et l'on perdrait le repli sur ceux du principal.
   * Passe par un bouton et non par une option vide, que USelect refuse.
   */
  effacable?: boolean
  libelleEffacer?: string
}>()

const emit = defineEmits<{
  'update:baseUrl': [valeur: string]
  'update:visionModel': [valeur: string]
  'update:textModel': [valeur: string]
}>()

const { t } = useI18n()
const toast = useToast()

const modeles = ref<ModeleEnregistre[]>([])
const modelesDetectes = ref<ModeleDetecte[]>([])
const ajoutOuvert = ref(false)
const nouveauModele = reactive({ modelId: '', name: '' })
const suppressionOuverte = ref(false)
const modeleASupprimer = ref<ModeleEnregistre | null>(null)

const choixModeles = computed(() => modeles.value.map((m) => ({ label: m.name, value: m.modelId })))

await useLazyFetch('/api/admin/ai/models', {
  query: { provider: 'lmstudio', serveur: props.serveur },
  onResponse({ response }) {
    if (response._data?.models) modeles.value = response._data.models
  },
})

// --- Éprouver l'adresse ---

const { execute: testerAdresse, loading: testEnCours } = useApiAction(
  '/api/admin/ai/models/detect',
  {
    method: 'POST',
    body: () => ({ baseUrl: props.baseUrl }),
    silentSuccess: true,
    errorMessages: { default: t('admin.ai_base_url_test_error') },
    onSuccess: (resultat: any) => {
      const nombre = resultat?.models?.length ?? 0
      toast.add({
        title: t('admin.ai_base_url_test_ok', { count: nombre }),
        color: nombre > 0 ? 'success' : 'warning',
      })
    },
  }
)

// --- Catalogue ---

const { execute: executerAjout, loading: ajoutEnCours } = useApiAction('/api/admin/ai/models', {
  method: 'POST',
  body: () => ({
    provider: 'lmstudio',
    serveur: props.serveur,
    modelId: nouveauModele.modelId.trim(),
    name: nouveauModele.name.trim() || nouveauModele.modelId.trim(),
  }),
  successMessage: { title: t('admin.ai_model_added') },
  errorMessages: { default: t('admin.ai_model_add_error') },
  onSuccess: (resultat: any) => {
    const modele = resultat.data?.model || resultat.model
    if (modele && !modeles.value.find((m) => m.modelId === modele.modelId)) {
      modeles.value.push(modele)
    }
    nouveauModele.modelId = ''
    nouveauModele.name = ''
    ajoutOuvert.value = false
  },
})

async function ajouterModele() {
  if (!nouveauModele.modelId.trim()) return
  await executerAjout()
}

async function ajouterModeleDetecte(detecte: ModeleDetecte) {
  nouveauModele.modelId = detecte.modelId
  nouveauModele.name = detecte.name
  await executerAjout()
}

function dejaEnregistre(modelId: string): boolean {
  return modeles.value.some((m) => m.modelId === modelId)
}

const { execute: executerSuppression, isLoading: suppressionEnCours } = useApiActionById(
  (id) => `/api/admin/ai/models/${id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('admin.ai_model_deleted') },
    errorMessages: { default: t('admin.ai_model_delete_error') },
    onSuccess: () => {
      const supprime = modeleASupprimer.value
      if (supprime) {
        modeles.value = modeles.value.filter((m) => m.id !== supprime.id)
        // Un modèle retiré du catalogue ne peut plus être demandé : le laisser sélectionné
        // ferait échouer l'appel sur une valeur devenue invisible dans la liste.
        if (props.visionModel === supprime.modelId) emit('update:visionModel', '')
        if (props.textModel === supprime.modelId) emit('update:textModel', '')
      }
      suppressionOuverte.value = false
      modeleASupprimer.value = null
    },
  }
)

function demanderSuppression(modele: ModeleEnregistre) {
  modeleASupprimer.value = modele
  suppressionOuverte.value = true
}

async function supprimerModele() {
  if (!modeleASupprimer.value) return
  await executerSuppression(modeleASupprimer.value.id)
}

// --- Détection ---

const { execute: executerDetection, loading: detectionEnCours } = useApiAction(
  '/api/admin/ai/models/detect',
  {
    method: 'POST',
    body: () => ({ baseUrl: props.baseUrl }),
    silentSuccess: true,
    errorMessages: { default: t('admin.ai_detect_error') },
    onSuccess: (resultat: any) => {
      modelesDetectes.value = resultat.models || []
      if (modelesDetectes.value.length === 0) {
        toast.add({ title: t('admin.ai_no_models_detected'), color: 'warning' })
      }
    },
  }
)

async function detecter() {
  modelesDetectes.value = []
  await executerDetection()
}
</script>
