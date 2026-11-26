import { z } from 'zod'

import { droitsSurEvenement } from '../../../utils/droits-evenement'
import { idDepuisLaRoute } from '../../../utils/evenement-public'
import { verifierNouvelEvenement } from '../../../utils/quotas'

/**
 * Archive ou désarchive un événement (décision de l'utilisateur, 26/11/2026).
 *
 * Archivé, l'événement passe en LECTURE SEULE complète et ne compte plus parmi les événements en
 * cours de son propriétaire : c'est ainsi qu'on libère une place de sa formule, et qu'on sort du
 * surnombre après une fin d'abonnement. Rien n'est supprimé.
 *
 * Le propriétaire seul, ou un administrateur (même droit que la suppression). Archiver reste permis
 * quand la gestion est en lecture seule, puisque c'est le moyen d'en sortir. Désarchiver est soumis
 * au plafond d'événements en cours de la formule.
 */
const schema = z.object({ archive: z.boolean() })

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const userId = (user as { id: number }).id
  const id = await idDepuisLaRoute(event)

  const droits = await droitsSurEvenement(id, userId)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })
  if (!droits.supprimer) {
    throw createError({ status: 403, message: 'Seul le propriétaire peut archiver cet événement' })
  }
  const corps = schema.safeParse(await readBody(event).catch(() => null))
  if (!corps.success) throw createError({ status: 400, message: 'Données invalides' })

  const evenement = await prisma.event.findUniqueOrThrow({
    where: { id },
    select: { ownerId: true, archivedAt: true },
  })
  if (corps.data.archive === !!evenement.archivedAt) {
    return createSuccessResponse({ archivedAt: evenement.archivedAt }, 'Rien à changer')
  }
  // Seuls le propriétaire et un administrateur arrivent ici ; un administrateur qui n'est pas le
  // propriétaire désarchive sans être tenu par le plafond de celui-ci.
  if (!corps.data.archive && droits.estProprietaire) {
    await verifierNouvelEvenement(evenement.ownerId)
  }

  const maj = await prisma.event.update({
    where: { id },
    data: { archivedAt: corps.data.archive ? new Date() : null },
    select: { archivedAt: true },
  })
  return createSuccessResponse(
    { archivedAt: maj.archivedAt },
    corps.data.archive ? 'Événement archivé' : 'Événement désarchivé'
  )
})
