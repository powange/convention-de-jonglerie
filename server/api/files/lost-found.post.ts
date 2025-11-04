import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

import type { ServerFile } from 'nuxt-file-storage'

interface RequestBody {
  files: ServerFile[]
  metadata: {
    endpoint: string
    entityId?: number
    editionId?: number
  }
}

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const { files, metadata } = await readBody<RequestBody>(event)

    if (!files || files.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Aucun fichier fourni',
      })
    }

    const file = files[0] // Prendre le premier fichier
    const { entityId, editionId } = metadata
    const targetEditionId = entityId || editionId

    if (!targetEditionId) {
      throw createError({
        statusCode: 400,
        message: "ID d'édition requis pour les objets trouvés",
      })
    }

    // Vérifier que l'édition existe et récupérer sa convention avec permissions
    const edition = await prisma.edition.findUnique({
      where: { id: targetEditionId },
      include: {
        convention: {
          include: {
            collaborators: {
              where: {
                userId: user.id,
                OR: [{ canEditAllEditions: true }, { canEditConvention: true }],
              },
            },
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition introuvable',
      })
    }

    // Vérifier les permissions pour modifier cette édition
    const isCreator = edition.createdBy === user.id
    const isConventionAuthor = edition.convention.authorId === user.id
    const isCollaborator = edition.convention.collaborators.length > 0
    const isGlobalAdmin = user.isGlobalAdmin || false

    if (!isCreator && !isConventionAuthor && !isCollaborator && !isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour ajouter des objets trouvés à cette édition",
      })
    }

    // Stocker le fichier dans le dossier objets trouvés de l'édition
    const filename = await storeFileLocally(
      file,
      8, // longueur ID unique
      `conventions/${edition.conventionId}/editions/${targetEditionId}/lost-found` // dossier de destination dans le mount
    )

    // Construire l'URL publique
    const imageUrl = `/uploads/conventions/${edition.conventionId}/editions/${targetEditionId}/lost-found/${filename}`

    return {
      success: true,
      imageUrl,
      filename,
      editionId: targetEditionId,
      conventionId: edition.conventionId,
    }
  },
  { operationName: 'UploadLostFoundFile' }
)
