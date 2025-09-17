import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

  try {
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
  } catch (error) {
    console.error('Erreur lors de la vérification du mot de passe:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la vérification',
    })
  }
})
