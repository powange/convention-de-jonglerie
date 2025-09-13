import { z } from 'zod'

import { requireAuth } from '../../utils/auth-utils'
import { getEditionForEdit, validateEditionId } from '../../utils/edition-permissions'
import { geocodeEdition } from '../../utils/geocoding'
import { prisma } from '../../utils/prisma'
import {
  updateEditionSchema,
  validateAndSanitize,
  handleValidationError,
} from '../../utils/validation-schemas'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = validateEditionId(event.context.params?.id)

  const body = await readBody(event)

  // Validation et sanitisation des données avec Zod
  let validatedData
  try {
    validatedData = validateAndSanitize(updateEditionSchema, body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      handleValidationError(error)
    }
    throw error
  }

  const {
    conventionId,
    name,
    description,
    imageUrl,
    startDate,
    endDate,
    addressLine1,
    addressLine2,
    postalCode,
    city,
    region,
    country,
    ticketingUrl,
    officialWebsiteUrl,
    facebookUrl,
    instagramUrl,
    hasFoodTrucks,
    hasKidsZone,
    acceptsPets,
    hasTentCamping,
    hasTruckCamping,
    hasFamilyCamping,
    hasGym,
    hasFireSpace,
    hasGala,
    hasOpenStage,
    hasConcert,
    hasCantine,
    hasAerialSpace,
    hasSlacklineSpace,
    hasToilets,
    hasShowers,
    hasAccessibility,
    hasWorkshops,
    hasCashPayment,
    hasCreditCardPayment,
    hasAfjTokenPayment,
  } = validatedData

  try {
    // Récupère l'édition et vérifie les permissions d'édition
    const edition = await getEditionForEdit(editionId, user)

    // Si une convention est spécifiée, vérifier qu'elle existe et que l'utilisateur a les droits
    if (conventionId && conventionId !== edition.conventionId) {
      const convention = await prisma.convention.findUnique({
        where: { id: conventionId },
        include: {
          collaborators: {
            where: {
              userId: user.id,
              canManageCollaborators: true,
            },
          },
        },
      })

      if (!convention) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Convention introuvable',
        })
      }

      // Seuls l'auteur, les administrateurs, ou les admins globaux peuvent changer la convention d'une édition
      const canChangeConvention =
        convention.authorId === user.id || convention.collaborators.length > 0 || user.isGlobalAdmin

      if (!canChangeConvention) {
        throw createError({
          statusCode: 403,
          statusMessage: "Vous ne pouvez assigner des éditions qu'aux conventions que vous gérez",
        })
      }
    }

    // Gérer l'image - nouvelle approche : stocker seulement le nom de fichier
    console.log("=== GESTION DE L'IMAGE D'ÉDITION ===")
    console.log('validatedData.imageUrl:', imageUrl)
    console.log('Type de validatedData.imageUrl:', typeof imageUrl)

    let finalImageFilename = imageUrl

    // Déclarer tempFilename en dehors du try pour qu'il soit accessible dans le catch
    let tempFilename: string | undefined

    // Si une nouvelle image est fournie avec un path temporaire, extraire juste le nom
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('/temp/')) {
      try {
        console.log('Image temporaire détectée, traitement...')
        // Extraire le nom de fichier depuis l'URL temporaire
        // Ex: "/uploads/temp/editions/6/abc123.png" -> "abc123.png"
        tempFilename = imageUrl.split('/').pop()
        if (!tempFilename) {
          throw new Error("Nom de fichier temporaire de l'image non défini")
        }

        // Construire le chemin complet du fichier temporaire
        const tempPath = `temp/editions/${editionId}/${tempFilename}`
        const finalPath = `editions/${editionId}/${tempFilename}`

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
        const { readFile } = await import('fs/promises')
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
          `editions/${editionId}` // Dossier de destination
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
        finalImageFilename = newFilename

        console.log(`Fichier ${tempFilename} déplacé avec succès`)
        console.log(`Image finale qui sera stockée en DB: ${finalImageFilename}`)
      } catch (error) {
        console.error('ERREUR lors du déplacement du fichier:', error)
        // En cas d'erreur de déplacement, on stocke quand même le nom du fichier
        // Le fichier reste dans temp/ mais au moins on garde la référence
        finalImageFilename = tempFilename || null
        console.log(`Erreur de déplacement - on stocke quand même le nom: ${finalImageFilename}`)
        console.log(`Le fichier reste dans temp/ mais sera accessible`)
      }
    } else if (imageUrl && !imageUrl.includes('/temp/')) {
      // Si c'est déjà un nom de fichier simple, le garder tel quel
      console.log('Image déjà un nom de fichier simple ou URL existante')
      finalImageFilename = imageUrl.split('/').pop() || imageUrl
    }

    console.log(`=== FIN GESTION IMAGE - valeur finale: ${finalImageFilename} ===`)

    // Gérer la suppression de l'ancienne image si nécessaire
    if (imageUrl === null && edition.imageUrl) {
      try {
        // Si c'est juste un nom de fichier, construire le path complet
        const oldImagePath = edition.imageUrl.includes('/')
          ? edition.imageUrl.replace('/uploads/', '')
          : `editions/${editionId}/${edition.imageUrl}`

        // Utiliser deleteFile de nuxt-file-storage
        await deleteFile(oldImagePath)
        console.log(`Ancienne image supprimée avec nuxt-file-storage: ${oldImagePath}`)
      } catch (error) {
        // Log l'erreur mais ne pas faire échouer la mise à jour
        console.warn(`Impossible de supprimer l'ancienne image: ${edition.imageUrl}`, error)
      }
    }

    const updatedData: any = {
      conventionId: conventionId !== undefined ? conventionId : edition.conventionId,
      name: name !== undefined ? name?.trim() || null : edition.name,
      description: description || edition.description,
      imageUrl: finalImageFilename !== undefined ? finalImageFilename : edition.imageUrl,
      startDate: startDate ? new Date(startDate) : edition.startDate,
      endDate: endDate ? new Date(endDate) : edition.endDate,
      addressLine1: addressLine1 || edition.addressLine1,
      postalCode: postalCode || edition.postalCode,
      city: city || edition.city,
      region: region || edition.region,
      country: country || edition.country,
    }

    if (ticketingUrl !== undefined) updatedData.ticketingUrl = ticketingUrl
    if (officialWebsiteUrl !== undefined) updatedData.officialWebsiteUrl = officialWebsiteUrl
    if (facebookUrl !== undefined) updatedData.facebookUrl = facebookUrl
    if (instagramUrl !== undefined) updatedData.instagramUrl = instagramUrl
    if (hasFoodTrucks !== undefined) updatedData.hasFoodTrucks = hasFoodTrucks
    if (hasKidsZone !== undefined) updatedData.hasKidsZone = hasKidsZone
    if (acceptsPets !== undefined) updatedData.acceptsPets = acceptsPets
    if (hasTentCamping !== undefined) updatedData.hasTentCamping = hasTentCamping
    if (hasTruckCamping !== undefined) updatedData.hasTruckCamping = hasTruckCamping
    if (hasFamilyCamping !== undefined) updatedData.hasFamilyCamping = hasFamilyCamping
    if (hasGym !== undefined) updatedData.hasGym = hasGym
    if (hasFireSpace !== undefined) updatedData.hasFireSpace = hasFireSpace
    if (hasGala !== undefined) updatedData.hasGala = hasGala
    if (hasOpenStage !== undefined) updatedData.hasOpenStage = hasOpenStage
    if (hasConcert !== undefined) updatedData.hasConcert = hasConcert
    if (hasCantine !== undefined) updatedData.hasCantine = hasCantine
    if (hasAerialSpace !== undefined) updatedData.hasAerialSpace = hasAerialSpace
    if (hasSlacklineSpace !== undefined) updatedData.hasSlacklineSpace = hasSlacklineSpace
    if (hasToilets !== undefined) updatedData.hasToilets = hasToilets
    if (hasShowers !== undefined) updatedData.hasShowers = hasShowers
    if (hasAccessibility !== undefined) updatedData.hasAccessibility = hasAccessibility
    if (hasWorkshops !== undefined) updatedData.hasWorkshops = hasWorkshops
    if (hasCashPayment !== undefined) updatedData.hasCashPayment = hasCashPayment
    if (hasCreditCardPayment !== undefined) updatedData.hasCreditCardPayment = hasCreditCardPayment
    if (hasAfjTokenPayment !== undefined) updatedData.hasAfjTokenPayment = hasAfjTokenPayment

    // Si l'adresse a été modifiée, recalculer les coordonnées
    const addressChanged =
      addressLine1 !== undefined ||
      addressLine2 !== undefined ||
      city !== undefined ||
      postalCode !== undefined ||
      country !== undefined

    if (addressChanged) {
      const geoCoords = await geocodeEdition({
        addressLine1: addressLine1 || edition.addressLine1,
        addressLine2: addressLine2 !== undefined ? addressLine2 : (edition.addressLine2 ?? null),
        city: city || edition.city,
        postalCode: postalCode || edition.postalCode,
        country: country || edition.country,
      })

      updatedData.latitude = geoCoords.latitude
      updatedData.longitude = geoCoords.longitude
    }

    const updatedEdition = await prisma.edition.update({
      where: {
        id: editionId,
      },
      data: updatedData,
      include: {
        creator: {
          select: { id: true, pseudo: true },
        },
        favoritedBy: {
          select: { id: true },
        },
      },
    })
    return updatedEdition
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'édition:", error)

    if ((error as any)?.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de la mise à jour de l'édition",
    })
  }
})
