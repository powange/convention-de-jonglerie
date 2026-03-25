import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const id = validateResourceId(event, 'id', 'dépense')
    await fetchResourceOrFail(prisma.projectExpense, id, 'dépense')

    await prisma.projectExpense.delete({ where: { id } })

    return createSuccessResponse({ id }, 'Dépense supprimée')
  },
  { operationName: 'DELETE admin project-costs' }
)
