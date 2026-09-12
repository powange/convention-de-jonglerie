import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())
const mockTestConnection = vi.hoisted(() => vi.fn())
const mockDecrypt = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

vi.mock('#server/utils/editions/ticketing/helloasso', () => ({
  testHelloAssoConnection: mockTestConnection,
}))

vi.mock('#server/utils/encryption', () => ({
  decrypt: mockDecrypt,
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/helloasso/test.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22' }, user: { id: 1, pseudo: 'quelquun' } },
}

/**
 * Cet endpoint teste la connexion à HelloAsso. Quand le corps omet `clientSecret`, il va chercher
 * celui de l'édition en base et le **déchiffre** pour s'en servir.
 *
 * Il n'appelait que `requireAuth` : n'importe quel compte pouvait donc faire utiliser les
 * identifiants de paiement de n'importe quelle édition, en passant simplement son numéro dans
 * l'URL. L'endpoint jumeau d'Infomaniak vérifiait une permission, lui — c'était un oubli, pas une
 * décision.
 */
describe('POST /api/editions/[id]/ticketing/helloasso/test', () => {
  const corpsSansSecret = {
    clientId: 'un-client-id',
    organizationSlug: 'ma-convention',
    formType: 'Event',
    formSlug: 'billetterie-2026',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    mockDecrypt.mockReturnValue('secret-en-clair')
    mockTestConnection.mockResolvedValue({ success: true, form: { name: 'Billetterie 2026' } })
    prismaMock.helloAssoConfig.findFirst.mockResolvedValue({ clientSecret: 'secret-chiffre' })
  })

  const envoyer = (body: unknown = corpsSansSecret) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return handler(evenement as any)
  }

  describe('qui a le droit de tester', () => {
    it('refuse un utilisateur sans droit sur la billetterie de cette édition', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer()).rejects.toMatchObject({ statusCode: 403 })
    })

    it('ne va pas chercher le secret en base avant d’avoir vérifié le droit', async () => {
      // L'ordre compte : lire puis refuser laisserait le déchiffrement s'exécuter, et c'est
      // précisément l'opération qu'on ne veut pas offrir à qui n'y a pas droit.
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer()).rejects.toBeDefined()

      expect(prismaMock.helloAssoConfig.findFirst).not.toHaveBeenCalled()
      expect(mockDecrypt).not.toHaveBeenCalled()
    })

    it('ne contacte pas HelloAsso pour un utilisateur refusé', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer()).rejects.toBeDefined()

      expect(mockTestConnection).not.toHaveBeenCalled()
    })

    it('laisse passer un gestionnaire de la billetterie', async () => {
      const resultat = await envoyer()

      expect(resultat.success).toBe(true)
      expect(mockCanManage).toHaveBeenCalledWith(22, 1, evenement)
    })
  })

  describe('le secret stocké', () => {
    it('est déchiffré et employé quand le corps ne le fournit pas', async () => {
      await envoyer()

      expect(mockDecrypt).toHaveBeenCalledWith('secret-chiffre')
      expect(mockTestConnection).toHaveBeenCalledWith(
        expect.objectContaining({ clientSecret: 'secret-en-clair' }),
        expect.anything()
      )
    })

    it('n’est pas consulté quand le corps en fournit un', async () => {
      await envoyer({ ...corpsSansSecret, clientSecret: 'secret-fourni' })

      expect(prismaMock.helloAssoConfig.findFirst).not.toHaveBeenCalled()
      expect(mockTestConnection).toHaveBeenCalledWith(
        expect.objectContaining({ clientSecret: 'secret-fourni' }),
        expect.anything()
      )
    })
  })

  describe('ce que la réponse laisse deviner', () => {
    it('ne distingue pas « pas de configuration » d’un échec de connexion', async () => {
      // Sans cela, l'endpoint renseigne sur les éditions qui ont une billetterie HelloAsso et
      // celles qui n'en ont pas — une information que le refus de droit ne couvre plus une fois
      // qu'on est gestionnaire d'une seule édition parmi d'autres.
      prismaMock.helloAssoConfig.findFirst.mockResolvedValue(null)

      const sansConfig = await envoyer().catch((e: any) => e)

      // Une erreur telle que l'utilitaire la remonte : le test vérifie que l'endpoint ne la
      // relaie pas telle quelle.
      mockTestConnection.mockRejectedValue(
        Object.assign(new Error('Identifiants HelloAsso invalides'), { statusCode: 401 })
      )
      const mauvaisIdentifiants = await envoyer({
        ...corpsSansSecret,
        clientSecret: 'mauvais',
      }).catch((e: any) => e)

      expect(sansConfig.statusCode).toBe(mauvaisIdentifiants.statusCode)
      expect(sansConfig.message).toBe(mauvaisIdentifiants.message)
    })
  })
})
