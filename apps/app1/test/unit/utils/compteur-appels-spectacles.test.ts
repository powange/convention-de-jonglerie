import { describe, expect, it } from 'vitest'

import { compterCandidaturesDeSpectaclesEnAttente } from '../../../../../layers/artists/app/utils/compteur-appels-spectacles'

/**
 * Une pastille n'est utile que si elle dit quelque chose de vrai. Ces tests tiennent surtout ses
 * bords : ce qui se compte, ce qui ne se compte pas, et la différence entre « rien à traiter » et
 * « on ne sait pas » — qui s'affichent différemment et ne doivent jamais être confondus.
 */
describe('compterCandidaturesDeSpectaclesEnAttente', () => {
  it('additionne les appels de toute l’édition', () => {
    // C'est la raison d'être de ce compteur : une édition ouvre souvent un appel par scène, et
    // les parcourir un à un est justement le travail qu'on supprime.
    const reponse = {
      showCalls: [{ stats: { pending: 3 } }, { stats: { pending: 0 } }, { stats: { pending: 7 } }],
    }

    expect(compterCandidaturesDeSpectaclesEnAttente(reponse)).toBe(10)
  })

  it('ne compte que ce qui attend une décision', () => {
    // Les acceptées et les refusées n'ont pas de `pending` : les compter allumerait la pastille en
    // permanence dès la première décision prise, et elle cesserait de vouloir dire quelque chose.
    const reponse = {
      showCalls: [{ stats: { pending: 2, accepted: 40, rejected: 15 } as any }],
    }

    expect(compterCandidaturesDeSpectaclesEnAttente(reponse)).toBe(2)
  })

  it('rend zéro pour une édition sans aucun appel', () => {
    // Ici, l'absence de candidature en attente est une réponse — pas une ignorance.
    expect(compterCandidaturesDeSpectaclesEnAttente({ showCalls: [] })).toBe(0)
  })

  it('rend `null` quand la réponse est inexploitable', () => {
    // `null` n'affiche aucune pastille ; zéro affirmerait qu'il n'y a rien à traiter, ce qu'une
    // réponse malformée ne permet pas de dire.
    for (const rien of [null, undefined, {}, { showCalls: null }, { showCalls: 'oui' } as any])
      expect(compterCandidaturesDeSpectaclesEnAttente(rien)).toBeNull()
  })

  it('n’efface pas tout le compte pour un seul appel mal formé', () => {
    // Un appel sans statistiques vaut zéro et laisse les autres parler : sinon une pastille que
    // douze candidatures justifient disparaîtrait à cause d'une ligne abîmée.
    const reponse = {
      showCalls: [{ stats: { pending: 12 } }, {}, { stats: null }, { stats: { pending: null } }],
    }

    expect(compterCandidaturesDeSpectaclesEnAttente(reponse)).toBe(12)
  })
})
