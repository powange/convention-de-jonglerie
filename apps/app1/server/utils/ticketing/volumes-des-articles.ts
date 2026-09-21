import { aggregateHandoutItems, type HandoutItemAssociation } from './handout-items'

/**
 * Combien d'exemplaires de chaque article il faut prévoir, et combien sont déjà sortis.
 *
 * Deux écrans posent la même question sous deux angles : « combien de tee-shirts commander »
 * six semaines avant, et « qui n'a pas encore récupéré le sien » pendant l'événement. C'est le
 * même calcul ; seul le filtre change. Il vit donc ici une fois, plutôt qu'à deux endroits qui
 * dériveraient.
 *
 * **Ce qui est sorti se lit sur la validation d'entrée.** Décision du 21/09/2026 : dès qu'un
 * billet est validé, les articles qui lui étaient associés sont réputés remis, quelle que soit
 * la population. Rien n'enregistre la remise ailleurs, et rien ne le fera — la liste à cocher du
 * guichet est informative. Un article ajouté à un tarif *après* une validation sera donc compté
 * comme remis sans l'avoir été : c'est le prix assumé de déduire la remise de l'association.
 *
 * **Le total n'est jamais une somme d'associations.** Un article non cumulable n'est remis
 * qu'une fois par personne quel que soit le nombre d'associations. C'est pourquoi le cumul se
 * fait *par personne d'abord* — via `aggregateHandoutItems`, qui porte cette règle —, et
 * seulement ensuite sur l'édition. Une agrégation directe par article compterait trop, sans rien
 * signaler : le guichet a déjà commis ce défaut et affichait deux fois le même bracelet.
 */

/** Les quatre populations qui franchissent une entrée, et qui reçoivent donc des articles. */
export const POPULATIONS = ['participants', 'benevoles', 'artistes', 'organisateurs'] as const

export type Population = (typeof POPULATIONS)[number]

/**
 * Les associations d'un bénévole.
 *
 * ⚠️ **Surcharge, et non cumul** : dès qu'une des équipes du bénévole porte au moins un article,
 * elle *remplace* les articles globaux — elle ne s'y ajoute pas. Une équipe sans article retombe
 * sur le global. Les trois autres populations, elles, cumulent le global et le nominatif : cette
 * asymétrie est celle du code existant, elle est reproduite telle quelle et non arbitrée ici.
 *
 * Les repas s'ajoutent toujours, quelle que soit la branche retenue : un ticket de cantine est un
 * article comme un autre, et il ne dépend pas de l'équipe.
 */
export function associationsDunBenevole(params: {
  globales: HandoutItemAssociation[]
  parEquipe: Map<string, HandoutItemAssociation[]>
  equipes: string[]
  repas?: HandoutItemAssociation[]
}): HandoutItemAssociation[] {
  const desEquipes = params.equipes.flatMap((id) => params.parEquipe.get(id) ?? [])
  const retenues = desEquipes.length > 0 ? desEquipes : params.globales
  return [...retenues, ...(params.repas ?? [])]
}

/**
 * Les associations d'un organisateur : le global, le nominatif et les repas s'additionnent.
 *
 * Le cumul est sans danger ici : `aggregateHandoutItems` retient la plus grande quantité pour un
 * article non cumulable, si bien qu'un article donné à la fois globalement et nommément n'est
 * remis qu'une fois.
 */
export function associationsDunOrganisateur(params: {
  globales: HandoutItemAssociation[]
  nommees?: HandoutItemAssociation[]
  repas?: HandoutItemAssociation[]
}): HandoutItemAssociation[] {
  return [...params.globales, ...(params.nommees ?? []), ...(params.repas ?? [])]
}

/**
 * Les associations d'un artiste : quatre sources s'additionnent — tous les artistes de
 * l'édition, cet artiste en particulier, chacun de ses spectacles, et ses repas.
 *
 * C'est le cas qui a fait naître le drapeau `cumulative` : un artiste jouant dans deux spectacles
 * reçoit deux tickets boisson, mais un seul bracelet.
 */
export function associationsDunArtiste(params: {
  globales: HandoutItemAssociation[]
  nommees?: HandoutItemAssociation[]
  spectacles?: HandoutItemAssociation[]
  repas?: HandoutItemAssociation[]
}): HandoutItemAssociation[] {
  return [
    ...params.globales,
    ...(params.nommees ?? []),
    ...(params.spectacles ?? []),
    ...(params.repas ?? []),
  ]
}

/** Une personne attendue, ses articles déjà agrégés, et le fait que son entrée soit validée. */
export interface PersonneComptee {
  /**
   * Unique **dans sa population seulement** : une ligne de commande et un artiste peuvent porter
   * le même entier. C'est `cle` qui identifie une personne d'un bout à l'autre de l'édition.
   */
  id: number
  nom: string
  population: Population
  /** Vaut « ses articles ont été remis ». Voir l'en-tête du module. */
  entreeValidee: boolean
  articles: Array<{ id: number; name: string; quantity: number }>
}

/** Une personne qui n'a pas encore récupéré un article donné. */
export interface PersonneEnAttente {
  /** `population:id` — voir `PersonneComptee.id` pour la raison. */
  cle: string
  id: number
  nom: string
  population: Population
  /** Combien d'exemplaires lui reviennent. */
  quantity: number
}

/** Ce qu'un article représente en volume, pour l'édition entière. */
export interface VolumeDunArticle {
  id: number
  name: string
  /** Ce qu'il faut avoir : toutes les personnes attendues. */
  attendu: number
  /** Ce qui est déjà sorti : les personnes dont l'entrée est validée. */
  sorti: number
  /** `attendu - sorti`, jamais négatif. */
  reste: number
  /** La décomposition, sans laquelle un total ne se vérifie pas — donc ne se croit pas. */
  parPopulation: Record<Population, { attendu: number; sorti: number }>
  /**
   * Qui ne l'a pas encore récupéré, nommément — la question à laquelle cet écran doit répondre
   * en fin d'événement. La somme de leurs quantités vaut `reste`.
   *
   * La liste est complète, sans troncature : un écran qui dit « et 40 autres » ne sert plus à
   * rappeler personne. Elle reste modeste en pratique — une personne ne se voit devoir qu'un ou
   * deux articles —, mais c'est le poste qui grossirait le premier si une édition s'envolait.
   */
  enAttente: PersonneEnAttente[]
}

const aZero = (): Record<Population, { attendu: number; sorti: number }> =>
  Object.fromEntries(POPULATIONS.map((p) => [p, { attendu: 0, sorti: 0 }])) as Record<
    Population,
    { attendu: number; sorti: number }
  >

/**
 * Le cumul sur l'édition, à partir de personnes dont les articles sont **déjà agrégés**.
 *
 * Le `catalogue` sert à faire apparaître à zéro les articles que personne ne reçoit. C'est
 * volontaire : un article défini mais associé à rien est presque toujours un paramétrage
 * incomplet, et il vaut mieux le voir sur cet écran qu'au comptoir.
 *
 * L'ordre est alphabétique, comme partout où ce module liste des articles.
 */
export function cumulerParArticle(
  personnes: PersonneComptee[],
  catalogue: Array<{ id: number; name: string }> = []
): VolumeDunArticle[] {
  const volumes = new Map<number, VolumeDunArticle>()

  const entree = (id: number, name: string) => {
    const existant = volumes.get(id)
    if (existant) return existant
    const neuf: VolumeDunArticle = {
      id,
      name,
      attendu: 0,
      sorti: 0,
      reste: 0,
      parPopulation: aZero(),
      enAttente: [],
    }
    volumes.set(id, neuf)
    return neuf
  }

  for (const article of catalogue) entree(article.id, article.name)

  for (const personne of personnes) {
    for (const article of personne.articles) {
      // Une quantité absente ou aberrante vaut un exemplaire, comme dans `aggregateHandoutItems`.
      const quantite = Math.max(1, Math.trunc(article.quantity ?? 1) || 1)
      const volume = entree(article.id, article.name)
      volume.attendu += quantite
      volume.parPopulation[personne.population].attendu += quantite
      if (personne.entreeValidee) {
        volume.sorti += quantite
        volume.parPopulation[personne.population].sorti += quantite
      } else {
        volume.enAttente.push({
          cle: `${personne.population}:${personne.id}`,
          id: personne.id,
          nom: personne.nom,
          population: personne.population,
          quantity: quantite,
        })
      }
    }
  }

  for (const volume of volumes.values()) {
    volume.reste = Math.max(0, volume.attendu - volume.sorti)
    // Par nom, pour qu'on retrouve quelqu'un dans la liste dépliée plutôt que de la parcourir.
    volume.enAttente.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))
  }

  return Array.from(volumes.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  )
}

/**
 * Raccourci de lecture : agréger les associations d'une personne puis les réduire à ce que
 * `cumulerParArticle` attend. Les quatre populations passent par là, ce qui garantit qu'aucune
 * n'échappe à la règle du non-cumulable.
 */
export function personneComptee(
  identite: { id: number; nom: string; population: Population; entreeValidee: boolean },
  associations: HandoutItemAssociation[]
): PersonneComptee {
  return {
    ...identite,
    articles: aggregateHandoutItems(associations).map((article) => ({
      id: article.id,
      name: article.name,
      quantity: article.quantity,
    })),
  }
}
