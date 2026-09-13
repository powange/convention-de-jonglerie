import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: vi.fn(),
}))

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import handler from '../../../../../server/api/admin/error-logs/[id]/resolve.patch'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma
const mockAdmin = requireGlobalAdminWithDbCheck as ReturnType<typeof vi.fn>

const evenement = { context: { params: { id: 'cmtzg1e9l000001of7tio1j6i' } } }

/** La donnée passée à `update`, au dernier appel. */
const donneesEcrites = () => prismaMock.apiErrorLog.update.mock.calls.at(-1)![0].data

/**
 * Le champ `adminNotes` était écrit sans condition : `adminNotes: parsed.adminNotes || null`. Toute
 * bascule du statut sans renvoyer les notes les effaçait donc — et le chemin rapide depuis le
 * tableau est exactement dans ce cas, puisqu'il ne fait que basculer un statut.
 *
 * Le diagnostic qu'un administrateur avait écrit à la main disparaissait au premier clic de
 * quelqu'un d'autre, sans message et sans trace.
 */
describe('/api/admin/error-logs/[id]/resolve PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin.mockResolvedValue({ id: 42 })
    prismaMock.apiErrorLog.findUnique.mockResolvedValue({ id: evenement.context.params.id })
    prismaMock.apiErrorLog.update.mockResolvedValue({ id: evenement.context.params.id })
  })

  it('laisse les notes en place quand le corps n’en parle pas', async () => {
    // LE test du correctif. Basculer un statut n'a rien à dire des notes.
    global.readBody = vi.fn().mockResolvedValue({ resolved: true })

    await handler(evenement as any)

    expect(donneesEcrites()).not.toHaveProperty('adminNotes')
  })

  it('les laisse aussi en place quand on dé-résout', async () => {
    // L'ancien code effaçait dans les deux sens : c'est en rouvrant une entrée qu'on a le plus
    // besoin de relire ce qui avait été noté.
    global.readBody = vi.fn().mockResolvedValue({ resolved: false })

    await handler(evenement as any)

    expect(donneesEcrites()).not.toHaveProperty('adminNotes')
    expect(donneesEcrites().resolved).toBe(false)
  })

  it('remplace les notes quand le corps en fournit', async () => {
    global.readBody = vi
      .fn()
      .mockResolvedValue({ resolved: true, adminNotes: 'Corrigé par la PR #401' })

    await handler(evenement as any)

    expect(donneesEcrites().adminNotes).toBe('Corrigé par la PR #401')
  })

  it('efface sur une chaîne vide, qui est une demande explicite', async () => {
    // C'est ce que l'écran envoie quand on vide le champ et qu'on enregistre.
    global.readBody = vi.fn().mockResolvedValue({ resolved: true, adminNotes: '' })

    await handler(evenement as any)

    expect(donneesEcrites()).toHaveProperty('adminNotes', null)
  })

  it('efface aussi sur un `null` explicite', async () => {
    global.readBody = vi.fn().mockResolvedValue({ resolved: true, adminNotes: null })

    await handler(evenement as any)

    expect(donneesEcrites()).toHaveProperty('adminNotes', null)
  })

  it('consigne qui a résolu, et l’oublie quand on rouvre', async () => {
    global.readBody = vi.fn().mockResolvedValue({ resolved: true })
    await handler(evenement as any)
    expect(donneesEcrites().resolvedBy).toBe(42)
    expect(donneesEcrites().resolvedAt).toBeInstanceOf(Date)

    global.readBody = vi.fn().mockResolvedValue({ resolved: false })
    await handler(evenement as any)
    expect(donneesEcrites().resolvedBy).toBeNull()
    expect(donneesEcrites().resolvedAt).toBeNull()
  })

  it('exige les droits d’administration avant toute écriture', async () => {
    mockAdmin.mockRejectedValue(new Error('Accès refusé'))
    global.readBody = vi.fn().mockResolvedValue({ resolved: true })

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.apiErrorLog.update).not.toHaveBeenCalled()
  })
})
