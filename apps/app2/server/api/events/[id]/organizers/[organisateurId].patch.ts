import {
  droitsAffiches,
  droitsEnBase,
  exigerGestionDesOrganisateurs,
  organisateurDeLaRoute,
  schemaDroits,
} from '../../../../utils/organisateurs-evenement'
import { selectionDroits } from '../../../../utils/droits-evenement'

/** Règle les droits d'un organisateur (un ou plusieurs domaines à la fois). */
const schema = schemaDroits.refine((d) => Object.keys(d).length > 0, 'Aucun droit à modifier')

export default defineEventHandler(async (event) => {
  const { eventId } = await exigerGestionDesOrganisateurs(event)
  const ligne = await organisateurDeLaRoute(event, eventId)
  const resultat = schema.safeParse(await readBody(event))
  if (!resultat.success) {
    throw createError({
      status: 400,
      message: resultat.error.issues[0]?.message ?? 'Données invalides',
    })
  }
  const maj = await prisma.editionOrganizer.update({
    where: { id: ligne.id },
    data: droitsEnBase(resultat.data),
    select: selectionDroits,
  })
  return createSuccessResponse({ droits: droitsAffiches(maj) }, 'Droits mis à jour')
})
