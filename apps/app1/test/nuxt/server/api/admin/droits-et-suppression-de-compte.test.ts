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
    // Le `select` du handler rend ces champs, et le courriel se compose désormais SUR EUX : un
    // mock qui ne rendrait que l'id produirait un courriel adressé à `undefined`, ce qui est
    // précisément ce que le test d'ordre ci-dessous doit pouvoir distinguer.
    prismaMock.user.delete.mockResolvedValue({
      id: 42,
      email: 'cible@exemple.fr',
      pseudo: 'cible',
      nom: 'Martin',
      prenom: 'Camille',
    })
    prismaMock.$transaction?.mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prismaMock) : fn
    )
  })

  it('supprime un compte ordinaire et prévient la personne', async () => {
    await supprimer({} as any)
    expect(prismaMock.user.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42 } })
    )
    /*
     * 📍 Un commentaire de ce test affirmait que le courriel devait partir AVANT la suppression,
     * « après, l'adresse n'existe plus ». C'était faux : l'adresse est en mémoire, rendue par le
     * `select` de la suppression elle-même. Cette justification a survécu au défaut qu'elle
     * expliquait — de quoi dissuader quiconque aurait voulu corriger l'ordre.
     */
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'cible@exemple.fr' }))
  })

  it('n’envoie AUCUN courriel quand la suppression échoue', async () => {
    /*
     * ⚠️ LE TEST QUI PORTE LE LOT. Le courriel partait AVANT `prisma.user.delete` : toute
     * défaillance de la suppression — une clé étrangère en RESTRICT, une coupure de base, un
     * conteneur qui tombe — laissait un compte VIVANT dont le titulaire venait de recevoir
     * « votre compte a été supprimé », définitif et motivé.
     *
     * Il écrit alors pour contester une suppression qui n'a pas eu lieu, et l'administrateur ne
     * trouve dans les journaux rien qui explique l'écart : le courriel, lui, est bien parti.
     */
    prismaMock.user.delete.mockRejectedValue(new Error('contrainte de clé étrangère'))

    await expect(supprimer({} as any)).rejects.toThrow()

    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('envoie le courriel APRÈS la suppression, pas avant', async () => {
    /*
     * Le pendant du test précédent, et il n'est pas redondant : celui-ci voit l'ordre même quand
     * les deux réussissent. Sans lui, remettre l'envoi avant la suppression tout en la laissant
     * réussir passerait inaperçu — le cas nominal, donc celui qu'on observe le plus.
     */
    await supprimer({} as any)

    const ordreSuppression = prismaMock.user.delete.mock.invocationCallOrder[0]
    const ordreCourriel = mockSendEmail.mock.invocationCallOrder[0]

    expect(ordreSuppression).toBeLessThan(ordreCourriel)
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

  it('ne défait rien si le courriel échoue APRÈS la suppression', async () => {
    /*
     * Le risque s'est inversé avec l'ordre, et c'est assumé : un envoi qui échoue laisse un compte
     * bien supprimé dont le titulaire n'est pas averti. C'est le moindre des deux maux — le
     * silence se rattrape, l'annonce d'un fait qui n'a pas eu lieu non.
     *
     * Et l'échec d'envoi était DÉJÀ toléré auparavant : ce test existait, il change seulement de
     * raison d'être. Ce qu'il tient désormais, c'est que la réponse reste un succès — sans quoi
     * l'administrateur relancerait la suppression sur un compte qui n'existe plus.
     */
    mockSendEmail.mockRejectedValue(new Error('smtp injoignable'))

    await expect(supprimer({} as any)).resolves.toBeTruthy()

    expect(prismaMock.user.delete).toHaveBeenCalled()
  })

  it('n’écrit rien quand le droit d’administrateur manque', async () => {
    // Même raison que pour la promotion : c'est l'absence d'écriture qui prouve la garde.
    mockRequireAdmin.mockRejectedValue(new Error('Droits insuffisants'))
    await expect(supprimer({} as any)).rejects.toThrow()
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })
})
