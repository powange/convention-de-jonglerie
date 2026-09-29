/**
 * Trier les événements du flux global entre la conversation regardée et les autres.
 *
 * ⚠️ POURQUOI CETTE FONCTION EST À PART. Depuis que les messages sont POUSSÉS par le flux global au
 * lieu d'être sondés par un flux par conversation, tout arrive dans une file unique : les messages
 * de la conversation ouverte, et ceux de toutes les autres. Il faut donc en prélever sa part — et ce
 * prélèvement est la seule vraie logique du composable, celle qui peut se tromper en silence.
 *
 * Deux erreurs qu'elle évite, et qui ne se verraient qu'à l'usage :
 *
 * - **ne rien retirer de la file** : changer de conversation puis revenir rejouerait tous les
 *   messages reçus depuis le début de la session, en double sous ceux déjà affichés ;
 * - **tout retirer** : les messages destinés aux autres conversations disparaîtraient avant que
 *   celles-ci ne soient ouvertes, et leur contenu n'apparaîtrait qu'au rechargement.
 *
 * Elle ne mute rien : l'appelant remplace sa file par `reste`. C'est ce qui la rend testable hors
 * de tout composant, sans Pinia, sans `EventSource` et sans flux ouvert.
 */
export interface EvenementDeConversation {
  conversationId: string
}

export function partagerParConversation<T extends EvenementDeConversation>(
  evenements: readonly T[],
  conversationId: string | null | undefined
): { pourMoi: T[]; reste: T[] } {
  // Sans conversation regardée, on ne prélève RIEN : vider la file ici ferait disparaître des
  // messages que personne n'a encore lus.
  if (!conversationId) return { pourMoi: [], reste: [...evenements] }

  const pourMoi: T[] = []
  const reste: T[] = []
  for (const evenement of evenements) {
    if (evenement.conversationId === conversationId) pourMoi.push(evenement)
    else reste.push(evenement)
  }
  return { pourMoi, reste }
}

/**
 * Les messages à ajouter, ceux déjà présents écartés.
 *
 * L'auteur d'un message le reçoit par la réponse de son envoi ; une reconnexion du flux global peut
 * aussi rejouer un événement. Sans ce filtre, le message apparaîtrait deux fois — et c'est le genre
 * de défaut qu'on ne voit qu'en écrivant à deux.
 */
export function messagesAbsents<T extends { id?: string }>(
  candidats: readonly T[],
  dejaLa: readonly { id: string }[]
): T[] {
  const connus = new Set(dejaLa.map((m) => m.id))
  const ajoutes = new Set<string>()
  return candidats.filter((candidat) => {
    if (!candidat.id) return true
    // `ajoutes` en plus de `connus` : deux exemplaires du même message dans la MÊME salve doivent
    // aussi être départagés, et la liste de référence n'a pas encore été modifiée.
    if (connus.has(candidat.id) || ajoutes.has(candidat.id)) return false
    ajoutes.add(candidat.id)
    return true
  })
}
