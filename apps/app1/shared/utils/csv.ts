/**
 * Écrire un fichier CSV qu'un tableur ouvre sans le trahir.
 *
 * Trois pièges, et aucun ne se voit à la relecture du code — ils ne se découvrent qu'en ouvrant
 * le fichier, souvent chez quelqu'un d'autre, souvent trop tard.
 *
 * 1. **L'encodage.** Déclarer `charset=utf-8` dans l'en-tête HTTP ne suffit pas : Excel sous
 *    Windows l'ignore pour un fichier `.csv` et lit en ANSI. « Prénom » devient « PrÃ©nom » sur
 *    toute la colonne. Seule la marque d'ordre des octets en tête de fichier le détrompe.
 *
 * 2. **L'échappement.** Une virgule, un guillemet ou un retour à la ligne dans une valeur
 *    décalent toutes les colonnes suivantes. Un champ libre — une motivation, des allergies — en
 *    contient tôt ou tard.
 *
 * 3. **L'injection de formule.** Une cellule qui commence par `=` est exécutée à l'ouverture.
 *    C'est du texte saisi par un utilisateur qui devient une instruction chez l'organisateur.
 *
 * ⚠️ Ce fichier ne doit RIEN importer : il est chargé tel quel par les tests unitaires, hors
 * Nuxt, et lu des deux côtés.
 */

/**
 * La marque d'ordre des octets, à placer en TÊTE du fichier.
 *
 * Sans elle, l'en-tête `charset=utf-8` ne suffit pas à Excel : c'est le seul indice qu'il
 * regarde pour un `.csv`.
 */
export const BOM_UTF8 = '﻿'

/** Fin de ligne du format, telle que la RFC 4180 la fixe. */
const FIN_DE_LIGNE = '\r\n'

/**
 * Cette valeur serait-elle interprétée comme une FORMULE ?
 *
 * La règle est plus fine qu'un simple « commence par `=`, `+`, `-` ou `@` », et c'est une mesure
 * qui l'a imposée : sur les 202 numéros de téléphone en base, **144 commencent par `+`**, quand
 * **aucun** champ libre ne commence par un caractère à risque. Préfixer aveuglément aurait donc
 * marqué 71 % d'une colonne réelle pour parer un danger jamais observé.
 *
 * Ce qui reste dangereux après affinage :
 * - `=` et `@` en tête, qui ouvrent une formule ou un nom de fonction ;
 * - `+` ou `-` suivis d'autre chose qu'un numéro — `+HYPERLINK(…)` s'exécute, `+33 6 12 34 56 78`
 *   n'est qu'un nombre.
 *
 * Une tabulation ou un retour chariot en tête sont également écartés : certains tableurs les
 * consomment et découvrent le caractère suivant.
 */
export function ressembleAUneFormule(valeur: string): boolean {
  if (valeur.length === 0) return false

  const premier = valeur[0]!
  if (premier === '=' || premier === '@' || premier === '\t' || premier === '\r') return true

  if (premier === '+' || premier === '-') {
    // Ce qui suit un signe : chiffres, espaces, points, parenthèses et tirets font un numéro de
    // téléphone ou un nombre négatif. Tout le reste — une lettre, une parenthèse ouvrante après
    // des lettres — fait une formule.
    return !/^[+-][\d\s.()/-]*$/.test(valeur)
  }

  return false
}

/**
 * Une valeur, prête à être posée dans une cellule.
 *
 * ⚠️ **TOUJOURS entre guillemets, même quand ce n'est pas requis — et ce n'est plus seulement
 * une question de lisibilité du code.**
 *
 * Un tableur devine le type d'une cellule d'après son contenu : `+33612345678` et `0612345678`
 * sont des nombres parfaitement valides, et il les affiche `33612345678` et `612345678` — le
 * signe et le zéro initial disparaissent. Constaté sur l'export des organisateurs, et vérifié
 * dans LibreOffice : l'apostrophe de tête, qui sert de marqueur « texte » dans Excel, s'y
 * affiche **en clair** et ne répare rien.
 *
 * Ce qui répare, sans toucher aux données : l'option « Formater le champ entre guillemets comme
 * du texte » de la boîte d'import. Elle ne fonctionne que parce que **chaque** cellule est
 * entourée de guillemets — y compris celles qui n'en auraient pas besoin. Ne pas « optimiser »
 * ce point : cela casserait le réglage des utilisateurs sans rien signaler.
 *
 * `null` et `undefined` deviennent une cellule vide — et non « null », qui se retrouverait tel
 * quel dans le tableur.
 */
export function celluleCsv(valeur: unknown): string {
  const texte = valeur === null || valeur === undefined ? '' : String(valeur)

  // L'apostrophe de tête est le marqueur « texte » des tableurs : Excel ne l'affiche pas, et la
  // cellule cesse d'être une formule. C'est le prix le plus faible pour neutraliser l'injection.
  const sur = ressembleAUneFormule(texte) ? `'${texte}` : texte

  return `"${sur.replace(/"/g, '""')}"`
}

/**
 * Le fichier entier : marque d'ordre des octets, en-têtes, puis les lignes.
 *
 * Les en-têtes passent par le même échappement que les cellules. Ils n'en avaient pas besoin
 * jusqu'ici — aucun libellé ne contenait de virgule —, et c'est exactement le genre de chose qui
 * tient par chance jusqu'au jour où quelqu'un traduit une colonne.
 */
export function versCsv(entetes: readonly string[], lignes: readonly unknown[][]): string {
  const toutes = [entetes, ...lignes].map((ligne) => ligne.map(celluleCsv).join(','))
  return BOM_UTF8 + toutes.join(FIN_DE_LIGNE)
}

/**
 * Le nom d'un fichier téléchargé, débarrassé de ce qui pourrait sortir du dossier ou casser
 * l'en-tête `Content-Disposition`.
 */
export function nomDeFichierCsv(base: string): string {
  const propre = [...base]
    // Les caractères de contrôle sont écartés par leur CODE et non par une classe de regex :
    // écrite en clair, celle-ci se confond avec les regex accidentellement dangereuses, et
    // l'outillage la refuse — à raison, puisqu'elle est presque toujours involontaire.
    .map((c) => (c.codePointAt(0)! < 0x20 ? '-' : c))
    .join('')
    .replace(/[/\\:*?"<>|]/g, '-')
    // Les séquences de points disparaissent : sans les séparateurs, elles ne peuvent plus
    // remonter d'un dossier, mais « ..-..-etc-passwd.csv » reste un nom que personne ne veut
    // voir arriver dans ses téléchargements.
    .replace(/\.{2,}/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return `${propre || 'export'}.csv`
}
