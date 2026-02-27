import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import {
  sendEmail,
  generateVerificationCode,
  generateVerificationEmailHtml,
  getSiteUrl,
} from '#server/utils/emailService'
import { fetchResourceByFieldOrFail } from '#server/utils/prisma-helpers'
import { emailRateLimiter } from '#server/utils/rate-limiter'
import { sanitizeEmail } from '#server/utils/validation-helpers'

const resendVerificationSchema = z.object({
  email: z.string().email('Adresse email invalide'),
})

export default wrapApiHandler(
  async (event) => {
    const body = await readBody(event)

    // Stocker l'email dans le contexte pour le rate limiter
    event.context.body = body

    // Appliquer le rate limiting
    await emailRateLimiter(event)

    // Validation des données
    const validatedData = resendVerificationSchema.parse(body)
    const cleanEmail = sanitizeEmail(validatedData.email)

    // Rechercher l'utilisateur
    const user = await fetchResourceByFieldOrFail(
      prisma.user,
      { email: cleanEmail },
      {
        errorMessage: 'Utilisateur non trouvé',
      }
    )

    if (user.isEmailVerified) {
      throw createError({
        status: 400,
        message: 'Email déjà vérifié',
      })
    }

    // Générer un nouveau code
    const verificationCode = generateVerificationCode()
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Mettre à jour l'utilisateur avec le nouveau code
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: verificationCode,
        verificationCodeExpiry: verificationExpiry,
      },
    })

    const prenom = user.prenom || user.pseudo || 'Utilisateur'
    const siteUrl = getSiteUrl()

    // Envoyer l'email de vérification
    const emailHtml = await generateVerificationEmailHtml(verificationCode, prenom, cleanEmail)
    const emailSent = await sendEmail({
      to: cleanEmail,
      subject: '🤹 Nouveau code de vérification - Conventions de Jonglerie',
      html: emailHtml,
      text: `Bonjour ${user.prenom}, votre nouveau code de vérification est : ${verificationCode}. Cliquez sur ce lien pour vérifier : ${siteUrl}/verify-email?email=${encodeURIComponent(cleanEmail)}`,
    })

    if (!emailSent) {
      console.warn(`Échec de l'envoi d'email pour ${cleanEmail}`)
    }

    return createSuccessResponse(null, 'Nouveau code de vérification envoyé avec succès')
  },
  { operationName: 'ResendVerification' }
)
