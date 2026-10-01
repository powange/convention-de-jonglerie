/**
 * Les trois moments d'une édition, et la règle qui dit si deux sélections se rencontrent.
 *
 * ⚠️ LE VOCABULAIRE EST CELUI DES REPAS, délibérément. `VolunteerMeal.phases` stocke déjà
 * `['SETUP', 'EVENT', 'TEARDOWN']` dans une colonne `Json`, et les articles à remettre répondent à
 * la même question : « à quel moment de l'édition cela s'applique-t-il ? ». Deux vocabulaires pour
 * une seule question obligeraient à traduire de l'un vers l'autre à chaque lecture, et finiraient
 * par diverger — c'est le genre d'écart que ce dépôt a déjà payé plusieurs fois.
 *
 * ⚠️⚠️ UNE SÉLECTION VIDE VEUT DIRE « TOUTES LES PHASES ». C'est ce qui rend l'ajout de la colonne
 * sans rattrapage de sens : une association existante, qui n'a jamais eu de phases, continue d'être
 * remise à tout le monde. L'inverse — vide = aucune — aurait silencieusement privé d'articles tous
 * les bénévoles de toutes les éditions, sans erreur et sans trace.
 */

export const PHASES_EDITION = ['SETUP', 'EVENT', 'TEARDOWN'] as const
export type PhaseEdition = (typeof PHASES_EDITION)[number]

/** Ne garde que les phases connues, et supprime les doublons. */
export function normaliserPhases(valeur: unknown): PhaseEdition[] {
  if (!Array.isArray(valeur)) return []
  const connues = new Set<PhaseEdition>()
  for (const element of valeur) {
    if (typeof element !== 'string') continue
    const phase = element.toUpperCase() as PhaseEdition
    if ((PHASES_EDITION as readonly string[]).includes(phase)) connues.add(phase)
  }
  return PHASES_EDITION.filter((phase) => connues.has(phase))
}

/** Les disponibilités déclarées par un bénévole, telles que la candidature les porte. */
export interface DisponibilitesDeclarees {
  eventAvailability?: boolean | null
  setupAvailability?: boolean | null
  teardownAvailability?: boolean | null
}

/**
 * Les phases où ce bénévole est effectivement attendu.
 *
 * ⚠️ `null` COMPTE COMME PRÉSENT à l'événement : la colonne est postérieure à certaines
 * candidatures, et personne n'a posé la question à ces bénévoles-là. C'est la même distinction que
 * `benevolePresentSurPlace` tient côté serveur — `null` veut dire « on ne lui a pas demandé »,
 * `false` veut dire « il a répondu non ».
 */
export function phasesDuBenevole(disponibilites: DisponibilitesDeclarees | null | undefined) {
  const phases: PhaseEdition[] = []
  if (!disponibilites) return phases
  if (disponibilites.setupAvailability === true) phases.push('SETUP')
  if (disponibilites.eventAvailability !== false) phases.push('EVENT')
  if (disponibilites.teardownAvailability === true) phases.push('TEARDOWN')
  return phases
}

/**
 * Cette association concerne-t-elle ce bénévole ?
 *
 * 📍 UN SEUL CHEVAUCHEMENT SUFFIT, et c'est le choix qui compte ici : un article réservé au
 * montage est remis à quelqu'un présent au montage ET à l'événement. Exiger que le bénévole soit
 * présent à TOUTES les phases de l'article serait surprenant — on choisit les phases pour viser
 * une population, pas pour ajouter une condition d'exclusion.
 */
export function phasesSeRencontrent(
  phasesDeLArticle: readonly PhaseEdition[],
  phasesDuBeneficiaire: readonly PhaseEdition[]
): boolean {
  // Vide = toutes les phases : l'article ne restreint rien.
  if (phasesDeLArticle.length === 0) return true
  return phasesDeLArticle.some((phase) => phasesDuBeneficiaire.includes(phase))
}
