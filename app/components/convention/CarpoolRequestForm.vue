<template>
  <UForm :state="form" :validate="validate" @submit="onSubmit" class="space-y-4">
    <UFormField label="Date et heure souhaitées" name="departureDate" required>
      <UInput
        v-model="form.departureDate"
        type="datetime-local"
        :min="minDate"
      />
    </UFormField>

    <UFormField label="Ville de départ" name="departureCity" required>
      <UInput
        v-model="form.departureCity"
        placeholder="Ex: Paris"
      />
    </UFormField>

    <UFormField label="Nombre de places recherchées" name="seatsNeeded" required>
      <UInput
        v-model.number="form.seatsNeeded"
        type="number"
        min="1"
        max="8"
      />
    </UFormField>

    <UFormField label="Numéro de téléphone" name="phoneNumber">
      <UInput
        v-model="form.phoneNumber"
        type="tel"
        placeholder="Ex: 06 12 34 56 78"
      />
    </UFormField>

    <UFormField label="Description (optionnel)" name="description">
      <UTextarea
        v-model="form.description"
        placeholder="Précisions sur votre demande, flexibilité horaire, etc."
        :rows="3"
      />
    </UFormField>

    <div class="flex gap-2 justify-end pt-4">
      <UButton
        type="submit"
        color="primary"
        :loading="isSubmitting"
      >
        Publier la demande
      </UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

interface Props {
  conventionId: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  success: [];
  cancel: [];
}>();

const toast = useToast();
const isSubmitting = ref(false);

// Date minimum = aujourd'hui
const minDate = new Date().toISOString().slice(0, 16);

const form = reactive({
  departureDate: '',
  departureCity: '',
  seatsNeeded: 1,
  phoneNumber: '',
  description: '',
});

const validate = (state: typeof form) => {
  const errors = [];
  
  if (!state.departureDate) {
    errors.push({ path: 'departureDate', message: 'La date souhaitée est requise' });
  }
  
  if (!state.departureCity) {
    errors.push({ path: 'departureCity', message: 'La ville de départ est requise' });
  }
  
  if (!state.seatsNeeded || state.seatsNeeded < 1) {
    errors.push({ path: 'seatsNeeded', message: 'Le nombre de places doit être au moins 1' });
  }
  
  return errors;
};

const onSubmit = async () => {
  console.log('Formulaire de demande soumis:', form);
  isSubmitting.value = true;
  
  try {
    const authStore = useAuthStore();
    const response = await $fetch(`/api/conventions/${props.conventionId}/carpool-requests`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
      body: form,
    });
    
    console.log('Réponse API demande:', response);
    
    toast.add({
      title: 'Demande publiée',
      description: 'Votre demande de covoiturage a été publiée',
      color: 'green',
    });
    
    // Réinitialiser le formulaire
    Object.assign(form, {
      departureDate: '',
      departureCity: '',
      seatsNeeded: 1,
      phoneNumber: '',
      description: '',
    });
    
    emit('success');
  } catch (error) {
    console.error('Erreur API demande:', error);
    toast.add({
      title: 'Erreur',
      description: 'Impossible de créer la demande de covoiturage',
      color: 'red',
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>