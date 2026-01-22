import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { sanitizeString } from '@@/server/utils/validation-helpers'
import {
  updateProfileSchema,
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
      validatedData = validateAndSanitize(updateProfileSchema, body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error)
      }
      throw error
    }

    const {
      email,
      pseudo,
      nom,
      prenom,
      telephone,
      profilePicture,
      preferredLanguage,
      isVolunteer,
      isArtist,
      isOrganizer,
    } = validatedData

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser && existingUser.id !== user.id) {
        throw createError({
          statusCode: 400,
          message: 'Cette adresse email est déjà utilisée par un autre utilisateur',
        })
      }
    }

    // Vérifier si le pseudo est déjà utilisé par un autre utilisateur
    if (pseudo !== user.pseudo) {
      const existingUser = await prisma.user.findUnique({
        where: { pseudo },
      })

      if (existingUser && existingUser.id !== user.id) {
        throw createError({
          statusCode: 400,
          message: 'Ce pseudo est déjà utilisé par un autre utilisateur',
        })
      }
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

        // Construire le chemin du dossier temporaire
        const tempFolder = `temp/profiles/${user.id}`

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
        const newFilename = await storeFileLocally(serverFile, 8, `profiles/${user.id}`)

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
    if (profilePicture === null && user.profilePicture) {
      try {
        // Extraire le nom du fichier et le dossier séparément
        const oldFilename = user.profilePicture.includes('/')
          ? user.profilePicture.split('/').pop()!
          : user.profilePicture
        const oldFolder = user.profilePicture.includes('/')
          ? user.profilePicture.replace('/uploads/', '').split('/').slice(0, -1).join('/')
          : `profiles/${user.id}`

        // Utiliser deleteFile de nuxt-file-storage (filename, folder séparés)
        await deleteFile(oldFilename, oldFolder)
        console.log(`Ancienne photo supprimée: ${oldFilename} dans ${oldFolder}`)
      } catch (error) {
        // Log l'erreur mais ne pas faire échouer la mise à jour
        console.warn(`Impossible de supprimer l'ancienne photo: ${user.profilePicture}`, error)
      }
    }

    // Mettre à jour le profil
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        pseudo,
        nom: sanitizeString(nom),
        prenom: sanitizeString(prenom),
        phone: sanitizeString(telephone),
        // Ne mettre à jour la photo que si explicitement fournie dans validatedData
        ...(profilePicture !== undefined && { profilePicture: finalProfileFilename }),
        // Mettre à jour la langue préférée si fournie
        ...(preferredLanguage !== undefined && { preferredLanguage }),
        // Mettre à jour les catégories utilisateur si fournies
        ...(isVolunteer !== undefined && { isVolunteer }),
        ...(isArtist !== undefined && { isArtist }),
        ...(isOrganizer !== undefined && { isOrganizer }),
        // Recalculer emailHash si l'email a changé
        ...(email !== user.email && { emailHash: getEmailHash(email) }),
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

    // emailHash est déjà présent dans updatedUser
    return updatedUser
  },
  { operationName: 'UpdateProfile' }
)
