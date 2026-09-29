import type { ConversationMessage } from '~/composables/useMessenger'

/**
 * Tenir à jour la liste des messages d'une conversation, entre ce qui a été chargé et ce que le
 * flux temps réel apporte.
 *
 * Partagé par la messagerie et la discussion d'une candidature d'artiste : c'est la même
 * conversation, elle doit se tenir à jour de la même façon. La discussion de candidature avait sa
 * propre fusion, où la version chargée l'emportait toujours — une modification reçue en direct
 * n'y apparaissait donc jamais.
 */

/** Date de la dernière modification ou suppression d'un message : la plus grande l'emporte. */
export function fraicheurMessage(msg: ConversationMessage) {
  return Math.max(
    msg.editedAt ? new Date(msg.editedAt).getTime() : 0,
    msg.deletedAt ? new Date(msg.deletedAt).getTime() : 0
  )
}

/**
 * Les messages chargés et ceux du flux, dédoublonnés et triés par date d'envoi.
 *
 * Un même message existe souvent deux fois : celui qu'on envoie est ajouté à la liste chargée,
 * puis revient par le flux. On garde la version la plus récemment modifiée — la copie du flux
 * l'emportait d'office, et après une modification l'ancien texte revenait.
 */
export function fusionnerMessages(
  charges: readonly ConversationMessage[],
  tempsReel: readonly ConversationMessage[]
): ConversationMessage[] {
  const parId = new Map<string, ConversationMessage>()
  for (const msg of [...charges, ...tempsReel]) {
    const connu = parId.get(msg.id)
    if (!connu || fraicheurMessage(msg) >= fraicheurMessage(connu)) parId.set(msg.id, msg)
  }
  return Array.from(parId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}

/**
 * Applique aux messages chargés les mises à jour (modifications, suppressions) reçues du flux.
 *
 * TOUTES les mises à jour, pas seulement la dernière : le flux peut en livrer plusieurs avant que
 * l'écran ne réagisse. Rejouer la liste est sans effet sur les messages déjà à jour : on ne
 * remplace que par une version plus récente.
 */
export function appliquerMisesAJour(
  charges: readonly ConversationMessage[],
  misesAJour: readonly ConversationMessage[]
): ConversationMessage[] {
  const dernieres = new Map<string, ConversationMessage>()
  for (const maj of misesAJour) {
    const connue = dernieres.get(maj.id)
    if (!connue || fraicheurMessage(maj) >= fraicheurMessage(connue)) dernieres.set(maj.id, maj)
  }
  return charges.map((m) => {
    const maj = dernieres.get(m.id)
    return maj && fraicheurMessage(maj) >= fraicheurMessage(m) ? maj : m
  })
}

/** Remplace un message par sa nouvelle version, ou l'ajoute s'il n'était pas encore chargé. */
export function remplacerMessage(
  charges: readonly ConversationMessage[],
  message: ConversationMessage
): ConversationMessage[] {
  return charges.some((m) => m.id === message.id)
    ? charges.map((m) => (m.id === message.id ? message : m))
    : [...charges, message]
}
