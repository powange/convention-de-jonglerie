import { prisma } from '../prisma'

/**
 * Vérifie si un utilisateur peut créer un workshop pour une édition donnée
 * Un utilisateur peut créer un workshop s'il est :
 * - Bénévole accepté de l'édition
 * - Organisateur de l'édition
 * - Organisateur de la convention
 * - Participant à l'édition (a un billet valide)
 */
export async function canCreateWorkshop(userId: number, editionId: number): Promise<boolean> {
  // Vérifier si l'utilisateur est admin global et récupérer son email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isGlobalAdmin: true,
      email: true,
    },
  })

  if (!user) {
    return false
  }

  if (user.isGlobalAdmin) {
    return true
  }

  // Récupérer l'édition avec la convention et les collaborateurs
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          collaborators: true,
        },
      },
    },
  })

  if (!edition) {
    return false
  }

  // Vérifier si l'utilisateur est le créateur de l'édition
  if (edition.creatorId && edition.creatorId === userId) {
    return true
  }

  // Vérifier si l'utilisateur est l'auteur de la convention
  if (edition.convention.authorId === userId) {
    return true
  }

  // Vérifier si l'utilisateur est un collaborateur de la convention
  const isCollaborator = edition.convention.collaborators.some((collab) => collab.userId === userId)

  if (isCollaborator) {
    return true
  }

  // Vérifier si l'utilisateur est un bénévole accepté
  const volunteerApplication = await prisma.editionVolunteerApplication.findFirst({
    where: {
      editionId,
      userId,
      status: 'ACCEPTED',
    },
  })

  if (volunteerApplication) {
    return true
  }

  // Vérifier si l'utilisateur est participant (a un billet valide)
  const hasTicket = await prisma.ticketingOrderItem.findFirst({
    where: {
      order: {
        editionId,
      },
      email: user.email,
      state: 'Processed',
    },
  })

  if (hasTicket) {
    return true
  }

  return false
}

/**
 * Vérifie si un utilisateur peut modifier/supprimer un workshop
 * Un utilisateur peut modifier/supprimer un workshop s'il est :
 * - Le créateur du workshop
 * - Organisateur de l'édition
 * - Organisateur de la convention
 */
export async function canEditWorkshop(userId: number, workshopId: number): Promise<boolean> {
  // Vérifier si l'utilisateur est admin global
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGlobalAdmin: true },
  })

  if (user?.isGlobalAdmin) {
    return true
  }

  // Récupérer le workshop avec l'édition et la convention
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    include: {
      edition: {
        include: {
          convention: {
            include: {
              collaborators: true,
            },
          },
        },
      },
    },
  })

  if (!workshop) {
    return false
  }

  // Vérifier si l'utilisateur est le créateur du workshop
  if (workshop.creatorId === userId) {
    return true
  }

  // Vérifier si l'utilisateur est le créateur de l'édition
  if (workshop.edition.creatorId === userId) {
    return true
  }

  // Vérifier si l'utilisateur est l'auteur de la convention
  if (workshop.edition.convention.authorId === userId) {
    return true
  }

  // Vérifier si l'utilisateur est un collaborateur de la convention
  const isCollaborator = workshop.edition.convention.collaborators.some(
    (collab) => collab.userId === userId
  )

  return isCollaborator
}
