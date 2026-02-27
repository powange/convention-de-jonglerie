import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  requireAuth,
  optionalAuth,
  requireUserOrGlobalAdmin,
  requireResourceOwner,
} from '../../../../server/utils/auth-utils'

describe('auth-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requireAuth', () => {
    it("devrait retourner l'utilisateur si authentifié", () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        pseudo: 'testuser',
        isGlobalAdmin: false,
      }
      const event = { context: { user: mockUser } }

      const result = requireAuth(event)

      expect(result).toEqual(mockUser)
    })

    it("devrait lancer une erreur 401 si pas d'utilisateur", () => {
      const event = { context: {} }

      expect(() => requireAuth(event)).toThrow()
      try {
        requireAuth(event)
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
        expect(error.message).toBe('Unauthorized')
      }
    })

    it('devrait lancer une erreur 401 si user est null', () => {
      const event = { context: { user: null } }

      expect(() => requireAuth(event)).toThrow()
      try {
        requireAuth(event)
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
      }
    })

    it('devrait lancer une erreur 401 si user est undefined', () => {
      const event = { context: { user: undefined } }

      expect(() => requireAuth(event)).toThrow()
      try {
        requireAuth(event)
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
      }
    })
  })

  describe('optionalAuth', () => {
    it("devrait retourner l'utilisateur si authentifié", () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        pseudo: 'testuser',
        isGlobalAdmin: false,
      }
      const event = { context: { user: mockUser } }

      const result = optionalAuth(event)

      expect(result).toEqual(mockUser)
    })

    it("devrait retourner null si pas d'utilisateur", () => {
      const event = { context: {} }

      const result = optionalAuth(event)

      expect(result).toBeNull()
    })

    it('devrait retourner null si user est null', () => {
      const event = { context: { user: null } }

      const result = optionalAuth(event)

      expect(result).toBeNull()
    })

    it('devrait retourner null si user est undefined', () => {
      const event = { context: { user: undefined } }

      const result = optionalAuth(event)

      expect(result).toBeNull()
    })
  })

  describe('requireUserOrGlobalAdmin', () => {
    it("devrait autoriser l'utilisateur lui-même", () => {
      const mockUser = {
        id: 42,
        email: 'test@example.com',
        pseudo: 'testuser',
        isGlobalAdmin: false,
      }
      const event = { context: { user: mockUser } }

      const result = requireUserOrGlobalAdmin(event, 42)

      expect(result).toEqual(mockUser)
    })

    it("devrait autoriser un admin global pour n'importe quel utilisateur", () => {
      const mockUser = {
        id: 1,
        email: 'admin@example.com',
        pseudo: 'admin',
        isGlobalAdmin: true,
      }
      const event = { context: { user: mockUser } }

      const result = requireUserOrGlobalAdmin(event, 999)

      expect(result).toEqual(mockUser)
    })

    it('devrait refuser un utilisateur différent sans droits admin', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        pseudo: 'testuser',
        isGlobalAdmin: false,
      }
      const event = { context: { user: mockUser } }

      expect(() => requireUserOrGlobalAdmin(event, 42)).toThrow()
      try {
        requireUserOrGlobalAdmin(event, 42)
      } catch (error: any) {
        expect(error.statusCode).toBe(403)
        expect(error.message).toBe('Accès non autorisé')
      }
    })

    it('devrait lancer une erreur 401 si pas authentifié', () => {
      const event = { context: {} }

      expect(() => requireUserOrGlobalAdmin(event, 1)).toThrow()
      try {
        requireUserOrGlobalAdmin(event, 1)
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
      }
    })
  })

  describe('requireResourceOwner', () => {
    it('devrait autoriser le propriétaire de la ressource', () => {
      const mockUser = {
        id: 42,
        email: 'test@example.com',
        pseudo: 'testuser',
        isGlobalAdmin: false,
      }
      const event = { context: { user: mockUser } }
      const resource = { userId: 42, name: 'Test Resource' }

      const result = requireResourceOwner(event, resource)

      expect(result).toEqual(mockUser)
    })

    it('devrait refuser un utilisateur non propriétaire', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        pseudo: 'testuser',
        isGlobalAdmin: false,
      }
      const event = { context: { user: mockUser } }
      const resource = { userId: 42, name: 'Test Resource' }

      expect(() => requireResourceOwner(event, resource)).toThrow()
      try {
        requireResourceOwner(event, resource)
      } catch (error: any) {
        expect(error.statusCode).toBe(403)
        expect(error.message).toBe('Accès non autorisé')
      }
    })

    it("devrait utiliser un message d'erreur personnalisé", () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        pseudo: 'testuser',
        isGlobalAdmin: false,
      }
      const event = { context: { user: mockUser } }
      const resource = { userId: 42 }

      try {
        requireResourceOwner(event, resource, {
          errorMessage: "Vous n'avez pas les droits pour modifier cette offre",
        })
      } catch (error: any) {
        expect(error.statusCode).toBe(403)
        expect(error.message).toBe("Vous n'avez pas les droits pour modifier cette offre")
      }
    })

    it('devrait autoriser un admin global si allowGlobalAdmin est true', () => {
      const mockUser = {
        id: 1,
        email: 'admin@example.com',
        pseudo: 'admin',
        isGlobalAdmin: true,
      }
      const event = { context: { user: mockUser } }
      const resource = { userId: 999 }

      const result = requireResourceOwner(event, resource, { allowGlobalAdmin: true })

      expect(result).toEqual(mockUser)
    })

    it('devrait refuser un admin global si allowGlobalAdmin est false (défaut)', () => {
      const mockUser = {
        id: 1,
        email: 'admin@example.com',
        pseudo: 'admin',
        isGlobalAdmin: true,
      }
      const event = { context: { user: mockUser } }
      const resource = { userId: 999 }

      expect(() => requireResourceOwner(event, resource)).toThrow()
      try {
        requireResourceOwner(event, resource)
      } catch (error: any) {
        expect(error.statusCode).toBe(403)
      }
    })

    it('devrait lancer une erreur 401 si pas authentifié', () => {
      const event = { context: {} }
      const resource = { userId: 42 }

      expect(() => requireResourceOwner(event, resource)).toThrow()
      try {
        requireResourceOwner(event, resource)
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
      }
    })
  })
})
