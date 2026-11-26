import { z } from 'zod'

import { requireUserSession } from '#imports'

import prisma from '../../utils/prisma'
import { verifierNouvelEvenement } from '../../utils/quotas'

const createEventSchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'événement est requis").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  // Tout compte peut créer un événement, dans la limite des événements EN COURS de sa formule — la
  // formule gratuite comprise (décision du 26/11/2026, server/utils/quotas.ts).
  await verifierNouvelEvenement(user.id)
  const data = createEventSchema.parse(await readBody(event))

  const created = await prisma.event.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      location: data.location ?? null,
      startDate: data.startDate ?? null,
      ownerId: user.id,
    },
  })

  return { event: created }
})
