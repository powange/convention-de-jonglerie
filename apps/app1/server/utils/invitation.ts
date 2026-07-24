import { randomBytes } from 'node:crypto'

import { createFutureDate, TOKEN_DURATIONS } from './date-utils'
import { getEmailHash } from './email-hash'
import { sendEmail, getSiteUrl, generateInvitationEmailHtml } from './emailService'
import { sanitizeEmail, sanitizeString } from './validation-helpers'

import type { H3Event } from 'h3'

export type InvitationRole = 'artist' | 'volunteer'

// Libellé affiché dans l'email d'invitation selon le rôle.
const ROLE_LABELS: Record<InvitationRole, string> = {
  artist: 'artiste',
  volunteer: 'bénévole',
}

/**
 * Génère un pseudo unique basé sur l'email.
 * Ex: john.doe@example.com -> john.doe, puis john.doe.1 si déjà pris.
 */
export async function generateUniquePseudo(email: string): Promise<string> {
  const baseUsername = (email.split('@')[0] || email).toLowerCase()
  let pseudo = baseUsername
  let suffix = 1
  while (await prisma.user.findUnique({ where: { pseudo } })) {
    pseudo = `${baseUsername}.${suffix}`
    suffix++
  }
  return pseudo
}

/**
 * Langue préférée détectée depuis l'en-tête Accept-Language (fallback: fr).
 */
async function detectPreferredLanguage(event: H3Event): Promise<string> {
  const acceptLanguage = getHeader(event, 'accept-language') || 'fr'
  const firstLang = acceptLanguage.split(',')[0] || 'fr'
  const preferred = (firstLang.split('-')[0] || 'fr').toLowerCase()
  const { getSupportedLocalesCodes } = await import('~/utils/locales')
  const codes = getSupportedLocalesCodes() as readonly string[]
  return codes.includes(preferred) ? preferred : 'fr'
}

interface CreatePendingUserAndInviteParams {
  email: string
  prenom: string
  nom: string
  role: InvitationRole
  // Nom de l'événement/convention affiché dans l'email
  eventName: string
  // Requête courante (langue préférée)
  event: H3Event
}

/**
 * Crée un compte « en attente » (sans mot de passe) pour une personne ajoutée
 * manuellement (artiste/bénévole), génère un token d'invitation (réutilise
 * `PasswordResetToken`, TTL 7 jours) et envoie l'email d'invitation contenant un
 * lien d'activation vers `/auth/invitation?token=...`.
 *
 * L'appelant DOIT avoir vérifié en amont que l'email n'existe pas déjà.
 * Renvoie l'utilisateur créé. Un échec d'envoi d'email n'annule pas la création
 * (le compte + le token existent, l'email pourra être renvoyé plus tard).
 */
export async function createPendingUserAndInvite(params: CreatePendingUserAndInviteParams) {
  const cleanEmail = sanitizeEmail(params.email)
  const cleanPrenom = sanitizeString(params.prenom)!
  const cleanNom = sanitizeString(params.nom)!

  const pseudo = await generateUniquePseudo(cleanEmail)
  const preferredLanguage = await detectPreferredLanguage(params.event)

  // Compte sans mot de passe : l'activation se fait via le lien d'invitation.
  const user = await prisma.user.create({
    data: {
      email: cleanEmail,
      emailHash: getEmailHash(cleanEmail),
      password: null,
      pseudo,
      nom: cleanNom,
      prenom: cleanPrenom,
      authProvider: 'MANUAL',
      isEmailVerified: false,
      preferredLanguage,
    },
    select: {
      id: true,
      email: true,
      pseudo: true,
      prenom: true,
      nom: true,
      phone: true,
      profilePicture: true,
    },
  })

  // Token d'invitation : réutilise l'infra PasswordResetToken avec un TTL long.
  const token = randomBytes(32).toString('hex')
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: createFutureDate(TOKEN_DURATIONS.INVITATION),
    },
  })

  // En dev / E2E, exposer le token dans les logs (comme [DEV_VERIFICATION_CODE]) :
  // les emails vers les domaines de test sont bloqués avant tout log de contenu.
  if (import.meta.dev || process.env.E2E_TEST === 'true') {
    console.log(`[DEV_INVITATION_TOKEN] ${token}`)
  }

  const invitationLink = `${getSiteUrl()}/auth/invitation?token=${token}`
  try {
    const html = await generateInvitationEmailHtml(
      invitationLink,
      cleanPrenom,
      ROLE_LABELS[params.role],
      params.eventName
    )
    const sent = await sendEmail({
      to: cleanEmail,
      subject: `🤹 Invitation ${ROLE_LABELS[params.role]} - ${params.eventName}`,
      html,
      text: `Bonjour ${cleanPrenom}, un organisateur de ${params.eventName} vous a ajouté comme ${ROLE_LABELS[params.role]} sur Juggling Convention. Activez votre compte et choisissez votre mot de passe : ${invitationLink} (lien valide 7 jours).`,
    })
    if (!sent) {
      console.warn(`Échec de l'envoi de l'email d'invitation pour ${cleanEmail}`)
    }
  } catch (emailError) {
    console.error("Erreur lors de l'envoi de l'email d'invitation:", emailError)
  }

  return { user }
}
