import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { handleFileUpload } from '@@/server/utils/file-helpers'
import { getConventionForEdit } from '@@/server/utils/permissions/convention-permissions'
import { validateConventionId } from '@@/server/utils/validation-helpers'
import { updateConventionSchema, validateAndSanitize } from '@@/server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification
    const user = requireAuth(event)

    const conventionId = validateConventionId(event)

    const body = await readBody(event)

    // Validation et sanitisation des données avec Zod
    const validatedData = validateAndSanitize(updateConventionSchema, body)

    // Récupère la convention et vérifie les permissions d'édition
    const existingConvention = await getConventionForEdit(conventionId, user)

    // Gérer le logo avec le helper centralisé
    const finalLogoFilename = await handleFileUpload(validatedData.logo, existingConvention.logo, {
      resourceId: conventionId,
      resourceType: 'conventions',
    })

    // Mettre à jour la convention
    const updatedConvention = await prisma.convention.update({
      where: {
        id: conventionId,
      },
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
        // Ne mettre à jour l'email que si explicitement fourni dans validatedData
        ...(validatedData.email !== undefined && { email: validatedData.email || null }),
        // Ne mettre à jour le logo que si explicitement fourni dans validatedData
        ...(validatedData.logo !== undefined && { logo: finalLogoFilename }),
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
          },
        },
      },
    })

    return updatedConvention
  },
  { operationName: 'UpdateConvention' }
)
