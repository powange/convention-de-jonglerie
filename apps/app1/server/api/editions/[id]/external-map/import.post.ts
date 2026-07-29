import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionForEdit } from '#server/utils/permissions/edition-permissions'
import { editionMarkerSelect, editionZoneSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { zoneTypesArraySchema } from '#server/utils/zone-validation'
import { ZONE_LIMITS } from '~~/shared/utils/zone-types'

/** Code Prisma d'une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = 'P2002'

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === UNIQUE_VIOLATION
}

async function findAlreadyImportedZone(
  editionId: number,
  externalId: string | null,
  error: unknown
) {
  if (!externalId || !isUniqueViolation(error)) return null
  return prisma.editionZone.findFirst({
    where: { editionId, externalMapObjectId: externalId },
    select: editionZoneSelect,
  })
}

async function findAlreadyImportedMarker(
  editionId: number,
  externalId: string | null,
  error: unknown
) {
  if (!externalId || !isUniqueViolation(error)) return null
  return prisma.editionMarker.findFirst({
    where: { editionId, externalMapObjectId: externalId },
    select: editionMarkerSelect,
  })
}

const bodySchema = z.object({
  /** Identifiant de l'objet chez le fournisseur, s'il a pu être déterminé. */
  externalId: z.string().max(64).nullable(),
  kind: z.enum(['polygon', 'point']),
  name: z.string().min(1).max(ZONE_LIMITS.MAX_NAME_LENGTH),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide (format #RRGGBB)'),
  types: zoneTypesArraySchema,
  coordinates: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])),
})

/**
 * POST /api/editions/:id/external-map/import
 *
 * Importe **un** objet de la carte externe. L'import se fait objet par objet : la base porte
 * l'état d'avancement, ce qui rend la reprise naturelle et isole les échecs.
 *
 * La géométrie vient du navigateur, comme lorsqu'une zone est dessinée à la main — ce n'est donc
 * pas un droit nouveau, et cela évite de retélécharger la carte à chaque clic.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    await getEditionForEdit(editionId, user)

    const data = bodySchema.parse(await readBody(event))

    if (data.kind === 'polygon' && data.coordinates.length < ZONE_LIMITS.MIN_POLYGON_POINTS) {
      throw createError({
        status: 400,
        message: `Un polygone demande au moins ${ZONE_LIMITS.MIN_POLYGON_POINTS} points`,
      })
    }
    if (data.kind === 'point' && data.coordinates.length !== 1) {
      throw createError({ status: 400, message: 'Un point demande exactement une coordonnée' })
    }

    const importedAt = new Date()

    // Un objet déjà importé est mis à jour, pas dupliqué. L'identifiant du fournisseur survit aux
    // déplacements et aux renommages, ce qui en fait une clé fiable — quand il existe.
    //
    // Réécrire plutôt que ne rien faire rend le réimport utile : c'est ainsi que l'organisateur
    // corrige des catégories ou une couleur, et que la géométrie suit un objet déplacé sur la
    // carte d'origine. Deux clics identiques écrivent deux fois la même chose, sans dommage.
    if (data.externalId) {
      const where = { editionId, externalMapObjectId: data.externalId }

      if (data.kind === 'polygon') {
        const existing = await prisma.editionZone.findFirst({ where, select: { id: true } })
        if (existing) {
          const zone = await prisma.editionZone.update({
            where: { id: existing.id },
            data: {
              name: data.name,
              description: data.description ?? null,
              color: data.color,
              coordinates: data.coordinates,
              zoneTypes: data.types,
              externalMapImportedAt: importedAt,
            },
            select: editionZoneSelect,
          })
          return createSuccessResponse({ item: zone, alreadyImported: true })
        }
      } else {
        const existing = await prisma.editionMarker.findFirst({ where, select: { id: true } })
        if (existing) {
          const [latitude, longitude] = data.coordinates[0]!
          const marker = await prisma.editionMarker.update({
            where: { id: existing.id },
            data: {
              name: data.name,
              description: data.description ?? null,
              color: data.color,
              latitude,
              longitude,
              markerTypes: data.types,
              externalMapImportedAt: importedAt,
            },
            select: editionMarkerSelect,
          })
          return createSuccessResponse({ item: marker, alreadyImported: true })
        }
      }
    }

    if (data.kind === 'polygon') {
      const count = await prisma.editionZone.count({ where: { editionId } })
      if (count >= ZONE_LIMITS.MAX_ZONES_PER_EDITION) {
        throw createError({
          status: 400,
          message: `Limite de ${ZONE_LIMITS.MAX_ZONES_PER_EDITION} zones atteinte pour cette édition`,
        })
      }
      const maxOrder = await prisma.editionZone.aggregate({
        where: { editionId },
        _max: { order: true },
      })

      try {
        const zone = await prisma.editionZone.create({
          data: {
            editionId,
            name: data.name,
            description: data.description ?? null,
            color: data.color,
            coordinates: data.coordinates,
            zoneTypes: data.types,
            order: (maxOrder._max.order ?? -1) + 1,
            externalMapObjectId: data.externalId,
            externalMapImportedAt: importedAt,
          },
          select: editionZoneSelect,
        })
        return createSuccessResponse({ item: zone, alreadyImported: false })
      } catch (error) {
        // Deux clics rapprochés passent tous deux la vérification ci-dessus avant que le premier
        // n'écrive : c'est la contrainte d'unicité qui tranche. Une 500 serait une mauvaise
        // réponse à un simple double-clic.
        const existing = await findAlreadyImportedZone(editionId, data.externalId, error)
        if (existing) return createSuccessResponse({ item: existing, alreadyImported: true })
        throw error
      }
    }

    const count = await prisma.editionMarker.count({ where: { editionId } })
    if (count >= ZONE_LIMITS.MAX_MARKERS_PER_EDITION) {
      throw createError({
        status: 400,
        message: `Limite de ${ZONE_LIMITS.MAX_MARKERS_PER_EDITION} marqueurs atteinte pour cette édition`,
      })
    }
    const maxOrder = await prisma.editionMarker.aggregate({
      where: { editionId },
      _max: { order: true },
    })

    const [latitude, longitude] = data.coordinates[0]!

    try {
      const marker = await prisma.editionMarker.create({
        data: {
          editionId,
          name: data.name,
          description: data.description ?? null,
          latitude,
          longitude,
          markerTypes: data.types,
          color: data.color,
          order: (maxOrder._max.order ?? -1) + 1,
          externalMapObjectId: data.externalId,
          externalMapImportedAt: importedAt,
        },
        select: editionMarkerSelect,
      })
      return createSuccessResponse({ item: marker, alreadyImported: false })
    } catch (error) {
      const existing = await findAlreadyImportedMarker(editionId, data.externalId, error)
      if (existing) return createSuccessResponse({ item: existing, alreadyImported: true })
      throw error
    }
  },
  { operationName: 'ImportEditionExternalMapObject' }
)
