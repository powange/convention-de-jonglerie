import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        password: true,
      },
    })

    if (!userWithPassword) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur non trouvé',
      })
    }

    return {
      hasPassword: !!userWithPassword.password,
    }
  },
  { operationName: 'CheckHasPassword' }
)
