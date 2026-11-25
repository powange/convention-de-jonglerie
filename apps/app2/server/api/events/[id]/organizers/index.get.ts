import { droitsSurEvenement } from '../../../../utils/droits-evenement'
import { idDepuisLaRoute } from '../../../../utils/evenement-public'
import {
  compteAffiche,
  droitsAffiches,
  selectionCompte,
} from '../../../../utils/organisateurs-evenement'

/**
 * Le propriétaire et les organisateurs d'un événement, avec leurs droits. Visible de quiconque voit
 * la gestion ; les adresses e-mail, seulement de qui peut gérer les organisateurs.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const eventId = await idDepuisLaRoute(event)
  const droits = await droitsSurEvenement(eventId, (user as { id: number }).id)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })

  const evenement = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      owner: { select: selectionCompte },
      editionOrganizers: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          canEditEvent: true,
          canManageOrganizers: true,
          canManageVolunteers: true,
          organizer: { select: { user: { select: selectionCompte } } },
        },
      },
    },
  })

  const avecEmail = droits.organisateurs
  return {
    peutGerer: droits.organisateurs,
    proprietaire: compteAffiche(evenement.owner, avecEmail),
    organisateurs: evenement.editionOrganizers.map((o) => ({
      id: o.id,
      compte: compteAffiche(o.organizer.user, avecEmail),
      droits: droitsAffiches(o),
    })),
  }
})
