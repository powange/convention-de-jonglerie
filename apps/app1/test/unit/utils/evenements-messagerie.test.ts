import { describe, expect, it } from 'vitest'

import { messagesAbsents, partagerParConversation } from '../../../app/utils/evenements-messagerie'

/**
 * Le tri des événements du flux global, conversation par conversation.
 *
 * ⚠️ POURQUOI CETTE LOGIQUE EST ÉPROUVÉE ICI. Depuis que les messages sont poussés par le flux
 * global au lieu d'être sondés par un flux par conversation, tout arrive dans une file unique : la
 * conversation ouverte y prélève sa part. Ce prélèvement est la seule vraie logique du composable,
 * et ses deux erreurs possibles ne se verraient qu'à l'usage, à deux navigateurs :
 *
 * - ne rien retirer de la file → changer de conversation puis revenir rejoue tous les messages de
 *   la session, en double sous ceux déjà affichés ;
 * - tout retirer → les messages des autres conversations disparaissent avant leur ouverture, et
 *   leur contenu n'apparaît qu'au rechargement.
 *
 * Extraites du composable exprès : l'éprouver en entier demanderait Pinia, `EventSource` et un flux
 * ouvert, et le test mesurerait surtout ses propres mocks.
 */

const evenement = (conversationId: string, id: string) => ({ conversationId, id })

describe('partagerParConversation', () => {
  const file = [
    evenement('conv-1', 'm1'),
    evenement('conv-2', 'm2'),
    evenement('conv-1', 'm3'),
    evenement('conv-3', 'm4'),
  ]

  it('prélève sa part et LAISSE le reste', () => {
    const { pourMoi, reste } = partagerParConversation(file, 'conv-1')

    expect(pourMoi.map((e) => e.id)).toEqual(['m1', 'm3'])
    // Le point qui compte : ce qui vise une autre conversation reste disponible pour elle.
    expect(reste.map((e) => e.id)).toEqual(['m2', 'm4'])
  })

  it('garde l’ordre d’arrivée', () => {
    // Les messages s'affichent dans l'ordre où ils ont été écrits : réordonner ici mélangerait une
    // conversation reçue en rafale.
    const { pourMoi } = partagerParConversation(
      [evenement('c', 'b'), evenement('c', 'a'), evenement('c', 'c')],
      'c'
    )

    expect(pourMoi.map((e) => e.id)).toEqual(['b', 'a', 'c'])
  })

  it('ne prélève RIEN sans conversation regardée', () => {
    // Vider la file ici ferait disparaître des messages que personne n'a encore lus — le cas se
    // produit entre la fermeture d'une conversation et l'ouverture de la suivante.
    const { pourMoi, reste } = partagerParConversation(file, null)

    expect(pourMoi).toEqual([])
    expect(reste).toHaveLength(4)
  })

  it('rend une part vide plutôt que d’échouer sur une conversation absente de la file', () => {
    const { pourMoi, reste } = partagerParConversation(file, 'conv-inconnue')

    expect(pourMoi).toEqual([])
    expect(reste).toHaveLength(4)
  })

  it('ne modifie pas la file reçue', () => {
    // L'appelant remplace sa référence ; muter l'entrée déclencherait les watchers à contretemps.
    const copie = [...file]
    partagerParConversation(file, 'conv-1')

    expect(file).toEqual(copie)
  })
})

describe('messagesAbsents', () => {
  it('écarte un message déjà affiché', () => {
    // L'auteur reçoit le sien par la réponse de son envoi : sans ce filtre, il le verrait deux fois.
    const nouveaux = messagesAbsents([{ id: 'm1' }, { id: 'm2' }], [{ id: 'm1' }])

    expect(nouveaux.map((m) => m.id)).toEqual(['m2'])
  })

  it('départage aussi deux exemplaires de la MÊME salve', () => {
    /*
     * Une reconnexion du flux global peut rejouer un événement, et les deux exemplaires arrivent
     * alors ensemble. La liste de référence n'a pas encore été modifiée : comparer à elle seule
     * laisserait passer le doublon.
     */
    const nouveaux = messagesAbsents([{ id: 'm1' }, { id: 'm1' }], [])

    expect(nouveaux).toHaveLength(1)
  })

  it('laisse passer un message sans identifiant plutôt que de le perdre', () => {
    // Une forme inattendue ne doit pas faire disparaître un message : mieux vaut un doublon
    // visible, qu'on remarque, qu'une absence silencieuse.
    const nouveaux = messagesAbsents([{}, {}], [])

    expect(nouveaux).toHaveLength(2)
  })

  it('rend tout quand rien n’est encore affiché', () => {
    expect(messagesAbsents([{ id: 'a' }, { id: 'b' }], [])).toHaveLength(2)
  })
})
