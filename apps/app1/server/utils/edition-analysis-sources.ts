/**
 * Les sources d'information supplémentaires d'une édition, pour l'analyse assistée.
 *
 * L'écran `ai-update` propose déjà les liens que l'édition porte dans ses propres champs — site
 * officiel, Facebook, Instagram, billetterie, programme, JugglingEdge. Ce module gère les AUTRES :
 * un article, un PDF d'informations pratiques, une page de programme annexe.
 */

/**
 * Le nombre de sources supplémentaires qu'une édition peut garder.
 *
 * ⚠️ Ce n'est PAS la limite d'URL d'une analyse (voir `MAX_URLS_ANALYSE`). On peut conserver plus
 * de sources qu'on n'en soumet en une fois : une source utile l'an dernier se garde décochée, et
 * se réactive le jour où elle le redevient. Confondre les deux obligerait à supprimer pour
 * respirer, donc à perdre l'adresse.
 */
export const MAX_SOURCES_PAR_EDITION = 20

/** Ce que l'écran reçoit pour chaque source. */
export interface SourceAnalyse {
  id: number
  url: string
  label: string | null
  actif: boolean
}

/**
 * Les sources d'une édition, les actives d'abord.
 *
 * 📍 L'ordre n'est pas cosmétique : ce sont les actives qui partiront à l'analyse, et les voir en
 * tête évite d'en cocher une de plus sans s'apercevoir qu'on dépasse déjà le plafond.
 */
export async function listerSources(editionId: number): Promise<SourceAnalyse[]> {
  return prisma.editionAnalysisSource.findMany({
    where: { editionId },
    orderBy: [{ actif: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, url: true, label: true, actif: true },
  })
}
