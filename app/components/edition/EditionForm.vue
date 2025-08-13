<template>
  <UForm :state="state" class="space-y-4" @submit="handleSubmit">
    <UStepper v-model="currentStep" :items="steps" class="mb-4">
      <template #general>
        <div class="space-y-6">
          <UFormField :label="$t('common.convention')" name="conventionId" required :error="touchedFields.conventionId && !state.conventionId ? $t('errors.convention_required') : undefined">
            <USelect
              v-model="state.conventionId"
              :items="conventionOptions"
              :placeholder="$t('forms.placeholders.select_convention')"
              size="lg"
              class="w-full"
              :loading="loadingConventions"
              value-key="value"
              @change="touchedFields.conventionId = true"
            >
              <template #option="{ option }">
                <div class="flex items-center gap-3">
                  <div v-if="option.logo" class="flex-shrink-0">
                    <img :src="normalizeImageUrl(option.logo)" :alt="option.label" class="w-6 h-6 object-cover rounded" >
                  </div>
                  <div v-else class="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                    <UIcon name="i-heroicons-building-library" class="text-gray-400" size="14" />
                  </div>
                  <span>{{ option.label }}</span>
                </div>
              </template>
            </USelect>
          </UFormField>
          
          <UFormField :label="$t('forms.labels.edition_name_optional')" name="name" :error="getNameError()">
            <UInput v-model="state.name" :placeholder="$t('forms.placeholders.edition_name_example')" size="lg" class="w-full" @blur="touchedFields.name = true; trimField('name')" maxlength="200"/>
            <template #help>
              <p class="text-xs text-gray-500">Si aucun nom n'est spécifié, le nom de la convention sera utilisé</p>
            </template>
          </UFormField>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Date de début -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Date et heure de début</h4>
              <div class="grid grid-cols-2 gap-3">
                <UFormField :label="$t('common.date')" name="startDate" required :error="getStartDateError()">
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
                    @change="updateStartDateTime"
                  />
                </UFormField>
              </div>
            </div>

            <!-- Date de fin -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Date et heure de fin</h4>
              <div class="grid grid-cols-2 gap-3">
                <UFormField :label="$t('common.date')" name="endDate" required :error="getEndDateError()">
                  <UPopover :popper="{ placement: 'bottom-start' }">
                    <UButton 
                      color="neutral" 
                      variant="outline" 
                      icon="i-heroicons-calendar-days"
                      :label="displayEndDate || $t('common.select')"
                      block
                      size="lg"
                    />
                    <template #content>
                      <UCalendar 
                        v-model="calendarEndDate" 
                        class="p-2"
                        :is-date-disabled="(date) => calendarStartDate && date < calendarStartDate"
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
                    @change="updateEndDateTime"
                  />
                </UFormField>
              </div>
            </div>
          </div>
          
          <UFormField :label="$t('components.edition_form.convention_poster_optional')" name="image">
            <ImageUpload
              v-model="state.imageUrl"
              :endpoint="{ type: 'edition', id: props.initialData?.id }"
              :options="{
                validation: {
                  maxSize: 5 * 1024 * 1024, // 5MB
                  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp']
                }
              }"
              alt="Poster de l'édition"
              placeholder="Cliquez pour sélectionner le poster de l'édition"
              @uploaded="onImageUploaded"
              @deleted="onImageDeleted"
              @error="onImageError"
            />
          </UFormField>

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
              description="Saisissez une adresse complète dans le champ de recherche pour préremplir automatiquement tous les champs ci-dessous. Une adresse précise permettra aussi de géolocaliser votre édition sur la carte."
            />
            
            <UCard>
              <template #header>
                <AddressAutocomplete @address-selected="handleAddressSelected" />
              </template>

              <div class="space-y-4">
                <UFormField :label="$t('common.address')" name="addressLine1" required :error="touchedFields.addressStreet && !state.addressLine1 ? $t('errors.address_required') : undefined">
                  <UInput 
                    v-model="state.addressLine1" 
                    required 
                    placeholder="123 rue de la Jonglerie" 
                    size="lg" 
                    class="w-full" 
                    @blur="touchedFields.addressStreet = true; trimField('addressLine1')"
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
                  <UFormField :label="$t('common.postal_code')" name="postalCode" required :error="touchedFields.addressZipCode && !state.postalCode ? $t('errors.required_field') : undefined" class="col-span-1">
                    <UInput 
                      v-model="state.postalCode" 
                      required 
                      placeholder="75001" 
                      size="lg"
                      pattern="[0-9]{5}"
                      maxlength="5"
                      @blur="touchedFields.addressZipCode = true; trimField('postalCode')" 
                    />
                  </UFormField>
                  
                  <UFormField :label="$t('common.city')" name="city" required :error="touchedFields.addressCity && !state.city ? $t('errors.required_field') : undefined" class="col-span-1 md:col-span-2">
                    <UInput 
                      v-model="state.city" 
                      required 
                      :placeholder="$t('forms.placeholders.city_example')" 
                      size="lg" 
                      @blur="touchedFields.addressCity = true; trimField('city')" 
                    />
                  </UFormField>
                  
                  <UFormField :label="$t('common.country')" name="country" required :error="touchedFields.addressCountry && !state.country ? $t('errors.required_field') : undefined" class="col-span-2 md:col-span-1">
                    <UInput
                      v-if="showCustomCountry"
                      v-model="state.country"
                      required
                      placeholder="Nom du pays"
                      size="lg"
                      @blur="touchedFields.addressCountry = true; trimField('country')"
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
                          @click="showCustomCountry = false; state.country = 'France'"
                        />
                      </template>
                    </UInput>
                    <USelect
                      v-else
                      v-model="state.country"
                      :items="countryOptions"
                      :placeholder="$t('common.select')"
                      size="lg"
                      @change="handleCountryChange"
                    >
                      <template #leading>
                        <UIcon name="i-heroicons-globe-europe-africa" />
                      </template>
                    </USelect>
                  </UFormField>
                </div>
              </div>
            </UCard>
          </div>
          
          <UFormField :label="$t('common.description')" name="description" :error="getDescriptionError()">
            <UTextarea v-model="state.description" placeholder="Description de la convention" :rows="5" class="w-full" @blur="touchedFields.description = true; trimField('description')" maxlength="1000" />
          </UFormField>
        </div>
      </template>

      <template #services>
        <div class="space-y-8">
          <div v-for="category in servicesByCategory" :key="category.category" class="space-y-4">
            <div class="border-b border-gray-200 pb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ category.label }}</h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UCheckbox 
                v-for="service in category.services" 
                :key="service.key"
                v-model="state[service.key]" 
                indicator="end" 
                variant="card"
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

      <template #ticketing>
        <div class="space-y-6">
          <div class="space-y-4">
            <div class="border-b border-gray-200 pb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Billetterie</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Informations pour l'achat de billets</p>
            </div>
            <UFormField :label="$t('components.edition_form.ticketing_link')" name="ticketingUrl">
              <UInput v-model="state.ticketingUrl" type="url" placeholder="https://billetterie.com/ma-convention" class="w-full" @blur="trimField('ticketingUrl')">
                <template #leading>
                  <UIcon name="i-heroicons-ticket" />
                </template>
              </UInput>
            </UFormField>
          </div>
        </div>
      </template>

      <template #visibility>
        <div class="space-y-6">
          <div class="space-y-4">
            <div class="border-b border-gray-200 pb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Réseaux sociaux</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Partagez vos pages pour augmenter la visibilité</p>
            </div>
            <div class="space-y-4">
              <UFormField :label="$t('components.edition_form.facebook_page')" name="facebookUrl">
                <UInput v-model="state.facebookUrl" type="url" placeholder="https://facebook.com/ma-convention" class="w-full" @blur="trimField('facebookUrl')">
                  <template #leading>
                    <UIcon name="i-simple-icons-facebook" class="text-blue-600" />
                  </template>
                </UInput>
              </UFormField>
              <UFormField :label="$t('components.edition_form.instagram_account')" name="instagramUrl">
                <UInput v-model="state.instagramUrl" type="url" placeholder="https://instagram.com/ma-convention" class="w-full" @blur="trimField('instagramUrl')">
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
      >{{ $t('components.edition_form.previous') }}</UButton>
      <UButton
        v-if="currentStep < steps.length - 1"
        color="primary"
        variant="solid"
        icon="i-heroicons-arrow-right"
        trailing
        @click="handleNextStep"
      >{{ $t('components.edition_form.next') }}</UButton>
      <UButton
        v-if="currentStep === steps.length - 1"
        type="submit"
        :loading="loading"
        icon="i-heroicons-check"
      >{{ submitButtonText }}</UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { reactive, ref, watch, computed, onMounted, nextTick } from 'vue';
import AddressAutocomplete from '~/components/AddressAutocomplete.vue';
import ImageUpload from '~/components/ui/ImageUpload.vue';
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date';
import type { StepperItem } from '@nuxt/ui';
import type { Edition, Convention } from '~/types';
import { useAuthStore } from '~/stores/auth';
import { useTranslatedConventionServices } from '~/composables/useConventionServices';

const props = defineProps<{
  initialData?: Partial<Edition>;
  submitButtonText?: string;
  loading?: boolean;
}>();

const emit = defineEmits(['submit']);

const currentStep = ref(0);
const steps = ref<StepperItem[]>([
  { title: 'Informations Générales', description: 'Informations Générales', icon: 'i-heroicons-information-circle', slot: 'general' },
  { title: 'Services Proposés', description: 'Services Disponibles', icon: 'i-heroicons-cog', slot: 'services' },
  { title: 'Billetterie', description: 'Billetterie', icon: 'i-heroicons-ticket', slot: 'ticketing' },
  { title: 'Visibilité (Réseaux Sociaux)', description: 'Réseaux Sociaux', icon: 'i-heroicons-globe-alt', slot: 'visibility' },
]);

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
  addressZipCode: false
});

const state = reactive({
  conventionId: props.initialData?.conventionId || null,
  name: props.initialData?.name || '',
  description: props.initialData?.description || '',
  imageUrl: props.initialData?.imageUrl || '',
  startDate: props.initialData?.startDate ? new Date(props.initialData.startDate).toISOString().slice(0, 16) : '',
  endDate: props.initialData?.endDate ? new Date(props.initialData.endDate).toISOString().slice(0, 16) : '',
  addressLine1: props.initialData?.addressLine1 || '',
  addressLine2: props.initialData?.addressLine2 || '',
  postalCode: props.initialData?.postalCode || '',
  city: props.initialData?.city || '',
  region: props.initialData?.region || '',
  country: props.initialData?.country || '',
  ticketingUrl: props.initialData?.ticketingUrl || '',
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
});

const toast = useToast();
const { getTranslatedServicesByCategory } = useTranslatedConventionServices();
const servicesByCategory = getTranslatedServicesByCategory;
const authStore = useAuthStore();
const { normalizeImageUrl } = useImageUrl();
const showCustomCountry = ref(false);

// Date formatter pour l'affichage
const { locale } = useI18n();
const df = computed(() => {
  const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US';
  return new DateFormatter(localeCode, { dateStyle: 'medium' });
});

// CalendarDate objects pour les sélecteurs de date
const calendarStartDate = ref<CalendarDate | null>(null);
const calendarEndDate = ref<CalendarDate | null>(null);

// Heures séparées
const startTime = ref('09:00');
const endTime = ref('18:00');

// Options de pays les plus courants pour les conventions de jonglerie
const countryOptions = [
  { label: 'France', value: 'France' },
  { label: 'Belgique', value: 'Belgique' },
  { label: 'Suisse', value: 'Suisse' },
  { label: 'Allemagne', value: 'Allemagne' },
  { label: 'Pays-Bas', value: 'Pays-Bas' },
  { label: 'Italie', value: 'Italie' },
  { label: 'Espagne', value: 'Espagne' },
  { label: 'Royaume-Uni', value: 'Royaume-Uni' },
  { label: 'Luxembourg', value: 'Luxembourg' },
  { label: 'Autriche', value: 'Autriche' },
  { label: 'Portugal', value: 'Portugal' },
  { label: 'Pologne', value: 'Pologne' },
  { label: 'République Tchèque', value: 'République Tchèque' },
  { label: 'Canada', value: 'Canada' },
  { label: 'États-Unis', value: 'États-Unis' },
  { label: 'Autre', value: 'Autre' }
];

// Options d'heures (de 00:00 à 23:30 par intervalles de 30 min)
const timeOptions = computed(() => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      options.push({ label: time, value: time });
    }
  }
  return options;
});

// Affichage des dates sélectionnées
const displayStartDate = computed(() => {
  if (!calendarStartDate.value) return '';
  return df.value.format(calendarStartDate.value.toDate(getLocalTimeZone()));
});

const displayEndDate = computed(() => {
  if (!calendarEndDate.value) return '';
  return df.value.format(calendarEndDate.value.toDate(getLocalTimeZone()));
});

// Gestion des conventions
const conventions = ref<Convention[]>([]);
const loadingConventions = ref(true);

// Options pour le sélecteur de convention
const conventionOptions = computed(() => {
  return conventions.value.map(convention => ({
    value: convention.id,
    label: convention.name,
    logo: convention.logo
  }));
});

// Fonction pour charger les conventions de l'utilisateur
const fetchUserConventions = async () => {
  try {
    loadingConventions.value = true;
    
    if (!authStore.token) {
      conventions.value = [];
      return;
    }
    
    const data = await $fetch<Convention[]>('/api/conventions/my-conventions', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });
    
    conventions.value = data || [];
  } catch (error) {
    console.error('Erreur lors du chargement des conventions:', error);
    toast.add({
      title: 'Erreur',
      description: 'Impossible de charger vos conventions',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error'
    });
  } finally {
    loadingConventions.value = false;
  }
};

// Fonctions de validation des dates
const validateDates = () => {
  if (!state.startDate || !state.endDate) return { isValid: true };
  
  const startDate = new Date(state.startDate);
  const endDate = new Date(state.endDate);
  const now = new Date();
  
  // Vérifier que la date de fin est supérieure à la date de début
  if (endDate <= startDate) {
    return {
      isValid: false,
      error: 'La date de fin doit être strictement supérieure à la date de début'
    };
  }
  
  // Permettre les éditions passées pour alimenter l'historique
  // Suppression de la contrainte de date future
  
  return { isValid: true };
};

const dateValidation = computed(() => validateDates());

// Fonctions pour nettoyer les espaces en début/fin des champs texte
const trimField = (fieldName: string) => {
  if (state[fieldName] && typeof state[fieldName] === 'string') {
    state[fieldName] = state[fieldName].trim();
  }
};

const trimAllTextFields = () => {
  trimField('name');
  trimField('description');
  trimField('addressLine1');
  trimField('addressLine2');
  trimField('postalCode');
  trimField('city');
  trimField('region');
  trimField('country');
  trimField('ticketingUrl');
  trimField('facebookUrl');
  trimField('instagramUrl');
};

// Fonctions pour obtenir les erreurs de validation des champs de date
const getStartDateError = () => {
  if (touchedFields.startDate && !state.startDate) {
    return 'La date de début est requise';
  }
  return undefined;
};

const getEndDateError = () => {
  if (touchedFields.endDate && !state.endDate) {
    return 'La date de fin est requise';
  }
  if (touchedFields.endDate && touchedFields.startDate && !dateValidation.value.isValid) {
    return dateValidation.value.error;
  }
  return undefined;
};

const getNameError = () => {
  if (touchedFields.name && state.name) {
    if (state.name.length < 3) {
      return 'Le nom doit contenir au moins 3 caractères';
    }
    if (state.name.length > 200) {
      return 'Le nom ne peut pas dépasser 200 caractères';
    }
  }
  return undefined;
};

const getDescriptionError = () => {
  if (touchedFields.description && state.description && state.description.length > 1000) {
    return 'La description ne peut pas dépasser 1000 caractères';
  }
  return undefined;
};

// Gestionnaires d'événements pour l'upload d'image
const onImageUploaded = (result: { success: boolean; imageUrl?: string }) => {
  if (result.success && result.imageUrl) {
    state.imageUrl = result.imageUrl;
    toast.add({
      title: 'Image uploadée avec succès !',
      icon: 'i-heroicons-check-circle',
      color: 'success'
    });
  }
};

const onImageDeleted = () => {
  state.imageUrl = '';
  toast.add({
    title: 'Image supprimée',
    icon: 'i-heroicons-check-circle',
    color: 'success'
  });
};

const onImageError = (error: string) => {
  toast.add({
    title: 'Erreur d\'upload',
    description: error,
    icon: 'i-heroicons-exclamation-triangle',
    color: 'error'
  });
};

const handleNextStep = () => {
  // Validate current step before moving forward
  if (currentStep.value === 0) {
    // Mark all required fields as touched for validation
    touchedFields.conventionId = true;
    touchedFields.startDate = true;
    touchedFields.endDate = true;
    touchedFields.addressStreet = true;
    touchedFields.addressZipCode = true;
    touchedFields.addressCity = true;
    touchedFields.addressCountry = true;
    
    // Check if required fields are filled (nom n'est plus obligatoire)
    if (!state.conventionId || !state.startDate || !state.endDate || 
        !state.addressLine1 || !state.postalCode || !state.city || !state.country) {
      const toast = useToast();
      toast.add({
        title: 'Formulaire incomplet',
        description: 'Veuillez remplir tous les champs obligatoires',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error'
      });
      return;
    }
    
    // Check date validation
    if (!dateValidation.value.isValid) {
      const toast = useToast();
      toast.add({
        title: 'Dates invalides',
        description: dateValidation.value.error,
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error'
      });
      return;
    }
  }
  
  currentStep.value++;
};

const handleAddressSelected = (address: {
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  region?: string;
  country: string;
}) => {
  state.addressLine1 = address.addressLine1;
  state.addressLine2 = address.addressLine2 || '';
  state.postalCode = address.postalCode;
  state.city = address.city;
  state.region = address.region || '';
  state.country = address.country;
  
  // Vérifier si le pays est dans la liste
  const countryExists = countryOptions.some(option => option.value === address.country);
  showCustomCountry.value = !countryExists && address.country !== '';
};

const handleCountryChange = (value: string) => {
  touchedFields.addressCountry = true;
  if (value === 'Autre') {
    showCustomCountry.value = true;
    state.country = '';
    // Focus sur le champ personnalisé après le prochain tick
    nextTick(() => {
      const input = document.querySelector('input[name="country"]') as HTMLInputElement;
      if (input) input.focus();
    });
  }
};

const handleSubmit = () => {
  // Nettoyer tous les champs texte avant validation finale
  trimAllTextFields();
  
  // Validation finale avant soumission
  if (!dateValidation.value.isValid) {
    const toast = useToast();
    toast.add({
      title: 'Dates invalides',
      description: dateValidation.value.error,
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error'
    });
    return;
  }
  
  emit('submit', state);
};

// Watchers pour marquer les champs de date comme touchés lors des changements
watch(() => state.startDate, () => {
  if (state.startDate) {
    touchedFields.startDate = true;
  }
});

watch(() => state.endDate, () => {
  if (state.endDate) {
    touchedFields.endDate = true;
  }
});

// Charger les conventions au montage du composant
onMounted(() => {
  fetchUserConventions();
  
  // Initialiser les dates et heures si elles existent
  if (state.startDate) {
    const startDateTime = new Date(state.startDate);
    const year = startDateTime.getFullYear();
    const month = startDateTime.getMonth() + 1;
    const day = startDateTime.getDate();
    calendarStartDate.value = new CalendarDate(year, month, day);
    startTime.value = `${startDateTime.getHours().toString().padStart(2, '0')}:${startDateTime.getMinutes().toString().padStart(2, '0')}`;
  }
  
  if (state.endDate) {
    const endDateTime = new Date(state.endDate);
    const year = endDateTime.getFullYear();
    const month = endDateTime.getMonth() + 1;
    const day = endDateTime.getDate();
    calendarEndDate.value = new CalendarDate(year, month, day);
    endTime.value = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`;
  }
});

// Fonctions pour mettre à jour les dates
const updateStartDate = (date: CalendarDate | null) => {
  if (date && startTime.value) {
    const [hours, minutes] = startTime.value.split(':').map(Number);
    // Créer un format datetime-local en évitant les conversions UTC
    const year = date.year.toString().padStart(4, '0');
    const month = date.month.toString().padStart(2, '0');
    const day = date.day.toString().padStart(2, '0');
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    state.startDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}`;
    touchedFields.startDate = true;
  }
};

const updateEndDate = (date: CalendarDate | null) => {
  if (date && endTime.value) {
    const [hours, minutes] = endTime.value.split(':').map(Number);
    // Créer un format datetime-local en évitant les conversions UTC
    const year = date.year.toString().padStart(4, '0');
    const month = date.month.toString().padStart(2, '0');
    const day = date.day.toString().padStart(2, '0');
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    state.endDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}`;
    touchedFields.endDate = true;
  }
};

const updateStartDateTime = () => {
  if (calendarStartDate.value && startTime.value) {
    const [hours, minutes] = startTime.value.split(':').map(Number);
    // Créer un format datetime-local en évitant les conversions UTC
    const year = calendarStartDate.value.year.toString().padStart(4, '0');
    const month = calendarStartDate.value.month.toString().padStart(2, '0');
    const day = calendarStartDate.value.day.toString().padStart(2, '0');
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    state.startDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}`;
  }
};

const updateEndDateTime = () => {
  if (calendarEndDate.value && endTime.value) {
    const [hours, minutes] = endTime.value.split(':').map(Number);
    // Créer un format datetime-local en évitant les conversions UTC
    const year = calendarEndDate.value.year.toString().padStart(4, '0');
    const month = calendarEndDate.value.month.toString().padStart(2, '0');
    const day = calendarEndDate.value.day.toString().padStart(2, '0');
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    state.endDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}`;
  }
};

// Watcher pour s'assurer que conventionId est bien défini après le chargement des conventions
watch([() => conventions.value, () => props.initialData], ([newConventions, newInitialData]) => {
  if (newConventions.length > 0 && newInitialData?.conventionId) {
    // Forcer la mise à jour même si la valeur existe déjà pour synchroniser le USelect
    state.conventionId = newInitialData.conventionId;
  }
}, { immediate: true });

// Watcher spécifique pour réinitialiser la valeur quand les conventions sont chargées
watch(() => conventions.value.length, (newLength) => {
  if (newLength > 0 && props.initialData?.conventionId) {
    // Utiliser nextTick pour s'assurer que le DOM est mis à jour
    nextTick(() => {
      state.conventionId = props.initialData.conventionId;
    });
  }
});

// Watch for changes in initialData prop to update the form state (e.g., when editing a different convention)
watch(() => props.initialData, (newVal) => {
  if (newVal) {
    state.conventionId = newVal.conventionId || null;
    state.name = newVal.name || '';
    state.description = newVal.description || '';
    state.startDate = newVal.startDate ? new Date(newVal.startDate).toISOString().slice(0, 16) : '';
    state.endDate = newVal.endDate ? new Date(newVal.endDate).toISOString().slice(0, 16) : '';
    state.addressLine1 = newVal.addressLine1 || '';
    state.addressLine2 = newVal.addressLine2 || '';
    state.postalCode = newVal.postalCode || '';
    state.city = newVal.city || '';
    state.region = newVal.region || '';
    state.country = newVal.country || '';
    state.ticketingUrl = newVal.ticketingUrl || '';
    state.facebookUrl = newVal.facebookUrl || '';
    state.instagramUrl = newVal.instagramUrl || '';
    state.hasFoodTrucks = newVal.hasFoodTrucks || false;
    state.hasKidsZone = newVal.hasKidsZone || false;
    state.acceptsPets = newVal.acceptsPets || false;
    state.hasTentCamping = newVal.hasTentCamping || false;
    state.hasTruckCamping = newVal.hasTruckCamping || false;
    state.hasFamilyCamping = newVal.hasFamilyCamping || false;
    state.hasGym = newVal.hasGym || false;
    state.hasFireSpace = newVal.hasFireSpace || false;
    state.hasGala = newVal.hasGala || false;
    state.hasOpenStage = newVal.hasOpenStage || false;
    state.hasConcert = newVal.hasConcert || false;
    state.hasCantine = newVal.hasCantine || false;
    state.hasAerialSpace = newVal.hasAerialSpace || false;
    state.hasSlacklineSpace = newVal.hasSlacklineSpace || false;
    state.hasToilets = newVal.hasToilets || false;
    state.hasShowers = newVal.hasShowers || false;
    state.hasAccessibility = newVal.hasAccessibility || false;
    state.hasWorkshops = newVal.hasWorkshops || false;
    state.hasCreditCardPayment = newVal.hasCreditCardPayment || false;
    state.hasAfjTokenPayment = newVal.hasAfjTokenPayment || false;
  }
}, { deep: true });
</script>
