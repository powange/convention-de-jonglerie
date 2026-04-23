import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canEditConvention } from '#server/utils/permissions/convention-permissions'
import { validateUploadedFile } from '#server/utils/upload-validation'

interface RequestBody {
  files: any[]
  metadata: {
    endpoint: string
    entityId?: number
    conventionId?: number
  }
}

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const { files, metadata } = await readBody<RequestBody>(event)

    if (!files || files.length === 0) {
      throw createError({
        status: 400,
        message: 'Aucun fichier fourni',
      })
    }

    const file = files[0] // Prendre le premier fichier
    validateUploadedFile(file)
    const { entityId, conventionId } = metadata

    // Si c'est pour une convention existante, vérifier les permissions
    if (entityId || conventionId) {
      const targetId = entityId || conventionId
      const convention = await prisma.convention.findUnique({
        where: { id: targetId },
        include: {
          organizers: true,
        },
      })

      if (!convention) {
        throw createError({
          status: 404,
          message: 'Convention introuvable',
        })
      }

      if (!canEditConvention(convention, user)) {
        throw createError({
          status: 403,
          message: "Vous n'avez pas les droits pour modifier cette convention",
        })
      }

      // Stocker le fichier dans le dossier temporaire pour conventions existantes
      const filename = await storeFileLocally(
        file,
        8, // longueur ID unique
        `temp/conventions/${targetId}` // dossier temporaire spécifique à la convention
      )

      // Retourner l'URL temporaire - la DB ne sera mise à jour qu'au PUT
      const imageUrl = `/uploads/temp/conventions/${targetId}/${filename}`

      return createSuccessResponse({
        imageUrl,
        filename, // Le nom de fichier sera stocké en DB lors du PUT
        temporary: true,
        conventionId: targetId,
      })
    } else {
      // Nouvelle convention - stocker temporairement
      const filename = await storeFileLocally(
        file,
        8, // longueur ID unique
        'temp' // dossier temporaire dans le mount
      )

      const imageUrl = `/uploads/temp/${filename}`

      return createSuccessResponse({
        imageUrl,
        filename,
        temporary: true,
      })
    }
  },
  { operationName: 'UploadConventionFile' }
)
