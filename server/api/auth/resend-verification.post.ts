import { z } from 'zod'

import {
  sendEmail,
  generateVerificationCode,
  generateVerificationEmailHtml,
} from '../../utils/emailService'
import { prisma } from '../../utils/prisma'
import { emailRateLimiter } from '../../utils/rate-limiter'
import { handleValidationError } from '../../utils/validation-schemas'

const resendVerificationSchema = z.object({
  email: z.string().email('Adresse email invalide'),
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Stocker l'email dans le contexte pour le rate limiter
    event.context.body = body

    // Appliquer le rate limiting
    await emailRateLimiter(event)

    // Validation des données
    const validatedData = resendVerificationSchema.parse(body)
    const cleanEmail = validatedData.email.toLowerCase().trim()

    // Rechercher l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur non trouvé',
      })
    }

    if (user.isEmailVerified) {
      throw createError({
        statusCode: 400,
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

    // Envoyer l'email de vérification
    const emailHtml = generateVerificationEmailHtml(verificationCode, user.prenom, cleanEmail)
    const emailSent = await sendEmail({
      to: cleanEmail,
      subject: '🤹 Nouveau code de vérification - Conventions de Jonglerie',
      html: emailHtml,
      text: `Bonjour ${user.prenom}, votre nouveau code de vérification est : ${verificationCode}. Cliquez sur ce lien pour vérifier : ${process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/verify-email?email=${encodeURIComponent(cleanEmail)}`,
    })

    if (!emailSent) {
      console.warn(`Échec de l'envoi d'email pour ${cleanEmail}`)
    }

    return {
      message: 'Nouveau code de vérification envoyé avec succès',
    }
  } catch (error) {
    // Gestion des erreurs de validation Zod
    if (error instanceof z.ZodError) {
      return handleValidationError(error)
    }

    // Re-lancer les erreurs déjà formatées
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Erreur lors du renvoi du code:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur interne',
    })
  }
})
