import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const userWithPassword = await fetchResourceOrFail<{ password: string | null }>(
      prisma.user,
      user.id,
      {
        select: { password: true },
        errorMessage: 'Utilisateur non trouvé',
      }
    )

    return {
      hasPassword: !!userWithPassword.password,
    }
  },
  { operationName: 'CheckHasPassword' }
)
