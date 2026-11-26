import { z } from 'zod'

import { requireUserSession } from '#imports'

import { modulesCouverts } from '../../../shared/formules'
import prisma from '../../utils/prisma'
import { requireActiveSubscription } from '../../utils/subscription'

const createEventSchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'événement est requis").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  // Créer un événement demande SON PROPRE abonnement (décision de l'utilisateur : un co-organisateur
  // sans abonnement gère les événements des autres, mais n'en crée pas). La page le filtrait seule.
  const abonnement = await requireActiveSubscription(event, user.id)
  const data = createEventSchema.parse(await readBody(event))

  const created = await prisma.event.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      location: data.location ?? null,
      startDate: data.startDate ?? null,
      ownerId: user.id,
      // Le module bénévoles est actif par défaut (schéma) : seulement si la formule le couvre, pour
      // qu'un nouvel événement ne s'ouvre pas sur un module en lecture seule.
      volunteersEnabled: modulesCouverts(abonnement.formule, abonnement.modules).includes(
        'benevoles'
      ),
    },
  })

  return { event: created }
})
