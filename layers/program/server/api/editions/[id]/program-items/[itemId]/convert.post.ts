import { z } from 'zod'

import { canManageProgram } from '#program/server/utils/permissions/program-permissions'
import { dureeEnMinutes } from '#program/shared/utils/program-conversion'
import { useProgramPorts } from '#server/program/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

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

    // Les réglages de l'événement viennent de l'app hôte (édition d'app1, événement de Flowvent).
    const ports = useProgramPorts()
    const edition = await ports.lireReglages(editionId)

    // Convertir vers un module éteint créerait une fiche que personne ne peut voir ni modifier.
    if (cible === 'spectacle' && !edition?.artistsEnabled) {
      throw createError({ status: 400, message: 'Le module artistes n’est pas activé' })
    }
    // Sans `creerAtelier`, l'hôte n'a pas d'ateliers (Flowvent) : rien vers quoi convertir.
    if (cible === 'workshop' && (!edition?.workshopsEnabled || !ports.creerAtelier)) {
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
        // Le lieu et l'atelier relèvent de l'app hôte : c'est son port qui les crée.
        resultat = await ports.creerAtelier!(tx, {
          editionId,
          creatorId: user.id,
          title: element.title,
          description: element.description,
          startDateTime: element.startDateTime,
          endDateTime: fin,
          locationName: element.locationName,
          zoneId: element.zoneId,
          markerId: element.markerId,
        })
      }

      await tx.editionProgramItem.delete({ where: { id: itemId } })
      return resultat
    })

    return { success: true, data: { cible, id: cree.id } }
  },
  { operationName: 'Conversion d’un élément de programmation' }
)
