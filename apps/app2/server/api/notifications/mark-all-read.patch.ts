import { requireUserSession } from '#imports'

/** Marque toutes les notifications du compte comme lues. */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { count } = await prisma.notification.updateMany({
    where: { userId: (user as { id: number }).id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
  return { marquees: count }
})
