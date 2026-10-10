import { translateServerSide } from './server-i18n'

/**
 * L'habillage d'un courriel : tout ce qui entoure le message et n'en fait pas partie.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE (constat F3)
 *
 * Le titre et le message d'une notification étaient traduits dans la langue de la personne, mais
 * le gabarit restait français : `<Html lang="fr">`, « Bonjour », « L'équipe de Juggling
 * Convention », « Gérer mes notifications », « Cet email a été envoyé automatiquement ». Un
 * anglophone recevait donc un **courriel bilingue** — son contenu dans sa langue, son emballage
 * dans la nôtre.
 *
 * ## ⚠️⚠️ POURQUOI UN `.ts` ET NON DES `translateServerSide` DANS LE GABARIT
 *
 * `scripts/check-i18n.js` scanne `server/**\/*.ts` mais **pas** `server/**\/*.vue` : les gabarits de
 * courriel sont un angle mort de l'outillage. Des clés référencées depuis `BaseEmail.vue`
 * passeraient donc pour **inutilisées**, et la prochaine passe de nettoyage les supprimerait — le
 * courriel rendrait alors ses propres clés en guise de texte, sans erreur. Les clés vivent ici,
 * dans un fichier que l'outillage lit.
 */

/** Les chaînes de l'emballage, résolues une fois pour un courriel donné. */
export interface HabillageDeCourriel {
  /** L'attribut `lang` du document : il décide de la langue de la synthèse vocale et du correcteur. */
  lang: string
  signature: string
  gererNotifications: string
  soutenirLeProjet: string
  envoiAutomatique: string
}

/** Le chemin des préférences de notification — ce que « Gérer mes notifications » doit ouvrir. */
export const CHEMIN_DES_PREFERENCES = '/profile/notifications'

/**
 * L'habillage dans une langue donnée.
 *
 * `fr` par défaut, et ce défaut compte : six des sept gabarits de courriel du dépôt n'ont pas
 * encore de langue à passer — leurs appelants ne connaissent pas celle du destinataire (une
 * inscription n'a pas encore de compte). Ils gardent donc l'emballage français, comme avant, et le
 * jour où ils porteront une langue il n'y aura rien d'autre à faire que la passer.
 */
export function habillageDeCourriel(locale = 'fr'): HabillageDeCourriel {
  return {
    lang: locale,
    signature: translateServerSide('notifications.email.signature', {}, locale),
    gererNotifications: translateServerSide('notifications.email.manage_notifications', {}, locale),
    soutenirLeProjet: translateServerSide('notifications.email.support_project', {}, locale),
    envoiAutomatique: translateServerSide('notifications.email.automatic', {}, locale),
  }
}

/** La salutation, à part : c'est la seule chaîne de l'emballage qui porte un paramètre. */
export function salutationDeCourriel(prenom: string, locale = 'fr'): string {
  return translateServerSide('notifications.email.greeting', { prenom }, locale)
}

/**
 * La version TEXTE d'un courriel de notification.
 *
 * ⚠️ Elle était le message nu : ni salutation, ni lien d'action. Les clients qui n'affichent pas
 * le HTML — et les filtres anti-pourriel, qui la lisent pour juger — n'y voyaient donc **aucun
 * moyen d'agir**. Le bouton existait uniquement dans la version HTML.
 *
 * L'URL est reconstruite en ABSOLU : un `/editions/7` relatif ne mène nulle part dans un courriel.
 */
export function texteDeCourriel(options: {
  prenom: string
  message: string
  baseUrl: string
  actionUrl?: string
  actionText?: string
  locale?: string
}): string {
  const { prenom, message, baseUrl, actionUrl, actionText, locale = 'fr' } = options
  const habillage = habillageDeCourriel(locale)

  const lignes = [salutationDeCourriel(prenom, locale), '', message]

  if (actionUrl) {
    const lien = actionUrl.startsWith('http') ? actionUrl : `${baseUrl}${actionUrl}`
    lignes.push('', actionText ? `${actionText} : ${lien}` : lien)
  }

  lignes.push('', habillage.signature, '', habillage.envoiAutomatique)
  lignes.push(`${habillage.gererNotifications} : ${baseUrl}${CHEMIN_DES_PREFERENCES}`)

  return lignes.join('\n')
}
