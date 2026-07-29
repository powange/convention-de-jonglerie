import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionForEdit } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { parseExternalMapUrl } from '~~/shared/utils/external-map'

const bodySchema = z.object({
  /** URL collée par l'organisateur, ou chaîne vide pour retirer la carte externe. */
  url: z.string().max(2000),
})

/**
 * PATCH /api/editions/:id/external-map
 *
 * Enregistre la carte externe de l'organisateur. On ne conserve que le fournisseur et
 * l'identifiant de la carte : l'URL collée contient son numéro de compte et un cadrage de vue qui
 * n'ont pas à être figés.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const { url } = bodySchema.parse(await readBody(event))
    await getEditionForEdit(editionId, user)

    const trimmed = url.trim()
    const map = trimmed ? parseExternalMapUrl(trimmed) : null

    // Une URL saisie mais non reconnue est une erreur de l'organisateur, pas une demande de
    // suppression : le lui dire vaut mieux que d'effacer silencieusement son réglage.
    if (trimmed && !map) {
      throw createError({
        status: 400,
        message:
          "Cette URL n'est pas une carte Google My Maps. Ouvrez votre carte, puis copiez l'adresse affichée dans la barre du navigateur.",
      })
    }

    const updated = await prisma.edition.update({
      where: { id: editionId },
      data: {
        externalMapProvider: map?.provider ?? null,
        externalMapRef: map?.ref ?? null,
      },
      select: { id: true, externalMapProvider: true, externalMapRef: true },
    })

    return createSuccessResponse(updated)
  },
  { operationName: 'UpdateEditionExternalMap' }
)
