<template>
  <UForm :state="state" class="space-y-4" @submit="handleSubmit">
    <UStepper v-model="currentStep" :items="steps" class="mb-4">
      <template #general>
        <div class="space-y-6">
          <UFormField label="Convention" name="conventionId" required :error="touchedFields.conventionId && !state.conventionId ? 'La convention est requise' : undefined">
            <USelect
              v-model="state.conventionId"
              :items="conventionOptions"
              placeholder="Sélectionnez une convention"
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
          
          <UFormField label="Nom de l'édition (optionnel)" name="name" :error="getNameError()">
            <UInput v-model="state.name" placeholder="Nom de l'édition (ex: EJC 2024)" size="lg" class="w-full" @blur="touchedFields.name = true; trimField('name')" maxlength="200"/>
            <template #help>
              <p class="text-xs text-gray-500">Si aucun nom n'est spécifié, le nom de la convention sera utilisé</p>
            </template>
          </UFormField>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Date de début -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Date et heure de début</h4>
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Date" name="startDate" required :error="getStartDateError()">
                  <UPopover :popper="{ placement: 'bottom-start' }">
                    <UButton 
                      color="neutral" 
                      variant="outline" 
                      icon="i-heroicons-calendar-days"
                      :label="displayStartDate || 'Sélectionner'"
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
                <UFormField label="Heure" name="startTime" required>
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
                <UFormField label="Date" name="endDate" required :error="getEndDateError()">
                  <UPopover :popper="{ placement: 'bottom-start' }">
                    <UButton 
                      color="neutral" 
                      variant="outline" 
                      icon="i-heroicons-calendar-days"
                      :label="displayEndDate || 'Sélectionner'"
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
                <UFormField label="Heure" name="endTime" required>
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
          
          <UFormField label="Affiche de la convention (Optionnel)" name="image">
            <div class="space-y-2">
              <div v-if="state.imageUrl" class="relative">
                <img :src="normalizeImageUrl(state.imageUrl)" alt="Aperçu" class="w-32 h-32 object-cover rounded-lg" >
                <UButton 
                  icon="i-heroicons-x-mark" 
                  color="error" 
                  variant="solid" 
                  size="xs" 
                  class="absolute -top-2 -right-2"
                  @click="state.imageUrl = ''"
                />
              </div>
              <UButton 
                icon="i-heroicons-photo" 
                variant="outline" 
                :loading="uploading"
                @click="triggerFileInput"
              >
                {{ state.imageUrl ? 'Changer l\'image' : 'Ajouter une image' }}
              </UButton>
              <input 
                ref="fileInput" 
                type="file" 
                accept="image/*" 
                class="hidden" 
                @change="handleFileUpload" 
              >
            </div>
          </UFormField>

          <div class="space-y-4">
            <div class="flex items-center gap-2 mb-2">
              <UIcon name="i-heroicons-map-pin" class="text-primary-500" />
              <h4 class="text-lg font-medium text-gray-700 dark:text-gray-300">Adresse du lieu</h4>
            </div>
            
            <UAlert
              icon="i-heroicons-light-bulb"
              color="blue"
              variant="soft"
              title="Conseil"
              description="Saisissez une adresse complète dans le champ de recherche pour préremplir automatiquement tous les champs ci-dessous. Une adresse précise permettra aussi de géolocaliser votre édition sur la carte."
            />
            
            <UCard>
              <template #header>
                <AddressAutocomplete @address-selected="handleAddressSelected" />
              </template>

              <div class="space-y-4">
                <UFormField label="Adresse" name="addressLine1" required :error="touchedFields.addressStreet && !state.addressLine1 ? 'L\'adresse est requise' : undefined">
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
                
                <UFormField label="Complément d'adresse" name="addressLine2">
                  <UInput 
                    v-model="state.addressLine2" 
                    placeholder="Bâtiment A, Salle des fêtes..." 
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
                  <UFormField label="Code postal" name="postalCode" required :error="touchedFields.addressZipCode && !state.postalCode ? 'Requis' : undefined" class="col-span-1">
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
                  
                  <UFormField label="Ville" name="city" required :error="touchedFields.addressCity && !state.city ? 'Requise' : undefined" class="col-span-1 md:col-span-2">
                    <UInput 
                      v-model="state.city" 
                      required 
                      placeholder="Paris" 
                      size="lg" 
                      @blur="touchedFields.addressCity = true; trimField('city')" 
                    />
                  </UFormField>
                  
                  <UFormField label="Pays" name="country" required :error="touchedFields.addressCountry && !state.country ? 'Requis' : undefined" class="col-span-2 md:col-span-1">
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
                          color="gray"
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
                      placeholder="Sélectionner"
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
          
          <UFormField label="Description" name="description" :error="getDescriptionError()">
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
          <div class="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
            <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Billetterie</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Informations pour l'achat de billets</p>
            <UFormField label="Lien de la billetterie" name="ticketingUrl">
              <UInput v-model="state.ticketingUrl" type="url" placeholder="https://billetterie.com/ma-convention" @blur="trimField('ticketingUrl')">
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
          <div class="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
            <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Réseaux sociaux</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">Partagez vos pages pour augmenter la visibilité</p>
            <div class="space-y-4">
              <UFormField label="Page Facebook" name="facebookUrl">
                <UInput v-model="state.facebookUrl" type="url" placeholder="https://facebook.com/ma-convention" @blur="trimField('facebookUrl')">
                  <template #leading>
                    <UIcon name="i-simple-icons-facebook" class="text-blue-600" />
                  </template>
                </UInput>
              </UFormField>
              <UFormField label="Compte Instagram" name="instagramUrl">
                <UInput v-model="state.instagramUrl" type="url" placeholder="https://instagram.com/ma-convention" @blur="trimField('instagramUrl')">
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
      >Précédent</UButton>
      <UButton
        v-if="currentStep < steps.length - 1"
        color="primary"
        variant="solid"
        icon="i-heroicons-arrow-right"
        trailing
        @click="handleNextStep"
      >Suivant</UButton>
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
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date';
import type { StepperItem } from '@nuxt/ui';
import type { Edition, Convention } from '~/types';
import { useAuthStore } from '~/stores/auth';

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

const uploading = ref(false);
const fileInput = ref<HTMLInputElement>();
const toast = useToast();
const { servicesByCategory } = useConventionServices();
const authStore = useAuthStore();
const { normalizeImageUrl } = useImageUrl();
const showCustomCountry = ref(false);

// Date formatter pour l'affichage
const df = new DateFormatter('fr-FR', { dateStyle: 'medium' });

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
  return df.format(calendarStartDate.value.toDate(getLocalTimeZone()));
});

const displayEndDate = computed(() => {
  if (!calendarEndDate.value) return '';
  return df.format(calendarEndDate.value.toDate(getLocalTimeZone()));
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
  
  // Vérifier que la convention n'est pas déjà terminée
  if (endDate <= now) {
    return {
      isValid: false,
      error: 'La convention ne peut pas être déjà terminée. La date de fin doit être dans le futur'
    };
  }
  
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

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;

  // Vérifier la taille du fichier (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast.add({
      title: 'Fichier trop volumineux',
      description: 'La taille maximale autorisée est de 5MB',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error'
    });
    return;
  }

  uploading.value = true;
  
  try {
    const formData = new FormData();
    formData.append('image', file);
    
    // Si on édite une convention existante, ajouter l'ID
    if (props.initialData?.id) {
      formData.append('conventionId', props.initialData.id.toString());
    }

    const response = await $fetch<{ success: boolean; imageUrl: string }>('/api/upload/image', {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${useAuthStore().token}`,
      },
    });

    if (response.success) {
      state.imageUrl = response.imageUrl;
      toast.add({
        title: 'Image uploadée avec succès !',
        icon: 'i-heroicons-check-circle',
        color: 'success'
      });
    }
  } catch (error) {
    toast.add({
      title: 'Erreur lors de l\'upload',
      description: 'Impossible de télécharger l\'image',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error'
    });
  } finally {
    uploading.value = false;
    // Reset file input
    if (target) target.value = '';
  }
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
    const dateTime = new Date(date.year, date.month - 1, date.day, hours, minutes);
    state.startDate = dateTime.toISOString().slice(0, 16);
    touchedFields.startDate = true;
  }
};

const updateEndDate = (date: CalendarDate | null) => {
  if (date && endTime.value) {
    const [hours, minutes] = endTime.value.split(':').map(Number);
    const dateTime = new Date(date.year, date.month - 1, date.day, hours, minutes);
    state.endDate = dateTime.toISOString().slice(0, 16);
    touchedFields.endDate = true;
  }
};

const updateStartDateTime = () => {
  if (calendarStartDate.value && startTime.value) {
    const [hours, minutes] = startTime.value.split(':').map(Number);
    const dateTime = new Date(calendarStartDate.value.year, calendarStartDate.value.month - 1, calendarStartDate.value.day, hours, minutes);
    state.startDate = dateTime.toISOString().slice(0, 16);
  }
};

const updateEndDateTime = () => {
  if (calendarEndDate.value && endTime.value) {
    const [hours, minutes] = endTime.value.split(':').map(Number);
    const dateTime = new Date(calendarEndDate.value.year, calendarEndDate.value.month - 1, calendarEndDate.value.day, hours, minutes);
    state.endDate = dateTime.toISOString().slice(0, 16);
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
