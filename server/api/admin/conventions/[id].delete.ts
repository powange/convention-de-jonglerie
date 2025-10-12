import { requireAuth } from '@@/server/utils/auth-utils'
import { validateConventionId } from '@@/server/utils/permissions/convention-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
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

  try {
    const conventionId = validateConventionId(getRouterParam(event, 'id'))

    // Récupérer la convention pour logging
    const convention = await prisma.convention.findUnique({
      where: { id: conventionId },
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

    if (!convention) {
      throw createError({
        statusCode: 404,
        message: 'Convention non trouvée',
      })
    }

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
  } catch (error) {
    if (typeof error === 'object' && error && 'statusCode' in error) throw error as any

    console.error('Erreur lors de la suppression admin de la convention:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur lors de la suppression définitive',
    })
  }
})
