<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <!-- Sélecteur de date -->
    <UFormField :label="dateLabel" :name="dateFieldName" :required="required">
      <UPopover :popper="{ placement: 'bottom-start' }" class="w-full">
        <UButton 
          icon="i-heroicons-calendar-days" 
          size="lg" 
          color="neutral" 
          variant="outline"
          class="w-full justify-start text-left font-normal"
          :label="displayDate || placeholder"
          block
        />
        <template #content>
          <UCalendar 
            v-model="calendarDateValue" 
            class="p-2"
            :is-date-disabled="isCalendarDateDisabled"
            @update:model-value="handleDateUpdate"
          />
        </template>
      </UPopover>
    </UFormField>

    <!-- Sélecteur d'heure -->
    <UFormField :label="timeLabel" :name="timeFieldName" :required="required">
      <USelect
        v-model="selectedTime"
        :items="timeOptions"
        :placeholder="timePlaceholder"
        size="lg"
        class="w-full"
        @change="updateDateTime"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import { watch, shallowRef } from 'vue';
import { CalendarDate, getLocalTimeZone } from '@internationalized/date';
import { useDateTimePicker } from '~/composables/useDateTimePicker';

interface Props {
  /** Valeur v-model au format ISO string */
  modelValue?: string;
  /** Texte du label pour la date */
  dateLabel?: string;
  /** Texte du label pour l'heure */
  timeLabel?: string;
  /** Nom du champ date pour les formulaires */
  dateFieldName?: string;
  /** Nom du champ heure pour les formulaires */
  timeFieldName?: string;
  /** Placeholder du bouton date */
  placeholder?: string;
  /** Placeholder du select heure */
  timePlaceholder?: string;
  /** Champ requis */
  required?: boolean;
  /** Date minimum autorisée */
  minDate?: Date;
  /** Intervalle en minutes pour les options d'heure */
  timeInterval?: number;
}

const props = withDefaults(defineProps<Props>(), {
  dateLabel: 'Date',
  timeLabel: 'Heure',
  dateFieldName: 'date',
  timeFieldName: 'time',
  placeholder: 'Sélectionner une date',
  timePlaceholder: '00:00',
  required: false,
  timeInterval: 30
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

// Utiliser le composable
const {
  calendarDate,
  selectedTime,
  combinedDateTime,
  timeOptions,
  displayDate,
  updateDateTime,
  setValue
} = useDateTimePicker({
  initialValue: props.modelValue,
  minDate: props.minDate,
  timeInterval: props.timeInterval,
  onChange: (isoString) => {
    emit('update:modelValue', isoString);
  }
});

// Créer un CalendarDate à partir de la Date JavaScript pour le v-model du UCalendar
const calendarDateValue = shallowRef<CalendarDate | null>(null);

// Formatter pour l'affichage de la date
// Formatter inutilisé retiré pour éviter un avertissement ESLint

// Synchroniser calendarDate (JS Date) avec calendarDateValue (CalendarDate)
watch(calendarDate, (newDate) => {
  if (newDate && newDate instanceof Date && !isNaN(newDate.getTime())) {
    // Convertir Date JS vers CalendarDate
    calendarDateValue.value = new CalendarDate(
      newDate.getFullYear(),
      newDate.getMonth() + 1, // CalendarDate utilise 1-12, JS Date utilise 0-11
      newDate.getDate()
    );
  } else {
    calendarDateValue.value = null;
  }
}, { immediate: true });

// Fonction pour vérifier si une date CalendarDate est désactivée
const isCalendarDateDisabled = (calendarDate: CalendarDate) => {
  if (!props.minDate) return false;
  
  try {
    const jsDate = calendarDate.toDate(getLocalTimeZone());
    return jsDate < props.minDate;
  } catch {
    return false;
  }
};

// Fonction pour gérer les changements de date du calendrier
const handleDateUpdate = (newCalendarDate: CalendarDate | null) => {
  if (newCalendarDate && typeof newCalendarDate.toDate === 'function') {
    try {
      // Convertir CalendarDate en Date JavaScript
      const jsDate = newCalendarDate.toDate(getLocalTimeZone());
      if (jsDate instanceof Date && !isNaN(jsDate.getTime())) {
        calendarDate.value = jsDate;
        updateDateTime();
      }
    } catch (error) {
      console.error('Erreur lors de la conversion CalendarDate vers Date:', error);
    }
  } else if (newCalendarDate === null) {
    calendarDate.value = null;
  }
};

// Watcher pour les changements du v-model parent
watch(() => props.modelValue, (newValue) => {
  if (newValue !== combinedDateTime.value) {
    setValue(newValue || '');
  }
});
</script>