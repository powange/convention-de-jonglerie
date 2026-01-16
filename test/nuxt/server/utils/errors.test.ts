import { describe, it, expect } from 'vitest'

import {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError,
  isApiError,
  toApiError,
} from '../../../../server/utils/errors'

describe('errors', () => {
  describe('ApiError', () => {
    it('devrait créer une erreur avec statusCode et message', () => {
      const error = new ApiError(400, 'Test error')

      expect(error.statusCode).toBe(400)
      expect(error.message).toBe('Test error')
      expect(error.name).toBe('ApiError')
      expect(error).toBeInstanceOf(Error)
    })

    it('devrait accepter un operationName optionnel', () => {
      const error = new ApiError(500, 'Test error', 'TestOperation')

      expect(error.operationName).toBe('TestOperation')
    })
  })

  describe('BadRequestError', () => {
    it('devrait créer une erreur 400 avec message par défaut', () => {
      const error = new BadRequestError()

      expect(error.statusCode).toBe(400)
      expect(error.message).toBe('Requête invalide')
      expect(error.name).toBe('BadRequestError')
    })

    it('devrait accepter un message personnalisé', () => {
      const error = new BadRequestError('Données invalides')

      expect(error.statusCode).toBe(400)
      expect(error.message).toBe('Données invalides')
    })
  })

  describe('UnauthorizedError', () => {
    it('devrait créer une erreur 401 avec message par défaut', () => {
      const error = new UnauthorizedError()

      expect(error.statusCode).toBe(401)
      expect(error.message).toBe('Authentification requise')
      expect(error.name).toBe('UnauthorizedError')
    })

    it('devrait accepter un message personnalisé', () => {
      const error = new UnauthorizedError('Session expirée')

      expect(error.message).toBe('Session expirée')
    })
  })

  describe('ForbiddenError', () => {
    it('devrait créer une erreur 403 avec message par défaut', () => {
      const error = new ForbiddenError()

      expect(error.statusCode).toBe(403)
      expect(error.message).toBe('Action non autorisée')
      expect(error.name).toBe('ForbiddenError')
    })

    it('devrait accepter un message personnalisé', () => {
      const error = new ForbiddenError('Accès refusé à cette ressource')

      expect(error.message).toBe('Accès refusé à cette ressource')
    })
  })

  describe('NotFoundError', () => {
    it('devrait créer une erreur 404 avec le nom de la ressource', () => {
      const error = new NotFoundError('Utilisateur')

      expect(error.statusCode).toBe(404)
      expect(error.message).toBe('Utilisateur non trouvé(e)')
      expect(error.name).toBe('NotFoundError')
    })

    it('devrait formater correctement différentes ressources', () => {
      expect(new NotFoundError('Convention').message).toBe('Convention non trouvé(e)')
      expect(new NotFoundError('Édition').message).toBe('Édition non trouvé(e)')
      expect(new NotFoundError('Ressource').message).toBe('Ressource non trouvé(e)')
    })
  })

  describe('ConflictError', () => {
    it('devrait créer une erreur 409 avec le message fourni', () => {
      const error = new ConflictError('Cette email est déjà utilisée')

      expect(error.statusCode).toBe(409)
      expect(error.message).toBe('Cette email est déjà utilisée')
      expect(error.name).toBe('ConflictError')
    })
  })

  describe('ValidationError', () => {
    it('devrait créer une erreur 422 avec message', () => {
      const error = new ValidationError('Validation échouée')

      expect(error.statusCode).toBe(422)
      expect(error.message).toBe('Validation échouée')
      expect(error.name).toBe('ValidationError')
      expect(error.errors).toBeUndefined()
    })

    it('devrait accepter des erreurs détaillées', () => {
      const errors = {
        email: ['Format invalide', 'Domaine non autorisé'],
        password: ['Trop court'],
      }
      const error = new ValidationError('Validation échouée', errors)

      expect(error.errors).toEqual(errors)
    })
  })

  describe('InternalServerError', () => {
    it('devrait créer une erreur 500 avec message par défaut', () => {
      const error = new InternalServerError()

      expect(error.statusCode).toBe(500)
      expect(error.message).toBe('Erreur serveur interne')
      expect(error.name).toBe('InternalServerError')
    })

    it('devrait accepter un message personnalisé', () => {
      const error = new InternalServerError('Erreur base de données')

      expect(error.message).toBe('Erreur base de données')
    })
  })

  describe('isApiError', () => {
    it('devrait retourner true pour ApiError', () => {
      expect(isApiError(new ApiError(400, 'test'))).toBe(true)
    })

    it("devrait retourner true pour les sous-classes d'ApiError", () => {
      expect(isApiError(new BadRequestError())).toBe(true)
      expect(isApiError(new UnauthorizedError())).toBe(true)
      expect(isApiError(new ForbiddenError())).toBe(true)
      expect(isApiError(new NotFoundError('test'))).toBe(true)
      expect(isApiError(new ConflictError('test'))).toBe(true)
      expect(isApiError(new ValidationError('test'))).toBe(true)
      expect(isApiError(new InternalServerError())).toBe(true)
    })

    it('devrait retourner false pour Error standard', () => {
      expect(isApiError(new Error('test'))).toBe(false)
    })

    it('devrait retourner false pour les objets simples', () => {
      expect(isApiError({ statusCode: 400, message: 'test' })).toBe(false)
    })

    it('devrait retourner false pour null/undefined', () => {
      expect(isApiError(null)).toBe(false)
      expect(isApiError(undefined)).toBe(false)
    })

    it('devrait retourner false pour les primitives', () => {
      expect(isApiError('error')).toBe(false)
      expect(isApiError(123)).toBe(false)
      expect(isApiError(true)).toBe(false)
    })
  })

  describe('toApiError', () => {
    it("devrait retourner l'ApiError tel quel", () => {
      const original = new BadRequestError('Test')

      const result = toApiError(original)

      expect(result).toBe(original)
    })

    it('devrait convertir une Error standard en InternalServerError', () => {
      const original = new Error('Test error')

      const result = toApiError(original)

      expect(result).toBeInstanceOf(InternalServerError)
      expect(result.statusCode).toBe(500)
      expect(result.message).toBe('Erreur serveur interne')
    })

    it('devrait utiliser le message par défaut personnalisé', () => {
      const original = new Error('Test error')

      const result = toApiError(original, 'Erreur personnalisée')

      expect(result.message).toBe('Erreur personnalisée')
    })

    it('devrait convertir les objets simples en InternalServerError', () => {
      const original = { statusCode: 400, message: 'Not an ApiError' }

      const result = toApiError(original)

      expect(result).toBeInstanceOf(InternalServerError)
      expect(result.statusCode).toBe(500)
    })

    it('devrait convertir null en InternalServerError', () => {
      const result = toApiError(null)

      expect(result).toBeInstanceOf(InternalServerError)
      expect(result.statusCode).toBe(500)
    })

    it('devrait convertir undefined en InternalServerError', () => {
      const result = toApiError(undefined)

      expect(result).toBeInstanceOf(InternalServerError)
    })

    it('devrait convertir les strings en InternalServerError', () => {
      const result = toApiError('An error occurred')

      expect(result).toBeInstanceOf(InternalServerError)
      expect(result.statusCode).toBe(500)
    })
  })

  describe('Héritage', () => {
    it("toutes les erreurs devraient être des instances d'Error", () => {
      const errors = [
        new ApiError(400, 'test'),
        new BadRequestError(),
        new UnauthorizedError(),
        new ForbiddenError(),
        new NotFoundError('test'),
        new ConflictError('test'),
        new ValidationError('test'),
        new InternalServerError(),
      ]

      for (const error of errors) {
        expect(error).toBeInstanceOf(Error)
        expect(error).toBeInstanceOf(ApiError)
      }
    })

    it('toutes les erreurs devraient avoir une stack trace', () => {
      const error = new BadRequestError('Test')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('BadRequestError')
    })
  })
})
