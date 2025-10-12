import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const updateProfilePictureSchema = z.object({
  profilePicture: z.string().min(1, 'Chemin de fichier requis').nullable(),
})

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  await requireGlobalAdminWithDbCheck(event)

  const userId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(userId)) {
    throw createError({
      statusCode: 400,
      message: 'ID utilisateur invalide',
    })
  }

  try {
    const body = await readBody(event)

    // Valider les données d'entrée
    const validatedData = updateProfilePictureSchema.parse(body)
    const { profilePicture } = validatedData

    // Vérifier que l'utilisateur à modifier existe
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profilePicture: true },
    })

    if (!existingUser) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur introuvable',
      })
    }

    // Gérer la photo de profil
    let finalProfileFilename = profilePicture

    // Si une nouvelle photo est fournie avec un path temporaire
    if (profilePicture && typeof profilePicture === 'string' && profilePicture.includes('/temp/')) {
      try {
        // Extraire le nom de fichier depuis l'URL temporaire
        const tempFilename = profilePicture.split('/').pop()
        if (!tempFilename) {
          throw new Error('Nom de fichier temporaire invalide')
        }

        // Construire les chemins
        const tempPath = `temp/profiles/${userId}/${tempFilename}`

        // Récupérer et lire le fichier temporaire
        const tempFilePath = getFileLocally(tempPath)
        if (!tempFilePath) {
          throw new Error(`Fichier temporaire introuvable: ${tempPath}`)
        }

        const { readFile } = await import('fs/promises')
        const fileBuffer = await readFile(tempFilePath)
        const base64 = fileBuffer.toString('base64')
        const dataUrl = `data:image/png;base64,${base64}`

        // Créer un objet ServerFile pour le stockage final
        const serverFile = {
          name: tempFilename,
          content: dataUrl,
          size: dataUrl.length.toString(),
          type: 'image/png',
          lastModified: Date.now().toString(),
        }

        // Stocker dans le dossier final
        const newFilename = await storeFileLocally(serverFile, 8, `profiles/${userId}`)

        // Supprimer le fichier temporaire
        try {
          await deleteFile(tempPath)
        } catch (deleteError) {
          console.warn('Impossible de supprimer le fichier temporaire:', deleteError)
        }

        finalProfileFilename = newFilename
      } catch (error) {
        console.error('Erreur lors du déplacement du fichier de profil:', error)
        // En cas d'erreur, garder le nom du fichier temporaire
        finalProfileFilename = profilePicture.split('/').pop() || null
      }
    } else if (profilePicture && !profilePicture.includes('/temp/')) {
      // Si c'est déjà un nom de fichier simple, le garder tel quel
      finalProfileFilename = profilePicture.split('/').pop() || profilePicture
    }

    // Gérer la suppression de l'ancienne photo si nécessaire
    if (profilePicture === null && existingUser.profilePicture) {
      try {
        // Si c'est juste un nom de fichier, construire le path complet
        const oldPicturePath = existingUser.profilePicture.includes('/')
          ? existingUser.profilePicture.replace('/uploads/', '')
          : `profiles/${userId}/${existingUser.profilePicture}`

        // Utiliser deleteFile de nuxt-file-storage
        await deleteFile(oldPicturePath)
        console.log(`Ancienne photo supprimée avec nuxt-file-storage: ${oldPicturePath}`)
      } catch (error) {
        // Log l'erreur mais ne pas faire échouer la mise à jour
        console.warn(
          `Impossible de supprimer l'ancienne photo: ${existingUser.profilePicture}`,
          error
        )
      }
    }

    // Mettre à jour la photo de profil
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        profilePicture: finalProfileFilename,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        profilePicture: true,
      },
    })

    return {
      success: true,
      profilePicture: updatedUser.profilePicture,
      message: 'Photo de profil mise à jour avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la photo de profil:', error)

    // Si c'est une erreur de validation Zod
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
        data: error.errors,
      })
    }

    // Si c'est déjà une erreur HTTP, la relancer
    if ((error as any)?.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur serveur lors de la mise à jour de la photo de profil',
    })
  }
})
