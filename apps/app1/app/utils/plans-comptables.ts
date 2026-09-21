/**
 * Plans comptables de référence, proposés à l'import dans les codes d'imputation d'une
 * convention.
 *
 * Ces plans ne vivent PAS en base : ce sont des données réglementaires, identiques pour tout le
 * monde et qui ne changent qu'au rythme des règlements. Un fichier JSON par plan, dans
 * `app/assets/plans-comptables/`. Ajouter un pays revient donc à déposer un fichier — rien à
 * migrer, rien à enregistrer, et aucun risque de voir deux conventions diverger sur ce qui est
 * censé être une référence commune.
 *
 * Le chargement est différé : la modale ne sert qu'à qui la demande, et ces fichiers n'ont pas à
 * peser sur le premier rendu de la page de trésorerie.
 */

/** Un compte du plan, éventuellement porteur de sous-comptes. */
export interface CompteDuPlan {
  code: string
  libelle: string
  /** Précision réglementaire à afficher au survol ou sous le libellé, quand elle existe. */
  note?: string
  enfants?: CompteDuPlan[]
}

export interface PlanComptable {
  id: string
  /** Code ISO du pays, pour regrouper les plans quand il y en aura d'autres. */
  pays: string
  nom: string
  sousTitre?: string
  /** Texte réglementaire dont ce plan est tiré. Affiché en pied de modale. */
  reference: string
  source?: string
  /** Mise en garde propre au plan, affichée en tête. */
  avertissement?: string
  /** Identifiant d'un autre plan que celui-ci complète plutôt que de le remplacer. */
  complementDe?: string
  racines: CompteDuPlan[]
}

/**
 * Les fichiers de plans, non chargés.
 *
 * `import.meta.glob` est résolu à la compilation : déposer un nouveau JSON dans le dossier
 * suffit à le faire apparaître, sans toucher à cette liste.
 */
const fichiers = import.meta.glob<{ default: PlanComptable }>('../assets/plans-comptables/*.json')

let cache: PlanComptable[] | null = null

/**
 * Charge tous les plans disponibles, une seule fois par session de navigation.
 *
 * L'ordre suit celui des noms de fichiers, qui est stable : `fr-associations` avant `fr-pcg`.
 * On remet donc le plan général en tête, car c'est lui qui porte la structure complète — un plan
 * qui se dit « complément » d'un autre n'a de sens qu'après lui.
 */
export async function chargerPlansComptables(): Promise<PlanComptable[]> {
  if (cache) return cache

  const charges = await Promise.all(Object.values(fichiers).map((charger) => charger()))
  const plans = charges.map((module) => module.default)

  cache = plans.sort((a, b) => {
    if (!!a.complementDe === !!b.complementDe) return a.nom.localeCompare(b.nom, 'fr')
    return a.complementDe ? 1 : -1
  })
  return cache
}

/** Remet le cache à zéro. Réservé aux tests. */
export function reinitialiserCachePlans(): void {
  cache = null
}

/** Compare deux textes sans se soucier des accents ni de la casse. */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Filtre un arbre de comptes sur une recherche libre.
 *
 * Un compte est retenu s'il correspond lui-même, **ou** si l'un de ses descendants correspond :
 * chercher « bénévole » doit faire apparaître 75412 sans que la personne ait à savoir qu'il se
 * range sous 754 puis 7541. Les branches conservées le sont avec leurs parents, sans quoi on
 * afficherait des codes hors de leur contexte — et le contexte est précisément ce qui permet de
 * choisir le bon.
 *
 * Une correspondance sur le code est cherchée sans séparateur : taper « 62 57 » trouve 6257.
 */
export function filtrerComptes(comptes: CompteDuPlan[], recherche: string): CompteDuPlan[] {
  const terme = normaliser(recherche).trim()
  if (!terme) return comptes

  const termeCode = terme.replace(/\s+/g, '')

  const retenir = (compte: CompteDuPlan): CompteDuPlan | null => {
    const enfantsRetenus = (compte.enfants ?? [])
      .map(retenir)
      .filter((enfant): enfant is CompteDuPlan => enfant !== null)

    const correspond =
      compte.code.startsWith(termeCode) || normaliser(compte.libelle).includes(terme)

    if (!correspond && enfantsRetenus.length === 0) return null

    // Un compte qui correspond lui-même garde TOUS ses enfants : on a trouvé la bonne branche,
    // il faut pouvoir la parcourir. Sinon, seuls les enfants qui correspondent sont conservés.
    return { ...compte, enfants: correspond ? compte.enfants : enfantsRetenus }
  }

  return comptes.map(retenir).filter((compte): compte is CompteDuPlan => compte !== null)
}

/** Nombre de comptes d'un arbre, sous-comptes compris. */
export function compterComptes(comptes: CompteDuPlan[]): number {
  return comptes.reduce((total, compte) => total + 1 + compterComptes(compte.enfants ?? []), 0)
}
