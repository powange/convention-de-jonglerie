import { randomBytes } from 'node:crypto'

import type { H3Event } from 'h3'

import { createFutureDate } from '#server/utils/date-utils'
import { getEmailHash } from '#server/utils/email-hash'
import { getSiteUrl, sendEmail } from '#server/utils/emailService'
import { sanitizeEmail, sanitizeString } from '#server/utils/validation-helpers'

/** Durée de validité du lien d'invitation : sept jours, comme dans app1. */
const DUREE_INVITATION_MS = 7 * 24 * 60 * 60 * 1000

const ROLE_LABELS = { volunteer: 'bénévole', organizer: 'organisateur' } as const

interface CreatePendingUserAndInviteParams {
  email: string
  prenom: string
  nom: string
  role: keyof typeof ROLE_LABELS | string
  eventName: string
  event: H3Event
}

async function pseudoLibre(email: string): Promise<string> {
  const base =
    (email.split('@')[0] ?? 'membre')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 30) || 'membre'
  for (let i = 0; ; i++) {
    const candidat = i === 0 ? base : `${base}${i}`
    if (!(await prisma.user.findUnique({ where: { pseudo: candidat }, select: { id: true } }))) {
      return candidat
    }
  }
}

/**
 * Crée un compte en attente pour une personne ajoutée par un organisateur, et l'invite à le
 * réactiver. Contrat d'hôte du layer bénévoles (« créer un bénévole et l'ajouter »).
 *
 * Même mécanique qu'app1 : compte sans mot de passe + jeton `PasswordResetToken`, que la page
 * `/auth/invitation` du layer d'auth consomme. Flowvent n'envoyant pas encore de courriel, le lien
 * est écrit dans les journaux (`📧 EMAIL SIMULÉ`) comme ses autres messages.
 */
export async function createPendingUserAndInvite(params: CreatePendingUserAndInviteParams) {
  const email = sanitizeEmail(params.email)
  const prenom = sanitizeString(params.prenom)!
  const nom = sanitizeString(params.nom)!

  const user = await prisma.user.create({
    data: {
      email,
      emailHash: getEmailHash(email),
      password: null,
      pseudo: await pseudoLibre(email),
      nom,
      prenom,
      authProvider: 'MANUAL',
      isEmailVerified: false,
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

  const token = randomBytes(32).toString('hex')
  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt: createFutureDate(DUREE_INVITATION_MS) },
  })

  const role = ROLE_LABELS[params.role as keyof typeof ROLE_LABELS] ?? params.role
  const lien = `${getSiteUrl()}/auth/invitation?token=${token}`
  await sendEmail({
    to: email,
    subject: `Invitation ${role} — ${params.eventName}`,
    html: `<p>Bonjour ${prenom},</p><p>Un organisateur de ${params.eventName} vous a ajouté comme ${role} sur Flowvent.</p><p><a href="${lien}">Activer mon compte</a> (lien valable 7 jours).</p>`,
    text: `Bonjour ${prenom}, un organisateur de ${params.eventName} vous a ajouté comme ${role} sur Flowvent. Activez votre compte : ${lien} (lien valable 7 jours).`,
  })

  return { user }
}
