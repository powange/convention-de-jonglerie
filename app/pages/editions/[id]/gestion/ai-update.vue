<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-lucide-sparkles" class="text-yellow-500" />
          {{ $t('gestion.ai_update.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.ai_update.page_description') }}
        </p>
      </div>

      <!-- Liens externes disponibles -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-link" class="text-blue-500" />
            <h2 class="text-lg font-semibold">{{ $t('gestion.ai_update.external_links') }}</h2>
          </div>
        </template>

        <div v-if="externalUrls.length > 0" class="space-y-2">
          <div
            v-for="link in externalUrls"
            :key="link.url"
            class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
          >
            <UIcon :name="link.icon" class="size-5 text-gray-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ link.label }}</p>
              <a
                :href="link.url"
                target="_blank"
                rel="noopener"
                class="text-xs text-primary-500 hover:underline truncate block"
              >
                {{ link.url }}
              </a>
            </div>
            <UCheckbox v-model="link.selected" />
          </div>
        </div>

        <UAlert
          v-if="externalUrls.length === 0 && !edition.jugglingEdgeUrl"
          icon="i-lucide-info"
          color="info"
          variant="soft"
          :title="$t('gestion.ai_update.no_external_links')"
          :description="$t('gestion.ai_update.no_external_links_description')"
        />

        <!-- URL JugglingEdge -->
        <div class="pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-globe" class="size-5 text-orange-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">JugglingEdge</p>
              <div class="flex gap-2">
                <UInput
                  v-model="jugglingEdgeUrlInput"
                  placeholder="https://www.jugglingedge.com/event.php?EventID=..."
                  class="flex-1"
                  size="sm"
                />
                <UButton
                  size="sm"
                  color="primary"
                  variant="soft"
                  :loading="savingJugglingEdgeUrl"
                  :disabled="jugglingEdgeUrlInput === (edition.jugglingEdgeUrl || '')"
                  @click="saveJugglingEdgeUrl"
                >
                  {{ $t('common.save') }}
                </UButton>
              </div>
            </div>
            <UCheckbox v-model="jugglingEdgeSelected" :disabled="!jugglingEdgeUrlInput" />
          </div>
        </div>
      </UCard>

      <!-- Actions -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sparkles" class="text-yellow-500" />
            <h2 class="text-lg font-semibold">{{ $t('gestion.ai_update.search_updates') }}</h2>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ai_update.search_updates_description') }}
          </p>

          <!-- Choix du provider IA -->
          <UFormField v-if="availableProviders.length > 1" :label="$t('admin.import.ai_provider')">
            <USelect
              v-model="selectedProvider"
              :items="providerItems"
              :loading="loadingProviders"
              class="w-full max-w-md"
            />
          </UFormField>

          <UButton
            color="warning"
            icon="i-lucide-sparkles"
            :loading="generating"
            :disabled="selectedUrls.length === 0"
            @click="searchForUpdates"
          >
            {{ $t('gestion.ai_update.launch_search') }}
          </UButton>

          <!-- Progression -->
          <AdminImportGenerationProgress
            v-if="generating"
            :step-history="stepHistory"
            method="simple"
            :agent-progress="0"
            :agent-pages-visited="0"
            :current-elapsed-time="currentElapsedTime"
            :current-step-icon="'i-heroicons-cog-6-tooth'"
            :current-step-icon-class="'animate-spin text-warning-500'"
            :is-current-step="isCurrentStep"
            :format-ms="formatMs"
            :format-duration="formatDuration"
            :format-sub-step="formatSubStepWrapper"
            :get-hostname="getHostname"
          />

          <!-- Erreur -->
          <UAlert
            v-if="generateError"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="$t('gestion.ai_update.search_error')"
          >
            <template #description>{{ generateError }}</template>
          </UAlert>
        </div>
      </UCard>

      <!-- Résultats -->
      <UCard v-if="updateResult && !generating" class="mt-6">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-file-diff" class="text-green-500" />
            <h2 class="text-lg font-semibold">{{ $t('gestion.ai_update.results_title') }}</h2>
          </div>
        </template>

        <div v-if="differences.length > 0" class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ai_update.differences_found', { count: differences.length }) }}
          </p>

          <div
            v-for="diff in differences"
            :key="diff.field"
            class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{
                diff.label
              }}</span>
              <UCheckbox v-model="diff.apply" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div class="bg-red-50 dark:bg-red-900/20 rounded p-2">
                <span class="text-xs text-red-600 dark:text-red-400 font-medium">{{
                  $t('gestion.ai_update.current_value')
                }}</span>
                <template v-if="isImageField(diff.field)">
                  <img
                    v-if="diff.currentValue"
                    :src="resolveImageUrl(diff.field, diff.currentValue)"
                    :alt="$t('gestion.ai_update.current_value')"
                    class="mt-1 max-h-40 rounded object-contain"
                  />
                  <p v-else class="text-gray-400 mt-1">-</p>
                </template>
                <p v-else class="text-gray-700 dark:text-gray-300 mt-1 break-words">
                  {{ formatDiffValue(diff.field, diff.currentValue) }}
                </p>
              </div>
              <div class="bg-green-50 dark:bg-green-900/20 rounded p-2">
                <span class="text-xs text-green-600 dark:text-green-400 font-medium">{{
                  $t('gestion.ai_update.new_value')
                }}</span>
                <template v-if="isImageField(diff.field)">
                  <img
                    v-if="diff.newValue"
                    :src="resolveImageUrl(diff.field, diff.newValue)"
                    :alt="$t('gestion.ai_update.new_value')"
                    class="mt-1 max-h-40 rounded object-contain"
                  />
                  <p v-else class="text-gray-400 mt-1">-</p>
                </template>
                <p v-else class="text-gray-700 dark:text-gray-300 mt-1 break-words">
                  {{ formatDiffValue(diff.field, diff.newValue) }}
                </p>
              </div>
            </div>
          </div>

          <UButton
            color="primary"
            icon="i-lucide-check"
            :loading="applying"
            :disabled="selectedDifferences.length === 0"
            @click="applyUpdates"
          >
            {{ $t('gestion.ai_update.apply_selected', { count: selectedDifferences.length }) }}
          </UButton>
        </div>

        <div v-else class="text-center py-8">
          <UIcon name="i-lucide-check-circle" class="mx-auto h-12 w-12 text-green-500 mb-4" />
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ai_update.no_differences') }}
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const route = useRoute()
const { t } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const { getImageUrl } = useImageUrl()
const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// Composable de génération (réutilisation du système d'import)
const {
  generating,
  generateError,
  stepHistory,
  currentElapsedTime,
  formatMs,
  formatDuration,
  formatSubStepWrapper,
  isCurrentStep,
  getHostname,
  generate,
  availableProviders,
  selectedProvider,
  loadingProviders,
  loadProviders,
} = useImportGeneration()

onMounted(() => {
  loadProviders()
  if (!edition.value) {
    editionStore.fetchEditionById(editionId, { force: true })
  }
})

// Items du provider IA
const providerItems = computed(() =>
  availableProviders.value.map((provider) => ({
    label: provider.name + (provider.isDefault ? ` (${t('common.default')})` : ''),
    value: provider.id,
    icon: provider.icon,
  }))
)

// Liens externes de l'édition
const externalUrls = ref<Array<{ url: string; label: string; icon: string; selected: boolean }>>([])

watch(
  edition,
  (ed) => {
    if (!ed) return
    const links: typeof externalUrls.value = []
    if (ed.officialWebsiteUrl) {
      links.push({
        url: ed.officialWebsiteUrl,
        label: t('gestion.ai_update.link_website'),
        icon: 'i-lucide-globe',
        selected: true,
      })
    }
    if (ed.facebookUrl) {
      links.push({
        url: ed.facebookUrl,
        label: 'Facebook',
        icon: 'i-lucide-facebook',
        selected: true,
      })
    }
    if (ed.instagramUrl) {
      links.push({
        url: ed.instagramUrl,
        label: 'Instagram',
        icon: 'i-lucide-instagram',
        selected: false,
      })
    }
    if (ed.ticketingUrl) {
      links.push({
        url: ed.ticketingUrl,
        label: t('gestion.ai_update.link_ticketing'),
        icon: 'i-lucide-ticket',
        selected: true,
      })
    }
    externalUrls.value = links
  },
  { immediate: true }
)

// URL JugglingEdge (séparée car éditable)
const jugglingEdgeUrlInput = ref(edition.value?.jugglingEdgeUrl || '')
const jugglingEdgeSelected = ref(!!edition.value?.jugglingEdgeUrl)
const savingJugglingEdgeUrl = ref(false)

watch(edition, (ed) => {
  if (ed) {
    jugglingEdgeUrlInput.value = ed.jugglingEdgeUrl || ''
    jugglingEdgeSelected.value = !!ed.jugglingEdgeUrl
  }
})

const saveJugglingEdgeUrl = async () => {
  savingJugglingEdgeUrl.value = true
  try {
    await $fetch(`/api/editions/${editionId}`, {
      method: 'PUT',
      body: { jugglingEdgeUrl: jugglingEdgeUrlInput.value.trim() || null },
    })
    await editionStore.fetchEditionById(editionId, { force: true })
    useToast().add({ title: t('common.saved'), color: 'success' })
  } catch {
    useToast().add({ title: t('common.error'), color: 'error' })
  } finally {
    savingJugglingEdgeUrl.value = false
  }
}

const selectedUrls = computed(() => {
  const urls = externalUrls.value.filter((l) => l.selected).map((l) => l.url)
  if (jugglingEdgeSelected.value && jugglingEdgeUrlInput.value.trim()) {
    urls.push(jugglingEdgeUrlInput.value.trim())
  }
  return urls
})

// Résultat et différences
const updateResult = ref<any>(null)
const differences = ref<
  Array<{
    field: string
    label: string
    currentValue: string
    newValue: string
    apply: boolean
  }>
>([])

const selectedDifferences = computed(() => differences.value.filter((d) => d.apply))

// Labels lisibles pour les champs
// Champs qui contiennent des URLs d'images
const IMAGE_FIELDS = ['edition.imageUrl', 'convention.logo']
const DATE_FIELDS = ['edition.startDate', 'edition.endDate']

const isImageField = (field: string) => IMAGE_FIELDS.includes(field)
const isDateField = (field: string) => DATE_FIELDS.includes(field)

const resolveImageUrl = (field: string, value: string): string | null => {
  if (!value) return null
  if (field === 'edition.imageUrl') {
    return getImageUrl(value, 'edition', editionId)
  }
  if (field === 'convention.logo') {
    return getImageUrl(value, 'convention', edition.value?.convention?.id)
  }
  return value
}

const formatDiffValue = (field: string, value: string): string => {
  if (!value) return '-'
  if (isDateField(field)) {
    try {
      const date = new Date(value)
      if (isNaN(date.getTime())) return value
      const hasTime = value.includes('T')
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    } catch {
      return value
    }
  }
  // Ne plus tronquer la description pour faciliter la comparaison
  return value
}

const fieldLabels: Record<string, string> = {
  'convention.name': 'Nom de la convention',
  'convention.email': 'Email',
  'convention.description': 'Description convention',
  'edition.name': "Nom de l'édition",
  'edition.description': "Description de l'édition",
  'edition.startDate': 'Date de début',
  'edition.endDate': 'Date de fin',
  'edition.addressLine1': 'Adresse',
  'edition.city': 'Ville',
  'edition.country': 'Pays',
  'edition.postalCode': 'Code postal',
  'edition.imageUrl': 'Affiche',
  'edition.ticketingUrl': 'Billetterie',
  'edition.facebookUrl': 'Facebook',
  'edition.instagramUrl': 'Instagram',
  'edition.officialWebsiteUrl': 'Site officiel',
  'edition.latitude': 'Latitude',
  'edition.longitude': 'Longitude',
}

// Comparer les données IA avec l'édition actuelle
const compareResults = (aiData: any) => {
  const diffs: typeof differences.value = []
  if (!edition.value || !aiData) return diffs

  const ed = edition.value
  const conv = ed.convention

  // Comparer les champs de la convention
  if (aiData.convention) {
    if (conv?.name && aiData.convention.name && aiData.convention.name !== conv.name) {
      diffs.push({
        field: 'convention.name',
        label: fieldLabels['convention.name'],
        currentValue: conv.name,
        newValue: aiData.convention.name,
        apply: false,
      })
    }
    if (aiData.convention.email && aiData.convention.email !== (conv?.email || '')) {
      diffs.push({
        field: 'convention.email',
        label: fieldLabels['convention.email'],
        currentValue: conv?.email || '',
        newValue: aiData.convention.email,
        apply: false,
      })
    }
  }

  // Comparer les champs de l'édition
  if (aiData.edition) {
    const editionFields: Array<{ key: string; edValue: any }> = [
      { key: 'name', edValue: ed.name },
      { key: 'description', edValue: ed.description },
      { key: 'startDate', edValue: ed.startDate },
      { key: 'endDate', edValue: ed.endDate },
      { key: 'addressLine1', edValue: ed.addressLine1 },
      { key: 'city', edValue: ed.city },
      { key: 'country', edValue: ed.country },
      { key: 'postalCode', edValue: ed.postalCode },
      { key: 'imageUrl', edValue: ed.imageUrl },
      { key: 'ticketingUrl', edValue: ed.ticketingUrl },
      { key: 'facebookUrl', edValue: ed.facebookUrl },
      { key: 'instagramUrl', edValue: ed.instagramUrl },
      { key: 'officialWebsiteUrl', edValue: ed.officialWebsiteUrl },
    ]

    for (const { key, edValue } of editionFields) {
      const aiValue = aiData.edition[key]
      if (!aiValue) continue

      // Pour les dates, convertir la valeur IA en UTC si elle est en heure locale (sans Z)
      // puis comparer les timestamps pour éviter les faux positifs
      if (key === 'startDate' || key === 'endDate') {
        let aiDateStr = String(aiValue)

        // Si la date IA n'a pas de Z (heure locale), la convertir en UTC via le timezone de l'édition
        if (aiDateStr.includes('T') && !aiDateStr.endsWith('Z')) {
          const tz = aiData.edition.timezone || ed.timezone || 'UTC'
          try {
            // Interpréter la date dans le timezone de l'édition et convertir en ISO UTC
            const localDate = new Date(
              new Date(aiDateStr).toLocaleString('en-US', { timeZone: 'UTC' })
            )
            const tzOffset =
              new Date(new Date(aiDateStr).toLocaleString('en-US', { timeZone: tz })).getTime() -
              localDate.getTime()
            const utcDate = new Date(new Date(aiDateStr).getTime() - tzOffset)
            aiDateStr = utcDate.toISOString()
          } catch {
            // Fallback : ajouter Z pour forcer UTC
            aiDateStr = aiDateStr + 'Z'
          }
        }

        const currentDate = edValue ? new Date(edValue).getTime() : 0
        const aiDate = new Date(aiDateStr).getTime()
        if (!isNaN(aiDate) && currentDate !== aiDate) {
          diffs.push({
            field: `edition.${key}`,
            label: fieldLabels[`edition.${key}`] || key,
            currentValue: String(edValue || ''),
            newValue: aiDateStr,
            apply: !edValue,
          })
        }
        continue
      }

      const currentStr = String(edValue || '')
      const aiStr = String(aiValue)

      if (aiStr && aiStr !== currentStr) {
        diffs.push({
          field: `edition.${key}`,
          label: fieldLabels[`edition.${key}`] || key,
          currentValue: currentStr,
          newValue: aiStr,
          apply: !currentStr, // Pré-cocher si la valeur actuelle est vide
        })
      }
    }

    // Comparer les booléens (services/features) — uniquement si l'IA détecte true et l'édition a false
    const booleanFields = [
      'hasFoodTrucks',
      'hasKidsZone',
      'acceptsPets',
      'hasTentCamping',
      'hasTruckCamping',
      'hasGym',
      'hasFamilyCamping',
      'hasSleepingRoom',
      'hasFireSpace',
      'hasGala',
      'hasOpenStage',
      'hasConcert',
      'hasLongShow',
      'hasCantine',
      'hasAerialSpace',
      'hasSlacklineSpace',
      'hasUnicycleSpace',
      'hasWorkshops',
      'hasToilets',
      'hasShowers',
      'hasAccessibility',
      'hasCashPayment',
      'hasCreditCardPayment',
      'hasAfjTokenPayment',
      'hasATM',
    ]

    for (const key of booleanFields) {
      if (aiData.edition[key] === true && !(ed as any)[key]) {
        diffs.push({
          field: `edition.${key}`,
          label: key,
          currentValue: 'false',
          newValue: 'true',
          apply: true,
        })
      }
    }
  }

  return diffs
}

// Lancer la recherche
const searchForUpdates = async () => {
  updateResult.value = null
  differences.value = []

  const urlsText = selectedUrls.value.join('\n')
  const result = await generate(urlsText)

  if (result?.json) {
    try {
      const parsed = JSON.parse(result.json)
      updateResult.value = parsed
      differences.value = compareResults(parsed)
    } catch {
      generateError.value = "Erreur lors de l'analyse du résultat IA"
    }
  }
}

// Appliquer les mises à jour sélectionnées
const applying = ref(false)

const applyUpdates = async () => {
  if (selectedDifferences.value.length === 0) return

  applying.value = true
  try {
    const editionUpdates: Record<string, any> = {}
    const conventionUpdates: Record<string, any> = {}

    for (const diff of selectedDifferences.value) {
      if (diff.field.startsWith('edition.')) {
        const key = diff.field.replace('edition.', '')
        editionUpdates[key] =
          diff.newValue === 'true' ? true : diff.newValue === 'false' ? false : diff.newValue
      } else if (diff.field.startsWith('convention.')) {
        const key = diff.field.replace('convention.', '')
        conventionUpdates[key] = diff.newValue
      }
    }

    // Appliquer les mises à jour de l'édition
    if (Object.keys(editionUpdates).length > 0) {
      await $fetch(`/api/editions/${editionId}`, {
        method: 'PUT',
        body: editionUpdates,
      })
    }

    // Rafraîchir les données
    await editionStore.fetchEditionById(editionId, { force: true })

    // Marquer les différences appliquées
    differences.value = differences.value.filter((d) => !d.apply)

    useToast().add({
      title: t('gestion.ai_update.updates_applied'),
      color: 'success',
    })
  } catch (error: any) {
    useToast().add({
      title: t('common.error'),
      description: error?.data?.message || error?.message,
      color: 'error',
    })
  } finally {
    applying.value = false
  }
}

useSeoMeta({
  title: t('gestion.ai_update.title'),
})
</script>
