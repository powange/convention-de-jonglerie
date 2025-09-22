<template>
  <div class="max-w-7xl mx-auto">
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
                  <li><code>edition.startDate</code> - Date de début (YYYY-MM-DD)</li>
                  <li><code>edition.endDate</code> - Date de fin (YYYY-MM-DD)</li>
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
                  <li><code>edition.name</code> - Nom de l'édition (si omis, utilise le nom de la convention)</li>
                  <li><code>edition.description</code> - Description de l'édition</li>
                  <li><code>edition.addressLine2</code> - Complément d'adresse</li>
                  <li><code>edition.region</code> - Région</li>
                  <li><code>edition.latitude/longitude</code> - Coordonnées GPS</li>
                  <li><code>edition.ticketingUrl</code> - URL de billetterie</li>
                  <li><code>edition.facebookUrl</code> - Page Facebook</li>
                  <li><code>edition.instagramUrl</code> - Page Instagram</li>
                  <li><code>edition.officialWebsiteUrl</code> - Site officiel</li>
                </ul>
              </div>

              <div>
                <h4 class="font-semibold mb-2">{{ $t('admin.import.features_fields') }}</h4>
                <p class="text-sm mb-2">{{ $t('admin.import.features_description') }}</p>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-1 text-sm">
                  <code>hasFoodTrucks</code>
                  <code>hasKidsZone</code>
                  <code>acceptsPets</code>
                  <code>hasTentCamping</code>
                  <code>hasTruckCamping</code>
                  <code>hasGym</code>
                  <code>hasCantine</code>
                  <code>hasShowers</code>
                  <code>hasToilets</code>
                  <code>hasWorkshops</code>
                  <code>hasOpenStage</code>
                  <code>hasConcert</code>
                  <code>hasGala</code>
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
        <UFormGroup :label="$t('admin.import.json_input')" required>
          <UTextarea
            v-model="jsonInput"
            :rows="15"
            :placeholder="$t('admin.import.json_placeholder')"
            class="font-mono w-full"
          />
        </UFormGroup>

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
    const requiredFields = [
      'name',
      'startDate',
      'endDate',
      'addressLine1',
      'city',
      'country',
      'postalCode',
    ]
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
</script>
