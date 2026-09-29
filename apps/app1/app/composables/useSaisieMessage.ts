import type { ConversationMessage } from '~/composables/useMessenger'

import type { Ref } from 'vue'

import {
  DELAI_MODIFICATION_MESSAGE_MINUTES,
  messageEncoreModifiable,
} from '~~/shared/utils/message-modifiable'

/**
 * Ce que la zone de saisie d'une conversation est en train de faire : écrire un nouveau message,
 * répondre à l'un, ou en modifier un.
 *
 * Partagé par la messagerie et la discussion d'une candidature d'artiste. Répondre et modifier se
 * partagent la zone de saisie : l'un chasse l'autre. Modifier remonte le texte du message dans la
 * zone ; annuler rend le brouillon qu'on écrivait avant.
 *
 * @param texte Le contenu de la zone de saisie (son `v-model`).
 */
export function useSaisieMessage(texte: Ref<string>) {
  const { t } = useI18n()
  const toast = useToast()
  const { editMessage } = useMessenger()

  const reponseA = ref<ConversationMessage | null>(null)
  const enModification = ref<ConversationMessage | null>(null)
  const brouillonAvantModification = ref('')

  function repondreA(message: ConversationMessage) {
    if (enModification.value) annulerModification()
    reponseA.value = message
  }

  function annulerReponse() {
    reponseA.value = null
  }

  function modifier(message: ConversationMessage) {
    reponseA.value = null
    // Le brouillon d'avant, gardé une seule fois : passer d'un message à modifier à un autre ne
    // doit pas faire prendre le texte du premier pour un brouillon.
    if (!enModification.value) brouillonAvantModification.value = texte.value
    enModification.value = message
    texte.value = message.content
  }

  function annulerModification() {
    enModification.value = null
    texte.value = brouillonAvantModification.value
    brouillonAvantModification.value = ''
  }

  /** Tout remettre à zéro : en quittant une conversation, par exemple. */
  function reinitialiser() {
    reponseA.value = null
    if (enModification.value) annulerModification()
  }

  /**
   * Enregistre la modification en cours. Rend le message modifié, ou `null` si rien n'a été
   * enregistré (texte inchangé, délai dépassé, erreur).
   */
  async function enregistrerModification(
    conversationId: string
  ): Promise<ConversationMessage | null> {
    const cible = enModification.value
    if (!cible) return null

    const contenu = texte.value.trim()
    // Rien n'a changé : on referme sans marquer le message « modifié ».
    if (contenu === cible.content) {
      annulerModification()
      return null
    }

    // Le serveur refuserait de toute façon ; autant dire pourquoi plutôt qu'une erreur générique.
    if (!messageEncoreModifiable(cible.createdAt)) {
      toast.add({
        title: t('messenger.edit_expired', { minutes: DELAI_MODIFICATION_MESSAGE_MINUTES }),
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
      annulerModification()
      return null
    }

    const modifie = await editMessage(conversationId, cible.id, contenu)
    if (!modifie) return null

    enModification.value = null
    texte.value = brouillonAvantModification.value
    brouillonAvantModification.value = ''
    return modifie
  }

  return {
    reponseA,
    enModification,
    repondreA,
    annulerReponse,
    modifier,
    annulerModification,
    reinitialiser,
    enregistrerModification,
  }
}
