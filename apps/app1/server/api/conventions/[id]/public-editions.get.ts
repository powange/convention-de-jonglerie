import { wrapApiHandler } from '#server/utils/api-helpers'
import { validateConventionId } from '#server/utils/validation-helpers'
import { filtreStatutEdition } from '#server/utils/visibilite-edition'

export default wrapApiHandler(
  async (event) => {
    const conventionId = validateConventionId(event)

    const editions = await prisma.edition.findMany({
      where: {
        conventionId,
        status: filtreStatutEdition(),
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        startDate: true,
        endDate: true,
        city: true,
        country: true,
      },
      orderBy: { startDate: 'desc' },
    })

    return editions
  },
  { operationName: 'GetConventionPublicEditions' }
)
