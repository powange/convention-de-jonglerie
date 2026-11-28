import { requireUserSession } from '#imports'

/** Les appareils du compte abonnés au push, pour les reconnaître et en retirer un. */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const abonnements = await prisma.pushSubscription.findMany({
    where: { userId: (user as { id: number }).id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, endpoint: true, userAgent: true, createdAt: true, lastSuccessAt: true },
  })
  return { abonnements }
})
