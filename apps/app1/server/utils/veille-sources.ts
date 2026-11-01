import { sourceJugglingEdge } from './jugglingedge-scraper'

import type { SourceEvenements } from './sources-evenements'

/**
 * Les sources d'événements connues de la veille.
 *
 * Un seul endroit à modifier pour en accueillir une nouvelle : l'écran, les points d'API et le
 * rapprochement des URL lisent tous cette liste. C'est ce qui fait que la page d'administration
 * n'est pas « la page JugglingEdge ».
 *
 * 📍 Ce fichier existe séparément du contrat (`sources-evenements.ts`) parce que le contrat ne doit
 * dépendre d'aucune implémentation — sans quoi la deuxième source devrait importer depuis la
 * première, ce qui est exactement l'enchevêtrement qu'on veut éviter.
 */
export const SOURCES: readonly SourceEvenements[] = [sourceJugglingEdge]

/** La source portant cette clé, ou `null` — une clé inconnue n'est pas une erreur, c'est un filtre. */
export function sourceParCle(cle: string): SourceEvenements | null {
  return SOURCES.find((source) => source.cle === cle) ?? null
}

/**
 * La clé de rapprochement d'une URL, par la première source qui la reconnaît.
 *
 * Rend `null` quand aucune source ne la reconnaît : c'est le cas courant pour les URL d'origine
 * d'une édition — un événement Facebook, un site officiel — et ce n'est pas une anomalie.
 */
export function cleDeRapprochement(url: string): string | null {
  for (const source of SOURCES) {
    const cle = source.cleDeRapprochement(url)
    if (cle) return cle
  }
  return null
}
