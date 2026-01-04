import { readFile } from 'fs/promises'

import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getConventionForEdit } from '@@/server/utils/permissions/convention-permissions'
import { validateConventionId } from '@@/server/utils/validation-helpers'
import { updateConventionSchema, validateAndSanitize } from '@@/server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification
    const user = requireAuth(event)

    const conventionId = validateConventionId(event)

    const body = await readBody(event)

    // Validation et sanitisation des données avec Zod
    const validatedData = validateAndSanitize(updateConventionSchema, body)

    // Récupère la convention et vérifie les permissions d'édition
    const existingConvention = await getConventionForEdit(conventionId, user)

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

        // Construire le chemin du dossier temporaire
        const tempFolder = `temp/conventions/${conventionId}`
        const finalFolder = `conventions/${conventionId}`

        console.log(`Nom de fichier extrait: ${tempFilename}`)
        console.log(`Tentative de déplacement de ${tempFolder}/${tempFilename} vers ${finalFolder}/${tempFilename}`)

        // getFileLocally prend (filename, filelocation) séparément
        console.log(`Récupération du path via nuxt-file-storage: ${tempFilename} dans ${tempFolder}`)
        const tempFilePath = getFileLocally(tempFilename, tempFolder)

        if (!tempFilePath) {
          throw new Error(`Fichier temporaire introuvable via nuxt-file-storage: ${tempFolder}/${tempFilename}`)
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
          await deleteFile(tempFilename, tempFolder)
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
        // Extraire le nom du fichier et le dossier
        const oldFilename = existingConvention.logo.includes('/')
          ? existingConvention.logo.split('/').pop()!
          : existingConvention.logo
        const oldFolder = existingConvention.logo.includes('/')
          ? existingConvention.logo.replace('/uploads/', '').split('/').slice(0, -1).join('/')
          : `conventions/${conventionId}`

        // Utiliser deleteFile de nuxt-file-storage avec (filename, folder)
        await deleteFile(oldFilename, oldFolder)
        console.log(`Ancien logo supprimé: ${oldFilename} dans ${oldFolder}`)
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
        // Ne mettre à jour l'email que si explicitement fourni dans validatedData
        ...(validatedData.email !== undefined && { email: validatedData.email || null }),
        // Ne mettre à jour le logo que si explicitement fourni dans validatedData
        ...(validatedData.logo !== undefined && { logo: finalLogoFilename }),
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
          },
        },
      },
    })

    return updatedConvention
  },
  { operationName: 'UpdateConvention' }
)
