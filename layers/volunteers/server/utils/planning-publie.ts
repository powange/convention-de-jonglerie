import {
  niveauDeVisibilite,
  planningVisiblePour,
  PLANNING_NON_PUBLIE,
  type NiveauDeVisibilite,
} from './publication-plannings'

import {
  equipesDontIlEstMembre,
  equipesDontIlEstResponsable,
} from '#server/utils/editions/volunteers/responsables-equipe'

/**
 * La garde du réglage « planning publié », côté serveur.
 *
 * Séparée de la décision elle-même (`publication-plannings.ts`, pure et testée hors Nuxt) parce
 * qu'elle touche la base et lève une erreur HTTP — exactement le partage que le module applique
 * déjà entre `visibilite-equipes.ts` et `echanges-ouverts.ts`.
 *
 * Six surfaces exposent les créneaux d'une édition, et elles n'ont pas toutes la même forme : les
 * unes rendent une liste, les autres un objet. D'où deux fonctions plutôt qu'une — rendre une
 * liste vide est plus doux qu'une erreur pour un écran qui sait afficher « aucun créneau », mais
 * il faut refuser franchement là où une réponse vide serait ambiguë.
 */

/** Lit le réglage de l'édition. `false` quand l'édition n'a jamais rien configuré. */
export async function planningPublieDeLEdition(editionId: number): Promise<boolean> {
  const reglages = await prisma.eventVolunteerSettings.findUnique({
    where: { eventId: editionId },
    select: { planningPublished: true },
  })

  return reglages?.planningPublished ?? false
}

/**
 * Les créneaux sont-ils visibles de cette personne sur cette édition&nbsp;?
 *
 * Un gestionnaire n'entraîne aucune lecture en base : la question est déjà tranchée pour lui, et
 * son écran de planification appelle ces endpoints en boucle.
 */
export async function planningVisibleSurLEdition(
  editionId: number,
  estGestionnaire: boolean
): Promise<boolean> {
  if (estGestionnaire) return true

  return planningVisiblePour({
    estGestionnaire: false,
    planningPublie: await planningPublieDeLEdition(editionId),
  })
}

/**
 * Refuse la requête tant que le planning n'est pas publié.
 *
 * Pour les endpoints dont la réponse n'a pas de forme vide acceptable, et pour les écritures —
 * les échanges de créneaux, notamment : un bénévole qui ne connaît pas son créneau n'a rien à
 * échanger, et la liste des candidats à l'échange divulguerait les créneaux des autres par la
 * bande.
 */
export async function exigerPlanningPublie(
  editionId: number,
  estGestionnaire: boolean
): Promise<void> {
  if (await planningVisibleSurLEdition(editionId, estGestionnaire)) return

  throw createError({
    status: 403,
    message: "Le planning de cette édition n'est pas encore publié.",
    data: { code: PLANNING_NON_PUBLIE },
  })
}

/**
 * Jusqu'où va ce que cette personne voit du planning, et de quelles équipes elle voit les noms.
 *
 * DEUX questions, deux sources :
 *
 * - l'accès — publication, ou responsabilité d'équipe pour la relecture anticipée ;
 * - le détail nominatif — les équipes dont elle fait PARTIE, responsable ou non.
 *
 * Un gestionnaire n'entraîne aucune lecture : la question est tranchée pour lui, et son écran de
 * planification appelle ces points d'API en boucle.
 *
 * ⚠️ Les deux appartenances passent par `responsables-equipe.ts`, jamais par une lecture directe
 * de `applicationTeamAssignment` : un organisateur rattaché à une équipe n'a pas de candidature,
 * et l'interroger seule rouvrirait cet angle mort sans que rien ne le signale.
 */
export async function visibiliteDuPlanning(
  editionId: number,
  userId: number,
  estGestionnaire: boolean
): Promise<{ niveau: NiveauDeVisibilite; equipesEnDetail: string[] }> {
  if (estGestionnaire) return { niveau: 'complet', equipesEnDetail: [] }

  const planningPublie = await planningPublieDeLEdition(editionId)

  // La responsabilité n'est demandée que lorsqu'elle peut changer la réponse : une fois publié,
  // l'accès est acquis de toute façon.
  const equipesDuResponsable = planningPublie
    ? []
    : await equipesDontIlEstResponsable(editionId, userId)

  const niveau = niveauDeVisibilite({
    estGestionnaire: false,
    planningPublie,
    estResponsableDEquipe: equipesDuResponsable.length > 0,
  })

  return {
    niveau,
    // Inutile de demander les équipes à qui ne verra rien.
    equipesEnDetail: niveau === 'aucun' ? [] : await equipesDontIlEstMembre(editionId, userId),
  }
}
