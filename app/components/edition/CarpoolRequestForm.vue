<template>
  <UForm :state="form" :validate="validate" class="space-y-4" @submit="handleSubmit">
    <!-- En-tête explicatif -->
    <div class="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-start gap-3">
        <UIcon name="i-heroicons-magnifying-glass" class="text-green-600 dark:text-green-400 mt-0.5" size="20" />
        <div>
          <p class="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
            Recherchez un trajet vers la convention
          </p>
          <p class="text-xs text-green-700 dark:text-green-300">
            Indiquez vos besoins de transport et d'autres jongleurs pourront vous proposer une place.
          </p>
        </div>
      </div>
    </div>

    <!-- Date et heure avec calendrier et select -->
    <div>
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quand souhaitez-vous partir ?</h3>
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
    <UFormField label="D'où partez-vous ?" name="departureCity" required>
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
      <template #help>
        <p class="text-xs text-gray-500">Indiquez la ville de départ souhaitée</p>
      </template>
    </UFormField>

    <!-- Nombre de places avec sélecteur visuel -->
    <UFormField label="Combien de places recherchez-vous ?" name="seatsNeeded" required>
      <div class="flex gap-2">
        <UButton
          v-for="n in 8"
          :key="n"
          :color="form.seatsNeeded === n ? 'primary' : 'neutral'"
          :variant="form.seatsNeeded === n ? 'solid' : 'outline'"
          size="sm"
          @click="form.seatsNeeded = n"
        >
          <UIcon name="i-heroicons-user" />
          {{ n }}
        </UButton>
      </div>
      <p class="text-xs text-gray-500 mt-1">Sélectionnez le nombre de personnes</p>
    </UFormField>

    <!-- Contact avec indication optionnel -->
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
        <UIcon name="i-heroicons-information-circle" size="16" class="inline mr-1" />
        Optionnel - Facilite les échanges directs
      </p>
    </UFormField>

    <!-- Description avec suggestions -->
    <UFormField label="Informations complémentaires" name="description">
      <UTextarea
        v-model="form.description"
        placeholder="Ex: Je suis flexible sur l'horaire, je peux partir le vendredi soir ou samedi matin. Je voyage léger avec juste un sac à dos."
        :rows="4"
        size="lg"
        class="w-full"
        @blur="trimField('description')"
      />
      <template #help>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="text-xs text-gray-500">Suggestions :</span>
          <UBadge
            v-for="suggestion in ['Flexible sur horaires', 'Participation aux frais', 'Bagages légers', 'Non-fumeur']"
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
        icon="i-heroicons-paper-airplane"
      >
        {{ isSubmitting ? (isEditing ? 'Modification...' : 'Publication...') : (isEditing ? 'Modifier la demande' : 'Publier la demande') }}
      </UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { useCarpoolForm } from '~/composables/useCarpoolForm';
import DateTimePicker from '~/components/ui/DateTimePicker.vue';

interface Props {
  editionId: number;
  initialData?: any;
  isEditing?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  success: [];
  cancel: [];
}>();

// Variable pour vérifier le mode d'édition
const isEditing = computed(() => props.isEditing || false);

// Utiliser le composable avec la configuration pour les demandes
const { form, isSubmitting, trimField, validate, onSubmit } = useCarpoolForm({
  type: 'request',
  editionId: props.editionId,
  endpoint: props.isEditing 
    ? `/api/carpool-requests/${props.initialData?.id}` 
    : `/api/editions/${props.editionId}/carpool-requests`,
  method: props.isEditing ? 'PUT' : 'POST',
  submitText: props.isEditing ? 'Modifier la demande' : 'Publier la demande',
  successTitle: props.isEditing ? 'Demande modifiée' : 'Demande publiée',
  successDescription: props.isEditing ? 'Votre demande a été modifiée avec succès' : 'Votre demande de covoiturage a été publiée',
  errorDescription: props.isEditing ? 'Impossible de modifier la demande' : 'Impossible de créer la demande de covoiturage',
  initialData: props.initialData,
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