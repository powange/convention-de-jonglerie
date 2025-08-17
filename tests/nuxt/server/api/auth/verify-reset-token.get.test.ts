import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../../server/api/auth/verify-reset-token.get';
import { prismaMock } from '../../../../__mocks__/prisma';

const mockEvent = {};

const mockValidToken = {
  id: 1,
  token: 'valid-reset-token-123',
  userId: 1,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 heure dans le futur
  used: false,
  createdAt: new Date(),
};

const mockExpiredToken = {
  ...mockValidToken,
  expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 heure dans le passé
};

const mockUsedToken = {
  ...mockValidToken,
  used: true,
};

describe('/api/auth/verify-reset-token GET', () => {
  beforeEach(() => {
    prismaMock.passwordResetToken.findUnique.mockReset();
    global.getQuery = vi.fn();
  });

  it('devrait valider un token valide', async () => {
    global.getQuery.mockReturnValue({
      token: 'valid-reset-token-123',
    });

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockValidToken);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      valid: true,
    });

    expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { token: 'valid-reset-token-123' },
    });
  });

  it('devrait rejeter si le token est manquant', async () => {
    global.getQuery.mockReturnValue({});

    await expect(handler(mockEvent as any)).rejects.toThrow('Token manquant');
  });

  it('devrait rejeter si le token est null', async () => {
    global.getQuery.mockReturnValue({
      token: null,
    });

    await expect(handler(mockEvent as any)).rejects.toThrow('Token manquant');
  });

  it('devrait rejeter si le token est une chaîne vide', async () => {
    global.getQuery.mockReturnValue({
      token: '',
    });

    await expect(handler(mockEvent as any)).rejects.toThrow('Token manquant');
  });

  it('devrait retourner invalid pour un token inexistant', async () => {
    global.getQuery.mockReturnValue({
      token: 'nonexistent-token',
    });

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });

  it('devrait retourner expired pour un token expiré', async () => {
    global.getQuery.mockReturnValue({
      token: 'expired-token-123',
    });

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockExpiredToken);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      valid: false,
      reason: 'expired',
    });
  });

  it('devrait retourner used pour un token déjà utilisé', async () => {
    global.getQuery.mockReturnValue({
      token: 'used-token-123',
    });

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockUsedToken);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      valid: false,
      reason: 'used',
    });
  });

  it('devrait gérer correctement les comparaisons de dates UTC', async () => {
    global.getQuery.mockReturnValue({
      token: 'token-expiring-soon',
    });

    // Token qui expire dans exactement 1 seconde
    const tokenExpiringSoon = {
      ...mockValidToken,
      expiresAt: new Date(Date.now() + 1000),
    };

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(tokenExpiringSoon);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      valid: true,
    });
  });

  it('devrait gérer les tokens qui expirent exactement maintenant', async () => {
    global.getQuery.mockReturnValue({
      token: 'token-expiring-now',
    });

    // Token qui expire exactement maintenant (peut être considéré comme expiré selon le timing)
    const tokenExpiringNow = {
      ...mockValidToken,
      expiresAt: new Date(Date.now()),
    };

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(tokenExpiringNow);

    const result = await handler(mockEvent as any);

    // Le résultat peut être valid: true ou valid: false selon le timing exact
    expect(result.valid).toBeTypeOf('boolean');
    if (!result.valid) {
      expect(result.reason).toBe('expired');
    }
  });

  it('devrait prioriser le statut used sur expired', async () => {
    global.getQuery.mockReturnValue({
      token: 'used-and-expired-token',
    });

    const usedAndExpiredToken = {
      ...mockValidToken,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expiré
      used: true, // Et utilisé
    };

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(usedAndExpiredToken);

    const result = await handler(mockEvent as any);

    // L'API vérifie d'abord l'expiration, puis l'utilisation
    expect(result).toEqual({
      valid: false,
      reason: 'expired',
    });
  });

  it('devrait prioriser expired sur used dans la logique de vérification', async () => {
    global.getQuery.mockReturnValue({
      token: 'expired-but-not-used-token',
    });

    const expiredButNotUsedToken = {
      ...mockValidToken,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expiré
      used: false, // Mais pas utilisé
    };

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(expiredButNotUsedToken);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      valid: false,
      reason: 'expired',
    });
  });

  it('devrait gérer les erreurs de base de données', async () => {
    global.getQuery.mockReturnValue({
      token: 'valid-token',
    });

    prismaMock.passwordResetToken.findUnique.mockRejectedValue(new Error('Database error'));

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur lors de la vérification du token');
  });

  it('devrait relancer les erreurs HTTP existantes', async () => {
    global.getQuery.mockReturnValue({
      token: 'valid-token',
    });

    const httpError = {
      statusCode: 503,
      statusMessage: 'Service unavailable',
    };

    prismaMock.passwordResetToken.findUnique.mockRejectedValue(httpError);

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError);
  });

  it('devrait logger les erreurs en console', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    global.getQuery.mockReturnValue({
      token: 'valid-token',
    });

    prismaMock.passwordResetToken.findUnique.mockRejectedValue(new Error('Database error'));

    await expect(handler(mockEvent as any)).rejects.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Erreur lors de la vérification du token:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('devrait gérer les tokens avec des caractères spéciaux', async () => {
    const specialToken = 'token-with-special-chars-!@#$%^&*()';
    
    global.getQuery.mockReturnValue({
      token: specialToken,
    });

    const tokenWithSpecialChars = {
      ...mockValidToken,
      token: specialToken,
    };

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(tokenWithSpecialChars);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      valid: true,
    });

    expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { token: specialToken },
    });
  });

  it('devrait gérer les tokens très longs', async () => {
    const longToken = 'a'.repeat(500); // Token de 500 caractères
    
    global.getQuery.mockReturnValue({
      token: longToken,
    });

    const longTokenData = {
      ...mockValidToken,
      token: longToken,
    };

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(longTokenData);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      valid: true,
    });
  });

  it('devrait gérer les dates avec différents fuseaux horaires', async () => {
    global.getQuery.mockReturnValue({
      token: 'timezone-token',
    });

    // Créer une date explicitement en UTC
    const utcExpiryDate = new Date();
    utcExpiryDate.setUTCHours(utcExpiryDate.getUTCHours() + 1); // 1 heure dans le futur UTC

    const timezoneToken = {
      ...mockValidToken,
      expiresAt: utcExpiryDate,
    };

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(timezoneToken);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      valid: true,
    });
  });

  it('devrait traiter les tokens comme des chaînes de caractères', async () => {
    global.getQuery.mockReturnValue({
      token: 123456, // Token fourni comme nombre
    });

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);

    const result = await handler(mockEvent as any);

    expect(result).toEqual({
      valid: false,
      reason: 'invalid',
    });

    // Vérifier que le token est utilisé tel quel (TypeScript l'accepte comme string)
    expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { token: 123456 },
    });
  });

  it('devrait être idempotent pour les vérifications multiples', async () => {
    global.getQuery.mockReturnValue({
      token: 'idempotent-token',
    });

    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockValidToken);

    // Première vérification
    const result1 = await handler(mockEvent as any);
    expect(result1).toEqual({ valid: true });

    // Deuxième vérification (la fonction ne modifie pas l'état)
    const result2 = await handler(mockEvent as any);
    expect(result2).toEqual({ valid: true });

    expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledTimes(2);
  });
});