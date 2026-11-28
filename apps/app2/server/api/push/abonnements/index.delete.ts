import { z } from 'zod'

import { requireUserSession } from '#imports'

/**
 * Désabonne un appareil du compte : par son `endpoint` (cet appareil, à la désactivation ou à la
 * déconnexion) ou par son `id` (un autre appareil, depuis la liste). Absent : rien à faire.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const corps = z
    .object({ endpoint: z.string().max(700).optional(), id: z.number().int().optional() })
    .refine((c) => c.endpoint || c.id, 'Appareil manquant')
    .safeParse(await readBody(event))
  if (!corps.success) throw createError({ status: 400, message: 'Appareil manquant' })
  const { count } = await prisma.pushSubscription.deleteMany({
    where: {
      userId: (user as { id: number }).id,
      ...(corps.data.endpoint ? { endpoint: corps.data.endpoint } : { id: corps.data.id }),
    },
  })
  return { retires: count }
})
