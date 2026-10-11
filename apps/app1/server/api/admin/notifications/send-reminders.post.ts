import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'
import { envoyerLesRappelsDEdition } from '#server/utils/rappels-editions'

/**
 * POST /api/admin/notifications/send-reminders — déclenche les rappels d'édition à la main.
 *
 * ## ⚠️ LA RÈGLE A DÉMÉNAGÉ — constat B4
 *
 * Elle vivait ici, et elle était juste : favoris, bénévoles acceptés, paliers J-3 et J-7,
 * déduplication sur 24 h. Mais elle n'était **jamais planifiée** — il fallait qu'un administrateur
 * clique —, pendant que la tâche quotidienne censée le faire incrémentait un compteur **sans rien
 * envoyer**. Les deux appellent désormais `rappels-editions.ts`.
 *
 * 📍 Ce point d'API garde sa raison d'être : rattraper une journée où la tâche n'a pas tourné, ou
 * vérifier le dispositif sans attendre 10 h. La déduplication des 24 h fait qu'un déclenchement de
 * plus n'envoie rien en double.
 *
 * 📍 Le nom de la réponse ne change pas (`remindersSent`) : l'écran d'administration le lit.
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    const { editionsProcessed, notificationsSent } = await envoyerLesRappelsDEdition()

    return createSuccessResponse(
      {
        editionsProcessed,
        remindersSent: notificationsSent,
      },
      `${notificationsSent} rappel(s) envoyé(s) pour ${editionsProcessed} édition(s)`
    )
  },
  { operationName: 'SendEditionReminders' }
)
