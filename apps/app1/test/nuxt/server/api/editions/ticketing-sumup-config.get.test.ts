import { describe, it, expect, beforeEach, vi } from 'vitest'

/*
 * Les globales que Nitro pose à l'exécution, et qu'il faut poser AVANT l'import du handler :
 * celui-ci appelle `wrapApiHandler` à l'évaluation de son module, pas à l'appel.
 */
vi.hoisted(() => {
  const g = globalThis as any
  if (!g.wrapApiHandler) g.wrapApiHandler = (handler: any) => handler
  if (!g.validateEditionId) g.validateEditionId = (e: any) => parseInt(e?.context?.params?.id, 10)
  if (!g.createSuccessResponse)
    g.createSuccessResponse = (data: unknown) => ({ success: true, data })
})

import { global } from '../../../globales-nitro'

const canManageTicketingMock = vi.hoisted(() => vi.fn())
const getEditionWithPermissionsMock = vi.hoisted(() => vi.fn())
const estBenevoleEnCreneauMock = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketing: canManageTicketingMock,
  getEditionWithPermissions: getEditionWithPermissionsMock,
}))
vi.mock('#server/utils/permissions/access-control-permissions', () => ({
  isActiveAccessControlVolunteer: estBenevoleEnCreneauMock,
}))
vi.mock('#server/utils/encryption', () => ({ decrypt: (v: string) => `clair:${v}` }))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => {
    if (!event.context.user) {
      const erreur = new Error('Non authentifié')
      ;(erreur as any).statusCode = 401
      throw erreur
    }
    return event.context.user
  },
}))

const handler = (
  await import('../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/sumup/config.get')
).default

const prismaMock = (globalThis as any).prisma

/**
 * La clé SumUp au guichet.
 *
 * ⚠️ POURQUOI CETTE GARDE A CHANGÉ. L'endpoint était réservé à `canManageTicketing` — et la page de
 * contrôle d'accès demandait pourtant cette configuration à CHAQUE ouverture, pour tout le monde.
 * Relevé dans les journaux de production du 1er octobre 2026 : un bénévole en créneau récoltait un
 * 403 invisible à l'écran, et surtout ne pouvait pas encaisser par carte depuis « ajouter un
 * participant », alors que ce bouton lui est ouvert.
 *
 * 🔬 CE QUE CES CAS TIENNENT ENSEMBLE, et c'est tout l'enjeu : la clé s'ouvre au bénévole qui tient
 * RÉELLEMENT la porte, et à personne d'autre. Un créneau terminé ne suffit pas.
 */
describe('GET sumup/config — qui peut lire la clé', () => {
  const evenement = (userId: number | null) => ({
    context: { params: { id: '22' }, user: userId ? { id: userId } : null },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getEditionWithPermissionsMock.mockResolvedValue({ id: 22 })
    prismaMock.sumupConfig = {
      findUnique: vi.fn().mockResolvedValue({
        editionId: 22,
        affiliateKey: 'chiffree',
        appId: 'app-1',
        updatedAt: new Date('2026-10-01T10:00:00Z'),
      }),
    }
  })

  it('rend la clé à qui gère la billetterie', async () => {
    canManageTicketingMock.mockReturnValue(true)

    const reponse: any = await handler(evenement(1) as never)

    expect(reponse.data.config.affiliateKey).toBe('clair:chiffree')
    // Le créneau n'est même pas interrogé : le droit de gestion suffit.
    expect(estBenevoleEnCreneauMock).not.toHaveBeenCalled()
  })

  it('rend la clé au bénévole dont le créneau de contrôle d’accès est EN COURS', async () => {
    canManageTicketingMock.mockReturnValue(false)
    estBenevoleEnCreneauMock.mockResolvedValue(true)

    const reponse: any = await handler(evenement(2) as never)

    expect(reponse.data.config.affiliateKey).toBe('clair:chiffree')
    expect(estBenevoleEnCreneauMock).toHaveBeenCalledWith(2, 22)
  })

  it('la refuse à qui ne tient pas la porte', async () => {
    /*
     * 🔬 L'assertion qui borne l'élargissement. Sans elle, remplacer la condition par « être
     * connecté » passerait les deux cas précédents et ouvrirait la clé à toute l'édition.
     */
    canManageTicketingMock.mockReturnValue(false)
    estBenevoleEnCreneauMock.mockResolvedValue(false)

    await expect(handler(evenement(3) as never)).rejects.toMatchObject({ statusCode: 403 })
  })
})
