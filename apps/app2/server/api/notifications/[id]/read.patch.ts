import { requireUserSession } from '#imports'

/** Marque une notification du compte comme lue. Celle d'un autre compte : 404, comme une absente. */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = String(getRouterParam(event, 'id') ?? '')
  const { count } = await prisma.notification.updateMany({
    where: { id, userId: (user as { id: number }).id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
  if (count === 0) {
    const existe = await prisma.notification.count({
      where: { id, userId: (user as { id: number }).id },
    })
    if (!existe) throw createError({ status: 404, message: 'Notification introuvable' })
  }
  return { ok: true }
})
