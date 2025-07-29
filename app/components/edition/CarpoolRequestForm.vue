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
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <UFormField label="Date" name="departureDate" required class="w-full">
          <UPopover :popper="{ placement: 'bottom-start' }" class="w-full">
            <UButton 
              icon="i-heroicons-calendar-days" 
              size="lg" 
              color="neutral" 
              variant="outline"
              class="w-full justify-start text-left font-normal"
              :label="calendarDate ? formatDate(calendarDate) : 'Sélectionner une date'"
              block
            />
            <template #content>
              <UCalendar 
                v-model="calendarDate" 
                class="p-2"
                :is-date-disabled="(date) => date < new Date()"
                @update:model-value="updateDateTime"
              />
            </template>
          </UPopover>
        </UFormField>
        <UFormField label="Heure" name="departureTime" required class="w-full">
          <USelect
            v-model="departureTime"
            :items="timeOptions"
            placeholder="00:00"
            size="lg"
            class="w-full"
            @change="updateDateTime"
          />
        </UFormField>
      </div>
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
        {{ isSubmitting ? 'Publication...' : 'Publier la demande' }}
      </UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { useCarpoolForm } from '~/composables/useCarpoolForm';
import { ref, computed, watch } from 'vue';

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

// Variables pour le calendrier et l'heure
const calendarDate = ref<Date | null>(null);
const departureTime = ref('');

// Options d'heures
const timeOptions = computed(() => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      times.push(`${h}:${m}`);
    }
  }
  return times;
});

// Initialiser la date et l'heure depuis le formulaire
watch(() => form.departureDate, (newDate) => {
  if (newDate) {
    const date = new Date(newDate);
    calendarDate.value = date;
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    departureTime.value = `${hours}:${minutes}`;
  }
}, { immediate: true });

// Mettre à jour le formulaire quand la date ou l'heure change
const updateDateTime = () => {
  if (calendarDate.value && departureTime.value) {
    const [hours, minutes] = departureTime.value.split(':');
    const dateTime = new Date(calendarDate.value);
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0);
    form.departureDate = dateTime.toISOString().slice(0, 16);
  }
};

// Formater la date pour l'affichage
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

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