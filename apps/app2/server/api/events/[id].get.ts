import { droitsSurEvenement } from '../../utils/droits-evenement'
import { idDepuisLaRoute } from '../../utils/evenement-public'

/**
 * Un événement, pour qui peut le voir (propriétaire, organisateur, administrateur), avec ce que
 * la personne peut en faire. Un événement qu'elle ne peut pas voir répond 404, comme un absent.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = await idDepuisLaRoute(event)

  const droits = await droitsSurEvenement(id, (user as { id: number }).id)
  const found = droits.voir ? await prisma.event.findUnique({ where: { id } }) : null
  if (!found) throw createError({ status: 404, message: 'Événement introuvable' })

  return { event: found, droits }
})
