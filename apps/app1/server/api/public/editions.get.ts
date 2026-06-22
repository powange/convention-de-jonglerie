import { wrapApiHandler } from '#server/utils/api-helpers'
import { getSiteUrl } from '#server/utils/emailService'
import { editionListSelect } from '#server/utils/prisma-select-helpers'
import { requireApiToken } from '#server/utils/public-api-auth'

/**
 * API publique : liste des éditions à venir (statut PUBLISHED, endDate >= maintenant).
 *
 * Destinée aux sites partenaires. Authentification par token d'API :
 *   GET /api/public/editions?token=<token>
 *   ou en-tête `Authorization: Bearer <token>`
 *
 * Le token est géré depuis l'administration (/admin/api-tokens) et est partagé
 * entre tous les endpoints publics.
 */
export default wrapApiHandler(
  async (event) => {
    await requireApiToken(event, 'editions')

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

    // Construire une URL absolue à partir d'un chemin éventuellement relatif.
    // Les URLs externes (http…) sont laissées telles quelles, null reste null.
    const siteUrl = getSiteUrl()
    const toAbsoluteUrl = (path: string | null) => {
      if (!path) return path
      if (path.startsWith('http')) return path
      return `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`
    }

    // Enrichir chaque édition : URL absolue vers la fiche sur le site
    // (lien retour pour le partenaire) + imageUrl et logo de convention en URL absolue.
    const editionsWithUrl = editions.map((edition) => ({
      ...edition,
      imageUrl: toAbsoluteUrl(edition.imageUrl),
      url: `${siteUrl}/editions/${edition.id}`,
      convention: {
        ...edition.convention,
        logo: toAbsoluteUrl(edition.convention.logo),
      },
    }))

    return { editions: editionsWithUrl }
  },
  { operationName: 'GetPublicEditions' }
)
