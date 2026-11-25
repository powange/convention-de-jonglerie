import { z } from 'zod'

import { droitsSurEvenement } from '../../../utils/droits-evenement'
import { idDepuisLaRoute } from '../../../utils/evenement-public'

/**
 * Active ou désactive les modules d'un événement — aujourd'hui le seul module bénévoles ; chaque
 * module à venir ajoutera sa clé. Droit « modifier l'événement ».
 *
 * Désactiver ne supprime rien : candidatures, équipes et planning restent, et reviennent tels
 * quels à la réactivation. Seuls disparaissent la section de gestion et la page publique.
 */
const schema = z.object({ benevoles: z.boolean() })

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const eventId = await idDepuisLaRoute(event)
  const droits = await droitsSurEvenement(eventId, (user as { id: number }).id)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })
  if (!droits.modifier) {
    throw createError({ status: 403, message: 'Vous ne pouvez pas modifier les modules' })
  }

  const resultat = schema.safeParse(await readBody(event))
  if (!resultat.success) throw createError({ status: 400, message: 'Données invalides' })

  const maj = await prisma.event.update({
    where: { id: eventId },
    data: { volunteersEnabled: resultat.data.benevoles },
    select: { volunteersEnabled: true },
  })
  return createSuccessResponse(
    { modules: { benevoles: maj.volunteersEnabled } },
    'Modules mis à jour'
  )
})
