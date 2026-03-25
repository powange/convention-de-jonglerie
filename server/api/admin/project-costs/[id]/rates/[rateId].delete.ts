import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const expenseId = validateResourceId(event, 'id', 'dépense')
    const rateId = validateResourceId(event, 'rateId', 'tarif')

    // Vérifier que le tarif appartient bien à cette dépense
    const rate = await prisma.projectExpenseRate.findFirst({
      where: { id: rateId, expenseId },
    })

    if (!rate) {
      throw createError({
        status: 404,
        message: 'Tarif introuvable pour cette dépense',
      })
    }

    await prisma.projectExpenseRate.delete({ where: { id: rateId } })

    return createSuccessResponse({ id: rateId }, 'Tarif supprimé')
  },
  { operationName: 'DELETE admin project-costs rate' }
)
