import { droitsSurEvenement, gestionOuverte } from '../../../utils/droits-evenement'
import { idDepuisLaRoute } from '../../../utils/evenement-public'

/**
 * Ce que montre l'accueil de la gestion d'un événement : l'événement, les droits de la personne,
 * les modules actifs, et les chiffres de chaque module qu'elle peut gérer — rien de ce qu'elle ne
 * pourrait pas ouvrir.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const userId = (user as { id: number }).id
  const eventId = await idDepuisLaRoute(event)
  const droits = await droitsSurEvenement(eventId, userId)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })

  const evenement = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      id: true,
      publicId: true,
      name: true,
      location: true,
      startDate: true,
      endDate: true,
      timezone: true,
      volunteersEnabled: true,
      volunteerSettings: { select: { open: true, pagePublic: true } },
      _count: { select: { editionOrganizers: true } },
    },
  })

  let benevoles = null
  if (evenement.volunteersEnabled && droits.benevoles) {
    const [parStatut, equipes, creneaux, echanges] = await Promise.all([
      prisma.editionVolunteerApplication.groupBy({
        by: ['status'],
        where: { eventId },
        _count: { _all: true },
      }),
      prisma.volunteerTeam.count({ where: { eventId } }),
      prisma.volunteerTimeSlot.count({ where: { eventId } }),
      prisma.volunteerSwapRequest.count({ where: { eventId, status: 'PENDING_MANAGER' } }),
    ])
    const compte = (s: string) => parStatut.find((p) => p.status === s)?._count._all ?? 0
    benevoles = {
      enAttente: compte('PENDING'),
      acceptes: compte('ACCEPTED'),
      equipes,
      creneaux,
      echangesAValider: echanges,
      candidaturesOuvertes: !!evenement.volunteerSettings?.open,
      pagePublique: !!evenement.volunteerSettings?.pagePublic,
    }
  }

  return {
    evenement: {
      id: evenement.id,
      publicId: evenement.publicId,
      name: evenement.name,
      location: evenement.location,
      startDate: evenement.startDate,
      endDate: evenement.endDate,
      timezone: evenement.timezone,
    },
    droits,
    abonnementActif: await gestionOuverte(eventId, userId),
    modules: { benevoles: evenement.volunteersEnabled },
    organisateurs: evenement._count.editionOrganizers,
    benevoles,
  }
})
