import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageProgram } from '#server/utils/permissions/program-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { dureeEnMinutes } from '~~/shared/utils/program-conversion'

const schema = z.object({
  cible: z.enum(['spectacle', 'workshop']),
  /** Fourni quand l'élément n'a pas d'heure de fin et que la cible en exige une. */
  endDateTime: z.coerce.date().optional().nullable(),
})

/**
 * Transforme un élément de programme en spectacle ou en workshop.
 *
 * Un élément se saisit en quelques secondes ; ces deux modules portent davantage — artistes et
 * besoins techniques d'un côté, nombre de places de l'autre. Convertir évite de tout ressaisir.
 *
 * La création et la suppression sont dans une **même transaction** : sans cela, une création
 * réussie suivie d'une suppression en échec laisserait un doublon, et l'inverse perdrait le
 * créneau. Ici, ou les deux aboutissent, ou rien ne change.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const itemId = Number(getRouterParam(event, 'itemId'))
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw createError({ status: 400, message: 'Identifiant d’élément invalide' })
    }

    const allowed = await canManageProgram(editionId, user, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const { cible, endDateTime } = schema.parse(await readBody(event))

    const element = await prisma.editionProgramItem.findFirst({
      where: { id: itemId, editionId },
    })
    if (!element) {
      throw createError({ status: 404, message: 'Élément de programmation introuvable' })
    }

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { artistsEnabled: true, workshopsEnabled: true },
    })

    // Convertir vers un module éteint créerait une fiche que personne ne peut voir ni modifier.
    if (cible === 'spectacle' && !edition?.artistsEnabled) {
      throw createError({ status: 400, message: 'Le module artistes n’est pas activé' })
    }
    if (cible === 'workshop' && !edition?.workshopsEnabled) {
      throw createError({ status: 400, message: 'Le module workshops n’est pas activé' })
    }

    const fin = endDateTime ?? element.endDateTime

    if (cible === 'workshop') {
      // L'heure de fin n'est plus réclamée : un workshop peut désormais s'en passer, comme
      // l'élément de programme dont il est issu. Annoncée, elle doit tenir debout.
      if (fin && fin <= element.startDateTime) {
        throw createError({ status: 400, message: 'La fin doit être postérieure au début' })
      }
    }

    const cree = await prisma.$transaction(async (tx) => {
      let resultat: { id: number }

      if (cible === 'spectacle') {
        // L'élément converti devient un spectacle et sa première représentation : le quand et
        // le où appartiennent au passage, la durée à l'œuvre.
        resultat = await tx.show.create({
          data: {
            editionId,
            title: element.title,
            description: element.description,
            // Un spectacle porte une durée, pas une heure de fin.
            duration: dureeEnMinutes(element.startDateTime, fin),
            performances: {
              create: {
                startDateTime: element.startDateTime,
                location: element.locationName,
                zoneId: element.zoneId,
                markerId: element.markerId,
                // La visibilité suit : convertir ne doit ni publier ni dépublier à l'insu de
                // qui le fait.
                isPublic: element.isPublic,
              },
            },
          },
          select: { id: true },
        })
      } else {
        // Le lieu d'un workshop est une entité à part, réutilisée d'un workshop à l'autre. On
        // retrouve celui qui porte le même nom plutôt que d'en semer un nouveau à chaque conversion.
        let locationId: number | null = null
        const nomDuLieu = element.locationName?.trim()
        if (nomDuLieu || element.zoneId || element.markerId) {
          const existant = await tx.workshopLocation.findFirst({
            where: {
              editionId,
              ...(nomDuLieu ? { name: nomDuLieu } : {}),
              ...(element.zoneId ? { zoneId: element.zoneId } : {}),
              ...(element.markerId ? { markerId: element.markerId } : {}),
            },
            select: { id: true },
          })
          locationId =
            existant?.id ??
            (
              await tx.workshopLocation.create({
                data: {
                  editionId,
                  // Un lieu de workshop a besoin d'un nom : à défaut, celui du créneau fait foi.
                  name: nomDuLieu || element.title,
                  zoneId: element.zoneId,
                  markerId: element.markerId,
                },
                select: { id: true },
              })
            ).id
        }

        resultat = await tx.workshop.create({
          data: {
            editionId,
            creatorId: user.id,
            title: element.title,
            description: element.description,
            startDateTime: element.startDateTime,
            endDateTime: fin,
            locationId,
          },
          select: { id: true },
        })
      }

      await tx.editionProgramItem.delete({ where: { id: itemId } })
      return resultat
    })

    return { success: true, data: { cible, id: cree.id } }
  },
  { operationName: 'Conversion d’un élément de programmation' }
)
