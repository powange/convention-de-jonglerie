<template>
  <UForm :state="form" :validate="validate" class="space-y-4" @submit="handleSubmit">
    <!-- En-tête explicatif -->
    <div class="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-start gap-3">
        <UIcon name="i-heroicons-hand-raised" class="text-green-600 dark:text-green-400 mt-0.5" size="20" />
        <div>
          <p class="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
            {{ $t('components.carpool.offer_vehicle_places') }}
          </p>
          <p class="text-xs text-green-700 dark:text-green-300">
            {{ $t('components.carpool.share_journey') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Date et heure avec calendrier et select -->
    <div>
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ $t('components.carpool.departure_date_time') }}</h3>
      <DateTimePicker
        v-model="form.departureDate"
        :date-label="$t('common.date')"
        :time-label="$t('common.time')"
        date-field-name="departureDate"
        time-field-name="departureTime"
        :placeholder="$t('forms.placeholders.select_date')"
        time-placeholder="00:00"
        :min-date="new Date()"
        required
      />
    </div>

    <!-- Ville de départ avec icône -->
    <UFormField :label="$t('forms.labels.departure_city')" name="departureCity" required>
      <UInput
        v-model="form.departureCity"
        :placeholder="$t('forms.placeholders.departure_city')"
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
    <UFormField :label="$t('components.carpool.meeting_location')" name="departureAddress" required>
      <UInput
        v-model="form.departureAddress"
        :placeholder="$t('forms.placeholders.departure_details')"
        size="lg"
        class="w-full"
        @blur="trimField('departureAddress')"
      >
        <template #leading>
          <UIcon name="i-heroicons-building-office-2" />
        </template>
      </UInput>
      <template #help>
        <p class="text-xs text-gray-500">{{ $t('components.carpool.specify_exact_location') }}</p>
      </template>
    </UFormField>

    <!-- Nombre de places avec sélecteur visuel -->
    <UFormField :label="$t('components.carpool.available_seats')" name="availableSeats" required>
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
          <span>{{ $t('components.carpool.driver_not_counted') }}</span>
        </div>
      </div>
    </UFormField>

    <!-- Contact avec indication recommandé -->
    <UFormField :label="$t('forms.labels.phone_number')" name="phoneNumber">
      <div class="relative">
        <UIcon name="i-heroicons-phone" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size="20" />
        <UInput
          v-model="form.phoneNumber"
          type="tel"
          :placeholder="$t('forms.placeholders.phone_example')"
          class="pl-10"
          @blur="trimField('phoneNumber')"
        />
      </div>
      <p class="text-xs text-gray-500 mt-1">
        <UIcon name="i-heroicons-shield-check" size="16" class="inline mr-1" />
        {{ $t('components.carpool.recommended_for_organization') }}
      </p>
    </UFormField>

    <!-- Description avec suggestions -->
    <UFormField :label="$t('components.carpool.journey_info')" name="description">
      <UTextarea
        v-model="form.description"
        :placeholder="$t('forms.placeholders.carpool_offer_details')"
        :rows="4"
        size="lg"
        class="w-full"
        @blur="trimField('description')"
      />
      <template #help>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="text-xs text-gray-500">{{ $t('components.carpool.suggestions') }} :</span>
          <UBadge
            v-for="suggestion in [$t('components.carpool.non_smoker_vehicle'), $t('components.carpool.space_for_equipment'), $t('components.carpool.music_ok'), $t('components.carpool.regular_breaks'), $t('components.carpool.fuel_contribution')]"
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
        {{ $t('forms.buttons.cancel') }}
      </UButton>
      <UButton
        type="submit"
        color="primary"
        :loading="isSubmitting"
        icon="i-heroicons-truck"
      >
        {{ isSubmitting ? (isEditing ? $t('forms.buttons.updating') : $t('forms.buttons.publishing')) : (isEditing ? $t('components.carpool.modify_offer') : $t('components.carpool.publish_offer')) }}
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

const { t } = useI18n();

// Utiliser le composable avec la configuration pour les offres
const { form, isSubmitting, trimField, validate, onSubmit } = useCarpoolForm({
  type: 'offer',
  editionId: props.editionId,
  endpoint: props.isEditing 
    ? `/api/carpool-offers/${props.initialData?.id}` 
    : `/api/editions/${props.editionId}/carpool-offers`,
  method: props.isEditing ? 'PUT' : 'POST',
  submitText: props.isEditing ? t('components.carpool.modify_offer') : t('components.carpool.propose_carpool'),
  successTitle: props.isEditing ? t('messages.offer_updated') : t('messages.carpool_proposed'),
  successDescription: props.isEditing ? t('messages.offer_updated_successfully') : t('messages.carpool_offer_published'),
  errorDescription: props.isEditing ? t('errors.cannot_update_offer') : t('errors.cannot_create_carpool_offer'),
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