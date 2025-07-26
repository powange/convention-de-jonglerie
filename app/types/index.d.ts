
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
  creator: { id: number; email: string; pseudo: string };
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
  user: { id: number; email: string; pseudo: string; prenom: string; nom: string };
  addedBy: { id: number; pseudo: string };
}
