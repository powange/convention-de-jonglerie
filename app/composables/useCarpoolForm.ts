import { useAuthStore } from '~/stores/auth';

export type CarpoolType = 'offer' | 'request';

export interface CarpoolFormData {
  departureDate: string;
  departureCity: string;
  departureAddress?: string; // Uniquement pour les offres
  availableSeats?: number;   // Uniquement pour les offres
  seatsNeeded?: number;      // Uniquement pour les demandes
  phoneNumber: string;
  description: string;
}

export interface CarpoolFormConfig {
  type: CarpoolType;
  editionId: number;
  endpoint: string;
  method?: string;
  submitText: string;
  successTitle: string;
  successDescription: string;
  errorDescription: string;
  initialData?: any;
}

export function useCarpoolForm(config: CarpoolFormConfig) {
  const toast = useToast();
  const isSubmitting = ref(false);

  // Date minimum = aujourd'hui
  const minDate = new Date().toISOString().slice(0, 16);

  // Initialiser le formulaire selon le type
  const getInitialFormData = () => {
    const baseData = config.type === 'offer'
      ? {
          departureDate: '',
          departureCity: '',
          departureAddress: '',
          availableSeats: 1,
          phoneNumber: '',
          description: '',
        }
      : {
          departureDate: '',
          departureCity: '',
          seatsNeeded: 1,
          phoneNumber: '',
          description: '',
        };

    // Si on a des données initiales (mode édition), les utiliser
    if (config.initialData) {
      const data = { ...baseData };
      Object.keys(data).forEach(key => {
        if (config.initialData[key] !== undefined) {
          data[key] = config.initialData[key];
        }
      });
      // Formater la date pour l'input datetime-local
      if (config.initialData.departureDate) {
        data.departureDate = new Date(config.initialData.departureDate).toISOString().slice(0, 16);
      }
      return data;
    }

    return baseData;
  };

  const form = reactive<CarpoolFormData>(getInitialFormData());

  // Fonctions pour nettoyer les espaces en début/fin des champs texte
  const trimField = (fieldName: keyof CarpoolFormData) => {
    const value = form[fieldName];
    if (value && typeof value === 'string') {
      (form as Record<string, unknown>)[fieldName] = value.trim();
    }
  };

  const trimAllTextFields = () => {
    trimField('departureCity');
    if (config.type === 'offer') {
      trimField('departureAddress');
    }
    trimField('phoneNumber');
    trimField('description');
  };

  // Validation commune
  const validate = (state: CarpoolFormData) => {
    const errors = [];
    
    if (!state.departureDate) {
      const message = config.type === 'offer' 
        ? 'La date de départ est requise' 
        : 'La date souhaitée est requise';
      errors.push({ path: 'departureDate', message });
    }
    
    if (!state.departureCity) {
      errors.push({ path: 'departureCity', message: 'La ville de départ est requise' });
    } else if (state.departureCity.length > 100) {
      errors.push({ path: 'departureCity', message: 'La ville ne peut pas dépasser 100 caractères' });
    }
    
    // Validation du numéro de téléphone
    if (state.phoneNumber && !/^[\+]?[0-9\s\-\(\)]+$/.test(state.phoneNumber)) {
      errors.push({ path: 'phoneNumber', message: 'Numéro de téléphone invalide' });
    }
    
    // Validation de la description
    if (state.description && state.description.length > 500) {
      errors.push({ path: 'description', message: 'La description ne peut pas dépasser 500 caractères' });
    }
    
    // Validation spécifique aux offres
    if (config.type === 'offer') {
      if (!state.departureAddress) {
        errors.push({ path: 'departureAddress', message: 'L\'adresse de départ est requise' });
      } else if (state.departureAddress.length > 200) {
        errors.push({ path: 'departureAddress', message: 'L\'adresse ne peut pas dépasser 200 caractères' });
      }
      
      if (!state.availableSeats || state.availableSeats < 1) {
        errors.push({ path: 'availableSeats', message: 'Le nombre de places doit être au moins 1' });
      } else if (state.availableSeats > 8) {
        errors.push({ path: 'availableSeats', message: 'Maximum 8 places' });
      }
    }
    
    // Validation spécifique aux demandes
    if (config.type === 'request') {
      if (!state.seatsNeeded || state.seatsNeeded < 1) {
        errors.push({ path: 'seatsNeeded', message: 'Le nombre de places doit être au moins 1' });
      } else if (state.seatsNeeded > 8) {
        errors.push({ path: 'seatsNeeded', message: 'Maximum 8 personnes' });
      }
    }
    
    return errors;
  };

  // Réinitialiser le formulaire
  const resetForm = () => {
    if (config.type === 'offer') {
      Object.assign(form, {
        departureDate: '',
        departureCity: '',
        departureAddress: '',
        availableSeats: 1,
        phoneNumber: '',
        description: '',
      });
    } else {
      Object.assign(form, {
        departureDate: '',
        departureCity: '',
        seatsNeeded: 1,
        phoneNumber: '',
        description: '',
      });
    }
  };

  // Soumission du formulaire
  const onSubmit = async (emit: (event: 'success') => void) => {
    // Nettoyer tous les champs texte avant soumission
    trimAllTextFields();
    
    isSubmitting.value = true;
    
    try {
      const authStore = useAuthStore();
      const response = await $fetch(config.endpoint, {
        method: config.method || 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`,
        },
        body: form,
      });
      
      console.log('Réponse API:', response);
      
      toast.add({
        title: config.successTitle,
        description: config.successDescription,
        color: 'green',
      });
      
      // Réinitialiser le formulaire uniquement en mode création
      if (!config.initialData) {
        resetForm();
      }
      
      emit('success');
    } catch (error) {
      console.error('Erreur API:', error);
      toast.add({
        title: 'Erreur',
        description: config.errorDescription,
        color: 'red',
      });
    } finally {
      isSubmitting.value = false;
    }
  };

  return {
    form,
    isSubmitting,
    minDate,
    trimField,
    validate,
    onSubmit,
    resetForm,
  };
}