import { prisma } from '../utils/prisma'

export default defineEventHandler(async (_event) => {
  // Cette API est publique, pas besoin d'authentification

  try {
    const now = new Date()

    // Récupérer tous les pays des éditions non expirées
    const countries = await prisma.edition.findMany({
      where: {
        endDate: {
          gte: now, // Conventions non expirées
        },
      },
      select: {
        country: true,
      },
      distinct: ['country'],
      orderBy: {
        country: 'asc',
      },
    })

    // Retourner seulement les noms de pays uniques
    return countries.map((c) => c.country).filter(Boolean)
  } catch (error) {
    console.error('Erreur lors de la récupération des pays:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    })
  }
})
