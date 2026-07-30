import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { fetchExternalMapObjects } from '#server/utils/external-map-fetch'
import {
  looksLikeFetchIncident,
  reconcileExternalMap,
  type ImportedRecord,
} from '#server/utils/external-map-reconcile'
import { getEditionForEdit } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const importedSelect = {
  id: true,
  name: true,
  color: true,
  externalMapObjectId: true,
  externalMapImportedAt: true,
  updatedAt: true,
  _count: {
    select: { shows: true, workshopLocations: true, stockItems: true, stockReservations: true },
  },
} as const

// Les catégories ne portent pas le même nom d'un modèle à l'autre, d'où deux sélections.
const zoneSelect = { ...importedSelect, zoneTypes: true } as const
const markerSelect = { ...importedSelect, markerTypes: true, zoneId: true } as const

/**
 * Les valeurs enregistrées accompagnent chaque objet importé : c'est ce qui permet à l'écran de
 * savoir si l'organisateur a modifié une catégorie ou une couleur depuis, et donc de proposer un
 * réimport plutôt qu'un bouton toujours actif.
 */
function toRecord(row: {
  id: number
  name: string
  color: string | null
  zoneTypes?: unknown
  markerTypes?: unknown
  zoneId?: number | null
  externalMapObjectId: string | null
  externalMapImportedAt: Date | null
  updatedAt: Date
  _count: {
    shows: number
    workshopLocations: number
    stockItems: number
    stockReservations: number
  }
}): ImportedRecord {
  const rawTypes = row.zoneTypes ?? row.markerTypes
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    types: Array.isArray(rawTypes) ? (rawTypes as string[]) : [],
    externalMapObjectId: row.externalMapObjectId,
    // Rattachement enregistré, pour que l'écran sache si l'organisateur l'a changé depuis.
    zoneId: row.zoneId ?? null,
    externalMapImportedAt: row.externalMapImportedAt,
    updatedAt: row.updatedAt,
    dependencies: {
      shows: row._count.shows,
      workshops: row._count.workshopLocations,
      stockItems: row._count.stockItems,
      stockReservations: row._count.stockReservations,
    },
  }
}

/**
 * GET /api/editions/:id/external-map/objects
 *
 * Renvoie les objets de la carte externe rapprochés de ce qui est déjà importé, pour alimenter
 * l'écran de relecture. Ne modifie rien.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionForEdit(editionId, user)
    if (!edition.externalMapProvider || !edition.externalMapRef) {
      throw createError({
        status: 400,
        message: "Aucune carte externe n'est renseignée pour cette édition",
      })
    }

    const [map, zones, markers] = await Promise.all([
      fetchExternalMapObjects(edition.externalMapProvider, edition.externalMapRef),
      prisma.editionZone.findMany({ where: { editionId }, select: zoneSelect }),
      prisma.editionMarker.findMany({ where: { editionId }, select: markerSelect }),
    ])

    const importedCount = [...zones, ...markers].filter((r) => r.externalMapObjectId).length

    // Une carte qui revient vide alors que des objets en proviennent signale un incident de
    // récupération, pas une suppression en masse : on refuse d'afficher l'écran plutôt que de
    // proposer d'effacer le travail de l'organisateur.
    if (looksLikeFetchIncident(map.objects.length, importedCount)) {
      throw createError({
        status: 502,
        message:
          "La carte est revenue vide alors que des objets en proviennent. Vérifiez qu'elle est toujours partagée publiquement avant de réessayer.",
      })
    }

    const rows = reconcileExternalMap(
      map.objects,
      zones.map((z) => ({ ...toRecord(z), kind: 'zone' as const })),
      markers.map((m) => ({ ...toRecord(m), kind: 'marker' as const }))
    )

    return createSuccessResponse({
      mapName: map.name,
      identified: map.identified,
      rows,
      layers: [...new Set(map.objects.map((o) => o.layer).filter(Boolean))],
    })
  },
  { operationName: 'ListEditionExternalMapObjects' }
)
