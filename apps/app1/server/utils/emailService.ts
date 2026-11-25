// Service d'envoi d'emails avec support simulation/réel
import { randomInt } from 'node:crypto'

import { render } from '@vue-email/render'

import {
  envoyerCourriel,
  type EmailOptions,
} from '../../../../layers/core/server/socle/envoi-courriel'
import AccountDeletionEmail from '../emails/AccountDeletionEmail.vue'
import InvitationEmail from '../emails/InvitationEmail.vue'
import NotificationEmail from '../emails/NotificationEmail.vue'
import PasswordResetEmail from '../emails/PasswordResetEmail.vue'
import VerificationEmail from '../emails/VerificationEmail.vue'
import VolunteerScheduleEmail from '../emails/VolunteerScheduleEmail.vue'

// Le type vit avec le transport commun (envoi-courriel.ts).
export type { EmailOptions } from '../../../../layers/core/server/socle/envoi-courriel'

/**
 * Nom de l'application dans les sujets des courriels du layer d'auth, et sa signature : chaque
 * application fournit les siens (le layer les lit par `#server/utils/emailService`).
 */
export const NOM_DU_SITE = 'Conventions de Jonglerie'
export const SIGNATURE_COURRIEL = "L'équipe des Conventions de Jonglerie"

export function getSiteUrl(): string {
  const config = useRuntimeConfig()
  return config.public.siteUrl || 'http://localhost:3000'
}

/**
 * Envoi d'un courriel : le transport est commun avec Flowvent
 * (`layers/core/server/socle/envoi-courriel.ts`) ; app1 n'y ajoute que son nom d'expéditeur.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  return envoyerCourriel(options, { nomExpediteur: 'Juggling Convention' })
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
  actionText?: string,
  locale = 'fr'
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
      locale,
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
 * Génère l'email d'invitation (artiste/bénévole ajouté manuellement).
 * Contient un lien vers la page d'activation où la personne définit son mot de passe.
 */
export async function generateInvitationEmailHtml(
  invitationLink: string,
  prenom: string,
  roleLabel: string,
  eventName: string
): Promise<string> {
  const baseUrl = getSiteUrl()

  const html = await render(
    InvitationEmail,
    {
      prenom,
      invitationLink,
      baseUrl,
      roleLabel,
      eventName,
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
