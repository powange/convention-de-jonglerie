import { afterEach, describe, expect, it, vi } from 'vitest'

import { ERREUR_EXPIRATION, fetchLocalModelAvecSecours } from '../../../server/utils/fetch-helpers'

/**
 * Le modèle local tourne sur une machine du réseau : elle s'éteint, redémarre, change d'adresse.
 * Une adresse de secours évite d'aller modifier la configuration au moment précis où l'on a
 * besoin du service.
 *
 * La distinction qui compte : on bascule sur une machine INJOIGNABLE, jamais sur une expiration.
 * Une adresse qui expire a répondu — elle est seulement lente — et réessayer ailleurs doublerait
 * l'attente pour le même verdict.
 */
const injoignable = () =>
  Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
const expire = () => Object.assign(new Error('abandon'), { name: 'AbortError' })
const reponse = (url: string) => ({ ok: true, url }) as unknown as Response

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchLocalModelAvecSecours', () => {
  it('utilise la première adresse quand elle répond', async () => {
    const appels: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        appels.push(url)
        return reponse(url)
      })
    )

    const r = await fetchLocalModelAvecSecours(
      ['http://principal:1234', 'http://secours:1234'],
      '/v1/chat/completions',
      {},
      1000,
      'LM Studio'
    )

    expect(r.url).toBe('http://principal:1234/v1/chat/completions')
    expect(appels).toHaveLength(1)
  })

  it('bascule sur le secours quand la première est injoignable', async () => {
    const appels: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        appels.push(url)
        if (url.startsWith('http://principal')) throw injoignable()
        return reponse(url)
      })
    )

    const r = await fetchLocalModelAvecSecours(
      ['http://principal:1234', 'http://secours:1234'],
      '/v1/chat/completions',
      {},
      1000,
      'LM Studio'
    )

    expect(r.url).toBe('http://secours:1234/v1/chat/completions')
    expect(appels).toHaveLength(2)
  })

  /**
   * Le cas qui justifie la distinction : basculer ici ferait attendre deux fois le délai — trente
   * minutes chez certains — pour apprendre la même chose.
   */
  it('ne bascule pas sur une expiration', async () => {
    const appels: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        appels.push(url)
        throw expire()
      })
    )

    await expect(
      fetchLocalModelAvecSecours(
        ['http://principal:1234', 'http://secours:1234'],
        '/v1/chat/completions',
        {},
        1000,
        'LM Studio'
      )
    ).rejects.toMatchObject({ [ERREUR_EXPIRATION]: true })

    expect(appels).toHaveLength(1)
  })

  it('remonte l’erreur quand toutes les adresses sont injoignables', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw injoignable()
      })
    )

    await expect(
      fetchLocalModelAvecSecours(
        ['http://principal:1234', 'http://secours:1234'],
        '/v1/chat/completions',
        {},
        1000,
        'LM Studio'
      )
    ).rejects.toThrow(/Impossible de joindre LM Studio/)
  })

  it('fonctionne sans adresse de secours', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => reponse(url))
    )

    const r = await fetchLocalModelAvecSecours(
      ['http://principal:1234'],
      '/v1/models',
      {},
      1000,
      'LM Studio'
    )
    expect(r.url).toBe('http://principal:1234/v1/models')
  })

  // Une adresse vide vient d'un champ laissé blanc : elle ne doit pas compter comme un secours.
  it('ignore les adresses vides', async () => {
    const appels: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        appels.push(url)
        if (url.startsWith('http://principal')) throw injoignable()
        return reponse(url)
      })
    )

    await expect(
      fetchLocalModelAvecSecours(
        ['http://principal:1234', '', '  '],
        '/v1/models',
        {},
        1000,
        'LM Studio'
      )
    ).rejects.toThrow(/Impossible de joindre/)
    expect(appels).toHaveLength(1)
  })

  it('refuse de partir sans aucune adresse', async () => {
    await expect(
      fetchLocalModelAvecSecours([], '/v1/models', {}, 1000, 'LM Studio')
    ).rejects.toThrow(/Aucune adresse configurée/)
  })

  // Une adresse saisie avec une barre finale ne doit pas produire « http://x//v1/models ».
  it('tolère une barre oblique finale', async () => {
    const appels: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        appels.push(url)
        return reponse(url)
      })
    )

    await fetchLocalModelAvecSecours(
      ['http://principal:1234/'],
      '/v1/models',
      {},
      1000,
      'LM Studio'
    )
    expect(appels[0]).toBe('http://principal:1234/v1/models')
  })
})
