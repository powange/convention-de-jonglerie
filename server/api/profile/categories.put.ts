import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  categoriesUpdateSchema,
  validateAndSanitize,
  handleValidationError,
} from '@@/server/utils/validation-schemas'
import { z } from 'zod'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)

    // Validation et sanitisation des données avec Zod
    let validatedData
    try {
      validatedData = validateAndSanitize(categoriesUpdateSchema, body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error)
      }
      throw error
    }

    const { isVolunteer, isArtist, isOrganizer } = validatedData

    // Mettre à jour les catégories utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVolunteer,
        isArtist,
        isOrganizer,
      },
      select: {
        id: true,
        email: true,
        emailHash: true,
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        profilePicture: true,
        preferredLanguage: true,
        isVolunteer: true,
        isArtist: true,
        isOrganizer: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return updatedUser
  },
  { operationName: 'UpdateUserCategories' }
)
