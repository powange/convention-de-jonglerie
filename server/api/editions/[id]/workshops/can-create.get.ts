import { canCreateWorkshop } from '@@/server/utils/permissions/workshop-permissions'

export default defineEventHandler(async (event) => {
  const user = await requireUserSession(event)

  const editionId = parseInt(getRouterParam(event, 'id')!)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  const hasPermission = await canCreateWorkshop(user.user.id, editionId)

  return {
    canCreate: hasPermission,
  }
})
