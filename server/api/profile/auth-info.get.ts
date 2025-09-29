import { prisma } from '../../utils/prisma'

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

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

  try {
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
  } catch (error: any) {
    console.error("Erreur lors de la récupération des infos d'auth:", error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Erreur lors de la récupération des informations d'authentification",
    })
  }
})
