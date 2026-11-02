import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * ⚠️ La garde est bouchonnée au niveau du MODULE : les points d'API l'importent explicitement, donc
 * un bouchon posé sur `global` ne les atteindrait pas — la vraie garde s'exécuterait et tomberait
 * sur un auto-import non câblé, laissant les cas SAUTÉS plutôt que rouges.
 */
const mockGarde = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionForEdit: mockGarde,
}))

const mockAuth = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/auth-utils', () => ({ requireAuth: mockAuth }))

const mockEditionId = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/validation-helpers', () => ({ validateEditionId: mockEditionId }))

import ajouter from '../../../../../server/api/editions/[id]/analysis-sources/index.post'
import lister from '../../../../../server/api/editions/[id]/analysis-sources/index.get'
import modifier from '../../../../../server/api/editions/[id]/analysis-sources/[sourceId].patch'
import supprimer from '../../../../../server/api/editions/[id]/analysis-sources/[sourceId].delete'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Les sources d'information supplémentaires d'une édition.
 *
 * ## ⚠️ LE CAS QUI PORTE TOUT LE RESTE
 *
 * La garde `getEditionForEdit` ne vérifie que les droits sur l'édition **du chemin**. Elle ne dit
 * rien de l'appartenance de la ligne visée. Un organisateur légitime de l'édition 1 pourrait donc
 * modifier ou supprimer la source de l'édition 2 en changeant l'identifiant dans l'URL — et rien
 * ne le signalerait, puisque la garde aurait dit oui.
 *
 * C'est pourquoi `updateMany`/`deleteMany` portent `{ id, editionId }` dans leur `where`, et c'est
 * ce que les cas marqués ⚠️ ci-dessous éprouvent, dans les deux sens.
 */
const EDITION = 53
const AUTRE_EDITION = 99

const appeler = (handler: unknown, corps?: unknown, params: Record<string, string> = {}) => {
  if (corps !== undefined) global.readBody = vi.fn().mockResolvedValue(corps)
  global.getRouterParam = vi.fn((_e: unknown, nom: string) => params[nom])
  return (handler as (e: unknown) => Promise<any>)({ context: {} })
}

describe('GET /api/editions/[id]/analysis-sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockReturnValue({ id: 1 })
    mockEditionId.mockReturnValue(EDITION)
    mockGarde.mockResolvedValue({ id: EDITION })
    prismaMock.editionAnalysisSource.findMany.mockResolvedValue([])
  })

  it('📍 rend les sources de CETTE édition, les actives d’abord', async () => {
    /*
     * L'ordre n'est pas cosmétique : ce sont les actives qui partiront à l'analyse. Les voir en
     * tête évite d'en cocher une de plus sans s'apercevoir qu'on dépasse déjà le plafond.
     */
    const resultat = await appeler(lister)

    const appel = prismaMock.editionAnalysisSource.findMany.mock.calls[0]![0]
    expect(appel.where).toEqual({ editionId: EDITION })
    expect(appel.orderBy).toEqual([{ actif: 'desc' }, { createdAt: 'asc' }])
    expect(resultat.data.max).toBe(20)
  })

  it('refuse un visiteur sans droit d’édition', async () => {
    mockGarde.mockRejectedValue(
      Object.assign(new Error('Droits insuffisants'), { statusCode: 403 })
    )

    await expect(appeler(lister)).rejects.toBeDefined()
    expect(prismaMock.editionAnalysisSource.findMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/editions/[id]/analysis-sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockReturnValue({ id: 1 })
    mockEditionId.mockReturnValue(EDITION)
    mockGarde.mockResolvedValue({ id: EDITION })
    prismaMock.editionAnalysisSource.findFirst.mockResolvedValue(null)
    prismaMock.editionAnalysisSource.count.mockResolvedValue(0)
    prismaMock.editionAnalysisSource.create.mockResolvedValue({
      id: 7,
      url: 'https://exemple.test/infos',
      label: null,
      actif: true,
    })
    prismaMock.editionAnalysisSource.findMany.mockResolvedValue([])
  })

  it('ajoute une source et rend la liste à jour', async () => {
    const resultat = await appeler(ajouter, { url: 'https://exemple.test/infos' })

    expect(prismaMock.editionAnalysisSource.create.mock.calls[0]![0].data).toMatchObject({
      editionId: EDITION,
      url: 'https://exemple.test/infos',
    })
    expect(resultat.data.deja).toBe(false)
  })

  it('⚠️ ne crée PAS de seconde ligne pour une URL déjà présente', async () => {
    /*
     * Un doublon n'est pas une erreur d'opérateur : il a collé deux fois, ou cliqué deux fois. Mais
     * une seconde ligne ferait relire — et facturer — la même page deux fois dans la même analyse,
     * et deux lignes identiques à l'écran passent pour un affichage redondant, pas pour un doublon
     * de traitement.
     */
    prismaMock.editionAnalysisSource.findFirst.mockResolvedValue({
      id: 3,
      url: 'https://exemple.test/infos',
      label: null,
      actif: true,
    })

    const resultat = await appeler(ajouter, { url: 'https://exemple.test/infos' })

    expect(resultat.data.deja).toBe(true)
    expect(prismaMock.editionAnalysisSource.create).not.toHaveBeenCalled()
  })

  it('📍 refuse au-delà du plafond, plutôt que de laisser la liste enfler', async () => {
    prismaMock.editionAnalysisSource.count.mockResolvedValue(20)

    await expect(appeler(ajouter, { url: 'https://exemple.test/encore' })).rejects.toBeDefined()
    expect(prismaMock.editionAnalysisSource.create).not.toHaveBeenCalled()
  })

  it('refuse une adresse qui n’est pas une URL', async () => {
    await expect(appeler(ajouter, { url: 'pas une url' })).rejects.toBeDefined()
    expect(prismaMock.editionAnalysisSource.create).not.toHaveBeenCalled()
  })
})

describe('PATCH et DELETE /api/editions/[id]/analysis-sources/[sourceId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockReturnValue({ id: 1 })
    mockEditionId.mockReturnValue(EDITION)
    mockGarde.mockResolvedValue({ id: EDITION })
    prismaMock.editionAnalysisSource.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.editionAnalysisSource.deleteMany.mockResolvedValue({ count: 1 })
  })

  it('⚠️ la MODIFICATION est adressée par { id, editionId }, jamais par id seul', async () => {
    /*
     * LE cas. Sans `editionId` dans le `where`, un organisateur de l'édition 53 basculerait la
     * source de l'édition 99 en changeant l'identifiant dans l'URL — la garde aurait dit oui,
     * puisqu'elle ne vérifie que ses droits sur l'édition du chemin.
     */
    await appeler(modifier, { actif: false }, { sourceId: '42' })

    const where = prismaMock.editionAnalysisSource.updateMany.mock.calls[0]![0].where
    expect(where).toEqual({ id: 42, editionId: EDITION })
    expect(where.editionId).not.toBe(AUTRE_EDITION)
  })

  it('⚠️ la SUPPRESSION est adressée par { id, editionId }, jamais par id seul', async () => {
    await appeler(supprimer, undefined, { sourceId: '42' })

    expect(prismaMock.editionAnalysisSource.deleteMany.mock.calls[0]![0].where).toEqual({
      id: 42,
      editionId: EDITION,
    })
  })

  it('⚠️ répond 404 quand rien n’a été touché, au lieu d’un succès mensonger', async () => {
    /*
     * `updateMany` et `deleteMany` ne lèvent PAS sur une ligne absente : ils rendent `count: 0`.
     * Sans ce contrôle, viser la source d'une autre édition répondrait 200 en n'ayant rien fait —
     * et l'écran afficherait une réussite.
     */
    prismaMock.editionAnalysisSource.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.editionAnalysisSource.deleteMany.mockResolvedValue({ count: 0 })

    await expect(appeler(modifier, { actif: false }, { sourceId: '42' })).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(appeler(supprimer, undefined, { sourceId: '42' })).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('refuse un identifiant de source qui n’en est pas un', async () => {
    await expect(appeler(modifier, { actif: false }, { sourceId: 'abc' })).rejects.toBeDefined()
    expect(prismaMock.editionAnalysisSource.updateMany).not.toHaveBeenCalled()
  })

  it('📍 refuse une modification vide, plutôt que d’écrire un objet sans champ', async () => {
    await expect(appeler(modifier, {}, { sourceId: '42' })).rejects.toBeDefined()
    expect(prismaMock.editionAnalysisSource.updateMany).not.toHaveBeenCalled()
  })
})
