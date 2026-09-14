import { z } from 'zod'

import type { Prisma } from '#server/types/prisma'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { createLogger } from '#server/utils/logger'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

const log = createLogger('ASSIGNATION-AUTO')

const bodySchema = z.object({
  /**
   * Le calcul que l'organisateur croit annuler.
   *
   * Facultatif, mais vérifié quand il est fourni : entre l'affichage du bouton et le clic, un
   * collègue a pu relancer le calcul. Annuler alors « le dernier » ne défait pas ce que
   * l'organisateur avait sous les yeux.
   */
  journalId: z.string().min(1).optional(),
})

/** Les formes que prend l'état conservé dans le journal, une fois relu depuis le JSON. */
interface AffectationConservee {
  timeSlotId: string
  userId: number
  source: 'MANUAL' | 'AUTO'
  assignedById: number
  assignedAt: string
}

interface RattachementConserve {
  applicationId: number
  teamId: string
  isLeader: boolean
  assignedAt: string
}

interface CreationAffectation {
  timeSlotId: string
  userId: number
}

interface CreationRattachement {
  applicationId: number
  teamId: string
}

/**
 * Défait le dernier calcul d'assignation automatique.
 *
 * Remettre l'état antérieur, ce n'est pas relancer le calcul avec d'autres réglages : on retire
 * ce qu'il a créé, et on recrée ce qu'il avait effacé, à l'identique — origine et auteur compris.
 *
 * ⚠️ Seul le DERNIER calcul non annulé peut l'être. Défaire un calcul par-dessus un autre
 * restaurerait un état que le suivant a déjà modifié, et produirait un planning que personne n'a
 * jamais décidé.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    if (!(await useVolunteerPorts().organizers.canManage(editionId, user.id, event))) {
      throw createError({
        status: 403,
        statusText: 'Droits insuffisants pour gérer les bénévoles',
      })
    }

    const body = bodySchema.parse((await readBody(event)) || {})

    const dernier = await prisma.volunteerAutoAssignRun.findFirst({
      where: { eventId: editionId, undoneAt: null },
      orderBy: { executedAt: 'desc' },
    })

    if (!dernier) {
      throw createError({
        status: 404,
        message: "Aucun calcul d'assignation automatique à annuler",
      })
    }

    if (body.journalId && body.journalId !== dernier.id) {
      throw createError({
        status: 409,
        message:
          "Un autre calcul a été appliqué depuis : ce n'est plus celui-ci que l'annulation défait",
      })
    }

    const affectationsCreees = dernier.createdAssignments as unknown as CreationAffectation[]
    const affectationsEffacees = dernier.deletedAssignments as unknown as AffectationConservee[]
    const rattachementsCrees = dernier.createdTeamLinks as unknown as CreationRattachement[]
    const rattachementsEfface = dernier.deletedTeamLinks as unknown as RattachementConserve[]

    await prisma.$transaction(async (tx) => {
      // 1. Retirer ce que le calcul avait créé. Le couple (créneau, bénévole) est unique : c'est
      //    lui qui désigne la ligne, et rien d'autre ne doit être touché.
      if (affectationsCreees.length > 0) {
        await tx.volunteerAssignment.deleteMany({
          where: {
            OR: affectationsCreees.map(({ timeSlotId, userId }) => ({ timeSlotId, userId })),
          },
        })
      }

      if (rattachementsCrees.length > 0) {
        await tx.applicationTeamAssignment.deleteMany({
          where: {
            OR: rattachementsCrees.map(({ applicationId, teamId }) => ({ applicationId, teamId })),
          },
        })
      }

      // 2. Recréer ce qu'il avait effacé, tel que c'était. `skipDuplicates` couvre le cas où
      //    quelqu'un aurait reposé la même affectation à la main entre-temps : la sienne reste,
      //    et elle vaut mieux que notre copie.
      if (affectationsEffacees.length > 0) {
        await tx.volunteerAssignment.createMany({
          data: affectationsEffacees.map((affectation) => ({
            timeSlotId: affectation.timeSlotId,
            userId: affectation.userId,
            source: affectation.source,
            assignedById: affectation.assignedById,
            assignedAt: new Date(affectation.assignedAt),
          })),
          skipDuplicates: true,
        })
      }

      if (rattachementsEfface.length > 0) {
        await tx.applicationTeamAssignment.createMany({
          data: rattachementsEfface.map((rattachement) => ({
            applicationId: rattachement.applicationId,
            teamId: rattachement.teamId,
            isLeader: rattachement.isLeader,
            source: 'AUTO' as const,
            assignedAt: new Date(rattachement.assignedAt),
          })) as Prisma.ApplicationTeamAssignmentCreateManyInput[],
          skipDuplicates: true,
        })
      }

      // 3. Marquer le journal : il ne sera pas annulé deux fois.
      await tx.volunteerAutoAssignRun.update({
        where: { id: dernier.id },
        data: { undoneAt: new Date(), undoneById: user.id },
      })
    })

    log.info('Assignation automatique annulée', {
      edition: editionId,
      par: user.id,
      journal: dernier.id,
      retirees: affectationsCreees.length,
      restaurees: affectationsEffacees.length,
    })

    return createSuccessResponse({
      journalId: dernier.id,
      retirees: affectationsCreees.length,
      restaurees: affectationsEffacees.length,
    })
  },
  { operationName: 'UndoAutoAssignVolunteers' }
)
