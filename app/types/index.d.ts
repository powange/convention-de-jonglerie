export interface User {
  id: number
  email: string
  pseudo: string
  imageUrl?: string | null
  prenom: string
  nom?: string
  telephone?: string | null
  phone?: string | null // compat ancien champ
  profilePicture?: string | null
  isGlobalAdmin?: boolean
  createdAt: string
  updatedAt?: string
}

// Interface pour les utilisateurs publics (sans email)
export interface PublicUser {
  id: number
  pseudo: string
  nom: string
  prenom: string
  emailHash: string
  profilePicture?: string | null
  updatedAt?: string
}

export interface Edition {
  id: number
  name?: string | null
  description?: string
  imageUrl?: string | null
  startDate: string
  endDate: string
  addressLine1: string
  addressLine2?: string | null
  postalCode: string
  city: string
  region?: string | null
  country: string
  latitude?: number | null
  longitude?: number | null
  isOnline?: boolean
  creatorId: number
  creator?: PublicUser
  conventionId: number
  convention?: ConventionWithCollaborators
  favoritedBy: { id: number }[]
  attendingUsers?: PublicUser[]
  collaborators?: EditionCollaborator[]
  ticketingUrl?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  officialWebsiteUrl?: string | null
  hasFoodTrucks: boolean
  hasKidsZone: boolean
  acceptsPets: boolean
  hasTentCamping: boolean
  hasTruckCamping: boolean
  hasGym: boolean
  hasFamilyCamping: boolean
  hasFireSpace: boolean
  hasGala: boolean
  hasOpenStage: boolean
  hasConcert: boolean
  hasCantine: boolean
  hasAerialSpace: boolean
  hasSlacklineSpace: boolean
  hasToilets: boolean
  hasShowers: boolean
  hasAccessibility: boolean
  hasWorkshops: boolean
  hasCashPayment: boolean
  hasCreditCardPayment: boolean
  hasAfjTokenPayment: boolean
}

export interface Convention {
  id: number
  name: string
  description?: string | null
  logo?: string | null
  createdAt: string
  updatedAt: string
  authorId: number
  author?: User
  editions?: {
    id: number
    name?: string | null
    startDate: string
    endDate: string
    city: string
    country: string
    imageUrl?: string | null
  }[]
  collaborators?: ConventionCollaboratorWithRights[] // ajouté pour my-conventions
}

export interface ConventionCollaborator {
  id: number
  conventionId: number
  userId: number
  canEdit: boolean
  addedAt: string
  addedById: number
  user: User
  addedBy: { id: number; pseudo: string }
}

export interface ConventionCollaboratorWithRights {
  id: number
  user: PublicUser
  rights?: Record<string, boolean> // ex: editConvention, deleteConvention...
  perEditionRights?: {
    editionId: number
    canEdit?: boolean
    canDelete?: boolean
    canManageVolunteers?: boolean
  }[]
  title?: string | null // résumé (ex: Administrateur, Éditeur...)
}

export interface EditionCollaborator {
  id: number
  user: PublicUser
  rights?: Record<string, boolean>
  perEditionRights?: {
    editionId: number
    canEdit?: boolean
    canDelete?: boolean
    canManageVolunteers?: boolean
  }[]
  title?: string | null
}

export interface ConventionWithCollaborators extends Convention {
  collaborators?: ConventionCollaboratorWithRights[]
}

// Interface pour les objets qui ont seulement des dates (pour les composables)
export interface HasDates {
  startDate: string
  endDate: string
}

// Type pour les couleurs de badge Nuxt UI
export type BadgeColor = 'info' | 'success' | 'neutral' | 'warning' | 'error'

// Type pour les status d'édition
export type EditionStatus = 'À venir' | 'En cours' | 'Terminée'

// Types pour les erreurs HTTP
export interface HttpError {
  status?: number
  statusCode?: number
  message?: string
  data?: {
    message?: string
    errors?: Record<string, string>
  }
}

// Types pour les formulaires d'édition
export interface EditionFormData {
  conventionId?: number
  name?: string | null
  description?: string
  imageUrl?: string
  startDate: string
  endDate: string
  addressLine1: string
  addressLine2?: string
  postalCode: string
  city: string
  region?: string
  country: string
  ticketingUrl?: string
  facebookUrl?: string
  instagramUrl?: string
  officialWebsiteUrl?: string
  hasFoodTrucks?: boolean
  hasKidsZone?: boolean
  acceptsPets?: boolean
  hasTentCamping?: boolean
  hasTruckCamping?: boolean
  hasGym?: boolean
  hasFamilyCamping?: boolean
  hasFireSpace?: boolean
  hasGala?: boolean
  hasOpenStage?: boolean
  hasConcert?: boolean
  hasCantine?: boolean
  hasAerialSpace?: boolean
  hasSlacklineSpace?: boolean
  hasToilets?: boolean
  hasShowers?: boolean
  hasAccessibility?: boolean
  hasWorkshops?: boolean
  hasCashPayment?: boolean
  hasCreditCardPayment?: boolean
  hasAfjTokenPayment: boolean
}

// Paramètres bénévolat associés à une édition (pas forcément tous modifiables via le formulaire principal)
export interface EditionVolunteerSettings {
  volunteersOpen?: boolean
  volunteersDescription?: string | null
  volunteersMode?: 'INTERNAL' | 'EXTERNAL'
  volunteersExternalUrl?: string | null
  volunteersUpdatedAt?: string | null
}

// Types pour les formulaires de convention
export interface ConventionFormData {
  name: string
  description?: string | null
}
