/**
 * Envoi d'un courriel — le TRANSPORT, commun à app1 et Flowvent : simulation (journal) tant que
 * SEND_EMAILS n'est pas `true`, sinon SMTP (SMTP_HOST/PORT/USER/PASS, ou Gmail par défaut),
 * copie cachée d'archivage (SMTP_BCC), et aucun envoi vers un domaine de test.
 *
 * Chaque app garde ses gabarits et son nom d'expéditeur, et appelle `envoyerCourriel` depuis son
 * `server/utils/emailService.ts` (`sendEmail`, la signature historique que le reste du code et les
 * layers appellent).
 */
import nodemailer from 'nodemailer'

import { getBccRecipients } from './email-bcc'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  /**
   * Comment se désabonner de ce type de courriel — en-tête `List-Unsubscribe`.
   *
   * ⚠️ CE N'EST PAS UNE POLITESSE. Gmail et Outlook s'en servent pour afficher leur propre bouton
   * « Se désabonner », et son ABSENCE sur des courriels envoyés en nombre pèse sur la
   * délivrabilité : une personne qui ne trouve pas comment arrêter les notifications les signale
   * comme pourriel, et c'est le domaine entier qui en paie le prix — y compris les courriels de
   * vérification d'adresse, dont personne ne se plaint jamais.
   *
   * On ne le pose donc QUE sur les courriels dont on peut effectivement se désabonner : les
   * notifications. Un courriel de réinitialisation de mot de passe n'a pas de case à décocher.
   *
   * ⚠️ PAS de `List-Unsubscribe-Post`. Cet en-tête promet qu'un simple POST sur l'URL suffit à
   * désabonner, sans confirmation. Nous ne proposons qu'une PAGE de réglages : l'annoncer à tort
   * ferait échouer le désabonnement en un clic là où le client l'affiche — c'est-à-dire pire
   * qu'un lien ordinaire, puisque la personne croirait l'avoir fait.
   */
  listUnsubscribe?: string
}

/**
 * Domaines d'email pour lesquels aucun envoi ne doit être tenté,
 * même si SEND_EMAILS=true. Protège contre l'envoi accidentel
 * vers des adresses de test ou fictives.
 */
export const BLOCKED_EMAIL_DOMAINS = ['example.com', 'example.fr', 'example.org', 'example.net']

/**
 * Domaines où aucun courriel ne part, même avec SEND_EMAILS=true : ceux d'exemple ci-dessus, et
 * les suffixes RÉSERVÉS aux essais (RFC 2606) — `.test`, `.invalid`, `.example`, `.localhost`.
 * Les comptes de démonstration de Flowvent sont en `@exemple.test`.
 */
export function estUnDomaineDeTest(domaine: string): boolean {
  return (
    BLOCKED_EMAIL_DOMAINS.includes(domaine) || /\.(test|invalid|example|localhost)$/.test(domaine)
  )
}

export interface ExpediteurCourriel {
  /** Nom affiché de l'expéditeur : « Juggling Convention », « Flowvent »… */
  nomExpediteur: string
}

export async function envoyerCourriel(
  options: EmailOptions,
  { nomExpediteur }: ExpediteurCourriel
): Promise<boolean> {
  const config = useRuntimeConfig()
  // Priorité aux variables d'environnement runtime (conteneur) pour éviter les valeurs figées au build
  const sendEmailsEnv = process.env.SEND_EMAILS
  const isEmailEnabled = (sendEmailsEnv ?? (config.emailEnabled as string)) === 'true'
  const smtpUser = process.env.SMTP_USER || (config.smtpUser as string) || ''
  const smtpPass = process.env.SMTP_PASS || (config.smtpPass as string) || ''
  const smtpFrom = process.env.SMTP_FROM || (config.smtpFrom as string) || smtpUser
  const smtpBcc = process.env.SMTP_BCC || (config.smtpBcc as string) || ''

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

    // Mode envoi réel. Les domaines de test sont bloqués ICI seulement : en simulation rien ne
    // part, et le contenu (codes compris) doit rester lisible pour les comptes d'essai.
    const recipientDomain = options.to.split('@')[1]?.toLowerCase()
    if (recipientDomain && estUnDomaineDeTest(recipientDomain)) {
      console.log(`🚫 Email bloqué (domaine interdit ${recipientDomain}):`, {
        to: options.to,
        subject: options.subject,
      })
      return true
    }

    const smtpHost = process.env.SMTP_HOST || ''
    const smtpPort = parseInt(process.env.SMTP_PORT || '587')

    // Si un host SMTP custom est configuré, ajouter l'auth seulement si user/pass fournis
    // (permet de garder Mailpit en dev sans auth)
    const transporter = smtpHost
      ? nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          ...(smtpUser && smtpPass ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
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

    const bcc = getBccRecipients(smtpBcc, BLOCKED_EMAIL_DOMAINS).filter(
      (a) => !estUnDomaineDeTest(a.split('@')[1]?.toLowerCase() ?? '')
    )

    const mailOptions = {
      from: `"${nomExpediteur}" <${smtpFrom}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      ...(bcc.length > 0 ? { bcc } : {}),
      ...(options.listUnsubscribe
        ? { headers: { 'List-Unsubscribe': `<${options.listUnsubscribe}>` } }
        : {}),
    }

    const info = await transporter.sendMail(mailOptions)

    // Nodemailer ne lève que si TOUS les destinataires sont rejetés. Avec une copie en BCC, un
    // rejet du destinataire réel passerait donc pour un succès dès que la copie est acceptée,
    // et une copie rejetée (quota, greylisting) donnerait une archive vide sans un bruit.
    const rejected: string[] = (info.rejected || []).map((address) => String(address))
    if (rejected.length > 0) {
      console.error(`⚠️ Destinataires rejetés par le serveur SMTP : ${rejected.join(', ')}`)
    }

    const isRejected = (address: string) =>
      rejected.some((r) => r.toLowerCase() === address.toLowerCase())

    if (isRejected(options.to)) return false

    console.log(
      `✅ Email envoyé à ${options.to}${bcc.length > 0 ? ` (copie : ${bcc.join(', ')})` : ''}`
    )
    return true
  } catch (error) {
    console.error('❌ Erreur envoi email:', error)
    return false
  }
}
