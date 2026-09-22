import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { userAdminSelect } from '#server/utils/prisma-select-helpers'
import {
  validateUserId,
  checkEmailUniqueness,
  checkPseudoUniqueness,
} from '#server/utils/validation-helpers'
import { updateProfileSchema } from '#server/utils/validation-schemas'

const updateUserSchema = z
  .object({
    email: z.string().email('Email invalide'),
    pseudo: z.string().min(2, 'Le pseudo doit contenir au moins 2 caractères'),
    prenom: z.string().min(1, 'Le prénom est requis'),
    nom: z.string().min(1, 'Le nom est requis'),
    phone: z.string().optional(),
  })
  // Les champs de santé sont PRIS au schéma du profil, jamais redéfinis ici.
  //
  // Une allergie corrigée par un administrateur doit obéir aux mêmes bornes que celle saisie par
  // l'intéressé : des règles plus larges d'un côté laisseraient entrer une valeur que le
  // formulaire de l'autre refuse, et personne ne saurait laquelle des deux fait foi. Les
  // recopier aurait posé la question à la première modification de l'une des deux.
  .merge(
    updateProfileSchema.pick({
      allergies: true,
      allergySeverity: true,
      emergencyContactPhone: true,
    })
  )

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin
    await requireGlobalAdminWithDbCheck(event)

    // Valider l'ID utilisateur
    const userId = validateUserId(event)

    const body = await readBody(event)

    // Valider les données d'entrée
    const validatedData = updateUserSchema.parse(body)

    // Vérifier que l'utilisateur existe
    const existingUser = await fetchResourceOrFail(prisma.user, userId, {
      errorMessage: 'Utilisateur introuvable',
    })

    // Vérifier l'unicité de l'email et du pseudo si modifiés
    if (validatedData.email !== existingUser.email) {
      await checkEmailUniqueness(validatedData.email, userId)
    }

    if (validatedData.pseudo !== existingUser.pseudo) {
      await checkPseudoUniqueness(validatedData.pseudo, userId)
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: validatedData.email,
        pseudo: validatedData.pseudo,
        prenom: validatedData.prenom,
        nom: validatedData.nom,
        phone: validatedData.phone || null,
        // `undefined` veut dire « non transmis », et non « à vider » : un appel qui ne porte pas
        // ces champs ne doit pas effacer une allergie que l'intéressé a saisie.
        ...(validatedData.allergies !== undefined && {
          allergies: validatedData.allergies?.trim() || null,
        }),
        ...(validatedData.allergySeverity !== undefined && {
          allergySeverity: validatedData.allergySeverity,
        }),
        ...(validatedData.emergencyContactPhone !== undefined && {
          emergencyContactPhone: validatedData.emergencyContactPhone?.trim() || null,
        }),
        updatedAt: new Date(),
      },
      select: userAdminSelect,
    })

    return createSuccessResponse(updatedUser)
  },
  { operationName: 'UpdateUser' }
)
