/**
 * Qui a droit au même repas à plusieurs titres.
 *
 * Une même personne peut être bénévole, artiste et organisatrice sur la même édition, et chacun de
 * ces trois titres lui ouvre les repas séparément. Elle ressort alors plusieurs fois de la liste
 * des participants, compte plusieurs fois dans le total transmis à la cuisine, et réclame autant de
 * validations au guichet. Ce n'est pas un défaut : les trois droits existent bel et bien en base,
 * et **on ne les dédoublonne pas automatiquement** — choisir sous quelle entité enregistrer la
 * consommation n'a pas de bonne réponse. C'est à la personne en charge des repas de trancher, cas
 * par cas ; ce module lui donne de quoi voir ce qu'elle tranche.
 *
 * Mesuré sur la base de développement : 179 repas en doublon sur 2 094, mais **15 personnes
 * seulement**. Une personne en doublon l'est sur presque tous ses repas — 22 sur 22, 10 sur 10 —
 * parce qu'un organisateur a droit à TOUS les repas par défaut. D'où le regroupement par personne
 * plutôt que par repas : 15 lignes au lieu de 179, et une seule décision à prendre par personne.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Le titre auquel une personne mange. La billetterie en est absente, et c'est délibéré :
 * un billet ne porte qu'une adresse de courriel, jamais d'identifiant de compte — le rapprochement
 * serait une comparaison de chaînes, et rien ne permettrait ensuite de retirer le droit. */
export type SourceDeRepas = 'volunteer' | 'artist' | 'organizer'

/** Un droit à un repas, et de quoi le retirer. */
export interface DroitAuRepas {
  source: SourceDeRepas
  mealId: number
  userId: number
  /**
   * L'identifiant de la ligne de rôle — `EditionVolunteerApplication.id`, `EditionArtist.id` ou
   * `EditionOrganizer.id` selon la source. C'est lui que l'URL d'écriture attend, jamais
   * l'identifiant du compte : les confondre viserait quelqu'un d'autre sans rien signaler.
   */
  roleId: number
  /**
   * L'identifiant de la sélection, ou `null` pour un organisateur.
   *
   * Le droit d'un organisateur n'est pas matérialisé : il a tous les repas de l'édition, et seules
   * les exceptions (`accepted = false`) sont stockées. Il n'y a donc souvent aucune ligne à
   * désigner — l'écriture se fait par `mealId`.
   */
  selectionId: number | null
}

/** Un repas qu'une personne touche à plusieurs titres. */
export interface RepasEnDoublon {
  mealId: number
  /** Les droits en concurrence, au moins deux, de sources toutes différentes. */
  droits: DroitAuRepas[]
}

/** Une personne et ses repas en doublon. */
export interface PersonneEnDoublon {
  userId: number
  /** Les sources en cause, dans l'ordre où elles apparaissent ci-dessous. */
  sources: SourceDeRepas[]
  repas: RepasEnDoublon[]
}

/** L'ordre d'affichage des sources, pour que deux lignes se lisent pareil. */
const ORDRE_DES_SOURCES: readonly SourceDeRepas[] = ['organizer', 'volunteer', 'artist']

const rangDeLaSource = (source: SourceDeRepas): number => {
  const rang = ORDRE_DES_SOURCES.indexOf(source)
  return rang === -1 ? ORDRE_DES_SOURCES.length : rang
}

/**
 * Les personnes touchant un même repas à plus d'un titre.
 *
 * `ordreDesRepas` donne l'ordre d'affichage (les repas de l'édition, du plus ancien au plus
 * récent). Trier sur `mealId` s'en approcherait le plus souvent sans jamais le garantir : rien
 * n'oblige les identifiants à suivre les dates, et un repas ajouté après coup se rangerait au bout.
 *
 * Un repas ne compte comme doublon qu'à partir de **deux sources distinctes**. Deux lignes d'une
 * même source sur un même repas ne devraient pas exister — une contrainte d'unicité l'interdit sur
 * les trois modèles — et n'ont de toute façon rien à faire ici : ce que l'écran donne à arbitrer,
 * c'est un cumul de rôles.
 */
export function personnesEnDoublon(
  droits: readonly DroitAuRepas[],
  ordreDesRepas: readonly number[]
): PersonneEnDoublon[] {
  const rangDuRepas = new Map(ordreDesRepas.map((mealId, rang) => [mealId, rang]))

  // Regroupement par personne PUIS par repas, en une passe.
  const parPersonne = new Map<number, Map<number, DroitAuRepas[]>>()
  for (const droit of droits) {
    const repasDeLaPersonne = parPersonne.get(droit.userId) ?? new Map<number, DroitAuRepas[]>()
    parPersonne.set(droit.userId, repasDeLaPersonne)
    const droitsDuRepas = repasDeLaPersonne.get(droit.mealId) ?? []
    droitsDuRepas.push(droit)
    repasDeLaPersonne.set(droit.mealId, droitsDuRepas)
  }

  const personnes: PersonneEnDoublon[] = []

  for (const [userId, repasDeLaPersonne] of parPersonne) {
    const repas: RepasEnDoublon[] = []

    for (const [mealId, droitsDuRepas] of repasDeLaPersonne) {
      const sources = new Set(droitsDuRepas.map((droit) => droit.source))
      if (sources.size < 2) continue
      repas.push({
        mealId,
        droits: [...droitsDuRepas].sort(
          (a, b) => rangDeLaSource(a.source) - rangDeLaSource(b.source)
        ),
      })
    }

    if (repas.length === 0) continue

    repas.sort(
      (a, b) =>
        (rangDuRepas.get(a.mealId) ?? Number.MAX_SAFE_INTEGER) -
        (rangDuRepas.get(b.mealId) ?? Number.MAX_SAFE_INTEGER)
    )

    const sources = new Set<SourceDeRepas>()
    for (const unRepas of repas) {
      for (const droit of unRepas.droits) sources.add(droit.source)
    }

    personnes.push({
      userId,
      sources: [...sources].sort((a, b) => rangDeLaSource(a) - rangDeLaSource(b)),
      repas,
    })
  }

  return personnes
}

/**
 * Les droits d'une personne pour une source donnée, sur tous ses repas en doublon.
 *
 * C'est la matière de l'action de tête de ligne — « retirer tous ses repas côté bénévole ». Elle
 * existe parce que le cas général est le cumul total : traiter repas par repas demanderait jusqu'à
 * vingt-deux clics là où le geste réel en vaut un.
 */
export function droitsDeLaSource(
  personne: PersonneEnDoublon,
  source: SourceDeRepas
): DroitAuRepas[] {
  return personne.repas.flatMap((unRepas) =>
    unRepas.droits.filter((droit) => droit.source === source)
  )
}
