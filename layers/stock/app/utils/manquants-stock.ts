/**
 * Ce qui manque à l'échelle de l'édition, tous groupes confondus.
 *
 * Le recomptage se fait groupe par groupe — on ouvre les caisses là où elles sont rangées. Mais la
 * question « qu'est-ce qu'on rachète ? » ne se pose jamais groupe par groupe : elle se pose une
 * fois, pour toute l'édition, et jusqu'ici il fallait ouvrir chaque groupe et faire la somme de
 * tête.
 *
 * ⚠️ La distinction qui porte tout ce fichier : **manquant** et **pas encore compté** ne sont pas
 * la même nouvelle. Un objet non compté n'est pas un objet complet. Les confondre ferait passer
 * une caisse jamais ouverte pour une caisse intacte, et la liste de rachat serait fausse sans que
 * rien ne le signale — exactement le genre d'erreur qu'on ne découvre qu'à l'édition suivante.
 *
 * La règle de l'écart n'est pas réécrite ici : elle vit dans `comptage-stock`, où elle est
 * éprouvée. Ce fichier la lit, il ne la redémontre pas.
 */

import { compteRetenu, ecartComptage, type LigneComptage } from './comptage-stock'

/** Un objet du stock tel que la page transversale le voit : son comptage, et d'où il vient. */
export interface ObjetManquant extends LigneComptage {
  name: string
  /**
   * Le texte libre de la fiche, affiché en infobulle à côté du nom.
   *
   * Facultatif : il ne sert qu'à l'affichage, aucune règle de ce fichier ne le lit, et les
   * articles de liste construits ailleurs n'ont pas à le porter.
   */
  description?: string | null
  /** Le groupe n'est plus la porte d'entrée, seulement une information portée par la ligne. */
  group: { id: number; name: string }
}

/**
 * L'état d'un objet du point de vue du rachat.
 *
 * Trois valeurs, et pas deux. Le surplus rejoint « complet » : il y a là quelque chose à
 * comprendre — un objet rangé dans la mauvaise caisse — mais rien à racheter, et cette page-ci ne
 * parle que de rachat. La séance de comptage du groupe, elle, montre les surplus.
 */
export type EtatRachat = 'manquant' | 'non-compte' | 'complet'

export function etatDeRachat(objet: ObjetManquant): EtatRachat {
  const compte = compteRetenu(objet)
  if (compte === null) return 'non-compte'
  return compte < objet.quantity ? 'manquant' : 'complet'
}

/**
 * Combien d'exemplaires il faut racheter pour cet objet.
 *
 * En positif — on rachète 3 gobelets, on ne rachète pas « -3 ». `null` quand la question ne se
 * pose pas : rien ne manque, ou personne n'a encore compté.
 */
export function quantiteARacheter(objet: ObjetManquant): number | null {
  const ecart = ecartComptage(objet)
  if (ecart === null || ecart >= 0) return null
  return -ecart
}

/**
 * Les objets à racheter, du manque le plus important au plus petit.
 *
 * Trier par quantité manquante et non par nom : on regarde cette page pour décider quoi acheter,
 * et ce qui manque en nombre est ce qui coûtera le plus cher. À manque égal, le nom départage pour
 * que l'ordre ne bouge pas d'un chargement à l'autre.
 */
export function objetsARacheter(objets: ObjetManquant[]): ObjetManquant[] {
  return objets
    .filter((objet) => etatDeRachat(objet) === 'manquant')
    .sort((a, b) => {
      const ecart = (quantiteARacheter(b) ?? 0) - (quantiteARacheter(a) ?? 0)
      return ecart !== 0 ? ecart : a.name.localeCompare(b.name)
    })
}

/**
 * Ce qui n'a pas encore été compté.
 *
 * Affiché à part et non mélangé aux manquants : c'est un rappel de travail à faire, pas une liste
 * d'achats. Trié par groupe puis par nom, parce qu'on va finir de compter caisse par caisse.
 */
export function objetsNonComptes(objets: ObjetManquant[]): ObjetManquant[] {
  return objets
    .filter((objet) => etatDeRachat(objet) === 'non-compte')
    .sort((a, b) => a.group.name.localeCompare(b.group.name) || a.name.localeCompare(b.name))
}

/** Ce que l'en-tête de la page annonce. */
export interface ResumeRachat {
  /** Combien d'objets distincts manquent, au moins partiellement. */
  objetsManquants: number
  /** Combien d'exemplaires il faut racheter en tout. */
  exemplairesARacheter: number
  /** Combien d'objets attendent encore d'être comptés. */
  nonComptes: number
  /** Combien d'objets en tout dans l'édition. */
  total: number
}

/**
 * L'état des lieux du rachat.
 *
 * `nonComptes` figure dans le même résumé que les manquants, délibérément : c'est ce qui dit si la
 * liste de rachat est complète. « 12 exemplaires à racheter » n'a pas le même sens selon qu'il
 * reste 0 ou 40 objets à compter, et lire le premier chiffre sans le second mène à racheter trop
 * tôt.
 */
export function resumeRachat(objets: ObjetManquant[]): ResumeRachat {
  let objetsManquants = 0
  let exemplairesARacheter = 0
  let nonComptes = 0

  for (const objet of objets) {
    const etat = etatDeRachat(objet)
    if (etat === 'non-compte') {
      nonComptes += 1
      continue
    }
    if (etat === 'manquant') {
      objetsManquants += 1
      exemplairesARacheter += quantiteARacheter(objet) ?? 0
    }
  }

  return { objetsManquants, exemplairesARacheter, nonComptes, total: objets.length }
}

/**
 * Cet objet peut-il entrer dans une liste de courses&nbsp;?
 *
 * Seulement s'il manque. Un objet non compté n'a pas d'écart connu, donc pas de quantité à
 * racheter : l'ajouter écrirait une ligne dont personne ne pourrait dire combien en acheter.
 *
 * C'est une conséquence directe du lien vivant retenu pour les articles : la quantité n'est pas
 * recopiée à l'ajout, elle est relue sur l'objet. Sans écart, il n'y a rien à relire.
 */
export function estAjoutableAUneListe(objet: ObjetManquant): boolean {
  return etatDeRachat(objet) === 'manquant'
}
