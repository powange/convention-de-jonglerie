export default wrapApiHandler(
  async () => {
    const expenses = await prisma.projectExpense.findMany({
      where: { isActive: true },
      include: {
        rates: {
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return { expenses }
  },
  { operationName: 'GET project-costs public' }
)
