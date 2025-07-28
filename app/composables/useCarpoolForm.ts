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
  submitText: string;
  successTitle: string;
  successDescription: string;
  errorDescription: string;
}

export function useCarpoolForm(config: CarpoolFormConfig) {
  const toast = useToast();
  const isSubmitting = ref(false);

  // Date minimum = aujourd'hui
  const minDate = new Date().toISOString().slice(0, 16);

  // Initialiser le formulaire selon le type
  const form = reactive<CarpoolFormData>(
    config.type === 'offer'
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
        }
  );

  // Fonctions pour nettoyer les espaces en début/fin des champs texte
  const trimField = (fieldName: keyof CarpoolFormData) => {
    const value = form[fieldName];
    if (value && typeof value === 'string') {
      (form as any)[fieldName] = value.trim();
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
    }
    
    // Validation spécifique aux offres
    if (config.type === 'offer') {
      if (!state.departureAddress) {
        errors.push({ path: 'departureAddress', message: 'L\'adresse de départ est requise' });
      }
      
      if (!state.availableSeats || state.availableSeats < 1) {
        errors.push({ path: 'availableSeats', message: 'Le nombre de places doit être au moins 1' });
      }
    }
    
    // Validation spécifique aux demandes
    if (config.type === 'request') {
      if (!state.seatsNeeded || state.seatsNeeded < 1) {
        errors.push({ path: 'seatsNeeded', message: 'Le nombre de places doit être au moins 1' });
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
        method: 'POST',
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
      
      // Réinitialiser le formulaire
      resetForm();
      
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