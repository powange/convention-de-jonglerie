import { describe, expect, it } from 'vitest'

import {
  composantesDEmpreinte,
  empreinteDErreur,
  memeEmpreinte,
  signatureDAlerte,
  TYPE_ABSENT,
} from '../../../shared/utils/empreinte-erreur'

/**
 * La résolution en masse ne jugeait que sur le message. Marquer résolu un « Données invalides » sur
 * une route les résolvait donc sur TOUTES les autres, parce qu'un message de validation générique
 * est partagé par des dizaines d'endpoints — et l'opération est irréversible.
 *
 * Ces tests tiennent la frontière : ce qui distingue deux problèmes, et ce qui les confond.
 */
describe('empreinteDErreur', () => {
  const uneErreur = {
    errorType: 'ValidationError',
    method: 'POST',
    path: '/api/editions',
    message: 'Données invalides',
  }

  it('distingue deux endpoints qui rendent le même message', () => {
    // Le cœur du correctif. Ces deux entrées étaient auparavant « identiques ».
    expect(memeEmpreinte(uneErreur, { ...uneErreur, path: '/api/conventions/27/organizers' })).toBe(
      false
    )
  })

  it('distingue deux méthodes sur le même chemin', () => {
    expect(memeEmpreinte(uneErreur, { ...uneErreur, method: 'PUT' })).toBe(false)
  })

  it('distingue deux types sur le même endpoint', () => {
    expect(memeEmpreinte(uneErreur, { ...uneErreur, errorType: 'DatabaseError' })).toBe(false)
  })

  it('confond ce qui est réellement le même problème', () => {
    // Deux occurrences d'une même panne : c'est exactement ce que la résolution en masse doit
    // traiter d'un coup.
    expect(memeEmpreinte(uneErreur, { ...uneErreur })).toBe(true)
  })

  it('reprend la forme des empreintes déjà écartées hors base', () => {
    // `.claude/error-logs-monitor.json` tient ses 29 empreintes sous cette forme exacte. Les deux
    // doivent pouvoir se confronter sans traduction.
    expect(empreinteDErreur(uneErreur)).toBe('ValidationError|POST|/api/editions|Données invalides')
  })

  it('nomme un type absent au lieu de laisser un trou dans la forme textuelle', () => {
    // Sans cela, `|POST|…` et `null|POST|…` désigneraient la même chose selon qui écrit.
    expect(empreinteDErreur({ ...uneErreur, errorType: null })).toBe(
      `${TYPE_ABSENT}|POST|/api/editions|Données invalides`
    )
  })
})

describe('composantesDEmpreinte', () => {
  it('garde le `null` du type, contrairement à la forme textuelle', () => {
    // C'est ce qui part dans le filtre Prisma : `errorType: null` y signifie IS NULL, et une
    // entrée sans type ne doit pas se confondre avec celles qui en portent un.
    expect(composantesDEmpreinte({ method: 'GET', path: '/api/x', message: 'Boum' })).toEqual({
      errorType: null,
      method: 'GET',
      path: '/api/x',
      message: 'Boum',
    })
  })

  it('ne rend jamais `undefined` sur les trois autres', () => {
    // Un `undefined` glissé dans un `where` Prisma est ignoré — le filtre s'élargirait en silence,
    // ce qui est précisément le danger de cette opération.
    const composantes = composantesDEmpreinte({})

    expect(composantes.method).toBe('')
    expect(composantes.path).toBe('')
    expect(composantes.message).toBe('')
  })
})

describe('signatureDAlerte', () => {
  it('ignore le message, délibérément', () => {
    // Plus grossière que l'empreinte, et c'est voulu : une panne qui produit vingt messages
    // différents sur le même endpoint reste une seule panne pour qui reçoit les notifications.
    const un = { errorType: 'DatabaseError', method: 'GET', path: '/api/x', message: 'Un' }
    const autre = { ...un, message: 'Autre' }

    expect(signatureDAlerte(un)).toBe(signatureDAlerte(autre))
    expect(memeEmpreinte(un, autre)).toBe(false)
  })

  it('sépare tout de même deux endpoints', () => {
    expect(signatureDAlerte({ method: 'GET', path: '/api/x' })).not.toBe(
      signatureDAlerte({ method: 'GET', path: '/api/y' })
    )
  })
})
