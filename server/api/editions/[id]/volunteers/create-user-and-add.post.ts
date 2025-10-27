import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/collaborator-management'
import { createFutureDate, TOKEN_DURATIONS } from '@@/server/utils/date-utils'
import { sendEmail, generateVerificationCode, getSiteUrl } from '@@/server/utils/emailService'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  email: z.string().email(),
  prenom: z.string().min(1),
  nom: z.string().min(1),
})

/**
 * Génère un pseudo unique basé sur l'email
 * Ex: john.doe@example.com -> john.doe ou john.doe.1 si déjà pris
 */
async function generateUniquePseudo(email: string): Promise<string> {
  const baseUsername = email.split('@')[0].toLowerCase()
  let pseudo = baseUsername
  let suffix = 1

  // Vérifier si le pseudo existe déjà
  while (await prisma.user.findUnique({ where: { pseudo } })) {
    pseudo = `${baseUsername}.${suffix}`
    suffix++
  }

  return pseudo
}

/**
 * Génère l'email d'invitation pour un bénévole ajouté manuellement
 */
async function generateVolunteerInvitationEmailHtml(
  code: string,
  prenom: string,
  email: string,
  editionName: string,
  conventionName: string,
  editionId: number
): Promise<string> {
  const baseUrl = getSiteUrl()
  const verifyUrl = `${baseUrl}/verify-email?email=${encodeURIComponent(email)}`
  const volunteersUrl = `${baseUrl}/editions/${editionId}/volunteers`

  // Template HTML pour l'email d'invitation
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation à rejoindre Juggling Convention</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; color: #111827; font-weight: 700;">
                🤹 Bienvenue sur Juggling Convention !
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                Bonjour <strong>${prenom}</strong>,
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                Un organisateur de <strong>${conventionName}${editionName ? ' - ' + editionName : ''}</strong> vous a ajouté comme bénévole sur la plateforme Juggling Convention.
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                Pour activer votre compte et définir votre mot de passe, veuillez vérifier votre adresse email avec le code ci-dessous :
              </p>

              <!-- Code de vérification -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td align="center" style="background-color: #f9fafb; padding: 24px; border-radius: 8px; border: 2px dashed #e5e7eb;">
                    <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                      Votre code de vérification
                    </div>
                    <div style="font-size: 36px; font-weight: 700; color: #111827; letter-spacing: 0.1em; font-family: 'Courier New', monospace;">
                      ${code}
                    </div>
                    <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">
                      Ce code expire dans 15 minutes
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Bouton principal -->
              <table role="presentation" style="width: 100%; margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Vérifier mon email et créer mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                Une fois votre compte activé, vous pourrez :
              </p>
              <ul style="margin: 0 0 16px; padding-left: 20px; color: #374151;">
                <li style="margin-bottom: 8px;">Accéder à votre espace bénévole</li>
                <li style="margin-bottom: 8px;">Consulter vos créneaux de bénévolat</li>
                <li style="margin-bottom: 8px;">Gérer vos préférences</li>
                <li style="margin-bottom: 8px;">Découvrir d'autres conventions de jonglerie</li>
              </ul>

              <!-- Bouton secondaire -->
              <table role="presentation" style="width: 100%; margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${volunteersUrl}" style="display: inline-block; padding: 10px 24px; background-color: #f3f4f6; color: #374151; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; border: 1px solid #e5e7eb;">
                      Voir la page bénévoles de l'édition
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 14px; line-height: 20px; color: #6b7280;">
                Si vous n'avez pas demandé à rejoindre cette convention, vous pouvez ignorer cet email.
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #9ca3af;">
                Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
                <a href="${verifyUrl}" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">
                  ${verifyUrl}
                </a>
              </p>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td align="center" style="padding: 0 40px 40px;">
              <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                L'équipe Juggling Convention
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  return html
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canManageEditionVolunteers(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les bénévoles',
    })

  const body = bodySchema.parse(await readBody(event))

  try {
    // Sanitisation des données
    const cleanEmail = body.email.toLowerCase().trim()
    const cleanPrenom = body.prenom.trim()
    const cleanNom = body.nom.trim()

    // Vérifier que l'email n'existe pas déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    })

    if (existingUser) {
      throw createError({
        statusCode: 409,
        message:
          "Cet email est déjà utilisé. Veuillez rechercher l'utilisateur existant dans la liste.",
      })
    }

    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        name: true,
        conventionId: true,
        convention: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Edition introuvable',
      })
    }

    // Générer un pseudo unique
    const pseudo = await generateUniquePseudo(cleanEmail)

    // Générer le code de vérification
    const verificationCode = generateVerificationCode()
    const verificationExpiry = createFutureDate(TOKEN_DURATIONS.EMAIL_VERIFICATION)

    // Détecter la langue préférée de l'utilisateur depuis l'en-tête Accept-Language
    const acceptLanguage = getHeader(event, 'accept-language') || 'fr'
    const preferredLanguage = acceptLanguage.split(',')[0].split('-')[0].toLowerCase()
    // Langues supportées
    const { getSupportedLocalesCodes } = await import('~/utils/locales')
    const userLanguage = getSupportedLocalesCodes().includes(preferredLanguage)
      ? preferredLanguage
      : 'fr'

    // Créer l'utilisateur sans mot de passe
    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: null, // Sera défini lors de la vérification
        pseudo,
        nom: cleanNom,
        prenom: cleanPrenom,
        authProvider: 'email',
        isEmailVerified: false,
        emailVerificationCode: verificationCode,
        verificationCodeExpiry: verificationExpiry,
        preferredLanguage: userLanguage,
      },
      select: {
        id: true,
        email: true,
        pseudo: true,
        prenom: true,
        nom: true,
      },
    })

    // Créer la candidature de bénévole avec le statut ACCEPTED
    const application = await prisma.editionVolunteerApplication.create({
      data: {
        editionId,
        userId: newUser.id,
        status: 'ACCEPTED',
        motivation: 'Ajouté manuellement par un organisateur',
        userSnapshotPhone: null,
        dietaryPreference: 'NONE',
        setupAvailability: null,
        teardownAvailability: null,
        eventAvailability: null,
        source: 'MANUAL',
        addedById: user.id,
        addedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
      },
    })

    // Envoyer l'email d'invitation personnalisé
    try {
      const emailHtml = await generateVolunteerInvitationEmailHtml(
        verificationCode,
        cleanPrenom,
        cleanEmail,
        edition.name || '',
        edition.convention.name,
        editionId
      )

      const siteUrl = getSiteUrl()
      const emailSent = await sendEmail({
        to: cleanEmail,
        subject: `🤹 Invitation bénévole - ${edition.convention.name}`,
        html: emailHtml,
        text: `Bonjour ${cleanPrenom}, un organisateur de ${edition.convention.name}${edition.name ? ' - ' + edition.name : ''} vous a ajouté comme bénévole. Votre code de vérification est : ${verificationCode}. Cliquez sur ce lien pour vérifier votre email et créer votre mot de passe : ${siteUrl}/verify-email?email=${encodeURIComponent(cleanEmail)}`,
      })

      if (!emailSent) {
        console.warn(`Échec de l'envoi d'email d'invitation pour ${cleanEmail}`)
      }
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email d'invitation:", emailError)
    }

    return {
      success: true,
      user: newUser,
      application,
    }
  } catch (error: unknown) {
    console.error(
      "Erreur lors de la création de l'utilisateur et de l'ajout comme bénévole:",
      error
    )
    throw error
  }
})
