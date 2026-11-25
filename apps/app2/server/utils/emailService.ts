// Service d'envoi de courriels de Flowvent.
//
// - `sendEmail` passe par le TRANSPORT commun avec app1 (`layers/core/server/socle/envoi-courriel.ts`) :
//   simulation (journal) tant que SEND_EMAILS n'est pas `true`, sinon SMTP (SMTP_HOST/PORT/USER/PASS,
//   SMTP_FROM, SMTP_BCC). Rien ne part vers un domaine de test (`.test`, `example.com`…).
// - Les gabarits (`generate*EmailHtml`) restent ceux, sobres, de Flowvent.
import { randomInt } from 'node:crypto'

import {
  envoyerCourriel,
  type EmailOptions,
} from '../../../../layers/core/server/socle/envoi-courriel'

export type { EmailOptions } from '../../../../layers/core/server/socle/envoi-courriel'

/**
 * URL publique du site : runtimeConfig.public.siteUrl, sinon NUXT_PUBLIC_SITE_URL,
 * sinon localhost.
 */
/**
 * Nom de l'application dans les sujets des courriels du layer d'auth, et sa signature : chaque
 * application fournit les siens (le layer les lit par `#server/utils/emailService`).
 */
export const NOM_DU_SITE = 'Flowvent'
export const SIGNATURE_COURRIEL = "L'équipe Flowvent"

export function getSiteUrl(): string {
  const config = useRuntimeConfig()
  const publicConfig = config.public as Record<string, any>
  return publicConfig?.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

/** Envoi d'un courriel, au nom de « Flowvent ». Ne lève jamais : `false` si l'envoi a échoué. */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  return envoyerCourriel(options, { nomExpediteur: 'Flowvent' })
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

const MOMENTS = { MORNING: 'matin', AFTERNOON: 'après-midi', EVENING: 'soir' } as const

/**
 * Courriel « vos créneaux de bénévolat » (contrat d'hôte du layer bénévoles, même signature
 * qu'app1). Version sobre : Flowvent n'a pas les gabarits de courriel d'app1.
 */
export async function generateVolunteerScheduleEmailHtml(
  prenom: string,
  _conventionName: string,
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
  const lignes = timeSlots
    .map((c) => {
      const jour = c.date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      const heures = c.startTime && c.endTime ? ` ${c.startTime}–${c.endTime}` : ''
      return `<li>${jour} (${MOMENTS[c.timeOfDay]})${heures} — ${c.teamName}</li>`
    })
    .join('')
  return `<div>
  <p>Bonjour ${prenom},</p>
  <p>Vos créneaux de bénévolat pour « ${editionName} » :</p>
  <ul>${lignes}</ul>
  <p><a href="${actionUrl}">Voir mes créneaux</a></p>
</div>`
}
