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
              {{ $t('admin.import.title') }}
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- Génération depuis URLs -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-sparkles" class="text-yellow-500" size="24" />
          <h2 class="text-xl font-bold">{{ $t('admin.import.generate_from_urls') }}</h2>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('admin.import.generate_description') }}
        </p>

        <UFormField :label="$t('admin.import.urls_input')" :hint="$t('admin.import.urls_hint')">
          <UTextarea
            v-model="urlsInput"
            :rows="4"
            :placeholder="$t('admin.import.urls_placeholder')"
            class="font-mono w-full"
          />
        </UFormField>

        <!-- Choix de la méthode de génération -->
        <UFormField :label="$t('admin.import.generation_method')">
          <URadioGroup v-model="generationMethod" :items="generationMethodItems" variant="card" />
        </UFormField>

        <div class="flex gap-3">
          <UButton
            color="warning"
            :loading="generating"
            :disabled="!urlsInput.trim() || testingUrls"
            icon="i-heroicons-sparkles"
            @click="generateFromUrls"
          >
            {{ $t('admin.import.generate_json') }}
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            :loading="testingUrls"
            :disabled="!urlsInput.trim() || generating"
            icon="i-heroicons-magnifying-glass"
            @click="testUrls"
          >
            {{ $t('admin.import.test_urls') }}
          </UButton>
        </div>

        <!-- Progression de génération -->
        <AdminImportGenerationProgress
          v-if="generating"
          :step-history="stepHistory"
          :method="generationMethod"
          :agent-progress="agentProgress"
          :agent-pages-visited="agentPagesVisited"
          :current-elapsed-time="currentElapsedTime"
          :current-step-icon="currentStepIcon"
          :current-step-icon-class="currentStepIconClass"
          :is-current-step="isCurrentStep"
          :format-ms="formatMs"
          :format-duration="formatDuration"
          :format-sub-step="formatSubStepWrapper"
          :get-hostname="getHostname"
        />

        <!-- Erreur de génération -->
        <UAlert
          v-if="generateError"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="$t('admin.import.generate_error')"
        >
          <template #description>{{ generateError }}</template>
        </UAlert>

        <!-- Résultat de l'agent -->
        <AdminImportAgentResult v-if="agentResult && !generating" :result="agentResult" />
      </div>
    </UCard>

    <!-- Résultats du test des URLs -->
    <UCard v-if="testResults.length > 0" class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-document-magnifying-glass" class="text-info-500" size="24" />
            <h2 class="text-xl font-bold">{{ $t('admin.import.test_results_title') }}</h2>
          </div>
          <UButton
            icon="i-heroicons-x-mark"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="testResults = []"
          />
        </div>
      </template>

      <div class="space-y-4">
        <!-- Sélecteur d'URL -->
        <UFormField :label="$t('admin.import.select_url')">
          <USelect v-model="selectedTestUrl" :items="testResultItems" class="w-full" />
        </UFormField>

        <!-- Résultat de l'URL sélectionnée -->
        <div v-if="selectedTestResult" class="space-y-4">
          <!-- Statut -->
          <UAlert
            v-if="!selectedTestResult.success"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="$t('admin.import.test_url_error')"
          >
            <template #description>{{ selectedTestResult.error }}</template>
          </UAlert>

          <!-- Données Facebook -->
          <AdminImportTestResultFacebook
            v-if="selectedTestResult.type === 'facebook' && selectedTestResult.facebookData"
            :facebook-data="selectedTestResult.facebookData"
          />

          <!-- Données Web -->
          <AdminImportTestResultWebsite
            v-else-if="selectedTestResult.type === 'website' && selectedTestResult.webContent"
            :web-content="selectedTestResult.webContent"
          />
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-arrow-down-tray" class="text-primary-500" size="24" />
            <h1 class="text-2xl font-bold">{{ $t('admin.import.title') }}</h1>
          </div>
          <UButton
            icon="i-heroicons-question-mark-circle"
            variant="ghost"
            color="neutral"
            @click="showDocumentation = !showDocumentation"
          >
            {{ $t('admin.import.show_documentation') }}
          </UButton>
        </div>
      </template>

      <!-- Documentation -->
      <div v-if="showDocumentation" class="mb-6">
        <AdminImportDocumentation :example-json="exampleJson" />
      </div>

      <!-- Import Form -->
      <div class="space-y-4">
        <UFormField :label="$t('admin.import.json_input')" required>
          <UTextarea
            v-model="jsonInput"
            :rows="15"
            :placeholder="$t('admin.import.json_placeholder')"
            class="font-mono w-full"
          />
        </UFormField>

        <div class="flex gap-3">
          <UButton
            color="primary"
            size="lg"
            :loading="importing || checkingDuplicates"
            :disabled="!jsonInput.trim()"
            @click="validateAndImport"
          >
            {{
              checkingDuplicates
                ? $t('admin.import.checking_duplicates')
                : $t('admin.import.validate_and_import')
            }}
          </UButton>

          <UButton variant="soft" color="neutral" size="lg" @click="loadExample">
            {{ $t('admin.import.load_example') }}
          </UButton>

          <UButton
            variant="soft"
            color="neutral"
            size="lg"
            :disabled="!jsonInput.trim()"
            :icon="jsonCopied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
            @click="copyJsonToClipboard"
          >
            {{ jsonCopied ? $t('common.copied') : $t('common.copy') }}
          </UButton>

          <UButton variant="ghost" color="neutral" size="lg" @click="clearForm">
            {{ $t('common.clear') }}
          </UButton>
        </div>

        <!-- Validation Results -->
        <div v-if="validationResult" class="mt-4">
          <UAlert
            v-if="validationResult.success"
            icon="i-heroicons-check-circle"
            color="success"
            variant="soft"
          >
            <template #title>{{ $t('admin.import.validation_success') }}</template>
            <template #description>
              <div class="mt-2">
                <p>{{ $t('admin.import.ready_to_import') }}</p>
                <ul class="mt-2 space-y-1">
                  <li><strong>Convention:</strong> {{ validationResult.data.convention.name }}</li>
                  <li><strong>Édition:</strong> {{ validationResult.data.edition.name }}</li>
                  <li>
                    <strong>Dates:</strong>
                    {{
                      formatDateRange(
                        validationResult.data.edition.startDate,
                        validationResult.data.edition.endDate
                      )
                    }}
                  </li>
                  <li>
                    <strong>Lieu:</strong> {{ validationResult.data.edition.city }},
                    {{ validationResult.data.edition.country }}
                  </li>
                </ul>
              </div>
            </template>
          </UAlert>

          <UAlert v-else icon="i-heroicons-x-circle" color="error" variant="soft">
            <template #title>{{ $t('admin.import.validation_error') }}</template>
            <template #description>
              <ul class="mt-2 space-y-1">
                <li v-for="error in validationResult.errors" :key="error">
                  {{ error }}
                </li>
              </ul>
            </template>
          </UAlert>
        </div>

        <!-- Import Results -->
        <div v-if="importResult" class="mt-4">
          <UAlert
            v-if="importResult.success"
            icon="i-heroicons-check-circle"
            color="success"
            variant="solid"
          >
            <template #title>{{ $t('admin.import.import_success') }}</template>
            <template #description>
              <div class="mt-2">
                <p>{{ $t('admin.import.import_success_message') }}</p>
                <div class="mt-3 flex gap-2">
                  <UButton
                    color="neutral"
                    variant="solid"
                    size="sm"
                    :to="`/editions/${importResult.editionId}`"
                  >
                    {{ $t('admin.import.view_edition') }}
                  </UButton>
                  <UButton color="neutral" variant="ghost" size="sm" @click="clearForm">
                    {{ $t('admin.import.import_another') }}
                  </UButton>
                </div>
              </div>
            </template>
          </UAlert>

          <UAlert v-else icon="i-heroicons-x-circle" color="error" variant="solid">
            <template #title>{{ $t('admin.import.import_error') }}</template>
            <template #description>
              {{ importResult.error }}
            </template>
          </UAlert>
        </div>
      </div>
    </UCard>

    <!-- Modale d'avertissement pour les doublons -->
    <AdminImportDuplicateModal
      v-model:open="showDuplicateModal"
      :duplicate-editions="duplicateEditions"
      :importing="importing"
      @confirm="performImport"
    />
  </div>
</template>

<script setup lang="ts">
// Middleware de protection pour super admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()
const toast = useToast()

// Composable de génération
const {
  generating,
  generateError,
  generationMethod,
  stepHistory,
  agentProgress,
  agentPagesVisited,
  agentResult,
  currentElapsedTime,
  formatMs,
  formatDuration,
  formatSubStepWrapper,
  isCurrentStep,
  currentStepIcon,
  currentStepIconClass,
  getHostname,
  generate,
} = useImportGeneration()

// Validation des URLs pour le test
const { parseAndValidateUrls } = useUrlValidation()

const showDocumentation = ref(false)
const jsonInput = ref('')
const jsonCopied = ref(false)
const importing = ref(false)
const validationResult = ref<any>(null)
const importResult = ref<any>(null)

// État pour la détection des doublons
const checkingDuplicates = ref(false)
const duplicateEditions = ref<any[]>([])
const showDuplicateModal = ref(false)

// Génération depuis URLs
const urlsInput = ref('')

// État pour le test des URLs
const testingUrls = ref(false)
const testResults = ref<any[]>([])
const selectedTestUrl = ref<string>('')

// Items pour le choix de la méthode de génération
const generationMethodItems = computed(() => [
  {
    label: t('admin.import.method_simple'),
    description: t('admin.import.method_simple_description'),
    value: 'simple',
  },
  {
    label: t('admin.import.method_agent'),
    description: t('admin.import.method_agent_description'),
    value: 'agent',
  },
])

// Items pour le select des résultats de test
const testResultItems = computed(() =>
  testResults.value.map((result) => {
    const hostname = new URL(result.url).hostname
    const status = result.success ? '✅' : '❌'
    const type = result.type === 'facebook' ? '📘' : '🌐'
    return {
      label: `${status} ${type} ${hostname}`,
      value: result.url,
    }
  })
)

// Résultat de test sélectionné
const selectedTestResult = computed(() =>
  testResults.value.find((r) => r.url === selectedTestUrl.value)
)

const exampleJson = `{
  "convention": {
    "name": "Convention Internationale de Jonglerie",
    "email": "contact@convention-jonglerie.org",
    "description": "La plus grande convention de jonglerie d'Europe",
    "logo": "https://example.com/logo.png"
  },
  "edition": {
    "name": "CIJ 2025 - Paris",
    "description": "45ème édition de la Convention Internationale de Jonglerie",
    "startDate": "2025-07-15",
    "endDate": "2025-07-20",
    "addressLine1": "Parc des Expositions",
    "addressLine2": "Hall 5",
    "city": "Paris",
    "region": "Île-de-France",
    "timezone": "Europe/Paris",
    "country": "France",
    "postalCode": "75015",
    "latitude": 48.8566,
    "longitude": 2.3522,
    "imageUrl": "https://example.com/affiche-cij2025.jpg",
    "ticketingUrl": "https://tickets.cij2025.fr",
    "facebookUrl": "https://facebook.com/cij2025",
    "instagramUrl": "https://instagram.com/cij2025",
    "officialWebsiteUrl": "https://www.cij2025.fr",
    "status": "PUBLISHED",
    "hasFoodTrucks": true,
    "hasKidsZone": true,
    "acceptsPets": false,
    "hasTentCamping": true,
    "hasTruckCamping": true,
    "hasGym": true,
    "hasCantine": true,
    "hasShowers": true,
    "hasToilets": true,
    "hasWorkshops": true,
    "hasOpenStage": true,
    "hasConcert": true,
    "hasGala": true,
    "hasAccessibility": true,
    "hasAerialSpace": true,
    "hasFamilyCamping": true,
    "hasSleepingRoom": false,
    "hasFireSpace": true,
    "hasSlacklineSpace": true,
    "hasCashPayment": true,
    "hasCreditCardPayment": true,
    "hasAfjTokenPayment": false,
    "hasATM": true,
    "hasLongShow": true,
    "volunteersOpen": false,
    "volunteersDescription": "Rejoignez notre équipe de bénévoles !",
    "volunteersExternalUrl": ""
  }
}`

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }

  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('fr-FR', options)
  }

  return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} - ${end.toLocaleDateString('fr-FR', options)}`
}

const loadExample = () => {
  jsonInput.value = exampleJson
  validationResult.value = null
  importResult.value = null
}

const clearForm = () => {
  jsonInput.value = ''
  validationResult.value = null
  importResult.value = null
}

const copyJsonToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(jsonInput.value)
    jsonCopied.value = true
    setTimeout(() => {
      jsonCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const validateJson = (input: string): any => {
  const errors = []
  let data = null

  try {
    data = JSON.parse(input)
  } catch {
    return {
      success: false,
      errors: [t('admin.import.invalid_json')],
    }
  }

  // Vérifier la structure
  if (!data.convention) {
    errors.push(t('admin.import.missing_convention'))
  } else {
    // Vérifier les champs requis de la convention
    if (!data.convention.name) {
      errors.push(t('admin.import.missing_convention_name'))
    }
    if (!data.convention.email) {
      errors.push(t('admin.import.missing_convention_email'))
    }
  }

  if (!data.edition) {
    errors.push(t('admin.import.missing_edition'))
  } else {
    // Vérifier les champs requis de l'édition
    const requiredFields = ['startDate', 'endDate', 'addressLine1', 'city', 'country', 'postalCode']
    for (const field of requiredFields) {
      if (!data.edition[field]) {
        errors.push(t('admin.import.missing_field', { field: `edition.${field}` }))
      }
    }

    // Vérifier le format des dates
    if (data.edition.startDate && !isValidDate(data.edition.startDate)) {
      errors.push(t('admin.import.invalid_date', { field: 'startDate' }))
    }
    if (data.edition.endDate && !isValidDate(data.edition.endDate)) {
      errors.push(t('admin.import.invalid_date', { field: 'endDate' }))
    }

    // Vérifier que la date de fin est après la date de début
    if (data.edition.startDate && data.edition.endDate) {
      const start = new Date(data.edition.startDate)
      const end = new Date(data.edition.endDate)
      if (end < start) {
        errors.push(t('admin.import.end_before_start'))
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
    data,
  }
}

const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Vérifie s'il existe des éditions similaires (même période, même pays)
 */
const checkForDuplicates = async (data: any): Promise<boolean> => {
  try {
    checkingDuplicates.value = true
    const response = await $fetch<{
      hasDuplicates: boolean
      duplicates: any[]
      count: number
    }>('/api/admin/check-duplicate-editions', {
      method: 'POST',
      body: {
        startDate: data.edition.startDate,
        endDate: data.edition.endDate,
        country: data.edition.country,
      },
    })

    if (response.hasDuplicates) {
      duplicateEditions.value = response.duplicates
      return true
    }

    duplicateEditions.value = []
    return false
  } catch (error) {
    console.error('Erreur lors de la vérification des doublons:', error)
    // En cas d'erreur, on continue l'import (fail-safe)
    return false
  } finally {
    checkingDuplicates.value = false
  }
}

/**
 * Effectue l'import après validation et confirmation des doublons
 */
const performImport = async () => {
  try {
    importing.value = true
    importResult.value = null
    showDuplicateModal.value = false

    const response = await $fetch<{ editionId: string; conventionId: string }>(
      '/api/admin/import-edition',
      {
        method: 'POST',
        body: validationResult.value.data,
      }
    )

    importResult.value = {
      success: true,
      editionId: response.editionId,
      conventionId: response.conventionId,
    }

    toast.add({
      title: t('admin.import.import_success'),
      description: t('admin.import.import_success_toast'),
      color: 'success',
    })
  } catch (error: any) {
    importResult.value = {
      success: false,
      error: error?.data?.message || t('admin.import.import_failed'),
    }

    toast.add({
      title: t('common.error'),
      description: importResult.value.error,
      color: 'error',
    })
  } finally {
    importing.value = false
  }
}

const validateAndImport = async () => {
  validationResult.value = validateJson(jsonInput.value)

  if (!validationResult.value.success) {
    return
  }

  // Vérifier s'il existe des éditions similaires
  const hasDuplicates = await checkForDuplicates(validationResult.value.data)

  if (hasDuplicates) {
    // Afficher la modale d'avertissement
    showDuplicateModal.value = true
    return
  }

  // Si pas de doublons, procéder à l'import directement
  await performImport()
}

/**
 * Extrait la première image OG trouvée dans les résultats de test
 */
const getPreviewedImageUrl = (): string | undefined => {
  for (const result of testResults.value) {
    if (result.webContent?.openGraph?.image) {
      return result.webContent.openGraph.image
    }
  }
  return undefined
}

/**
 * Teste les URLs fournies sans passer par l'IA
 */
const testUrls = async () => {
  generateError.value = ''
  testResults.value = []
  selectedTestUrl.value = ''

  // Parser et valider les URLs
  const urlsResult = parseAndValidateUrls(urlsInput.value)
  if (!urlsResult.success) {
    generateError.value = urlsResult.error!
    return
  }
  const urls = urlsResult.urls!

  try {
    testingUrls.value = true

    const response = await $fetch<{ results: any[] }>('/api/admin/test-urls', {
      method: 'POST',
      body: { urls },
    })

    testResults.value = response.results
    // Sélectionner automatiquement la première URL
    if (response.results.length > 0) {
      selectedTestUrl.value = response.results[0].url
    }

    toast.add({
      title: t('admin.import.test_success'),
      description: t('admin.import.test_success_description', { count: response.results.length }),
      color: 'success',
    })
  } catch (error: any) {
    generateError.value = error?.data?.message || error?.message || t('admin.import.test_failed')
  } finally {
    testingUrls.value = false
  }
}

const generateFromUrls = async () => {
  // Récupérer l'image prévisualisée pour éviter les hallucinations d'URL
  const previewedImage = getPreviewedImageUrl()

  // Lancer la génération via le composable
  const result = await generate(urlsInput.value, previewedImage)

  if (result) {
    // Mettre le JSON généré dans le champ d'input et le formater
    try {
      const parsed = JSON.parse(result.json)
      jsonInput.value = JSON.stringify(parsed, null, 2)
    } catch {
      jsonInput.value = result.json
    }

    // Réinitialiser les résultats de validation
    validationResult.value = null
    importResult.value = null

    toast.add({
      title: t('admin.import.generate_success'),
      description: t('admin.import.generate_success_description', { provider: result.provider }),
      color: 'success',
    })
  }
}
</script>
