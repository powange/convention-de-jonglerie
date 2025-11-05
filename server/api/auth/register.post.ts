import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { createFutureDate, TOKEN_DURATIONS } from '@@/server/utils/date-utils'
import {
  sendEmail,
  generateVerificationCode,
  generateVerificationEmailHtml,
  getSiteUrl,
} from '@@/server/utils/emailService'
import { prisma } from '@@/server/utils/prisma'
import { registerRateLimiter } from '@@/server/utils/rate-limiter'
import { sanitizeEmail, sanitizeString } from '@@/server/utils/validation-helpers'
import { registerSchema } from '@@/server/utils/validation-schemas'
import bcrypt from 'bcryptjs'

export default wrapApiHandler(
  async (event) => {
    // Appliquer le rate limiting
    await registerRateLimiter(event)

    const body = await readBody(event)

    // Validation et sanitisation des données
    const validatedData = registerSchema.parse(body)

    // Sanitisation supplémentaire
    const cleanEmail = sanitizeEmail(validatedData.email)
    const cleanPseudo = sanitizeString(validatedData.pseudo)!
    const cleanNom = sanitizeString(validatedData.nom)!
    const cleanPrenom = sanitizeString(validatedData.prenom)!

    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Générer le code de vérification
    const verificationCode = generateVerificationCode()
    const verificationExpiry = createFutureDate(TOKEN_DURATIONS.EMAIL_VERIFICATION)

    // Détecter la langue préférée de l'utilisateur depuis l'en-tête Accept-Language
    const acceptLanguage = getHeader(event, 'accept-language') || 'fr'
    const preferredLanguage = acceptLanguage.split(',')[0].split('-')[0].toLowerCase()
    // Langues supportées
    const { SUPPORTED_LOCALE_CODES } = await import('@@/app/utils/locales')
    const userLanguage = SUPPORTED_LOCALE_CODES.includes(preferredLanguage as any)
      ? preferredLanguage
      : 'fr'

    try {
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
    } catch (error) {
      // Gestion des erreurs Prisma
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        // Unique constraint failed
        throw createError({
          statusCode: 409,
          message: 'Email ou pseudo déjà utilisé',
        })
      }
      throw error
    }

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
  },
  { operationName: 'Register' }
)
