import { z } from 'zod'

import { prisma } from '../../utils/prisma'
import {
  updateProfileSchema,
  validateAndSanitize,
  handleValidationError,
} from '../../utils/validation-schemas'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

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

  const { email, pseudo, nom, prenom, telephone, profilePicture, preferredLanguage } = validatedData

  try {
    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser && existingUser.id !== user.id) {
        throw createError({
          statusCode: 400,
          message: 'Cette adresse email est déjà utilisée',
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
          message: 'Ce pseudo est déjà utilisé',
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

        // Construire les chemins
        const tempPath = `temp/profiles/${user.id}/${tempFilename}`

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
        const newFilename = await storeFileLocally(serverFile, 8, `profiles/${user.id}`)

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
    if (profilePicture === null && user.profilePicture) {
      try {
        // Si c'est juste un nom de fichier, construire le path complet
        const oldPicturePath = user.profilePicture.includes('/')
          ? user.profilePicture.replace('/uploads/', '')
          : `profiles/${user.id}/${user.profilePicture}`

        // Utiliser deleteFile de nuxt-file-storage
        await deleteFile(oldPicturePath)
        console.log(`Ancienne photo supprimée avec nuxt-file-storage: ${oldPicturePath}`)
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
        nom: nom && nom.trim() !== '' ? nom.trim() : null,
        prenom: prenom && prenom.trim() !== '' ? prenom.trim() : null,
        phone: telephone && telephone.trim() !== '' ? telephone.trim() : null,
        // Ne mettre à jour la photo que si explicitement fournie dans validatedData
        ...(profilePicture !== undefined && { profilePicture: finalProfileFilename }),
        // Mettre à jour la langue préférée si fournie
        ...(preferredLanguage !== undefined && { preferredLanguage }),
      },
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        profilePicture: true,
        preferredLanguage: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return updatedUser
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error)
    const e: any = error
    if (e?.statusCode) {
      throw e
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la mise à jour du profil',
    })
  }
})
