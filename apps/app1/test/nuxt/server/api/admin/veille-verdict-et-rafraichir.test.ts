import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * ⚠️ Les gardes et le registre de sources sont bouchonnés par `vi.mock` du MODULE : les deux points
 * d'API les importent explicitement, donc un bouchon posé sur `global` ne les atteindrait pas. Et
 * les `vi.mock` doivent précéder les imports de gestionnaires, d'où les `vi.hoisted`.
 */
const mockRequireAdmin = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

const sources = vi.hoisted(() => ({
  qui_marche: { cle: 'qui_marche', nom: 'Qui marche', lister: vi.fn() },
  qui_casse: { cle: 'qui_casse', nom: 'Qui casse', lister: vi.fn() },
}))
vi.mock('#server/utils/veille-sources', () => ({
  SOURCES: [sources.qui_marche, sources.qui_casse],
  sourceParCle: (cle: string) => (sources as Record<string, unknown>)[cle] ?? null,
  cleDeRapprochement: () => null,
}))

import verdictHandler from '../../../../../server/api/admin/veille/verdict.post'
import rafraichirHandler from '../../../../../server/api/admin/veille/rafraichir.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma
const URL_CANDIDAT = 'https://jugglingedge.com/event.php?EventID=6485'

const appeler = (handler: unknown, corps: unknown) => {
  global.readBody = vi.fn().mockResolvedValue(corps)
  return (handler as (e: unknown) => Promise<any>)({ context: {} })
}

describe('POST /api/admin/veille/verdict', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.candidatEvenement.findUnique.mockResolvedValue({ id: 7 })
    prismaMock.candidatEvenement.update.mockResolvedValue({})
  })

  it('écrit le verdict et sa date, adressé par URL', async () => {
    /*
     * 📍 L'adressage se fait par URL et non par `id` : c'est l'URL qui porte l'identité d'un
     * candidat, et c'est à elle que le refus s'attache.
     */
    await appeler(verdictHandler, { url: URL_CANDIDAT, verdict: 'REFUSE' })

    const appel = prismaMock.candidatEvenement.update.mock.calls[0][0]
    expect(appel.where).toEqual({ url: URL_CANDIDAT })
    expect(appel.data.verdict).toBe('REFUSE')
    expect(appel.data.verdictLe).toBeInstanceOf(Date)
  })

  it('⚠️ répond 404 sur un candidat inconnu, plutôt que de le créer en silence', async () => {
    /*
     * L'écran ne propose un verdict que sur ce qu'il a affiché : une URL absente signale un
     * désaccord entre les deux, et le créer masquerait ce désaccord.
     */
    prismaMock.candidatEvenement.findUnique.mockResolvedValue(null)

    await expect(
      appeler(verdictHandler, { url: URL_CANDIDAT, verdict: 'REFUSE' })
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.candidatEvenement.update).not.toHaveBeenCalled()
  })

  it('refuse un verdict hors de l’énumération, et une URL qui n’en est pas une', async () => {
    await expect(
      appeler(verdictHandler, { url: URL_CANDIDAT, verdict: 'PEUT_ETRE' })
    ).rejects.toBeDefined()
    await expect(
      appeler(verdictHandler, { url: 'pas une url', verdict: 'REFUSE' })
    ).rejects.toBeDefined()
    expect(prismaMock.candidatEvenement.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/veille/rafraichir', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.candidatEvenement.findUnique.mockResolvedValue(null)
    prismaMock.candidatEvenement.upsert.mockResolvedValue({})
    sources.qui_marche.lister.mockResolvedValue([
      {
        url: URL_CANDIDAT,
        identifiantSource: '6485',
        titre: 'Convention témoin',
        debut: '2026-11-20',
        jours: 3,
        pays: 'Allemagne',
        lieu: null,
        adresse: null,
      },
    ])
    sources.qui_casse.lister.mockRejectedValue(new Error('agenda injoignable'))
  })

  it('⚠️ une source en échec n’interrompt pas les autres, et son erreur est RAPPORTÉE', async () => {
    /*
     * LE cas. Un agenda momentanément inaccessible ne doit ni faire échouer le balayage entier, ni
     * passer pour « plus aucun événement » — ce qu'un tableau vide laisserait croire. L'erreur doit
     * donc remonter dans le bilan plutôt que d'être avalée par le `catch`.
     */
    const resultat = await appeler(rafraichirHandler, {})

    const bilans = resultat.data.bilans
    expect(bilans).toHaveLength(2)
    expect(bilans.find((b: any) => b.source === 'qui_marche')).toMatchObject({
      lus: 1,
      nouveaux: 1,
      erreur: null,
    })
    expect(bilans.find((b: any) => b.source === 'qui_casse')?.erreur).toContain('injoignable')
  })

  it('le témoin : la source en échec a bien été SOLLICITÉE', async () => {
    // Sans ce cas, un bilan d'erreur serait satisfait par une source jamais appelée.
    await appeler(rafraichirHandler, {})

    expect(sources.qui_casse.lister).toHaveBeenCalledTimes(1)
    expect(sources.qui_marche.lister).toHaveBeenCalledTimes(1)
  })

  it('ne lit qu’une source quand on la nomme', async () => {
    await appeler(rafraichirHandler, { source: 'qui_marche' })

    expect(sources.qui_marche.lister).toHaveBeenCalledTimes(1)
    expect(sources.qui_casse.lister).not.toHaveBeenCalled()
  })

  it('refuse une source inconnue, plutôt que de ne rien lire en silence', async () => {
    await expect(appeler(rafraichirHandler, { source: 'inexistante' })).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})
