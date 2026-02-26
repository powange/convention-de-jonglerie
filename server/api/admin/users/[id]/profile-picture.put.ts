import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'

const updateProfilePictureSchema = z.object({
  profilePicture: z.string().min(1, 'Chemin de fichier requis').nullable(),
})

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    const userId = validateResourceId(event, 'id', 'utilisateur')

    const body = await readBody(event)

    // Valider les données d'entrée
    const validatedData = updateProfilePictureSchema.parse(body)
    const { profilePicture } = validatedData

    // Vérifier que l'utilisateur à modifier existe
    const existingUser = await fetchResourceOrFail(prisma.user, userId, {
      errorMessage: 'Utilisateur introuvable',
      select: { id: true, profilePicture: true },
    })

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

        // Construire le chemin du dossier temporaire
        const tempFolder = `temp/profiles/${userId}`

        // Récupérer et lire le fichier temporaire (filename, folder séparés)
        const tempFilePath = getFileLocally(tempFilename, tempFolder)
        if (!tempFilePath) {
          throw new Error(`Fichier temporaire introuvable: ${tempFolder}/${tempFilename}`)
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

        // Supprimer le fichier temporaire (filename, folder séparés)
        try {
          await deleteFile(tempFilename, tempFolder)
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
        // Extraire le nom du fichier et le dossier séparément
        const oldFilename = existingUser.profilePicture.includes('/')
          ? existingUser.profilePicture.split('/').pop()!
          : existingUser.profilePicture
        const oldFolder = existingUser.profilePicture.includes('/')
          ? existingUser.profilePicture.replace('/uploads/', '').split('/').slice(0, -1).join('/')
          : `profiles/${userId}`

        // Utiliser deleteFile de nuxt-file-storage (filename, folder séparés)
        await deleteFile(oldFilename, oldFolder)
        console.log(`Ancienne photo supprimée: ${oldFilename} dans ${oldFolder}`)
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

    return createSuccessResponse(
      { profilePicture: updatedUser.profilePicture },
      'Photo de profil mise à jour avec succès'
    )
  },
  { operationName: 'UpdateUserProfilePicture' }
)
