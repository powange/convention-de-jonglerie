<template>
  <UForm :state="form" :validate="validate" class="space-y-4" @submit="handleSubmit">
    <!-- En-tête explicatif -->
    <div class="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-start gap-3">
        <UIcon name="i-heroicons-hand-raised" class="text-green-600 dark:text-green-400 mt-0.5" size="20" />
        <div>
          <p class="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
            Proposez des places dans votre véhicule
          </p>
          <p class="text-xs text-green-700 dark:text-green-300">
            Partagez votre trajet avec d'autres jongleurs et réduisez vos frais de transport.
          </p>
        </div>
      </div>
    </div>

    <!-- Date et heure avec calendrier et select -->
    <div>
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Date et heure de départ</h3>
      <DateTimePicker
        v-model="form.departureDate"
        date-label="Date"
        time-label="Heure"
        date-field-name="departureDate"
        time-field-name="departureTime"
        placeholder="Sélectionner une date"
        time-placeholder="00:00"
        :min-date="new Date()"
        required
      />
    </div>

    <!-- Ville de départ avec icône -->
    <UFormField label="Ville de départ" name="departureCity" required>
      <UInput
        v-model="form.departureCity"
        placeholder="Ex: Paris, Lyon, Marseille..."
        size="lg"
        class="w-full"
        @blur="trimField('departureCity')"
      >
        <template #leading>
          <UIcon name="i-heroicons-map-pin" />
        </template>
      </UInput>
    </UFormField>

    <!-- Adresse précise avec icône -->
    <UFormField label="Lieu de rendez-vous" name="departureAddress" required>
      <UInput
        v-model="form.departureAddress"
        placeholder="Ex: Gare de Lyon, Place de la République, Péage A6..."
        size="lg"
        class="w-full"
        @blur="trimField('departureAddress')"
      >
        <template #leading>
          <UIcon name="i-heroicons-building-office-2" />
        </template>
      </UInput>
      <template #help>
        <p class="text-xs text-gray-500">Précisez le lieu exact pour faciliter le rendez-vous</p>
      </template>
    </UFormField>

    <!-- Nombre de places avec sélecteur visuel -->
    <UFormField label="Nombre de places disponibles" name="availableSeats" required>
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="n in 8"
            :key="n"
            :color="form.availableSeats === n ? 'primary' : 'neutral'"
            :variant="form.availableSeats === n ? 'solid' : 'outline'"
            size="sm"
            @click="form.availableSeats = n"
          >
            <UIcon name="i-heroicons-user" />
            {{ n }}
          </UButton>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <UIcon name="i-heroicons-information-circle" size="16" />
          <span>Ne comptez pas le conducteur dans les places disponibles</span>
        </div>
      </div>
    </UFormField>

    <!-- Contact avec indication recommandé -->
    <UFormField label="Votre numéro de téléphone" name="phoneNumber">
      <div class="relative">
        <UIcon name="i-heroicons-phone" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size="20" />
        <UInput
          v-model="form.phoneNumber"
          type="tel"
          placeholder="Ex: 06 12 34 56 78"
          class="pl-10"
          @blur="trimField('phoneNumber')"
        />
      </div>
      <p class="text-xs text-gray-500 mt-1">
        <UIcon name="i-heroicons-shield-check" size="16" class="inline mr-1" />
        Recommandé pour faciliter l'organisation du trajet
      </p>
    </UFormField>

    <!-- Description avec suggestions -->
    <UFormField label="Informations sur votre trajet" name="description">
      <UTextarea
        v-model="form.description"
        placeholder="Ex: Je pars de la porte d'Orléans, possibilité de récupérer sur l'A6. Véhicule non-fumeur. De la place pour du matériel de jonglage."
        :rows="4"
        size="lg"
        class="w-full"
        @blur="trimField('description')"
      />
      <template #help>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="text-xs text-gray-500">Suggestions :</span>
          <UBadge
            v-for="suggestion in ['Véhicule non-fumeur', 'Place pour matériel', 'Musique OK', 'Pauses régulières', 'Participation essence']"
            :key="suggestion"
            color="neutral"
            variant="soft"
            size="xs"
            class="cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
            @click="addSuggestion(suggestion)"
          >
            {{ suggestion }}
          </UBadge>
        </div>
      </template>
    </UFormField>

    <!-- Boutons d'action avec annuler -->
    <div class="flex gap-2 justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
      <UButton
        color="neutral"
        variant="ghost"
        @click="emit('cancel')"
      >
        Annuler
      </UButton>
      <UButton
        type="submit"
        color="primary"
        :loading="isSubmitting"
        icon="i-heroicons-truck"
      >
        {{ isSubmitting ? 'Publication...' : 'Publier l\'offre' }}
      </UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { useCarpoolForm } from '~/composables/useCarpoolForm';
import DateTimePicker from '~/components/ui/DateTimePicker.vue';

interface Props {
  editionId: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  success: [];
  cancel: [];
}>();

// Utiliser le composable avec la configuration pour les offres
const { form, isSubmitting, trimField, validate, onSubmit } = useCarpoolForm({
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

// Fonction pour ajouter une suggestion dans la description
const addSuggestion = (suggestion: string) => {
  if (form.description) {
    form.description += `, ${suggestion}`;
  } else {
    form.description = suggestion;
  }
};
</script>