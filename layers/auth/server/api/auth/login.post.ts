import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { setUserSession } from '#imports'

import type { ApiSuccessResponse } from '#server/types/api'
import type { LoginResponse } from '#server/types/api-responses'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { authRateLimiter } from '#server/utils/rate-limiter'
import { sanitizeString } from '#server/utils/validation-helpers'

// Les fournisseurs OAuth pris en charge, tels qu'ils sont écrits en base par
// routes/auth/google.get.ts et facebook.get.ts.
const NOM_DU_FOURNISSEUR: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
}

// Schéma de validation pour le login
const loginSchema = z.object({
  identifier: z.string().min(1, 'Email ou pseudo requis'),
  password: z.string().min(1, 'Mot de passe requis'),
  rememberMe: z.boolean().optional().default(false),
})

export default wrapApiHandler<ApiSuccessResponse<LoginResponse>>(
  async (event) => {
    // Appliquer le rate limiting
    await authRateLimiter(event)

    const body = await readBody(event)

    // Validation des données d'entrée
    const { identifier, password, rememberMe } = loginSchema.parse(body)

    // Sanitisation : trim des espaces
    const cleanIdentifier = sanitizeString(identifier)!
    const cleanPassword = sanitizeString(password)!

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
        status: 401,
        message: 'Identifiants invalides',
      })
    }

    // Un compte créé via un fournisseur externe n'a pas de mot de passe (password: null à la
    // création OAuth). bcrypt.compare recevait alors null — typeof null === 'object' — et levait
    // « Illegal arguments: string, object », soit un 500 là où l'utilisateur s'est simplement
    // trompé de porte. On le lui dit, et par où passer.
    if (!user.password) {
      const fournisseur = NOM_DU_FOURNISSEUR[user.authProvider]
      throw createError({
        status: 401,
        message: fournisseur
          ? `Ce compte se connecte avec ${fournisseur}. Utilisez le bouton correspondant plutôt qu'un mot de passe.`
          : "Ce compte n'a pas de mot de passe. Utilisez « Mot de passe oublié » pour en définir un.",
        // Les comptes sans mot de passe ne sont pas tous des comptes OAuth : la base de production
        // en compte 35 en authProvider « email » ou « MANUAL ». Leur annoncer requiresOAuth
        // enverrait le client afficher un bouton de fournisseur qui n'existe pas.
        data: fournisseur
          ? { requiresOAuth: true, provider: user.authProvider }
          : { requiresPasswordReset: true },
      })
    }

    const isPasswordValid = await bcrypt.compare(cleanPassword, user.password)

    if (!isPasswordValid) {
      throw createError({
        status: 401,
        message: 'Identifiants invalides',
      })
    }

    // Vérifier si l'email est vérifié
    if (!user.isEmailVerified) {
      throw createError({
        status: 403,
        message: 'Email non vérifié. Veuillez vérifier votre email avant de vous connecter.',
        data: {
          requiresEmailVerification: true,
          email: user.email,
        },
      })
    }

    // Mettre à jour la date de dernière connexion et le authProvider si nécessaire
    const updateData: { lastLoginAt: Date; authProvider?: string } = {
      lastLoginAt: new Date(),
    }

    // Si l'utilisateur a été créé manuellement (authProvider = MANUAL),
    // on met à jour son authProvider vers 'email' lors de sa première connexion
    if (user.authProvider === 'MANUAL') {
      updateData.authProvider = 'email'
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
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
          isVolunteer: user.isVolunteer,
          isArtist: user.isArtist,
          isOrganizer: user.isOrganizer,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          isEmailVerified: user.isEmailVerified,
        },
      },
      sessionConfig
    )

    return createSuccessResponse({
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        nom: user.nom,
        prenom: user.prenom,
        phone: user.phone,
        profilePicture: user.profilePicture,
        isGlobalAdmin: user.isGlobalAdmin,
        isVolunteer: user.isVolunteer,
        isArtist: user.isArtist,
        isOrganizer: user.isOrganizer,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isEmailVerified: user.isEmailVerified,
      },
    })
  },
  { operationName: 'Login' }
)
