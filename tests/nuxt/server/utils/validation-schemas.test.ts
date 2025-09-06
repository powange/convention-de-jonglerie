import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

// Mock createError
const mockCreateError = vi.fn()
vi.mock('#imports', () => ({
  createError: mockCreateError,
}))

// Import des schémas et fonctions après les mocks
const schemas = await import('../../../../server/utils/validation-schemas')

describe('Validation Schemas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateError.mockImplementation(({ statusCode, statusMessage, data }) => {
      const error = new Error(statusMessage)
      error.statusCode = statusCode
      error.data = data
      throw error
    })
  })

  describe('Schémas de base', () => {
    describe('emailSchema', () => {
      it('devrait valider un email valide', () => {
        const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'test+tag@example.org']

        validEmails.forEach((email) => {
          expect(() => schemas.emailSchema.parse(email)).not.toThrow()
        })
      })

      it('devrait rejeter un email invalide', () => {
        const invalidEmails = ['notanemail', '@example.com', 'test@', 'test @example.com', '']

        invalidEmails.forEach((email) => {
          expect(() => schemas.emailSchema.parse(email)).toThrow()
        })
      })
    })

    describe('passwordSchema', () => {
      it('devrait valider un mot de passe fort', () => {
        const validPasswords = ['Password1', 'Test1234', 'MySecure99Pass']

        validPasswords.forEach((password) => {
          expect(() => schemas.passwordSchema.parse(password)).not.toThrow()
        })
      })

      it('devrait rejeter un mot de passe faible', () => {
        const invalidPasswords = [
          'short1A', // Trop court
          'password1', // Pas de majuscule
          'Password', // Pas de chiffre
          '12345678', // Pas de lettre
        ]

        invalidPasswords.forEach((password) => {
          expect(() => schemas.passwordSchema.parse(password)).toThrow()
        })

        // Test séparé pour PASSWORD1 car le schema n'exige pas explicitement les minuscules
        // mais uniquement majuscules + chiffres, donc PASSWORD1 peut être valide selon le schema actuel
        expect(() => schemas.passwordSchema.parse('PASSWORD1')).not.toThrow()
      })
    })

    describe('pseudoSchema', () => {
      it('devrait valider un pseudo valide', () => {
        expect(() => schemas.pseudoSchema.parse('User123')).not.toThrow()
        expect(() => schemas.pseudoSchema.parse('abc')).not.toThrow() // 3 caractères min
        expect(() => schemas.pseudoSchema.parse('a'.repeat(50))).not.toThrow() // 50 caractères max
      })

      it('devrait rejeter un pseudo invalide', () => {
        expect(() => schemas.pseudoSchema.parse('ab')).toThrow() // Trop court
        expect(() => schemas.pseudoSchema.parse('a'.repeat(51))).toThrow() // Trop long
      })
    })

    describe('phoneSchema', () => {
      it('devrait valider des numéros de téléphone valides', () => {
        const validPhones = [
          '0612345678',
          '+33612345678',
          '06 12 34 56 78',
          '(06) 12-34-56-78',
          undefined, // Optionnel
          '',
        ]

        validPhones.forEach((phone) => {
          expect(() => schemas.phoneSchema.parse(phone)).not.toThrow()
        })
      })

      it('devrait rejeter des numéros invalides', () => {
        expect(() => schemas.phoneSchema.parse('notaphone')).toThrow()
        expect(() => schemas.phoneSchema.parse('123-abc-456')).toThrow()
      })
    })

    describe('dateSchema', () => {
      it('devrait valider des dates valides', () => {
        const validDates = ['2024-01-01', '2024-12-31T23:59:59Z', new Date().toISOString()]

        validDates.forEach((date) => {
          expect(() => schemas.dateSchema.parse(date)).not.toThrow()
        })
      })

      it('devrait rejeter des dates invalides', () => {
        const invalidDates = [
          'not-a-date',
          '2024-13-01', // Mois invalide
          '2024-01-32', // Jour invalide
        ]

        invalidDates.forEach((date) => {
          expect(() => schemas.dateSchema.parse(date)).toThrow()
        })
      })
    })
  })

  describe("Schémas d'authentification", () => {
    describe('loginSchema', () => {
      it('devrait valider des données de connexion valides', () => {
        const validLogin = {
          email: 'test@example.com',
          password: 'anypassword',
        }

        expect(() => schemas.loginSchema.parse(validLogin)).not.toThrow()
      })

      it('devrait rejeter des données invalides', () => {
        expect(() =>
          schemas.loginSchema.parse({
            email: 'invalid',
            password: 'pass',
          })
        ).toThrow()

        expect(() =>
          schemas.loginSchema.parse({
            email: 'test@example.com',
            password: '',
          })
        ).toThrow()
      })
    })

    describe('registerSchema', () => {
      it("devrait valider des données d'inscription valides", () => {
        const validRegister = {
          email: 'test@example.com',
          password: 'Password123',
          pseudo: 'TestUser',
          prenom: 'John',
          nom: 'Doe',
        }

        expect(() => schemas.registerSchema.parse(validRegister)).not.toThrow()
      })

      it('devrait rejeter des données manquantes', () => {
        const incompleteData = {
          email: 'test@example.com',
          password: 'Password123',
          // Manque pseudo, prenom, nom
        }

        expect(() => schemas.registerSchema.parse(incompleteData)).toThrow()
      })
    })

    describe('changePasswordSchema', () => {
      it('devrait valider un changement de mot de passe valide', () => {
        const validChange = {
          currentPassword: 'oldpass',
          newPassword: 'NewPass123',
          confirmPassword: 'NewPass123',
        }

        expect(() => schemas.changePasswordSchema.parse(validChange)).not.toThrow()
      })

      it('devrait rejeter si les mots de passe ne correspondent pas', () => {
        const mismatch = {
          currentPassword: 'oldpass',
          newPassword: 'NewPass123',
          confirmPassword: 'DifferentPass123',
        }

        expect(() => schemas.changePasswordSchema.parse(mismatch)).toThrow()
      })
    })
  })

  describe("Schémas d'édition", () => {
    describe('editionSchema', () => {
      const validEdition = {
        conventionId: 1,
        name: 'Edition 2024',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue de la Convention',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      }

      it('devrait valider une édition valide', () => {
        expect(() => schemas.editionSchema.parse(validEdition)).not.toThrow()
      })

      it('devrait valider avec tous les champs optionnels', () => {
        const fullEdition = {
          ...validEdition,
          description: 'Une super convention',
          imageUrl: 'image.jpg',
          addressLine2: 'Bâtiment A',
          region: 'Île-de-France',
          ticketingUrl: 'https://tickets.example.com',
          facebookUrl: 'https://facebook.com/event',
          instagramUrl: 'https://instagram.com/event',
          hasFoodTrucks: true,
          hasKidsZone: false,
          acceptsPets: true,
          hasTentCamping: true,
          hasGym: false,
        }

        expect(() => schemas.editionSchema.parse(fullEdition)).not.toThrow()
      })

      it('devrait rejeter si la date de fin est avant la date de début', () => {
        const invalidDates = {
          ...validEdition,
          startDate: '2024-06-03',
          endDate: '2024-06-01',
        }

        expect(() => schemas.editionSchema.parse(invalidDates)).toThrow()
      })

      it('devrait rejeter avec des champs manquants', () => {
        const incomplete = {
          conventionId: 1,
          startDate: '2024-06-01',
          // Manque endDate, addressLine1, etc.
        }

        expect(() => schemas.editionSchema.parse(incomplete)).toThrow()
      })
    })

    describe('updateEditionSchema', () => {
      it('devrait accepter des mises à jour partielles', () => {
        const partialUpdate = {
          name: 'Nouveau nom',
        }

        expect(() => schemas.updateEditionSchema.parse(partialUpdate)).not.toThrow()
      })

      it('devrait valider les dates si les deux sont fournies', () => {
        const validDates = {
          startDate: '2024-06-01',
          endDate: '2024-06-03',
        }

        expect(() => schemas.updateEditionSchema.parse(validDates)).not.toThrow()
      })

      it('devrait rejeter si les dates sont invalides', () => {
        const invalidDates = {
          startDate: '2024-06-03',
          endDate: '2024-06-01',
        }

        expect(() => schemas.updateEditionSchema.parse(invalidDates)).toThrow()
      })

      it('devrait accepter une seule date', () => {
        expect(() => schemas.updateEditionSchema.parse({ startDate: '2024-06-01' })).not.toThrow()
        expect(() => schemas.updateEditionSchema.parse({ endDate: '2024-06-03' })).not.toThrow()
      })
    })
  })

  describe('Schémas de covoiturage', () => {
    describe('carpoolOfferSchema', () => {
      it('devrait valider une offre de covoiturage valide', () => {
        const validOffer = {
          locationCity: 'Paris',
          locationAddress: '123 rue de la Gare',
          tripDate: '2024-06-01T10:00:00Z',
          availableSeats: 3,
          direction: 'TO_EVENT',
        }

        expect(() => schemas.carpoolOfferSchema.parse(validOffer)).not.toThrow()
      })

      it('devrait valider avec champs optionnels', () => {
        const fullOffer = {
          locationCity: 'Paris',
          locationAddress: '123 rue de la Gare',
          tripDate: '2024-06-01T10:00:00Z',
          availableSeats: 3,
          direction: 'FROM_EVENT',
          description: 'Départ depuis la gare',
          phoneNumber: '0612345678',
        }

        expect(() => schemas.carpoolOfferSchema.parse(fullOffer)).not.toThrow()
      })

      it('devrait rejeter avec des sièges invalides', () => {
        const invalidSeats = {
          locationCity: 'Paris',
          locationAddress: '123 rue de la Gare',
          tripDate: '2024-06-01T10:00:00Z',
          availableSeats: 0, // Minimum 1
          direction: 'TO_EVENT',
        }

        expect(() => schemas.carpoolOfferSchema.parse(invalidSeats)).toThrow()

        invalidSeats.availableSeats = 9 // Maximum 8
        expect(() => schemas.carpoolOfferSchema.parse(invalidSeats)).toThrow()
      })
    })

    describe('carpoolRequestSchema', () => {
      it('devrait valider une demande de covoiturage valide', () => {
        const validRequest = {
          locationCity: 'Lyon',
          tripDate: '2024-06-01',
          direction: 'TO_EVENT',
        }

        const parsed = schemas.carpoolRequestSchema.parse(validRequest)
        expect(parsed.seatsNeeded).toBe(1) // Valeur par défaut
      })

      it('devrait valider avec tous les champs', () => {
        const fullRequest = {
          locationCity: 'Lyon',
          tripDate: '2024-06-01',
          direction: 'FROM_EVENT',
          seatsNeeded: 2,
          description: 'Recherche covoiturage',
          phoneNumber: '+33612345678',
        }

        expect(() => schemas.carpoolRequestSchema.parse(fullRequest)).not.toThrow()
      })
    })
  })

  describe('Schémas de collaborateurs', () => {
    describe('addCollaboratorSchema', () => {
      it("devrait valider l'ajout d'un collaborateur valide (userIdentifier seul)", () => {
        const validData = { userIdentifier: 'user@example.com' }
        expect(() => schemas.addCollaboratorSchema.parse(validData)).not.toThrow()
      })

      it('devrait rejeter un userIdentifier vide', () => {
        expect(() => schemas.addCollaboratorSchema.parse({ userIdentifier: '' })).toThrow()
      })
    })
  })

  describe('Fonctions utilitaires', () => {
    describe('sanitizeData', () => {
      it('devrait trim les chaînes de caractères', () => {
        const data = {
          name: '  John  ',
          email: '  TEST@EXAMPLE.COM  ',
          age: 25,
        }

        const sanitized = schemas.sanitizeData(data) as any

        expect(sanitized.name).toBe('John')
        expect(sanitized.email).toBe('test@example.com') // Email en minuscules
        expect(sanitized.age).toBe(25)
      })

      it('devrait gérer les valeurs null et undefined', () => {
        expect(schemas.sanitizeData(null)).toBe(null)
        expect(schemas.sanitizeData(undefined)).toBe(undefined)
        expect(schemas.sanitizeData('string')).toBe('string')
      })

      it('devrait préserver les objets imbriqués', () => {
        const data = {
          user: {
            name: '  John  ',
          },
        }

        const sanitized = schemas.sanitizeData(data) as any
        expect(sanitized.user.name).toBe('  John  ') // Ne sanitise pas récursivement
      })
    })

    describe('validateAndSanitize', () => {
      it('devrait valider et nettoyer les données', () => {
        const schema = z.object({
          email: schemas.emailSchema,
          name: z.string(),
        })

        const data = {
          email: '  TEST@EXAMPLE.COM  ',
          name: '  John  ',
        }

        const result = schemas.validateAndSanitize(schema, data)

        expect(result.email).toBe('test@example.com')
        expect(result.name).toBe('John')
      })

      it('devrait lever une erreur pour des données invalides', () => {
        const schema = z.object({
          email: schemas.emailSchema,
        })

        const data = {
          email: 'not-an-email',
        }

        expect(() => schemas.validateAndSanitize(schema, data)).toThrow()
      })
    })

    describe('handleValidationError', () => {
      it('devrait formater et lancer une erreur pour les erreurs Zod', () => {
        const zodError = new z.ZodError([
          {
            path: ['email'],
            message: 'Email invalide',
            code: 'custom',
          },
          {
            path: ['user', 'name'],
            message: 'Nom requis',
            code: 'custom',
          },
        ])

        // La fonction handleValidationError doit throw
        expect(() => schemas.handleValidationError(zodError)).toThrow()
      })

      it('devrait gérer les chemins vides', () => {
        const zodError = new z.ZodError([
          {
            path: [],
            message: 'Erreur globale',
            code: 'custom',
          },
        ])

        // La fonction handleValidationError doit throw
        expect(() => schemas.handleValidationError(zodError)).toThrow()
      })
    })
  })

  describe('Validation des contraintes de taille', () => {
    it('devrait respecter les limites de caractères', () => {
      // Convention name: 3-100 caractères
      expect(() =>
        schemas.conventionSchema.parse({
          name: 'ab', // Trop court
        })
      ).toThrow()

      expect(() =>
        schemas.conventionSchema.parse({
          name: 'a'.repeat(101), // Trop long
        })
      ).toThrow()

      // Description: max 5000 caractères
      expect(() =>
        schemas.conventionSchema.parse({
          name: 'Valid Name',
          description: 'a'.repeat(5001),
        })
      ).toThrow()

      // Commentaire: 1-1000 caractères
      expect(() =>
        schemas.commentSchema.parse({
          content: '', // Vide
        })
      ).toThrow()

      expect(() =>
        schemas.commentSchema.parse({
          content: 'a'.repeat(1001), // Trop long
        })
      ).toThrow()
    })
  })
})
