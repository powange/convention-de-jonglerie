import type { Prisma } from '#server/types/prisma'

/**
 * Sélections d'utilisateurs attendues par le layer bénévoles (contrat d'hôte, cf.
 * docs/flowvent-benevoles.md). Mêmes définitions qu'app1 : le `User` de Flowvent porte ces champs.
 */
export const userBasicSelect = {
  id: true,
  pseudo: true,
} satisfies Prisma.UserSelect

export const userWithNameSelect = {
  id: true,
  pseudo: true,
  nom: true,
  prenom: true,
  pronouns: true,
} satisfies Prisma.UserSelect

export const userWithProfileAndGravatarSelect = {
  id: true,
  pseudo: true,
  profilePicture: true,
  emailHash: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

export const volunteerUserDetailedSelect = {
  id: true,
  pseudo: true,
  nom: true,
  prenom: true,
  pronouns: true,
  email: true,
  phone: true,
  emailHash: true,
  profilePicture: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

export const volunteerAssignmentDetailedInclude = {
  user: {
    select: volunteerUserDetailedSelect,
  },
  assignedBy: {
    select: userBasicSelect,
  },
} satisfies Prisma.VolunteerAssignmentInclude

/** Nom et avatar d'un compte (responsables du stock…). Même définition qu'app1. */
export const userWithNameAndAvatarSelect = {
  id: true,
  pseudo: true,
  nom: true,
  prenom: true,
  profilePicture: true,
  emailHash: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

/**
 * Sélections de la carte du site, attendues par le layer `map` (contrat d'hôte). Mêmes définitions
 * qu'app1.
 */
export const editionZoneSelect = {
  id: true,
  name: true,
  description: true,
  color: true,
  coordinates: true,
  zoneTypes: true,
  order: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EditionZoneSelect

export const editionMarkerSelect = {
  id: true,
  name: true,
  description: true,
  latitude: true,
  longitude: true,
  markerTypes: true,
  color: true,
  order: true,
  // Zone à laquelle ce marqueur est rattaché — son entrée. `null` quand il est autonome.
  zoneId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EditionMarkerSelect

// Sélections des spectacles : dans le layer artistes, partagées avec Flowvent. CHEMIN RELATIF
// (auto-imports de Nitro).
export {
  showActsInclude,
  showArtistsInclude,
  showCompositionInclude,
  showMarkerSelect,
  showPerformancesInclude,
  showZoneMarkerInclude,
  showZoneSelect,
} from '../../../../layers/artists/server/utils/selections-spectacles'
