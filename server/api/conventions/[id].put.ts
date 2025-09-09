import { readFile } from 'fs/promises'

import { z } from 'zod'

import { prisma } from '../../utils/prisma'
import {
  updateConventionSchema,
  validateAndSanitize,
  handleValidationError,
} from '../../utils/validation-schemas'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string)

    if (isNaN(conventionId)) {
      throw createError({
        statusCode: 400,
        message: 'ID de convention invalide',
      })
    }

    const body = await readBody(event)

    // Validation et sanitisation des données avec Zod
    let validatedData
    try {
      validatedData = validateAndSanitize(updateConventionSchema, body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error)
      }
      throw error
    }

    // Vérifier que la convention existe et que l'utilisateur a les droits
    const existingConvention = await prisma.convention.findUnique({
      where: {
        id: conventionId,
      },
      include: {
        collaborators: {
          where: {
            userId: event.context.user.id,
            OR: [{ canEditConvention: true }, { canManageCollaborators: true }],
          },
        },
      },
    })

    if (!existingConvention) {
      throw createError({
        statusCode: 404,
        message: 'Convention introuvable',
      })
    }

    // Vérifier que l'utilisateur est soit l'auteur, soit un collaborateur avec droits d'édition, soit un admin global
    const isAuthor = existingConvention.authorId === event.context.user.id
    const isCollaborator = existingConvention.collaborators.length > 0
    const isGlobalAdmin = event.context.user.isGlobalAdmin || false

    if (!isAuthor && !isCollaborator && !isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour modifier cette convention",
      })
    }

    // Gérer le logo - nouvelle approche : stocker seulement le nom de fichier
    console.log('=== GESTION DU LOGO ===')
    console.log('validatedData.logo:', validatedData.logo)
    console.log('Type de validatedData.logo:', typeof validatedData.logo)

    let finalLogoFilename = validatedData.logo

    // Déclarer tempFilename en dehors du try pour qu'il soit accessible dans le catch
    let tempFilename: string | undefined

    // Si un nouveau logo est fourni avec un path temporaire, extraire juste le nom
    if (
      validatedData.logo &&
      typeof validatedData.logo === 'string' &&
      validatedData.logo.includes('/temp/')
    ) {
      try {
        console.log('Logo temporaire détecté, traitement...')
        // Extraire le nom de fichier depuis l'URL temporaire
        // Ex: "/uploads/temp/conventions/6/abc123.png" -> "abc123.png"
        tempFilename = validatedData.logo.split('/').pop()
        if (!tempFilename) {
          throw new Error('Nom de fichier temporaire du logo non défini')
        }

        // Construire le chemin complet du fichier temporaire
        const tempPath = `temp/conventions/${conventionId}/${tempFilename}`
        const finalPath = `conventions/${conventionId}/${tempFilename}`

        console.log(`Nom de fichier extrait: ${tempFilename}`)
        console.log(`Tentative de déplacement de ${tempPath} vers ${finalPath}`)

        // getFileLocally retourne le PATH, pas le contenu !
        // Il faut lire le fichier depuis ce path
        console.log(`Récupération du path via nuxt-file-storage: ${tempPath}`)
        const tempFilePath = getFileLocally(tempPath)

        if (!tempFilePath) {
          throw new Error(`Fichier temporaire introuvable via nuxt-file-storage: ${tempPath}`)
        }

        console.log('Path récupéré:', tempFilePath)

        // Maintenant lire le contenu réel du fichier
        const fileBuffer = await readFile(tempFilePath)

        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error(`Impossible de lire le contenu du fichier: ${tempFilePath}`)
        }

        console.log('Fichier lu avec succès, taille:', fileBuffer.length, 'bytes')

        // Convertir en data URL
        const base64 = fileBuffer.toString('base64')
        const dataUrl = `data:image/png;base64,${base64}`
        console.log('Data URL créée, taille:', dataUrl.length)

        // Créer un objet ServerFile compatible avec nuxt-file-storage
        const serverFile = {
          name: tempFilename,
          content: dataUrl, // Data URL
          size: dataUrl.length.toString(), // size doit être une string
          type: 'image/png',
          lastModified: Date.now().toString(), // lastModified aussi en string
        }

        console.log('Stockage dans le dossier final...')
        console.log('ServerFile avant stockage:', {
          name: serverFile.name,
          contentType: typeof serverFile.content,
          contentLength: serverFile.content?.length || 0,
          size: serverFile.size,
          type: serverFile.type,
        })

        // Stocker le fichier dans le dossier final
        const newFilename = await storeFileLocally(
          serverFile,
          8, // Suffixe aléatoire
          `conventions/${conventionId}` // Dossier de destination
        )

        console.log(`Fichier stocké avec succès: ${newFilename || tempFilename}`)

        // Supprimer le fichier temporaire
        console.log('Suppression du fichier temporaire...')
        try {
          await deleteFile(tempPath)
          console.log('Fichier temporaire supprimé')
        } catch (deleteError) {
          console.warn('Impossible de supprimer le fichier temporaire:', deleteError)
        }

        // Stocker seulement le nom de fichier en BDD
        finalLogoFilename = newFilename

        console.log(`Fichier ${tempFilename} déplacé avec succès`)
        console.log(`Logo final qui sera stocké en DB: ${finalLogoFilename}`)
      } catch (error) {
        console.error('ERREUR lors du déplacement du fichier:', error)
        // En cas d'erreur de déplacement, on stocke quand même le nom du fichier
        // Le fichier reste dans temp/ mais au moins on garde la référence
        finalLogoFilename = tempFilename || null
        console.log(`Erreur de déplacement - on stocke quand même le nom: ${finalLogoFilename}`)
        console.log(`Le fichier reste dans temp/ mais sera accessible`)
      }
    } else if (validatedData.logo && !validatedData.logo.includes('/temp/')) {
      // Si c'est déjà un nom de fichier simple, le garder tel quel
      console.log('Logo déjà un nom de fichier simple ou URL existante')
      finalLogoFilename = validatedData.logo.split('/').pop() || validatedData.logo
    }

    console.log(`=== FIN GESTION LOGO - valeur finale: ${finalLogoFilename} ===`)

    // Gérer la suppression de l'ancien logo si nécessaire
    if (validatedData.logo === null && existingConvention.logo) {
      try {
        // Si c'est juste un nom de fichier, construire le path complet
        const oldLogoPath = existingConvention.logo.includes('/')
          ? existingConvention.logo.replace('/uploads/', '')
          : `conventions/${conventionId}/${existingConvention.logo}`

        // Utiliser deleteFile de nuxt-file-storage
        await deleteFile(oldLogoPath)
        console.log(`Ancien logo supprimé avec nuxt-file-storage: ${oldLogoPath}`)
      } catch (error) {
        // Log l'erreur mais ne pas faire échouer la mise à jour
        console.warn(`Impossible de supprimer l'ancien logo: ${existingConvention.logo}`, error)
      }
    }

    // Mettre à jour la convention
    const updatedConvention = await prisma.convention.update({
      where: {
        id: conventionId,
      },
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
        // Ne mettre à jour le logo que si explicitement fourni dans validatedData
        ...(validatedData.logo !== undefined && { logo: finalLogoFilename }),
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
      },
    })

    return updatedConvention
  } catch (error) {
    // Si c'est déjà une erreur HTTP, la relancer
    if ((error as any)?.statusCode) {
      throw error
    }

    console.error('Erreur lors de la mise à jour de la convention:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur lors de la mise à jour de la convention',
    })
  }
})
