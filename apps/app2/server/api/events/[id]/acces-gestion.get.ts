import { droitsSurEvenement, gestionOuverte } from '../../../utils/droits-evenement'
import { idDepuisLaRoute } from '../../../utils/evenement-public'

/**
 * Ce que la gestion de cet événement ouvre à la personne : ses droits, et si l'abonnement du
 * PROPRIÉTAIRE la débloque (décision de l'utilisateur : un organisateur n'a pas besoin du sien).
 * Lu par le middleware `subscription` des pages de gestion et par la barre latérale.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const userId = (user as { id: number }).id
  const eventId = await idDepuisLaRoute(event)
  const droits = await droitsSurEvenement(eventId, userId)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })
  const evenement = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { volunteersEnabled: true },
  })
  return {
    droits,
    abonnementActif: await gestionOuverte(eventId, userId),
    modules: { benevoles: evenement.volunteersEnabled },
  }
})
