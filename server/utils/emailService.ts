// Service d'envoi d'emails avec support simulation/réel
import { randomInt } from 'node:crypto'

import { render } from '@vue-email/render'
import nodemailer from 'nodemailer'

import AccountDeletionEmail from '../emails/AccountDeletionEmail.vue'
import NotificationEmail from '../emails/NotificationEmail.vue'
import PasswordResetEmail from '../emails/PasswordResetEmail.vue'
import VerificationEmail from '../emails/VerificationEmail.vue'
import VolunteerScheduleEmail from '../emails/VolunteerScheduleEmail.vue'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export function getSiteUrl(): string {
  const config = useRuntimeConfig()
  return config.public.siteUrl || 'http://localhost:3000'
}

/**
 * Domaines d'email pour lesquels aucun envoi ne doit être tenté,
 * même si SEND_EMAILS=true. Protège contre l'envoi accidentel
 * vers des adresses de test ou fictives.
 */
const BLOCKED_EMAIL_DOMAINS = ['example.com', 'example.fr', 'example.org', 'example.net']

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const config = useRuntimeConfig()
  // Priorité aux variables d'environnement runtime (conteneur) pour éviter les valeurs figées au build
  const sendEmailsEnv = process.env.SEND_EMAILS
  const isEmailEnabled = (sendEmailsEnv ?? (config.emailEnabled as string)) === 'true'
  const smtpUser = process.env.SMTP_USER || (config.smtpUser as string) || ''
  const smtpPass = process.env.SMTP_PASS || (config.smtpPass as string) || ''
  const smtpFrom = process.env.SMTP_FROM || (config.smtpFrom as string) || smtpUser

  // Bloquer les envois vers les domaines de test
  const recipientDomain = options.to.split('@')[1]?.toLowerCase()
  if (recipientDomain && BLOCKED_EMAIL_DOMAINS.includes(recipientDomain)) {
    console.log(`🚫 Email bloqué (domaine interdit ${recipientDomain}):`, {
      to: options.to,
      subject: options.subject,
    })
    return true
  }

  try {
    if (!isEmailEnabled) {
      // Mode simulation
      console.log('📧 EMAIL SIMULÉ (SEND_EMAILS=false):', {
        to: options.to,
        subject: options.subject,
        text: options.text,
      })

      // Extraire le code ou le lien selon le type d'email
      const codeMatch = options.html.match(/class="code">(\d{6})</)
      if (codeMatch) {
        console.log('🔑 CODE DANS LE CONTENU:', codeMatch[1])
      }

      const linkMatch = options.html.match(/href="([^"]+)"/)
      if (linkMatch && options.subject.includes('mot de passe')) {
        console.log('🔗 LIEN DE RÉINITIALISATION:', linkMatch[1])
      }

      return true
    }

    // Mode envoi réel
    const smtpHost = process.env.SMTP_HOST || ''
    const smtpPort = parseInt(process.env.SMTP_PORT || '587')

    // Si un host SMTP custom est configuré (ex: Mailpit), pas besoin d'auth
    const transporter = smtpHost
      ? nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: false,
        })
      : (() => {
          if (!smtpUser || !smtpPass) {
            console.error('❌ Variables SMTP manquantes (SMTP_USER, SMTP_PASS)')
            return null
          }
          return nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          })
        })()

    if (!transporter) return false

    const mailOptions = {
      from: `"Juggling Convention" <${smtpFrom}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    }

    await transporter.sendMail(mailOptions)
    console.log(`✅ Email envoyé à ${options.to}`)
    return true
  } catch (error) {
    console.error('❌ Erreur envoi email:', error)
    return false
  }
}

export function generateVerificationCode(): string {
  // Générer un code à 6 chiffres avec un CSPRNG (cryptographiquement sûr)
  const code = randomInt(100000, 1000000).toString()
  if (import.meta.dev || process.env.E2E_TEST === 'true') {
    console.log(`[DEV_VERIFICATION_CODE] ${code}`)
  }
  return code
}

/**
 * Génère l'email de vérification de compte
 */
export async function generateVerificationEmailHtml(
  code: string,
  prenom: string,
  email: string
): Promise<string> {
  const baseUrl = getSiteUrl()

  const html = await render(
    VerificationEmail,
    {
      code,
      prenom,
      email,
      baseUrl,
    },
    {
      pretty: true,
    }
  )
  return html
}

/**
 * Génère l'email de suppression de compte
 */
export async function generateAccountDeletionEmailHtml(
  prenom: string,
  reason: { title: string; message: string }
): Promise<string> {
  const baseUrl = getSiteUrl()

  const html = await render(
    AccountDeletionEmail,
    {
      prenom,
      reasonTitle: reason.title,
      reasonMessage: reason.message,
      baseUrl,
    },
    {
      pretty: true,
    }
  )
  return html
}

/**
 * Génère l'email de notification
 */
export async function generateNotificationEmailHtml(
  prenom: string,
  title: string,
  message: string,
  actionUrl?: string,
  actionText?: string
): Promise<string> {
  const baseUrl = getSiteUrl()

  const html = await render(
    NotificationEmail,
    {
      title,
      prenom,
      message,
      baseUrl,
      actionUrl,
      actionText,
    },
    {
      pretty: true,
    }
  )
  return html
}

/**
 * Génère l'email de réinitialisation de mot de passe
 */
export async function generatePasswordResetEmailHtml(
  resetLink: string,
  prenom: string
): Promise<string> {
  const baseUrl = getSiteUrl()

  const html = await render(
    PasswordResetEmail,
    {
      prenom,
      resetLink,
      baseUrl,
    },
    {
      pretty: true,
    }
  )
  return html
}

/**
 * Génère l'email pour les créneaux de bénévolat
 */
export async function generateVolunteerScheduleEmailHtml(
  prenom: string,
  conventionName: string,
  editionName: string,
  timeSlots: Array<{
    date: Date
    timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING'
    teamName: string
    startTime?: string
    endTime?: string
  }>,
  actionUrl: string
): Promise<string> {
  const baseUrl = getSiteUrl()

  const html = await render(
    VolunteerScheduleEmail,
    {
      prenom,
      conventionName,
      editionName,
      timeSlots,
      actionUrl,
      baseUrl,
    },
    {
      pretty: true,
    }
  )
  return html
}
