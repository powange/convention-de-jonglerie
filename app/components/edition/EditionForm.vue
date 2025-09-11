<template>
  <UForm :state="state" class="space-y-4" @submit="handleSubmit">
    <UStepper v-model="currentStep" :items="steps" class="mb-4">
      <template #general>
        <div class="space-y-6">
          <UFormField
            :label="$t('common.convention')"
            name="conventionId"
            required
            :error="
              touchedFields.conventionId && !state.conventionId
                ? $t('errors.convention_required')
                : undefined
            "
          >
            <USelect
              v-model="state.conventionId"
              :items="conventionOptions"
              :placeholder="$t('forms.placeholders.select_convention')"
              size="lg"
              class="w-full"
              :loading="loadingConventions"
              value-key="value"
              @change="touchedFields.conventionId = true"
            />
          </UFormField>

          <UFormField
            :label="$t('forms.labels.edition_name_optional')"
            name="name"
            :error="getNameError()"
            description="Si aucun nom n'est spécifié, le nom de la convention sera utilisé"
          >
            <UInput
              v-model="state.name"
              :placeholder="$t('forms.placeholders.edition_name_example')"
              size="lg"
              class="w-full"
              maxlength="200"
              @blur="
                (() => {
                  touchedFields.name = true
                  trimField('name')
                })()
              "
            />
          </UFormField>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Date de début -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Date et heure de début
              </h4>
              <div class="grid grid-cols-2 gap-3">
                <UFormField
                  :label="$t('common.date')"
                  name="startDate"
                  required
                  :error="getStartDateError()"
                >
                  <UPopover :popper="{ placement: 'bottom-start' }">
                    <UButton
                      color="neutral"
                      variant="outline"
                      icon="i-heroicons-calendar-days"
                      :label="displayStartDate || $t('common.select')"
                      block
                      size="lg"
                    />
                    <template #content>
                      <UCalendar
                        v-model="calendarStartDate"
                        class="p-2"
                        @update:model-value="updateStartDate"
                      />
                    </template>
                  </UPopover>
                </UFormField>
                <UFormField :label="$t('common.time')" name="startTime" required>
                  <USelect
                    v-model="startTime"
                    :items="timeOptions"
                    placeholder="00:00"
                    size="lg"
                    value-key="value"
                    :ui="{ content: 'min-w-fit' }"
                    @change="updateStartDateTime"
                  />
                </UFormField>
              </div>
            </div>

            <!-- Date de fin -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Date et heure de fin
              </h4>
              <div class="grid grid-cols-2 gap-3">
                <UFormField
                  :label="$t('common.date')"
                  name="endDate"
                  required
                  :error="getEndDateError()"
                >
                  <UPopover :popper="{ placement: 'bottom-start' }">
                    <UButton
                      color="neutral"
                      variant="outline"
                      icon="i-heroicons-calendar-days"
                      :label="displayEndDate || $t('common.select')"
                      block
                      size="lg"
                      @click="prepareEndCalendar"
                    />
                    <template #content>
                      <UCalendar
                        v-model="calendarEndDate"
                        class="p-2"
                        :is-date-disabled="
                          (date) => !!calendarStartDate && date < calendarStartDate
                        "
                        @update:model-value="updateEndDate"
                      />
                    </template>
                  </UPopover>
                </UFormField>
                <UFormField :label="$t('common.time')" name="endTime" required>
                  <USelect
                    v-model="endTime"
                    :items="timeOptions"
                    placeholder="00:00"
                    size="lg"
                    value-key="value"
                    :ui="{ content: 'min-w-fit' }"
                    @change="updateEndDateTime"
                  />
                </UFormField>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="flex items-center gap-2 mb-2">
              <UIcon name="i-heroicons-map-pin" class="text-primary-500" />
              <h4 class="text-lg font-medium text-gray-700 dark:text-gray-300">Adresse du lieu</h4>
            </div>

            <UAlert
              icon="i-heroicons-light-bulb"
              color="info"
              variant="soft"
              :title="$t('common.tip')"
              :description="$t('components.edition_form.address_tip')"
            />

            <UCard>
              <template #header>
                <AddressAutocomplete @address-selected="handleAddressSelected" />
              </template>

              <div class="space-y-4">
                <UFormField
                  :label="$t('common.address')"
                  name="addressLine1"
                  required
                  :error="
                    touchedFields.addressStreet && !state.addressLine1
                      ? $t('errors.address_required')
                      : undefined
                  "
                >
                  <UInput
                    v-model="state.addressLine1"
                    required
                    placeholder="123 rue de la Jonglerie"
                    size="lg"
                    class="w-full"
                    @blur="
                      (() => {
                        touchedFields.addressStreet = true
                        trimField('addressLine1')
                      })()
                    "
                  >
                    <template #leading>
                      <UIcon name="i-heroicons-home" />
                    </template>
                  </UInput>
                </UFormField>

                <UFormField :label="$t('forms.labels.address_complement')" name="addressLine2">
                  <UInput
                    v-model="state.addressLine2"
                    :placeholder="$t('forms.placeholders.address_complement')"
                    size="lg"
                    class="w-full"
                    @blur="trimField('addressLine2')"
                  >
                    <template #leading>
                      <UIcon name="i-heroicons-building-office-2" />
                    </template>
                  </UInput>
                </UFormField>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <UFormField
                    :label="$t('common.postal_code')"
                    name="postalCode"
                    required
                    :error="
                      touchedFields.addressZipCode && !state.postalCode
                        ? $t('errors.required_field')
                        : undefined
                    "
                    class="col-span-1"
                  >
                    <UInput
                      v-model="state.postalCode"
                      required
                      placeholder="75001"
                      size="lg"
                      pattern="[0-9]{5}"
                      maxlength="5"
                      @blur="
                        (() => {
                          touchedFields.addressZipCode = true
                          trimField('postalCode')
                        })()
                      "
                    />
                  </UFormField>

                  <UFormField
                    :label="$t('common.city')"
                    name="city"
                    required
                    :error="
                      touchedFields.addressCity && !state.city
                        ? $t('errors.required_field')
                        : undefined
                    "
                    class="col-span-1 md:col-span-2"
                  >
                    <UInput
                      v-model="state.city"
                      required
                      :placeholder="$t('forms.placeholders.city_example')"
                      size="lg"
                      @blur="
                        (() => {
                          touchedFields.addressCity = true
                          trimField('city')
                        })()
                      "
                    />
                  </UFormField>

                  <UFormField
                    :label="$t('common.country')"
                    name="country"
                    required
                    :error="
                      touchedFields.addressCountry && !state.country
                        ? $t('errors.required_field')
                        : undefined
                    "
                    :ui="{ content: 'min-w-fit' }"
                    class="col-span-2 md:col-span-1"
                  >
                    <UInput
                      v-if="showCustomCountry"
                      v-model="state.country"
                      required
                      :placeholder="$t('components.edition_form.country_placeholder')"
                      size="lg"
                      class="w-full"
                      @blur="
                        (() => {
                          touchedFields.addressCountry = true
                          trimField('country')
                        })()
                      "
                    >
                      <template #leading>
                        <UIcon name="i-heroicons-globe-europe-africa" />
                      </template>
                      <template #trailing>
                        <UButton
                          icon="i-heroicons-x-mark"
                          color="neutral"
                          variant="link"
                          size="xs"
                          @click="
                            (() => {
                              showCustomCountry = false
                              state.country = 'France'
                            })()
                          "
                        />
                      </template>
                    </UInput>
                    <USelectMenu
                      v-else
                      v-model="selectedCountry"
                      :items="countryOptions"
                      :placeholder="$t('common.select')"
                      size="lg"
                      class="w-full"
                      value-attribute="value"
                      option-attribute="label"
                      @change="handleCountryChange"
                    >
                      <template #label>
                        <div v-if="selectedCountry" class="flex items-center gap-2">
                          <UIcon :name="selectedCountry.icon" class="w-4 h-4" />
                          <span>{{ selectedCountry.label }}</span>
                        </div>
                        <span v-else class="text-gray-400">{{ $t('common.select') }}</span>
                      </template>
                      <template #option="{ option }">
                        <div class="flex items-center gap-2">
                          <UIcon :name="option.icon" class="w-4 h-4" />
                          <span>{{ option.label }}</span>
                        </div>
                      </template>
                    </USelectMenu>
                  </UFormField>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </template>

      <template #services>
        <div class="space-y-8">
          <div v-for="category in servicesByCategory" :key="category.category" class="space-y-4">
            <div class="border-b border-gray-200 pb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ category.label }}
              </h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UCheckbox
                v-for="service in category.services"
                :key="service.key"
                :model-value="state[service.key]"
                indicator="end"
                variant="card"
                @update:model-value="(val) => setServiceValue(service.key, val)"
              >
                <template #label>
                  <div class="flex items-center gap-2">
                    <UIcon :name="service.icon" :class="service.color" size="20" />
                    <span>{{ service.label }}</span>
                  </div>
                </template>
              </UCheckbox>
            </div>
          </div>
        </div>
      </template>

      <template #about>
        <div class="space-y-6">
          <UFormField
            :label="$t('components.edition_form.convention_poster_optional')"
            name="image"
          >
            <ImageUpload
              v-model="state.imageUrl"
              :endpoint="{ type: 'edition', id: props.initialData?.id }"
              :options="{
                validation: {
                  maxSize: 5 * 1024 * 1024, // 5MB
                  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
                },
                resetAfterUpload: false,
              }"
              :alt="$t('components.edition_form.poster_alt')"
              :placeholder="$t('components.edition_form.poster_placeholder')"
              @uploaded="onImageUploaded"
              @deleted="onImageDeleted"
              @error="onImageError"
            />
          </UFormField>

          <UFormField
            :label="$t('common.description')"
            name="description"
            :error="getDescriptionError()"
          >
            <MinimalMarkdownEditor
              v-model="state.description"
              :empty-placeholder="$t('components.edition_form.convention_description_placeholder')"
              @blur="
                (() => {
                  touchedFields.description = true
                  trimField('description')
                })()
              "
            />
          </UFormField>
        </div>
      </template>

      <template #external-links>
        <div class="space-y-6">
          <!-- Section Billetterie -->
          <div class="space-y-4">
            <div class="border-b border-gray-200 pb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('components.edition_form.ticketing_section_title') }}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('components.edition_form.ticketing_section_description') }}
              </p>
            </div>
            <UFormField
              :label="$t('components.edition_form.official_website_link')"
              name="officialWebsiteUrl"
            >
              <UInput
                v-model="state.officialWebsiteUrl"
                type="url"
                placeholder="https://www.mon-site-officiel.org"
                class="w-full"
                @blur="trimField('officialWebsiteUrl')"
              >
                <template #leading>
                  <UIcon name="i-heroicons-globe-alt" />
                </template>
              </UInput>
            </UFormField>
            <UFormField :label="$t('components.edition_form.ticketing_link')" name="ticketingUrl">
              <UInput
                v-model="state.ticketingUrl"
                type="url"
                placeholder="https://billetterie.com/ma-convention"
                class="w-full"
                @blur="trimField('ticketingUrl')"
              >
                <template #leading>
                  <UIcon name="i-heroicons-ticket" />
                </template>
              </UInput>
            </UFormField>
          </div>

          <!-- Section Réseaux sociaux -->
          <div class="space-y-4">
            <div class="border-b border-gray-200 pb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('components.edition_form.social_networks_title') }}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('components.edition_form.social_networks_description') }}
              </p>
            </div>
            <div class="space-y-4">
              <UFormField :label="$t('components.edition_form.facebook_page')" name="facebookUrl">
                <UInput
                  v-model="state.facebookUrl"
                  type="url"
                  placeholder="https://facebook.com/ma-convention"
                  class="w-full"
                  @blur="trimField('facebookUrl')"
                >
                  <template #leading>
                    <UIcon name="i-simple-icons-facebook" class="text-blue-600" />
                  </template>
                </UInput>
              </UFormField>
              <UFormField
                :label="$t('components.edition_form.instagram_account')"
                name="instagramUrl"
              >
                <UInput
                  v-model="state.instagramUrl"
                  type="url"
                  placeholder="https://instagram.com/ma-convention"
                  class="w-full"
                  @blur="trimField('instagramUrl')"
                >
                  <template #leading>
                    <UIcon name="i-simple-icons-instagram" class="text-pink-600" />
                  </template>
                </UInput>
              </UFormField>
            </div>
          </div>
        </div>
      </template>
    </UStepper>

    <div class="flex justify-between mt-4">
      <UButton
        v-if="currentStep > 0"
        color="neutral"
        variant="solid"
        icon="i-heroicons-arrow-left"
        @click="currentStep--"
        >{{ $t('components.edition_form.previous') }}</UButton
      >
      <UButton
        v-if="currentStep < steps.length - 1"
        color="primary"
        variant="solid"
        icon="i-heroicons-arrow-right"
        trailing
        @click="handleNextStep"
        >{{ $t('components.edition_form.next') }}</UButton
      >
      <UButton
        v-if="currentStep === steps.length - 1"
        type="submit"
        :loading="loading"
        icon="i-heroicons-check"
        >{{ submitButtonText }}</UButton
      >
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { reactive, ref, watch, computed, onMounted, nextTick } from 'vue'

import AddressAutocomplete from '~/components/AddressAutocomplete.vue'
import ImageUpload from '~/components/ui/ImageUpload.vue'
import { useTranslatedConventionServices } from '~/composables/useConventionServices'
import type { Edition, Convention } from '~/types'

import type { StepperItem } from '@nuxt/ui'

// import { useAuthStore } from '~/stores/auth';

const props = defineProps<{
  initialData?: Partial<Edition>
  submitButtonText?: string
  loading?: boolean
}>()

const emit = defineEmits(['submit'])

const currentStep = ref(0)
const steps = ref<StepperItem[]>([
  {
    title: computed(() => t('components.edition_form.step_general_title')),
    description: computed(() => t('components.edition_form.step_general_description')),
    icon: 'i-heroicons-information-circle',
    slot: 'general',
  },
  {
    title: computed(() => t('components.edition_form.step_services_title')),
    description: 'Services Disponibles',
    icon: 'i-heroicons-cog',
    slot: 'services',
  },
  {
    title: computed(() => t('components.edition_form.step_about_title')),
    description: computed(() => t('components.edition_form.step_about_description')),
    icon: 'i-heroicons-document-text',
    slot: 'about',
  },
  {
    title: computed(() => t('components.edition_form.step_external_links_title')),
    description: computed(() => t('components.edition_form.step_external_links_description')),
    icon: 'i-heroicons-link',
    slot: 'external-links',
  },
])

// Track which fields have been touched
const touchedFields = reactive({
  conventionId: false,
  name: false,
  description: false,
  startDate: false,
  endDate: false,
  addressCountry: false,
  addressCity: false,
  addressStreet: false,
  addressZipCode: false,
})

const state = reactive({
  conventionId: props.initialData?.conventionId,
  name: props.initialData?.name || '',
  description: props.initialData?.description || '',
  imageUrl: props.initialData?.imageUrl || null,
  startDate: props.initialData?.startDate
    ? new Date(props.initialData.startDate).toISOString().slice(0, 16)
    : '',
  endDate: props.initialData?.endDate
    ? new Date(props.initialData.endDate).toISOString().slice(0, 16)
    : '',
  addressLine1: props.initialData?.addressLine1 || '',
  addressLine2: props.initialData?.addressLine2 || '',
  postalCode: props.initialData?.postalCode || '',
  city: props.initialData?.city || '',
  region: props.initialData?.region || '',
  country: props.initialData?.country || '',
  ticketingUrl: props.initialData?.ticketingUrl || '',
  officialWebsiteUrl: props.initialData?.officialWebsiteUrl || '',
  facebookUrl: props.initialData?.facebookUrl || '',
  instagramUrl: props.initialData?.instagramUrl || '',
  hasFoodTrucks: props.initialData?.hasFoodTrucks || false,
  hasKidsZone: props.initialData?.hasKidsZone || false,
  acceptsPets: props.initialData?.acceptsPets || false,
  hasTentCamping: props.initialData?.hasTentCamping || false,
  hasTruckCamping: props.initialData?.hasTruckCamping || false,
  hasFamilyCamping: props.initialData?.hasFamilyCamping || false,
  hasGym: props.initialData?.hasGym || false,
  hasFireSpace: props.initialData?.hasFireSpace || false,
  hasGala: props.initialData?.hasGala || false,
  hasOpenStage: props.initialData?.hasOpenStage || false,
  hasConcert: props.initialData?.hasConcert || false,
  hasCantine: props.initialData?.hasCantine || false,
  hasAerialSpace: props.initialData?.hasAerialSpace || false,
  hasSlacklineSpace: props.initialData?.hasSlacklineSpace || false,
  hasToilets: props.initialData?.hasToilets || false,
  hasShowers: props.initialData?.hasShowers || false,
  hasAccessibility: props.initialData?.hasAccessibility || false,
  hasWorkshops: props.initialData?.hasWorkshops || false,
  hasCreditCardPayment: props.initialData?.hasCreditCardPayment || false,
  hasAfjTokenPayment: props.initialData?.hasAfjTokenPayment || false,
})

const toast = useToast()
const { getTranslatedServicesByCategory } = useTranslatedConventionServices()
const servicesByCategory = getTranslatedServicesByCategory
// const authStore = useAuthStore();
const showCustomCountry = ref(false)

// Date formatter pour l'affichage
const { locale, t } = useI18n()
const df = computed(() => {
  const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US'
  return new DateFormatter(localeCode, { dateStyle: 'medium' })
})

// CalendarDate objects pour les sélecteurs de date
const calendarStartDate = ref<CalendarDate | null>(null)
const calendarEndDate = ref<CalendarDate | null>(null)

// Heures séparées
const startTime = ref('09:00')
const endTime = ref('18:00')

// Options de pays les plus courants pour les conventions de jonglerie
const countryOptions = [
  { label: 'France', value: 'France', icon: 'flag:fr-4x3' },
  { label: 'Belgique', value: 'Belgique', icon: 'flag:be-4x3' },
  { label: 'Suisse', value: 'Suisse', icon: 'flag:ch-4x3' },
  { label: 'Allemagne', value: 'Allemagne', icon: 'flag:de-4x3' },
  { label: 'Pays-Bas', value: 'Pays-Bas', icon: 'flag:nl-4x3' },
  { label: 'Italie', value: 'Italie', icon: 'flag:it-4x3' },
  { label: 'Espagne', value: 'Espagne', icon: 'flag:es-4x3' },
  { label: 'Royaume-Uni', value: 'Royaume-Uni', icon: 'flag:gb-4x3' },
  { label: 'Luxembourg', value: 'Luxembourg', icon: 'flag:lu-4x3' },
  { label: 'Autriche', value: 'Autriche', icon: 'flag:at-4x3' },
  { label: 'Portugal', value: 'Portugal', icon: 'flag:pt-4x3' },
  { label: 'Pologne', value: 'Pologne', icon: 'flag:pl-4x3' },
  { label: t('countries.czech_republic'), value: 'République Tchèque', icon: 'flag:cz-4x3' },
  { label: 'Canada', value: 'Canada', icon: 'flag:ca-4x3' },
  { label: 'États-Unis', value: 'États-Unis', icon: 'flag:us-4x3' },
  { label: 'Autre', value: 'Autre', icon: 'i-heroicons-globe-europe-africa' },
]

// Options d'heures (de 00:00 à 23:30 par intervalles de 30 min)
const timeOptions = computed(() => {
  const options = []
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const icon =
        hour < 6
          ? 'i-heroicons-moon'
          : hour < 12
            ? 'i-heroicons-sun'
            : hour < 18
              ? 'i-heroicons-sun'
              : 'i-heroicons-moon'
      options.push({ label: time, value: time, icon })
    }
  }
  return options
})

// Affichage des dates sélectionnées
const displayStartDate = computed(() => {
  if (!calendarStartDate.value) return ''
  return df.value.format(calendarStartDate.value.toDate(getLocalTimeZone()))
})

const displayEndDate = computed(() => {
  if (!calendarEndDate.value) return ''
  return df.value.format(calendarEndDate.value.toDate(getLocalTimeZone()))
})

// Gestion des conventions
const conventions = ref<Convention[]>([])
const loadingConventions = ref(true)

// Options pour le sélecteur de convention
const conventionOptions = computed(() => {
  return conventions.value.map((convention) => ({
    value: convention.id,
    label: convention.name,
    icon: 'i-heroicons-building-office',
  }))
})

// Pays sélectionné pour l'affichage avec drapeau
const selectedCountry = computed({
  get: () => countryOptions.find((option) => option.value === state.country) || null,
  set: (value) => {
    state.country = value?.value || ''
  },
})

// Fonction pour charger les conventions de l'utilisateur
const fetchUserConventions = async () => {
  try {
    loadingConventions.value = true

    const data = await $fetch<Convention[]>('/api/conventions/my-conventions')

    conventions.value = data || []
  } catch (error) {
    console.error('Erreur lors du chargement des conventions:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de charger vos conventions',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
  } finally {
    loadingConventions.value = false
  }
}

// Fonctions de validation des dates
const validateDates = () => {
  if (!state.startDate || !state.endDate) return { isValid: true }

  const startDate = new Date(state.startDate)
  const endDate = new Date(state.endDate)
  // const now = new Date();

  // Vérifier que la date de fin est supérieure à la date de début
  if (endDate <= startDate) {
    return {
      isValid: false,
      error: t('validation.date_end_after_start'),
    }
  }

  // Permettre les éditions passées pour alimenter l'historique
  // Suppression de la contrainte de date future

  return { isValid: true }
}

const dateValidation = computed(() => validateDates())

// Fonctions pour nettoyer les espaces en début/fin des champs texte
const trimField = (fieldName: string) => {
  const val = (state as any)[fieldName]
  if (typeof val === 'string') {
    ;(state as any)[fieldName] = val.trim()
  }
}

const trimAllTextFields = () => {
  trimField('name')
  trimField('description')
  trimField('addressLine1')
  trimField('addressLine2')
  trimField('postalCode')
  trimField('city')
  trimField('region')
  trimField('country')
  trimField('ticketingUrl')
  trimField('officialWebsiteUrl')
  trimField('facebookUrl')
  trimField('instagramUrl')
}

// Fonctions pour obtenir les erreurs de validation des champs de date
const getStartDateError = () => {
  if (touchedFields.startDate && !state.startDate) {
    return t('validation.date_start_required')
  }
  return undefined
}

const getEndDateError = () => {
  if (touchedFields.endDate && !state.endDate) {
    return 'La date de fin est requise'
  }
  if (touchedFields.endDate && touchedFields.startDate && !dateValidation.value.isValid) {
    return dateValidation.value.error
  }
  return undefined
}

const getNameError = () => {
  if (touchedFields.name && state.name) {
    if (state.name.length < 3) {
      return t('validation.name_min_3')
    }
    if (state.name.length > 200) {
      return t('validation.name_max_200')
    }
  }
  return undefined
}

const getDescriptionError = () => {
  if (touchedFields.description && state.description && state.description.length > 5000) {
    return t('validation.description_max_5000')
  }
  return undefined
}

// Gestionnaires d'événements pour l'upload d'image
const onImageUploaded = (result: {
  success: boolean
  imageUrl?: string
  edition?: { imageUrl?: string }
}) => {
  if (result.success) {
    // L'API d'upload d'édition peut retourner soit imageUrl directement, soit dans l'objet edition
    const newImageUrl = result.imageUrl || result.edition?.imageUrl
    if (newImageUrl) {
      state.imageUrl = newImageUrl
    }
    toast.add({
      title: t('upload.success_message'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  }
}

const onImageDeleted = () => {
  state.imageUrl = null
  toast.add({
    title: t('upload.delete_message'),
    icon: 'i-heroicons-check-circle',
    color: 'success',
  })
}

const onImageError = (error: string) => {
  toast.add({
    title: t('upload.error_message'),
    description: error,
    icon: 'i-heroicons-exclamation-triangle',
    color: 'error',
  })
}

const handleNextStep = () => {
  // Validate current step before moving forward
  if (currentStep.value === 0) {
    // Mark all required fields as touched for validation
    touchedFields.conventionId = true
    touchedFields.startDate = true
    touchedFields.endDate = true
    touchedFields.addressStreet = true
    touchedFields.addressZipCode = true
    touchedFields.addressCity = true
    touchedFields.addressCountry = true

    // Check if required fields are filled (nom n'est plus obligatoire)
    if (
      !state.conventionId ||
      !state.startDate ||
      !state.endDate ||
      !state.addressLine1 ||
      !state.postalCode ||
      !state.city ||
      !state.country
    ) {
      const toast = useToast()
      toast.add({
        title: 'Formulaire incomplet',
        description: 'Veuillez remplir tous les champs obligatoires',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      })
      return
    }

    // Check date validation
    if (!dateValidation.value.isValid) {
      const toast = useToast()
      toast.add({
        title: 'Dates invalides',
        description: dateValidation.value.error,
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      })
      return
    }
  }

  currentStep.value++
}

const handleAddressSelected = (address: {
  addressLine1: string
  addressLine2?: string
  postalCode: string
  city: string
  region?: string
  country: string
}) => {
  state.addressLine1 = address.addressLine1
  state.addressLine2 = address.addressLine2 || ''
  state.postalCode = address.postalCode
  state.city = address.city
  state.region = address.region || ''
  state.country = address.country

  // Vérifier si le pays est dans la liste
  const countryExists = countryOptions.some((option) => option.value === address.country)
  showCustomCountry.value = !countryExists && address.country !== ''
}

const handleCountryChange = (value: any) => {
  touchedFields.addressCountry = true
  if (value === 'Autre') {
    showCustomCountry.value = true
    state.country = ''
    // Focus sur le champ personnalisé après le prochain tick
    nextTick(() => {
      const input = document.querySelector('input[name="country"]') as HTMLInputElement
      if (input) input.focus()
    })
  }
}

const handleSubmit = () => {
  // Nettoyer tous les champs texte avant validation finale
  trimAllTextFields()

  // Validation finale avant soumission
  if (!dateValidation.value.isValid) {
    const toast = useToast()
    toast.add({
      title: 'Dates invalides',
      description: dateValidation.value.error,
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
    return
  }

  // Nettoyer les données avant envoi (convertir chaînes vides en null)
  const cleanedData = {
    ...state,
    imageUrl: state.imageUrl?.trim() || null,
    description: state.description?.trim() || null,
    name: state.name?.trim() || null,
    addressLine2: state.addressLine2?.trim() || null,
    region: state.region?.trim() || null,
    ticketingUrl: state.ticketingUrl?.trim() || null,
    officialWebsiteUrl: state.officialWebsiteUrl?.trim() || null,
    facebookUrl: state.facebookUrl?.trim() || null,
    instagramUrl: state.instagramUrl?.trim() || null,
  }

  emit('submit', cleanedData)
}

// Watchers pour marquer les champs de date comme touchés lors des changements
watch(
  () => state.startDate,
  () => {
    if (state.startDate) {
      touchedFields.startDate = true
    }
  }
)

watch(
  () => state.endDate,
  () => {
    if (state.endDate) {
      touchedFields.endDate = true
    }
  }
)

// Charger les conventions au montage du composant
onMounted(() => {
  fetchUserConventions()

  // Initialiser les dates et heures si elles existent
  if (state.startDate) {
    const startDateTime = new Date(state.startDate)
    const year = startDateTime.getFullYear()
    const month = startDateTime.getMonth() + 1
    const day = startDateTime.getDate()
    calendarStartDate.value = new CalendarDate(year, month, day)
    startTime.value = `${startDateTime.getHours().toString().padStart(2, '0')}:${startDateTime.getMinutes().toString().padStart(2, '0')}`
  }

  if (state.endDate) {
    const endDateTime = new Date(state.endDate)
    const year = endDateTime.getFullYear()
    const month = endDateTime.getMonth() + 1
    const day = endDateTime.getDate()
    calendarEndDate.value = new CalendarDate(year, month, day)
    endTime.value = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`
  }
})

// Fonctions pour mettre à jour les dates
const updateStartDate = (date: CalendarDate | null) => {
  if (date && startTime.value) {
    const [hours, minutes] = (startTime.value || '').split(':').map(Number)
    // Créer un format datetime-local en évitant les conversions UTC
    const year = date.year.toString().padStart(4, '0')
    const month = date.month.toString().padStart(2, '0')
    const day = date.day.toString().padStart(2, '0')
    const hoursStr = Number.isFinite(hours) ? hours!.toString().padStart(2, '0') : '00'
    const minutesStr = Number.isFinite(minutes) ? minutes!.toString().padStart(2, '0') : '00'
    state.startDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}`
    touchedFields.startDate = true
  }
}

const updateEndDate = (date: CalendarDate | null) => {
  if (date && endTime.value) {
    const [hours, minutes] = (endTime.value || '').split(':').map(Number)
    // Créer un format datetime-local en évitant les conversions UTC
    const year = date.year.toString().padStart(4, '0')
    const month = date.month.toString().padStart(2, '0')
    const day = date.day.toString().padStart(2, '0')
    const hoursStr = Number.isFinite(hours) ? hours!.toString().padStart(2, '0') : '00'
    const minutesStr = Number.isFinite(minutes) ? minutes!.toString().padStart(2, '0') : '00'
    state.endDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}`
    touchedFields.endDate = true
  }
}

const updateStartDateTime = () => {
  if (calendarStartDate.value && startTime.value) {
    const [hours, minutes] = (startTime.value || '').split(':').map(Number)
    // Créer un format datetime-local en évitant les conversions UTC
    const year = calendarStartDate.value.year.toString().padStart(4, '0')
    const month = calendarStartDate.value.month.toString().padStart(2, '0')
    const day = calendarStartDate.value.day.toString().padStart(2, '0')
    const hoursStr = Number.isFinite(hours) ? hours!.toString().padStart(2, '0') : '00'
    const minutesStr = Number.isFinite(minutes) ? minutes!.toString().padStart(2, '0') : '00'
    state.startDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}`
  }
}

const updateEndDateTime = () => {
  if (calendarEndDate.value && endTime.value) {
    const [hours, minutes] = (endTime.value || '').split(':').map(Number)
    // Créer un format datetime-local en évitant les conversions UTC
    const year = calendarEndDate.value.year.toString().padStart(4, '0')
    const month = calendarEndDate.value.month.toString().padStart(2, '0')
    const day = calendarEndDate.value.day.toString().padStart(2, '0')
    const hoursStr = Number.isFinite(hours) ? hours!.toString().padStart(2, '0') : '00'
    const minutesStr = Number.isFinite(minutes) ? minutes!.toString().padStart(2, '0') : '00'
    state.endDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}`
  }
}

// Mise à jour d'un service booléen (évite syntaxe TS dans template)
function setServiceValue(key: string, value: boolean) {
  ;(state as any)[key] = value
}

// Préparer le calendrier de fin : se placer sur la date de début si définie
const prepareEndCalendar = () => {
  if (calendarStartDate.value && !calendarEndDate.value) {
    // Clone logique: créer un nouvel objet CalendarDate
    const d = calendarStartDate.value
    calendarEndDate.value = new CalendarDate(d.year, d.month, d.day)
  }
}

// Watcher pour s'assurer que conventionId est bien défini après le chargement des conventions
watch(
  [() => conventions.value, () => props.initialData],
  ([newConventions, newInitialData]) => {
    if (newConventions.length > 0 && newInitialData?.conventionId !== undefined) {
      state.conventionId = newInitialData.conventionId
    }
  },
  { immediate: true }
)

// Watcher spécifique pour réinitialiser la valeur quand les conventions sont chargées
watch(
  () => conventions.value.length,
  (newLength) => {
    if (newLength > 0 && props.initialData?.conventionId !== undefined) {
      // Utiliser nextTick pour s'assurer que le DOM est mis à jour
      nextTick(() => {
        state.conventionId = props.initialData?.conventionId
      })
    }
  }
)

// Watch for changes in initialData prop to update the form state (e.g., when editing a different convention)
watch(
  () => props.initialData,
  (newVal) => {
    if (newVal) {
      state.conventionId = newVal.conventionId
      state.name = newVal.name || ''
      state.description = newVal.description || ''
      state.startDate = newVal.startDate
        ? new Date(newVal.startDate).toISOString().slice(0, 16)
        : ''
      state.endDate = newVal.endDate ? new Date(newVal.endDate).toISOString().slice(0, 16) : ''
      state.addressLine1 = newVal.addressLine1 || ''
      state.addressLine2 = newVal.addressLine2 || ''
      state.postalCode = newVal.postalCode || ''
      state.city = newVal.city || ''
      state.region = newVal.region || ''
      state.country = newVal.country || ''
      state.ticketingUrl = newVal.ticketingUrl || ''
      state.officialWebsiteUrl = newVal.officialWebsiteUrl || ''
      state.facebookUrl = newVal.facebookUrl || ''
      state.instagramUrl = newVal.instagramUrl || ''
      state.hasFoodTrucks = newVal.hasFoodTrucks || false
      state.hasKidsZone = newVal.hasKidsZone || false
      state.acceptsPets = newVal.acceptsPets || false
      state.hasTentCamping = newVal.hasTentCamping || false
      state.hasTruckCamping = newVal.hasTruckCamping || false
      state.hasFamilyCamping = newVal.hasFamilyCamping || false
      state.hasGym = newVal.hasGym || false
      state.hasFireSpace = newVal.hasFireSpace || false
      state.hasGala = newVal.hasGala || false
      state.hasOpenStage = newVal.hasOpenStage || false
      state.hasConcert = newVal.hasConcert || false
      state.hasCantine = newVal.hasCantine || false
      state.hasAerialSpace = newVal.hasAerialSpace || false
      state.hasSlacklineSpace = newVal.hasSlacklineSpace || false
      state.hasToilets = newVal.hasToilets || false
      state.hasShowers = newVal.hasShowers || false
      state.hasAccessibility = newVal.hasAccessibility || false
      state.hasWorkshops = newVal.hasWorkshops || false
      state.hasCreditCardPayment = newVal.hasCreditCardPayment || false
      state.hasAfjTokenPayment = newVal.hasAfjTokenPayment || false
    }
  },
  { deep: true }
)
</script>
