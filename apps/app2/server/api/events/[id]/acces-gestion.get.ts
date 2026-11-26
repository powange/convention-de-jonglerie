import {
  couvertureDeLEvenement,
  droitsSurEvenement,
  gestionOuverte,
  modulesAffiches,
  selectionModules,
} from '../../../utils/droits-evenement'
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
    select: selectionModules,
  })
  return {
    droits,
    abonnementActif: await gestionOuverte(eventId, userId),
    // Ce que couvre l'abonnement du propriétaire : les modules hors formule restent consultables,
    // en lecture seule (droits-evenement.ts).
    abonnement: await couvertureDeLEvenement(eventId),
    modules: modulesAffiches(evenement),
  }
})
