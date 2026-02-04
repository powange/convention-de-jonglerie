import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const applications = await prisma.showApplication.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        status: true,
        artistName: true,
        showTitle: true,
        showDescription: true,
        showDuration: true,
        showCategory: true,
        additionalPerformersCount: true,
        createdAt: true,
        updatedAt: true,
        organizerNotes: true,
        decidedAt: true,
        showCall: {
          select: {
            id: true,
            name: true,
            isOpen: true,
            deadline: true,
            edition: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                city: true,
                country: true,
                imageUrl: true,
                convention: {
                  select: {
                    id: true,
                    name: true,
                    logo: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return applications
  },
  { operationName: 'GetUserShowApplications' }
)
