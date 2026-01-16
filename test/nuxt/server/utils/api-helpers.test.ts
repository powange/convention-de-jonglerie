import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

import {
  wrapApiHandler,
  handlePrismaError,
  createSuccessResponse,
  createPaginatedResponse,
} from '../../../../server/utils/api-helpers'

import { ApiError, BadRequestError, ForbiddenError } from '../../../../server/utils/errors'

describe('api-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSuccessResponse', () => {
    it('devrait créer une réponse de succès simple', () => {
      const data = { id: 1, name: 'Test' }

      const result = createSuccessResponse(data)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(data)
      expect(result.message).toBeUndefined()
    })

    it('devrait inclure un message optionnel', () => {
      const data = { id: 1 }

      const result = createSuccessResponse(data, 'Opération réussie')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(data)
      expect(result.message).toBe('Opération réussie')
    })

    it('devrait fonctionner avec un tableau', () => {
      const data = [{ id: 1 }, { id: 2 }]

      const result = createSuccessResponse(data)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
    })

    it('devrait fonctionner avec null', () => {
      const result = createSuccessResponse(null)

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })
  })

  describe('createPaginatedResponse', () => {
    it('devrait créer une réponse paginée correcte', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]

      const result = createPaginatedResponse(items, 100, 1, 10)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(items)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.totalCount).toBe(100)
      expect(result.pagination.totalPages).toBe(10)
      expect(result.pagination.hasNextPage).toBe(true)
      expect(result.pagination.hasPrevPage).toBe(false)
    })

    it('devrait calculer hasNextPage correctement', () => {
      const items = [{ id: 1 }]

      // Page 1 sur 5 pages -> hasNextPage = true
      let result = createPaginatedResponse(items, 50, 1, 10)
      expect(result.pagination.hasNextPage).toBe(true)

      // Page 5 sur 5 pages -> hasNextPage = false
      result = createPaginatedResponse(items, 50, 5, 10)
      expect(result.pagination.hasNextPage).toBe(false)

      // Page 3 sur 5 pages -> hasNextPage = true
      result = createPaginatedResponse(items, 50, 3, 10)
      expect(result.pagination.hasNextPage).toBe(true)
    })

    it('devrait calculer hasPrevPage correctement', () => {
      const items = [{ id: 1 }]

      // Page 1 -> hasPrevPage = false
      let result = createPaginatedResponse(items, 50, 1, 10)
      expect(result.pagination.hasPrevPage).toBe(false)

      // Page 2 -> hasPrevPage = true
      result = createPaginatedResponse(items, 50, 2, 10)
      expect(result.pagination.hasPrevPage).toBe(true)

      // Page 5 -> hasPrevPage = true
      result = createPaginatedResponse(items, 50, 5, 10)
      expect(result.pagination.hasPrevPage).toBe(true)
    })

    it('devrait calculer totalPages correctement', () => {
      const items: any[] = []

      // 100 items, 10 par page = 10 pages
      let result = createPaginatedResponse(items, 100, 1, 10)
      expect(result.pagination.totalPages).toBe(10)

      // 95 items, 10 par page = 10 pages (arrondi supérieur)
      result = createPaginatedResponse(items, 95, 1, 10)
      expect(result.pagination.totalPages).toBe(10)

      // 1 item, 10 par page = 1 page
      result = createPaginatedResponse(items, 1, 1, 10)
      expect(result.pagination.totalPages).toBe(1)

      // 0 items = 0 pages
      result = createPaginatedResponse(items, 0, 1, 10)
      expect(result.pagination.totalPages).toBe(0)
    })

    it('devrait fonctionner avec une liste vide', () => {
      const result = createPaginatedResponse([], 0, 1, 10)

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
      expect(result.pagination.totalCount).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
      expect(result.pagination.hasNextPage).toBe(false)
      expect(result.pagination.hasPrevPage).toBe(false)
    })
  })

  describe('handlePrismaError', () => {
    it("devrait gérer l'erreur P2002 (contrainte unique)", () => {
      const error = {
        code: 'P2002',
        meta: { target: ['email'] },
      }

      expect(() => handlePrismaError(error)).toThrow()
      try {
        handlePrismaError(error)
      } catch (e: any) {
        expect(e.statusCode).toBe(409)
        expect(e.message).toBe('Ce email est déjà utilisé')
      }
    })

    it('devrait gérer P2002 avec target array', () => {
      const error = {
        code: 'P2002',
        meta: { target: ['pseudo', 'email'] },
      }

      try {
        handlePrismaError(error)
      } catch (e: any) {
        expect(e.statusCode).toBe(409)
        expect(e.message).toBe('Ce pseudo est déjà utilisé')
      }
    })

    it('devrait gérer P2002 sans meta', () => {
      const error = { code: 'P2002' }

      try {
        handlePrismaError(error)
      } catch (e: any) {
        expect(e.statusCode).toBe(409)
        expect(e.message).toBe('Ce champ est déjà utilisé')
      }
    })

    it("devrait gérer l'erreur P2025 (enregistrement non trouvé)", () => {
      const error = { code: 'P2025' }

      expect(() => handlePrismaError(error)).toThrow()
      try {
        handlePrismaError(error)
      } catch (e: any) {
        expect(e.statusCode).toBe(404)
        expect(e.message).toBe('Ressource introuvable')
      }
    })

    it('devrait utiliser le contexte pour P2025', () => {
      const error = { code: 'P2025' }

      try {
        handlePrismaError(error, 'Utilisateur')
      } catch (e: any) {
        expect(e.statusCode).toBe(404)
        expect(e.message).toBe('Utilisateur introuvable')
      }
    })

    it("devrait gérer l'erreur P2003 (clé étrangère)", () => {
      const error = { code: 'P2003' }

      expect(() => handlePrismaError(error)).toThrow()
      try {
        handlePrismaError(error)
      } catch (e: any) {
        expect(e.statusCode).toBe(400)
        expect(e.message).toBe('Référence invalide')
      }
    })

    it('devrait gérer les erreurs Prisma inconnues', () => {
      const error = { code: 'P9999' }
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => handlePrismaError(error)).toThrow()
      try {
        handlePrismaError(error)
      } catch (e: any) {
        expect(e.statusCode).toBe(500)
        expect(e.message).toBe('Erreur de base de données')
      }

      consoleSpy.mockRestore()
    })

    it('devrait relancer les erreurs non-Prisma', () => {
      const error = new Error('Not a Prisma error')

      expect(() => handlePrismaError(error)).toThrow('Not a Prisma error')
    })

    it('devrait relancer null', () => {
      expect(() => handlePrismaError(null)).toThrow()
    })
  })

  describe('wrapApiHandler', () => {
    it('devrait retourner le résultat du handler en cas de succès', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true, data: 'test' })
      const wrapped = wrapApiHandler(handler)
      const mockEvent = {} as any

      const result = await wrapped(mockEvent)

      expect(result).toEqual({ success: true, data: 'test' })
      expect(handler).toHaveBeenCalledWith(mockEvent)
    })

    it('devrait relancer les erreurs HTTP directement', async () => {
      const httpError = { statusCode: 404, message: 'Not found' }
      const handler = vi.fn().mockRejectedValue(httpError)
      const wrapped = wrapApiHandler(handler)
      const mockEvent = {} as any

      await expect(wrapped(mockEvent)).rejects.toEqual(httpError)
    })

    it('devrait convertir les ApiError en erreurs HTTP', async () => {
      const apiError = new ForbiddenError('Accès refusé')
      const handler = vi.fn().mockRejectedValue(apiError)
      const wrapped = wrapApiHandler(handler)
      const mockEvent = {} as any

      await expect(wrapped(mockEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Accès refusé',
      })
    })

    it('devrait convertir les erreurs génériques en 500', async () => {
      const genericError = new Error('Something went wrong')
      const handler = vi.fn().mockRejectedValue(genericError)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const wrapped = wrapApiHandler(handler)
      const mockEvent = {} as any

      await expect(wrapped(mockEvent)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Erreur serveur interne',
      })

      consoleSpy.mockRestore()
    })

    it("devrait utiliser le message d'erreur par défaut personnalisé", async () => {
      const genericError = new Error('Something went wrong')
      const handler = vi.fn().mockRejectedValue(genericError)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const wrapped = wrapApiHandler(handler, { defaultErrorMessage: 'Custom error' })
      const mockEvent = {} as any

      await expect(wrapped(mockEvent)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Custom error',
      })

      consoleSpy.mockRestore()
    })

    it('devrait logger les erreurs avec operationName', async () => {
      const genericError = new Error('Test error')
      const handler = vi.fn().mockRejectedValue(genericError)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const wrapped = wrapApiHandler(handler, { operationName: 'TestOp' })
      const mockEvent = {} as any

      try {
        await wrapped(mockEvent)
      } catch {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith('[TestOp] Erreur inattendue:', genericError)
      consoleSpy.mockRestore()
    })

    it('devrait ne pas logger si silentErrors est true', async () => {
      const genericError = new Error('Test error')
      const handler = vi.fn().mockRejectedValue(genericError)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const wrapped = wrapApiHandler(handler, { silentErrors: true })
      const mockEvent = {} as any

      try {
        await wrapped(mockEvent)
      } catch {
        // Expected
      }

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('devrait gérer les handlers synchrones', async () => {
      const handler = vi.fn().mockReturnValue({ sync: true })
      const wrapped = wrapApiHandler(handler)
      const mockEvent = {} as any

      const result = await wrapped(mockEvent)

      expect(result).toEqual({ sync: true })
    })
  })
})
