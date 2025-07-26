<template>
  <UForm :state="form" :validate="validate" @submit="onSubmit" class="space-y-4">
    <UFormField label="Date et heure de départ" name="departureDate" required>
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

    <UFormField label="Adresse de départ" name="departureAddress" required>
      <UInput
        v-model="form.departureAddress"
        placeholder="Ex: Gare de Lyon"
      />
    </UFormField>

    <UFormField label="Nombre de places disponibles" name="availableSeats" required>
      <UInput
        v-model.number="form.availableSeats"
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
        placeholder="Informations supplémentaires sur le trajet, points de passage, etc."
        :rows="3"
      />
    </UFormField>

    <div class="flex gap-2 justify-end pt-4">
      <UButton
        color="gray"
        variant="ghost"
        @click="$emit('cancel')"
      >
        Annuler
      </UButton>
      <UButton
        type="submit"
        color="primary"
        :loading="isSubmitting"
      >
        Proposer le covoiturage
      </UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
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
  departureAddress: '',
  availableSeats: 1,
  phoneNumber: '',
  description: '',
});

const validate = (state: typeof form) => {
  const errors = [];
  
  if (!state.departureDate) {
    errors.push({ path: 'departureDate', message: 'La date de départ est requise' });
  }
  
  if (!state.departureCity) {
    errors.push({ path: 'departureCity', message: 'La ville de départ est requise' });
  }
  
  if (!state.departureAddress) {
    errors.push({ path: 'departureAddress', message: 'L\'adresse de départ est requise' });
  }
  
  if (!state.availableSeats || state.availableSeats < 1) {
    errors.push({ path: 'availableSeats', message: 'Le nombre de places doit être au moins 1' });
  }
  
  return errors;
};

const onSubmit = async () => {
  isSubmitting.value = true;
  
  try {
    await $fetch(`/api/conventions/${props.conventionId}/carpool-offers`, {
      method: 'POST',
      body: form,
    });
    
    toast.add({
      title: 'Covoiturage proposé',
      description: 'Votre offre de covoiturage a été publiée',
      color: 'green',
    });
    
    emit('success');
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de créer l\'offre de covoiturage',
      color: 'red',
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>