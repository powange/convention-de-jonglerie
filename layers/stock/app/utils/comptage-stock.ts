/**
 * L'inventaire de fin d'édition : ce qu'on a compté, et ce qui manque.
 *
 * Le champ existait déjà sur chaque objet, mais il se saisissait fiche par fiche — alors que
 * compter est une séance : on ouvre les caisses les unes après les autres, on note, et l'on ne
 * veut pas de trente allers-retours entre une liste et un formulaire.
 *
 * La règle vit ici et non dans l'écran parce que c'est elle qui décide de ce qu'on lit : ce qui
 * manque, ce qui est en trop, et surtout ce qui n'a pas encore été compté. Cette dernière
 * distinction est la plus facile à perdre, et la plus coûteuse — une caisse oubliée qui passerait
 * pour une caisse vide, c'est du matériel qu'on croit perdu.
 */

/** Un objet à compter, tel que la séance le voit. */
export interface LigneComptage {
  id: number
  /** La quantité théorique, celle que l'inventaire annonce. */
  quantity: number
  /** Ce qui est déjà enregistré. `null` = jamais compté. */
  finalQuantity: number | null
  /**
   * Ce que la séance en cours a saisi.
   *
   * Trois valeurs, et il en faut bien trois : `undefined` — la ligne n'a pas été touchée ;
   * `null` — la case a été vidée, on efface le comptage ; un nombre — le compte du jour.
   * Réduire à deux ferait passer un effacement pour une absence de saisie.
   */
  saisie?: number | null
}

/**
 * Ce qui fait foi pour une ligne : la saisie du jour si elle existe, sinon l'enregistré.
 *
 * `null` quand rien n'a jamais été compté — et non zéro. Zéro veut dire « la caisse est vide »,
 * ce qui n'est pas la même nouvelle que « personne n'y a encore regardé ».
 */
export function compteRetenu(ligne: LigneComptage): number | null {
  return ligne.saisie !== undefined ? ligne.saisie : ligne.finalQuantity
}

/**
 * L'écart entre ce qu'on a compté et ce qu'on attendait.
 *
 * Négatif, il manque ; positif, il y en a plus que prévu — un objet rangé dans la mauvaise caisse,
 * ce qui arrive. `null` tant que la ligne n'a pas été comptée, pour que l'écran n'affiche rien
 * plutôt qu'un zéro trompeur.
 */
export function ecartComptage(ligne: LigneComptage): number | null {
  const compte = compteRetenu(ligne)
  if (compte === null) return null
  return compte - ligne.quantity
}

/** L'état d'avancement d'une séance. */
export interface ResumeComptage {
  /** Combien d'objets ont un compte, saisi ou déjà enregistré. */
  comptes: number
  /** Combien d'objets en tout. */
  total: number
  /** Le nombre d'exemplaires manquants, en positif. */
  manquants: number
  /** Le nombre d'exemplaires en trop. */
  surplus: number
}

/**
 * Où en est la séance.
 *
 * Manquants et surplus sont comptés à part, et ne se compensent pas : deux enceintes perdues et
 * trois praticables en trop ne font pas « +1 ». Ce sont deux nouvelles différentes, l'une
 * inquiétante et l'autre curieuse, et les additionner les effacerait toutes les deux.
 */
export function resumeComptage(lignes: LigneComptage[]): ResumeComptage {
  let comptes = 0
  let manquants = 0
  let surplus = 0

  for (const ligne of lignes) {
    const ecart = ecartComptage(ligne)
    if (ecart === null) continue
    comptes += 1
    if (ecart < 0) manquants += -ecart
    else surplus += ecart
  }

  return { comptes, total: lignes.length, manquants, surplus }
}

/** Ce qu'une ligne enverra au serveur. */
export interface ComptageAEnvoyer {
  id: number
  /** `null` efface le comptage : la ligne redevient « jamais comptée ». */
  finalQuantity: number | null
}

/**
 * Ce qu'il y a réellement à écrire.
 *
 * Seules les lignes touchées **et** modifiées : réécrire trente valeurs identiques ferait passer
 * une séance de relecture pour une séance de comptage, et gonflerait une transaction sans raison.
 *
 * Vider une case y figure — c'est ainsi qu'on efface un comptage enregistré par erreur, et
 * l'absence de valeur doit donc voyager jusqu'au serveur.
 */
export function comptagesAEnvoyer(lignes: LigneComptage[]): ComptageAEnvoyer[] {
  return lignes
    .filter((ligne) => ligne.saisie !== undefined && ligne.saisie !== ligne.finalQuantity)
    .map((ligne) => ({ id: ligne.id, finalQuantity: ligne.saisie ?? null }))
}

/** Combien de saisies attendent d'être enregistrées. Ce que la barre annonce. */
export function nombreEnAttente(lignes: LigneComptage[]): number {
  return comptagesAEnvoyer(lignes).length
}
