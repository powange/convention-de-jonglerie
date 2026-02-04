import { wrapApiHandler } from '#server/utils/api-helpers'
import { canCreateWorkshop } from '#server/utils/permissions/workshop-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = await requireUserSession(event)
    const editionId = validateEditionId(event)

    const hasPermission = await canCreateWorkshop(user.user.id, editionId)

    return {
      canCreate: hasPermission,
    }
  },
  { operationName: 'CheckCanCreateWorkshop' }
)
