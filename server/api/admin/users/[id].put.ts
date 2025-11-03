import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { USER_ADMIN_SELECT } from '@@/server/utils/prisma-selects'
import {
  validateUserId,
  checkEmailUniqueness,
  checkPseudoUniqueness,
} from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const updateUserSchema = z.object({
  email: z.string().email('Email invalide'),
  pseudo: z.string().min(2, 'Le pseudo doit contenir au moins 2 caractères'),
  prenom: z.string().min(1, 'Le prénom est requis'),
  nom: z.string().min(1, 'Le nom est requis'),
  phone: z.string().optional(),
})

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
        updatedAt: new Date(),
      },
      select: USER_ADMIN_SELECT,
    })

    return updatedUser
  },
  { operationName: 'UpdateUser' }
)
