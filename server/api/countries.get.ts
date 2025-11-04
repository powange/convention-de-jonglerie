import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (_event) => {
    // Cette API est publique, pas besoin d'authentification

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
  },
  { operationName: 'GetCountries' }
)
