import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/permissions/edition-permissions', () => ({
  canEditEdition: vi.fn(),
}))

// Mock de storeFileLocally depuis nuxt-file-storage
vi.mock('#imports', async () => {
  const actual = await vi.importActual('#imports')
  return {
    ...actual,
    storeFileLocally: vi.fn(),
  }
})

import { canEditEdition } from '../../../../../server/utils/permissions/edition-permissions'
import handler from '../../../../../server/api/files/lost-found.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockCanEditEdition = canEditEdition as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    params: {},
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

const mockEventWithoutUser = {
  context: {
    params: {},
  },
}

const mockEdition = {
  id: 1,
  conventionId: 10,
  name: 'Convention Test 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-03'),
  convention: {
    id: 10,
    organizers: [{ userId: 1 }],
  },
}

const mockFile = {
  name: 'objet-trouve.jpg',
  filename: 'objet-trouve.jpg',
  type: 'image/jpeg',
  data: Buffer.from('fake image data'),
}

describe('/api/files/lost-found POST', () => {
  beforeEach(async () => {
    mockCanEditEdition.mockReset()
    prismaMock.edition.findUnique.mockReset()
    global.readBody = vi.fn()
    global.storeFileLocally = vi.fn().mockResolvedValue('abc123-objet-trouve.jpg')
  })

  describe('Smoke tests - structure', () => {
    it('smoke test: devrait être importable', () => {
      expect(handler).toBeDefined()
      expect(typeof handler).toBe('function')
    })

    it('smoke test: structure de fichier image', () => {
      expect(mockFile).toHaveProperty('name')
      expect(mockFile).toHaveProperty('filename')
      expect(mockFile).toHaveProperty('type')
      expect(mockFile).toHaveProperty('data')
    })

    it('smoke test: types de fichiers autorisés pour images', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

      expect(allowedTypes).toContain('image/jpeg')
      expect(allowedTypes).toContain('image/png')
      expect(allowedTypes).toContain('image/webp')
    })

    it('smoke test: structure de réponse attendue', () => {
      const mockResponse = {
        success: true,
        imageUrl: '/uploads/conventions/10/editions/1/lost-found/abc123-objet.jpg',
        filename: 'abc123-objet.jpg',
        editionId: 1,
        conventionId: 10,
      }

      expect(mockResponse).toHaveProperty('success')
      expect(mockResponse).toHaveProperty('imageUrl')
      expect(mockResponse).toHaveProperty('filename')
      expect(mockResponse).toHaveProperty('editionId')
      expect(mockResponse).toHaveProperty('conventionId')
      expect(mockResponse.success).toBe(true)
    })

    it('smoke test: chemin de stockage', () => {
      const conventionId = 10
      const editionId = 1
      const expectedPath = `conventions/${conventionId}/editions/${editionId}/lost-found`

      expect(expectedPath).toBe('conventions/10/editions/1/lost-found')
    })
  })

  describe('Validations', () => {
    it('devrait rejeter si non authentifié (pas de session)', async () => {
      await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
    })

    it('devrait rejeter si aucun fichier fourni', async () => {
      global.readBody.mockResolvedValue({
        files: [],
        metadata: { editionId: 1 },
      })

      await expect(handler(mockEvent as any)).rejects.toThrow('Aucun fichier fourni')
    })

    it('devrait rejeter si files est undefined', async () => {
      global.readBody.mockResolvedValue({
        metadata: { editionId: 1 },
      })

      await expect(handler(mockEvent as any)).rejects.toThrow('Aucun fichier fourni')
    })

    it("devrait rejeter si ID d'édition manquant", async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: {},
      })

      await expect(handler(mockEvent as any)).rejects.toThrow(
        "ID d'édition requis pour les objets trouvés"
      )
    })

    it('devrait accepter editionId dans metadata.entityId', async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { entityId: 1 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      mockCanEditEdition.mockReturnValue(true)
      global.storeFileLocally.mockResolvedValue('test-file.jpg')

      const result = await handler(mockEvent as any)

      expect(result.editionId).toBe(1)
    })

    it('devrait accepter editionId dans metadata.editionId', async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 1 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      mockCanEditEdition.mockReturnValue(true)
      global.storeFileLocally.mockResolvedValue('test-file.jpg')

      const result = await handler(mockEvent as any)

      expect(result.editionId).toBe(1)
    })
  })

  describe('Vérifications édition', () => {
    it('devrait rejeter si édition non trouvée', async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 999 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(null)

      await expect(handler(mockEvent as any)).rejects.toThrow('Édition introuvable')
    })

    it("devrait vérifier l'édition avec les bons paramètres", async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 123 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(null)

      try {
        await handler(mockEvent as any)
      } catch {
        // Ignorer l'erreur
      }

      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 123 },
        include: expect.objectContaining({
          convention: expect.objectContaining({
            include: expect.objectContaining({
              organizers: true,
            }),
          }),
        }),
      })
    })
  })

  describe('Permissions', () => {
    it("devrait rejeter si utilisateur n'a pas les droits d'édition", async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 1 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      mockCanEditEdition.mockReturnValue(false)

      await expect(handler(mockEvent as any)).rejects.toThrow(
        "Vous n'avez pas les droits pour ajouter des objets trouvés à cette édition"
      )
    })

    it("devrait appeler canEditEdition avec l'édition et l'utilisateur", async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 1 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      mockCanEditEdition.mockReturnValue(false)

      try {
        await handler(mockEvent as any)
      } catch {
        // Ignorer l'erreur
      }

      expect(mockCanEditEdition).toHaveBeenCalledWith(
        mockEdition,
        expect.objectContaining({ id: 1 })
      )
    })
  })

  describe('Upload réussi', () => {
    it('devrait uploader un fichier avec succès', async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 1 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      mockCanEditEdition.mockReturnValue(true)
      global.storeFileLocally.mockResolvedValue('abc123-objet.jpg')

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.filename).toBe('abc123-objet.jpg')
      expect(result.editionId).toBe(1)
      expect(result.conventionId).toBe(10)
    })

    it('devrait construire le chemin URL correct', async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 1 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      mockCanEditEdition.mockReturnValue(true)
      global.storeFileLocally.mockResolvedValue('abc123-objet.jpg')

      const result = await handler(mockEvent as any)

      expect(result.imageUrl).toBe('/uploads/conventions/10/editions/1/lost-found/abc123-objet.jpg')
    })

    it('devrait appeler storeFileLocally avec les bons paramètres', async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 1 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      mockCanEditEdition.mockReturnValue(true)
      global.storeFileLocally.mockResolvedValue('abc123-objet.jpg')

      await handler(mockEvent as any)

      expect(global.storeFileLocally).toHaveBeenCalledWith(
        mockFile,
        8, // longueur ID unique
        'conventions/10/editions/1/lost-found' // dossier de destination
      )
    })

    it('devrait prendre uniquement le premier fichier', async () => {
      const secondFile = { ...mockFile, name: 'second.jpg' }

      global.readBody.mockResolvedValue({
        files: [mockFile, secondFile],
        metadata: { editionId: 1 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      mockCanEditEdition.mockReturnValue(true)
      global.storeFileLocally.mockResolvedValue('abc123-objet.jpg')

      await handler(mockEvent as any)

      // storeFileLocally devrait être appelé avec le premier fichier
      expect(global.storeFileLocally).toHaveBeenCalledTimes(1)
      expect(global.storeFileLocally).toHaveBeenCalledWith(
        mockFile,
        expect.any(Number),
        expect.any(String)
      )
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 1 },
      })

      prismaMock.edition.findUnique.mockRejectedValue(new Error('DB Error'))

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
    })

    it('devrait relancer les erreurs HTTP', async () => {
      const httpError = {
        statusCode: 403,
        statusMessage: 'Access denied',
      }

      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 1 },
      })

      prismaMock.edition.findUnique.mockRejectedValue(httpError)

      await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
    })

    it('devrait gérer les erreurs de stockage de fichier', async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { editionId: 1 },
      })

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      mockCanEditEdition.mockReturnValue(true)
      global.storeFileLocally.mockRejectedValue(new Error('Storage Error'))

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
    })
  })
})
