import { describe, it, expect } from 'vitest'

import {
  contexteDuModele,
  modeleAInterroger,
  PLAFOND_CONTEXTE_THEORIQUE,
} from '../../../server/utils/contexte-du-modele-local'

const DEFAUT = 4096

describe('modeleAInterroger', () => {
  const modeles = [
    { id: 'un-autre-modele', state: 'not-loaded' },
    { id: 'google/gemma-4-12b', state: 'loaded' },
  ]

  it('cherche le modèle PAR SON IDENTIFIANT', () => {
    // Le défaut corrigé : le code lisait `data[0]`, donc un modèle au hasard parmi les installés.
    expect(modeleAInterroger(modeles, 'google/gemma-4-12b')?.id).toBe('google/gemma-4-12b')
  })

  it('à défaut, un modèle chargé — sa valeur est au moins réelle', () => {
    expect(modeleAInterroger(modeles, 'modele-absent')?.id).toBe('google/gemma-4-12b')
    expect(modeleAInterroger(modeles, null)?.id).toBe('google/gemma-4-12b')
  })

  it('en dernier recours le premier', () => {
    const aucunCharge = [{ id: 'a' }, { id: 'b' }]
    expect(modeleAInterroger(aucunCharge, null)?.id).toBe('a')
  })
})

describe('contexteDuModele', () => {
  it('retient le contexte CHARGÉ, la seule valeur que le serveur honorera', () => {
    const r = contexteDuModele(
      [{ id: 'm', state: 'loaded', loaded_context_length: 32768, max_context_length: 262144 }],
      'm',
      DEFAUT
    )
    expect(r).toEqual({ jetons: 32768, source: 'charge', modele: 'm' })
  })

  it('accepte aussi `context_length`, que rend /v1/models', () => {
    expect(contexteDuModele([{ id: 'm', context_length: 8192 }], 'm', DEFAUT).jetons).toBe(8192)
  })

  it('⚠️ BORNE le plafond théorique quand rien n’est chargé', () => {
    /*
     * `max_context_length` est le maximum d'ENTRAÎNEMENT — 262144 pour Gemma 4 — alors que
     * l'instance sera chargée avec le contexte configuré dans LM Studio, souvent bien plus petit :
     * tenir 256K de cache KV ne rentre pas dans 16 Go. S'en servir tel quel ferait envoyer dix
     * fois trop, et le serveur refuserait la requête entière.
     */
    const r = contexteDuModele([{ id: 'm', max_context_length: 262144 }], 'm', DEFAUT)
    expect(r).toEqual({
      jetons: PLAFOND_CONTEXTE_THEORIQUE,
      source: 'theorique_borne',
      modele: 'm',
    })
  })

  it('ne borne pas vers le HAUT : un petit maximum est respecté', () => {
    // Le plafond protège d'une valeur trop grande, il ne doit pas inventer de la place.
    expect(contexteDuModele([{ id: 'm', max_context_length: 8192 }], 'm', DEFAUT).jetons).toBe(8192)
  })

  it('retombe sur le défaut sans réponse exploitable', () => {
    for (const vide of [null, undefined, []]) {
      expect(contexteDuModele(vide, 'm', DEFAUT)).toEqual({ jetons: DEFAUT, source: 'defaut' })
    }
  })

  it('retombe sur le défaut quand le modèle ne dit aucun contexte', () => {
    expect(contexteDuModele([{ id: 'm', state: 'loaded' }], 'm', DEFAUT)).toEqual({
      jetons: DEFAUT,
      source: 'defaut',
      modele: 'm',
    })
  })

  it('préfère le chargé au théorique, même pour un AUTRE modèle que celui demandé', () => {
    // La valeur réelle d'un modèle chargé vaut mieux que le maximum d'entraînement d'un autre.
    const r = contexteDuModele(
      [
        { id: 'demande', max_context_length: 262144 },
        { id: 'charge', state: 'loaded', loaded_context_length: 16384 },
      ],
      'inexistant',
      DEFAUT
    )
    expect(r).toEqual({ jetons: 16384, source: 'charge', modele: 'charge' })
  })
})
