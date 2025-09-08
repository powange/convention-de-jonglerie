import { prisma } from '../../utils/prisma'

interface RequestBody {
  files: any[]
  metadata: {
    endpoint: string
    entityId?: number
    conventionId?: number
  }
}

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    })
  }

  try {
    const { files, metadata } = await readBody<RequestBody>(event)

    console.log('Received files:', files)
    console.log('Metadata:', metadata)

    if (!files || files.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucun fichier fourni',
      })
    }

    const file = files[0] // Prendre le premier fichier
    console.log('Processing file:', file.name, 'type:', file.type)
    const { entityId, conventionId } = metadata

    // Si c'est pour une convention existante, vérifier les permissions
    if (entityId || conventionId) {
      const targetId = entityId || conventionId
      const convention = await prisma.convention.findUnique({
        where: { id: targetId },
      })

      if (!convention) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Convention introuvable',
        })
      }

      if (convention.authorId !== event.context.user.id) {
        throw createError({
          statusCode: 403,
          statusMessage: "Vous n'avez pas les droits pour modifier cette convention",
        })
      }

      // Stocker le fichier dans le dossier conventions
      const filename = await storeFileLocally(
        file,
        8, // longueur ID unique
        `conventions/${targetId}` // dossier de destination dans le mount
      )

      // Mettre à jour la convention avec la nouvelle URL
      const imageUrl = `/uploads/conventions/${targetId}/${filename}`

      const updatedConvention = await prisma.convention.update({
        where: { id: targetId },
        data: { logo: imageUrl },
        include: {
          author: { select: { id: true, pseudo: true, email: true } },
        },
      })

      return {
        success: true,
        imageUrl,
        filename,
        convention: updatedConvention,
      }
    } else {
      // Nouvelle convention - stocker temporairement
      const filename = await storeFileLocally(
        file,
        8, // longueur ID unique
        'temp' // dossier temporaire dans le mount
      )

      const imageUrl = `/uploads/temp/${filename}`

      return {
        success: true,
        imageUrl,
        filename,
        temporary: true,
      }
    }
  } catch (error: unknown) {
    console.error("Erreur lors de l'upload de convention:", error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de l'upload de l'image",
    })
  }
})
