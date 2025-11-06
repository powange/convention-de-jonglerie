import {
  conventionServices,
  getServiceByKey,
  getActiveServices,
  getServicesGrouped,
  getServicesByCategory,
} from '~/utils/convention-services'

export const useConventionServices = () => {
  const services = readonly(conventionServices)
  const servicesGrouped = readonly(getServicesGrouped())
  const servicesByCategory = readonly(getServicesByCategory())

  return {
    services,
    servicesGrouped,
    servicesByCategory,
    getServiceByKey,
    getActiveServices,
  }
}

// Mapping des clés vers les clés de traduction i18n
const serviceTranslationKeys: Record<string, string> = {
  hasFoodTrucks: 'services.food_trucks',
  hasKidsZone: 'services.kids_zone',
  acceptsPets: 'services.pets_accepted',
  hasTentCamping: 'services.tent_camping',
  hasTruckCamping: 'services.truck_camping',
  hasFamilyCamping: 'services.family_camping',
  hasSleepingRoom: 'services.sleeping_room',
  hasGym: 'services.gym',
  hasFireSpace: 'services.fire_space',
  hasGala: 'services.gala',
  hasOpenStage: 'services.open_stage',
  hasLongShow: 'services.long_show',
  hasConcert: 'services.concert',
  hasCantine: 'services.canteen',
  hasAerialSpace: 'services.aerial_space',
  hasSlacklineSpace: 'services.slackline_space',
  hasToilets: 'services.toilets',
  hasShowers: 'services.showers',
  hasAccessibility: 'services.accessibility',
  hasWorkshops: 'services.workshops',
  hasCashPayment: 'services.cash_payment',
  hasCreditCardPayment: 'services.credit_card_payment',
  hasAfjTokenPayment: 'services.afj_token_payment',
  hasATM: 'services.atm',
}

// Nouvelle fonction pour obtenir les services traduits
export const useTranslatedConventionServices = () => {
  const { t } = useI18n()

  const getTranslatedServices = computed(() =>
    conventionServices.map((service) => ({
      key: service.key,
      label: t(serviceTranslationKeys[service.key] || service.label),
      icon: service.icon,
      color: service.color,
    }))
  )

  const getTranslatedServicesByCategory = computed(() => {
    // Vérifier que t est disponible
    if (!t) {
      console.warn('i18n t function not available')
      return []
    }

    const services = getTranslatedServices.value
    const grouped = {
      accommodation: {
        label: t('services.categories.accommodation'),
        services: ['hasTentCamping', 'hasTruckCamping', 'hasFamilyCamping', 'hasSleepingRoom'],
      },
      food: {
        label: t('services.categories.food'),
        services: ['hasFoodTrucks', 'hasCantine'],
      },
      activities: {
        label: t('services.categories.activities'),
        services: [
          'hasGym',
          'hasFireSpace',
          'hasGala',
          'hasOpenStage',
          'hasLongShow',
          'hasConcert',
          'hasWorkshops',
          'hasAerialSpace',
          'hasSlacklineSpace',
        ],
      },
      amenities: {
        label: t('services.categories.amenities'),
        services: [
          'hasKidsZone',
          'acceptsPets',
          'hasToilets',
          'hasShowers',
          'hasAccessibility',
          'hasATM',
        ],
      },
      payment: {
        label: t('services.categories.payment'),
        services: ['hasCashPayment', 'hasCreditCardPayment', 'hasAfjTokenPayment'],
      },
    }

    const result = []
    for (const [category, { label, services: serviceKeys }] of Object.entries(grouped)) {
      const categoryServices = serviceKeys.map(
        (key) => services.find((service) => service.key === key)!
      )
      result.push({
        category,
        label,
        services: categoryServices,
      })
    }

    return result
  })

  return {
    getTranslatedServices,
    getTranslatedServicesByCategory,
  }
}
