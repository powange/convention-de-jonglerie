import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/tasks/assignable-users
 *
 * Retourne la liste des utilisateurs qui peuvent être assignés à une
 * tâche : organisateurs (peu importe leurs droits) + bénévoles dont la
 * candidature est ACCEPTED sur cette édition. Déduplique par userId.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const userSelect = {
      id: true,
      pseudo: true,
      prenom: true,
      nom: true,
      email: true,
      emailHash: true,
      profilePicture: true,
    } as const

    // Auteur convention
    const conventionAuthor = await prisma.user.findUnique({
      where: { id: edition.convention.authorId },
      select: userSelect,
    })

    // Créateur édition (souvent le même mais peut différer)
    const editionCreator = edition.creatorId
      ? await prisma.user.findUnique({ where: { id: edition.creatorId }, select: userSelect })
      : null

    // Organisateurs au niveau convention
    const conventionOrganizers = await prisma.conventionOrganizer.findMany({
      where: { conventionId: edition.conventionId },
      select: { user: { select: userSelect } },
    })

    // Bénévoles ACCEPTED sur cette édition
    const acceptedVolunteers = await prisma.editionVolunteerApplication.findMany({
      where: { editionId, status: 'ACCEPTED' },
      select: { user: { select: userSelect } },
    })

    const map = new Map<number, (typeof conventionAuthor & object) | null>()
    if (conventionAuthor) map.set(conventionAuthor.id, conventionAuthor)
    if (editionCreator) map.set(editionCreator.id, editionCreator)
    for (const o of conventionOrganizers) {
      if (o.user) map.set(o.user.id, o.user as any)
    }
    for (const v of acceptedVolunteers) {
      if (v.user) map.set(v.user.id, v.user as any)
    }

    const users = [...map.values()]
      .filter(Boolean)
      .sort((a, b) => (a!.pseudo || '').localeCompare(b!.pseudo || ''))

    return createSuccessResponse({ users })
  },
  { operationName: 'GetAssignableUsersForTasks' }
)
