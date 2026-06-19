import bcrypt from 'bcryptjs'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { createFutureDate, TOKEN_DURATIONS } from '#server/utils/date-utils'
import { getEmailHash } from '#server/utils/email-hash'
import {
  sendEmail,
  generateVerificationCode,
  generateVerificationEmailHtml,
  getSiteUrl,
} from '#server/utils/emailService'
import { registerRateLimiter } from '#server/utils/rate-limiter'
import { sanitizeEmail, sanitizeString } from '#server/utils/validation-helpers'
import { registerSchema } from '#server/utils/validation-schemas'

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
    const cleanNom = sanitizeString(validatedData.nom) || null
    const cleanPrenom = sanitizeString(validatedData.prenom) || null

    // Extraire les catégories utilisateur
    const { isVolunteer, isArtist, isOrganizer } = validatedData

    const hashedPassword = await bcrypt.hash(validatedData.password, 12)

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

    // Si un utilisateur MANUAL non vérifié existe avec cet email (ex: ajouté
    // comme artiste/bénévole par un organisateur), on le réactive plutôt que
    // de bloquer l'inscription. Le code de vérification envoyé à l'email
    // garantit que c'est bien le propriétaire qui revendique le compte.
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: {
        id: true,
        nom: true,
        prenom: true,
        authProvider: true,
        isEmailVerified: true,
      },
    })

    const isClaimingManualAccount =
      existingUser && existingUser.authProvider === 'MANUAL' && !existingUser.isEmailVerified

    try {
      if (isClaimingManualAccount) {
        // Note : authProvider reste 'MANUAL' tant que l'email n'est pas vérifié.
        // La bascule vers 'email' se fait dans verify-email.post.ts pour préserver
        // les droits d'édition de l'organisateur dans la fenêtre où le claim
        // n'est pas encore confirmé.
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            password: hashedPassword,
            pseudo: cleanPseudo,
            // Préserver les valeurs saisies par l'organisateur si l'utilisateur
            // ne les a pas fournies dans le formulaire d'inscription
            nom: cleanNom ?? existingUser.nom,
            prenom: cleanPrenom ?? existingUser.prenom,
            isEmailVerified: false,
            emailVerificationCode: verificationCode,
            verificationCodeExpiry: verificationExpiry,
            preferredLanguage: userLanguage,
            isVolunteer,
            isArtist,
            isOrganizer,
          },
        })
      } else {
        await prisma.user.create({
          data: {
            email: cleanEmail,
            emailHash: getEmailHash(cleanEmail),
            password: hashedPassword,
            pseudo: cleanPseudo,
            nom: cleanNom,
            prenom: cleanPrenom,
            authProvider: 'email',
            isEmailVerified: false,
            emailVerificationCode: verificationCode,
            verificationCodeExpiry: verificationExpiry,
            preferredLanguage: userLanguage,
            isVolunteer,
            isArtist,
            isOrganizer,
          },
        })
      }
    } catch (error) {
      // Gestion des erreurs Prisma
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        // Unique constraint failed
        throw createError({
          status: 409,
          message: 'Email ou pseudo déjà utilisé',
        })
      }
      throw error
    }

    const siteUrl = getSiteUrl()

    // Envoyer l'email de vérification
    const displayName = cleanPrenom || cleanPseudo
    const emailHtml = await generateVerificationEmailHtml(verificationCode, displayName, cleanEmail)
    const emailSent = await sendEmail({
      to: cleanEmail,
      subject: '🤹 Vérifiez votre compte - Conventions de Jonglerie',
      html: emailHtml,
      text: `Bonjour ${displayName}, votre code de vérification est : ${verificationCode}. Cliquez sur ce lien pour vérifier : ${siteUrl}/verify-email?email=${encodeURIComponent(cleanEmail)}`,
    })

    if (!emailSent) {
      console.warn(`Échec de l'envoi d'email pour ${cleanEmail}`)
    }

    return createSuccessResponse(
      { requiresVerification: true, email: cleanEmail },
      'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.'
    )
  },
  { operationName: 'Register' }
)
