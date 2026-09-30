import { wrapApiHandler } from '#server/utils/api-helpers'
import { assurerCarteLisible } from '#server/utils/carte-lisible'
import { editionZoneSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    /*
     * Les deux drapeaux voyagent avec l'existence de l'édition : c'est `assurerCarteLisible` qui
     * décide, et son en-tête explique pourquoi la garde n'est PAS « peut éditer l'édition » — le
     * stock, les ateliers et le sélecteur de lieu appellent ce point d'API sans ce droit-là.
     */
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, siteMapEnabled: true, mapPublic: true },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition introuvable',
      })
    }

    await assurerCarteLisible(event, editionId, edition)

    const zones = await prisma.editionZone.findMany({
      where: { editionId },
      select: editionZoneSelect,
      orderBy: { order: 'asc' },
    })

    return createSuccessResponse({ zones })
  },
  { operationName: 'GetEditionZones' }
)
