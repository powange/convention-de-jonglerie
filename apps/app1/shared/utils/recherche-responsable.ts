import { estAdresseEmail } from './adresse-email'

/**
 * Comment lire ce qui est tapé dans le champ « qui s'en occupe ».
 *
 * Deux recherches cohabitent, et elles n'ont pas la même portée. Une adresse e-mail complète
 * désigne quelqu'un qu'on connaît déjà : elle trouve n'importe quel compte du site, y compris hors
 * de l'édition. Des MOTS-CLÉS, eux, ne cherchent que parmi les gens de l'édition — sans quoi gérer
 * un stock donnerait accès à l'annuaire des comptes.
 *
 * 📍 La seconde recherche s'appelait `pseudo` et ne regardait que ce champ. Elle couvre désormais
 * le pseudo, le prénom et le nom, et accepte plusieurs mots : « Dupont Jean » et « Jean Dupont »
 * trouvent la même personne. Le nom du type suit — `personne` —, parce qu'un discriminant qui dit
 * « pseudo » pour une recherche qui ne l'est plus envoie le prochain lecteur dans le mur.
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

/**
 * Au-delà, on n'affine plus : on tape autre chose.
 *
 * Chaque mot devient un groupe de conditions dans la requête — pseudo OU prénom OU nom —, donc une
 * saisie à rallonge coûterait cher pour un résultat qui ne peut que se vider. Les mots en trop sont
 * ignorés plutôt que refusés : la recherche reste utile, elle est simplement moins stricte que ce
 * qui a été tapé.
 */
export const MOTS_MAXIMUM = 5

export type RechercheResponsable =
  | { type: 'email'; valeur: string }
  | { type: 'personne'; valeur: string }
  | null

/**
 * Les mots d'une recherche de personne.
 *
 * ⚠️ C'EST CE DÉCOUPAGE QUI REND « Dupont Jean » ET « Jean Dupont » ÉQUIVALENTS, et c'était la
 * demande : chaque mot est ensuite confronté au pseudo, au prénom ET au nom, et tous doivent
 * trouver preneur. Chercher la saisie entière dans chaque champ échouerait sur les deux formes,
 * puisqu'aucun champ ne contient « Jean Dupont » à lui seul.
 *
 * Partagé parce que le point d'API construit la requête et que les tests l'éprouvent : deux
 * découpages pour une même saisie donneraient deux résultats, et c'est l'interface qui aurait tort.
 */
export function motsDeRecherche(saisie: string | null | undefined): string[] {
  return (saisie ?? '')
    .split(/\s+/)
    .map((mot) => mot.trim())
    .filter(Boolean)
    .slice(0, MOTS_MAXIMUM)
}

/**
 * La recherche à lancer, ou `null` s'il n'y a rien à chercher.
 *
 * Une saisie qui ressemble à une adresse mais n'en est pas une valable ne bascule pas en recherche
 * par mots-clés : `jean@` n'est le pseudo de personne, et l'appel n'aurait rendu que du vide. C'est
 * la présence d'une arobase qui trahit l'intention, pas la validité de ce qui l'entoure.
 */
export function rechercheResponsable(saisie: string | null | undefined): RechercheResponsable {
  const terme = (saisie ?? '').trim()
  if (!terme) return null

  if (estAdresseEmail(terme)) return { type: 'email', valeur: terme }
  if (terme.includes('@')) return null

  if (terme.length < LONGUEUR_MINIMALE_PSEUDO) return null
  return { type: 'personne', valeur: terme }
}
