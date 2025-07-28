export interface ConventionService {
  key: keyof ConventionServiceKeys;
  label: string;
  icon: string;
  color: string;
}

export interface ConventionServiceKeys {
  hasFoodTrucks: boolean;
  hasKidsZone: boolean;
  acceptsPets: boolean;
  hasTentCamping: boolean;
  hasTruckCamping: boolean;
  hasFamilyCamping: boolean;
  hasGym: boolean;
  hasFireSpace: boolean;
  hasGala: boolean;
  hasOpenStage: boolean;
  hasConcert: boolean;
  hasCantine: boolean;
  hasAerialSpace: boolean;
  hasSlacklineSpace: boolean;
  hasToilets: boolean;
  hasShowers: boolean;
  hasAccessibility: boolean;
  hasWorkshops: boolean;
  hasCreditCardPayment: boolean;
  hasAfjTokenPayment: boolean;
  hasLongShow: boolean;
  hasATM: boolean;
}

export const conventionServices: ConventionService[] = [
  { key: 'hasFoodTrucks', label: 'Food trucks', icon: 'i-mdi:food-outline', color: 'text-orange-500' },
  { key: 'hasKidsZone', label: 'Zone enfants', icon: 'i-heroicons-face-smile', color: 'text-pink-500' },
  { key: 'acceptsPets', label: 'Animaux acceptés', icon: 'i-material-symbols:pets', color: 'text-amber-600' },
  { key: 'hasTentCamping', label: 'Camping tente', icon: 'i-material-symbols:camping-outline', color: 'text-green-600' },
  { key: 'hasTruckCamping', label: 'Camping camion', icon: 'i-heroicons-truck', color: 'text-blue-500' },
  { key: 'hasFamilyCamping', label: 'Camping famille', icon: 'i-heroicons-users', color: 'text-indigo-500' },
  { key: 'hasGym', label: 'Gymnase', icon: 'i-heroicons-trophy', color: 'text-purple-500' },
  { key: 'hasFireSpace', label: 'Fire space', icon: 'i-heroicons-fire', color: 'text-red-600' },
  { key: 'hasGala', label: 'Gala', icon: 'i-heroicons-sparkles', color: 'text-yellow-500' },
  { key: 'hasOpenStage', label: 'Scène ouverte', icon: 'i-heroicons-microphone', color: 'text-cyan-500' },
  { key: 'hasConcert', label: 'Concert', icon: 'i-heroicons-musical-note', color: 'text-violet-500' },
  { key: 'hasCantine', label: 'Cantine', icon: 'i-heroicons-cake', color: 'text-amber-500' },
  { key: 'hasAerialSpace', label: 'Espace aérien', icon: 'i-heroicons-cloud', color: 'text-sky-500' },
  { key: 'hasSlacklineSpace', label: 'Espace slackline', icon: 'i-heroicons-minus', color: 'text-teal-500' },
  { key: 'hasToilets', label: 'WC', icon: 'i-guidance:wc', color: 'text-gray-600' },
  { key: 'hasShowers', label: 'Douches', icon: 'i-material-symbols-light:shower-outline', color: 'text-blue-400' },
  { key: 'hasAccessibility', label: 'Accessibilité handicapé', icon: 'i-bx:handicap', color: 'text-blue-600' },
  { key: 'hasWorkshops', label: 'Workshops', icon: 'i-heroicons-academic-cap', color: 'text-slate-600' },
  { key: 'hasCreditCardPayment', label: 'Paiement CB', icon: 'i-heroicons-credit-card', color: 'text-emerald-600' },
  { key: 'hasAfjTokenPayment', label: 'Paiement jetons AFJ', icon: 'i-heroicons-currency-dollar', color: 'text-orange-600' },
  { key: 'hasLongShow', label: 'Spectacle long', icon: 'i-heroicons-play-circle', color: 'text-purple-600' },
  { key: 'hasATM', label: 'Distributeur automatique de billets', icon: 'i-heroicons-banknotes', color: 'text-green-600' },
];

export const getServiceByKey = (key: keyof ConventionServiceKeys): ConventionService | undefined => {
  return conventionServices.find(service => service.key === key);
};

export const getActiveServices = (convention: Partial<ConventionServiceKeys>): ConventionService[] => {
  return conventionServices.filter(service => convention[service.key]);
};

export const getServicesGrouped = () => {
  return {
    accommodation: {
      label: 'Hébergement',
      services: [
        'hasTentCamping',
        'hasTruckCamping',
        'hasFamilyCamping',
      ],
    },
    food: {
      label: 'Restauration',
      services: [
        'hasFoodTrucks',
        'hasCantine',
      ],
    },
    activities: {
      label: 'Activités',
      services: [
        'hasGym',
        'hasFireSpace',
        'hasGala',
        'hasOpenStage',
        'hasConcert',
        'hasWorkshops',
        'hasAerialSpace',
        'hasSlacklineSpace',
        'hasLongShow',
      ],
    },
    amenities: {
      label: 'Commodités',
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
      label: 'Paiements',
      services: [
        'hasCreditCardPayment',
        'hasAfjTokenPayment',
      ],
    },
  };
};

export const getServicesByCategory = () => {
  const grouped = getServicesGrouped();
  const servicesByCategory: Array<{
    category: string;
    label: string;
    services: ConventionService[];
  }> = [];

  for (const [category, { label, services: serviceKeys }] of Object.entries(grouped)) {
    const services = serviceKeys.map(key => 
      conventionServices.find(service => service.key === key)!
    );
    servicesByCategory.push({
      category,
      label,
      services,
    });
  }

  return servicesByCategory;
};