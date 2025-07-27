<template>
  <UForm :state="state" class="space-y-4" @submit="handleSubmit">
    <UStepper v-model="currentStep" :items="steps" class="mb-4">
      <template #general>
        <div class="space-y-6">
          <UFormField label="Nom" name="name" required :error="touchedFields.name && !state.name ? 'Le nom est requis' : undefined">
            <UInput v-model="state.name" required placeholder="Nom de la convention" size="lg" @blur="touchedFields.name = true" class="w-full"/>
          </UFormField>
          <UFormField label="Description" name="description">
            <UTextarea v-model="state.description" placeholder="Description de la convention" :rows="5" class="w-full" />
          </UFormField>
          
          <UFormField label="Affiche de la convention (Optionnel)" name="image">
            <div class="space-y-2">
              <div v-if="state.imageUrl" class="relative">
                <img :src="state.imageUrl" alt="Aperçu" class="w-32 h-32 object-cover rounded-lg" />
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
              />
            </div>
          </UFormField>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <UFormField label="Date de début" name="startDate" required :error="touchedFields.startDate && !state.startDate ? 'La date de début est requise' : undefined">
              <UInput v-model="state.startDate" type="datetime-local" size="lg" @blur="touchedFields.startDate = true" />
            </UFormField>
            <UFormField label="Date de fin" name="endDate" required :error="touchedFields.endDate && !state.endDate ? 'La date de fin est requise' : undefined">
              <UInput v-model="state.endDate" type="datetime-local" required size="lg" @blur="touchedFields.endDate = true" />
            </UFormField>
          </div>

          <UCard>
            <template #header>
              <AddressAutocomplete @address-selected="handleAddressSelected" />
            </template>

            <UFormField label="Adresse Ligne 1" name="addressLine1" required :error="touchedFields.addressStreet && !state.addressLine1 ? 'Adresse requise' : undefined">
              <UInput v-model="state.addressLine1" required placeholder="Adresse principale" size="lg" @blur="touchedFields.addressStreet = true" class="w-full" />
            </UFormField>
            <UFormField label="Adresse Ligne 2" name="addressLine2">
              <UInput v-model="state.addressLine2" placeholder="Complément d'adresse (optionnel)" size="lg" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <UFormField label="Code Postal" name="postalCode" required :error="touchedFields.addressZipCode && !state.postalCode ? 'Le code postal est requis' : undefined" class="md:col-span-1">
                <UInput v-model="state.postalCode" required placeholder="75001" size="lg" @blur="touchedFields.addressZipCode = true" />
              </UFormField>
              <UFormField label="Ville" name="city" required :error="touchedFields.addressCity && !state.city ? 'La ville est requise' : undefined" class="md:col-span-1">
                <UInput v-model="state.city" required placeholder="Paris" size="lg" @blur="touchedFields.addressCity = true" />
              </UFormField>
              <UFormField label="Pays" name="country" required :error="touchedFields.addressCountry && !state.country ? 'Le pays est requis' : undefined" class="md:col-span-1">
                <UInput v-model="state.country" required placeholder="France" size="lg" @blur="touchedFields.addressCountry = true" />
              </UFormField>
            </div>
            
          </UCard>
        </div>
      </template>

      <template #services>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UCheckbox v-model="state.hasFoodTrucks" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-mdi:food-outline" class="text-orange-500" size="20" />
                <span>Food trucks</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasKidsZone" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-face-smile" class="text-pink-500" size="20" />
                <span>Zone enfants</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.acceptsPets" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-material-symbols:pets" class="text-amber-600" size="20" />
                <span>Animaux acceptés</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasTentCamping" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-material-symbols:camping-outline" class="text-green-600" size="20" />
                <span>Camping tente</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasTruckCamping" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-truck" class="text-blue-500" size="20" />
                <span>Camping camion</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasFamilyCamping" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-users" class="text-indigo-500" size="20" />
                <span>Camping famille</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasGym" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-trophy" class="text-purple-500" size="20" />
                <span>Gymnase</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasFireSpace" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-fire" class="text-red-600" size="20" />
                <span>Fire space</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasGala" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-sparkles" class="text-yellow-500" size="20" />
                <span>Gala</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasOpenStage" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-microphone" class="text-cyan-500" size="20" />
                <span>Scène ouverte</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasConcert" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-musical-note" class="text-violet-500" size="20" />
                <span>Concert</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasCantine" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-cake" class="text-amber-500" size="20" />
                <span>Cantine</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasAerialSpace" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-cloud" class="text-sky-500" size="20" />
                <span>Espace aérien</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasSlacklineSpace" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-minus" class="text-teal-500" size="20" />
                <span>Espace slackline</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasToilets" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-guidance:wc" class="text-gray-600" size="20" />
                <span>WC</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasShowers" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-material-symbols-light:shower-outline" class="text-blue-400" size="20" />
                <span>Douches</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasAccessibility" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-bx:handicap" class="text-blue-600" size="20" />
                <span>Accessibilité handicapé</span>
              </div>
            </template>
          </UCheckbox>
          
          <UCheckbox v-model="state.hasWorkshops" indicator="end" variant="card">
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-academic-cap" class="text-slate-600" size="20" />
                <span>Workshops</span>
              </div>
            </template>
          </UCheckbox>
        </div>
      </template>

      <template #ticketing>
        <div class="space-y-6">
          <div class="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
            <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Billetterie</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Informations pour l'achat de billets</p>
            <UFormField label="Lien de la billetterie" name="ticketingUrl">
              <UInput v-model="state.ticketingUrl" type="url" placeholder="https://billetterie.com/ma-convention">
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
                <UInput v-model="state.facebookUrl" type="url" placeholder="https://facebook.com/ma-convention">
                  <template #leading>
                    <UIcon name="i-simple-icons-facebook" class="text-blue-600" />
                  </template>
                </UInput>
              </UFormField>
              <UFormField label="Compte Instagram" name="instagramUrl">
                <UInput v-model="state.instagramUrl" type="url" placeholder="https://instagram.com/ma-convention">
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
import { reactive, ref, watch } from 'vue';
import AddressAutocomplete from './AddressAutocomplete.vue';
import type { StepperItem } from '@nuxt/ui';

const props = defineProps<{
  initialData?: Partial<Convention>;
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
  name: false,
  startDate: false,
  endDate: false,
  addressCountry: false,
  addressCity: false,
  addressStreet: false,
  addressZipCode: false
});

const state = reactive({
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
});

const uploading = ref(false);
const fileInput = ref<HTMLInputElement>();
const toast = useToast();

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
    touchedFields.name = true;
    touchedFields.startDate = true;
    touchedFields.endDate = true;
    touchedFields.addressStreet = true;
    touchedFields.addressZipCode = true;
    touchedFields.addressCity = true;
    touchedFields.addressCountry = true;
    
    // Check if required fields are filled
    if (!state.name || !state.startDate || !state.endDate || 
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
};

const handleSubmit = () => {
  emit('submit', state);
};

// Watch for changes in initialData prop to update the form state (e.g., when editing a different convention)
watch(() => props.initialData, (newVal) => {
  if (newVal) {
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
  }
}, { deep: true });
</script>
