import { conventionServices, getServiceByKey, getActiveServices, getServicesGrouped, getServicesByCategory, type ConventionService, type ConventionServiceKeys } from '~/utils/convention-services';

export const useConventionServices = () => {
  const services = readonly(conventionServices);
  const servicesGrouped = readonly(getServicesGrouped());
  const servicesByCategory = readonly(getServicesByCategory());

  return {
    services,
    servicesGrouped,
    servicesByCategory,
    getServiceByKey,
    getActiveServices,
  };
};

// Nouvelle fonction pour obtenir les services traduits
export const useTranslatedConventionServices = () => {
  const { t } = useI18n();

  const getTranslatedServices = () => [
    { key: 'hasFoodTrucks', label: t('services.food_trucks'), icon: 'i-mdi:food-outline', color: 'text-orange-500' },
    { key: 'hasKidsZone', label: t('services.kids_zone'), icon: 'i-heroicons-face-smile', color: 'text-pink-500' },
    { key: 'acceptsPets', label: t('services.pets_accepted'), icon: 'i-material-symbols:pets', color: 'text-amber-600' },
    { key: 'hasTentCamping', label: t('services.tent_camping'), icon: 'i-material-symbols:camping-outline', color: 'text-green-600' },
    { key: 'hasTruckCamping', label: t('services.truck_camping'), icon: 'i-heroicons-truck', color: 'text-blue-500' },
    { key: 'hasFamilyCamping', label: t('services.family_camping'), icon: 'i-heroicons-users', color: 'text-indigo-500' },
    { key: 'hasGym', label: t('services.gym'), icon: 'i-heroicons-trophy', color: 'text-purple-500' },
    { key: 'hasFireSpace', label: t('services.fire_space'), icon: 'i-heroicons-fire', color: 'text-red-600' },
    { key: 'hasGala', label: t('services.gala'), icon: 'i-heroicons-sparkles', color: 'text-yellow-500' },
    { key: 'hasOpenStage', label: t('services.open_stage'), icon: 'i-heroicons-microphone', color: 'text-cyan-500' },
    { key: 'hasLongShow', label: t('services.long_show'), icon: 'i-heroicons-play-circle', color: 'text-purple-600' },
    { key: 'hasConcert', label: t('services.concert'), icon: 'i-heroicons-musical-note', color: 'text-violet-500' },
    { key: 'hasCantine', label: t('services.canteen'), icon: 'i-heroicons-cake', color: 'text-amber-500' },
    { key: 'hasAerialSpace', label: t('services.aerial_space'), icon: 'i-heroicons-cloud', color: 'text-sky-500' },
    { key: 'hasSlacklineSpace', label: t('services.slackline_space'), icon: 'i-heroicons-minus', color: 'text-teal-500' },
    { key: 'hasToilets', label: t('services.toilets'), icon: 'i-guidance:wc', color: 'text-gray-600' },
    { key: 'hasShowers', label: t('services.showers'), icon: 'i-material-symbols-light:shower-outline', color: 'text-blue-400' },
    { key: 'hasAccessibility', label: t('services.accessibility'), icon: 'i-bx:handicap', color: 'text-blue-600' },
    { key: 'hasWorkshops', label: t('services.workshops'), icon: 'i-heroicons-academic-cap', color: 'text-slate-600' },
    { key: 'hasCreditCardPayment', label: t('services.credit_card_payment'), icon: 'i-heroicons-credit-card', color: 'text-emerald-600' },
    { key: 'hasAfjTokenPayment', label: t('services.afj_token_payment'), icon: 'i-heroicons-currency-dollar', color: 'text-orange-600' },
    { key: 'hasATM', label: t('services.atm'), icon: 'i-heroicons-banknotes', color: 'text-green-600' },
  ];

  const getTranslatedServicesByCategory = () => {
    // Vérifier que t est disponible
    if (!t) {
      console.warn('i18n t function not available');
      return {};
    }
    
    const services = getTranslatedServices();
    const grouped = {
      accommodation: {
        label: t('services.categories.accommodation'),
        services: ['hasTentCamping', 'hasTruckCamping', 'hasFamilyCamping'],
      },
      food: {
        label: t('services.categories.food'),
        services: ['hasFoodTrucks', 'hasCantine'],
      },
      activities: {
        label: t('services.categories.activities'),
        services: ['hasGym', 'hasFireSpace', 'hasGala', 'hasOpenStage', 'hasLongShow', 'hasConcert', 'hasWorkshops', 'hasAerialSpace', 'hasSlacklineSpace'],
      },
      amenities: {
        label: t('services.categories.amenities'),
        services: ['hasKidsZone', 'acceptsPets', 'hasToilets', 'hasShowers', 'hasAccessibility', 'hasATM'],
      },
      payment: {
        label: t('services.categories.payment'),
        services: ['hasCreditCardPayment', 'hasAfjTokenPayment'],
      },
    };

    const result = [];
    for (const [category, { label, services: serviceKeys }] of Object.entries(grouped)) {
      const categoryServices = serviceKeys.map(key => 
        services.find(service => service.key === key)!
      );
      result.push({
        category,
        label,
        services: categoryServices,
      });
    }

    return result;
  };

  return {
    getTranslatedServices,
    getTranslatedServicesByCategory,
  };
};