import { wrapApiHandler } from '#server/utils/api-helpers'
import { deleteCommentForEntity } from '#server/utils/commentsHandler'

/**
 * DELETE /api/carpool-offers/:id/comments/:commentId — retirer son propre commentaire.
 *
 * ## ⚠️ POURQUOI CE FICHIER N'EXISTAIT PAS
 *
 * `deleteCommentForEntity` était écrite — garde d'auteur comprise, 403 pour un tiers, 404 pour un
 * commentaire inconnu — et **n'avait aucun appelant**. Les quatre points d'API du module étaient
 * deux `.get` et deux `.post` : un commentaire posté par erreur était **définitif pour son
 * auteur**, qui n'avait aucun moyen de le retirer.
 *
 * 📍 C'est le second cas du même motif dans ce seul constat — `commentSchema` était lui aussi
 * écrit, testé et branché nulle part. Du code qui porte sa logique ET ses tests sans être atteint
 * donne la couverture d'une fonctionnalité sans la fonctionnalité.
 *
 * ## La garde vit dans la fonction partagée, pas ici
 *
 * `requireAuth: true` suffit : c'est `deleteCommentForEntity` qui compare `comment.userId` à
 * l'utilisateur de la session et refuse en 403. La recopier ici en ferait une seconde version à
 * faire vieillir en parallèle — le défaut que ce dépôt passe sa journée à refermer.
 */
export default wrapApiHandler(
  async (event) => {
    const resultat = await deleteCommentForEntity(event, {
      entityType: 'carpoolOffer',
      entityIdField: 'carpoolOfferId',
      requireAuth: true,
    })
    return createSuccessResponse(resultat)
  },
  { operationName: 'DeleteCarpoolOfferComment' }
)
