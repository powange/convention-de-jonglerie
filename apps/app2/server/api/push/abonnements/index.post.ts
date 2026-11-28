import { z } from 'zod'

import { requireUserSession } from '#imports'

const schema = z.object({
  // L'adresse du service de push du navigateur : toujours en https.
  endpoint: z.string().url().startsWith('https://').max(700),
  keys: z.object({ p256dh: z.string().min(1).max(255), auth: z.string().min(1).max(255) }),
})

/**
 * Abonne CET appareil aux notifications push du compte connecté (ce que rend
 * `pushManager.subscribe`). Rejoué à chaque ouverture tant que la permission est accordée : un
 * appareil passé d'un compte à l'autre est ainsi rattaché au compte connecté, jamais aux deux.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const userId = (user as { id: number }).id
  const resultat = schema.safeParse(await readBody(event))
  if (!resultat.success) throw createError({ status: 400, message: 'Abonnement invalide' })
  const { endpoint, keys } = resultat.data
  const userAgent = getHeader(event, 'user-agent')?.slice(0, 500) ?? null
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  })
  return { ok: true }
})
