import { createFutureDate, TOKEN_DURATIONS } from '@@/server/utils/date-utils'
import {
  sendEmail,
  generateVerificationCode,
  generateVerificationEmailHtml,
  getSiteUrl,
} from '@@/server/utils/emailService'
import { prisma } from '@@/server/utils/prisma'
import { registerRateLimiter } from '@@/server/utils/rate-limiter'
import { registerSchema, handleValidationError } from '@@/server/utils/validation-schemas'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  try {
    // Appliquer le rate limiting
    await registerRateLimiter(event)

    const body = await readBody(event)

    // Validation et sanitisation des données
    const validatedData = registerSchema.parse(body)

    // Sanitisation supplémentaire
    const cleanEmail = validatedData.email.toLowerCase().trim()
    const cleanPseudo = validatedData.pseudo.trim()
    const cleanNom = validatedData.nom.trim()
    const cleanPrenom = validatedData.prenom.trim()

    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Générer le code de vérification
    const verificationCode = generateVerificationCode()
    const verificationExpiry = createFutureDate(TOKEN_DURATIONS.EMAIL_VERIFICATION)

    // Détecter la langue préférée de l'utilisateur depuis l'en-tête Accept-Language
    const acceptLanguage = getHeader(event, 'accept-language') || 'fr'
    const preferredLanguage = acceptLanguage.split(',')[0].split('-')[0].toLowerCase()
    // Langues supportées
    const supportedLanguages = ['fr', 'en', 'de', 'es', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'da']
    const userLanguage = supportedLanguages.includes(preferredLanguage) ? preferredLanguage : 'fr'

    await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        pseudo: cleanPseudo,
        nom: cleanNom,
        prenom: cleanPrenom,
        authProvider: 'email',
        isEmailVerified: false,
        emailVerificationCode: verificationCode,
        verificationCodeExpiry: verificationExpiry,
        preferredLanguage: userLanguage,
      },
    })

    const siteUrl = getSiteUrl()

    // Envoyer l'email de vérification
    const emailHtml = await generateVerificationEmailHtml(verificationCode, cleanPrenom, cleanEmail)
    const emailSent = await sendEmail({
      to: cleanEmail,
      subject: '🤹 Vérifiez votre compte - Conventions de Jonglerie',
      html: emailHtml,
      text: `Bonjour ${cleanPrenom}, votre code de vérification est : ${verificationCode}. Cliquez sur ce lien pour vérifier : ${siteUrl}/verify-email?email=${encodeURIComponent(cleanEmail)}`,
    })

    if (!emailSent) {
      console.warn(`Échec de l'envoi d'email pour ${cleanEmail}`)
    }

    return {
      message: 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.',
      requiresVerification: true,
      email: cleanEmail,
    }
  } catch (error) {
    // Gestion des erreurs de validation Zod
    if (error instanceof z.ZodError) {
      return handleValidationError(error)
    }

    // Gestion des erreurs Prisma
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002') {
        // Unique constraint failed
        throw createError({
          statusCode: 409,
          message: 'Email ou pseudo déjà utilisé',
        })
      }
    }

    console.error("Erreur lors de l'inscription:", error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur interne',
    })
  }
})
