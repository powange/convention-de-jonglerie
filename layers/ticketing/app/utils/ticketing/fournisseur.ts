import helloAssoLogo from '~/assets/img/helloasso/logo.svg'
import infomaniakLogo from '~/assets/img/infomaniak/logo.svg'

/**
 * D'où vient un tarif, une commande — et comment le montrer.
 *
 * Écrit ici plutôt que dans chaque écran qui pose la question. La table vivait dans la page des
 * commandes ; la page des quotas en avait besoin à son tour, et la recopier aurait créé deux
 * vérités : le jour où un fournisseur s'ajoute, l'un des deux écrans l'ignorerait sans rien dire.
 */
const logosParFournisseur: Record<string, string> = {
  HELLOASSO: helloAssoLogo,
  INFOMANIAK: infomaniakLogo,
}

/**
 * Le logo du site, pour ce qui n'a pas d'origine extérieure.
 *
 * Chemin public et non import : le fichier vit dans `public/`, il est servi tel quel.
 */
const LOGO_DU_SITE = '/logos/logo-jc.svg'

/** Le nom du fournisseur tel qu'il s'écrit, plutôt que la constante de la base. */
const nomsDeFournisseur: Record<string, string> = {
  HELLOASSO: 'HelloAsso',
  INFOMANIAK: 'Infomaniak',
  BILLETWEB: 'Billetweb',
  WEEZEVENT: 'Weezevent',
}

/**
 * Le logo à afficher pour cette provenance.
 *
 * **Il y en a toujours un** : celui du fournisseur, ou celui du site quand l'élément a été saisi
 * ici. Une image manquante romprait l'alignement de la liste, et l'absence d'origine se lirait
 * comme une origine inconnue — alors qu'elle veut dire « créé sur le site ».
 */
export function logoDuFournisseur(provider?: string | null): string {
  return (provider && logosParFournisseur[provider]) || LOGO_DU_SITE
}

/** Le nom lisible d'un fournisseur, ou `null` quand l'élément vient du site. */
export function nomDuFournisseur(provider?: string | null): string | null {
  if (!provider) return null
  return nomsDeFournisseur[provider] ?? provider
}
