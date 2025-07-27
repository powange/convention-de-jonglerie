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