export default defineEventHandler(async (event) => {
  try {
    // Vérifier que l'utilisateur est connecté
    const session = await requireUserSession(event)
    if (!session?.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié',
      })
    }

    const userId = session.user.id

    // Récupérer l'utilisateur depuis la base de données pour vérifier les droits
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isGlobalAdmin: true },
    })

    if (!currentUser?.isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accès refusé - droits administrateur requis',
      })
    }

    // Récupérer toutes les conventions avec leurs éditions
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
      statusMessage: 'Erreur serveur lors de la récupération des conventions',
    })
  }
})
