/**
 * Helpers de sélection Prisma réutilisables
 *
 * Ce fichier contient des objets de sélection Prisma standardisés
 * pour éviter la duplication de code et garantir la cohérence
 * des données retournées par l'API.
 *
 * Usage:
 * ```typescript
 * import { userBasicSelect, userWithProfileSelect } from '#server/utils/prisma-select-helpers'
 *
 * const users = await prisma.user.findMany({
 *   select: userBasicSelect
 * })
 *
 * // Ou dans un include:
 * const posts = await prisma.post.findMany({
 *   include: {
 *     user: { select: userBasicSelect }
 *   }
 * })
 * ```
 */

import type { Prisma } from '@prisma/client'

// ============================================================================
// SÉLECTIONS UTILISATEUR
// ============================================================================

/**
 * Sélection minimale pour un utilisateur (id + pseudo)
 * Utilisée dans les listes, les relations simples, etc.
 *
 * Occurrences: ~23 fichiers
 */
export const userBasicSelect = {
  id: true,
  pseudo: true,
} satisfies Prisma.UserSelect

/**
 * Sélection utilisateur avec photo de profil
 * Utilisée pour les affichages avec avatar (covoiturage, commentaires, etc.)
 *
 * Occurrences: ~4 fichiers
 */
export const userWithProfileSelect = {
  id: true,
  pseudo: true,
  profilePicture: true,
} satisfies Prisma.UserSelect

/**
 * Sélection utilisateur avec photo de profil, emailHash et updatedAt
 * Utilisée pour les covoiturages, commentaires et autres fonctionnalités nécessitant gravatar
 *
 * Occurrences: ~20+ fichiers (covoiturage principalement)
 */
export const userWithProfileAndGravatarSelect = {
  id: true,
  pseudo: true,
  profilePicture: true,
  emailHash: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

/**
 * Sélection utilisateur avec gravatar (email + hash)
 * Utilisée pour les historiques, logs, et affichages nécessitant gravatar
 *
 * Occurrences: ~2 fichiers
 */
export const userWithGravatarSelect = {
  id: true,
  pseudo: true,
  profilePicture: true,
  email: true,
  emailHash: true,
} satisfies Prisma.UserSelect

/**
 * Sélection utilisateur avec nom complet
 * Utilisée pour les bénévoles, assignations, exports
 *
 * Occurrences: ~15 fichiers
 */
export const userWithNameSelect = {
  id: true,
  pseudo: true,
  nom: true,
  prenom: true,
} satisfies Prisma.UserSelect

/**
 * Sélection utilisateur avec profil complet (sans données sensibles)
 * Utilisée pour les profils publics, affichages détaillés
 */
export const userPublicProfileSelect = {
  id: true,
  pseudo: true,
  nom: true,
  prenom: true,
  profilePicture: true,
  emailHash: true,
  isVolunteer: true,
  isArtist: true,
  isOrganizer: true,
  createdAt: true,
} satisfies Prisma.UserSelect

/**
 * Sélection utilisateur complète pour l'administration
 * Utilisée dans les endpoints admin pour la gestion des utilisateurs
 *
 * Occurrences: 2 fichiers (admin/users)
 */
export const userAdminSelect = {
  id: true,
  email: true,
  pseudo: true,
  nom: true,
  prenom: true,
  phone: true,
  profilePicture: true,
  emailHash: true,
  isEmailVerified: true,
  isGlobalAdmin: true,
  preferredLanguage: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      createdConventions: true,
      createdEditions: true,
      favoriteEditions: true,
      carpoolOffers: true,
      carpoolRequests: true,
      notifications: true,
    },
  },
} satisfies Prisma.UserSelect

// ============================================================================
// SÉLECTIONS CONVENTION
// ============================================================================

/**
 * Sélection minimale pour une convention
 * Utilisée dans les listes d'éditions, relations simples
 */
export const conventionBasicSelect = {
  id: true,
  name: true,
  logo: true,
} satisfies Prisma.ConventionSelect

/**
 * Sélection convention avec informations de base
 * Utilisée pour les pages de détail d'édition
 */
export const conventionWithDetailsSelect = {
  id: true,
  name: true,
  description: true,
  logo: true,
  websiteUrl: true,
  facebookUrl: true,
  instagramUrl: true,
} satisfies Prisma.ConventionSelect

// ============================================================================
// SÉLECTIONS ÉDITION
// ============================================================================

/**
 * Sélection minimale pour une édition (liste/card)
 * Utilisée dans les listes d'éditions, recherches, favoris
 */
export const editionListSelect = {
  id: true,
  name: true,
  description: true,
  country: true,
  city: true,
  latitude: true,
  longitude: true,
  startDate: true,
  endDate: true,
  imageUrl: true,
  status: true,

  // Services et équipements
  hasFoodTrucks: true,
  hasKidsZone: true,
  acceptsPets: true,
  hasTentCamping: true,
  hasTruckCamping: true,
  hasFamilyCamping: true,
  hasSleepingRoom: true,
  hasGym: true,
  hasFireSpace: true,
  hasGala: true,
  hasOpenStage: true,
  hasConcert: true,
  hasCantine: true,
  hasAerialSpace: true,
  hasSlacklineSpace: true,
  hasToilets: true,
  hasShowers: true,
  hasAccessibility: true,
  hasWorkshops: true,
  hasCashPayment: true,
  hasCreditCardPayment: true,
  hasAfjTokenPayment: true,
  hasLongShow: true,
  hasATM: true,
} satisfies Prisma.EditionSelect

/**
 * Include pour édition avec relations minimales (creator + convention)
 * Utilisée dans les listes d'éditions
 */
export const editionListInclude = {
  creator: {
    select: userBasicSelect,
  },
  convention: {
    select: conventionBasicSelect,
  },
} satisfies Prisma.EditionInclude

/**
 * Include pour édition avec favoris
 * Utilisée lors de la création/mise à jour d'éditions
 */
export const editionWithFavoritesInclude = {
  creator: {
    select: userBasicSelect,
  },
  favoritedBy: {
    select: { id: true },
  },
} satisfies Prisma.EditionInclude

// ============================================================================
// SÉLECTIONS COVOITURAGE
// ============================================================================

/**
 * Sélection utilisateur pour covoiturage (avec photo, emailHash et updatedAt)
 * Utilisée dans les offres et demandes de covoiturage
 */
export const carpoolUserSelect = userWithProfileAndGravatarSelect

/**
 * Include pour offre de covoiturage avec utilisateur (simple)
 * Utilisée pour les mises à jour et créations simples
 */
export const carpoolOfferInclude = {
  user: {
    select: carpoolUserSelect,
  },
} satisfies Prisma.CarpoolOfferInclude

/**
 * Include pour offre de covoiturage complète (avec bookings, passengers et comments)
 * Utilisée pour l'affichage détaillé des offres
 */
export const carpoolOfferFullInclude = {
  user: {
    select: carpoolUserSelect,
  },
  bookings: {
    include: {
      requester: {
        select: carpoolUserSelect,
      },
    },
  },
  passengers: {
    include: {
      user: {
        select: carpoolUserSelect,
      },
    },
  },
  comments: {
    include: {
      user: {
        select: carpoolUserSelect,
      },
    },
  },
} satisfies Prisma.CarpoolOfferInclude

/**
 * Include pour demande de covoiturage avec utilisateur (simple)
 */
export const carpoolRequestInclude = {
  user: {
    select: carpoolUserSelect,
  },
} satisfies Prisma.CarpoolRequestInclude

/**
 * Include pour demande de covoiturage complète (avec commentaires)
 * Utilisée pour l'affichage détaillé des demandes
 */
export const carpoolRequestFullInclude = {
  user: {
    select: carpoolUserSelect,
  },
  comments: {
    include: {
      user: {
        select: carpoolUserSelect,
      },
    },
  },
} satisfies Prisma.CarpoolRequestInclude

/**
 * Include pour réservation de covoiturage avec requester
 * Utilisée pour les bookings
 */
export const carpoolBookingInclude = {
  requester: {
    select: carpoolUserSelect,
  },
} satisfies Prisma.CarpoolBookingInclude

/**
 * Include pour passager de covoiturage avec utilisateur
 * Utilisée pour les passengers
 */
export const carpoolPassengerInclude = {
  user: {
    select: carpoolUserSelect,
  },
} satisfies Prisma.CarpoolPassengerInclude

// ============================================================================
// SÉLECTIONS ORGANISATEURS
// ============================================================================

/**
 * Include pour organisateur avec utilisateur et historique
 */
export const organizerWithUserInclude = {
  user: {
    select: userBasicSelect,
  },
  addedBy: {
    select: { pseudo: true },
  },
} satisfies Prisma.ConventionOrganizerInclude

/**
 * Include pour organisateur avec détails complets (historique)
 */
export const organizerFullInclude = {
  user: {
    select: userWithGravatarSelect,
  },
  addedBy: {
    select: userWithGravatarSelect,
  },
  perEditionPermissions: true,
} satisfies Prisma.ConventionOrganizerInclude

// ============================================================================
// SÉLECTIONS BÉNÉVOLES
// ============================================================================

/**
 * Sélection utilisateur pour bénévoles (avec nom complet)
 */
export const volunteerUserSelect = userWithNameSelect

/**
 * Sélection utilisateur détaillée pour bénévoles (avec emailHash, profilePicture, email, phone, updatedAt)
 * Utilisée pour les assignations et la gestion avancée
 */
export const volunteerUserDetailedSelect = {
  id: true,
  pseudo: true,
  nom: true,
  prenom: true,
  email: true,
  phone: true,
  emailHash: true,
  profilePicture: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

/**
 * Include pour candidature de bénévolat avec utilisateur
 */
export const volunteerApplicationInclude = {
  user: {
    select: volunteerUserSelect,
  },
} satisfies Prisma.EditionVolunteerApplicationInclude

/**
 * Include pour assignation de bénévole avec utilisateur et équipe
 */
export const volunteerAssignmentInclude = {
  user: {
    select: volunteerUserSelect,
  },
  team: true,
} satisfies Prisma.VolunteerTimeSlotAssignmentInclude

/**
 * Include pour assignation de bénévole avec utilisateur détaillé, assignedBy et team
 * Utilisée pour les listes d'assignations avec toutes les infos
 */
export const volunteerAssignmentDetailedInclude = {
  user: {
    select: volunteerUserDetailedSelect,
  },
  assignedBy: {
    select: userBasicSelect,
  },
} satisfies Prisma.VolunteerAssignmentInclude

// ============================================================================
// SÉLECTIONS OBJETS TROUVÉS
// ============================================================================

/**
 * Include pour objet trouvé avec utilisateur
 */
export const lostFoundItemInclude = {
  user: {
    select: userWithProfileSelect,
  },
} satisfies Prisma.LostFoundItemInclude

// ============================================================================
// SÉLECTIONS BILLETTERIE
// ============================================================================

/**
 * Include pour commande de billetterie avec utilisateur
 */
export const ticketingOrderInclude = {
  user: {
    select: userWithNameSelect,
  },
} satisfies Prisma.TicketingOrderInclude

// ============================================================================
// SÉLECTIONS POSTS ET COMMENTAIRES
// ============================================================================

/**
 * Include pour post d'édition avec auteur
 */
export const editionPostInclude = {
  author: {
    select: userWithProfileSelect,
  },
} satisfies Prisma.EditionPostInclude

/**
 * Include pour commentaire avec auteur
 */
export const editionPostCommentInclude = {
  author: {
    select: userWithProfileSelect,
  },
} satisfies Prisma.EditionPostCommentInclude

// ============================================================================
// TYPES GÉNÉRÉS (pour réutilisation)
// ============================================================================

/**
 * Types générés à partir des sélections pour faciliter le typage
 * dans le reste du code
 */
export type UserBasic = Prisma.UserGetPayload<{ select: typeof userBasicSelect }>
export type UserWithProfile = Prisma.UserGetPayload<{ select: typeof userWithProfileSelect }>
export type UserWithGravatar = Prisma.UserGetPayload<{ select: typeof userWithGravatarSelect }>
export type UserWithName = Prisma.UserGetPayload<{ select: typeof userWithNameSelect }>
export type UserPublicProfile = Prisma.UserGetPayload<{ select: typeof userPublicProfileSelect }>
export type UserAdmin = Prisma.UserGetPayload<{ select: typeof userAdminSelect }>

export type ConventionBasic = Prisma.ConventionGetPayload<{
  select: typeof conventionBasicSelect
}>
export type ConventionWithDetails = Prisma.ConventionGetPayload<{
  select: typeof conventionWithDetailsSelect
}>

export type EditionList = Prisma.EditionGetPayload<{
  select: typeof editionListSelect
  include: typeof editionListInclude
}>

export type CarpoolOfferWithUser = Prisma.CarpoolOfferGetPayload<{
  include: typeof carpoolOfferInclude
}>
export type CarpoolRequestWithUser = Prisma.CarpoolRequestGetPayload<{
  include: typeof carpoolRequestInclude
}>

export type OrganizerWithUser = Prisma.ConventionOrganizerGetPayload<{
  include: typeof organizerWithUserInclude
}>
export type OrganizerFull = Prisma.ConventionOrganizerGetPayload<{
  include: typeof organizerFullInclude
}>

export type VolunteerApplicationWithUser = Prisma.EditionVolunteerApplicationGetPayload<{
  include: typeof volunteerApplicationInclude
}>
export type VolunteerAssignmentWithUser = Prisma.VolunteerTimeSlotAssignmentGetPayload<{
  include: typeof volunteerAssignmentInclude
}>

export type LostFoundItemWithUser = Prisma.LostFoundItemGetPayload<{
  include: typeof lostFoundItemInclude
}>

export type TicketingOrderWithUser = Prisma.TicketingOrderGetPayload<{
  include: typeof ticketingOrderInclude
}>

export type EditionPostWithAuthor = Prisma.EditionPostGetPayload<{
  include: typeof editionPostInclude
}>
export type EditionPostCommentWithAuthor = Prisma.EditionPostCommentGetPayload<{
  include: typeof editionPostCommentInclude
}>

// ============================================================================
// SÉLECTIONS ZONES DE CARTE
// ============================================================================

/**
 * Sélection complète pour une zone de carte d'édition
 * Utilisée pour l'affichage des zones sur la carte
 */
export const editionZoneSelect = {
  id: true,
  name: true,
  description: true,
  color: true,
  coordinates: true,
  zoneType: true,
  order: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EditionZoneSelect

export type EditionZone = Prisma.EditionZoneGetPayload<{
  select: typeof editionZoneSelect
}>

// ============================================================================
// SÉLECTIONS POINTS DE REPÈRE
// ============================================================================

/**
 * Sélection complète pour un point de repère d'édition
 * Utilisée pour l'affichage des marqueurs sur la carte
 */
export const editionMarkerSelect = {
  id: true,
  name: true,
  description: true,
  latitude: true,
  longitude: true,
  markerType: true,
  color: true,
  order: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EditionMarkerSelect

export type EditionMarker = Prisma.EditionMarkerGetPayload<{
  select: typeof editionMarkerSelect
}>
