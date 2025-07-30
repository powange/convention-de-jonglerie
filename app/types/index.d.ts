
export interface User {
  id: number;
  email: string;
  pseudo: string;
  nom: string;
  prenom: string;
  profilePicture?: string | null;
  isGlobalAdmin?: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Interface pour les utilisateurs publics (sans email)
export interface PublicUser {
  id: number;
  pseudo: string;
  nom: string;
  prenom: string;
  emailHash: string;
  profilePicture?: string | null;
  updatedAt?: string;
}

export interface Edition {
  id: number;
  name?: string | null;
  description?: string;
  imageUrl?: string;
  startDate: string;
  endDate: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  region?: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  ticketingUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  hasFoodTrucks: boolean;
  hasKidsZone: boolean;
  acceptsPets: boolean;
  hasTentCamping: boolean;
  hasTruckCamping: boolean;
  hasGym: boolean;
  hasFamilyCamping: boolean;
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
  creatorId: number;
  creator: User;
  conventionId: number;
  convention?: Convention;
  favoritedBy: { id: number }[];
  collaborators?: ConventionCollaborator[];
}

export interface Convention {
  id: number;
  name: string;
  description?: string | null;
  logo?: string | null;
  createdAt: string;
  updatedAt: string;
  authorId: number;
  author?: User;
  editions?: {
    id: number;
    name?: string | null;
    startDate: string;
    endDate: string;
    city: string;
    country: string;
    imageUrl?: string | null;
  }[];
}

export interface ConventionCollaborator {
  id: number;
  conventionId: number;
  userId: number;
  canEdit: boolean;
  addedAt: string;
  addedById: number;
  user: User;
  addedBy: { id: number; pseudo: string };
}

// Interface pour les objets qui ont seulement des dates (pour les composables)
export interface HasDates {
  startDate: string;
  endDate: string;
}

// Type pour les couleurs de badge Nuxt UI
export type BadgeColor = 'info' | 'success' | 'neutral' | 'warning' | 'error';

// Type pour les status d'édition
export type EditionStatus = 'À venir' | 'En cours' | 'Terminée';

// Types pour les erreurs HTTP
export interface HttpError {
  status?: number;
  statusCode?: number;
  message?: string;
  data?: {
    message?: string;
    errors?: Record<string, string>;
  };
}

// Types pour les formulaires d'édition
export interface EditionFormData {
  conventionId?: number;
  name?: string | null;
  description?: string;
  imageUrl?: string;
  startDate: string;
  endDate: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  region?: string;
  country: string;
  ticketingUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  hasFoodTrucks?: boolean;
  hasKidsZone?: boolean;
  acceptsPets?: boolean;
  hasTentCamping?: boolean;
  hasTruckCamping?: boolean;
  hasGym?: boolean;
  hasFamilyCamping?: boolean;
  hasFireSpace?: boolean;
  hasGala?: boolean;
  hasOpenStage?: boolean;
  hasConcert?: boolean;
  hasCantine?: boolean;
  hasAerialSpace?: boolean;
  hasSlacklineSpace?: boolean;
  hasToilets?: boolean;
  hasShowers?: boolean;
  hasAccessibility?: boolean;
  hasWorkshops?: boolean;
  hasCreditCardPayment?: boolean;
  hasAfjTokenPayment?: boolean;
}

// Types pour les formulaires de convention
export interface ConventionFormData {
  name: string;
  description?: string | null;
}
