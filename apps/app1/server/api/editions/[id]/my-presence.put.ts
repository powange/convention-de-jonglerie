import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Quand l'artiste arrive sur place, et quand il repart — déclaré par LUI.
 *
 * Ces deux dates existaient déjà, mais seul l'organisateur pouvait les écrire : il devait les
 * demander à chacun puis les ressaisir. Le bénévole, lui, les déclare depuis toujours dans sa
 * candidature. Ce point d'API rétablit la symétrie.
 *
 * Calqué sur `my-accommodation` : l'artiste est retrouvé par le couple (édition, utilisateur
 * connecté), et rien d'autre ne l'autorise. L'organisateur garde sa propre voie, la modale de
 * gestion — les deux écrivent la même colonne, le dernier qui enregistre gagne.
 */
const updatePresenceSchema = z.object({
  /**
   * Des INSTANTS, en ISO. Le client les ancre au fuseau de l'édition avant de les envoyer : une
   * heure d'arrivée est une heure de LIEU, et « 15:00 » ne dit pas laquelle.
   */
  arrivalDateTime: z.coerce.date().nullable(),
  departureDateTime: z.coerce.date().nullable(),
  /**
   * La DEMANDE de récupération, et d'où. C'est une information que l'artiste seul détient : il
   * sait s'il arrive en train et à quelle gare.
   *
   * ⚠️ Le RESPONSABLE n'est volontairement pas ici, et ne doit jamais y entrer : désigner qui
   * ira chercher quelqu'un est une affectation, pas une déclaration. Un artiste qui pourrait la
   * poser confierait une tâche à quelqu'un qui ne l'apprendrait jamais.
   */
  pickupRequired: z.boolean(),
  pickupLocation: z.string().max(500).nullable(),
  dropoffRequired: z.boolean(),
  dropoffLocation: z.string().max(500).nullable(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event)
    const data = updatePresenceSchema.parse(body)

    // Un départ antérieur à l'arrivée est une saisie, pas une donnée : on la refuse plutôt que
    // de l'enregistrer et de laisser l'organisateur la découvrir sur son tableau.
    if (
      data.arrivalDateTime &&
      data.departureDateTime &&
      data.departureDateTime < data.arrivalDateTime
    ) {
      throw createError({
        status: 400,
        message: 'Le départ ne peut pas précéder l’arrivée',
      })
    }

    // Un lieu sans demande n'a pas de sens, et resterait à l'écran après un décochage. Même
    // logique que l'hébergement, qui efface son texte libre quand le type n'est plus « autre ».
    const pickupLocation = data.pickupRequired ? data.pickupLocation?.trim() || null : null
    const dropoffLocation = data.dropoffRequired ? data.dropoffLocation?.trim() || null : null

    const artist = await prisma.editionArtist.findUnique({
      where: { editionId_userId: { editionId, userId: user.id } },
    })

    if (!artist) {
      throw createError({
        status: 404,
        message: "Vous n'êtes pas artiste pour cette édition",
      })
    }

    const updated = await prisma.editionArtist.update({
      where: { id: artist.id },
      data: {
        arrivalDateTime: data.arrivalDateTime,
        departureDateTime: data.departureDateTime,
        pickupRequired: data.pickupRequired,
        pickupLocation,
        dropoffRequired: data.dropoffRequired,
        dropoffLocation,
      },
      select: {
        arrivalDateTime: true,
        departureDateTime: true,
        pickupRequired: true,
        pickupLocation: true,
        dropoffRequired: true,
        dropoffLocation: true,
      },
    })

    return createSuccessResponse(updated)
  },
  { operationName: 'UpdateMyPresence' }
)
