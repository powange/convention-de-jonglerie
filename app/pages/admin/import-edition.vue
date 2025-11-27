<template>
  <div class="max-w-7xl mx-auto">
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

        <UButton
          color="warning"
          :loading="generating"
          :disabled="!urlsInput.trim()"
          icon="i-heroicons-sparkles"
          @click="generateFromUrls"
        >
          {{ $t('admin.import.generate_json') }}
        </UButton>

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
        <UAlert
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          :title="$t('admin.import.documentation_title')"
        >
          <template #description>
            <div class="mt-2 space-y-4">
              <p>{{ $t('admin.import.documentation_intro') }}</p>

              <div>
                <h4 class="font-semibold mb-2">{{ $t('admin.import.required_fields') }}</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                  <li><code>convention.name</code> - Nom de la convention</li>
                  <li><code>convention.email</code> - Email de contact (pour revendication)</li>
                  <li>
                    <code>edition.startDate</code> - Date de début (YYYY-MM-DD ou format ISO UTC)
                  </li>
                  <li><code>edition.endDate</code> - Date de fin (YYYY-MM-DD ou format ISO UTC)</li>
                  <li><code>edition.addressLine1</code> - Adresse</li>
                  <li><code>edition.city</code> - Ville</li>
                  <li><code>edition.country</code> - Pays</li>
                  <li><code>edition.postalCode</code> - Code postal</li>
                </ul>
              </div>

              <div>
                <h4 class="font-semibold mb-2">{{ $t('admin.import.optional_fields') }}</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                  <li><code>convention.description</code> - Description de la convention</li>
                  <li><code>convention.logo</code> - URL du logo</li>
                  <li>
                    <code>edition.name</code> - Nom de l'édition (si omis, utilise le nom de la
                    convention)
                  </li>
                  <li><code>edition.description</code> - Description de l'édition</li>
                  <li><code>edition.addressLine2</code> - Complément d'adresse</li>
                  <li><code>edition.region</code> - Région</li>
                  <li><code>edition.latitude/longitude</code> - Coordonnées GPS</li>
                  <li><code>edition.imageUrl</code> - URL de l'image de l'édition</li>
                  <li><code>edition.ticketingUrl</code> - URL de billetterie</li>
                  <li><code>edition.facebookUrl</code> - Page Facebook</li>
                  <li><code>edition.instagramUrl</code> - Page Instagram</li>
                  <li><code>edition.officialWebsiteUrl</code> - Site officiel</li>
                  <li><code>edition.isOnline</code> - Événement en ligne (boolean)</li>
                  <li><code>edition.volunteersOpen</code> - Inscriptions bénévoles ouvertes</li>
                  <li><code>edition.volunteersDescription</code> - Description pour bénévoles</li>
                  <li><code>edition.volunteersExternalUrl</code> - URL externe bénévoles</li>
                </ul>
              </div>

              <div>
                <h4 class="font-semibold mb-2">Formats de dates acceptés</h4>
                <p class="text-sm mb-2">Les dates peuvent être au format :</p>
                <ul class="list-disc list-inside space-y-1 text-sm">
                  <li><code>"2025-10-24"</code> - Date simple (recommandé)</li>
                  <li><code>"2025-10-24T14:30:00"</code> - Date avec heure</li>
                  <li><code>"2025-10-24T14:30:00Z"</code> - Date avec heure UTC</li>
                  <li><code>"2025-10-24T14:30:00.000Z"</code> - Date complète ISO UTC</li>
                </ul>
                <p class="text-xs text-gray-600 mt-2">
                  💡 Pour les événements multi-jours, le format date simple est recommandé.
                </p>
              </div>

              <div>
                <h4 class="font-semibold mb-2">{{ $t('admin.import.features_fields') }}</h4>
                <p class="text-sm mb-2">{{ $t('admin.import.features_description') }}</p>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-1 text-sm">
                  <span title="Food trucks"><code>hasFoodTrucks</code></span>
                  <span title="Espace enfants"><code>hasKidsZone</code></span>
                  <span title="Animaux acceptés"><code>acceptsPets</code></span>
                  <span title="Camping tente"><code>hasTentCamping</code></span>
                  <span title="Camping véhicule"><code>hasTruckCamping</code></span>
                  <span title="Camping famille"><code>hasFamilyCamping</code></span>
                  <span title="Gymnase"><code>hasGym</code></span>
                  <span title="Cantine"><code>hasCantine</code></span>
                  <span title="Douches"><code>hasShowers</code></span>
                  <span title="Toilettes"><code>hasToilets</code></span>
                  <span title="Dortoir"><code>hasSleepingRoom</code></span>
                  <span title="Ateliers"><code>hasWorkshops</code></span>
                  <span title="Scène ouverte"><code>hasOpenStage</code></span>
                  <span title="Concert"><code>hasConcert</code></span>
                  <span title="Gala"><code>hasGala</code></span>
                  <span title="Spectacle long"><code>hasLongShow</code></span>
                  <span title="Espace aérien"><code>hasAerialSpace</code></span>
                  <span title="Espace feu"><code>hasFireSpace</code></span>
                  <span title="Espace slackline"><code>hasSlacklineSpace</code></span>
                  <span title="Accessibilité PMR"><code>hasAccessibility</code></span>
                  <span title="Paiement espèces"><code>hasCashPayment</code></span>
                  <span title="Paiement CB"><code>hasCreditCardPayment</code></span>
                  <span title="Jetons AFJ"><code>hasAfjTokenPayment</code></span>
                  <span title="Distributeur"><code>hasATM</code></span>
                </div>
              </div>

              <div>
                <h4 class="font-semibold mb-2">{{ $t('admin.import.example_json') }}</h4>
                <pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto text-xs">{{
                  exampleJson
                }}</pre>
              </div>
            </div>
          </template>
        </UAlert>
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
            :loading="importing"
            :disabled="!jsonInput.trim()"
            @click="validateAndImport"
          >
            {{ $t('admin.import.validate_and_import') }}
          </UButton>

          <UButton variant="soft" color="neutral" size="lg" @click="loadExample">
            {{ $t('admin.import.load_example') }}
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Middleware de protection pour super admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()
const { $fetch } = useNuxtApp()

const showDocumentation = ref(true)
const jsonInput = ref('')
const importing = ref(false)
const validationResult = ref<any>(null)
const importResult = ref<any>(null)

// Génération depuis URLs
const urlsInput = ref('')
const generating = ref(false)
const generateError = ref('')

const exampleJson = `{
  "convention": {
    "name": "Convention Internationale de Jonglerie",
    "email": "contact@convention-jonglerie.org",
    "description": "La plus grande convention de jonglerie d'Europe"
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
    "country": "France",
    "postalCode": "75015",
    "latitude": 48.8566,
    "longitude": 2.3522,
    "ticketingUrl": "https://tickets.cij2025.fr",
    "facebookUrl": "https://facebook.com/cij2025",
    "instagramUrl": "https://instagram.com/cij2025",
    "officialWebsiteUrl": "https://www.cij2025.fr",
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
    "hasLongShow": true
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

const validateAndImport = async () => {
  validationResult.value = validateJson(jsonInput.value)

  if (!validationResult.value.success) {
    return
  }

  // Si la validation est réussie, procéder à l'import
  try {
    importing.value = true
    importResult.value = null

    const response = await $fetch('/api/admin/import-edition', {
      method: 'POST',
      body: validationResult.value.data,
    })

    importResult.value = {
      success: true,
      editionId: response.editionId,
      conventionId: response.conventionId,
    }

    useToast().add({
      title: t('admin.import.import_success'),
      description: t('admin.import.import_success_toast'),
      color: 'success',
    })
  } catch (error: any) {
    importResult.value = {
      success: false,
      error: error?.data?.message || t('admin.import.import_failed'),
    }

    useToast().add({
      title: t('common.error'),
      description: importResult.value.error,
      color: 'error',
    })
  } finally {
    importing.value = false
  }
}

/**
 * Génère le JSON depuis les URLs fournies via IA
 */
const generateFromUrls = async () => {
  generateError.value = ''

  // Parser les URLs (une par ligne)
  const urls = urlsInput.value
    .split('\n')
    .map((url) => url.trim())
    .filter((url) => url.length > 0)

  if (urls.length === 0) {
    generateError.value = t('admin.import.no_urls')
    return
  }

  // Valider les URLs
  const invalidUrls = urls.filter((url) => {
    try {
      new URL(url)
      return false
    } catch {
      return true
    }
  })

  if (invalidUrls.length > 0) {
    generateError.value = t('admin.import.invalid_urls', { urls: invalidUrls.join(', ') })
    return
  }

  if (urls.length > 5) {
    generateError.value = t('admin.import.too_many_urls')
    return
  }

  try {
    generating.value = true

    const response = await $fetch('/api/admin/generate-import-json', {
      method: 'POST',
      body: { urls },
    })

    // Mettre le JSON généré dans le champ d'input et le formater
    try {
      const parsed = JSON.parse(response.json)
      jsonInput.value = JSON.stringify(parsed, null, 2)
    } catch {
      jsonInput.value = response.json
    }

    // Réinitialiser les résultats de validation
    validationResult.value = null
    importResult.value = null

    useToast().add({
      title: t('admin.import.generate_success'),
      description: t('admin.import.generate_success_description', { provider: response.provider }),
      color: 'success',
    })
  } catch (error: any) {
    generateError.value = error?.data?.message || t('admin.import.generate_failed')
  } finally {
    generating.value = false
  }
}
</script>
