import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../server/api/auth/verify-email.post';
import { prismaMock } from '../../../__mocks__/prisma';

const mockEvent = {};

const mockUser = {
  id: 1,
  email: 'user@example.com',
  pseudo: 'testuser',
  nom: 'Doe',
  prenom: 'John',
  isEmailVerified: false,
  emailVerificationCode: '123456',
  verificationCodeExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes dans le futur
};

const mockVerifiedUser = {
  ...mockUser,
  isEmailVerified: true,
  emailVerificationCode: null,
  verificationCodeExpiry: null,
};

describe('/api/auth/verify-email POST', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    global.readBody = vi.fn();
  });

  it('devrait vérifier l\'email avec succès', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '123456',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.user.update.mockResolvedValue(mockVerifiedUser);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      message: 'Email vérifié avec succès ! Votre compte est maintenant actif.',
      user: {
        id: mockVerifiedUser.id,
        email: mockVerifiedUser.email,
        pseudo: mockVerifiedUser.pseudo,
        nom: mockVerifiedUser.nom,
        prenom: mockVerifiedUser.prenom,
        isEmailVerified: mockVerifiedUser.isEmailVerified,
      },
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isEmailVerified: true,
        emailVerificationCode: null,
        verificationCodeExpiry: null,
      },
    });
  });

  it('devrait normaliser l\'email (trim et lowercase)', async () => {
    const requestBody = {
      email: 'USER@EXAMPLE.COM', // Email valide pour Zod (sans espaces)
      code: '123456',
    };

    const normalizedUser = {
      ...mockUser,
      email: 'user@example.com', // Email en base en minuscules
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(normalizedUser);
    prismaMock.user.update.mockResolvedValue(mockVerifiedUser);

    await handler(mockEvent as any);

    // Vérifier que l'email est bien converti en minuscules pour la recherche
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
  });

  it('devrait rejeter si l\'email est invalide', async () => {
    const requestBody = {
      email: 'email-invalide',
      code: '123456',
    };

    global.readBody.mockResolvedValue(requestBody);

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides');
  });

  it('devrait rejeter si le code n\'a pas 6 chiffres', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '12345', // 5 chiffres seulement
    };

    global.readBody.mockResolvedValue(requestBody);

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides');
  });

  it('devrait rejeter si le code contient des caractères non numériques', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '12345a',
    };

    global.readBody.mockResolvedValue(requestBody);

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides');
  });

  it('devrait rejeter si l\'utilisateur n\'existe pas', async () => {
    const requestBody = {
      email: 'nonexistent@example.com',
      code: '123456',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(handler(mockEvent as any)).rejects.toThrow('Utilisateur non trouvé');
  });

  it('devrait rejeter si l\'email est déjà vérifié', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '123456',
    };

    const alreadyVerifiedUser = {
      ...mockUser,
      isEmailVerified: true,
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(alreadyVerifiedUser);

    await expect(handler(mockEvent as any)).rejects.toThrow('Email déjà vérifié');
  });

  it('devrait rejeter si aucun code de vérification n\'est actif (code null)', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '123456',
    };

    const userWithoutCode = {
      ...mockUser,
      emailVerificationCode: null,
      verificationCodeExpiry: null,
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(userWithoutCode);

    await expect(handler(mockEvent as any)).rejects.toThrow('Aucun code de vérification actif');
  });

  it('devrait rejeter si aucun code de vérification n\'est actif (expiry null)', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '123456',
    };

    const userWithoutExpiry = {
      ...mockUser,
      emailVerificationCode: '123456',
      verificationCodeExpiry: null,
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(userWithoutExpiry);

    await expect(handler(mockEvent as any)).rejects.toThrow('Aucun code de vérification actif');
  });

  it('devrait rejeter si le code de vérification est expiré', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '123456',
    };

    const userWithExpiredCode = {
      ...mockUser,
      verificationCodeExpiry: new Date(Date.now() - 60 * 1000), // 1 minute dans le passé
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(userWithExpiredCode);

    await expect(handler(mockEvent as any)).rejects.toThrow('Code de vérification expiré');
  });

  it('devrait rejeter si le code de vérification est incorrect', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '654321', // Code incorrect
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    await expect(handler(mockEvent as any)).rejects.toThrow('Code de vérification incorrect');
  });

  it('devrait gérer les erreurs de base de données lors de la recherche', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '123456',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne');
  });

  it('devrait gérer les erreurs de base de données lors de la mise à jour', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '123456',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.user.update.mockRejectedValue(new Error('Database error'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne');
  });

  it('devrait relancer les erreurs HTTP existantes', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '123456',
    };

    const httpError = {
      statusCode: 503,
      statusMessage: 'Service unavailable',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });

  it('devrait gérer les champs manquants dans la requête', async () => {
    const requestBody = {
      email: 'user@example.com',
      // code manquant
    };

    global.readBody.mockResolvedValue(requestBody);

    await expect(handler(mockEvent as any)).rejects.toThrow();
  });

  it('devrait gérer un code avec exactement 6 chiffres valides', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '000000', // Code avec des zéros en début
    };

    const userWithZeroCode = {
      ...mockUser,
      emailVerificationCode: '000000',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(userWithZeroCode);
    prismaMock.user.update.mockResolvedValue(mockVerifiedUser);

    const result = await handler(mockEvent as any);

    expect(result.message).toBe('Email vérifié avec succès ! Votre compte est maintenant actif.');
  });

  it('devrait gérer correctement la comparaison temporelle UTC', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '123456',
    };

    // Code qui expire dans exactement 1 seconde
    const userWithExpiringCode = {
      ...mockUser,
      verificationCodeExpiry: new Date(Date.now() + 1000),
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(userWithExpiringCode);
    prismaMock.user.update.mockResolvedValue(mockVerifiedUser);

    const result = await handler(mockEvent as any);

    expect(result.message).toBe('Email vérifié avec succès ! Votre compte est maintenant actif.');
  });

  it('ne devrait pas exposer d\'informations sensibles dans la réponse', async () => {
    const requestBody = {
      email: 'user@example.com',
      code: '123456',
    };

    global.readBody.mockResolvedValue(requestBody);
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.user.update.mockResolvedValue(mockVerifiedUser);

    const result = await handler(mockEvent as any);

    // Vérifier que les champs sensibles ne sont pas exposés
    expect(result.user).not.toHaveProperty('emailVerificationCode');
    expect(result.user).not.toHaveProperty('verificationCodeExpiry');
    expect(result.user).not.toHaveProperty('password');
    expect(result.user).not.toHaveProperty('passwordResetToken');
  });
});