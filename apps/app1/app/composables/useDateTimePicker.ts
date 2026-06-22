import { ref, computed, watch, nextTick } from 'vue'

export interface UseDateTimePickerOptions {
  /** Valeur initiale au format ISO string */
  initialValue?: string
  /** Date minimum autorisée */
  minDate?: Date
  /** Fonction appelée quand la valeur change */
  onChange?: (isoString: string) => void
}

export const useDateTimePicker = (options: UseDateTimePickerOptions = {}) => {
  const { locale } = useI18n()
  const { initialValue, minDate, onChange } = options

  // Variables réactives avec watcher pour protection
  const calendarDate = ref<Date | null>(null)
  const selectedTime = ref<string | undefined>(undefined)
  const combinedDateTime = ref(initialValue || '')

  // Watcher défensif pour calendarDate
  watch(calendarDate, (newValue) => {
    if (newValue !== null && (!(newValue instanceof Date) || isNaN(newValue.getTime()))) {
      console.warn('Valeur invalide détectée dans calendarDate, reset à null')
      nextTick(() => {
        calendarDate.value = null
      })
    }
  })

  // Texte d'affichage pour la date
  const displayDate = computed(() => {
    if (
      !calendarDate.value ||
      !(calendarDate.value instanceof Date) ||
      isNaN(calendarDate.value.getTime())
    ) {
      return null
    }

    try {
      const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US'
      return new Intl.DateTimeFormat(localeCode, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(calendarDate.value)
    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error, calendarDate.value)
      return null
    }
  })

  // Fonction pour mettre à jour la valeur combinée
  const updateDateTime = () => {
    if (
      calendarDate.value &&
      calendarDate.value instanceof Date &&
      !isNaN(calendarDate.value.getTime())
    ) {
      if (selectedTime.value) {
        const [hours, minutes] = selectedTime.value.split(':')

        // Créer un format datetime-local en évitant les conversions UTC
        const year = calendarDate.value.getFullYear().toString().padStart(4, '0')
        const month = (calendarDate.value.getMonth() + 1).toString().padStart(2, '0')
        const day = calendarDate.value.getDate().toString().padStart(2, '0')
        const hoursStr = hours.padStart(2, '0')
        const minutesStr = minutes.padStart(2, '0')
        const isoString = `${year}-${month}-${day}T${hoursStr}:${minutesStr}`

        combinedDateTime.value = isoString

        // Appeler le callback si fourni
        if (onChange) {
          onChange(isoString)
        }
      } else {
        // Si pas d'heure sélectionnée, créer une date sans heure (00:00)
        const year = calendarDate.value.getFullYear().toString().padStart(4, '0')
        const month = (calendarDate.value.getMonth() + 1).toString().padStart(2, '0')
        const day = calendarDate.value.getDate().toString().padStart(2, '0')
        const isoString = `${year}-${month}-${day}T00:00`

        combinedDateTime.value = isoString

        // Appeler le callback si fourni
        if (onChange) {
          onChange(isoString)
        }
      }
    }
  }

  // Fonction pour définir une valeur externe
  const setValue = (isoString: string) => {
    if (!isoString) {
      calendarDate.value = null
      selectedTime.value = undefined
      combinedDateTime.value = ''
      return
    }

    const date = new Date(isoString)

    // Vérifier que la date est valide
    if (isNaN(date.getTime())) {
      console.warn('Date invalide fournie à setValue:', isoString)
      return
    }

    calendarDate.value = date

    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    selectedTime.value = `${hours}:${minutes}`

    combinedDateTime.value = isoString
  }

  // Fonction pour vérifier si une date est désactivée
  const isDateDisabled = (date: Date) => {
    if (minDate) {
      return date < minDate
    }
    return false
  }

  // Initialiser avec la valeur fournie
  if (initialValue) {
    setValue(initialValue)
  }

  // Watcher pour les changements externes
  watch(
    () => combinedDateTime.value,
    (newValue) => {
      if (newValue && !calendarDate.value) {
        setValue(newValue)
      }
    }
  )

  return {
    // Variables réactives
    calendarDate,
    selectedTime,
    combinedDateTime,

    // Computed
    displayDate,

    // Fonctions
    updateDateTime,
    setValue,
    isDateDisabled,

    // Utilitaires
    formatDate: (date: Date) => {
      const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US'
      return new Intl.DateTimeFormat(localeCode, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date)
    },
  }
}
