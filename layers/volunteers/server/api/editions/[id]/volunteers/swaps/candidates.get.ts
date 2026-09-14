import { z } from 'zod'

import {
  affectationsEchangeables,
  creneauxProposables,
  type AffectationCandidate,
} from '../../../../../utils/echange-creneaux'
import {
  exigerEchangesOuverts,
  exigerEchangesPourCettePersonne,
} from '../../../../../utils/echanges-ouverts'
import { exigerPlanningPublie } from '../../../../../utils/planning-publie'

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
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    await exigerEchangesOuverts(editionId)
    // Un volant ne propose pas ses créneaux de renfort, et n'en demande pas non plus.
    await exigerEchangesPourCettePersonne(editionId, user.id)
    // Les échanges sont fermés tant que le planning n'est pas publié : un bénévole qui ne connaît
    // pas son créneau n'a rien à échanger, et `candidates` divulguerait les créneaux des autres
    // par la bande. Les deux endpoints réservés à la gestion (`pending`, `decide`) restent
    // ouverts, pour qu'un responsable puisse solder un reliquat après avoir dépublié.
    await exigerPlanningPublie(editionId, false)

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

    /**
     * Les créneaux tenus par un VOLANT ne se proposent pas.
     *
     * C'est le second sens de la transparence : le volant ne propose pas ses renforts, et
     * personne ne les lui demande. Sans ce filtre, un volant posé sur un créneau de la cuisine
     * ressortirait ici — la requête porte sur l'équipe du créneau, pas sur celles de son
     * titulaire — et se verrait solliciter pour une charge qu'il ne doit pas.
     */
    const titulaires = [...new Set(affectations.map((a) => a.userId))]
    const equipesDesTitulaires = titulaires.length
      ? await prisma.applicationTeamAssignment.findMany({
          where: {
            application: { userId: { in: titulaires }, eventId: editionId, status: 'ACCEPTED' },
          },
          select: {
            application: { select: { userId: true } },
            team: { select: { isFloatingTeam: true } },
          },
        })
      : []

    const equipesParPersonne = new Map<number, { isFloatingTeam: boolean }[]>()
    for (const assignation of equipesDesTitulaires) {
      const personne = assignation.application.userId
      const liste = equipesParPersonne.get(personne) ?? []
      liste.push(assignation.team)
      equipesParPersonne.set(personne, liste)
    }

    const echangeables = affectationsEchangeables(affectations, equipesParPersonne)

    // Un créneau déjà passé ne s'échange pas : la demande expirerait aussitôt créée.
    const maintenant = Date.now()
    const aVenir = echangeables.filter((a) => a.timeSlot.endDateTime.getTime() > maintenant)

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
  },
  { operationName: 'ListVolunteerSwapCandidates' }
)
