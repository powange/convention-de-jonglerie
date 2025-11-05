import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateConventionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et droits admin
    const user = requireAuth(event)

    // Vérifier que l'utilisateur est admin global
    if (!user.isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        message:
          'Droits insuffisants - seuls les admins globaux peuvent supprimer définitivement des conventions',
      })
    }

    const conventionId = validateConventionId(event)

    // Récupérer la convention pour logging
    const convention = await fetchResourceOrFail(prisma.convention, conventionId, {
      errorMessage: 'Convention non trouvée',
      include: {
        editions: {
          select: { id: true, name: true },
        },
        collaborators: {
          select: { id: true },
        },
        author: {
          select: { id: true, pseudo: true },
        },
      },
    })

    // Log de l'action admin pour audit
    console.log(
      `[ADMIN DELETE] Convention "${convention.name}" (ID: ${conventionId}) supprimée définitivement par l'admin ${user.pseudo} (ID: ${user.id})`
    )
    console.log(`[ADMIN DELETE] - Éditions supprimées: ${convention.editions.length}`)
    console.log(`[ADMIN DELETE] - Collaborateurs supprimés: ${convention.collaborators.length}`)

    // Suppression en cascade (Prisma s'en charge avec onDelete: Cascade dans le schéma)
    await prisma.convention.delete({
      where: { id: conventionId },
    })

    return {
      message: 'Convention supprimée définitivement avec succès',
      deletedConvention: {
        id: conventionId,
        name: convention.name,
        editionsCount: convention.editions.length,
        collaboratorsCount: convention.collaborators.length,
      },
    }
  },
  { operationName: 'AdminDeleteConvention' }
)
