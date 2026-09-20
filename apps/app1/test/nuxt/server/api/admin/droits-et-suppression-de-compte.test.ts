import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRequireAdmin = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

const mockFetchResourceOrFail = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/prisma-helpers', () => ({
  fetchResourceOrFail: mockFetchResourceOrFail,
}))

const mockValidateUserId = vi.hoisted(() => vi.fn())
const mockValidateResourceId = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/validation-helpers', () => ({
  validateUserId: mockValidateUserId,
  validateResourceId: mockValidateResourceId,
}))

const mockSendEmail = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/emailService', () => ({
  sendEmail: mockSendEmail,
  generateAccountDeletionEmailHtml: vi.fn(async () => '<p>bonjour</p>'),
}))

import promouvoir from '../../../../../server/api/admin/users/[id]/promote.put'
import supprimer from '../../../../../server/api/admin/users/[id].delete'

const prismaMock = (globalThis as any).prisma

/**
 * Les deux gestes irréversibles qu'un administrateur peut porter sur un compte.
 *
 * Aucun des deux n'avait de test, alors qu'ils portent chacun un refus métier écrit à la main —
 * on ne modifie pas ses propres droits, on ne supprime pas un administrateur. Ces refus ne sont
 * tenus par rien d'autre : ni par le schéma, ni par une contrainte de base. Les retirer par
 * inadvertance ne casserait aucun autre test.
 *
 * Ce que ces tests figent n'est donc pas le chemin nominal — il est simple — mais les trois
 * conditions qui empêchent une catastrophe : se retirer ses propres droits et perdre la main sur
 * la plateforme, effacer le compte d'un autre administrateur, ou supprimer sans motif.
 */

const ADMIN = { id: 1, isGlobalAdmin: true, email: 'admin@exemple.fr', pseudo: 'admin' }

describe('PUT /api/admin/users/[id]/promote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockValidateUserId.mockReturnValue(42)
    mockFetchResourceOrFail.mockResolvedValue({ id: 42 })
    ;(global as any).readBody = vi.fn().mockResolvedValue({ isGlobalAdmin: true })
    prismaMock.user.update.mockResolvedValue({ id: 42, isGlobalAdmin: true })
  })

  it('promeut un autre compte', async () => {
    const res: any = await promouvoir({} as any)
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: expect.objectContaining({ isGlobalAdmin: true }),
      })
    )
    expect(res.data.isGlobalAdmin).toBe(true)
  })

  it('rétrograde aussi bien qu’il promeut', async () => {
    ;(global as any).readBody = vi.fn().mockResolvedValue({ isGlobalAdmin: false })
    prismaMock.user.update.mockResolvedValue({ id: 42, isGlobalAdmin: false })
    await promouvoir({} as any)
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isGlobalAdmin: false }) })
    )
  })

  it('refuse qu’un administrateur modifie ses PROPRES droits', async () => {
    // Le garde-fou décisif : sans lui, une rétrogradation de soi-même fait perdre la main sur la
    // plateforme, et plus personne ne peut la rendre.
    mockValidateUserId.mockReturnValue(ADMIN.id)
    await expect(promouvoir({} as any)).rejects.toThrow(
      'Vous ne pouvez pas modifier vos propres droits administrateur'
    )
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuse avant même de lire le corps de la requête', async () => {
    // L'ordre compte : lire puis refuser laisserait la validation s'exécuter sur une requête
    // qu'on n'aurait pas dû servir.
    mockValidateUserId.mockReturnValue(ADMIN.id)
    const lireLeCorps = vi.fn()
    ;(global as any).readBody = lireLeCorps
    await expect(promouvoir({} as any)).rejects.toThrow()
    expect(lireLeCorps).not.toHaveBeenCalled()
  })

  it('refuse un corps sans le drapeau attendu', async () => {
    ;(global as any).readBody = vi.fn().mockResolvedValue({})
    await expect(promouvoir({} as any)).rejects.toThrow()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('n’écrit rien quand le droit d’administrateur manque', async () => {
    // On n'affirme pas le message : `wrapApiHandler` réécrit en 500 toute erreur qui n'est pas
    // une erreur HTTP, et ce test porterait alors sur l'enveloppe plutôt que sur la garde. Ce
    // qui compte est qu'aucune écriture n'ait lieu.
    mockRequireAdmin.mockRejectedValue(new Error('Droits insuffisants'))
    await expect(promouvoir({} as any)).rejects.toThrow()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockValidateResourceId.mockReturnValue(42)
    mockFetchResourceOrFail.mockResolvedValue({
      id: 42,
      email: 'cible@exemple.fr',
      pseudo: 'cible',
      nom: 'Martin',
      prenom: 'Camille',
      isGlobalAdmin: false,
    })
    ;(global as any).readBody = vi.fn().mockResolvedValue({ reason: 'SPAM_ACTIVITY' })
    mockSendEmail.mockResolvedValue(true)
    prismaMock.user.delete.mockResolvedValue({ id: 42 })
    prismaMock.$transaction?.mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prismaMock) : fn
    )
  })

  it('supprime un compte ordinaire et prévient la personne', async () => {
    await supprimer({} as any)
    expect(prismaMock.user.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42 } })
    )
    // Le courriel part AVANT la suppression : après, l'adresse n'existe plus.
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'cible@exemple.fr' }))
  })

  it('refuse de supprimer un administrateur global', async () => {
    mockFetchResourceOrFail.mockResolvedValue({
      id: 42,
      email: 'autre@exemple.fr',
      prenom: 'Alex',
      isGlobalAdmin: true,
    })
    await expect(supprimer({} as any)).rejects.toThrow(
      'Impossible de supprimer un super administrateur'
    )
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('refuse qu’un administrateur supprime son propre compte', async () => {
    mockValidateResourceId.mockReturnValue(ADMIN.id)
    await expect(supprimer({} as any)).rejects.toThrow('Impossible de supprimer son propre compte')
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('exige un motif, et un motif connu', async () => {
    // Le motif n'est pas décoratif : il compose le courriel envoyé à la personne. Sans lui,
    // quelqu'un apprendrait la suppression de son compte sans en connaître la raison.
    for (const corps of [{}, { reason: '' }, { reason: 'PARCE_QUE' }]) {
      vi.clearAllMocks()
      mockRequireAdmin.mockResolvedValue(ADMIN)
      mockValidateResourceId.mockReturnValue(42)
      ;(global as any).readBody = vi.fn().mockResolvedValue(corps)
      await expect(supprimer({} as any)).rejects.toThrow('Raison de suppression invalide')
      expect(prismaMock.user.delete).not.toHaveBeenCalled()
    }
  })

  it('supprime quand même si le courriel échoue', async () => {
    // Décision déjà prise dans le code, et qui mérite d'être figée : un serveur de courriel
    // indisponible ne doit pas empêcher une suppression demandée pour abus.
    mockSendEmail.mockRejectedValue(new Error('smtp injoignable'))
    await supprimer({} as any)
    expect(prismaMock.user.delete).toHaveBeenCalled()
  })

  it('n’écrit rien quand le droit d’administrateur manque', async () => {
    // Même raison que pour la promotion : c'est l'absence d'écriture qui prouve la garde.
    mockRequireAdmin.mockRejectedValue(new Error('Droits insuffisants'))
    await expect(supprimer({} as any)).rejects.toThrow()
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })
})
