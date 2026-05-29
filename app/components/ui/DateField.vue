<template>
  <UPopover :popper="{ placement: 'bottom-start' }" class="w-full" :disabled="disabled">
    <UButton
      icon="i-heroicons-calendar-days"
      :size="size"
      color="neutral"
      variant="outline"
      class="w-full justify-start text-left font-normal"
      :label="displayLabel"
      :disabled="disabled"
      block
    />
    <template #content>
      <UCalendar
        v-model="calendarDateValue"
        class="p-2"
        :placeholder="calendarPlaceholder"
        :is-date-disabled="isCalendarDateDisabled"
        @update:model-value="handleDateUpdate"
      />
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'

interface Props {
  /** Valeur v-model au format `YYYY-MM-DD` */
  modelValue?: string
  /** Placeholder affiché quand aucune date n'est sélectionnée */
  placeholder?: string
  /** Date minimum autorisée (inclusive) */
  minDate?: Date
  /** Date maximum autorisée (inclusive) */
  maxDate?: Date
  /** Taille du bouton */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Désactive l'interaction (lecture seule) */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'lg',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { locale, t } = useI18n()

const calendarDateValue = shallowRef<CalendarDate | null>(parseValue(props.modelValue))

watch(
  () => props.modelValue,
  (next) => {
    const parsed = parseValue(next)
    // Évite de re-trigger inutilement si la valeur est déjà identique
    if (sameDate(parsed, calendarDateValue.value)) return
    calendarDateValue.value = parsed
  }
)

function parseValue(value?: string): CalendarDate | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  try {
    return new CalendarDate(Number(year), Number(month), Number(day))
  } catch {
    return null
  }
}

function sameDate(a: CalendarDate | null, b: CalendarDate | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.year === b.year && a.month === b.month && a.day === b.day
}

function toIsoDate(d: CalendarDate): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`
}

const displayLabel = computed<string>(() => {
  if (!calendarDateValue.value) {
    return props.placeholder || t('components.date_time_picker.placeholder')
  }
  try {
    const jsDate = calendarDateValue.value.toDate(getLocalTimeZone())
    const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US'
    return new Intl.DateTimeFormat(localeCode, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(jsDate)
  } catch {
    return props.placeholder || ''
  }
})

const calendarPlaceholder = computed<CalendarDate | undefined>(() => {
  if (calendarDateValue.value) return undefined
  if (props.minDate) {
    return new CalendarDate(
      props.minDate.getFullYear(),
      props.minDate.getMonth() + 1,
      props.minDate.getDate()
    )
  }
  return undefined
})

const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

function isCalendarDateDisabled(calendarDate: CalendarDate): boolean {
  try {
    const jsDate = calendarDate.toDate(getLocalTimeZone())
    const dateOnly = toDateOnly(jsDate)
    if (props.minDate && dateOnly < toDateOnly(props.minDate)) return true
    if (props.maxDate && dateOnly > toDateOnly(props.maxDate)) return true
    return false
  } catch {
    return false
  }
}

function handleDateUpdate(newCalendarDate: CalendarDate | null) {
  if (newCalendarDate) {
    calendarDateValue.value = newCalendarDate
    emit('update:modelValue', toIsoDate(newCalendarDate))
  } else {
    calendarDateValue.value = null
    emit('update:modelValue', '')
  }
}
</script>
