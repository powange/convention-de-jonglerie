import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock des modules spécifiques - DOIT être avant les imports
vi.mock('../../../../../server/utils/emailService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    sendEmail: vi.fn(),
    generateVerificationCode: vi.fn(),
    generateVerificationEmailHtml: vi.fn(() => Promise.resolve('<html>Code: 123456</html>')),
  }
})

// Mock bcrypt pour accélérer les tests (éviter les vraies opérations cryptographiques)
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((password) => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn(() => Promise.resolve(true)),
  },
}))

import {
  sendEmail,
  generateVerificationCode,
  generateVerificationEmailHtml,
} from '../../../../../server/utils/emailService'
import bcrypt from 'bcryptjs'
import registerHandler from '../../../../../server/api/auth/register.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>
const mockGenerateVerificationCode = generateVerificationCode as ReturnType<typeof vi.fn>
const mockGenerateVerificationEmailHtml = generateVerificationEmailHtml as ReturnType<typeof vi.fn>

describe('API Register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getHeader = vi.fn(() => 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7')

    // Réinitialiser les mocks
    mockSendEmail.mockResolvedValue(true)
    mockGenerateVerificationCode.mockReturnValue('123456')
    mockGenerateVerificationEmailHtml.mockResolvedValue('<html>Code: 123456</html>')
  })

  it('devrait créer un nouvel utilisateur avec succès', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
      isEmailVerified: false,
    }

    prismaMock.user.create.mockResolvedValue(mockUser)

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await registerHandler(mockEvent)

    expect(result).toEqual({
      success: true,
      message: 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.',
      data: {
        requiresVerification: true,
        email: 'test@example.com',
      },
    })

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
        pseudo: 'testuser',
        nom: 'Nom',
        prenom: 'Prenom',
        isEmailVerified: false,
        emailVerificationCode: '123456',
      }),
    })

    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: '🤹 Vérifiez votre compte - Conventions de Jonglerie',
      html: expect.stringContaining('123456'),
      text: expect.stringContaining('123456'),
    })
  })

  it('devrait créer un utilisateur sans nom et prénom', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: null,
      prenom: null,
      isEmailVerified: false,
    }

    prismaMock.user.create.mockResolvedValue(mockUser)

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await registerHandler(mockEvent)

    expect(result).toEqual({
      success: true,
      message: 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.',
      data: {
        requiresVerification: true,
        email: 'test@example.com',
      },
    })

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
        pseudo: 'testuser',
        nom: null,
        prenom: null,
        isEmailVerified: false,
        emailVerificationCode: '123456',
      }),
    })
  })

  it("devrait utiliser le pseudo dans l'email si prénom est absent", async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: null,
      prenom: null,
      isEmailVerified: false,
    }

    prismaMock.user.create.mockResolvedValue(mockUser)

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await registerHandler(mockEvent)

    // Vérifier que l'email utilise le pseudo
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: '🤹 Vérifiez votre compte - Conventions de Jonglerie',
      html: expect.stringContaining('123456'),
      text: expect.stringContaining('testuser'), // Utilise le pseudo
    })
  })

  it("devrait valider le format de l'email", async () => {
    const requestBody = {
      email: 'invalid-email',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(registerHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait valider la force du mot de passe', async () => {
    const requestBody = {
      email: 'test@example.com',
      password: 'weak',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(registerHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait gérer les emails déjà utilisés', async () => {
    prismaMock.user.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['email'] },
    })

    const requestBody = {
      email: 'existing@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(registerHandler(mockEvent)).rejects.toThrow('Email ou pseudo déjà utilisé')
  })

  it('devrait hacher le mot de passe avant de le stocker', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    prismaMock.user.create.mockResolvedValue(mockUser)

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await registerHandler(mockEvent)

    // Vérifier que bcrypt.hash a été appelé avec le mot de passe
    expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12)

    // Vérifier que le mot de passe haché a été utilisé
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        password: 'hashed_Password123!',
      }),
    })
  })

  it("devrait normaliser l'email en minuscules", async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    prismaMock.user.create.mockResolvedValue(mockUser)

    const requestBody = {
      email: 'TEST@EXAMPLE.COM',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await registerHandler(mockEvent)

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
      }),
    })
  })

  it("devrait continuer même si l'envoi d'email échoue", async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    prismaMock.user.create.mockResolvedValue(mockUser)
    mockSendEmail.mockResolvedValue(false)

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await registerHandler(mockEvent)

    expect(result).toEqual({
      success: true,
      message: 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.',
      data: {
        requiresVerification: true,
        email: 'test@example.com',
      },
    })
  })

  it('devrait enregistrer les catégories utilisateur par défaut (false)', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
      isEmailVerified: false,
    }

    prismaMock.user.create.mockResolvedValue(mockUser)

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await registerHandler(mockEvent)

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isVolunteer: false,
        isArtist: false,
        isOrganizer: false,
      }),
    })
  })

  it('devrait enregistrer les catégories utilisateur sélectionnées', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
      isEmailVerified: false,
    }

    prismaMock.user.create.mockResolvedValue(mockUser)

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
      isVolunteer: true,
      isArtist: false,
      isOrganizer: true,
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await registerHandler(mockEvent)

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isVolunteer: true,
        isArtist: false,
        isOrganizer: true,
      }),
    })
  })

  it('devrait accepter toutes les catégories à true', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
      isEmailVerified: false,
    }

    prismaMock.user.create.mockResolvedValue(mockUser)

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
      isVolunteer: true,
      isArtist: true,
      isOrganizer: true,
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await registerHandler(mockEvent)

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isVolunteer: true,
        isArtist: true,
        isOrganizer: true,
      }),
    })
  })

  it("devrait rejeter si une catégorie n'est pas un booléen", async () => {
    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
      isVolunteer: 'invalid',
      isArtist: false,
      isOrganizer: false,
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(registerHandler(mockEvent)).rejects.toThrow()
  })

  describe("Activation d'un compte MANUAL existant", () => {
    it('devrait activer un user MANUAL non vérifié au lieu de créer un doublon', async () => {
      // Un organisateur a déjà ajouté cette personne comme artiste
      prismaMock.user.findUnique.mockResolvedValue({
        id: 42,
        nom: 'NomOrga',
        prenom: 'PrenomOrga',
        authProvider: 'MANUAL',
        isEmailVerified: false,
      })
      prismaMock.user.update.mockResolvedValue({
        id: 42,
        email: 'artist@example.com',
        pseudo: 'artisteuser',
        nom: 'NomOrga',
        prenom: 'PrenomOrga',
        isEmailVerified: false,
      })

      const requestBody = {
        email: 'artist@example.com',
        password: 'Password123!',
        pseudo: 'artisteuser',
        isVolunteer: true,
        isArtist: true,
      }

      const mockEvent = {}
      global.readBody.mockResolvedValue(requestBody)

      const result = await registerHandler(mockEvent)

      expect(result).toEqual({
        success: true,
        message:
          'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.',
        data: {
          requiresVerification: true,
          email: 'artist@example.com',
        },
      })

      // Aucune création — on a mis à jour le user existant
      expect(prismaMock.user.create).not.toHaveBeenCalled()
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: expect.objectContaining({
          password: 'hashed_Password123!',
          pseudo: 'artisteuser',
          isEmailVerified: false,
          emailVerificationCode: '123456',
          isVolunteer: true,
          isArtist: true,
          isOrganizer: false,
          // nom/prenom non fournis → on conserve les valeurs de l'organisateur
          nom: 'NomOrga',
          prenom: 'PrenomOrga',
        }),
      })

      // authProvider reste MANUAL tant que l'email n'est pas vérifié
      expect(prismaMock.user.update.mock.calls[0][0].data).not.toHaveProperty('authProvider')

      // Email de vérification envoyé
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'artist@example.com' })
      )
    })

    it("devrait écraser nom/prénom du MANUAL si l'utilisateur les fournit", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 42,
        nom: 'NomOrga',
        prenom: 'PrenomOrga',
        authProvider: 'MANUAL',
        isEmailVerified: false,
      })
      prismaMock.user.update.mockResolvedValue({ id: 42 })

      const requestBody = {
        email: 'artist@example.com',
        password: 'Password123!',
        pseudo: 'artisteuser',
        nom: 'NomReel',
        prenom: 'PrenomReel',
      }

      const mockEvent = {}
      global.readBody.mockResolvedValue(requestBody)

      await registerHandler(mockEvent)

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: expect.objectContaining({
          nom: 'NomReel',
          prenom: 'PrenomReel',
        }),
      })
    })

    it('ne devrait PAS activer un user MANUAL déjà vérifié', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 42,
        nom: 'X',
        prenom: 'Y',
        authProvider: 'MANUAL',
        isEmailVerified: true, // déjà vérifié = ne plus laisser réactiver
      })
      // Le create sera appelé puis échouera avec P2002 sur l'email
      prismaMock.user.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['email'] },
      })

      const requestBody = {
        email: 'artist@example.com',
        password: 'Password123!',
        pseudo: 'artisteuser',
      }

      const mockEvent = {}
      global.readBody.mockResolvedValue(requestBody)

      await expect(registerHandler(mockEvent)).rejects.toThrow('Email ou pseudo déjà utilisé')
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('ne devrait PAS activer un user authProvider=email/google/facebook', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 42,
        nom: 'X',
        prenom: 'Y',
        authProvider: 'email',
        isEmailVerified: false,
      })
      prismaMock.user.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['email'] },
      })

      const requestBody = {
        email: 'artist@example.com',
        password: 'Password123!',
        pseudo: 'artisteuser',
      }

      const mockEvent = {}
      global.readBody.mockResolvedValue(requestBody)

      await expect(registerHandler(mockEvent)).rejects.toThrow('Email ou pseudo déjà utilisé')
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it("devrait renouveler verificationCodeExpiry lors de l'activation", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 42,
        nom: 'X',
        prenom: 'Y',
        authProvider: 'MANUAL',
        isEmailVerified: false,
      })
      prismaMock.user.update.mockResolvedValue({ id: 42 })

      const requestBody = {
        email: 'artist@example.com',
        password: 'Password123!',
        pseudo: 'artisteuser',
      }

      const mockEvent = {}
      global.readBody.mockResolvedValue(requestBody)

      const before = Date.now()
      await registerHandler(mockEvent)
      const after = Date.now()

      const updateData = prismaMock.user.update.mock.calls[0][0].data
      expect(updateData.verificationCodeExpiry).toBeInstanceOf(Date)
      // L'expiration doit être dans le futur (sinon le code est invalide dès l'envoi)
      expect((updateData.verificationCodeExpiry as Date).getTime()).toBeGreaterThan(after)
      // Sanity check : un expiry trop éloigné serait suspect (>30 jours)
      expect((updateData.verificationCodeExpiry as Date).getTime()).toBeLessThan(
        before + 30 * 24 * 60 * 60 * 1000
      )
    })

    it("ne devrait PAS modifier lastLoginAt lors de l'activation (le claim n'est pas une connexion)", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 42,
        nom: 'X',
        prenom: 'Y',
        authProvider: 'MANUAL',
        isEmailVerified: false,
      })
      prismaMock.user.update.mockResolvedValue({ id: 42 })

      const requestBody = {
        email: 'artist@example.com',
        password: 'Password123!',
        pseudo: 'artisteuser',
      }

      const mockEvent = {}
      global.readBody.mockResolvedValue(requestBody)

      await registerHandler(mockEvent)

      expect(prismaMock.user.update.mock.calls[0][0].data).not.toHaveProperty('lastLoginAt')
    })

    it("devrait permettre une 2e activation (last write wins) si l'email n'est toujours pas vérifié", async () => {
      // Scénario : un attaquant a déjà 'claimé' le compte avec son propre password
      // (authProvider toujours MANUAL, isEmailVerified toujours false). Le vrai
      // propriétaire doit pouvoir re-déclencher /register et écraser le password.
      prismaMock.user.findUnique.mockResolvedValue({
        id: 42,
        nom: 'X',
        prenom: 'Y',
        authProvider: 'MANUAL',
        isEmailVerified: false,
      })
      prismaMock.user.update.mockResolvedValue({ id: 42 })

      const requestBody = {
        email: 'artist@example.com',
        password: 'NouveauVrai123!',
        pseudo: 'vraiowner',
      }

      const mockEvent = {}
      global.readBody.mockResolvedValue(requestBody)

      await registerHandler(mockEvent)

      // Le password est bien remplacé par celui de la 2e activation
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: expect.objectContaining({
          password: 'hashed_NouveauVrai123!',
          pseudo: 'vraiowner',
        }),
      })
      expect(prismaMock.user.create).not.toHaveBeenCalled()
    })

    it('devrait renvoyer 409 si le pseudo choisi entre en collision avec un autre user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 42,
        nom: 'X',
        prenom: 'Y',
        authProvider: 'MANUAL',
        isEmailVerified: false,
      })
      // Le pseudo choisi est déjà pris par quelqu'un d'autre
      prismaMock.user.update.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['pseudo'] },
      })

      const requestBody = {
        email: 'artist@example.com',
        password: 'Password123!',
        pseudo: 'pseudo_pris',
      }

      const mockEvent = {}
      global.readBody.mockResolvedValue(requestBody)

      await expect(registerHandler(mockEvent)).rejects.toThrow('Email ou pseudo déjà utilisé')
    })
  })
})
