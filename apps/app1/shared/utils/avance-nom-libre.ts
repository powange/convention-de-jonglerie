/**
 * Rapprocher les avances faites par une même personne SANS COMPTE.
 *
 * Une avance portée par un compte se regroupe par son identifiant : rien d'ambigu. Saisie en texte
 * libre, il n'y a que le nom — et deux écritures du même nom doivent former une seule dette, sans
 * quoi le panneau « avances à rembourser » afficherait deux lignes pour la même personne et le
 * bouton de remboursement n'en solderait qu'une.
 *
 * La règle vit ici, et nulle part ailleurs : le calcul de l'agrégat et le remboursement en lot
 * doivent retenir EXACTEMENT les mêmes lignes. Les voir divergées, c'est verser une somme puis
 * découvrir qu'il reste des lignes ouvertes.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/**
 * La clé de regroupement d'un nom saisi librement, ou `null` s'il ne désigne personne.
 *
 * Minuscules, sans accents, espaces réduits : « Jean-Luc », « jean-luc » et « Jean-Luc  » sont la
 * même personne. En revanche « Jean Luc » sans tiret reste distinct — on ne devine pas la
 * ponctuation d'un nom, et fusionner deux orthographes réellement différentes inventerait un
 * rapprochement que personne n'a demandé.
 */
export function cleDuNomAvance(nom: string | null | undefined): string | null {
  const reduit = (nom ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  return reduit.length > 0 ? reduit : null
}

/**
 * Le nom tel qu'on l'enregistre : espaces réduits, casse et accents PRÉSERVÉS.
 *
 * On regroupe sans la casse mais on affiche ce que la personne a tapé. Normaliser à l'écriture
 * ferait apparaître « jean-luc » dans un tableau que quelqu'un relit — le regroupement est une
 * affaire interne, il n'a pas à abîmer le nom de quelqu'un.
 */
export function nomAvanceAEnregistrer(nom: string | null | undefined): string | null {
  const propre = (nom ?? '').replace(/\s+/g, ' ').trim()
  return propre.length > 0 ? propre : null
}
