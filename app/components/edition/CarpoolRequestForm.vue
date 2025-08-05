<template>
  <UForm :state="form" :validate="validate" class="space-y-4" @submit="handleSubmit">
    <!-- En-tête explicatif -->
    <div class="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-start gap-3">
        <UIcon name="i-heroicons-magnifying-glass" class="text-green-600 dark:text-green-400 mt-0.5" size="20" />
        <div>
          <p class="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
            {{ $t('components.carpool.search_journey') }}
          </p>
          <p class="text-xs text-green-700 dark:text-green-300">
            {{ $t('components.carpool.indicate_transport_needs') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Date et heure avec calendrier et select -->
    <div>
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ $t('components.carpool.when_depart') }}</h3>
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
    <UFormField :label="$t('forms.labels.departure_location')" name="departureCity" required>
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
      <template #help>
        <p class="text-xs text-gray-500">{{ $t('components.carpool.specify_departure_city') }}</p>
      </template>
    </UFormField>

    <!-- Nombre de places avec sélecteur visuel -->
    <UFormField :label="$t('components.carpool.how_many_seats_needed')" name="seatsNeeded" required>
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
      <p class="text-xs text-gray-500 mt-1">{{ $t('components.carpool.select_number_people') }}</p>
    </UFormField>

    <!-- Contact avec indication optionnel -->
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
        <UIcon name="i-heroicons-information-circle" size="16" class="inline mr-1" />
        {{ $t('components.carpool.optional_facilitates_exchanges') }}
      </p>
    </UFormField>

    <!-- Description avec suggestions -->
    <UFormField :label="$t('forms.labels.additional_info')" name="description">
      <UTextarea
        v-model="form.description"
        :placeholder="$t('forms.placeholders.carpool_request_details')"
        :rows="4"
        size="lg"
        class="w-full"
        @blur="trimField('description')"
      />
      <template #help>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="text-xs text-gray-500">{{ $t('components.carpool.suggestions') }} :</span>
          <UBadge
            v-for="suggestion in [$t('components.carpool.flexible_schedule'), $t('components.carpool.cost_sharing'), $t('components.carpool.light_luggage'), $t('components.carpool.non_smoker')]"
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
        icon="i-heroicons-paper-airplane"
      >
        {{ isSubmitting ? (isEditing ? $t('forms.buttons.updating') : $t('forms.buttons.publishing')) : (isEditing ? $t('components.carpool.modify_request') : $t('components.carpool.publish_request')) }}
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

// Utiliser le composable avec la configuration pour les demandes
const { form, isSubmitting, trimField, validate, onSubmit } = useCarpoolForm({
  type: 'request',
  editionId: props.editionId,
  endpoint: props.isEditing 
    ? `/api/carpool-requests/${props.initialData?.id}` 
    : `/api/editions/${props.editionId}/carpool-requests`,
  method: props.isEditing ? 'PUT' : 'POST',
  submitText: props.isEditing ? t('components.carpool.modify_request') : t('components.carpool.publish_request'),
  successTitle: props.isEditing ? t('messages.request_updated') : t('messages.request_published'),
  successDescription: props.isEditing ? t('messages.request_updated_successfully') : t('messages.carpool_request_published'),
  errorDescription: props.isEditing ? t('errors.cannot_update_request') : t('errors.cannot_create_carpool_request'),
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