import { z } from 'zod'

import {
  creneauxProposables,
  demandeExpiree,
  type AffectationCandidate,
} from '../../../../../utils/echange-creneaux'
import { exigerEchangesOuverts } from '../../../../../utils/echanges-ouverts'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  /** Affectation offerte par le demandeur. */
  offeredAssignmentId: z.string().min(1),
  /** Affectation convoitée, tenue par quelqu'un d'autre. */
  wantedAssignmentId: z.string().min(1),
})

/**
 * POST .../volunteers/swaps — propose un échange à un autre bénévole.
 *
 * Les contrôles sont refaits ici et pas seulement à l'affichage : la liste des candidats a pu
 * être calculée il y a dix minutes, et le planning bouge.
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  await exigerEchangesOuverts(editionId)
  const data = bodySchema.parse(await readBody(event))

  const selection = {
    id: true,
    userId: true,
    timeSlot: {
      select: { id: true, teamId: true, startDateTime: true, endDateTime: true, eventId: true },
    },
  }

  const [offerte, convoitee] = await Promise.all([
    prisma.volunteerAssignment.findFirst({
      where: { id: data.offeredAssignmentId, userId: user.id, timeSlot: { eventId: editionId } },
      select: selection,
    }),
    prisma.volunteerAssignment.findFirst({
      where: { id: data.wantedAssignmentId, timeSlot: { eventId: editionId } },
      select: selection,
    }),
  ])

  if (!offerte) throw createError({ status: 404, message: 'Créneau introuvable parmi les vôtres' })
  if (!convoitee) throw createError({ status: 404, message: 'Créneau convoité introuvable' })
  if (convoitee.userId === user.id) {
    throw createError({ status: 400, message: 'On n’échange pas un créneau avec soi-même' })
  }

  if (demandeExpiree(offerte.timeSlot, convoitee.timeSlot)) {
    throw createError({ status: 400, message: 'L’un des deux créneaux est déjà passé' })
  }

  // Le créneau convoité doit appartenir à une équipe du demandeur, et ne pas lui créer de
  // chevauchement. On rejoue exactement la règle de la liste, sur les données du moment.
  const sesEquipes = await prisma.applicationTeamAssignment.findMany({
    where: { application: { userId: user.id, eventId: editionId, status: 'ACCEPTED' } },
    select: { teamId: true },
  })
  const equipes = sesEquipes.map((e) => e.teamId)
  if (!convoitee.timeSlot.teamId || !equipes.includes(convoitee.timeSlot.teamId)) {
    throw createError({
      status: 403,
      message: 'Ce créneau n’appartient pas à l’une de vos équipes',
    })
  }

  const affectations = await prisma.volunteerAssignment.findMany({
    where: { timeSlot: { eventId: editionId, teamId: { in: equipes } } },
    select: selection,
  })
  const proposables = creneauxProposables(
    user.id,
    offerte.id,
    affectations as unknown as AffectationCandidate[]
  )
  if (!proposables.some((a) => a.id === convoitee.id)) {
    throw createError({
      status: 400,
      message: 'Ce créneau chevaucherait un autre des vôtres',
    })
  }

  // Une seule demande vivante par couple de créneaux : sans cela, cliquer deux fois enverrait
  // deux notifications et laisserait deux demandes à trancher pour un seul échange.
  const dejaEnCours = await prisma.volunteerSwapRequest.findFirst({
    where: {
      requesterAssignmentId: offerte.id,
      targetAssignmentId: convoitee.id,
      status: { in: ['PENDING_PEER', 'PENDING_MANAGER'] },
    },
    select: { id: true },
  })
  if (dejaEnCours) {
    throw createError({ status: 409, message: 'Une demande est déjà en cours sur ces créneaux' })
  }

  const demande = await prisma.volunteerSwapRequest.create({
    data: {
      eventId: editionId,
      requesterId: user.id,
      targetId: convoitee.userId,
      requesterAssignmentId: offerte.id,
      targetAssignmentId: convoitee.id,
    },
    select: { id: true, targetId: true },
  })

  // `safeNotify` : une notification qui échoue ne doit pas annuler une demande déjà créée.
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { name: true, convention: { select: { name: true } } },
  })
  await safeNotify(
    () =>
      NotificationHelpers.volunteerSwap(convoitee.userId, 'REQUESTED', {
        editionId,
        editionName: edition?.name || edition?.convention.name || `Édition #${editionId}`,
        swapId: demande.id,
        otherName: user.pseudo,
      }),
    'volunteer swap requested'
  )

  return createSuccessResponse({ id: demande.id })
}, 'CreateVolunteerSwapRequest')
