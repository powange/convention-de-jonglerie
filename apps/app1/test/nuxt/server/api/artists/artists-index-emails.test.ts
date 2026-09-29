import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManageArtists = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageArtistsById: mockCanManageArtists,
}))

import handler from '../../../../../../../layers/artists/server/api/editions/[id]/artists/index.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * GET /api/editions/[id]/artists — le mode allégé par `emails=`.
 *
 * ⚠️ CE POINT D'API N'AVAIT AUCUN TEST. L'énoncé du lot supposait qu'il en existait pour vérifier la
 * rétrocompatibilité ; il n'y en avait pas, d'où ce fichier.
 *
 * Ce qu'il porte compte, parce qu'un paramètre optionnel mal lu casse en SILENCE : la page de
 * gestion des artistes consomme la réponse complète — comptes, responsables de transport,
 * représentations, articles à remettre, repas. Si le mode allégé s'activait par erreur pour elle,
 * ses colonnes se videraient sans qu'aucune erreur ne soit levée. C'est pourquoi la distinction
 * « paramètre absent » / « paramètre vide » est testée explicitement : ce sont deux intentions
 * différentes qui produiraient, confondues, exactement ce défaut.
 */

const EDITION = 22
const evenement = { context: { params: { id: String(EDITION) }, user: { id: 1 } } }

/** Le `where` de la requête effectivement envoyée. */
const requete = () => prismaMock.editionArtist.findMany.mock.calls[0]?.[0] ?? {}

describe('GET /api/editions/[id]/artists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManageArtists.mockResolvedValue(true)
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    global.getQuery = vi.fn(() => ({}))
  })

  it('refuse sans le droit de gestion des artistes, avant toute lecture', async () => {
    mockCanManageArtists.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toMatchObject({ status: 403 })
    expect(prismaMock.editionArtist.findMany).not.toHaveBeenCalled()
  })

  describe('sans le paramètre — la réponse COMPLÈTE, inchangée', () => {
    it('charge tout l’attirail de la page de gestion', async () => {
      await handler(evenement as any)

      // `include` et non `select` : c'est la forme complète. Et les cinq relations dont dépend la
      // page de gestion sont nommées, pour qu'un allègement involontaire se voie ici.
      const { where, include, select } = requete()
      expect(where).toEqual({ editionId: EDITION })
      expect(select).toBeUndefined()
      expect(include).toMatchObject({
        user: expect.anything(),
        pickupResponsible: expect.anything(),
        dropoffResponsible: expect.anything(),
        shows: expect.anything(),
        handoutItems: expect.anything(),
        mealSelections: expect.anything(),
      })
    })

    it('enrichit encore chaque artiste du hash d’adresse et des montants en euros', async () => {
      // Le contrat que la page de gestion consomme : les centimes de la base repassent en unité
      // courante, et l'avatar Gravatar se calcule sur un hash que seul le serveur produit.
      prismaMock.editionArtist.findMany.mockResolvedValue([
        {
          id: 5,
          payment: 12_000,
          reimbursementMax: 0,
          reimbursementActual: 0,
          consumablesMax: 0,
          consumablesActual: 0,
          user: { id: 9, email: 'Artiste@Exemple.test', profilePicture: null },
        },
      ])

      const reponse: any = await handler(evenement as any)
      const artiste = reponse.data.artists[0]

      expect(artiste.payment).toBe(120)
      expect(artiste.user.emailHash).toMatch(/^[0-9a-f]{32}$/)
    })
  })

  describe('avec `emails=` — la réponse ALLÉGÉE', () => {
    it('ne demande que les adresses citées, et rien que ce qui sert', async () => {
      global.getQuery = vi.fn(() => ({ emails: 'un@exemple.test,deux@exemple.test' }))

      await handler(evenement as any)

      const { where, select, include } = requete()
      expect(where).toEqual({
        editionId: EDITION,
        user: { email: { in: ['un@exemple.test', 'deux@exemple.test'] } },
      })
      // `select` et non `include` : c'est là tout l'objet du lot. Les repas, articles à remettre et
      // responsables de transport ne doivent PAS être chargés pour une correspondance d'adresses.
      expect(include).toBeUndefined()
      expect(Object.keys(select).sort()).toEqual(['id', 'shows', 'user'])
    })

    it('normalise la casse et les espaces, et dédoublonne', async () => {
      // Une même personne peut être citée deux fois dans une candidature, et rien ne garantit la
      // casse de ce qui est saisi. Sans normalisation, l'index du client — qui compare en
      // minuscules — ne retrouverait pas l'artiste et le badge « Déjà importé » manquerait.
      global.getQuery = vi.fn(() => ({ emails: ' Un@Exemple.test , un@exemple.test ,DEUX@x.test' }))

      await handler(evenement as any)

      expect(requete().where.user.email.in).toEqual(['un@exemple.test', 'deux@x.test'])
    })

    it('borne la requête à 50 adresses', async () => {
      const cinquanteCinq = Array.from({ length: 55 }, (_, i) => `a${i}@x.test`).join(',')
      global.getQuery = vi.fn(() => ({ emails: cinquanteCinq }))

      await handler(evenement as any)

      expect(requete().where.user.email.in).toHaveLength(50)
    })

    it('un paramètre VIDE ne demande personne — il ne rend pas tout', async () => {
      /*
       * La distinction qui protège la page de gestion. `emails=` vide est une demande sans
       * destinataire ; l'ABSENCE du paramètre est une demande complète. Si les deux se confondaient
       * dans un « tableau vide = pas de filtre », un appel malformé renverrait soudain tous les
       * artistes avec tout leur attirail — ou l'inverse, la page de gestion se viderait.
       */
      global.getQuery = vi.fn(() => ({ emails: '' }))

      await handler(evenement as any)

      const { where, select } = requete()
      expect(where).toEqual({ editionId: EDITION, user: { email: { in: [] } } })
      expect(select).toBeDefined()
    })

    it('ignore un paramètre qui n’est pas une chaîne et rend la réponse complète', async () => {
      // Un `?emails=a&emails=b` arrive en tableau. Plutôt que d'en deviner le sens, on retombe sur
      // le comportement d'avant — celui qui ne casse rien.
      global.getQuery = vi.fn(() => ({ emails: ['a@x.test', 'b@x.test'] }))

      await handler(evenement as any)

      expect(requete().include).toBeDefined()
      expect(requete().select).toBeUndefined()
    })
  })
})
