import { z } from 'zod'

import { modulesDisponibles } from '../../../../shared/modules-evenement'
import {
  droitsSurEvenement,
  modulesAffiches,
  selectionModules,
} from '../../../utils/droits-evenement'
import { idDepuisLaRoute } from '../../../utils/evenement-public'

import type { CleModule } from '../../../../shared/modules-evenement'

/**
 * Active ou désactive un ou plusieurs modules d'un événement (`{ stock: true }`…). Droit « modifier
 * l'événement ». Seuls les modules portés dans Flowvent (`disponible`) sont acceptés : un module
 * pas encore porté n'a rien à ouvrir.
 *
 * Désactiver ne supprime rien : les données du module restent, et reviennent telles quelles à la
 * réactivation. Seuls disparaissent sa section de gestion et ses pages publiques.
 *
 * Tous les modules sont compris dans toutes les formules (décision du 26/11/2026) : seul le droit
 * compte.
 */
const schema = z
  .object(
    Object.fromEntries(modulesDisponibles().map((m) => [m.cle, z.boolean().optional()])) as Record<
      CleModule,
      z.ZodOptional<z.ZodBoolean>
    >
  )
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'Aucun module à modifier')

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

  const data = Object.fromEntries(
    modulesDisponibles()
      .filter((m) => resultat.data[m.cle] !== undefined)
      .map((m) => [m.colonne, resultat.data[m.cle]])
  )
  const maj = await prisma.event.update({
    where: { id: eventId },
    data,
    select: selectionModules,
  })
  return createSuccessResponse({ modules: modulesAffiches(maj) }, 'Modules mis à jour')
})
