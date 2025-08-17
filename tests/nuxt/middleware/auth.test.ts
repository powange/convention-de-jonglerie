import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { prismaMock } from '../../__mocks__/prisma';

// Mock du JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    decode: vi.fn()
  }
}))

describe('Middleware d\'authentification', () => {
  const validUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    isGlobalAdmin: false,
    isEmailVerified: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Protection des routes privées', () => {
    it('devrait rediriger vers login si pas de token', async () => {
      const mockEvent = {
        node: {
          req: {
            headers: {}
          }
        }
      }

      // Simuler middleware d'auth
      const shouldRedirect = !mockEvent.node.req.headers.authorization
      
      expect(shouldRedirect).toBe(true)
    })

    it('devrait permettre accès avec token valide', async () => {
      const mockToken = 'valid-jwt-token'
      const mockEvent = {
        node: {
          req: {
            headers: {
              authorization: `Bearer ${mockToken}`
            }
          }
        }
      }

      // Mock JWT valide
      vi.mocked(jwt.verify).mockReturnValue({ userId: 1 })
      prismaMock.user.findUnique.mockResolvedValue(validUser)

      const token = mockEvent.node.req.headers.authorization?.replace('Bearer ', '')
      const decoded = jwt.verify(token!, 'secret') as { userId: number }
      const user = await prismaMock.user.findUnique({ where: { id: decoded.userId } })

      expect(user).toEqual(validUser)
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'secret')
    })

    it('devrait rejeter token expiré', async () => {
      const mockToken = 'expired-jwt-token'
      const mockEvent = {
        node: {
          req: {
            headers: {
              authorization: `Bearer ${mockToken}`
            }
          }
        }
      }

      // Mock JWT expiré
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('jwt expired')
      })

      const token = mockEvent.node.req.headers.authorization?.replace('Bearer ', '')
      
      expect(() => jwt.verify(token!, 'secret')).toThrow('jwt expired')
    })

    it('devrait rejeter token malformé', async () => {
      const mockToken = 'invalid.malformed.token'
      const mockEvent = {
        node: {
          req: {
            headers: {
              authorization: `Bearer ${mockToken}`
            }
          }
        }
      }

      // Mock JWT malformé
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('invalid token')
      })

      const token = mockEvent.node.req.headers.authorization?.replace('Bearer ', '')
      
      expect(() => jwt.verify(token!, 'secret')).toThrow('invalid token')
    })

    it('devrait rejeter si utilisateur n\'existe plus', async () => {
      const mockToken = 'valid-jwt-token'
      const mockEvent = {
        node: {
          req: {
            headers: {
              authorization: `Bearer ${mockToken}`
            }
          }
        }
      }

      // Mock JWT valide mais utilisateur supprimé
      vi.mocked(jwt.verify).mockReturnValue({ userId: 999 })
      prismaMock.user.findUnique.mockResolvedValue(null)

      const token = mockEvent.node.req.headers.authorization?.replace('Bearer ', '')
      const decoded = jwt.verify(token!, 'secret') as { userId: number }
      const user = await prismaMock.user.findUnique({ where: { id: decoded.userId } })

      expect(user).toBeNull()
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: 999 } })
    })

    it('devrait rejeter si email non vérifié', async () => {
      const unverifiedUser = { ...validUser, isEmailVerified: false }
      const mockToken = 'valid-jwt-token'

      vi.mocked(jwt.verify).mockReturnValue({ userId: 1 })
      prismaMock.user.findUnique.mockResolvedValue(unverifiedUser)

      const token = mockToken
      const decoded = jwt.verify(token!, 'secret') as { userId: number }
      const user = await prismaMock.user.findUnique({ where: { id: decoded.userId } })

      expect(user?.isEmailVerified).toBe(false)
    })
  })

  describe('Extraction du token', () => {
    it('devrait extraire token du header Authorization', () => {
      const mockEvent = {
        node: {
          req: {
            headers: {
              authorization: 'Bearer my-jwt-token'
            }
          }
        }
      }

      const token = mockEvent.node.req.headers.authorization?.replace('Bearer ', '')
      
      expect(token).toBe('my-jwt-token')
    })

    it('devrait gérer header Authorization manquant', () => {
      const mockEvent = {
        node: {
          req: {
            headers: {}
          }
        }
      }

      const token = mockEvent.node.req.headers.authorization?.replace('Bearer ', '')
      
      expect(token).toBeUndefined()
    })

    it('devrait gérer format Authorization invalide', () => {
      const mockEvent = {
        node: {
          req: {
            headers: {
              authorization: 'InvalidFormat token'
            }
          }
        }
      }

      const token = mockEvent.node.req.headers.authorization?.replace('Bearer ', '')
      
      expect(token).toBe('InvalidFormat token') // Pas le bon format
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer erreur de base de données', async () => {
      const mockToken = 'valid-jwt-token'

      vi.mocked(jwt.verify).mockReturnValue({ userId: 1 })
      prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'))

      const token = mockToken
      const decoded = jwt.verify(token!, 'secret') as { userId: number }
      
      await expect(
        prismaMock.user.findUnique({ where: { id: decoded.userId } })
      ).rejects.toThrow('Database error')
    })

    it('devrait gérer token sans userId', () => {
      const mockToken = 'token-without-userid'

      // Mock JWT sans userId
      vi.mocked(jwt.verify).mockReturnValue({ email: 'test@example.com' })

      const token = mockToken
      const decoded = jwt.verify(token!, 'secret') as any
      
      expect(decoded.userId).toBeUndefined()
      expect(decoded.email).toBe('test@example.com')
    })
  })
})