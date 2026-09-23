import { texteImprimable } from '~~/shared/utils/texte-imprimable'

/**
 * Ce qui part dans le PDF des artistes.
 *
 * Le tableau exporté est celui qu'on a sous les yeux : les artistes **filtrés**, dans les
 * **colonnes affichées**, et dans leur ordre à l'écran. Exporter autre chose que ce qui est
 * montré est le meilleur moyen de faire circuler un document que personne ne sait relire.
 *
 * La mise en forme des cellules reste à la page — elle dépend des traductions et de fonctions
 * qui savent lire un artiste. Ce module ne décide que de la structure, et c'est elle qu'on
 * éprouve : un PDF ne se rattrape pas une fois envoyé.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/**
 * Colonnes qui n'ont aucun sens dans un fichier, quel qu'en soit le format.
 *
 * « Actions » ne porte que des boutons. Sur papier, cela donne une colonne vide, large, qui
 * pousse les autres hors de la page ; dans un tableur, une colonne de cellules vides qu'on
 * finit par supprimer à la main.
 */
export const COLONNES_SANS_SENS_A_EXPORTER = ['actions']

/**
 * Colonnes dont les retours à la ligne sont VOULUS.
 *
 * Les repas s'écrivent un par ligne : « vendredi soir » et « samedi midi » l'un sous l'autre se
 * lisent d'un coup d'œil, là où une énumération séparée par des virgules se déchiffre.
 *
 * Partout ailleurs les retours sont aplatis : une note d'organisateur sur cinq lignes étirerait
 * la ligne du tableau au point de la rendre illisible, et ce n'est jamais délibéré.
 */
export const COLONNES_MULTILIGNES = ['meals']

/** Une colonne retenue pour l'impression : son identifiant, et son en-tête lisible. */
export interface ColonneImprimable {
  id: string
  entete: string
}

/** Le tableau prêt à être remis à `autoTable`. */
export interface TableauDArtistes {
  entetes: string[]
  lignes: string[][]
}

/**
 * Les colonnes à imprimer, dans l'ordre du tableau.
 *
 * On part des identifiants **visibles** tels que la table les donne, et non de la liste complète :
 * masquer une colonne à l'écran doit la retirer du fichier, c'est tout l'intérêt du bouton.
 */
export function colonnesImprimables(
  idsVisibles: string[],
  entete: (id: string) => string
): ColonneImprimable[] {
  return idsVisibles
    .filter((id) => !COLONNES_SANS_SENS_A_EXPORTER.includes(id))
    .map((id) => ({ id, entete: entete(id) }))
}

/**
 * Le tableau à imprimer : en-têtes, puis une ligne par artiste.
 *
 * `valeur` est fournie par la page, seule à savoir traduire une cellule — un nombre de repas
 * acceptés, un état de facture, un type d'hébergement. Ce module se contente de l'appeler pour
 * chaque croisement, et de nettoyer ce qu'elle rend.
 */
export function preparerTableauDArtistes<A>(
  artistes: A[],
  colonnes: ColonneImprimable[],
  valeur: (artiste: A, colonneId: string) => string | null | undefined
): TableauDArtistes {
  return {
    entetes: colonnes.map((colonne) => texteImprimable(colonne.entete)),
    lignes: artistes.map((artiste) =>
      colonnes.map((colonne) =>
        texteImprimable(valeur(artiste, colonne.id), {
          multiligne: COLONNES_MULTILIGNES.includes(colonne.id),
        })
      )
    ),
  }
}

/** Une sélection de repas, réduite à ce dont l'impression a besoin. */
export interface RepasChoisi {
  accepted: boolean
  meal?: { date?: string | Date | null; mealType?: string | null } | null
}

/**
 * La journée nue `AAAA-MM-JJ` d'un repas, sans conversion de fuseau.
 *
 * ⚠️ `VolunteerMeal.date` est une colonne `@db.Date` : une journée, pas un instant. Sérialisée en
 * JSON elle prend pourtant la forme `2026-10-02T00:00:00.000Z`, et la traiter comme un instant la
 * ferait basculer au 1er octobre pour tout lecteur à l'ouest de Greenwich. On en retient donc les
 * dix premiers caractères, et `formaterJournee` ne convertit jamais une journée nue.
 */
export function journeeNueDuRepas(date: string | Date | null | undefined): string {
  if (!date) return ''
  const texte = date instanceof Date ? date.toISOString() : String(date)
  const journee = texte.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(journee) ? journee : ''
}

/**
 * Les repas d'un artiste, nommés et un par ligne — « vendredi soir », puis « samedi midi ».
 *
 * À l'écran, la colonne affiche un compteur (« 2/3 ») qui ouvre le détail d'un clic. Sur papier,
 * ce compteur ne dit rien : personne ne peut cliquer, et c'est précisément la liste qu'on emporte
 * en cuisine.
 *
 * Seuls les repas **acceptés** figurent : les autres n'ont pas été attribués.
 *
 * `jour` et `moment` viennent de la page, qui seule connaît la locale, le fuseau de l'édition et
 * les traductions.
 */
export function texteDesRepas(
  selections: RepasChoisi[] | null | undefined,
  jour: (journee: string) => string,
  moment: (mealType: string) => string
): string {
  if (!selections || selections.length === 0) return ''

  return selections
    .filter((selection) => selection.accepted)
    .map((selection) => {
      const journee = journeeNueDuRepas(selection.meal?.date)
      const libelles = [jour(journee), moment(selection.meal?.mealType ?? '')]
        .map((morceau) => (morceau ?? '').trim())
        .filter(Boolean)
      return libelles.join(' ')
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * Le nom du fichier, daté.
 *
 * Daté, et c'est le point : cet export se refait à mesure que la distribution se complète, et
 * trois fichiers homonymes dans un dossier de téléchargements ne se distinguent plus. Les accents
 * et les espaces tombent, pour un nom que tous les systèmes acceptent.
 *
 * ⚠️ Composé morceau par morceau plutôt qu'écrit d'une pièce : une chaîne pointée littérale se
 * fait prendre pour une clé de traduction par l'analyse i18n, qui la signale alors comme
 * manquante. Le module stock, puis la trésorerie, ont déjà buté là-dessus.
 */
export function nomFichierArtistes(nomEdition: string | null | undefined, date: Date): string {
  const jour = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

  const edition = (nomEdition ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  const morceaux = ['artistes', edition, jour].filter(Boolean)
  return `${morceaux.join('-')}.pdf`
}
