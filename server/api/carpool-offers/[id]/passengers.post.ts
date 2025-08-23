export default defineEventHandler(async (_event) => {
  throw createError({
    statusCode: 410,
    statusMessage: 'Endpoint retiré. Utilisez le système de réservations.',
  })
})
