import {
  exigerGestionDesOrganisateurs,
  organisateurDeLaRoute,
} from '../../../../utils/organisateurs-evenement'

/**
 * Retire un organisateur de l'événement. Son compte reste ; ses rattachements aux équipes et aux
 * créneaux de CET événement partent avec la ligne (cascade).
 */
export default defineEventHandler(async (event) => {
  const { eventId } = await exigerGestionDesOrganisateurs(event)
  const ligne = await organisateurDeLaRoute(event, eventId)
  await prisma.editionOrganizer.delete({ where: { id: ligne.id } })
  return createSuccessResponse({ id: ligne.id }, 'Organisateur retiré')
})
