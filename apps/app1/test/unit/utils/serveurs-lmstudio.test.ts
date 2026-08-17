import { describe, it, expect, vi } from 'vitest'

import { fetchLocalModelAvecSecours } from '../../../server/utils/fetch-helpers'

// `serveursLmStudio` vit dans ai-config.ts, qui appelle useRuntimeConfig au chargement. On isole
// la seule règle qui nous intéresse — le choix du modèle par serveur — en la réimportant à part.
const { serveursLmStudio } = await vi.importActual<
  typeof import('../../../server/utils/ai-config')
>('../../../server/utils/ai-config')

const reponseOk = () =>
  new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 })

describe('serveursLmStudio', () => {
  const complet = {
    lmstudioBaseUrl: 'http://principal:1234',
    lmstudioBackupBaseUrl: 'http://secours:1234',
    lmstudioModel: 'vision-principal',
    lmstudioTextModel: 'texte-principal',
    lmstudioBackupModel: 'vision-secours',
    lmstudioBackupTextModel: 'texte-secours',
  }

  it('donne à chaque serveur son propre modèle texte', () => {
    expect(serveursLmStudio(complet, 'texte')).toEqual([
      { base: 'http://principal:1234', model: 'texte-principal' },
      { base: 'http://secours:1234', model: 'texte-secours' },
    ])
  })

  it('donne à chaque serveur son propre modèle vision', () => {
    expect(serveursLmStudio(complet, 'vision')).toEqual([
      { base: 'http://principal:1234', model: 'vision-principal' },
      { base: 'http://secours:1234', model: 'vision-secours' },
    ])
  })

  // Le repli qui préserve les configurations existantes : sans modèle de secours renseigné, la
  // seconde machine reçoit celui de la première, exactement comme avant ce changement.
  it('applique les modèles du principal quand ceux du secours sont absents', () => {
    const sansModelesDeSecours = {
      ...complet,
      lmstudioBackupModel: null,
      lmstudioBackupTextModel: null,
    }
    expect(serveursLmStudio(sansModelesDeSecours, 'texte')[1]).toEqual({
      base: 'http://secours:1234',
      model: 'texte-principal',
    })
  })

  it('ignore une adresse de secours laissée vide', () => {
    const sansSecours = { ...complet, lmstudioBackupBaseUrl: '' }
    expect(serveursLmStudio(sansSecours, 'texte')).toHaveLength(1)
  })

  it('retombe sur le modèle de l’autre usage quand celui demandé manque', () => {
    const sansTexte = { ...complet, lmstudioTextModel: null, lmstudioBackupTextModel: null }
    expect(serveursLmStudio(sansTexte, 'texte')[0]!.model).toBe('vision-principal')
  })
})

describe('fetchLocalModelAvecSecours — modèle par serveur', () => {
  // C'est tout l'objet du changement : réclamer à la machine de secours le modèle de la
  // principale la ferait échouer alors qu'elle répondait.
  it('demande à chaque adresse le modèle qui lui est associé', async () => {
    const appels: Array<{ url: string; model: string }> = []
    const fetchMock = vi.fn(async (url: string, options: any) => {
      appels.push({ url, model: JSON.parse(options.body).model })
      // La première machine est éteinte : la bascule doit jouer.
      if (url.startsWith('http://principal')) throw new Error('fetch failed')
      return reponseOk()
    })
    vi.stubGlobal('fetch', fetchMock)

    const reponse = await fetchLocalModelAvecSecours(
      [
        { base: 'http://principal:1234', model: 'modele-A' },
        { base: 'http://secours:1234', model: 'modele-B' },
      ],
      '/v1/chat/completions',
      (serveur) => ({
        method: 'POST',
        body: JSON.stringify({ model: serveur.model }),
      }),
      1000,
      'LM Studio',
      0
    )

    expect(reponse.ok).toBe(true)
    expect(appels).toEqual([
      { url: 'http://principal:1234/v1/chat/completions', model: 'modele-A' },
      { url: 'http://secours:1234/v1/chat/completions', model: 'modele-B' },
    ])
    vi.unstubAllGlobals()
  })

  it('accepte toujours une simple liste d’adresses, sans modèle', async () => {
    const fetchMock = vi.fn(async () => reponseOk())
    vi.stubGlobal('fetch', fetchMock)

    const reponse = await fetchLocalModelAvecSecours(
      ['http://principal:1234'],
      '/v1/models',
      { method: 'GET' },
      1000,
      'LM Studio',
      0
    )

    expect(reponse.ok).toBe(true)
    vi.unstubAllGlobals()
  })
})
