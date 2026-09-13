import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: vi.fn(),
}))

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import handler from '../../../../../server/api/admin/error-logs/resolve-similar.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma
const mockAdmin = requireGlobalAdminWithDbCheck as ReturnType<typeof vi.fn>

const evenement = { context: {} }

/**
 * Cet endpoint n'avait AUCUN test, et son effet est irréversible.
 *
 * Il résolvait sur le seul `message` : marquer résolu un « Données invalides » sur une route les
 * résolvait sur TOUTES les autres, un message de validation générique étant partagé par des
 * dizaines d'endpoints. Ces tests tiennent la portée exacte de l'opération.
 */
describe('/api/admin/error-logs/resolve-similar POST', () => {
  const corpsValide = {
    errorType: 'ValidationError',
    method: 'POST',
    path: '/api/editions',
    message: 'Données invalides',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin.mockResolvedValue({ id: 42 })
    prismaMock.apiErrorLog.updateMany.mockResolvedValue({ count: 3 })
    global.readBody = vi.fn().mockResolvedValue(corpsValide)
  })

  it('restreint la résolution aux quatre composantes de l’empreinte', () => {
    // Le correctif lui-même : sans `path` et `method` dans le filtre, l'opération débordait sur
    // tous les endpoints partageant ce message.
    return handler(evenement as any).then(() => {
      expect(prismaMock.apiErrorLog.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            errorType: 'ValidationError',
            method: 'POST',
            path: '/api/editions',
            message: 'Données invalides',
            resolved: false,
          },
        })
      )
    })
  })

  it('ne retouche jamais une entrée déjà résolue', async () => {
    // Sans quoi l'opération réécrirait `resolvedBy` et `resolvedAt` de quelqu'un d'autre, et
    // effacerait ses notes au passage.
    await handler(evenement as any)

    const { where } = prismaMock.apiErrorLog.updateMany.mock.calls.at(-1)![0]
    expect(where.resolved).toBe(false)
  })

  it('filtre sur IS NULL quand l’entrée n’a pas de type', async () => {
    // `errorType` est nullable en base. Un `undefined` serait ignoré par Prisma et élargirait le
    // filtre en silence — exactement ce qu'on cherche à empêcher ici.
    global.readBody = vi.fn().mockResolvedValue({ ...corpsValide, errorType: null })

    await handler(evenement as any)

    expect(prismaMock.apiErrorLog.updateMany.mock.calls.at(-1)![0].where.errorType).toBeNull()
  })

  it('consigne qui a résolu, et quand', async () => {
    await handler(evenement as any)

    const { data } = prismaMock.apiErrorLog.updateMany.mock.calls.at(-1)![0]
    expect(data.resolved).toBe(true)
    expect(data.resolvedBy).toBe(42)
    expect(data.resolvedAt).toBeInstanceOf(Date)
  })

  it('dit dans sa réponse sur quel endpoint l’opération a porté', async () => {
    // Le compte seul ne dit pas la portée, et c'est la portée qui surprenait.
    const reponse: any = await handler(evenement as any)

    expect(reponse.message).toContain('3')
    expect(reponse.message).toContain('POST /api/editions')
  })

  it('refuse un corps resté à l’ancienne forme plutôt que d’agir trop largement', async () => {
    // L'ancien corps ne portait que le message. Le bon sens de l'échec pour une action
    // irréversible est de refuser, pas de retomber sur le comportement trop large d'avant.
    global.readBody = vi.fn().mockResolvedValue({ message: 'Données invalides' })

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.apiErrorLog.updateMany).not.toHaveBeenCalled()
  })

  it('exige les droits d’administration avant toute écriture', async () => {
    mockAdmin.mockRejectedValue(new Error('Accès refusé'))

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.apiErrorLog.updateMany).not.toHaveBeenCalled()
  })
})
