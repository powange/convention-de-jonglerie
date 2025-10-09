// Service d'envoi d'emails avec support simulation/réel
import nodemailer from 'nodemailer'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const config = useRuntimeConfig()
  // Priorité aux variables d'environnement runtime (conteneur) pour éviter les valeurs figées au build
  const sendEmailsEnv = process.env.SEND_EMAILS
  const isEmailEnabled = (sendEmailsEnv ?? (config.emailEnabled as string)) === 'true'
  const smtpUser = process.env.SMTP_USER || (config.smtpUser as string) || ''
  const smtpPass = process.env.SMTP_PASS || (config.smtpPass as string) || ''

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
    if (!smtpUser || !smtpPass) {
      console.error('❌ Variables SMTP manquantes (SMTP_USER, SMTP_PASS)')
      return false
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    const mailOptions = {
      from: `"Conventions de Jonglerie" <${smtpUser}>`,
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
  // Générer un code à 6 chiffres
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function generateVerificationEmailHtml(code: string, prenom: string, email: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vérification de votre compte</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .code { background: #1f2937; color: #fbbf24; padding: 15px; font-size: 28px; font-weight: bold; text-align: center; border-radius: 8px; letter-spacing: 3px; margin: 20px 0; }
            .button { display: inline-block; background: #3b82f6; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .button:hover { background: #2563eb; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤹 Vérification de votre compte</h1>
            </div>
            <div class="content">
                <p>Bonjour ${prenom},</p>
                
                <p>Bienvenue dans la communauté des conventions de jonglerie ! 🎪</p>
                
                <p>Pour finaliser votre inscription, vous pouvez :</p>
                
                <div style="text-align: center;">
                    <a href="${process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/verify-email?email=${encodeURIComponent(email)}" class="button">Vérifier mon compte</a>
                </div>
                
                <p style="text-align: center; margin: 20px 0; color: #6b7280;">
                    <strong>OU</strong>
                </p>
                
                <p>Saisir manuellement ce code de vérification :</p>
                
                <div class="code">${code}</div>
                
                <p><strong>Ce code est valide pendant 15 minutes.</strong></p>
                
                <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
                
                <p>À bientôt sur la plateforme !<br>
                L'équipe des Conventions de Jonglerie</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
        </div>
    </body>
    </html>
  `
}

export function generateAccountDeletionEmailHtml(
  prenom: string,
  reason: { title: string; message: string }
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Suppression de votre compte</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .reason-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .reason-title { font-weight: bold; color: #dc2626; margin-bottom: 10px; }
            .button { display: inline-block; background: #3b82f6; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚠️ Suppression de votre compte</h1>
            </div>
            <div class="content">
                <p>Bonjour ${prenom},</p>
                
                <p>Nous vous informons que votre compte sur la plateforme Conventions de Jonglerie a été supprimé par nos administrateurs.</p>
                
                <div class="reason-box">
                    <div class="reason-title">Motif de la suppression :</div>
                    <div><strong>${reason.title}</strong></div>
                    <p style="margin-top: 10px;">${reason.message}</p>
                </div>
                
                <p><strong>Cette action est définitive.</strong> Toutes vos données personnelles ont été supprimées de nos serveurs conformément à notre politique de confidentialité.</p>
                
                <p>Si vous pensez que cette suppression est une erreur ou si vous avez des questions, vous pouvez nous contacter :</p>
                
                <div style="text-align: center;">
                    <a href="mailto:contact@conventionsdejonglerie.fr" class="button">Nous contacter</a>
                </div>
                
                <p>Nous vous remercions pour votre participation à la communauté des conventions de jonglerie.</p>
                
                <p>Cordialement,<br>
                L'équipe des Conventions de Jonglerie</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre directement.</p>
            </div>
        </div>
    </body>
    </html>
  `
}

export function generateNotificationEmailHtml(
  prenom: string,
  title: string,
  message: string,
  actionUrl?: string,
  actionText?: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .message { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; white-space: pre-wrap; }
            .button { display: inline-block; background: #3b82f6; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .button:hover { background: #2563eb; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤹 ${title}</h1>
            </div>
            <div class="content">
                <p>Bonjour ${prenom},</p>

                <div class="message">${message}</div>

                ${actionUrl && actionText ? `
                <div style="text-align: center;">
                    <a href="${process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${actionUrl}" class="button">${actionText}</a>
                </div>
                ` : ''}

                <p>Cordialement,<br>
                L'équipe des Conventions de Jonglerie</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                <p>Vous pouvez gérer vos préférences de notifications dans votre <a href="${process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/profile">profil</a>.</p>
            </div>
        </div>
    </body>
    </html>
  `
}

export function generatePasswordResetEmailHtml(resetLink: string, prenom: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation de votre mot de passe</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .button:hover { background: #2563eb; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            .link { word-break: break-all; color: #3b82f6; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Réinitialisation de mot de passe</h1>
            </div>
            <div class="content">
                <p>Bonjour ${prenom},</p>
                
                <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Conventions de Jonglerie.</p>
                
                <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
                
                <div style="text-align: center;">
                    <a href="${resetLink}" class="button">Réinitialiser mon mot de passe</a>
                </div>
                
                <p><strong>Ce lien est valide pendant 1 heure.</strong></p>
                
                <p>Si le bouton ne fonctionne pas, vous pouvez copier et coller le lien suivant dans votre navigateur :</p>
                <p class="link">${resetLink}</p>
                
                <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email. Votre mot de passe restera inchangé.</p>
                
                <p>Cordialement,<br>
                L'équipe des Conventions de Jonglerie</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
        </div>
    </body>
    </html>
  `
}
