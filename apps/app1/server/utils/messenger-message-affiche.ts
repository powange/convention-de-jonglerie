/**
 * Ce qu'un participant voit d'un message de la messagerie.
 *
 * Un message supprimé reste en base (suppression douce) : son contenu est remplacé par une CHAÎNE
 * VIDE, et de même pour le message qu'il cite. La règle était recopiée par la liste et le flux
 * temps réel, et le flux oubliait la citation ; elle vit désormais ici.
 *
 * ⚠️ POURQUOI UNE CHAÎNE VIDE ET NON « Message supprimé ». Le serveur écrivait ce libellé en
 * français, pour tout le monde. C'est le CLIENT qui affiche désormais `$t('messenger.deleted_message')`
 * quand `deletedAt` est posé — il connaissait déjà cet état (`isDeleted`).
 *
 * Un gain de robustesse en passant : un libellé en clair dans `content` peut se CONFONDRE avec un
 * vrai message. Quelqu'un qui écrit « Message supprimé » produisait une bulle indiscernable d'une
 * suppression. Une chaîne vide ne se confond avec rien.
 *
 * La protection, elle, est identique : le texte d'un message supprimé ne sort jamais du serveur —
 * ni par la liste, ni par la réponse d'un envoi, ni par le flux temps réel.
 */

const CONTENU_SUPPRIME = ''

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
