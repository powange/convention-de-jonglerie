import { createError, type H3Event } from 'h3'

import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

/** Les deux drapeaux qui décident qu'une carte est montrable au public. */
export interface DrapeauxDeCarte {
  siteMapEnabled: boolean
  mapPublic: boolean
}

/**
 * « Cette personne a-t-elle le droit de voir la carte de cette édition ? »
 *
 * ⚠️ CE QUI N'ALLAIT PAS. L'interrupteur « Rendre la carte publique » n'était respecté que par
 * l'en-tête, qui masquait l'onglet. Les points d'API des zones et des repères sont publics et ne
 * lisaient NI `siteMapEnabled` NI `mapPublic` : un visiteur qui connaissait l'adresse voyait une
 * carte en cours de préparation, ses repères de service et ses zones « espace interdit » comprises.
 *
 * Masquer un onglet n'a jamais protégé une donnée. Le programme faisait déjà le contrôle au bon
 * endroit (`program.get.ts`), et l'export KML aussi ; c'est cette règle-là qu'on reprend.
 *
 * ⚠️⚠️ ET SURTOUT : LA GARDE N'EST PAS « PEUT ÉDITER L'ÉDITION », contrairement à ce qu'on ferait
 * par analogie avec le programme. Ces deux points d'API ne servent pas qu'à la page publique : le
 * STOCK y place son matériel, les ATELIERS leurs salles, et le sélecteur de lieu partagé les
 * interroge aussi. Les personnes qui tiennent ces écrans ont `canManageStock` ou
 * `canManageWorkshops`, PAS forcément le droit d'éditer l'édition — une garde sur
 * `canEditEditionById` aurait fermé trois écrans de gestion pour refermer une fuite.
 *
 * `canAccessEditionData` répond à la bonne question : « fait-elle partie de l'organisation de cette
 * édition ? ». C'est aussi ce qui décide qu'on voit l'espace de gestion, donc la règle est la même
 * des deux côtés.
 *
 * Le refus est un 404 et non un 403 : distinguer les deux dirait à un visiteur qu'il existe une
 * carte à voir, ce qui n'est pas son affaire tant qu'elle n'est pas publiée. C'est déjà le choix du
 * programme.
 */
/*
 * ⚠️ `H3Event` ET NON une forme structurelle du genre `{ context?: { user?: { id: number } } }`.
 *
 * C'est ce qui était écrit, et ça ne peut PAS fonctionner — pour une raison qui mérite d'être
 * notée, parce qu'elle n'est pas intuitive. Un type cible dont TOUTES les propriétés sont
 * optionnelles est un « type faible » aux yeux de TypeScript, et il exige alors que la source
 * partage au moins un nom de propriété. Or `H3EventContext` déclare `params`, `matchedRoute`,
 * `sessions` et `clientAddress` — jamais `user` —, si bien que le contrôle échouait malgré son
 * `extends Record<string, any>` :
 *
 *     Types of property 'context' are incompatible.
 *       Type 'H3EventContext' has no properties in common with type '{ user?: { id: number } }'.
 *
 * Six points d'API passaient donc un vrai `event` à une signature qui ne pouvait pas l'accepter.
 * L'intention — « je ne lis que `context.user` » — était bonne, mais elle n'est pas exprimable
 * ainsi ; les autres utils de ce dossier typent `H3Event`, et c'est l'idiome à suivre.
 */
export async function assurerCarteLisible(
  event: H3Event,
  editionId: number,
  edition: DrapeauxDeCarte
): Promise<void> {
  if (edition.siteMapEnabled && edition.mapPublic) return

  const user = event.context?.user
  const faitPartieDeLOrganisation = user
    ? await canAccessEditionData(editionId, user.id, event)
    : false

  if (faitPartieDeLOrganisation) return

  throw createError({
    status: 404,
    message: 'La carte n’est pas publique pour cette édition',
  })
}
