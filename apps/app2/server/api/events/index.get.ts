import { requireUserSession } from '#imports'

import prisma from '../../utils/prisma'

/**
 * Les événements de la personne : ceux qu'elle a créés, et ceux dont elle est co-organisatrice
 * (`estProprietaire` les distingue). Les plus récents d'abord.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const events = await prisma.event.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { editionOrganizers: { some: { organizer: { userId: user.id } } } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })

  return { events: events.map((e) => ({ ...e, estProprietaire: e.ownerId === user.id })) }
})
