import {
  brouillonValide,
  champsRestituables,
  cleBrouillon,
  type BrouillonEnregistre,
} from '~~/shared/utils/brouillon-candidature'

/**
 * Conserve la saisie en cours d'une candidature, pour la rendre telle quelle au retour.
 *
 * Le brouillon vit dans le navigateur et n'est jamais transmis : il ne sert qu'à réparer un
 * départ involontaire — retour arrière, onglet fermé, téléphone verrouillé.
 */
export function useBrouillonCandidature(
  editionId: number,
  userId: () => number | null | undefined
) {
  const cle = () => cleBrouillon(editionId, userId())

  const lire = (): BrouillonEnregistre | null => {
    if (!import.meta.client) return null
    try {
      const brut = localStorage.getItem(cle())
      if (!brut) return null

      const brouillon = JSON.parse(brut)
      if (!brouillonValide(brouillon)) {
        // Périmé ou illisible : on le retire au passage plutôt que de le relire indéfiniment.
        localStorage.removeItem(cle())
        return null
      }
      return brouillon
    } catch {
      // Stockage refusé, quota atteint, JSON corrompu : perdre un brouillon est sans gravité,
      // faire échouer l'ouverture du formulaire ne le serait pas.
      return null
    }
  }

  const enregistrer = (donnees: Record<string, unknown>) => {
    if (!import.meta.client) return
    try {
      const brouillon: BrouillonEnregistre = {
        enregistreLe: new Date().toISOString(),
        donnees,
      }
      localStorage.setItem(cle(), JSON.stringify(brouillon))
    } catch {
      // Voir ci-dessus : l'échec d'écriture ne doit pas remonter à l'utilisateur, qui n'a rien
      // demandé et ne pourrait rien y faire.
    }
  }

  const effacer = () => {
    if (!import.meta.client) return
    try {
      localStorage.removeItem(cle())
    } catch {
      // Idem.
    }
  }

  /**
   * Les champs du brouillon que le formulaire sait encore accueillir, ou `null`.
   *
   * `reference` sert de gabarit : un champ disparu du formulaire, ou dont le type a changé, n'est
   * pas restitué.
   */
  const restaurer = <T extends Record<string, unknown>>(reference: T): Partial<T> | null => {
    const brouillon = lire()
    if (!brouillon) return null

    const champs = champsRestituables(brouillon.donnees, reference)
    return Object.keys(champs).length > 0 ? champs : null
  }

  return { restaurer, enregistrer, effacer }
}
