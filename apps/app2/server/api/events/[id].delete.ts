import { z } from 'zod'

import { droitsSurEvenement } from '../../utils/droits-evenement'
import { idDepuisLaRoute } from '../../utils/evenement-public'

/**
 * Supprime un événement, et avec lui TOUTES ses données (candidatures, équipes, créneaux, planning,
 * organisateurs : suppression en cascade au niveau de la base).
 *
 * Le propriétaire seul, ou un administrateur — décision de l'utilisateur. Et la personne retape le
 * nom de l'événement : une suppression qui efface des centaines de lignes ne part pas sur un clic
 * malheureux, ni sur une requête rejouée.
 */
const schema = z.object({ confirmation: z.string() })

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = await idDepuisLaRoute(event)

  const droits = await droitsSurEvenement(id, (user as { id: number }).id)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })
  if (!droits.supprimer) {
    throw createError({ status: 403, message: 'Seul le propriétaire peut supprimer cet événement' })
  }

  const corps = schema.safeParse(await readBody(event).catch(() => null))
  const evenement = await prisma.event.findUniqueOrThrow({ where: { id }, select: { name: true } })
  if (!corps.success || corps.data.confirmation.trim() !== evenement.name.trim()) {
    throw createError({
      status: 400,
      message: "Retapez le nom exact de l'événement pour confirmer",
    })
  }

  await prisma.event.delete({ where: { id } })
  return createSuccessResponse({ id }, 'Événement supprimé')
})
