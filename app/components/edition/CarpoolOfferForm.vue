<template>
  <UForm :state="form" :validate="validate" class="space-y-4" @submit="handleSubmit">
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
        @blur="trimField('departureCity')"
      />
    </UFormField>

    <UFormField label="Adresse de départ" name="departureAddress" required>
      <UInput
        v-model="form.departureAddress"
        placeholder="Ex: Gare de Lyon"
        @blur="trimField('departureAddress')"
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
        @blur="trimField('phoneNumber')"
      />
    </UFormField>

    <UFormField label="Description (optionnel)" name="description">
      <UTextarea
        v-model="form.description"
        placeholder="Informations supplémentaires sur le trajet, points de passage, etc."
        :rows="3"
        @blur="trimField('description')"
      />
    </UFormField>

    <div class="flex gap-2 justify-end pt-4">
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
import { useCarpoolForm } from '~/composables/useCarpoolForm';

interface Props {
  editionId: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  success: [];
  cancel: [];
}>();

// Utiliser le composable avec la configuration pour les offres
const { form, isSubmitting, minDate, trimField, validate, onSubmit } = useCarpoolForm({
  type: 'offer',
  editionId: props.editionId,
  endpoint: `/api/editions/${props.editionId}/carpool-offers`,
  submitText: 'Proposer le covoiturage',
  successTitle: 'Covoiturage proposé',
  successDescription: 'Votre offre de covoiturage a été publiée',
  errorDescription: 'Impossible de créer l\'offre de covoiturage',
});

const handleSubmit = () => {
  onSubmit(emit);
};
</script>