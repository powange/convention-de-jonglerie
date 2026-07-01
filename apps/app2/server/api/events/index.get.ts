import { requireUserSession } from '#imports'

import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const events = await prisma.event.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return { events }
})
