import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockGetEdition = vi.hoisted(() => vi.fn())
const mockCanManageArtists = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEdition,
  canManageArtists: mockCanManageArtists,
}))

import handler from '../../../../../server/api/editions/[id]/shows-call/[showCallId]/applications/ids.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * GET .../applications/ids — les identifiants seuls, pour « précédent » et « suivant ».
 *
 * ⚠️ POURQUOI CE POINT D'API EXISTE, et ce que ces tests protègent. La fiche d'une candidature
 * demandait la liste paginée avec `limit: 1000`, or `validatePagination` borne à **100** : la
 * demande était silencieusement ramenée, et au-delà de cent candidatures les flèches sautaient tout
 * le reste — sans erreur, sans trace, avec une navigation qui paraissait simplement incomplète.
 *
 * Les deux choses à ne jamais perdre sont donc : l'ABSENCE de plafond, et le MÊME ORDRE que la
 * liste. Un ordre qui divergerait ferait mener « suivant » ailleurs qu'à la ligne d'en dessous, et
 * c'est le genre d'écart qu'on ne voit qu'en comptant.
 */

const EDITION = 22
const APPEL = 7

const evenement = {
  context: { params: { id: String(EDITION), showCallId: String(APPEL) }, user: { id: 1 } },
}

describe('GET /api/editions/[id]/shows-call/[showCallId]/applications/ids', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => String(APPEL))
    mockGetEdition.mockResolvedValue({ id: EDITION })
    mockCanManageArtists.mockReturnValue(true)
    prismaMock.editionShowCall.findFirst.mockResolvedValue({ id: APPEL })
    prismaMock.showApplication.findMany.mockResolvedValue([{ id: 3 }, { id: 1 }, { id: 2 }])
  })

  it('rend les identifiants dans l’ordre reçu, sans rien réordonner', async () => {
    // Le serveur trie ; réordonner ici ferait diverger les flèches de la liste affichée.
    const reponse: any = await handler(evenement as any)

    expect(reponse.data.ids).toEqual([3, 1, 2])
  })

  it('ne demande QUE l’identifiant, et sans plafond', async () => {
    await handler(evenement as any)

    const requete = prismaMock.showApplication.findMany.mock.calls[0][0]
    expect(requete.select).toEqual({ id: true })
    // Le cœur du défaut : aucune pagination. `take` ou `skip` ramèneraient le plafond que ce point
    // d'API existe précisément pour supprimer.
    expect(requete.take).toBeUndefined()
    expect(requete.skip).toBeUndefined()
    // Et rien d'autre n'est chargé : ni le candidat, ni le décideur, ni le spectacle lié.
    expect(requete.include).toBeUndefined()
  })

  it('trie comme la liste — `createdAt` décroissant', async () => {
    // Verrouillé explicitement : c'est ce qui fait que « suivant » mène à la ligne d'en dessous.
    // Si le tri de la liste change, ce test doit tomber pour qu'on change les deux ensemble.
    await handler(evenement as any)

    expect(prismaMock.showApplication.findMany.mock.calls[0][0].orderBy).toEqual({
      createdAt: 'desc',
    })
  })

  it('filtre sur l’appel, pas seulement sur l’édition', async () => {
    // Une édition porte plusieurs appels : sans ce filtre, les flèches emmèneraient vers les
    // candidatures d'un autre appel, dont la fiche répondrait 404.
    await handler(evenement as any)

    expect(prismaMock.showApplication.findMany.mock.calls[0][0].where).toEqual({
      showCallId: APPEL,
    })
  })

  it('refuse sans le droit de gestion des artistes, avant toute lecture', async () => {
    mockCanManageArtists.mockReturnValue(false)

    await expect(handler(evenement as any)).rejects.toMatchObject({ status: 403 })
    expect(prismaMock.showApplication.findMany).not.toHaveBeenCalled()
  })

  it('refuse une édition introuvable', async () => {
    mockGetEdition.mockResolvedValue(null)

    await expect(handler(evenement as any)).rejects.toMatchObject({ status: 404 })
  })

  it('refuse un appel qui n’appartient pas à cette édition', async () => {
    // La garde d'appartenance : un identifiant d'appel d'une autre édition ne doit pas livrer ses
    // candidatures à qui n'a des droits que sur celle-ci.
    prismaMock.editionShowCall.findFirst.mockResolvedValue(null)

    await expect(handler(evenement as any)).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.showApplication.findMany).not.toHaveBeenCalled()
  })

  it('refuse un identifiant d’appel illisible', async () => {
    global.getRouterParam = vi.fn(() => 'pas-un-nombre')

    await expect(handler(evenement as any)).rejects.toMatchObject({ status: 400 })
  })
})
