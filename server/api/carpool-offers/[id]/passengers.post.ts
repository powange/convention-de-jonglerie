export default defineEventHandler(async (_event) => {
  throw createError({
    statusCode: 410,
    message: 'Endpoint retiré. Utilisez le système de réservations.',
  })
})
