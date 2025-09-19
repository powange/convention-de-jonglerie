import { requireAuth } from '../../../utils/auth-utils'
import { createFutureDate, TOKEN_DURATIONS } from '../../../utils/date-utils'
import { sendEmail } from '../../../utils/emailService'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    // Vérifier que l'utilisateur est connecté
    const user = await requireAuth(event)

    const conventionId = getRouterParam(event, 'id')
    if (!conventionId) {
      throw createError({
        statusCode: 400,
        message: 'ID de convention manquant',
      })
    }

    const conventionIdNum = parseInt(conventionId)

    // Vérifier que la convention existe et n'a pas de créateur
    const convention = await prisma.convention.findUnique({
      where: { id: conventionIdNum },
    })

    if (!convention) {
      throw createError({
        statusCode: 404,
        message: 'Convention non trouvée',
      })
    }

    if (convention.authorId) {
      throw createError({
        statusCode: 400,
        message: 'Cette convention a déjà un créateur',
      })
    }

    if (!convention.email) {
      throw createError({
        statusCode: 400,
        message: "Cette convention n'a pas d'email de contact configuré",
      })
    }

    // Supprimer les anciennes demandes expirées de cet utilisateur pour cette convention
    await prisma.conventionClaimRequest.deleteMany({
      where: {
        conventionId: conventionIdNum,
        userId: user.id,
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    // On permet de renvoyer un nouveau code même si une demande existe déjà
    // Le upsert ci-dessous gère automatiquement ce cas

    // Générer un code de vérification à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // Créer ou mettre à jour la demande de revendication
    await prisma.conventionClaimRequest.upsert({
      where: {
        conventionId_userId: {
          conventionId: conventionIdNum,
          userId: user.id,
        },
      },
      update: {
        code,
        expiresAt: createFutureDate(TOKEN_DURATIONS.CLAIM_CODE), // 1 heure
        isVerified: false,
        verifiedAt: null,
      },
      create: {
        conventionId: conventionIdNum,
        userId: user.id,
        code,
        expiresAt: createFutureDate(TOKEN_DURATIONS.CLAIM_CODE), // 1 heure
      },
    })

    // Envoyer l'email avec le code
    const emailHtml = generateClaimEmailHtml(code, convention.name, user.prenom || user.pseudo)
    await sendEmail({
      to: convention.email,
      subject: `Code de revendication pour ${convention.name}`,
      html: emailHtml,
      text: `Bonjour,\\n\\nUn utilisateur souhaite revendiquer la propriété de la convention "${convention.name}".\\n\\nCode de vérification : ${code}\\n\\nCe code est valide pendant 1 heure.\\n\\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\\n\\nL'équipe des Conventions de Jonglerie`,
    })

    return {
      message: "Code de vérification envoyé à l'email de la convention",
      expiresAt: createFutureDate(TOKEN_DURATIONS.CLAIM_CODE),
    }
  } catch (error) {
    console.error('Erreur lors de la demande de revendication:', error)
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la demande de revendication',
    })
  }
})

function generateClaimEmailHtml(code: string, conventionName: string, userName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Code de revendication - ${conventionName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Demande de revendication de convention</h2>

        <p>Bonjour,</p>

        <p>L'utilisateur <strong>${userName}</strong> souhaite revendiquer la propriété de la convention <strong>"${conventionName}"</strong>.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <h3 style="margin: 0; color: #1f2937;">Code de vérification</h3>
          <div style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 4px; margin: 10px 0;">
            ${code}
          </div>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">Ce code expire dans 1 heure</p>
        </div>

        <p>Si vous confirmez que ${userName} peut revendiquer cette convention, communiquez-lui ce code de vérification.</p>

        <p style="font-size: 14px; color: #6b7280;">
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          L'équipe des Conventions de Jonglerie
        </p>
      </div>
    </body>
    </html>
  `
}
