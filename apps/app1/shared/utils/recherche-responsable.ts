import { estAdresseEmail } from './adresse-email'

/**
 * Comment lire ce qui est tapé dans le champ « qui s'en occupe ».
 *
 * Deux recherches cohabitent, et elles n'ont pas la même portée. Une adresse e-mail complète
 * désigne quelqu'un qu'on connaît déjà : elle trouve n'importe quel compte du site, y compris hors
 * de l'édition. Un pseudo, lui, ne cherche que parmi les gens de l'édition — sans quoi gérer un
 * stock donnerait accès à l'annuaire des comptes.
 *
 * Le partage se fait ici plutôt que dans le composant : c'est la règle qui décide de la portée
 * d'une recherche, et l'écran qui la déclenche demande une session d'organisateur qu'un test ne
 * peut pas obtenir.
 */

/**
 * En deçà, la recherche ne discrimine rien et ramènerait la moitié de l'édition.
 *
 * Le seuil vit ici, et le point d'API l'applique depuis ce même endroit : deux copies d'un même
 * nombre finissent par diverger, et c'est alors l'interface qui promet ce que le serveur refuse.
 */
export const LONGUEUR_MINIMALE_PSEUDO = 2

export type RechercheResponsable =
  | { type: 'email'; valeur: string }
  | { type: 'pseudo'; valeur: string }
  | null

/**
 * La recherche à lancer, ou `null` s'il n'y a rien à chercher.
 *
 * Une saisie qui ressemble à une adresse mais n'en est pas une valable ne bascule pas en recherche
 * de pseudo : `jean@` n'est le pseudo de personne, et l'appel n'aurait rendu que du vide. C'est la
 * présence d'une arobase qui trahit l'intention, pas la validité de ce qui l'entoure.
 */
export function rechercheResponsable(saisie: string | null | undefined): RechercheResponsable {
  const terme = (saisie ?? '').trim()
  if (!terme) return null

  if (estAdresseEmail(terme)) return { type: 'email', valeur: terme }
  if (terme.includes('@')) return null

  if (terme.length < LONGUEUR_MINIMALE_PSEUDO) return null
  return { type: 'pseudo', valeur: terme }
}
