import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { organisateursHabilitesSurLesArtistes } from '#server/utils/organisateurs-des-artistes'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * DELETE /api/editions/:id/shows-call/:showCallId/my-application — retirer sa candidature.
 *
 * ## Pourquoi ce point d'API existe
 *
 * Le cycle de vie côté artiste s'arrêtait à « soumettre, modifier tant que c'est en attente, puis
 * attendre ». **Aucun moyen de retirer.** Un artiste empêché, ou programmé ailleurs entre-temps,
 * écrivait donc dans la conversation de sa candidature — que personne ne lit forcément — et
 * l'organisateur conservait une **candidature fantôme** dans ses compteurs et dans le sondage.
 *
 * ## ⚠️ SEULEMENT EN ATTENTE, ET C'EST LA GARDE QUI COMPTE
 *
 * Une candidature ACCEPTÉE ne se retire pas d'un clic : l'organisateur a bâti sa programmation
 * dessus, et la faire disparaître sans un mot lui retirerait un numéro de son plateau. Le refus
 * est un 400 avec son motif, pas un silence — l'artiste doit comprendre qu'il lui faut en parler.
 *
 * Même raisonnement pour une candidature refusée : la retirer n'a aucun sens, et la laisser
 * disparaître effacerait la trace de la démarche.
 *
 * ## La conversation suit en cascade
 *
 * `Conversation.showApplicationId` porte `onDelete: Cascade` : les échanges partent avec la
 * candidature. C'est voulu — ils n'ont plus d'objet — et c'est aussi ce qui évite une conversation
 * orpheline que personne ne pourrait plus ouvrir.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({ status: 400, message: "ID de l'appel à spectacles invalide" })
    }

    const showCall = await prisma.editionShowCall.findFirst({
      where: { id: showCallId, editionId },
      select: { id: true, edition: { select: { id: true, name: true } } },
    })

    if (!showCall) {
      throw createError({ status: 404, message: 'Appel à spectacles non trouvé' })
    }

    /*
     * ⚠️ LA CANDIDATURE EST CHERCHÉE PAR LA CLÉ COMPOSITE `(showCallId, userId)`, donc on ne peut
     * pas retirer celle de quelqu'un d'autre : il n'y a pas d'identifiant à passer. Un 404 pour
     * une candidature qui n'existe pas, et pour celle d'un autre — ce qui est la même réponse, à
     * raison.
     */
    const candidature = await prisma.showApplication.findUnique({
      where: { showCallId_userId: { showCallId: showCall.id, userId: user.id } },
      select: { id: true, status: true, artistName: true, showTitle: true },
    })

    if (!candidature) {
      throw createError({ status: 404, message: 'Candidature non trouvée' })
    }

    if (candidature.status !== 'PENDING') {
      throw createError({
        status: 400,
        message:
          'Vous ne pouvez retirer votre candidature que si elle est en attente. Contactez les organisateurs.',
      })
    }

    await prisma.showApplication.delete({ where: { id: candidature.id } })

    /*
     * Les organisateurs sont prévenus APRÈS la suppression, et par la fonction partagée.
     *
     * ⚠️ `safeNotify` : une notification qui échoue ne doit pas faire échouer le retrait. La
     * candidature est déjà supprimée — rendre une erreur ferait croire à l'artiste que son retrait
     * n'a pas eu lieu, et il recommencerait sur une candidature qui n'existe plus.
     */
    const organisateurs = await organisateursHabilitesSurLesArtistes(editionId)
    const nomDEdition = showCall.edition.name || ''

    for (const organisateurId of organisateurs) {
      // L'artiste peut être organisateur de l'édition : il vient de retirer, il le sait.
      if (organisateurId === user.id) continue
      await safeNotify(
        () =>
          NotificationHelpers.showApplicationWithdrawn(
            organisateurId,
            candidature.artistName,
            candidature.showTitle,
            nomDEdition,
            editionId,
            showCall.id
          ),
        'notification candidature artiste retirée'
      )
    }

    return createSuccessResponse({ withdrawn: true })
  },
  { operationName: 'WithdrawShowCallApplication' }
)
