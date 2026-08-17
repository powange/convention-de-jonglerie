import { describe, it, expect } from 'vitest'

import { extraireJsonDuModele } from '../../../../../server/api/admin/generate-import-json.post'

/**
 * Réponse au format OpenAI, telle que LM Studio la renvoie.
 */
const reponse = (message: Record<string, unknown>, finish_reason = 'stop') => ({
  choices: [{ index: 0, message, finish_reason }],
})

describe('extraireJsonDuModele', () => {
  it('rend le JSON quand le modèle a répondu', () => {
    const json = extraireJsonDuModele(
      reponse({ content: 'Voici le résultat :\n{"edition":{"name":"X"}}\nVoilà.' }),
      'Extraction'
    )
    expect(JSON.parse(json)).toEqual({ edition: { name: 'X' } })
  })

  // CAS OBSERVÉ EN PRODUCTION : gemma-4-12b a dépensé 1021 jetons sur 1024 en raisonnement,
  // laissant `content` vide. Le message générique « L'IA n'a pas généré de JSON valide » envoyait
  // chercher du côté du prompt un problème qui était de budget.
  it('dit que le budget est parti en raisonnement quand content est vide', () => {
    expect(() =>
      extraireJsonDuModele(
        reponse({ content: '', reasoning_content: 'Réflexion très longue…' }, 'length'),
        'Extraction'
      )
    ).toThrow(/raisonnement/i)
  })

  it('dit que la réponse a été coupée quand elle s’arrête sur la limite de jetons', () => {
    expect(() =>
      extraireJsonDuModele(reponse({ content: 'Le JSON commence ici' }, 'length'), 'Extraction')
    ).toThrow(/coupée/i)
  })

  // Un JSON amputé de son accolade fermante n'est pas reconnu comme du JSON du tout : c'est la
  // coupure qu'il faut signaler, et c'est bien ce que fait le code.
  it('signale la coupure quand le JSON s’arrête sans accolade fermante', () => {
    expect(() =>
      extraireJsonDuModele(reponse({ content: '{"edition": {"name": "X"' }, 'length'), 'Extraction')
    ).toThrow(/coupée/i)
  })

  it('signale un JSON incomplet quand la réponse tronquée en contient un invalide', () => {
    expect(() =>
      extraireJsonDuModele(reponse({ content: '{"a": 1} et {"b"}' }, 'length'), 'Extraction')
    ).toThrow(/incomplet/i)
  })

  it('reste explicite quand le modèle a répondu à côté', () => {
    expect(() =>
      extraireJsonDuModele(reponse({ content: 'Je ne peux pas répondre.' }), 'Extraction')
    ).toThrow(/pas renvoyé de JSON/i)
  })

  it('nomme l’étape en cause dans le message', () => {
    expect(() => extraireJsonDuModele(reponse({ content: '' }), 'Complétion du JSON')).toThrow(
      /Complétion du JSON/
    )
  })
})
