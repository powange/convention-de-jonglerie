/**
 * Ce qu'il faut montrer du champ `prismaDetails` d'un log d'erreur.
 *
 * Ce champ est le plus utile au diagnostic d'un 500 de base de données — il porte le code Prisma,
 * les métadonnées, et le message MySQL d'origine. Il était pourtant collecté, stocké, renvoyé par
 * l'endpoint de détail… et affiché nulle part : la sélection de la liste l'écartait derrière un
 * « TODO: Activer après migration en production » périmé, recopié deux fois.
 *
 * ⚠️ La colonne porte DEUX contenus sans rapport, et c'est la raison d'être de ce fichier.
 *
 *   - Les erreurs de base de données y mettent `{ code, meta, sqlMessage, sqlState }`.
 *   - Les clés de traduction manquantes (`i18n/missing-keys.post.ts`) s'en servent comme d'un sac
 *     à métadonnées : `{ locales, occurrences, lastPath }`. Rien à voir avec Prisma, malgré le nom
 *     de la colonne.
 *
 * Rendre l'un comme l'autre en JSON brut obligerait à décoder à l'œil un objet dont la forme
 * change selon la ligne. On distingue donc les deux, et on étiquette ce qu'on sait nommer.
 *
 * Le discriminant est `errorType`, et non la présence de telle ou telle clé : c'est lui qui décide
 * à l'écriture, et se fier à la forme reviendrait à deviner ce que la donnée dit déjà.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Le type d'erreur que pose `i18n/missing-keys.post.ts` sur les lignes qu'il écrit. */
export const TYPE_CLE_I18N_MANQUANTE = 'I18nMissingKey'

/** Une paire prête à afficher : une étiquette lisible, une valeur déjà mise en forme. */
export interface LigneDeDetail {
  cle: string
  valeur: string
}

export interface DetailsTechniques {
  /** D'où vient ce contenu, donc comment le lire. */
  forme: 'prisma' | 'i18n' | 'inconnue'
  /** Les champs qu'on sait nommer, dans l'ordre où ils servent au diagnostic. */
  lignes: LigneDeDetail[]
  /**
   * Ce qui reste après les lignes nommées, à montrer en JSON.
   *
   * `null` quand il n'y a rien de plus : un bloc JSON vide sous des lignes déjà lisibles n'apporte
   * que du bruit. `meta` de Prisma atterrit ici, parce que sa forme dépend du code d'erreur et
   * qu'aucune étiquette fixe ne la décrirait honnêtement.
   */
  reste: Record<string, unknown> | null
}

/** Les étiquettes des champs Prisma, dans l'ordre d'utilité pour un diagnostic. */
const CHAMPS_PRISMA: Array<[string, string]> = [
  ['code', 'Code Prisma'],
  ['sqlState', 'État SQL'],
  ['sqlMessage', 'Message SQL'],
]

/** Idem pour le sac à métadonnées des clés i18n. */
const CHAMPS_I18N: Array<[string, string]> = [
  ['occurrences', 'Occurrences'],
  ['locales', 'Langues'],
  ['lastPath', 'Dernière page'],
]

/** Une valeur scalaire rendue lisible ; les tableaux sont joints plutôt que crochetés. */
function enTexte(valeur: unknown): string {
  if (Array.isArray(valeur)) return valeur.map((element) => String(element)).join(', ')
  return String(valeur)
}

/**
 * Faut-il montrer quelque chose&nbsp;? La plupart des logs n'ont pas de détail technique — la
 * colonne n'est alimentée que pour les erreurs de base de données et les clés i18n.
 */
export function aDesDetailsTechniques(details: unknown): boolean {
  return (
    details !== null &&
    typeof details === 'object' &&
    !Array.isArray(details) &&
    Object.keys(details as Record<string, unknown>).length > 0
  )
}

/**
 * Décompose le champ en ce que l'écran doit rendre.
 *
 * Les champs inconnus ne sont jamais perdus : ils retombent dans `reste`. Une forme non reconnue —
 * un troisième usage de la colonne qu'on n'aurait pas vu venir — s'affiche donc entièrement, en
 * JSON, plutôt que de disparaître en silence.
 */
export function detailsTechniques(
  errorType: string | null | undefined,
  details: unknown
): DetailsTechniques | null {
  if (!aDesDetailsTechniques(details)) return null

  const source = details as Record<string, unknown>
  const estI18n = errorType === TYPE_CLE_I18N_MANQUANTE
  const champs = estI18n ? CHAMPS_I18N : CHAMPS_PRISMA

  const lignes: LigneDeDetail[] = []
  for (const [cle, etiquette] of champs) {
    const valeur = source[cle]
    // `0` et `false` sont des valeurs qui comptent : on n'écarte que l'absence et le vide.
    if (valeur === undefined || valeur === null || valeur === '') continue
    lignes.push({ cle: etiquette, valeur: enTexte(valeur) })
  }

  const nommes = new Set(champs.map(([cle]) => cle))
  const reste: Record<string, unknown> = {}
  for (const [cle, valeur] of Object.entries(source)) if (!nommes.has(cle)) reste[cle] = valeur

  return {
    forme: estI18n ? 'i18n' : lignes.length > 0 ? 'prisma' : 'inconnue',
    lignes,
    reste: Object.keys(reste).length > 0 ? reste : null,
  }
}
