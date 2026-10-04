<template>
  <div ref="formulaire">
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
      <UiAccesRefuse />
    </div>

    <!-- Contenu principal -->
    <div v-else class="space-y-6">
      <!-- En-tête -->
      <div>
        <ManagementPageHeader
          :titre="$t('gestion.general_info.title')"
          :description="$t('gestion.general_info.description')"
        />
      </div>

      <!-- Formulaire -->
      <div class="space-y-6">
        <!-- Nom de l'édition -->
        <UFormField
          :label="$t('forms.labels.edition_name_optional')"
          name="name"
          :description="$t('gestion.general_info.name_fallback_hint')"
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
                      :week-starts-on="debutDeSemaine"
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
            <!-- Le fuseau dans lequel ces heures sont lues ET enregistrées. L'ambiguïté faisait
                 autant de dégâts que la conversion : rien ne disait à l'organisateur si « 9 h »
                 désignait son heure ou celle du lieu. -->
            <p v-if="timezone" class="text-xs text-gray-500 dark:text-gray-400">
              {{ $t('components.edition_form.dates_timezone', { timezone }) }}
            </p>
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
                      :week-starts-on="debutDeSemaine"
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
          <TimezoneSelectMenu v-model="timezone" />
        </UFormField>

        <!-- Devise : vaut pour tous les montants de l'édition (artistes, billetterie,
             trésorerie), d'où sa place ici avec les réglages généraux plutôt que dans un
             module particulier. -->
        <UFormField
          :label="$t('common.currency')"
          name="currency"
          :description="$t('components.edition_form.currency_description')"
        >
          <USelectMenu
            v-model="currency"
            value-key="value"
            :items="currencyItems"
            class="w-full sm:w-64"
            :search-input="{ placeholder: $t('common.search') }"
          />
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
                    <template #default>
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

    <!-- Prévient avant de quitter la page avec une saisie non enregistrée. Sans cela, un clic
         dans la barre latérale effaçait le formulaire sans un mot. -->
    <UiConfirmationDemandee :confirmation="confirmation" />
  </div>
</template>

<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'

import { useDatetime } from '~/composables/useDatetime'
import { useTimezones } from '~/composables/useTimezones'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { countrySelectOptions } from '~/utils/countries'
import { ancrerHorloge, horlogeMurale, relireHorloge } from '~/utils/horloge-edition'

import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '~~/shared/utils/money'
import { premierJourDeSemaine } from '~~/shared/utils/semaine'

// La semaine commence le lundi en France, le dimanche ailleurs : la valeur suit la langue de qui
// regarde plutôt que d'être figée. Sans elle, `UCalendar` démarre toujours le dimanche.
const { locale: localeDeSemaine } = useI18n()
const debutDeSemaine = computed(() => premierJourDeSemaine(localeDeSemaine.value))

definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const { locale, t } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { toApiFormat, fromApiFormat } = useDatetime()
const { getDefaultTimezoneForCountry } = useTimezones()

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
const currency = ref<string>(DEFAULT_CURRENCY)

/** Code ISO et nom localisé : « EUR — euro » se choisit plus sûrement que « EUR » seul. */
const currencyItems = computed(() =>
  SUPPORTED_CURRENCIES.map((code) => ({
    value: code,
    label: `${code} — ${new Intl.DisplayNames([locale.value], { type: 'currency' }).of(code) ?? code}`,
  }))
)
const addressLine1 = ref('')
const addressLine2 = ref('')
const postalCode = ref('')
const city = ref('')
const region = ref('')
const country = ref('')
const showCustomCountry = ref(false)

// Date formatter
const df = computed(() => {
  const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US'
  return new DateFormatter(localeCode, { dateStyle: 'medium' })
})

// CalendarDate objects pour les sélecteurs de date
// `shallowRef` : `CalendarDate` est une classe, et la réactivité profonde de Vue la recopie
// en objet plat — elle y perd ses champs privés, si bien que le calendrier de Nuxt UI ne
// reconnaît plus sa propre valeur. Rien ici n'observe l'intérieur d'une date.
const calendarStartDate = shallowRef<CalendarDate | null>(null)
const calendarEndDate = shallowRef<CalendarDate | null>(null)

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
/**
 * Les dates de l'édition sont des heures de LIEU : voir `~/utils/horloge-edition` pour le défaut
 * qu'elles portaient et la raison de l'extraction.
 *
 * ⚠️ DÉFINI AVANT LE WATCHER CI-DESSOUS, et ce n'est pas une question de style : ce watcher porte
 * `{ immediate: true }`, donc son rappel s'exécute PENDANT le `setup`, à la ligne du `watch`
 * lui-même. Une `const` déclarée plus bas serait dans sa zone morte : le `setup` lèverait, et
 * l'écran serait BLANC sans qu'aucun test ni le typage le voient. Ce dépôt a déjà payé exactement
 * cela sur un computed.
 */
const ancrerSurLEdition = (mur: string | null) => ancrerHorloge(mur, timezone.value)

const reporterHorloge = (
  instant: Date | null,
  calendrier: typeof calendarStartDate,
  heure: typeof startTime
) => {
  const relu = relireHorloge(instant, timezone.value)
  if (!relu) return
  calendrier.value = new CalendarDate(relu.jour.year, relu.jour.month, relu.jour.day)
  heure.value = relu.heure
}

const initialisationTerminee = ref(false)

watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      name.value = newEdition.name || ''
      timezone.value = newEdition.timezone || null
      currency.value = newEdition.currency || DEFAULT_CURRENCY
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

      // `timezone.value` est posé plus haut dans ce même bloc : les deux reports lisent donc
      // l'instant dans le fuseau de l'édition, et non dans celui du navigateur. Avec `getHours()`,
      // ouvrir cet écran depuis un autre pays affichait une autre heure que celle saisie — et un
      // simple enregistrement la gravait.
      reporterHorloge(parsedStart, calendarStartDate, startTime)
      reporterHorloge(parsedEnd, calendarEndDate, endTime)
      initialisationTerminee.value = true
    }
  },
  { immediate: true }
)

// Fonctions de mise à jour des dates
const updateStartDate = (date: CalendarDate | null) => {
  if (date) {
    startDate.value = ancrerSurLEdition(horlogeMurale(date, startTime.value || '09:00'))
  }
}

const updateEndDate = (date: CalendarDate | null) => {
  if (date) {
    endDate.value = ancrerSurLEdition(horlogeMurale(date, endTime.value || '18:00'))
  }
}

const updateStartDateTime = () => {
  if (calendarStartDate.value && startTime.value) {
    startDate.value = ancrerSurLEdition(horlogeMurale(calendarStartDate.value, startTime.value))
  }
}

const updateEndDateTime = () => {
  if (calendarEndDate.value && endTime.value) {
    endDate.value = ancrerSurLEdition(horlogeMurale(calendarEndDate.value, endTime.value))
  }
}

/*
 * Changer le fuseau RÉANCRE l'heure saisie, il ne la déplace pas — même raison que dans le
 * formulaire de création : « 9 h » corrigé de Paris à Montréal veut dire 9 h à Montréal, donc
 * c'est l'instant qui bouge, pas le chiffre affiché.
 */
watch(timezone, () => {
  if (!initialisationTerminee.value) return
  if (calendarStartDate.value) updateStartDateTime()
  if (calendarEndDate.value) updateEndDateTime()
})

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
    currency: currency.value,
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
    if (response && edition.value) {
      editionStore.setEdition({ ...edition.value, ...response })
    }
    // Ce qui est enregistré n'est plus à perdre.
    marquerEnregistre()
  },
})

/*
 * La saisie ne se perd plus en silence.
 *
 * Mesuré avant d'être corrigé : un champ rempli, un clic dans la barre latérale, un retour — et le
 * champ était vide, sans qu'aucune boîte ne se soit affichée.
 */
const formulaire = useTemplateRef<HTMLElement>('formulaire')
const { marquerEnregistre, confirmation } = useSaisieNonEnregistree(formulaire)

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
