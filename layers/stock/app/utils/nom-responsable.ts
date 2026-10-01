/**
 * Comment nommer la personne qui s'occupe d'un matériel.
 *
 * ⚠️ LES ÉCRANS DU STOCK N'AFFICHAIENT QUE LE PSEUDO, et c'était la demande de l'utilisateur :
 * « difficile de différencier qui est qui quand on ne connaît pas tout le monde sur l'événement ».
 * Deux pseudos proches — ou un pseudo qui ne ressemble pas au nom de son porteur — ne désignent
 * personne pour qui organise une tournée de récupération.
 *
 * ⚠️⚠️ POURQUOI UN SEUL ENDROIT. Ce libellé apparaît sur quatre surfaces : la liste déroulante de
 * recherche, la fiche d'un objet, le tableau des emprunts et la page des récupérations. La
 * recherche le composait déjà à sa façon (`pseudo (Prénom Nom)`) tandis que les trois autres
 * n'affichaient que le pseudo : on CHERCHAIT donc quelqu'un sous un nom qui ne s'affichait ensuite
 * nulle part. Deux façons de nommer la même personne, et c'est le genre d'écart que ce dépôt a payé
 * assez souvent pour ne pas le reproduire.
 */

/** Ce qu'il faut d'un compte pour le nommer. Tout est facultatif sauf le pseudo. */
export interface PersonneNommable {
  pseudo: string
  prenom?: string | null
  nom?: string | null
}

/**
 * Prénom et nom, dans cet ordre, quand ils sont renseignés.
 *
 * Rendue séparément parce que certaines surfaces veulent les deux lignes distinctes — un pseudo en
 * gras et l'état civil en dessous — plutôt qu'une seule chaîne.
 */
export function etatCivil(personne: PersonneNommable | null | undefined): string {
  if (!personne) return ''
  return [personne.prenom, personne.nom].filter(Boolean).join(' ').trim()
}

/**
 * Le pseudo suivi de l'état civil entre parenthèses, ou le pseudo seul.
 *
 * 📍 LE PSEUDO RESTE EN TÊTE, et ce n'est pas arbitraire : c'est lui qu'on a cherché, lui qui
 * figure dans la liste déroulante, et lui qui est toujours renseigné. Le prénom et le nom sont
 * FACULTATIFS sur un compte — beaucoup n'en ont pas —, donc en faire le libellé principal
 * donnerait une colonne à moitié vide.
 */
export function libelleResponsable(personne: PersonneNommable | null | undefined): string {
  if (!personne?.pseudo) return ''
  const civil = etatCivil(personne)
  return civil ? `${personne.pseudo} (${civil})` : personne.pseudo
}
