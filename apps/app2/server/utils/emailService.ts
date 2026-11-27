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
import { gabaritCourriel } from '../../shared/gabarit-courriel'

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
 * Courriel de vérification de compte : le code à recopier, et le lien vers la page de saisie.
 */
export async function generateVerificationEmailHtml(
  code: string,
  prenom: string,
  email: string
): Promise<string> {
  const siteUrl = getSiteUrl()
  return gabaritCourriel({
    siteUrl,
    titre: 'Vérifiez votre adresse e-mail',
    apercu: `Votre code de vérification Flowvent : ${code}`,
    salutation: `Bonjour ${prenom}`,
    paragraphes: ['Bienvenue sur Flowvent ! Pour activer votre compte, saisissez ce code :'],
    code,
    bouton: {
      libelle: 'Vérifier mon compte',
      url: `${siteUrl}/verify-email?email=${encodeURIComponent(email)}`,
    },
    note: 'Ce code est valable 15 minutes.',
    raison: 'Vous recevez ce courriel car un compte Flowvent vient d’être créé avec cette adresse.',
  })
}

/**
 * Courriel de réinitialisation du mot de passe.
 */
export async function generatePasswordResetEmailHtml(
  resetLink: string,
  prenom: string
): Promise<string> {
  return gabaritCourriel({
    siteUrl: getSiteUrl(),
    titre: 'Réinitialisez votre mot de passe',
    apercu: 'Le lien pour choisir un nouveau mot de passe Flowvent.',
    salutation: `Bonjour ${prenom}`,
    paragraphes: [
      'Vous avez demandé à réinitialiser le mot de passe de votre compte Flowvent. Choisissez-en un nouveau avec le bouton ci-dessous.',
    ],
    bouton: { libelle: 'Choisir un nouveau mot de passe', url: resetLink },
    note: 'Ce lien est valable 1 heure. Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel : votre mot de passe ne change pas.',
  })
}

const MOMENTS = { MORNING: 'matin', AFTERNOON: 'après-midi', EVENING: 'soir' } as const

/**
 * Courriel « vos créneaux de bénévolat » (contrat d'hôte du layer bénévoles, même signature
 * qu'app1), dans le gabarit des courriels de Flowvent (shared/gabarit-courriel.ts).
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
  const lignes = timeSlots.map((c) => {
    const jour = c.date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    const heures = c.startTime && c.endTime ? ` · ${c.startTime}–${c.endTime}` : ''
    return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} (${MOMENTS[c.timeOfDay]})${heures} — ${c.teamName}`
  })
  return gabaritCourriel({
    siteUrl: getSiteUrl(),
    titre: 'Vos créneaux de bénévolat',
    apercu: `Votre planning de bénévole pour « ${editionName} ».`,
    salutation: `Bonjour ${prenom}`,
    paragraphes: [`Voici vos créneaux de bénévolat pour « ${editionName} » :`],
    liste: lignes,
    bouton: { libelle: 'Voir mes créneaux', url: actionUrl },
    raison: `Vous recevez ce courriel car vous êtes bénévole sur « ${editionName} ».`,
  })
}
