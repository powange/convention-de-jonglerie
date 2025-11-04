import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

function getAuthProviderLabel(provider: string): string {
  switch (provider) {
    case 'email':
      return 'Inscription par email'
    case 'google':
      return 'Connexion Google'
    case 'facebook':
      return 'Connexion Facebook'
    default:
      return 'Méthode inconnue'
  }
}

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Récupérer les informations de l'utilisateur
    const userInfo = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        authProvider: true,
        password: true,
      },
    })

    if (!userInfo) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur non trouvé',
      })
    }

    const authProvider = userInfo.authProvider || 'unknown'
    const authProviderLabel = getAuthProviderLabel(authProvider)

    return {
      authProvider,
      authProviderLabel,
      hasPassword: userInfo.password !== null,
      isOAuth: userInfo.password === null,
    }
  },
  { operationName: 'GetAuthInfo' }
)
