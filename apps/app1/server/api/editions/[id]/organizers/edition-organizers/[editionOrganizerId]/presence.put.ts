import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canManageEditionOrganizers } from '#server/utils/permissions/edition-permissions'

/**
 * Quand un organisateur arrive sur place, et quand il repart.
 *
 * Ces dates n'existaient pas : les bénévoles les déclarent depuis toujours dans leur candidature,
 * les artistes depuis `my-presence`, mais rien ne les portait pour un organisateur. Elles servent
 * au graphique d'affluence, qui sans elles compterait chaque organisateur présent du premier au
 * dernier jour.
 *
 * **Le format est celui des bénévoles** — `AAAA-MM-JJ_moment` — sur décision de l'utilisateur, et
 * non de vrais instants comme pour les artistes. C'est le format qui dit la vérité de la donnée :
 * on déclare « j'arrive samedi matin », pas « à 8 h 03 ». Le même util partagé, `fenetreDe()`, en
 * tire une fenêtre pour les deux populations.
 *
 * Saisi par qui gère les organisateurs, depuis la modale du tableau — il n'existe aucun espace
 * personnel d'organisateur où il pourrait le déclarer lui-même.
 */

/** `AAAA-MM-JJ` seul, ou suivi d'un moment de la journée. La chaîne vide vaut « effacer ». */
const MOMENTS = ['morning', 'noon', 'afternoon', 'evening'] as const
const champDePresence = z
  .string()
  .trim()
  .refine(
    (valeur) =>
      valeur === '' || new RegExp(`^\\d{4}-\\d{2}-\\d{2}(_(${MOMENTS.join('|')}))?$`).test(valeur),
    { message: 'Date de présence illisible' }
  )
  .nullable()
  .optional()
  // Une chaîne vide et `null` doivent aboutir au même état en base : sinon effacer le champ
  // laisserait une chaîne vide que `fenetreDe()` traiterait comme une date illisible.
  .transform((valeur) => (valeur === '' ? null : (valeur ?? null)))

const schema = z.object({
  arrivalDateTime: champDePresence,
  departureDateTime: champDePresence,
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const editionOrganizerId = validateResourceId(event, 'editionOrganizerId', 'organisateur')

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: { include: { organizers: { where: { userId: user.id } } } },
        organizerPermissions: {
          where: { organizer: { userId: user.id } },
          include: { organizer: { select: { userId: true } } },
        },
      },
    })

    if (!edition) throw createError({ status: 404, message: 'Edition not found' })

    if (!canManageEditionOrganizers(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour gérer les organisateurs",
      })
    }

    const data = schema.parse(await readBody(event))

    /*
     * Un départ antérieur à l'arrivée est une saisie, pas une donnée : on la refuse plutôt que de
     * l'enregistrer et de laisser quelqu'un la découvrir sur une courbe d'affluence.
     *
     * La comparaison porte sur les chaînes, et c'est suffisant : `AAAA-MM-JJ` se compare
     * lexicographiquement comme chronologiquement. Deux moments d'un même jour ne se comparent pas
     * ainsi, d'où le test sur la seule date — refuser « samedi soir → samedi matin » demanderait de
     * hiérarchiser les moments, ce que le formulaire empêche déjà en les proposant dans l'ordre.
     */
    if (
      data.arrivalDateTime &&
      data.departureDateTime &&
      data.departureDateTime.slice(0, 10) < data.arrivalDateTime.slice(0, 10)
    ) {
      throw createError({
        status: 400,
        message: 'Le départ ne peut pas précéder l’arrivée',
      })
    }

    const misAJour = await prisma.editionOrganizer.updateMany({
      // `updateMany` et non `update` : l'appartenance à l'édition fait partie du `where`, donc une
      // ligne d'une AUTRE édition ne peut pas être touchée en devinant son identifiant.
      where: { id: editionOrganizerId, editionId },
      data: {
        arrivalDateTime: data.arrivalDateTime,
        departureDateTime: data.departureDateTime,
      },
    })

    if (misAJour.count === 0) {
      throw createError({ status: 404, message: 'Organisateur introuvable sur cette édition' })
    }

    return createSuccessResponse({
      arrivalDateTime: data.arrivalDateTime,
      departureDateTime: data.departureDateTime,
    })
  },
  { operationName: 'UpdateEditionOrganizerPresence' }
)
