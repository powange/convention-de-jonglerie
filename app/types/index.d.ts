
export interface User {
  id: number;
  email: string;
  pseudo: string;
  nom: string;
  prenom: string;
  profilePicture?: string | null;
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
  name: string;
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
  favoritedBy: { id: number }[];
  collaborators?: ConventionCollaborator[];
}

// Alias temporaire pour la compatibilité
export type Convention = Edition;

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
