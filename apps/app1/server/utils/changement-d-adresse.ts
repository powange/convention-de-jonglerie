import bcrypt from 'bcryptjs'

import { getEmailHash } from '#server/utils/email-hash'
import {
  generateVerificationCode,
  generateVerificationEmailHtml,
  getSiteUrl,
  sendEmail,
} from '#server/utils/emailService'
import { nomDeSalutation } from '#server/utils/nom-de-salutation'

/**
 * Le changement d'adresse de courriel, en deux temps — constat B2.
 *
 * ## Pourquoi un util partagé
 *
 * Trois points d'API en ont besoin : la mise à jour du profil (qui démarre le changement), la
 * confirmation du code, et le renvoi du code. La règle — qui peut demander, ce qu'on vérifie, à qui
 * l'on écrit — ne doit pas être recopiée trois fois : c'est exactement ainsi que ce dépôt a vu
 * diverger « qui gère les bénévoles » et « qui peut modifier un atelier ».
 *
 * ## ⚠️ CE QUI EST ENVOYÉ, ET À QUI
 *
 * Le code part à la NOUVELLE adresse — c'est elle qu'il faut prouver — et un avis part à
 * l'ANCIENNE. Ce second message est la moitié qui protège : si quelqu'un entre dans un compte et
 * change l'adresse, le titulaire l'apprend là où il lit encore son courrier. Sans lui, le vol
 * serait silencieux.
 *
 * ## ⚠️ L'ÉCHEC D'ENVOI N'ANNULE PAS LA DEMANDE
 *
 * La demande est enregistrée avant les envois, et un envoi qui échoue n'est que journalisé : la
 * personne peut redemander un code. Faire l'inverse — annuler la demande parce qu'un serveur de
 * courriel a hoqueté — rendrait le changement impossible pour une raison qu'on ne contrôle pas.
 */

/** Quinze minutes, comme le code d'inscription et celui du renvoi. */
export const DUREE_CODE_ADRESSE_MS = 15 * 60 * 1000

export interface DemandeDeChangement {
  /** L'adresse enregistrée en attente. */
  pendingEmail: string
}

type UtilisateurPourChangement = {
  id: number
  email: string
  password: string | null
  prenom: string | null
  pseudo: string
}

/**
 * Vérifie ce qu'il faut vérifier, enregistre la demande, et prévient les deux adresses.
 *
 * @throws 400 si l'adresse appartient déjà à un autre compte, ou si le mot de passe manque
 * @throws 401 si le mot de passe fourni est faux
 */
export async function demarrerChangementDAdresse(options: {
  userId: number
  nouvelleAdresse: string
  motDePasseFourni?: string
}): Promise<DemandeDeChangement> {
  const { userId, nouvelleAdresse, motDePasseFourni } = options

  const compte = (await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, password: true, prenom: true, pseudo: true },
  })) as UtilisateurPourChangement | null
  if (!compte) {
    throw createError({ status: 404, message: 'Utilisateur non trouvé' })
  }

  /*
   * ⚠️ LE MOT DE PASSE N'EST EXIGÉ QUE SI LE COMPTE EN A UN. Les comptes OAuth n'en ont pas, et
   * leur en réclamer un rendrait le changement d'adresse impossible — c'est la même nuance que
   * `change-password`, qui la porte déjà.
   */
  if (compte.password) {
    if (!motDePasseFourni) {
      throw createError({ status: 400, message: 'Mot de passe actuel requis' })
    }
    const valide = await bcrypt.compare(motDePasseFourni, compte.password)
    if (!valide) {
      throw createError({ status: 401, message: 'Mot de passe actuel incorrect' })
    }
  }

  /*
   * L'adresse est-elle déjà celle d'un autre compte ? La garde existait avant ce lot, et elle
   * reste — mais elle ne porte plus la même conséquence : enregistrer une demande ne RÉSERVE rien,
   * la contrainte d'unicité ne pesant que sur `email`. Le blocage d'inscription que décrivait le
   * constat disparaît donc par construction.
   */
  const dejaPrise = await prisma.user.findUnique({
    where: { email: nouvelleAdresse },
    select: { id: true },
  })
  if (dejaPrise && dejaPrise.id !== userId) {
    throw createError({
      status: 400,
      message: 'Cette adresse email est déjà utilisée par un autre utilisateur',
    })
  }

  const code = generateVerificationCode()
  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmail: nouvelleAdresse,
      pendingEmailCode: code,
      pendingEmailExpiry: new Date(Date.now() + DUREE_CODE_ADRESSE_MS),
    },
  })

  await envoyerLesDeuxMessages({ compte, nouvelleAdresse, code })

  return { pendingEmail: nouvelleAdresse }
}

/** Renvoie un code pour une demande en cours, sans rien changer d'autre. */
export async function renvoyerCodeDeChangement(userId: number): Promise<DemandeDeChangement> {
  const compte = (await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      password: true,
      prenom: true,
      pseudo: true,
      pendingEmail: true,
    },
  })) as (UtilisateurPourChangement & { pendingEmail: string | null }) | null

  if (!compte?.pendingEmail) {
    throw createError({ status: 400, message: 'Aucun changement d’adresse en attente' })
  }

  const code = generateVerificationCode()
  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmailCode: code,
      pendingEmailExpiry: new Date(Date.now() + DUREE_CODE_ADRESSE_MS),
    },
  })

  /*
   * 📍 Le renvoi n'écrit QUE le code et son échéance : réécrire `pendingEmail` avec la même valeur
   * serait sans effet, mais le jour où le champ serait pris d'ailleurs, on l'écraserait sans le
   * vouloir. Et aucun second avis ne part à l'ancienne adresse : elle a déjà été prévenue, et
   * répéter le message à chaque renvoi apprendrait à ne plus le lire.
   */
  await envoyerLesDeuxMessages({ compte, nouvelleAdresse: compte.pendingEmail, code, avis: false })

  return { pendingEmail: compte.pendingEmail }
}

async function envoyerLesDeuxMessages(options: {
  compte: UtilisateurPourChangement
  nouvelleAdresse: string
  code: string
  avis?: boolean
}) {
  const { compte, nouvelleAdresse, code, avis = true } = options
  const prenom = nomDeSalutation(compte)

  // Le code, à la nouvelle adresse : c'est elle qu'il s'agit de prouver.
  try {
    const html = await generateVerificationEmailHtml(code, prenom, nouvelleAdresse)
    await sendEmail({
      to: nouvelleAdresse,
      subject: '🤹 Confirmez votre nouvelle adresse - Conventions de Jonglerie',
      html,
      text: `Bonjour ${prenom}, votre code de confirmation est : ${code}. Saisissez-le dans votre profil sur ${getSiteUrl()}/profile/informations pour valider votre nouvelle adresse.`,
    })
  } catch (erreur) {
    console.warn(`[changement-d-adresse] code non envoyé à ${nouvelleAdresse}`, erreur)
  }

  if (!avis) return

  // L'avis, à l'ancienne : la moitié qui rend un vol de session visible.
  try {
    await sendEmail({
      to: compte.email,
      subject: '🤹 Demande de changement d’adresse - Conventions de Jonglerie',
      html: `<p>Bonjour ${prenom},</p><p>Une demande de changement d'adresse de courriel vient d'être enregistrée sur votre compte, vers <strong>${nouvelleAdresse}</strong>.</p><p>Tant qu'elle n'est pas confirmée depuis cette nouvelle adresse, votre compte continue d'utiliser celle-ci. <strong>Si vous n'êtes pas à l'origine de cette demande, changez votre mot de passe sans attendre</strong> : quelqu'un a peut-être accès à votre session.</p>`,
      text: `Bonjour ${prenom}, une demande de changement d'adresse vers ${nouvelleAdresse} vient d'être enregistrée sur votre compte. Si vous n'en êtes pas à l'origine, changez votre mot de passe sans attendre.`,
    })
  } catch (erreur) {
    console.warn(`[changement-d-adresse] avis non envoyé à ${compte.email}`, erreur)
  }
}

/**
 * Bascule l'adresse si le code est le bon.
 *
 * @throws 400 si aucune demande n'est en cours, si le code est faux ou périmé
 * @throws 409 si l'adresse a été prise entre-temps par un autre compte
 */
export async function confirmerChangementDAdresse(options: {
  userId: number
  code: string
  maintenant?: Date
}): Promise<{ email: string; emailHash: string }> {
  const { userId, code, maintenant = new Date() } = options

  const compte = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, pendingEmail: true, pendingEmailCode: true, pendingEmailExpiry: true },
  })

  if (!compte?.pendingEmail || !compte.pendingEmailCode || !compte.pendingEmailExpiry) {
    throw createError({ status: 400, message: 'Aucun changement d’adresse en attente' })
  }
  if (compte.pendingEmailCode !== code) {
    throw createError({ status: 400, message: 'Code de confirmation invalide' })
  }
  if (compte.pendingEmailExpiry < maintenant) {
    throw createError({ status: 400, message: 'Code de confirmation expiré' })
  }

  /*
   * ⚠️ L'UNICITÉ EST REVÉRIFIÉE ICI, et ce n'est pas une redondance : entre la demande et la
   * confirmation, quelqu'un d'autre a pu s'inscrire avec cette adresse — ou la confirmer avant
   * nous, deux comptes pouvant parfaitement demander la même. Sans ce contrôle, l'écriture
   * échouerait sur la contrainte d'unicité, et un 500 ferait chercher la panne du mauvais côté.
   */
  const dejaPrise = await prisma.user.findUnique({
    where: { email: compte.pendingEmail },
    select: { id: true },
  })
  if (dejaPrise && dejaPrise.id !== userId) {
    throw createError({
      status: 409,
      message: 'Cette adresse email a été prise entre-temps par un autre utilisateur',
    })
  }

  const emailHash = getEmailHash(compte.pendingEmail)
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: compte.pendingEmail,
      // `emailHash` suit l'adresse : c'est lui qui décide du Gravatar affiché.
      emailHash,
      pendingEmail: null,
      pendingEmailCode: null,
      pendingEmailExpiry: null,
    },
  })

  return { email: compte.pendingEmail, emailHash }
}
