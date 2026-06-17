<template>
  <div class="space-y-6">
    <!-- JSON invalide : impossible d'afficher le formulaire -->
    <UAlert
      v-if="parseError"
      icon="i-heroicons-exclamation-triangle"
      color="warning"
      variant="soft"
      :title="$t('admin.import.form.invalid_json')"
    >
      <template #actions>
        <UButton color="warning" variant="solid" size="sm" @click="resetEmpty">
          {{ $t('admin.import.form.reset_empty') }}
        </UButton>
      </template>
    </UAlert>

    <template v-else>
      <!-- Convention -->
      <section class="space-y-3">
        <h3 class="font-semibold text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.form.section_convention') }}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UFormField :label="$t('admin.import.form.convention_name')" required>
            <UInput v-model="form.convention.name" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.convention_email')" required>
            <UInput v-model="form.convention.email" type="email" class="w-full" />
          </UFormField>
        </div>
        <UFormField :label="$t('admin.import.form.convention_description')">
          <UTextarea v-model="form.convention.description" :rows="2" class="w-full" />
        </UFormField>
        <UFormField :label="$t('admin.import.form.convention_logo')">
          <UInput v-model="form.convention.logo" type="url" class="w-full" />
        </UFormField>
      </section>

      <!-- Édition : informations principales -->
      <section class="space-y-3">
        <h3 class="font-semibold text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.form.section_edition') }}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UFormField :label="$t('admin.import.form.edition_name')">
            <UInput v-model="form.edition.name" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.status')">
            <USelect
              v-model="form.edition.status"
              :items="statusItems"
              :placeholder="$t('admin.import.form.status')"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField :label="$t('admin.import.form.edition_description')">
          <UTextarea v-model="form.edition.description" :rows="3" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UFormField
            :label="$t('admin.import.form.start_date')"
            :hint="$t('admin.import.form.date_hint')"
            required
          >
            <UInput v-model="form.edition.startDate" placeholder="2025-07-15" class="w-full" />
          </UFormField>
          <UFormField
            :label="$t('admin.import.form.end_date')"
            :hint="$t('admin.import.form.date_hint')"
            required
          >
            <UInput v-model="form.edition.endDate" placeholder="2025-07-20" class="w-full" />
          </UFormField>
        </div>
        <UFormField :label="$t('admin.import.form.timezone')">
          <UInput
            v-model="form.edition.timezone"
            :placeholder="$t('admin.import.form.timezone_placeholder')"
            class="w-full max-w-md"
          />
        </UFormField>
      </section>

      <!-- Localisation -->
      <section class="space-y-3">
        <h3 class="font-semibold text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.form.section_location') }}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UFormField :label="$t('admin.import.form.address_line1')" required>
            <UInput v-model="form.edition.addressLine1" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.address_line2')">
            <UInput v-model="form.edition.addressLine2" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.city')" required>
            <UInput v-model="form.edition.city" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.region')">
            <UInput v-model="form.edition.region" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.country')" required>
            <UInput v-model="form.edition.country" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.postal_code')" required>
            <UInput v-model="form.edition.postalCode" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.latitude')">
            <UInput v-model="form.edition.latitude" type="number" step="any" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.longitude')">
            <UInput v-model="form.edition.longitude" type="number" step="any" class="w-full" />
          </UFormField>
        </div>
      </section>

      <!-- Liens -->
      <section class="space-y-3">
        <h3 class="font-semibold text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.form.section_links') }}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UFormField :label="$t('admin.import.form.image_url')">
            <UInput v-model="form.edition.imageUrl" type="url" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.ticketing_url')">
            <UInput v-model="form.edition.ticketingUrl" type="url" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.facebook_url')">
            <UInput v-model="form.edition.facebookUrl" type="url" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.instagram_url')">
            <UInput v-model="form.edition.instagramUrl" type="url" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.official_website_url')">
            <UInput v-model="form.edition.officialWebsiteUrl" type="url" class="w-full" />
          </UFormField>
          <UFormField :label="$t('admin.import.form.juggling_edge_url')">
            <UInput v-model="form.edition.jugglingEdgeUrl" type="url" class="w-full" />
          </UFormField>
        </div>
      </section>

      <!-- Bénévolat -->
      <section class="space-y-3">
        <h3 class="font-semibold text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.form.section_volunteers') }}
        </h3>
        <UCheckbox
          v-model="form.edition.volunteersOpen"
          :label="$t('admin.import.form.volunteers_open')"
        />
        <UFormField :label="$t('admin.import.form.volunteers_description')">
          <UTextarea v-model="form.edition.volunteersDescription" :rows="2" class="w-full" />
        </UFormField>
        <UFormField :label="$t('admin.import.form.volunteers_external_url')">
          <UInput v-model="form.edition.volunteersExternalUrl" type="url" class="w-full" />
        </UFormField>
      </section>

      <!-- Services -->
      <section class="space-y-3">
        <h3 class="font-semibold text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.form.section_services') }}
        </h3>
        <div v-for="group in servicesByCategory" :key="group.category" class="space-y-2">
          <h4 class="text-sm font-medium text-gray-500 dark:text-gray-400">
            {{ $t(`admin.import.form.category_${group.category}`) }}
          </h4>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            <UCheckbox
              v-for="service in group.services"
              :key="service.key"
              :model-value="form.edition[service.key] === true"
              @update:model-value="(value) => setService(service.key, value === true)"
            >
              <template #label>
                <span class="inline-flex items-center gap-1.5">
                  <UIcon :name="service.icon" :class="service.color" />
                  {{ $t(service.i18nKey) }}
                </span>
              </template>
            </UCheckbox>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { conventionServices, getServicesByCategory } from '~/utils/convention-services'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

type AnyRecord = Record<string, unknown>

interface ImportFormConvention {
  name: string
  email: string
  description: string
  logo: string
}

interface ImportFormEdition {
  name: string
  description: string
  startDate: string
  endDate: string
  timezone: string
  addressLine1: string
  addressLine2: string
  city: string
  region: string
  country: string
  postalCode: string
  latitude: string
  longitude: string
  imageUrl: string
  ticketingUrl: string
  facebookUrl: string
  instagramUrl: string
  officialWebsiteUrl: string
  jugglingEdgeUrl: string
  status: string
  volunteersOpen: boolean
  volunteersDescription: string
  volunteersExternalUrl: string
  // Caractéristiques booléennes (services)
  [key: string]: string | boolean
}

interface ImportForm {
  convention: ImportFormConvention
  edition: ImportFormEdition
}

const servicesByCategory = getServicesByCategory()

const statusItems = computed(() => [
  { label: 'PLANNED', value: 'PLANNED' },
  { label: 'PUBLISHED', value: 'PUBLISHED' },
  { label: 'OFFLINE', value: 'OFFLINE' },
  { label: 'CANCELLED', value: 'CANCELLED' },
])

// Champs texte de l'édition (hydratation depuis le JSON)
const EDITION_TEXT_FIELDS = [
  'name',
  'description',
  'startDate',
  'endDate',
  'timezone',
  'addressLine1',
  'addressLine2',
  'city',
  'region',
  'country',
  'postalCode',
  'imageUrl',
  'ticketingUrl',
  'facebookUrl',
  'instagramUrl',
  'officialWebsiteUrl',
  'jugglingEdgeUrl',
  'volunteersDescription',
  'volunteersExternalUrl',
] as const

const createEmptyForm = (): ImportForm => ({
  convention: { name: '', email: '', description: '', logo: '' },
  edition: {
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    timezone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    country: '',
    postalCode: '',
    latitude: '',
    longitude: '',
    imageUrl: '',
    ticketingUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    officialWebsiteUrl: '',
    jugglingEdgeUrl: '',
    status: '',
    volunteersOpen: false,
    volunteersDescription: '',
    volunteersExternalUrl: '',
    ...Object.fromEntries(conventionServices.map((s) => [s.key, false])),
  },
})

const form = reactive<ImportForm>(createEmptyForm())
const parseError = ref(false)
// Dernière valeur émise par ce composant : permet d'ignorer l'écho de notre propre mise à jour
let lastEmitted = ''

const toFormString = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

const toNumberOrNull = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Remplit le formulaire à partir d'une chaîne JSON.
 * - JSON vide → formulaire vide (pas d'erreur)
 * - JSON invalide → parseError = true (le formulaire conserve son état précédent)
 */
const hydrate = (json: string): void => {
  if (!json || !json.trim()) {
    Object.assign(form, createEmptyForm())
    parseError.value = false
    return
  }

  let parsed: AnyRecord
  try {
    parsed = JSON.parse(json) as AnyRecord
  } catch {
    parseError.value = true
    return
  }
  parseError.value = false

  const convention = (parsed.convention ?? {}) as AnyRecord
  const edition = (parsed.edition ?? {}) as AnyRecord

  // Convention
  form.convention.name = toFormString(convention.name)
  form.convention.email = toFormString(convention.email)
  form.convention.description = toFormString(convention.description)
  form.convention.logo = toFormString(convention.logo)

  // Édition — champs texte
  for (const field of EDITION_TEXT_FIELDS) {
    form.edition[field] = toFormString(edition[field])
  }
  form.edition.latitude = toFormString(edition.latitude)
  form.edition.longitude = toFormString(edition.longitude)
  form.edition.status = toFormString(edition.status)
  form.edition.volunteersOpen = edition.volunteersOpen === true

  // Services (booléens)
  for (const service of conventionServices) {
    form.edition[service.key] = edition[service.key] === true
  }
}

/**
 * Sérialise le formulaire en JSON d'import (même structure que le mode brut).
 */
const serialize = (): string => {
  const edition: AnyRecord = {
    name: form.edition.name,
    description: form.edition.description,
    startDate: form.edition.startDate,
    endDate: form.edition.endDate,
    timezone: form.edition.timezone,
    addressLine1: form.edition.addressLine1,
    addressLine2: form.edition.addressLine2,
    city: form.edition.city,
    region: form.edition.region,
    country: form.edition.country,
    postalCode: form.edition.postalCode,
    latitude: toNumberOrNull(form.edition.latitude),
    longitude: toNumberOrNull(form.edition.longitude),
    imageUrl: form.edition.imageUrl,
    ticketingUrl: form.edition.ticketingUrl,
    facebookUrl: form.edition.facebookUrl,
    instagramUrl: form.edition.instagramUrl,
    officialWebsiteUrl: form.edition.officialWebsiteUrl,
    jugglingEdgeUrl: form.edition.jugglingEdgeUrl,
    volunteersOpen: form.edition.volunteersOpen,
    volunteersDescription: form.edition.volunteersDescription,
    volunteersExternalUrl: form.edition.volunteersExternalUrl,
  }

  // status : enum stricte côté serveur, on l'omet si vide
  if (form.edition.status) {
    edition.status = form.edition.status
  }

  // Services (booléens)
  for (const service of conventionServices) {
    edition[service.key] = form.edition[service.key]
  }

  const convention: AnyRecord = {
    name: form.convention.name,
    email: form.convention.email,
    description: form.convention.description,
  }
  if (form.convention.logo) {
    convention.logo = form.convention.logo
  }

  return JSON.stringify({ convention, edition }, null, 2)
}

const setService = (key: string, value: boolean): void => {
  form.edition[key] = value
}

const resetEmpty = (): void => {
  Object.assign(form, createEmptyForm())
  parseError.value = false
}

// JSON externe → formulaire (ignore l'écho de notre propre émission)
watch(
  () => props.modelValue,
  (value) => {
    if (value === lastEmitted) return
    hydrate(value)
  },
  { immediate: true }
)

// Formulaire → JSON externe (on n'écrase pas un JSON invalide non résolu)
watch(
  form,
  () => {
    if (parseError.value) return
    const json = serialize()
    lastEmitted = json
    emit('update:modelValue', json)
  },
  { deep: true }
)
</script>
