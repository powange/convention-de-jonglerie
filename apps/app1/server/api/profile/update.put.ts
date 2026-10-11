import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { demarrerChangementDAdresse } from '#server/utils/changement-d-adresse'
import { sanitizeString } from '#server/utils/validation-helpers'
import {
  updateProfileSchema,
  validateAndSanitize,
  handleValidationError,
} from '#server/utils/validation-schemas'

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
      pronouns,
      profilePicture,
      preferredLanguage,
      isVolunteer,
      isArtist,
      isOrganizer,
      dietaryPreference,
      allergies,
      allergySeverity,
      emergencyContactName,
      emergencyContactPhone,
    } = validatedData

    /*
     * ⚠️⚠️ L'ADRESSE NE S'ÉCRIT PLUS ICI — constat B2.
     *
     * Ce point d'API l'écrivait immédiatement, sans vérification et sans un mot à l'ancienne
     * adresse. Trois conséquences, toutes réelles :
     *
     *   1. une faute de frappe rendait la réinitialisation de mot de passe IMPOSSIBLE — on ne
     *      reçoit plus rien, et c'est l'adresse qui sert à récupérer son compte ;
     *   2. on pouvait s'attribuer l'adresse de quelqu'un d'autre et BLOQUER son inscription, la
     *      contrainte d'unicité faisant ensuite répondre « déjà utilisée » à son propriétaire ;
     *   3. une session volée devenait une prise de contrôle DÉFINITIVE : l'attaquant posait son
     *      adresse, puis se réinitialisait un mot de passe.
     *
     * L'inscription, elle, exige un code à six chiffres depuis toujours. Le profil contournait
     * cette exigence : il demande désormais la même chose.
     */
    const changementDAdresse =
      email !== user.email
        ? await demarrerChangementDAdresse({
            userId: user.id,
            nouvelleAdresse: email,
            motDePasseFourni: validatedData.currentPassword,
          })
        : null

    // Vérifier si le pseudo est déjà utilisé par un autre utilisateur
    if (pseudo !== user.pseudo) {
      const existingUser = await prisma.user.findUnique({
        where: { pseudo },
      })

      if (existingUser && existingUser.id !== user.id) {
        throw createError({
          status: 400,
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
        // `email` est ABSENT, volontairement : il ne bascule qu'à la confirmation du code.
        pseudo,
        nom: sanitizeString(nom),
        prenom: sanitizeString(prenom),
        phone: sanitizeString(telephone),
        // Pronom (elle / il / iel) — null si non renseigné
        ...(pronouns !== undefined && { pronouns: sanitizeString(pronouns) || null }),
        // Ne mettre à jour la photo que si explicitement fournie dans validatedData
        ...(profilePicture !== undefined && { profilePicture: finalProfileFilename }),
        // Mettre à jour la langue préférée si fournie
        ...(preferredLanguage !== undefined && { preferredLanguage }),
        // Mettre à jour les catégories utilisateur si fournies
        ...(isVolunteer !== undefined && { isVolunteer }),
        ...(isArtist !== undefined && { isArtist }),
        ...(isOrganizer !== undefined && { isOrganizer }),
        // Informations personnelles facultatives. Chacune n'est écrite que si elle figure dans
        // la requête : sans ce garde, un écran qui ne les envoie pas les effacerait.
        ...(dietaryPreference !== undefined && { dietaryPreference }),
        ...(allergies !== undefined && { allergies: sanitizeString(allergies) || null }),
        ...(allergySeverity !== undefined && { allergySeverity }),
        ...(emergencyContactName !== undefined && {
          emergencyContactName: sanitizeString(emergencyContactName) || null,
        }),
        ...(emergencyContactPhone !== undefined && {
          emergencyContactPhone: sanitizeString(emergencyContactPhone) || null,
        }),
        /*
         * `emailHash` suivait l'adresse, et il la suit toujours — mais à la CONFIRMATION, pas ici.
         * Le recalculer maintenant ferait afficher le Gravatar de la nouvelle adresse pour une
         * adresse qui n'est pas encore la sienne.
         */
      },
      select: {
        id: true,
        email: true,
        emailHash: true,
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        pronouns: true,
        profilePicture: true,
        preferredLanguage: true,
        isVolunteer: true,
        isArtist: true,
        isOrganizer: true,
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    /*
     * L'adresse en attente voyage avec la réponse — constat B2. Sans elle, l'écran afficherait
     * « profil enregistré » et l'ancienne adresse reviendrait dans le champ, sans un mot
     * d'explication : la personne croirait que son changement a été refusé en silence.
     */
    return createSuccessResponse({
      ...updatedUser,
      pendingEmail: changementDAdresse?.pendingEmail ?? null,
    })
  },
  { operationName: 'UpdateProfile' }
)
