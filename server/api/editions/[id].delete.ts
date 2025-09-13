import { requireAuth } from '../../utils/auth-utils'
import { getEditionForDelete, validateEditionId } from '../../utils/edition-permissions'
import { prisma } from '../../utils/prisma'

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
  } catch (error: any) {
    // Si c'est déjà une erreur HTTP (createError), on la relance
    if (error.statusCode) {
      throw error
    }
    // Sinon, on transforme en erreur interne
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})
