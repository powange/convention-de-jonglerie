// Câblage jonglerie des ports du module gestion des tâches. Lit les modèles concrets (Edition,
// Convention, ConventionOrganizer, EditionVolunteerApplication). Reste côté app ; le layer tasks ne
// consomme que les interfaces (types.ts).
import type { AssignableUser, TaskboardPorts } from './types'

const userSelect = {
  id: true,
  pseudo: true,
  prenom: true,
  nom: true,
  email: true,
  emailHash: true,
  profilePicture: true,
} as const

export function createDefaultTaskboardPorts(): TaskboardPorts {
  return {
    directory: {
      // Jonglerie : organisateurs (auteur convention + créateur édition + organisateurs convention)
      // + bénévoles ACCEPTED, dédupliqués par userId et triés par pseudo. (ex-assignable-users.get.)
      async getAssignableUsers(editionId): Promise<AssignableUser[]> {
        const edition = await prisma.edition.findUnique({
          where: { id: editionId },
          select: {
            creatorId: true,
            conventionId: true,
            convention: { select: { authorId: true } },
          },
        })
        if (!edition) return []

        const conventionAuthor = await prisma.user.findUnique({
          where: { id: edition.convention.authorId },
          select: userSelect,
        })
        const editionCreator = edition.creatorId
          ? await prisma.user.findUnique({ where: { id: edition.creatorId }, select: userSelect })
          : null
        const conventionOrganizers = await prisma.conventionOrganizer.findMany({
          where: { conventionId: edition.conventionId },
          select: { user: { select: userSelect } },
        })
        const acceptedVolunteers = await prisma.editionVolunteerApplication.findMany({
          where: { eventId: editionId, status: 'ACCEPTED' },
          select: { user: { select: userSelect } },
        })

        const map = new Map<number, AssignableUser>()
        if (conventionAuthor) map.set(conventionAuthor.id, conventionAuthor)
        if (editionCreator) map.set(editionCreator.id, editionCreator)
        for (const o of conventionOrganizers) if (o.user) map.set(o.user.id, o.user)
        for (const v of acceptedVolunteers) if (v.user) map.set(v.user.id, v.user)

        return [...map.values()].sort((a, b) => (a.pseudo || '').localeCompare(b.pseudo || ''))
      },
      // Jonglerie : existence de l'Edition + flag tasksEnabled. (ex-mine.get.)
      async isTasksEnabled(editionId) {
        const edition = await prisma.edition.findUnique({
          where: { id: editionId },
          select: { tasksEnabled: true },
        })
        if (!edition) return { found: false, enabled: false }
        return { found: true, enabled: edition.tasksEnabled }
      },
    },
  }
}
