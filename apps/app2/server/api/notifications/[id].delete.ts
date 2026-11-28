import { requireUserSession } from '#imports'

/** Supprime une notification du compte. Celle d'un autre compte : 404, comme une absente. */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { count } = await prisma.notification.deleteMany({
    where: { id: String(getRouterParam(event, 'id') ?? ''), userId: (user as { id: number }).id },
  })
  if (count === 0) throw createError({ status: 404, message: 'Notification introuvable' })
  return { ok: true }
})
