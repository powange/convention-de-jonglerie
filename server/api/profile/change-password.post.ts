import { wrapApiHandler, createSuccessResponse } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { changePasswordSchema, validateAndSanitize } from '@@/server/utils/validation-schemas'
import bcrypt from 'bcryptjs'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)

    // Validation et sanitisation des données avec Zod
    const validatedData = validateAndSanitize(changePasswordSchema, body)

    const { currentPassword: rawCurrentPassword, newPassword } = validatedData

    // Traiter les chaînes vides comme undefined pour les utilisateurs OAuth
    const currentPassword = rawCurrentPassword === '' ? undefined : rawCurrentPassword

    // Récupérer l'utilisateur avec son mot de passe
    const userWithPassword = await fetchResourceOrFail<{ id: number; password: string | null }>(
      prisma.user,
      user.id,
      {
        select: {
          id: true,
          password: true,
        },
        errorMessage: 'Utilisateur non trouvé',
      }
    )

    // Vérifier le mot de passe actuel (sauf si l'utilisateur n'a pas de mot de passe - OAuth)
    if (userWithPassword.password) {
      // L'utilisateur a déjà un mot de passe, il faut le vérifier
      if (!currentPassword) {
        throw createError({
          status: 400,
          message: 'Mot de passe actuel requis',
        })
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        userWithPassword.password
      )

      if (!isCurrentPasswordValid) {
        throw createError({
          status: 400,
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

    return createSuccessResponse(null, 'Mot de passe mis à jour avec succès')
  },
  { operationName: 'ChangePassword' }
)
