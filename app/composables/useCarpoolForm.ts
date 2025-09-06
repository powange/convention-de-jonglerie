export type CarpoolType = 'offer' | 'request'

export type CarpoolDirection = 'TO_EVENT' | 'FROM_EVENT'

export interface CarpoolFormData {
  tripDate: string
  locationCity: string
  locationAddress?: string // Uniquement pour les offres
  availableSeats?: number // Uniquement pour les offres
  seatsNeeded?: number // Uniquement pour les demandes
  direction: CarpoolDirection
  phoneNumber: string
  description: string
}

export interface CarpoolFormConfig {
  type: CarpoolType
  editionId: number
  endpoint: string
  method?: string
  submitText: string
  successTitle: string
  successDescription: string
  errorDescription: string
  initialData?: Partial<CarpoolFormData> & { id?: number | string }
}

export function useCarpoolForm(config: CarpoolFormConfig) {
  const toast = useToast()
  const { t } = useI18n()
  const isSubmitting = ref(false)

  // Date minimum = aujourd'hui
  const minDate = new Date().toISOString().slice(0, 16)

  // Initialiser le formulaire selon le type
  const getInitialFormData = () => {
    const baseData =
      config.type === 'offer'
        ? {
            tripDate: '',
            locationCity: '',
            locationAddress: '',
            availableSeats: 1,
            direction: 'TO_EVENT' as CarpoolDirection,
            phoneNumber: '',
            description: '',
          }
        : {
            tripDate: '',
            locationCity: '',
            seatsNeeded: 1,
            direction: 'TO_EVENT' as CarpoolDirection,
            phoneNumber: '',
            description: '',
          }

    // Si on a des données initiales (mode édition), les utiliser
    if (config.initialData) {
      const data = { ...baseData }
      Object.keys(data).forEach((key) => {
        if (config.initialData[key] !== undefined) {
          data[key] = config.initialData[key]
        }
      })
      // Formater la date pour l'input datetime-local
      if (config.initialData.tripDate) {
        data.tripDate = new Date(config.initialData.tripDate).toISOString().slice(0, 16)
      }
      return data
    }

    return baseData
  }

  const form = reactive<CarpoolFormData>(getInitialFormData())

  // Fonctions pour nettoyer les espaces en début/fin des champs texte
  const trimField = (fieldName: keyof CarpoolFormData) => {
    const value = form[fieldName]
    if (value && typeof value === 'string') {
      ;(form as Record<string, unknown>)[fieldName] = value.trim()
    }
  }

  const trimAllTextFields = () => {
    trimField('locationCity')
    if (config.type === 'offer') {
      trimField('locationAddress')
    }
    trimField('phoneNumber')
    trimField('description')
  }

  // Validation commune
  const validate = (state: CarpoolFormData) => {
    const errors = []

    if (!state.tripDate) {
      const message =
        config.type === 'offer'
          ? t('errors.departure_date_required')
          : t('errors.desired_date_required')
      errors.push({ path: 'tripDate', message })
    }

    if (!state.locationCity) {
      errors.push({ path: 'locationCity', message: t('errors.departure_city_required') })
    } else if (state.locationCity.length > 100) {
      errors.push({ path: 'locationCity', message: t('errors.city_too_long', { max: 100 }) })
    }

    // Validation du numéro de téléphone
    if (state.phoneNumber && !/^\+?[0-9\s\-()]+$/.test(state.phoneNumber)) {
      errors.push({ path: 'phoneNumber', message: t('errors.invalid_phone_number') })
    }

    // Validation de la description
    if (state.description && state.description.length > 500) {
      errors.push({ path: 'description', message: t('errors.description_too_long', { max: 500 }) })
    }

    // Validation spécifique aux offres
    if (config.type === 'offer') {
      if (!state.locationAddress) {
        errors.push({ path: 'locationAddress', message: t('errors.departure_address_required') })
      } else if (state.locationAddress.length > 200) {
        errors.push({
          path: 'locationAddress',
          message: t('errors.address_too_long', { max: 200 }),
        })
      }

      if (!state.availableSeats || state.availableSeats < 1) {
        errors.push({ path: 'availableSeats', message: t('errors.seats_minimum_one') })
      } else if (state.availableSeats > 8) {
        errors.push({ path: 'availableSeats', message: t('errors.seats_maximum', { max: 8 }) })
      }
    }

    // Validation spécifique aux demandes
    if (config.type === 'request') {
      if (!state.seatsNeeded || state.seatsNeeded < 1) {
        errors.push({ path: 'seatsNeeded', message: t('errors.seats_minimum_one') })
      } else if (state.seatsNeeded > 8) {
        errors.push({ path: 'seatsNeeded', message: t('errors.people_maximum', { max: 8 }) })
      }
    }

    return errors
  }

  // Réinitialiser le formulaire
  const resetForm = () => {
    if (config.type === 'offer') {
      Object.assign(form, {
        tripDate: '',
        locationCity: '',
        locationAddress: '',
        availableSeats: 1,
        direction: 'TO_EVENT' as CarpoolDirection,
        phoneNumber: '',
        description: '',
      })
    } else {
      Object.assign(form, {
        tripDate: '',
        locationCity: '',
        seatsNeeded: 1,
        direction: 'TO_EVENT' as CarpoolDirection,
        phoneNumber: '',
        description: '',
      })
    }
  }

  // Soumission du formulaire
  const onSubmit = async (emit: (event: 'success') => void) => {
    // Nettoyer tous les champs texte avant soumission
    trimAllTextFields()

    isSubmitting.value = true

    try {
      const response = await $fetch(config.endpoint, {
        method: config.method || 'POST',
        body: form,
      })

      console.log('Réponse API:', response)

      toast.add({
        title: config.successTitle,
        description: config.successDescription,
        color: 'success',
      })

      // Réinitialiser le formulaire uniquement en mode création
      if (!config.initialData) {
        resetForm()
      }

      emit('success')
    } catch (error: unknown) {
      console.error('Erreur API:', error)
      const { t } = useI18n()
      toast.add({
        title: t('common.error'),
        description: config.errorDescription,
        color: 'error',
      })
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    form,
    isSubmitting,
    minDate,
    trimField,
    validate,
    onSubmit,
    resetForm,
  }
}
