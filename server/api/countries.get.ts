import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async (_event) => {
    // Cette API est publique, pas besoin d'authentification

    // Clé de cache statique (données changent uniquement à la création/modification d'éditions)
    const cacheKey = 'countries:list'

    // Vérifier le cache
    const cached = await useStorage('cache').getItem<string[]>(cacheKey)
    if (cached) {
      return cached
    }

    // Requête DB si pas en cache
    const countries = await prisma.edition.findMany({
      where: {
        status: 'PUBLISHED', // Toutes les éditions publiées (passées, présentes, futures)
      },
      select: {
        country: true,
      },
      distinct: ['country'],
      orderBy: {
        country: 'asc',
      },
    })

    const result = countries.map((c) => c.country).filter(Boolean)

    // Mettre en cache pour 24 heures (invalidé manuellement lors des mutations)
    await useStorage('cache').setItem(cacheKey, result, { ttl: 86400 })

    return result
  },
  { operationName: 'GetCountries' }
)
