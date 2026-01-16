import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  validateResourceId,
  validateConventionId,
  validateEditionId,
  validateUserId,
  validateStringId,
  checkUniqueness,
  sanitizeString,
  sanitizeEmail,
  sanitizeObject,
  validateDateRange,
  validatePagination,
} from '../../../../server/utils/validation-helpers'

describe('validation-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateResourceId', () => {
    it('devrait retourner un ID valide', () => {
      global.getRouterParam = vi.fn().mockReturnValue('123')
      const event = {} as any

      const result = validateResourceId(event, 'id', 'convention')

      expect(result).toBe(123)
    })

    it('devrait rejeter si ID manquant', () => {
      global.getRouterParam = vi.fn().mockReturnValue(undefined)
      const event = {} as any

      expect(() => validateResourceId(event, 'id', 'convention')).toThrow()
      try {
        validateResourceId(event, 'id', 'convention')
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.message).toBe('ID de convention invalide')
      }
    })

    it('devrait rejeter si ID est une chaîne vide', () => {
      global.getRouterParam = vi.fn().mockReturnValue('')
      const event = {} as any

      expect(() => validateResourceId(event, 'id', 'édition')).toThrow()
      try {
        validateResourceId(event, 'id', 'édition')
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.message).toBe("ID d'édition invalide")
      }
    })

    it("devrait rejeter si ID n'est pas un nombre", () => {
      global.getRouterParam = vi.fn().mockReturnValue('abc')
      const event = {} as any

      expect(() => validateResourceId(event, 'id', 'utilisateur')).toThrow()
      try {
        validateResourceId(event, 'id', 'utilisateur')
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.message).toBe('ID utilisateur invalide')
      }
    })

    it('devrait rejeter si ID est 0', () => {
      global.getRouterParam = vi.fn().mockReturnValue('0')
      const event = {} as any

      expect(() => validateResourceId(event, 'id', 'offre')).toThrow()
      try {
        validateResourceId(event, 'id', 'offre')
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.message).toBe("ID d'offre invalide")
      }
    })

    it('devrait rejeter si ID est négatif', () => {
      global.getRouterParam = vi.fn().mockReturnValue('-5')
      const event = {} as any

      expect(() => validateResourceId(event, 'id', 'notification')).toThrow()
      try {
        validateResourceId(event, 'id', 'notification')
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.message).toBe('ID de notification invalide')
      }
    })

    it('devrait utiliser le bon message pour chaque type de ressource', () => {
      global.getRouterParam = vi.fn().mockReturnValue('invalid')
      const event = {} as any

      const resourceTypes = [
        { type: 'convention', message: 'ID de convention invalide' },
        { type: 'édition', message: "ID d'édition invalide" },
        { type: 'utilisateur', message: 'ID utilisateur invalide' },
        { type: 'organisateur', message: "ID d'organisateur invalide" },
        { type: 'offre', message: "ID d'offre invalide" },
        { type: 'demande', message: 'ID de demande invalide' },
        { type: 'tier', message: 'ID de tier invalide' },
        { type: 'commande', message: 'ID de commande invalide' },
      ] as const

      for (const { type, message } of resourceTypes) {
        try {
          validateResourceId(event, 'id', type)
        } catch (error: any) {
          expect(error.message).toBe(message)
        }
      }
    })
  })

  describe('validateConventionId', () => {
    it('devrait être un alias pour validateResourceId avec type convention', () => {
      global.getRouterParam = vi.fn().mockReturnValue('42')
      const event = {} as any

      const result = validateConventionId(event)

      expect(result).toBe(42)
    })
  })

  describe('validateEditionId', () => {
    it('devrait être un alias pour validateResourceId avec type édition', () => {
      global.getRouterParam = vi.fn().mockReturnValue('99')
      const event = {} as any

      const result = validateEditionId(event)

      expect(result).toBe(99)
    })
  })

  describe('validateUserId', () => {
    it('devrait être un alias pour validateResourceId avec type utilisateur', () => {
      global.getRouterParam = vi.fn().mockReturnValue('7')
      const event = {} as any

      const result = validateUserId(event)

      expect(result).toBe(7)
    })
  })

  describe('validateStringId', () => {
    it('devrait retourner un ID string valide', () => {
      global.getRouterParam = vi.fn().mockReturnValue('cuid-123-abc')
      const event = {} as any

      const result = validateStringId(event, 'slotId', 'créneau')

      expect(result).toBe('cuid-123-abc')
    })

    it('devrait rejeter si ID manquant', () => {
      global.getRouterParam = vi.fn().mockReturnValue(undefined)
      const event = {} as any

      expect(() => validateStringId(event, 'slotId', 'créneau')).toThrow()
      try {
        validateStringId(event, 'slotId', 'créneau')
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.message).toBe('ID de créneau invalide')
      }
    })

    it('devrait rejeter si ID est une chaîne vide', () => {
      global.getRouterParam = vi.fn().mockReturnValue('')
      const event = {} as any

      expect(() => validateStringId(event, 'id', 'assignation')).toThrow()
    })

    it('devrait rejeter si ID ne contient que des espaces', () => {
      global.getRouterParam = vi.fn().mockReturnValue('   ')
      const event = {} as any

      expect(() => validateStringId(event, 'id', 'objet')).toThrow()
    })
  })

  describe('checkUniqueness', () => {
    it('devrait ne rien faire si valeur unique', async () => {
      const mockModel = {
        findUnique: vi.fn().mockResolvedValue(null),
      }

      await expect(checkUniqueness(mockModel, 'email', 'new@example.com')).resolves.toBeUndefined()
    })

    it('devrait rejeter si valeur déjà utilisée', async () => {
      const mockModel = {
        findUnique: vi.fn().mockResolvedValue({ id: 1, email: 'existing@example.com' }),
      }

      await expect(checkUniqueness(mockModel, 'email', 'existing@example.com')).rejects.toThrow()
      try {
        await checkUniqueness(mockModel, 'email', 'existing@example.com')
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.message).toBe('Ce email est déjà utilisé')
      }
    })

    it('devrait utiliser un message personnalisé', async () => {
      const mockModel = {
        findUnique: vi.fn().mockResolvedValue({ id: 1 }),
      }

      await expect(
        checkUniqueness(mockModel, 'pseudo', 'existing', undefined, 'Ce pseudo est pris')
      ).rejects.toThrow()
      try {
        await checkUniqueness(mockModel, 'pseudo', 'existing', undefined, 'Ce pseudo est pris')
      } catch (error: any) {
        expect(error.message).toBe('Ce pseudo est pris')
      }
    })

    it('devrait exclure un ID lors de la vérification (pour update)', async () => {
      const mockModel = {
        findUnique: vi.fn().mockResolvedValue({ id: 5, email: 'test@example.com' }),
      }

      // L'ID 5 est exclu, donc pas d'erreur
      await expect(
        checkUniqueness(mockModel, 'email', 'test@example.com', 5)
      ).resolves.toBeUndefined()
    })

    it("devrait rejeter si ID différent de l'exclusion", async () => {
      const mockModel = {
        findUnique: vi.fn().mockResolvedValue({ id: 10, email: 'test@example.com' }),
      }

      // L'ID 10 est trouvé mais on exclut l'ID 5 -> erreur
      await expect(checkUniqueness(mockModel, 'email', 'test@example.com', 5)).rejects.toThrow()
    })
  })

  describe('sanitizeString', () => {
    it('devrait trimmer une chaîne', () => {
      expect(sanitizeString('  hello  ')).toBe('hello')
    })

    it('devrait retourner null pour une chaîne vide', () => {
      expect(sanitizeString('')).toBeNull()
    })

    it("devrait retourner null pour une chaîne d'espaces", () => {
      expect(sanitizeString('   ')).toBeNull()
    })

    it('devrait retourner null pour null', () => {
      expect(sanitizeString(null)).toBeNull()
    })

    it('devrait retourner null pour undefined', () => {
      expect(sanitizeString(undefined)).toBeNull()
    })

    it('devrait retourner null pour un non-string', () => {
      expect(sanitizeString(123 as any)).toBeNull()
    })

    it('devrait garder une chaîne normale intacte', () => {
      expect(sanitizeString('hello world')).toBe('hello world')
    })
  })

  describe('sanitizeEmail', () => {
    it('devrait mettre en minuscules', () => {
      expect(sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com')
    })

    it('devrait trimmer', () => {
      expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com')
    })

    it('devrait faire les deux', () => {
      expect(sanitizeEmail('  TEST@Example.COM  ')).toBe('test@example.com')
    })
  })

  describe('sanitizeObject', () => {
    it('devrait trimmer tous les champs string', () => {
      const input = {
        name: '  John  ',
        email: '  test@example.com  ',
        age: 30,
      }

      const result = sanitizeObject(input)

      expect(result.name).toBe('John')
      expect(result.email).toBe('test@example.com')
      expect(result.age).toBe(30)
    })

    it('devrait garder les valeurs non-string intactes', () => {
      const input = {
        count: 42,
        active: true,
        data: null,
        items: [1, 2, 3],
      }

      const result = sanitizeObject(input)

      expect(result.count).toBe(42)
      expect(result.active).toBe(true)
      expect(result.data).toBeNull()
      expect(result.items).toEqual([1, 2, 3])
    })

    it('devrait retourner un nouvel objet (immutabilité)', () => {
      const input = { name: '  Test  ' }

      const result = sanitizeObject(input)

      expect(result).not.toBe(input)
    })
  })

  describe('validateDateRange', () => {
    it('devrait accepter une plage valide', () => {
      expect(() => validateDateRange(new Date('2024-01-01'), new Date('2024-01-31'))).not.toThrow()
    })

    it('devrait accepter des dates égales', () => {
      const date = new Date('2024-01-15')
      expect(() => validateDateRange(date, date)).not.toThrow()
    })

    it('devrait rejeter si début après fin', () => {
      expect(() => validateDateRange(new Date('2024-12-31'), new Date('2024-01-01'))).toThrow()
      try {
        validateDateRange(new Date('2024-12-31'), new Date('2024-01-01'))
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.message).toBe(
          'La date de fin doit être postérieure ou égale à la date de début'
        )
      }
    })

    it('devrait accepter des chaînes de date', () => {
      expect(() => validateDateRange('2024-01-01', '2024-01-31')).not.toThrow()
    })

    it('devrait rejeter des chaînes de date inversées', () => {
      expect(() => validateDateRange('2024-12-31', '2024-01-01')).toThrow()
    })

    it("devrait inclure le nom du champ dans l'erreur", () => {
      try {
        validateDateRange('2024-12-31', '2024-01-01', 'endDate')
      } catch (error: any) {
        expect(error.data.field).toBe('endDate')
      }
    })
  })

  describe('validatePagination', () => {
    it('devrait retourner les valeurs par défaut', () => {
      global.getQuery = vi.fn().mockReturnValue({})
      const event = {} as any

      const result = validatePagination(event)

      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.skip).toBe(0)
      expect(result.take).toBe(10)
    })

    it('devrait parser les valeurs de la query', () => {
      global.getQuery = vi.fn().mockReturnValue({ page: '3', limit: '25' })
      const event = {} as any

      const result = validatePagination(event)

      expect(result.page).toBe(3)
      expect(result.limit).toBe(25)
      expect(result.skip).toBe(50) // (3-1) * 25
      expect(result.take).toBe(25)
    })

    it('devrait limiter la page à minimum 1', () => {
      global.getQuery = vi.fn().mockReturnValue({ page: '-5' })
      const event = {} as any

      const result = validatePagination(event)

      expect(result.page).toBe(1)
    })

    it('devrait limiter le limit à minimum 1', () => {
      global.getQuery = vi.fn().mockReturnValue({ limit: '0' })
      const event = {} as any

      const result = validatePagination(event)

      expect(result.limit).toBe(1)
    })

    it('devrait limiter le limit à maximum 100', () => {
      global.getQuery = vi.fn().mockReturnValue({ limit: '500' })
      const event = {} as any

      const result = validatePagination(event)

      expect(result.limit).toBe(100)
    })

    it('devrait calculer skip correctement pour différentes pages', () => {
      const testCases = [
        { page: 1, limit: 10, expectedSkip: 0 },
        { page: 2, limit: 10, expectedSkip: 10 },
        { page: 5, limit: 20, expectedSkip: 80 },
        { page: 10, limit: 50, expectedSkip: 450 },
      ]

      for (const { page, limit, expectedSkip } of testCases) {
        global.getQuery = vi.fn().mockReturnValue({ page: String(page), limit: String(limit) })
        const event = {} as any

        const result = validatePagination(event)

        expect(result.skip).toBe(expectedSkip)
      }
    })
  })
})
