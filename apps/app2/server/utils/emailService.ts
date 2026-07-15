// Service d'envoi d'emails — version SIMULATION uniquement pour app2.
//
// app2 n'a ni `nodemailer`, ni `@vue-email/render`, ni templates d'email.
// - `sendEmail` ne throw JAMAIS : en mode simulation (SEND_EMAILS !== 'true') il
//   logge le destinataire + le sujet + un extrait du contenu (le code de
//   vérification reste ainsi visible dans les logs serveur) et retourne `true`.
//   Si SEND_EMAILS === 'true', il retourne `false` sans rien envoyer (aucun
//   transport configuré).
// - Les fonctions `generate*EmailHtml` retournent une simple chaîne HTML.
import { randomInt } from 'node:crypto'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * URL publique du site : runtimeConfig.public.siteUrl, sinon NUXT_PUBLIC_SITE_URL,
 * sinon localhost.
 */
export function getSiteUrl(): string {
  const config = useRuntimeConfig()
  const publicConfig = config.public as Record<string, any>
  return publicConfig?.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

/**
 * Envoi d'email en mode simulation. Ne throw jamais.
 * @returns `true` en simulation (email « envoyé »), `false` si SEND_EMAILS=true
 *          (aucun transport réel disponible dans app2).
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const isSimulation = process.env.SEND_EMAILS !== 'true'

  if (!isSimulation) {
    console.warn(
      `[emailService] SEND_EMAILS=true mais aucun transport n'est configuré dans app2 — ` +
        `email NON envoyé à ${options.to} (sujet: "${options.subject}")`
    )
    return false
  }

  // Mode simulation : logger le contenu pour retrouver le code / lien dans les logs.
  const excerpt = (options.text || options.html || '').replace(/\s+/g, ' ').trim().slice(0, 500)
  console.log('📧 EMAIL SIMULÉ (SEND_EMAILS!=true):', {
    to: options.to,
    subject: options.subject,
    contenu: excerpt,
  })

  return true
}

/**
 * Génère un code de vérification à 6 chiffres (string), via un CSPRNG.
 */
export function generateVerificationCode(): string {
  return randomInt(100000, 1000000).toString()
}

/**
 * Génère le HTML de l'email de vérification de compte.
 */
export async function generateVerificationEmailHtml(
  code: string,
  prenom: string,
  email: string
): Promise<string> {
  const verifyUrl = `${getSiteUrl()}/verify-email?email=${encodeURIComponent(email)}`
  return `<div>
  <p>Bonjour ${prenom},</p>
  <p>Votre code de vérification est : <strong class="code">${code}</strong></p>
  <p><a href="${verifyUrl}">Vérifier mon compte</a></p>
</div>`
}

/**
 * Génère le HTML de l'email de réinitialisation de mot de passe.
 */
export async function generatePasswordResetEmailHtml(
  resetLink: string,
  prenom: string
): Promise<string> {
  return `<div>
  <p>Bonjour ${prenom},</p>
  <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
  <p><a href="${resetLink}">Réinitialiser mon mot de passe</a></p>
  <p>Ce lien est valide pendant 1 heure.</p>
</div>`
}
