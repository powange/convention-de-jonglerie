import { wrapApiHandler } from '#server/utils/api-helpers'
import { getSiteUrl } from '#server/utils/emailService'
import { editionListSelect } from '#server/utils/prisma-select-helpers'

/**
 * API publique : liste des éditions à venir (statut PUBLISHED, endDate >= maintenant).
 *
 * Destinée aux sites partenaires. Authentification par token d'API passé en query param :
 *   GET /api/public/editions?token=<token>
 *
 * Le token est géré depuis l'administration (/admin/api-tokens).
 */
export default wrapApiHandler(
  async (event) => {
    const { token } = getQuery(event)

    if (!token || typeof token !== 'string') {
      throw createError({ status: 401, message: 'Token requis' })
    }

    const apiToken = await prisma.apiToken.findUnique({
      where: { token },
      select: { id: true, isActive: true },
    })

    if (!apiToken || !apiToken.isActive) {
      throw createError({ status: 401, message: 'Token invalide' })
    }

    // Tracer l'utilisation du token
    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })

    const editions = await prisma.edition.findMany({
      where: {
        status: 'PUBLISHED',
        endDate: { gte: new Date() },
      },
      select: {
        ...editionListSelect,
        convention: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    })

    // Ajouter l'URL absolue vers la fiche de l'édition sur le site
    // (permet au site partenaire de créer un lien retour)
    const siteUrl = getSiteUrl()
    const editionsWithUrl = editions.map((edition) => ({
      ...edition,
      url: `${siteUrl}/editions/${edition.id}`,
    }))

    return { editions: editionsWithUrl }
  },
  { operationName: 'GetPublicEditions' }
)
