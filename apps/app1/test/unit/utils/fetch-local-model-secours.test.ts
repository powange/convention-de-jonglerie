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

  /**
   * Le cas signalé : LM Studio démarré sans modèle chargé. Il répond poliment une erreur, donc
   * l'adresse est joignable — mais elle ne sert à rien, et le secours en a peut-être un.
   */
  it('bascule quand le serveur répond sans modèle chargé', async () => {
    const appels: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        appels.push(url)
        if (url.startsWith('http://principal')) {
          return {
            ok: false,
            status: 400,
            text: async () =>
              '{"error":{"message":"No models loaded. Please load a model in the developer page."}}',
          } as unknown as Response
        }
        return reponse(url)
      })
    )

    const r = await fetchLocalModelAvecSecours(
      ['http://principal:1234', 'http://secours:1234'],
      '/v1/chat/completions',
      {},
      1000,
      'LM Studio',
      0
    )

    // Trois appels : la principale est réessayée une fois avant qu'on la déclare perdue.
    expect(r.url).toBe('http://secours:1234/v1/chat/completions')
    expect(appels).toHaveLength(3)
  })

  // Sans secours, le message doit dire quoi faire — pas rendre le JSON de l'API.
  it('explique l’absence de modèle plutôt que de recopier le JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => '{"error":{"message":"No models loaded."}}',
      })) as unknown as typeof fetch
    )

    await expect(
      fetchLocalModelAvecSecours(
        ['http://principal:1234'],
        '/v1/chat/completions',
        {},
        1000,
        'LM Studio',
        0
      )
    ).rejects.toThrow(/aucun modèle n'y est chargé/)
  })

  it('rapporte un refus inattendu avec son statut', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'boom',
      })) as unknown as typeof fetch
    )

    await expect(
      fetchLocalModelAvecSecours(['http://principal:1234'], '/v1/models', {}, 1000, 'LM Studio')
    ).rejects.toThrow(/HTTP 500.*boom/)
  })

  /**
   * « Aucun modèle chargé » est souvent passager : LM Studio décharge un modèle pour en charger un
   * autre quand la mémoire ne permet pas de tenir les deux, et une requête tombant pendant cette
   * bascule trouve la mémoire vide. Conclure au premier refus condamnerait une analyse pour un
   * état transitoire de quelques secondes.
   */
  it('réessaie la même adresse avant de conclure à l’absence de modèle', async () => {
    let appels = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        appels++
        if (appels === 1) {
          return {
            ok: false,
            status: 400,
            text: async () => '{"error":{"message":"No models loaded."}}',
          } as unknown as Response
        }
        return reponse(url)
      })
    )

    const r = await fetchLocalModelAvecSecours(
      ['http://principal:1234', 'http://secours:1234'],
      '/v1/chat/completions',
      {},
      1000,
      'LM Studio',
      0
    )

    // La même adresse, au second essai : on ne part au secours que si elle persiste.
    expect(r.url).toBe('http://principal:1234/v1/chat/completions')
    expect(appels).toBe(2)
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
