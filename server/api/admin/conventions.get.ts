import { requireGlobalAdminWithDbCheck } from '../../utils/admin-auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer toutes les conventions avec leurs éditions et collaborateurs
    const conventions = await prisma.convention.findMany({
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
            nom: true,
            prenom: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                email: true,
                nom: true,
                prenom: true,
              },
            },
          },
        },
        editions: {
          include: {
            creator: {
              select: {
                id: true,
                pseudo: true,
                email: true,
                nom: true,
                prenom: true,
              },
            },
            _count: {
              select: {
                volunteerApplications: true,
                carpoolOffers: true,
                carpoolRequests: true,
                lostFoundItems: true,
              },
            },
          },
          orderBy: {
            startDate: 'desc',
          },
        },
        _count: {
          select: {
            editions: true,
            collaborators: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    return {
      conventions,
      total: conventions.length,
    }
  } catch (error: any) {
    console.error('Erreur lors de la récupération des conventions admin:', error)

    // Si c'est déjà une erreur HTTP, la relancer
    if (error.statusCode) {
      throw error
    }

    // Sinon, erreur serveur générique
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur lors de la récupération des conventions',
    })
  }
})
