import { prisma } from '@@/server/utils/prisma'
import { authRateLimiter } from '@@/server/utils/rate-limiter'
import { handleValidationError } from '@@/server/utils/validation-schemas'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { setUserSession } from '#imports'

// Schéma de validation pour le login
const loginSchema = z.object({
  identifier: z.string().min(1, 'Email ou pseudo requis'),
  password: z.string().min(1, 'Mot de passe requis'),
  rememberMe: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  try {
    // Appliquer le rate limiting
    await authRateLimiter(event)

    const body = await readBody(event)

    // Validation des données d'entrée
    const { identifier, password, rememberMe } = loginSchema.parse(body)

    // Sanitisation : trim des espaces
    const cleanIdentifier = identifier.trim()
    const cleanPassword = password.trim()

    let user = null

    // Try to find user by email
    user = await prisma.user.findUnique({
      where: {
        email: cleanIdentifier,
      },
    })

    // If not found by email, try to find by pseudo
    if (!user) {
      user = await prisma.user.findUnique({
        where: {
          pseudo: cleanIdentifier,
        },
      })
    }

    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Identifiants invalides',
      })
    }

    const isPasswordValid = await bcrypt.compare(cleanPassword, user.password)

    if (!isPasswordValid) {
      throw createError({
        statusCode: 401,
        message: 'Identifiants invalides',
      })
    }

    // Vérifier si l'email est vérifié
    if (!user.isEmailVerified) {
      throw createError({
        statusCode: 403,
        message: 'Email non vérifié. Veuillez vérifier votre email avant de vous connecter.',
        data: {
          requiresEmailVerification: true,
          email: user.email,
        },
      })
    }

    // Mettre à jour la date de dernière connexion
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Définir la session côté serveur (cookies scellés via nuxt-auth-utils)
    // Si "Se souvenir de moi" est coché, la session dure 90 jours, sinon 30 jours (défaut configuré)
    const sessionConfig = rememberMe
      ? {
          maxAge: 60 * 60 * 24 * 90, // 90 jours pour "Se souvenir de moi"
        }
      : undefined // Utilise la config par défaut (30 jours configuré dans nuxt.config.ts)

    await setUserSession(
      event,
      {
        user: {
          id: user.id,
          email: user.email,
          pseudo: user.pseudo,
          nom: user.nom,
          prenom: user.prenom,
          phone: user.phone,
          isGlobalAdmin: user.isGlobalAdmin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          isEmailVerified: user.isEmailVerified,
        },
      },
      sessionConfig
    )

    return {
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        nom: user.nom,
        prenom: user.prenom,
        phone: user.phone,
        profilePicture: user.profilePicture,
        isGlobalAdmin: user.isGlobalAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isEmailVerified: user.isEmailVerified,
      },
    }
  } catch (error) {
    // Gestion des erreurs de validation Zod
    if (error instanceof z.ZodError) {
      return handleValidationError(error)
    }

    // Re-lancer les autres erreurs
    throw error
  }
})
