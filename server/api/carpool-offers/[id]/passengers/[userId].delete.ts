import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async (_event) => {
    throw createError({
      statusCode: 410,
      message: 'Endpoint retiré. Utilisez le système de réservations.',
    })
  },
  { operationName: 'DeleteCarpoolPassenger_Deprecated' }
)
