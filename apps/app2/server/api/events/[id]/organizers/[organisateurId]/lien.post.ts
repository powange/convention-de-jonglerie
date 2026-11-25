import { estEnAttente, nouveauLienInvitation } from '../../../../../utils/invitation'
import {
  exigerGestionDesOrganisateurs,
  organisateurDeLaRoute,
} from '../../../../../utils/organisateurs-evenement'

/**
 * Un nouveau lien d'activation pour un organisateur invité qui n'a pas encore activé son compte —
 * Flowvent n'envoyant pas de courriel, un lien perdu ou expiré se remplace ici.
 */
export default defineEventHandler(async (event) => {
  const { eventId } = await exigerGestionDesOrganisateurs(event)
  const ligne = await organisateurDeLaRoute(event, eventId)
  const compte = await prisma.user.findUniqueOrThrow({
    where: { id: ligne.organizer.userId },
    select: { password: true, isEmailVerified: true },
  })
  if (!estEnAttente(compte)) {
    throw createError({ status: 409, message: 'Ce compte est déjà activé' })
  }
  return createSuccessResponse({
    lienInvitation: await nouveauLienInvitation(ligne.organizer.userId),
  })
})
