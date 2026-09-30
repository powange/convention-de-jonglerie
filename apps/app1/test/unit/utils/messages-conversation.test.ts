import { describe, expect, it } from 'vitest'

import {
  appliquerMisesAJour,
  fusionnerMessages,
  remplacerMessage,
} from '../../../app/utils/messages-conversation'

import type { ConversationMessage } from '../../../app/composables/useMessenger'

/**
 * Tenir à jour les messages d'une conversation entre ce qui a été chargé et ce que le flux temps
 * réel apporte. Partagé par la messagerie et la discussion d'une candidature d'artiste.
 */
const message = (
  id: string,
  minute: number,
  extra: Partial<ConversationMessage> = {}
): ConversationMessage =>
  ({
    id,
    content: id,
    createdAt: new Date(Date.UTC(2026, 8, 29, 10, minute)),
    editedAt: null,
    deletedAt: null,
    replyToId: null,
    replyTo: null,
    participant: { id: 'p', user: { id: 1, pseudo: 'A', profilePicture: null, emailHash: '' } },
    ...extra,
  }) as ConversationMessage

const modifieA = (minute: number) => new Date(Date.UTC(2026, 8, 29, 11, minute))

describe('fusionnerMessages', () => {
  it('dédoublonne et trie par date d’envoi', () => {
    const fusion = fusionnerMessages([message('b', 2), message('a', 1)], [message('b', 2)])
    expect(fusion.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('garde la version modifiée, que le flux arrive avant ou après', () => {
    const local = message('a', 1, { content: 'corrigé', editedAt: modifieA(5) })
    const flux = message('a', 1, { content: 'ancien' })
    // La copie du flux l'emportait d'office : l'ancien texte revenait après une modification.
    expect(fusionnerMessages([local], [flux])[0]!.content).toBe('corrigé')
    expect(fusionnerMessages([flux], [local])[0]!.content).toBe('corrigé')
  })
})

describe('appliquerMisesAJour', () => {
  it('applique TOUTES les mises à jour du lot, pas seulement la dernière', () => {
    const charges = [message('a', 1), message('b', 2)]
    const resultat = appliquerMisesAJour(charges, [
      message('a', 1, { content: 'a modifié', editedAt: modifieA(1) }),
      // Une suppression vide le contenu côté serveur : c'est la forme réelle que reçoit le flux.
      message('b', 2, { content: '', deletedAt: modifieA(2) }),
    ])
    expect(resultat.map((m) => m.content)).toEqual(['a modifié', ''])
    // Le `deletedAt` fait la preuve que la seconde mise à jour a bien été appliquée : une chaîne
    // vide seule pourrait venir d'un contenu initial vide.
    expect(resultat[1]!.deletedAt).toEqual(modifieA(2))
  })

  it('ne revient pas à une version plus ancienne', () => {
    const recent = message('a', 1, { content: 'v2', editedAt: modifieA(9) })
    const ancien = message('a', 1, { content: 'v1', editedAt: modifieA(3) })
    expect(appliquerMisesAJour([recent], [ancien])[0]!.content).toBe('v2')
  })

  it('ignore une mise à jour d’un message non chargé', () => {
    expect(appliquerMisesAJour([message('a', 1)], [message('z', 9)]).map((m) => m.id)).toEqual([
      'a',
    ])
  })
})

describe('remplacerMessage', () => {
  it('remplace un message connu, ajoute un inconnu', () => {
    const charges = [message('a', 1)]
    expect(remplacerMessage(charges, message('a', 1, { content: 'neuf' }))[0]!.content).toBe('neuf')
    expect(remplacerMessage(charges, message('b', 2)).map((m) => m.id)).toEqual(['a', 'b'])
  })
})
