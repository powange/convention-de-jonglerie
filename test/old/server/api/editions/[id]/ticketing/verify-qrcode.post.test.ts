import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock du module HelloAsso
vi.mock('../../../../../../../server/utils/editions/ticketing/helloasso', () => ({
  findTicketByQRCode: vi.fn(),
}))

import { findTicketByQRCode } from '../../../../../../../server/utils/editions/ticketing/helloasso'
import handler from '../../../../../../../server/api/editions/[id]/ticketing/verify-qrcode.post'

const mockFindTicketByQRCode = findTicketByQRCode as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

const validRequestBody = {
  clientId: 'client123',
  clientSecret: 'secret123',
  organizationSlug: 'org-slug',
  formType: 'event',
  formSlug: 'form-slug',
  qrCode: 'QR123456',
}

describe('/api/editions/[id]/ticketing/verify-qrcode POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
  })

  describe('Vérification réussie', () => {
    it('devrait trouver un ticket valide avec QR code', async () => {
      const mockTicket = {
        id: '1',
        user: {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
        },
        status: 'Processed',
      }

      global.readBody.mockResolvedValue(validRequestBody)
      mockFindTicketByQRCode.mockResolvedValue({
        found: true,
        ticket: mockTicket,
      })

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        found: true,
        ticket: mockTicket,
        message: 'Billet trouvé pour Jean Dupont',
      })

      expect(mockFindTicketByQRCode).toHaveBeenCalledWith(
        {
          clientId: 'client123',
          clientSecret: 'secret123',
        },
        {
          organizationSlug: 'org-slug',
          formType: 'event',
          formSlug: 'form-slug',
        },
        'QR123456'
      )
    })

    it("devrait indiquer si aucun ticket n'est trouvé", async () => {
      global.readBody.mockResolvedValue(validRequestBody)
      mockFindTicketByQRCode.mockResolvedValue({
        found: false,
        ticket: null,
      })

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        found: false,
        message: 'Aucun billet trouvé avec ce QR code',
      })
    })
  })

  describe('Authentification', () => {
    it('devrait rejeter si utilisateur non authentifié', async () => {
      const mockEventWithoutUser = { context: {} }
      await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
    })
  })

  describe('Validation des paramètres', () => {
    it('devrait rejeter si clientId manquant', async () => {
      const invalidBody = { ...validRequestBody, clientId: '' }
      global.readBody.mockResolvedValue(invalidBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si clientSecret manquant', async () => {
      const invalidBody = { ...validRequestBody, clientSecret: '' }
      global.readBody.mockResolvedValue(invalidBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si organizationSlug manquant', async () => {
      const invalidBody = { ...validRequestBody, organizationSlug: '' }
      global.readBody.mockResolvedValue(invalidBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si formType manquant', async () => {
      const invalidBody = { ...validRequestBody, formType: '' }
      global.readBody.mockResolvedValue(invalidBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si formSlug manquant', async () => {
      const invalidBody = { ...validRequestBody, formSlug: '' }
      global.readBody.mockResolvedValue(invalidBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si qrCode manquant', async () => {
      const invalidBody = { ...validRequestBody, qrCode: '' }
      global.readBody.mockResolvedValue(invalidBody)

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait accepter tous les paramètres valides', async () => {
      global.readBody.mockResolvedValue(validRequestBody)
      mockFindTicketByQRCode.mockResolvedValue({
        found: false,
        ticket: null,
      })

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(mockFindTicketByQRCode).toHaveBeenCalled()
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de HelloAsso', async () => {
      global.readBody.mockResolvedValue(validRequestBody)
      const error = new Error('HelloAsso API error')
      mockFindTicketByQRCode.mockRejectedValue(error)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(handler(mockEvent as any)).rejects.toThrow('HelloAsso API error')

      expect(consoleSpy).toHaveBeenCalledWith('HelloAsso verify QR code error:', error)
      consoleSpy.mockRestore()
    })

    it('devrait logger toutes les erreurs', async () => {
      global.readBody.mockResolvedValue(validRequestBody)
      const error = new Error('Network error')
      mockFindTicketByQRCode.mockRejectedValue(error)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(handler(mockEvent as any)).rejects.toThrow('Network error')

      expect(consoleSpy).toHaveBeenCalledWith('HelloAsso verify QR code error:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('Scénarios variés', () => {
    it('devrait gérer des noms avec caractères spéciaux', async () => {
      const mockTicket = {
        id: '1',
        user: {
          firstName: 'François',
          lastName: "O'Brien",
        },
      }

      global.readBody.mockResolvedValue(validRequestBody)
      mockFindTicketByQRCode.mockResolvedValue({
        found: true,
        ticket: mockTicket,
      })

      const result = await handler(mockEvent as any)

      expect(result.message).toBe("Billet trouvé pour François O'Brien")
    })

    it('devrait gérer différents types de formulaires', async () => {
      const formTypes = ['event', 'membership', 'donation', 'shop']

      for (const formType of formTypes) {
        const body = { ...validRequestBody, formType }
        global.readBody.mockResolvedValue(body)
        mockFindTicketByQRCode.mockResolvedValue({
          found: false,
          ticket: null,
        })

        const result = await handler(mockEvent as any)

        expect(result.success).toBe(true)
        expect(mockFindTicketByQRCode).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ formType }),
          expect.any(String)
        )
      }
    })

    it('devrait gérer différents formats de QR codes', async () => {
      const qrCodes = [
        'SIMPLE123',
        'uuid-format-12345678-1234-1234-1234-123456789012',
        'BASE64==',
        '12345',
      ]

      for (const qrCode of qrCodes) {
        const body = { ...validRequestBody, qrCode }
        global.readBody.mockResolvedValue(body)
        mockFindTicketByQRCode.mockResolvedValue({
          found: false,
          ticket: null,
        })

        const result = await handler(mockEvent as any)

        expect(result.success).toBe(true)
        expect(mockFindTicketByQRCode).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          qrCode
        )
      }
    })
  })
})
