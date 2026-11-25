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
