import { requireAuth } from '@@/server/utils/auth-utils'
import {
  getEditionForDelete,
  validateEditionId,
} from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = validateEditionId(event.context.params?.id)

  try {
    // Récupère l'édition et vérifie les permissions de suppression
    await getEditionForDelete(editionId, user)

    // Si on arrive ici, l'utilisateur a les droits
    await prisma.edition.delete({
      where: { id: editionId },
    })

    return { message: 'Edition deleted successfully' }
  } catch (error: unknown) {
    // Si c'est déjà une erreur HTTP (createError), on la relance
    if (error.statusCode) {
      throw error
    }
    // Sinon, on transforme en erreur interne
    throw createError({
      statusCode: 500,
      message: 'Internal Server Error',
    })
  }
})
