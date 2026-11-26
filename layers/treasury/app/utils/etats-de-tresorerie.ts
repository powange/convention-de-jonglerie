/**
 * Les ÉTATS d'une ligne de trésorerie, et le filtre qui les retient.
 *
 * Deux états, et ce ne sont pas des catégories mais des signalements : une ligne avancée dit que
 * l'association doit de l'argent à quelqu'un, une ligne prévisionnelle dit qu'un montant est
 * engagé sans être réglé. On les cherche quand on veut savoir ce qui reste à faire.
 *
 * Partie PURE : c'est elle qui décide, et c'est donc elle qui se teste. L'écran ne fait que la
 * brancher sur un sélecteur.
 */

/** Les états qu'on peut retenir. Les valeurs voyagent dans l'URL : les garder courtes et stables. */
export const ETATS_DE_TRESORERIE = ['avancee', 'previsionnelle'] as const

export type EtatDeTresorerie = (typeof ETATS_DE_TRESORERIE)[number]

/** Le minimum qu'une ligne doit porter pour qu'on puisse juger de ses états. */
export interface LigneJugeable {
  isForecast?: boolean
  advancedBy?: { id: number } | null
  advancedByName?: string | null
}

/**
 * Cette ligne a-t-elle été avancée par quelqu'un ?
 *
 * ⚠️ LES DEUX CHAMPS, et c'est la seule subtilité : l'avance se porte soit sur un COMPTE
 * (`advancedBy`), soit sur un NOM SAISI LIBREMENT (`advancedByName`) pour les gens qui ne sont pas
 * inscrits. Ils sont exclusifs — le serveur efface l'un dès que l'autre est posé — mais ne lire
 * que le premier perdrait silencieusement toutes les avances de la seconde sorte, qui sont
 * nombreuses sur une convention.
 */
export function estAvancee(ligne: LigneJugeable): boolean {
  return Boolean(ligne.advancedBy || ligne.advancedByName)
}

/** Cette ligne est-elle prévisionnelle — engagée, pas encore réglée ? */
export function estPrevisionnelle(ligne: LigneJugeable): boolean {
  return ligne.isForecast === true
}

/**
 * La ligne passe-t-elle le filtre d'états ?
 *
 * **Sélection vide = tout**, comme le filtre des codes juste à côté : un filtre qu'on n'a pas posé
 * ne retire rien.
 *
 * **Plusieurs états = OU**, et non ET. Retenir « avancées » et « prévisionnelles » montre tout ce
 * qui réclame une suite, ce qui est la question qu'on se pose. L'intersection — les lignes à la
 * fois avancées ET prévisionnelles — est un cas rare dont on ne voit pas l'usage, et qui serait de
 * toute façon visible en ne cochant qu'un état puis l'autre.
 *
 * 📍 Conséquence assumée : filtrer sur un état masque TOUTES les lignes calculées — artistes,
 * billetterie —, qui n'ont ni avance ni prévision par nature. C'est ce qu'on veut en cherchant ce
 * qui reste à régler, mais il faut le savoir avant de s'étonner d'une liste courte.
 */
export function correspondAuxEtats(ligne: LigneJugeable, etats: readonly string[]): boolean {
  if (!etats.length) return true

  return etats.some((etat) => {
    if (etat === 'avancee') return estAvancee(ligne)
    if (etat === 'previsionnelle') return estPrevisionnelle(ligne)
    // Un état inconnu — une URL bricolée, un code retiré depuis — ne retient rien plutôt que de
    // tout retenir : un filtre illisible ne doit pas se lire comme « pas de filtre ».
    return false
  })
}
