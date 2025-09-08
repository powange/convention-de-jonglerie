import { prisma } from '../../utils/prisma'

import type { ServerFile } from 'nuxt-file-storage'

interface RequestBody {
  files: ServerFile[]
  metadata: {
    endpoint: string
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
    const { files } = await readBody<RequestBody>(event)

    if (!files || files.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucun fichier fourni',
      })
    }

    const file = files[0] // Prendre le premier fichier
    const userId = event.context.user.id

    // Stocker le fichier dans le dossier utilisateur
    const filename = await storeFileLocally(
      file,
      8, // longueur ID unique
      `users/${userId}` // dossier de destination dans le mount
    )

    // Mettre à jour l'utilisateur avec la nouvelle URL
    const imageUrl = `/uploads/users/${userId}/${filename}`

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: imageUrl },
    })

    return {
      success: true,
      imageUrl,
      filename,
      user: updatedUser,
    }
  } catch (error: unknown) {
    console.error("Erreur lors de l'upload de profil:", error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de l'upload de l'image",
    })
  }
})
