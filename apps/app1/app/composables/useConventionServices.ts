import {
  conventionServices,
  getActiveServices,
  getServiceByKey,
  getServicesByCategory,
  SERVICE_CATEGORIES,
  type ConventionService,
} from '~/utils/convention-services'

/**
 * Composable d'accès non-traduit aux services. Utiliser
 * `useTranslatedConventionServices` dès qu'on a besoin des labels affichables.
 */
export const useConventionServices = () => {
  return {
    services: readonly(conventionServices),
    servicesByCategory: readonly(getServicesByCategory()),
    getServiceByKey,
    getActiveServices,
  }
}

/**
 * Variante traduite : retourne les services et leur regroupement par
 * catégorie avec les labels (service + catégorie) résolus dans la locale
 * active. Utilisé dans les filtres et les formulaires.
 */
export const useTranslatedConventionServices = () => {
  const { t } = useI18n()

  const getTranslatedServices = computed<
    Array<Pick<ConventionService, 'key' | 'icon' | 'color' | 'category'> & { label: string }>
  >(() =>
    conventionServices.map((service) => ({
      key: service.key,
      icon: service.icon,
      color: service.color,
      category: service.category,
      label: t(service.i18nKey),
    }))
  )

  const getTranslatedServicesByCategory = computed(() => {
    const services = getTranslatedServices.value
    return SERVICE_CATEGORIES.map((category) => ({
      category,
      label: t(`services.categories.${category}`),
      services: services.filter((s) => s.category === category),
    }))
  })

  return {
    getTranslatedServices,
    getTranslatedServicesByCategory,
  }
}
