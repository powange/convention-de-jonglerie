<template>
  <div>
    <!-- Loading initial -->
    <div v-if="initialLoading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <!-- Erreur : édition non trouvée -->
    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <!-- Erreur : accès refusé -->
    <div v-else-if="!canEdit">
      <UAlert
        icon="i-lucide-shield-alert"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>

    <!-- Contenu principal -->
    <div v-else class="space-y-6">
      <!-- En-tête -->
      <div>
        <h1 class="text-2xl font-bold">{{ $t('gestion.general_info.title') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.general_info.description') }}
        </p>
      </div>

      <!-- Formulaire -->
      <div class="space-y-6">
        <!-- Nom de l'édition -->
        <UFormField
          :label="$t('forms.labels.edition_name_optional')"
          name="name"
          description="Si aucun nom n'est spécifié, le nom de la convention sera utilisé"
        >
          <UInput
            v-model="name"
            :placeholder="$t('forms.placeholders.edition_name_example')"
            class="w-full"
            maxlength="200"
            @blur="name = name?.trim() || ''"
          />
        </UFormField>

        <!-- Dates -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Date de début -->
          <div class="space-y-4">
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ $t('components.edition_form.start_date_time') }}
            </h4>
            <div class="grid grid-cols-2 gap-3">
              <UFormField :label="$t('common.date')" name="startDate" required>
                <UPopover :popper="{ placement: 'bottom-start' }">
                  <UButton
                    color="neutral"
                    variant="outline"
                    icon="i-heroicons-calendar-days"
                    :label="displayStartDate || $t('common.select')"
                    block
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
              {{ $t('components.edition_form.end_date_time') }}
            </h4>
            <div class="grid grid-cols-2 gap-3">
              <UFormField :label="$t('common.date')" name="endDate" required>
                <UPopover :popper="{ placement: 'bottom-start' }">
                  <UButton
                    color="neutral"
                    variant="outline"
                    icon="i-heroicons-calendar-days"
                    :label="displayEndDate || $t('common.select')"
                    block
                    @click="prepareEndCalendar"
                  />
                  <template #content>
                    <UCalendar
                      v-model="calendarEndDate"
                      class="p-2"
                      :is-date-disabled="(date) => !!calendarStartDate && date < calendarStartDate"
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
                  value-key="value"
                  :ui="{ content: 'min-w-fit' }"
                  @change="updateEndDateTime"
                />
              </UFormField>
            </div>
          </div>
        </div>

        <!-- Fuseau horaire -->
        <UFormField
          :label="$t('common.timezone')"
          name="timezone"
          :description="$t('components.edition_form.timezone_description')"
        >
          <USelectMenu
            v-model="timezone"
            :items="timezoneItems"
            :placeholder="$t('forms.placeholders.select_timezone')"
            value-key="value"
            :filter-fields="['label', 'city', 'region', 'value']"
            class="w-full"
            :ui="{ content: 'max-h-80' }"
          >
            <template #leading>
              <UIcon name="i-heroicons-globe-alt" class="text-gray-400" />
            </template>
            <template #item-label="{ item }">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ item.city }}</span>
                <span class="text-muted text-xs">{{ item.region }}</span>
                <span class="text-muted text-xs ml-auto">{{ item.offset }}</span>
              </div>
            </template>
          </USelectMenu>
        </UFormField>

        <!-- Adresse -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="i-heroicons-map-pin" class="text-primary-500" />
            <h4 class="text-lg font-medium text-gray-700 dark:text-gray-300">
              {{ $t('components.edition_form.address_title') }}
            </h4>
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
              <UFormField :label="$t('common.address')" name="addressLine1" required>
                <UInput
                  v-model="addressLine1"
                  placeholder="123 rue de la Jonglerie"
                  class="w-full"
                  @blur="addressLine1 = addressLine1?.trim() || ''"
                >
                  <template #leading>
                    <UIcon name="i-heroicons-home" />
                  </template>
                </UInput>
              </UFormField>

              <UFormField :label="$t('forms.labels.address_complement')" name="addressLine2">
                <UInput
                  v-model="addressLine2"
                  :placeholder="$t('forms.placeholders.address_complement')"
                  class="w-full"
                  @blur="addressLine2 = addressLine2?.trim() || ''"
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
                  class="col-span-1"
                >
                  <UInput
                    v-model="postalCode"
                    placeholder="75001"
                    pattern="[0-9]{5}"
                    maxlength="5"
                    @blur="postalCode = postalCode?.trim() || ''"
                  />
                </UFormField>

                <UFormField
                  :label="$t('common.city')"
                  name="city"
                  required
                  class="col-span-1 md:col-span-2"
                >
                  <UInput
                    v-model="city"
                    :placeholder="$t('forms.placeholders.city_example')"
                    @blur="city = city?.trim() || ''"
                  />
                </UFormField>

                <UFormField
                  :label="$t('common.country')"
                  name="country"
                  required
                  :ui="{ content: 'min-w-fit' }"
                  class="col-span-2 md:col-span-1"
                >
                  <UInput
                    v-if="showCustomCountry"
                    v-model="country"
                    :placeholder="$t('components.edition_form.country_placeholder')"
                    class="w-full"
                    @blur="country = country?.trim() || ''"
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
                            country = 'France'
                          })()
                        "
                      />
                    </template>
                  </UInput>
                  <USelectMenu
                    v-else
                    v-model="selectedCountry"
                    :items="countrySelectOptions"
                    :placeholder="$t('common.select')"
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

      <!-- Bouton enregistrer -->
      <div class="flex justify-end">
        <UButton
          icon="i-lucide-save"
          :label="$t('gestion.general_info.save')"
          :loading="saving"
          @click="save()"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'

import { useDatetime } from '~/composables/useDatetime'
import { useTimezones } from '~/composables/useTimezones'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { countrySelectOptions } from '~/utils/countries'

definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const { locale, t } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { toApiFormat, fromApiFormat } = useDatetime()
const { getSelectMenuItems, getDefaultTimezoneForCountry } = useTimezones()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

const initialLoading = ref(true)

// Permissions
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// État local
const name = ref('')
const startDate = ref<Date | null>(null)
const endDate = ref<Date | null>(null)
const timezone = ref<string | null>(null)
const addressLine1 = ref('')
const addressLine2 = ref('')
const postalCode = ref('')
const city = ref('')
const region = ref('')
const country = ref('')
const showCustomCountry = ref(false)

// Items pour le sélecteur de fuseau horaire
const timezoneItems = computed(() => getSelectMenuItems())

// Date formatter
const df = computed(() => {
  const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US'
  return new DateFormatter(localeCode, { dateStyle: 'medium' })
})

// CalendarDate objects pour les sélecteurs de date
const calendarStartDate = ref<CalendarDate | null>(null)
const calendarEndDate = ref<CalendarDate | null>(null)

// Heures séparées pour les selects
const startTime = ref('09:00')
const endTime = ref('18:00')

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

// Pays sélectionné pour l'affichage avec drapeau
const selectedCountry = computed({
  get: () => countrySelectOptions.find((option) => option.value === country.value) || null,
  set: (value) => {
    country.value = value?.value || ''
  },
})

// Synchroniser les valeurs avec l'édition chargée
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      name.value = newEdition.name || ''
      timezone.value = newEdition.timezone || null
      addressLine1.value = newEdition.addressLine1 || ''
      addressLine2.value = newEdition.addressLine2 || ''
      postalCode.value = newEdition.postalCode || ''
      city.value = newEdition.city || ''
      region.value = newEdition.region || ''
      country.value = newEdition.country || ''

      // Vérifier si le pays est dans la liste
      const countryExists = countrySelectOptions.some(
        (option) => option.value === newEdition.country
      )
      showCustomCountry.value = !countryExists && !!newEdition.country

      // Initialiser les dates
      const parsedStart = newEdition.startDate ? fromApiFormat(newEdition.startDate) : null
      const parsedEnd = newEdition.endDate ? fromApiFormat(newEdition.endDate) : null
      startDate.value = parsedStart
      endDate.value = parsedEnd

      if (parsedStart) {
        const year = parsedStart.getFullYear()
        const month = parsedStart.getMonth() + 1
        const day = parsedStart.getDate()
        calendarStartDate.value = new CalendarDate(year, month, day)
        startTime.value = `${parsedStart.getHours().toString().padStart(2, '0')}:${parsedStart.getMinutes().toString().padStart(2, '0')}`
      }

      if (parsedEnd) {
        const year = parsedEnd.getFullYear()
        const month = parsedEnd.getMonth() + 1
        const day = parsedEnd.getDate()
        calendarEndDate.value = new CalendarDate(year, month, day)
        endTime.value = `${parsedEnd.getHours().toString().padStart(2, '0')}:${parsedEnd.getMinutes().toString().padStart(2, '0')}`
      }
    }
  },
  { immediate: true }
)

// Fonctions de mise à jour des dates
const updateStartDate = (date: CalendarDate | null) => {
  if (date) {
    const [hours, minutes] = (startTime.value || '09:00').split(':').map(Number)
    startDate.value = new Date(date.year, date.month - 1, date.day, hours, minutes)
  }
}

const updateEndDate = (date: CalendarDate | null) => {
  if (date) {
    const [hours, minutes] = (endTime.value || '18:00').split(':').map(Number)
    endDate.value = new Date(date.year, date.month - 1, date.day, hours, minutes)
  }
}

const updateStartDateTime = () => {
  if (calendarStartDate.value && startTime.value) {
    const [hours, minutes] = startTime.value.split(':').map(Number)
    startDate.value = new Date(
      calendarStartDate.value.year,
      calendarStartDate.value.month - 1,
      calendarStartDate.value.day,
      hours,
      minutes
    )
  }
}

const updateEndDateTime = () => {
  if (calendarEndDate.value && endTime.value) {
    const [hours, minutes] = endTime.value.split(':').map(Number)
    endDate.value = new Date(
      calendarEndDate.value.year,
      calendarEndDate.value.month - 1,
      calendarEndDate.value.day,
      hours,
      minutes
    )
  }
}

const prepareEndCalendar = () => {
  if (calendarStartDate.value && !calendarEndDate.value) {
    const d = calendarStartDate.value
    calendarEndDate.value = new CalendarDate(d.year, d.month, d.day)
  }
}

// Gestion de l'adresse
const handleAddressSelected = (address: {
  addressLine1: string
  addressLine2?: string
  postalCode: string
  city: string
  region?: string
  country: string
}) => {
  addressLine1.value = address.addressLine1
  addressLine2.value = address.addressLine2 || ''
  postalCode.value = address.postalCode
  city.value = address.city
  region.value = address.region || ''
  country.value = address.country

  const countryExists = countrySelectOptions.some((option) => option.value === address.country)
  showCustomCountry.value = !countryExists && address.country !== ''
}

const handleCountryChange = (value: any) => {
  if (value === 'Autre') {
    showCustomCountry.value = true
    country.value = ''
  } else if (value && !timezone.value) {
    const defaultTz = getDefaultTimezoneForCountry(value)
    if (defaultTz) {
      timezone.value = defaultTz
    }
  }
}

// Sauvegarde
const { execute: save, loading: saving } = useApiAction(() => `/api/editions/${editionId.value}`, {
  method: 'PUT',
  body: () => ({
    name: name.value?.trim() || null,
    startDate: toApiFormat(startDate.value),
    endDate: toApiFormat(endDate.value),
    timezone: timezone.value || null,
    addressLine1: addressLine1.value?.trim() || '',
    addressLine2: addressLine2.value?.trim() || null,
    postalCode: postalCode.value?.trim() || '',
    city: city.value?.trim() || '',
    region: region.value?.trim() || '',
    country: country.value?.trim() || '',
  }),
  successMessage: { title: t('gestion.general_info.save_success') },
  errorMessages: { default: t('gestion.general_info.save_error') },
  onSuccess: (response: any) => {
    const data = response?.data || response
    if (data) {
      editionStore.setEdition(data)
    }
  },
})

// Charger l'édition
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId.value, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  initialLoading.value = false
})
</script>
