import { randomBytes } from 'node:crypto'

import { z } from 'zod'

import { createFutureDate, TOKEN_DURATIONS } from '../../utils/date-utils'
import { sendEmail, generatePasswordResetEmailHtml } from '../../utils/emailService'
import { prisma } from '../../utils/prisma'

const requestPasswordResetSchema = z.object({
  email: z.string().email(),
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { email } = requestPasswordResetSchema.parse(body)

    // Message générique pour ne pas révéler si l'email existe
    const genericMessage =
      'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques minutes.'

    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Retourner le même message pour ne pas révéler l'existence du compte
      return {
        message: genericMessage,
      }
    }

    // Générer un token unique
    const token = randomBytes(32).toString('hex')

    // Créer le token de réinitialisation (expire dans 1 heure)
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: createFutureDate(TOKEN_DURATIONS.PASSWORD_RESET),
      },
    })

    // Créer le lien de réinitialisation
    const resetLink = `${getRequestURL(event).origin}/auth/reset-password?token=${token}`

    // Envoyer l'email
    const emailHtml = generatePasswordResetEmailHtml(resetLink, user.prenom)
    await sendEmail({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe - Conventions de Jonglerie',
      html: emailHtml,
      text: `Bonjour ${user.prenom},\n\nVous avez demandé la réinitialisation de votre mot de passe.\n\nCliquez sur ce lien pour réinitialiser votre mot de passe : ${resetLink}\n\nCe lien est valide pendant 1 heure.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.\n\nL'équipe des Conventions de Jonglerie`,
    })

    return {
      message: genericMessage,
    }
  } catch (error) {
    console.error('Erreur lors de la demande de réinitialisation:', error)
    throw createError({
      statusCode: 400,
      statusMessage: 'Erreur lors de la demande de réinitialisation',
    })
  }
})
