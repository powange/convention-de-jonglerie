
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

export interface Convention {
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
  hasFastfood: boolean;
  hasKidsZone: boolean;
  acceptsPets: boolean;
  hasTentCamping: boolean;
  hasTruckCamping: boolean;
  hasGym: boolean;
  creatorId: number;
  creator: User;
  favoritedBy: { id: number }[];
  collaborators?: ConventionCollaborator[];
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
