import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { createFutureDate, TOKEN_DURATIONS } from '#server/utils/date-utils'
import {
  sendEmail,
  generateVerificationCode,
  generateVerificationEmailHtml,
  getSiteUrl,
} from '#server/utils/emailService'
import { nomDeSalutation } from '#server/utils/nom-de-salutation'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { userAdminSelect } from '#server/utils/prisma-select-helpers'
import { validateUserId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin
    await requireGlobalAdminWithDbCheck(event)

    // Valider l'ID utilisateur
    const userId = validateUserId(event)

    // Vérifier que l'utilisateur existe
    const existingUser = await fetchResourceOrFail(prisma.user, userId, {
      errorMessage: 'Utilisateur introuvable',
    })

    // Vérifier que l'email est actuellement vérifié
    if (!existingUser.isEmailVerified) {
      throw createError({
        status: 400,
        message: "L'email de cet utilisateur n'est pas vérifié",
      })
    }

    // Générer un nouveau code de vérification
    const verificationCode = generateVerificationCode()
    const verificationExpiry = createFutureDate(TOKEN_DURATIONS.EMAIL_VERIFICATION)

    // Invalider l'email et générer un nouveau code
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: false,
        emailVerificationCode: verificationCode,
        verificationCodeExpiry: verificationExpiry,
        updatedAt: new Date(),
      },
      select: userAdminSelect,
    })

    // Envoyer un email de vérification
    const siteUrl = getSiteUrl()
    const displayName = nomDeSalutation(existingUser)
    const emailHtml = await generateVerificationEmailHtml(
      verificationCode,
      displayName,
      existingUser.email
    )

    try {
      await sendEmail({
        to: existingUser.email,
        subject: '🤹 Vérifiez à nouveau votre compte - Conventions de Jonglerie',
        html: emailHtml,
        text: `Bonjour ${displayName}, votre nouveau code de vérification est : ${verificationCode}. Cliquez sur ce lien pour vérifier : ${siteUrl}/verify-email?email=${encodeURIComponent(existingUser.email)}`,
      })
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email de vérification:", emailError)
      // On continue même si l'email échoue, l'utilisateur peut utiliser le code manuellement
    }

    return createSuccessResponse(
      { user: updatedUser },
      'Email invalidé avec succès. Un nouveau code de vérification a été envoyé.'
    )
  },
  { operationName: 'InvalidateUserEmail' }
)
