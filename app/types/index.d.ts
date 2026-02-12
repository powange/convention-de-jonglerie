export interface User {
  id: number
  email: string
  emailHash: string // Hash MD5 de l'email pour Gravatar
  pseudo: string
  imageUrl?: string | null
  prenom?: string | null
  nom?: string | null
  telephone?: string | null
  phone?: string | null // compat ancien champ
  profilePicture?: string | null
  isGlobalAdmin?: boolean
  isVolunteer?: boolean
  isArtist?: boolean
  isOrganizer?: boolean
  createdAt: string
  updatedAt?: string
}

// Interface pour les utilisateurs publics (sans email)
export interface PublicUser {
  id: number
  pseudo: string
  nom?: string | null
  prenom?: string | null
  emailHash: string
  profilePicture?: string | null
  updatedAt?: string
}

export interface Edition {
  id: number
  name?: string | null
  description?: string
  program?: string | null
  imageUrl?: string | null
  startDate: string
  endDate: string
  timezone?: string | null
  addressLine1: string
  addressLine2?: string | null
  postalCode: string
  city: string
  region?: string | null
  country: string
  latitude?: number | null
  longitude?: number | null
  status?: 'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'
  creatorId?: number | null // Nullable pour éditions importées
  creator?: PublicUser
  conventionId: number
  convention?: ConventionWithOrganizers
  attendingUsers?: PublicUser[]
  organizers?: EditionOrganizer[]
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
  hasSleepingRoom: boolean
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
  workshopsEnabled?: boolean
  mapPublic?: boolean
  hasCashPayment: boolean
  hasCreditCardPayment: boolean
  hasAfjTokenPayment: boolean
  volunteersSetupStartDate?: string | null
  volunteersTeardownEndDate?: string | null
}

export interface Convention {
  id: number
  name: string
  description?: string | null
  logo?: string | null
  email?: string | null // Email pour revendication
  createdAt: string
  updatedAt: string
  authorId?: number | null // Nullable pour conventions importées
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
  organizers?: ConventionOrganizerWithRights[] // ajouté pour my-conventions
}

export interface ConventionOrganizer {
  id: number
  conventionId: number
  userId: number
  canEdit: boolean
  addedAt: string
  addedById: number
  user: User
  addedBy: { id: number; pseudo: string }
}

export interface ConventionOrganizerWithRights {
  id: number
  user: PublicUser
  rights?: Record<string, boolean> // ex: editConvention, deleteConvention...
  perEditionRights?: {
    editionId: number
    canEdit?: boolean
    canDelete?: boolean
    canManageVolunteers?: boolean
    canManageArtists?: boolean
  }[]
  title?: string | null // résumé (ex: Administrateur, Éditeur...)
}

export interface EditionOrganizer {
  id: number
  user: PublicUser
  rights?: Record<string, boolean>
  perEditionRights?: {
    editionId: number
    canEdit?: boolean
    canDelete?: boolean
    canManageVolunteers?: boolean
    canManageArtists?: boolean
  }[]
  title?: string | null
}

export interface ConventionWithOrganizers extends Convention {
  organizers?: ConventionOrganizerWithRights[]
}

// Interface pour les objets qui ont seulement des dates (pour les composables)
export interface HasDates {
  startDate: string
  endDate: string
  status?: 'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'
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
  program?: string | null
  imageUrl?: string
  startDate: string
  endDate: string
  timezone?: string | null
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
  hasSleepingRoom?: boolean
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
  workshopsEnabled?: boolean
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

// Interface pour les statistiques du profil utilisateur
// Source de vérité : server/types/api-responses.ts (ProfileStatsResponse)
export type { ProfileStats } from '#shared/types/api'

// ========== APPEL À SPECTACLES ==========

// Types pour le mode d'appel à spectacles
export type ShowCallMode = 'INTERNAL' | 'EXTERNAL'

// Types pour le statut des candidatures
export type ShowApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

// Configuration de l'appel à spectacles sur une édition
export interface EditionShowCall {
  id: number
  editionId: number
  isOpen: boolean
  mode: ShowCallMode
  externalUrl?: string | null
  description?: string | null
  deadline?: string | null
  // Champs demandés (configurables)
  askPortfolioUrl: boolean
  askVideoUrl: boolean
  askTechnicalNeeds: boolean
  askAccommodation: boolean
  askDepartureCity: boolean
  askSocialLinks: boolean
  createdAt: string
  updatedAt: string
}

// Type pour une personne supplémentaire dans le spectacle
export interface AdditionalPerformer {
  lastName: string
  firstName: string
  email: string
  phone: string
}

// Candidature de spectacle
export interface ShowApplication {
  id: number
  showCallId: number
  userId: number
  status: ShowApplicationStatus

  // Infos artiste
  artistName: string
  artistBio?: string | null
  portfolioUrl?: string | null
  videoUrl?: string | null
  socialLinks?: string | null

  // Infos spectacle proposé
  showTitle: string
  showDescription: string
  showDuration: number
  showCategory?: string | null
  technicalNeeds?: string | null

  // Personnes supplémentaires
  additionalPerformersCount: number
  additionalPerformers?: AdditionalPerformer[] | null

  // Logistique
  accommodationNeeded: boolean
  accommodationNotes?: string | null
  departureCity?: string | null

  // Contact
  contactPhone?: string | null

  // Gestion
  organizerNotes?: string | null
  decidedAt?: string | null
  decidedById?: number | null

  // Traçabilité
  createdAt: string
  updatedAt: string

  // Lien vers le spectacle créé
  showId?: number | null
  show?: { id: number; title: string } | null

  // Relations (optionnelles selon le contexte)
  user?: PublicUser
  decidedBy?: PublicUser | null
}

// Formulaire de configuration de l'appel à spectacles
export interface ShowCallSettingsFormData {
  isOpen: boolean
  mode: ShowCallMode
  externalUrl?: string | null
  description?: string | null
  deadline?: string | null
  askPortfolioUrl: boolean
  askVideoUrl: boolean
  askTechnicalNeeds: boolean
  askAccommodation: boolean
  askDepartureCity: boolean
  askSocialLinks: boolean
}

// Formulaire de candidature de spectacle
export interface ShowApplicationFormData {
  // Infos artiste
  artistName: string
  artistBio?: string | null
  portfolioUrl?: string | null
  videoUrl?: string | null
  socialLinks?: string | null

  // Infos spectacle proposé
  showTitle: string
  showDescription: string
  showDuration: number
  showCategory?: string | null
  technicalNeeds?: string | null

  // Personnes supplémentaires
  additionalPerformersCount: number
  additionalPerformers?: AdditionalPerformer[]

  // Logistique
  accommodationNeeded: boolean
  accommodationNotes?: string | null
  departureCity?: string | null

  // Contact
  contactPhone?: string | null
}

// Statistiques des candidatures pour un appel à spectacles
export interface ShowCallStats {
  total: number
  pending: number
  accepted: number
  rejected: number
}

// Appel à spectacles avec statistiques (pour les listes)
export interface EditionShowCallWithStats extends EditionShowCall {
  stats?: ShowCallStats
}

// Version simplifiée pour les listes
export interface EditionShowCallBasic {
  id: number
  name: string
  isOpen: boolean
  mode: ShowCallMode
  externalUrl?: string | null
  description?: string | null
  deadline?: string | null
}

// Appel à spectacles public (informations visibles par les artistes)
export interface EditionShowCallPublic extends EditionShowCallBasic {
  askPortfolioUrl: boolean
  askVideoUrl: boolean
  askTechnicalNeeds: boolean
  askAccommodation: boolean
  askDepartureCity: boolean
  askSocialLinks: boolean
}

// Candidature avec le nom de l'appel (pour "Mes candidatures")
export interface ShowApplicationWithShowCallName extends ShowApplication {
  showCallName: string
}

// Exports des types organisateurs
export type {
  Organizer,
  OrganizerRights,
  OrganizerPerEditionRights,
  OrganizerRightsFormData,
} from './organizer'
