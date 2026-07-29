/**
 * Récupération d'une carte externe chez son fournisseur.
 *
 * Séparé du rapprochement (`external-map-reconcile.ts`) pour que celui-ci reste une fonction pure,
 * testable sans réseau ni alias de résolution Nitro.
 */

import {
  attachFeatureIds,
  parseGoogleMyMapsFeatureIds,
  parseGoogleMyMapsKml,
  type ExternalMapObject,
} from './google-my-maps-import'

import { fetchWithBrowserHeaders } from '#server/utils/fetch-helpers'
import { externalMapKmlUrl, externalMapViewerUrl } from '~~/shared/utils/external-map'

/** Google peut mettre plusieurs secondes sur une grande carte, sans excuser une attente infinie. */
const FETCH_TIMEOUT_MS = 20_000

export interface FetchedExternalMap {
  name: string | null
  objects: ExternalMapObject[]
  /** Faux quand les identifiants n'ont pas pu être récupérés : le réimport sera approximatif. */
  identified: boolean
}

/**
 * Récupère et analyse la carte d'un fournisseur.
 *
 * L'URL est reconstruite à partir de la référence validée et d'un hôte figé — rien de ce que
 * l'utilisateur a saisi n'atteint `fetch`.
 */
export async function fetchExternalMapObjects(
  provider: string,
  ref: string
): Promise<FetchedExternalMap> {
  const kmlUrl = externalMapKmlUrl({ provider: provider as 'google', ref })
  const viewerUrl = externalMapViewerUrl({ provider: provider as 'google', ref })
  if (!kmlUrl) {
    throw createError({ status: 400, message: 'Fournisseur de carte non pris en charge' })
  }

  const kmlResponse = await fetchWithBrowserHeaders(kmlUrl, FETCH_TIMEOUT_MS).catch(() => null)
  if (!kmlResponse?.ok) {
    throw createError({
      status: 502,
      message:
        "La carte n'a pas pu être récupérée. Vérifiez qu'elle est partagée publiquement, puis réessayez.",
    })
  }

  const { name, objects } = parseGoogleMyMapsKml(await kmlResponse.text())

  // Les identifiants sont un confort, pas une condition : leur absence dégrade la qualité du
  // réimport sans empêcher l'import lui-même.
  let features: ReturnType<typeof parseGoogleMyMapsFeatureIds> = []
  if (viewerUrl) {
    const viewerResponse = await fetchWithBrowserHeaders(viewerUrl, FETCH_TIMEOUT_MS).catch(
      () => null
    )
    if (viewerResponse?.ok) {
      features = parseGoogleMyMapsFeatureIds(await viewerResponse.text())
    }
  }

  const identified = features.length > 0 && features.length === objects.length
  return { name, objects: attachFeatureIds(objects, features), identified }
}
