import { createError } from 'h3'

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
export async function assurerCarteLisible(
  event: { context?: { user?: { id: number } } },
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
