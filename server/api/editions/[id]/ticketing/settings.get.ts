import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition introuvable',
      select: {
        id: true,
        ticketingAllowOnsiteRegistration: true,
        ticketingAllowAnonymousOrders: true,
      },
    })

    return {
      allowOnsiteRegistration: edition.ticketingAllowOnsiteRegistration ?? true,
      allowAnonymousOrders: edition.ticketingAllowAnonymousOrders ?? false,
    }
  },
  { operationName: 'GetTicketingSettings' }
)
