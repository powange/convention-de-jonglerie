import { readBody } from 'h3'

import { clearUserSession } from '#imports'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)
    const { confirmPseudo } = body

    if (!confirmPseudo) {
      throw createError({
        status: 400,
        message: 'Le pseudo de confirmation est requis',
      })
    }

    // Récupérer l'utilisateur complet depuis la base de données
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        pseudo: true,
        email: true,
        isGlobalAdmin: true,
      },
    })

    if (!dbUser) {
      throw createError({
        status: 404,
        message: 'Utilisateur non trouvé',
      })
    }

    // Vérifier que le pseudo correspond
    if (confirmPseudo !== dbUser.pseudo) {
      throw createError({
        status: 400,
        message: 'Le pseudo saisi ne correspond pas',
      })
    }

    // Empêcher les global admins de s'auto-supprimer
    if (dbUser.isGlobalAdmin) {
      throw createError({
        status: 403,
        message: 'Les administrateurs globaux ne peuvent pas supprimer leur propre compte',
      })
    }

    // Supprimer l'utilisateur (les cascades Prisma gèrent les relations)
    await prisma.user.delete({
      where: { id: dbUser.id },
    })

    console.log(`[SELF-DELETION] Compte supprimé - ID: ${dbUser.id}`)

    // Effacer la session
    await clearUserSession(event)

    return createSuccessResponse({ deleted: true }, 'Compte supprimé avec succès')
  },
  { operationName: 'DeleteOwnAccount' }
)
