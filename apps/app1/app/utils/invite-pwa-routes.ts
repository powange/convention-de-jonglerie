/**
 * Où l'on ne propose PAS d'installer l'application.
 *
 * ⚠️ POURQUOI CE CRITÈRE EXISTE. L'invitation s'affichait cinq secondes après l'événement
 * `beforeinstallprompt`, dans une MODALE, par-dessus n'importe quelle page. Les cinq secondes sont
 * précisément le temps qu'il faut pour commencer à remplir un formulaire : la modale surgissait
 * au milieu d'une candidature de bénévole, d'un profil en cours d'édition — ou, au guichet,
 * pendant un scan de billets, où elle prenait le focus entre deux QR codes.
 *
 * Le bandeau qui la remplace ne bloque plus rien, mais une invitation reste une interruption :
 * sur ces écrans-là, on n'en veut pas du tout.
 *
 * La fonction est PURE et prend le chemin en argument : elle se vérifie sans monter de composant
 * ni simuler de routeur, et c'est elle qui porte la décision.
 */

/**
 * Motifs d'écrans de saisie ou d'opération, où l'invitation ne s'affiche jamais.
 *
 * Écrit en motifs plutôt qu'en liste exhaustive : les routes de gestion se comptent par dizaines
 * et une nouvelle ne doit pas hériter du défaut par oubli.
 */
const CHEMINS_SANS_INVITE: RegExp[] = [
  /*
   * Toute la gestion d'une édition. Ce sont des écrans de travail, presque tous porteurs d'un
   * formulaire — et c'est aussi ce qui couvre le contrôle d'accès
   * (`/gestion/ticketing/access-control`), où l'on scanne des billets à la chaîne.
   */
  /\/gestion(\/|$)/,

  // Candidature de bénévole : un formulaire long, qu'on ne veut pas voir interrompu.
  /\/volunteers(\/|$)/,

  // Candidature à un appel à spectacles.
  /\/shows-call\/[^/]+\/apply(\/|$)/,

  // Tout l'espace profil : informations, mot de passe, candidatures, préférences.
  /\/profile(\/|$)/,
]

/**
 * L'invitation à installer l'application est-elle permise sur ce chemin ?
 *
 * Le préfixe de langue éventuel est retiré avant comparaison : la stratégie i18n du projet est
 * `no_prefix`, mais s'y fier sans le dire rendrait ce critère muet le jour où elle changerait —
 * et un bandeau qui réapparaît sur les formulaires ne se signale pas comme une régression.
 */
export function invitePwaAutorisee(chemin: string): boolean {
  if (!chemin) return false

  const sansPrefixeDeLangue = chemin.replace(/^\/[a-z]{2}(-[A-Z]{2})?(?=\/|$)/, '') || '/'

  return !CHEMINS_SANS_INVITE.some((motif) => motif.test(sansPrefixeDeLangue))
}
