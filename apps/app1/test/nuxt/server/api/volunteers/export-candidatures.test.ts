import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createPaginatedResponse: (items: unknown[]) => ({ success: true, data: items }),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
  validatePagination: () => ({ page: 1 }),
}))

const mockPeutGerer = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/organizer-management', () => ({
  canManageEditionVolunteers: mockPeutGerer,
}))

vi.mock('#server/utils/infos-personnelles', () => ({
  infosPersonnelles: (app: any) => app,
  infosPersonnellesSelect: {},
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ eventScope: { getRelatedEventIds: async () => [1] } }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/applications.get'
import { global } from '../../../globales-nitro'
import { BOM_UTF8 } from '../../../../../shared/utils/csv'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '1' }, user: { id: 10 } } }

/**
 * L'export CSV des candidatures bénévoles.
 *
 * Ce point d'API produisait son CSV à la main, et n'avait AUCUN test — c'est en le branchant sur
 * le format partagé qu'on s'en est aperçu. Ces tests tiennent les trois défauts que la migration
 * corrige, pour qu'un retour en arrière se voie :
 *
 * - l'ENCODAGE : sans marque d'ordre des octets, Excel sous Windows lit « Prénom » en
 *   « PrÃ©nom » sur toute la colonne ;
 * - l'ÉCHAPPEMENT des en-têtes, qui tenait par chance faute de virgule dans un libellé ;
 * - l'INJECTION de formule, une motivation étant du texte saisi par un utilisateur.
 */
describe("GET .../volunteers/applications — l'export CSV", () => {
  const candidature = (motivation: string, prenom = 'Alice') => ({
    id: 1,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    status: 'ACCEPTED',
    motivation,
    user: { pseudo: 'alice', prenom, nom: 'Martin', email: 'a@x.fr', phone: '+33612345678' },
    teamPreferences: [],
    timePreferences: [],
    assignedTeams: [],
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockPeutGerer.mockResolvedValue(true)
    prismaMock.event.findUnique.mockResolvedValue({ id: 1 })
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([candidature('Bonjour')])
    prismaMock.editionVolunteerApplication.count.mockResolvedValue(1)
    global.getQuery = vi.fn(() => ({ export: 'true' }))
    global.setHeader = vi.fn()
  })

  it("refuse l'export sans droits", async () => {
    mockPeutGerer.mockResolvedValue(false)
    await expect(handler(evenement as any)).rejects.toThrow(/Droits insuffisants/)
  })

  it('commence par la marque d’ordre des octets', async () => {
    const csv: any = await handler(evenement as any)
    expect(typeof csv).toBe('string')
    expect(csv.startsWith(BOM_UTF8)).toBe(true)
  })

  it('annonce un fichier CSV en pièce jointe', async () => {
    await handler(evenement as any)
    const entetes = global.setHeader.mock.calls.map((appel: any[]) => [appel[1], appel[2]])
    expect(entetes).toContainEqual(['Content-Type', 'text/csv; charset=utf-8'])
    expect(entetes.find(([nom]: any[]) => nom === 'Content-Disposition')?.[1]).toContain(
      'candidatures-benevoles-edition-1.csv'
    )
  })

  it('ÉCHAPPE les en-têtes, et pas seulement les cellules', async () => {
    const csv: any = await handler(evenement as any)
    const premiereLigne = csv.split('\r\n')[0]
    expect(premiereLigne.startsWith(`${BOM_UTF8}"`)).toBe(true)
    expect(premiereLigne).toContain('"Date candidature"')
  })

  it('NEUTRALISE une motivation qui commence par un signe égal', async () => {
    // Du texte saisi par un candidat, exécuté à l'ouverture du fichier chez l'organisateur.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([candidature('=cmd|/c calc')])
    const csv: any = await handler(evenement as any)
    expect(csv).toContain(`"'=cmd|/c calc"`)
  })

  it('laisse INTACT un numéro de téléphone international', async () => {
    // 144 des 202 numéros en base commencent par « + » : les marquer serait pire que le mal.
    const csv: any = await handler(evenement as any)
    expect(csv).toContain('"+33612345678"')
  })

  it('garde une virgule dans sa cellule', async () => {
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      candidature('Bonjour, je suis dispo le samedi'),
    ])
    const csv: any = await handler(evenement as any)
    expect(csv).toContain('"Bonjour, je suis dispo le samedi"')
  })

  it('sépare les lignes par CRLF', async () => {
    const csv: any = await handler(evenement as any)
    expect(csv.split('\r\n').length).toBeGreaterThanOrEqual(2)
  })
})
