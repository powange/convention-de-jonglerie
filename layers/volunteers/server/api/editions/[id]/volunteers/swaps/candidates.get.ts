import { z } from 'zod'

import {
  creneauxProposables,
  type AffectationCandidate,
} from '../../../../../utils/echange-creneaux'
import { exigerEchangesOuverts } from '../../../../../utils/echanges-ouverts'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userWithProfileAndGravatarSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET .../volunteers/swaps/candidates?assignmentId=… — les créneaux qu'on peut demander.
 *
 * Périmètre : les bénévoles des ÉQUIPES où le demandeur est lui-même affecté. Pas toute l'édition
 * — il n'a rien à faire du planning d'une équipe qu'il ne côtoie pas — et pas seulement son
 * créneau — un échange se cherche sur toute la durée de l'événement.
 *
 * Les créneaux qui lui créeraient un chevauchement sont retirés ici plutôt que refusés plus tard :
 * laisser demander l'impossible ferait attendre deux accords avant d'aboutir à un refus.
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  await exigerEchangesOuverts(editionId)

  const { assignmentId } = z.object({ assignmentId: z.string().min(1) }).parse(getQuery(event))

  // L'affectation offerte doit être la sienne, sur cette édition : sans ce contrôle, on
  // renseignerait le planning d'une équipe à partir de l'affectation d'un tiers.
  const offerte = await prisma.volunteerAssignment.findFirst({
    where: { id: assignmentId, userId: user.id, timeSlot: { eventId: editionId } },
    select: { id: true, timeSlot: { select: { id: true, teamId: true } } },
  })
  if (!offerte) {
    throw createError({ status: 404, message: 'Créneau introuvable parmi les vôtres' })
  }

  // Ses équipes, via sa candidature acceptée.
  const sesEquipes = await prisma.applicationTeamAssignment.findMany({
    where: { application: { userId: user.id, eventId: editionId, status: 'ACCEPTED' } },
    select: { teamId: true },
  })
  const equipes = sesEquipes.map((e) => e.teamId)
  if (equipes.length === 0) {
    return createSuccessResponse({ candidates: [] })
  }

  // Toutes les affectations de ces équipes — les siennes comprises, car le calcul du
  // chevauchement a besoin de connaître les créneaux qu'il garde.
  const affectations = await prisma.volunteerAssignment.findMany({
    where: { timeSlot: { eventId: editionId, teamId: { in: equipes } } },
    select: {
      id: true,
      userId: true,
      user: { select: userWithProfileAndGravatarSelect },
      timeSlot: {
        select: {
          id: true,
          title: true,
          teamId: true,
          startDateTime: true,
          endDateTime: true,
          // L'occupation se compte sur les affectations réelles, comme partout dans le dépôt.
          maxVolunteers: true,
          _count: { select: { assignments: true } },
          team: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: { timeSlot: { startDateTime: 'asc' } },
  })

  // Un créneau déjà passé ne s'échange pas : la demande expirerait aussitôt créée.
  const maintenant = Date.now()
  const aVenir = affectations.filter((a) => a.timeSlot.endDateTime.getTime() > maintenant)

  const proposables = creneauxProposables(
    user.id,
    offerte.id,
    aVenir as unknown as AffectationCandidate[]
  )

  return createSuccessResponse({
    candidates: proposables.map((a) => {
      const complet = aVenir.find((x) => x.id === a.id)!
      return {
        assignmentId: complet.id,
        volunteer: complet.user,
        timeSlot: complet.timeSlot,
      }
    }),
  })
}, { operationName: 'ListVolunteerSwapCandidates' })
