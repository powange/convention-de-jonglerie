import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  requireAuth,
  requireGlobalAdmin,
  optionalAuth,
  requireAuthWithAdminCheck,
  requireUserOrGlobalAdmin,
  requireResourceOwner,
  createAuthError,
  AUTH_ERRORS,
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

  describe('requireGlobalAdmin', () => {
    it("devrait retourner l'utilisateur si admin global", () => {
      const mockUser = {
        id: 1,
        email: 'admin@example.com',
        pseudo: 'admin',
        isGlobalAdmin: true,
      }
      const event = { context: { user: mockUser } }

      const result = requireGlobalAdmin(event)

      expect(result).toEqual(mockUser)
    })

    it('devrait lancer une erreur 403 si pas admin', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        pseudo: 'testuser',
        isGlobalAdmin: false,
      }
      const event = { context: { user: mockUser } }

      expect(() => requireGlobalAdmin(event)).toThrow()
      try {
        requireGlobalAdmin(event)
      } catch (error: any) {
        expect(error.statusCode).toBe(403)
        expect(error.message).toBe('Accès réservé aux administrateurs')
      }
    })

    it('devrait lancer une erreur 401 si pas authentifié', () => {
      const event = { context: {} }

      expect(() => requireGlobalAdmin(event)).toThrow()
      try {
        requireGlobalAdmin(event)
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
      }
    })

    it('devrait lancer une erreur 403 si isGlobalAdmin est undefined', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        pseudo: 'testuser',
      }
      const event = { context: { user: mockUser } }

      expect(() => requireGlobalAdmin(event)).toThrow()
      try {
        requireGlobalAdmin(event)
      } catch (error: any) {
        expect(error.statusCode).toBe(403)
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

  describe('requireAuthWithAdminCheck', () => {
    it("devrait retourner l'utilisateur avec isGlobalAdmin true si admin", () => {
      const mockUser = {
        id: 1,
        email: 'admin@example.com',
        pseudo: 'admin',
        isGlobalAdmin: true,
      }
      const event = { context: { user: mockUser } }

      const result = requireAuthWithAdminCheck(event)

      expect(result.isGlobalAdmin).toBe(true)
      expect(result.id).toBe(1)
    })

    it('devrait retourner isGlobalAdmin false si pas admin', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        pseudo: 'testuser',
        isGlobalAdmin: false,
      }
      const event = { context: { user: mockUser } }

      const result = requireAuthWithAdminCheck(event)

      expect(result.isGlobalAdmin).toBe(false)
    })

    it('devrait retourner isGlobalAdmin false si undefined', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        pseudo: 'testuser',
      }
      const event = { context: { user: mockUser } }

      const result = requireAuthWithAdminCheck(event)

      expect(result.isGlobalAdmin).toBe(false)
    })

    it('devrait lancer une erreur 401 si pas authentifié', () => {
      const event = { context: {} }

      expect(() => requireAuthWithAdminCheck(event)).toThrow()
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

  describe('createAuthError', () => {
    it('devrait créer une erreur 401 pour NOT_AUTHENTICATED', () => {
      expect(() => createAuthError('NOT_AUTHENTICATED')).toThrow()
      try {
        createAuthError('NOT_AUTHENTICATED')
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
        expect(error.message).toBe('Unauthorized')
      }
    })

    it('devrait créer une erreur 401 pour UNAUTHORIZED', () => {
      expect(() => createAuthError('UNAUTHORIZED')).toThrow()
      try {
        createAuthError('UNAUTHORIZED')
      } catch (error: any) {
        expect(error.statusCode).toBe(401)
        expect(error.message).toBe('Unauthorized')
      }
    })

    it('devrait créer une erreur 403 pour FORBIDDEN', () => {
      expect(() => createAuthError('FORBIDDEN')).toThrow()
      try {
        createAuthError('FORBIDDEN')
      } catch (error: any) {
        expect(error.statusCode).toBe(403)
        expect(error.message).toBe('Accès non autorisé')
      }
    })

    it('devrait créer une erreur 403 pour ADMIN_ONLY', () => {
      expect(() => createAuthError('ADMIN_ONLY')).toThrow()
      try {
        createAuthError('ADMIN_ONLY')
      } catch (error: any) {
        expect(error.statusCode).toBe(403)
        expect(error.message).toBe('Accès réservé aux administrateurs')
      }
    })

    it('devrait créer une erreur 403 pour INSUFFICIENT_RIGHTS', () => {
      expect(() => createAuthError('INSUFFICIENT_RIGHTS')).toThrow()
      try {
        createAuthError('INSUFFICIENT_RIGHTS')
      } catch (error: any) {
        expect(error.statusCode).toBe(403)
        expect(error.message).toBe('Droits insuffisants')
      }
    })

    it('devrait utiliser un message personnalisé si fourni', () => {
      expect(() => createAuthError('FORBIDDEN', 'Message custom')).toThrow()
      try {
        createAuthError('FORBIDDEN', 'Message custom')
      } catch (error: any) {
        expect(error.message).toBe('Message custom')
      }
    })
  })

  describe('AUTH_ERRORS', () => {
    it('devrait avoir toutes les clés définies', () => {
      expect(AUTH_ERRORS.NOT_AUTHENTICATED).toBe('Unauthorized')
      expect(AUTH_ERRORS.UNAUTHORIZED).toBe('Unauthorized')
      expect(AUTH_ERRORS.FORBIDDEN).toBe('Accès non autorisé')
      expect(AUTH_ERRORS.ADMIN_ONLY).toBe('Accès réservé aux administrateurs')
      expect(AUTH_ERRORS.INSUFFICIENT_RIGHTS).toBe('Droits insuffisants')
    })
  })
})
