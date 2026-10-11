import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { demarrerChangementDAdresse } from '#server/utils/changement-d-adresse'
import { effacerAnciennePhoto } from '#server/utils/photo-de-profil'
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

    /*
     * ⚠⚠ LA PHOTO COURANTE SE LIT EN BASE, PAS DANS LA SESSION — constats B3 et B4.
     *
     * `AuthenticatedUser` ne porte que `id`, `email`, `pseudo` et `isGlobalAdmin` : `profilePicture`
     * n'y est PAS. La branche de suppression testait pourtant `user.profilePicture`, donc une
     * condition toujours fausse pour tout compte à mot de passe — personne n'effaçait jamais rien,
     * et le disque de production ne faisait que grossir pendant que la personne croyait avoir
     * retiré son image, toujours servie par `/api/uploads`.
     *
     * Une seule lecture sert les deux chemins : le REMPLACEMENT (qui ne supprimait pas l'ancien
     * fichier) et le RETRAIT.
     */
    const photoActuelle =
      profilePicture !== undefined
        ? ((
            await prisma.user.findUnique({
              where: { id: user.id },
              select: { profilePicture: true },
            })
          )?.profilePicture ?? null)
        : null

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

        /*
         * L'ANCIENNE PHOTO PART MAINTENANT, et pas avant — constat B3, premier chemin. Le
         * remplacement stockait la nouvelle et laissait la précédente sur le disque pour toujours.
         *
         * 📍 Après le stockage, délibérément : effacer d'abord et échouer ensuite laisserait un
         * compte sans aucune image, alors que la personne en remplaçait simplement une.
         */
        await effacerAnciennePhoto(photoActuelle, user.id)
      } catch (error) {
        console.error('Erreur lors du déplacement du fichier de profil:', error)
        /*
         * ⚠⚠ ON NE GARDE PLUS LE NOM DU FICHIER TEMPORAIRE — constat B4.
         *
         * Le `catch` enregistrait `x.png` « en cas d'erreur ». L'adresse construite ensuite,
         * `/uploads/profiles/<id>/x.png`, n'existe pas : la personne voyait une image CASSÉE
         * partout où elle apparaît, et la réponse était un 200 avec un message de succès.
         *
         * Un refus franc est préférable : le profil n'est pas touché, l'ancienne photo reste, et
         * le message dit quoi faire.
         */
        throw createError({
          status: 500,
          message: "La photo n'a pas pu être enregistrée, réessayez",
        })
      }
    } else if (profilePicture && !profilePicture.includes('/temp/')) {
      // Si c'est déjà un nom de fichier simple, le garder tel quel
      finalProfileFilename = profilePicture.split('/').pop() || profilePicture
    }

    // Le retrait de la photo : la valeur courante vient de la BASE (cf. plus haut).
    if (profilePicture === null) {
      await effacerAnciennePhoto(photoActuelle, user.id)
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
