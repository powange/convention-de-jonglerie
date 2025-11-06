import type { Prisma } from '@prisma/client'

/**
 * Constantes de sélection Prisma réutilisables
 * Évite la duplication des clauses select dans les différents endpoints
 */

// ============================================================
// USER SELECTS
// ============================================================

/**
 * Sélection de base pour un utilisateur (informations publiques)
 */
export const USER_PUBLIC_SELECT = {
  id: true,
  pseudo: true,
  profilePicture: true,
  createdAt: true,
} satisfies Prisma.UserSelect

/**
 * Sélection pour un utilisateur authentifié (ses propres données)
 */
export const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  pseudo: true,
  nom: true,
  prenom: true,
  phone: true,
  profilePicture: true,
  isEmailVerified: true,
  isGlobalAdmin: true,
  preferredLanguage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

/**
 * Sélection pour l'administration (toutes les infos sauf le mot de passe)
 */
export const USER_ADMIN_SELECT = {
  id: true,
  email: true,
  pseudo: true,
  nom: true,
  prenom: true,
  phone: true,
  profilePicture: true,
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

/**
 * Sélection minimale pour un utilisateur (juste ID et pseudo)
 */
export const USER_MINIMAL_SELECT = {
  id: true,
  pseudo: true,
} satisfies Prisma.UserSelect

/**
 * Sélection pour l'auteur d'une ressource
 */
export const AUTHOR_SELECT = {
  id: true,
  pseudo: true,
  email: true,
  profilePicture: true,
} satisfies Prisma.UserSelect

// ============================================================
// CONVENTION SELECTS
// ============================================================

/**
 * Sélection de base pour une convention (liste publique)
 */
export const CONVENTION_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  logo: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: USER_PUBLIC_SELECT,
  },
  _count: {
    select: {
      editions: true,
      collaborators: true,
    },
  },
} satisfies Prisma.ConventionSelect

/**
 * Sélection pour une convention avec détails complets
 */
export const CONVENTION_DETAIL_SELECT = {
  id: true,
  name: true,
  description: true,
  logo: true,
  email: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: {
    select: AUTHOR_SELECT,
  },
  collaborators: {
    select: {
      id: true,
      userId: true,
      user: {
        select: USER_PUBLIC_SELECT,
      },
      canManageOrganizers: true,
      canEditAllEditions: true,
      canDeleteConvention: true,
    },
  },
  _count: {
    select: {
      editions: true,
    },
  },
} satisfies Prisma.ConventionSelect

// ============================================================
// EDITION SELECTS
// ============================================================

/**
 * Sélection minimale pour une édition (carte, liste)
 */
export const EDITION_CARD_SELECT = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  city: true,
  country: true,
  imageUrl: true,
  isArchived: true,
  createdAt: true,
  conventionId: true,
  convention: {
    select: {
      id: true,
      name: true,
      logo: true,
    },
  },
  _count: {
    select: {
      workshops: true,
      shows: true,
      carpoolOffers: true,
    },
  },
} satisfies Prisma.EditionSelect

/**
 * Sélection pour une édition avec détails complets (page détail)
 */
export const EDITION_DETAIL_SELECT = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  city: true,
  country: true,
  address: true,
  latitude: true,
  longitude: true,
  description: true,
  imageUrl: true,
  isArchived: true,
  registrationUrl: true,
  website: true,
  facebookEvent: true,
  contactEmail: true,
  contactPhone: true,
  capacity: true,
  createdAt: true,
  updatedAt: true,
  conventionId: true,
  authorId: true,
  convention: {
    select: {
      id: true,
      name: true,
      logo: true,
      description: true,
    },
  },
  author: {
    select: AUTHOR_SELECT,
  },
  _count: {
    select: {
      workshops: true,
      shows: true,
      artists: true,
      carpoolOffers: true,
      carpoolRequests: true,
    },
  },
} satisfies Prisma.EditionSelect

// ============================================================
// WORKSHOP SELECTS
// ============================================================

/**
 * Sélection pour un atelier (liste)
 */
export const WORKSHOP_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  startDateTime: true,
  endDateTime: true,
  locationId: true,
  maxParticipants: true,
  createdAt: true,
} satisfies Prisma.WorkshopSelect

/**
 * Sélection pour un atelier avec détails complets
 */
export const WORKSHOP_DETAIL_SELECT = {
  id: true,
  title: true,
  description: true,
  startDateTime: true,
  endDateTime: true,
  locationId: true,
  maxParticipants: true,
  createdAt: true,
  updatedAt: true,
  editionId: true,
  location: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.WorkshopSelect

// ============================================================
// CARPOOL SELECTS
// ============================================================

/**
 * Sélection pour une offre de covoiturage
 */
export const CARPOOL_OFFER_SELECT = {
  id: true,
  tripDate: true,
  locationCity: true,
  locationAddress: true,
  locationLatitude: true,
  locationLongitude: true,
  destinationCity: true,
  destinationAddress: true,
  destinationLatitude: true,
  destinationLongitude: true,
  availableSeats: true,
  pricePerSeat: true,
  description: true,
  isReturn: true,
  createdAt: true,
  userId: true,
  editionId: true,
  user: {
    select: USER_PUBLIC_SELECT,
  },
  _count: {
    select: {
      bookings: true,
    },
  },
} satisfies Prisma.CarpoolOfferSelect

/**
 * Sélection pour une demande de covoiturage
 */
export const CARPOOL_REQUEST_SELECT = {
  id: true,
  tripDate: true,
  locationCity: true,
  seatsNeeded: true,
  description: true,
  phoneNumber: true,
  createdAt: true,
  userId: true,
  editionId: true,
  user: {
    select: USER_PUBLIC_SELECT,
  },
  _count: {
    select: {
      comments: true,
    },
  },
} satisfies Prisma.CarpoolRequestSelect

// ============================================================
// NOTIFICATION SELECTS
// ============================================================

/**
 * Sélection pour une notification
 */
export const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  titleKey: true,
  messageKey: true,
  translationParams: true,
  actionTextKey: true,
  titleText: true,
  messageText: true,
  actionText: true,
  category: true,
  entityType: true,
  entityId: true,
  isRead: true,
  readAt: true,
  actionUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotificationSelect

// ============================================================
// VOLUNTEER SELECTS
// ============================================================

/**
 * Sélection pour une candidature de bénévole
 */
export const VOLUNTEER_APPLICATION_SELECT = {
  id: true,
  status: true,
  motivation: true,
  allergies: true,
  allergySeverity: true,
  dietaryPreference: true,
  setupAvailability: true,
  teardownAvailability: true,
  eventAvailability: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  editionId: true,
  user: {
    select: {
      id: true,
      pseudo: true,
      email: true,
      nom: true,
      prenom: true,
      phone: true,
      profilePicture: true,
    },
  },
} satisfies Prisma.EditionVolunteerApplicationSelect

// ============================================================
// TICKETING SELECTS
// ============================================================

/**
 * Sélection pour un tier de billetterie
 */
export const TICKET_TIER_SELECT = {
  id: true,
  name: true,
  customName: true,
  description: true,
  price: true,
  minAmount: true,
  maxAmount: true,
  isActive: true,
  position: true,
  countAsParticipant: true,
  validFrom: true,
  validUntil: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      orderItems: true,
    },
  },
} satisfies Prisma.TicketingTierSelect

/**
 * Sélection pour une option de billetterie
 */
export const TICKET_OPTION_SELECT = {
  id: true,
  name: true,
  description: true,
  price: true,
  type: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TicketingOptionSelect

/**
 * Sélection pour une commande de billetterie
 */
export const TICKET_ORDER_SELECT = {
  id: true,
  helloAssoOrderId: true,
  payerFirstName: true,
  payerLastName: true,
  payerEmail: true,
  amount: true,
  status: true,
  orderDate: true,
  createdAt: true,
  updatedAt: true,
  editionId: true,
  _count: {
    select: {
      items: true,
    },
  },
} satisfies Prisma.TicketingOrderSelect
