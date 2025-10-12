import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import {
  changePasswordSchema,
  validateAndSanitize,
  handleValidationError,
} from '@@/server/utils/validation-schemas'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const body = await readBody(event)

  // Validation et sanitisation des données avec Zod
  let validatedData
  try {
    validatedData = validateAndSanitize(changePasswordSchema, body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      handleValidationError(error)
    }
    throw error
  }

  const { currentPassword: rawCurrentPassword, newPassword } = validatedData

  // Traiter les chaînes vides comme undefined pour les utilisateurs OAuth
  const currentPassword = rawCurrentPassword === '' ? undefined : rawCurrentPassword

  try {
    // Récupérer l'utilisateur avec son mot de passe
    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        password: true,
      },
    })

    if (!userWithPassword) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur non trouvé',
      })
    }

    // Vérifier le mot de passe actuel (sauf si l'utilisateur n'a pas de mot de passe - OAuth)
    if (userWithPassword.password) {
      // L'utilisateur a déjà un mot de passe, il faut le vérifier
      if (!currentPassword) {
        throw createError({
          statusCode: 400,
          message: 'Mot de passe actuel requis',
        })
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        userWithPassword.password
      )

      if (!isCurrentPasswordValid) {
        throw createError({
          statusCode: 400,
          message: 'Mot de passe actuel incorrect',
        })
      }
    } else {
      // Utilisateur OAuth sans mot de passe - il peut directement définir un nouveau mot de passe
      // Le champ currentPassword est ignoré
    }

    // Hasher le nouveau mot de passe
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
      },
    })

    return { success: true, message: 'Mot de passe mis à jour avec succès' }
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors du changement de mot de passe',
    })
  }
})
