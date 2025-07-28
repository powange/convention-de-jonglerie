<template>
  <UForm :state="form" :validate="validate" class="space-y-4" @submit="handleSubmit">
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
        @blur="trimField('departureCity')"
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
        @blur="trimField('phoneNumber')"
      />
    </UFormField>

    <UFormField label="Description (optionnel)" name="description">
      <UTextarea
        v-model="form.description"
        placeholder="Précisions sur votre demande, flexibilité horaire, etc."
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
        Publier la demande
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

// Utiliser le composable avec la configuration pour les demandes
const { form, isSubmitting, minDate, trimField, validate, onSubmit } = useCarpoolForm({
  type: 'request',
  editionId: props.editionId,
  endpoint: `/api/editions/${props.editionId}/carpool-requests`,
  submitText: 'Publier la demande',
  successTitle: 'Demande publiée',
  successDescription: 'Votre demande de covoiturage a été publiée',
  errorDescription: 'Impossible de créer la demande de covoiturage',
});

const handleSubmit = () => {
  onSubmit(emit);
};
</script>