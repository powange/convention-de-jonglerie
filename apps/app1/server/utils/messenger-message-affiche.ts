/**
 * Ce qu'un participant voit d'un message de la messagerie.
 *
 * Un message supprimé reste en base (suppression douce) : on renvoie « Message supprimé » à sa
 * place, et de même pour le message qu'il cite. La règle était recopiée par la liste et le flux
 * temps réel, et le flux oubliait la citation ; elle vit désormais ici.
 */

const CONTENU_SUPPRIME = 'Message supprimé'

interface MessageAvecCitation {
  content: string
  deletedAt: Date | null
  participantId?: string
  replyTo: { content: string; deletedAt: Date | null } | null
}

export function masquerMessageSupprime<T extends MessageAvecCitation>(
  message: T
): Omit<T, 'participantId'> {
  // `participantId` ne sert qu'à la jointure : l'auteur est déjà dans `participant`.
  const { participantId: _participantId, ...reste } = message
  return {
    ...reste,
    content: message.deletedAt ? CONTENU_SUPPRIME : message.content,
    replyTo: message.replyTo
      ? {
          ...message.replyTo,
          content: message.replyTo.deletedAt ? CONTENU_SUPPRIME : message.replyTo.content,
        }
      : null,
  }
}
