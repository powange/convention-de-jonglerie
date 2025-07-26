<template>
  <UForm :state="state" class="space-y-4" @submit="handleSubmit">
    <UStepper v-model="currentStep" :items="steps" class="mb-4">
      <template #general>
        <div class="space-y-4">
          <UFormField label="Nom" name="name" :error="!state.name && currentStep === 0 ? 'Le nom est requis' : undefined">
            <UInput v-model="state.name" required placeholder="Nom de la convention" />
          </UFormField>
          <UFormField label="Description" name="description">
            <UTextarea v-model="state.description" placeholder="Description de la convention" />
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
          
          <UFormField label="Date de début" name="startDate" :error="!state.startDate && currentStep === 0 ? 'La date de début est requise' : undefined">
            <UInput v-model="state.startDate" type="datetime-local" />
          </UFormField>
          <UFormField label="Date de fin" name="endDate" :error="!state.endDate && currentStep === 0 ? 'La date de fin est requise' : undefined">
            <UInput v-model="state.endDate" type="datetime-local" required />
          </UFormField>
          
          <AddressAutocomplete @address-selected="handleAddressSelected" />

          <UFormField label="Adresse Ligne 1" name="addressLine1" :error="!state.addressLine1 && currentStep === 0 ? 'Adresse requise' : undefined">
            <UInput v-model="state.addressLine1" required />
          </UFormField>
          <UFormField label="Adresse Ligne 2 (Optionnel)" name="addressLine2">
            <UInput v-model="state.addressLine2" />
          </UFormField>
          <UFormField label="Code Postal" name="postalCode" :error="!state.postalCode && currentStep === 0 ? 'Le code postal est requis' : undefined">
            <UInput v-model="state.postalCode" required />
          </UFormField>
          <UFormField label="Ville" name="city" :error="!state.city && currentStep === 0 ? 'La ville est requise' : undefined">
            <UInput v-model="state.city" required />
          </UFormField>
          <UFormField label="Pays" name="country" :error="!state.country && currentStep === 0 ? 'Le pays est requis' : undefined">
            <UInput v-model="state.country" required />
          </UFormField>
        </div>
      </template>

      <template #services>
        <div class="flex flex-col space-y-2">
          <UCheckbox v-model="state.hasFastfood" label="Fastfood" indicator="end" variant="card" />
          <UCheckbox v-model="state.hasKidsZone" label="Zone enfant" indicator="end" variant="card" />
          <UCheckbox v-model="state.acceptsPets" label="Animaux de compagnie acceptés" indicator="end" variant="card" />
          <UCheckbox v-model="state.hasTentCamping" label="Camping tente" indicator="end" variant="card" />
          <UCheckbox v-model="state.hasTruckCamping" label="Camping camion" indicator="end" variant="card" />
          <UCheckbox v-model="state.hasGym" label="Gymnase" indicator="end" variant="card" />
        </div>
      </template>

      <template #ticketing>
        <UFormField label="URL Billetterie (Optionnel)" name="ticketingUrl">
          <UInput v-model="state.ticketingUrl" type="url" placeholder="https://billetterie.com/ma-convention" />
        </UFormField>
      </template>

      <template #visibility>
        <div class="space-y-4">
          <UFormField label="URL Facebook (Optionnel)" name="facebookUrl">
            <UInput v-model="state.facebookUrl" type="url" placeholder="https://facebook.com/ma-convention" />
          </UFormField>
          <UFormField label="URL Instagram (Optionnel)" name="instagramUrl">
            <UInput v-model="state.instagramUrl" type="url" placeholder="https://instagram.com/ma-convention" />
          </UFormField>
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
        @click="currentStep++"
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
  hasFastfood: props.initialData?.hasFastfood || false,
  hasKidsZone: props.initialData?.hasKidsZone || false,
  acceptsPets: props.initialData?.acceptsPets || false,
  hasTentCamping: props.initialData?.hasTentCamping || false,
  hasTruckCamping: props.initialData?.hasTruckCamping || false,
  hasGym: props.initialData?.hasGym || false,
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
    state.hasFastfood = newVal.hasFastfood || false;
    state.hasKidsZone = newVal.hasKidsZone || false;
    state.acceptsPets = newVal.acceptsPets || false;
    state.hasTentCamping = newVal.hasTentCamping || false;
    state.hasTruckCamping = newVal.hasTruckCamping || false;
    state.hasGym = newVal.hasGym || false;
  }
}, { deep: true });
</script>
