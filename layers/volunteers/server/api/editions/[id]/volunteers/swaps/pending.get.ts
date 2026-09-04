import { effectifApresEchange } from '../../../../../utils/echange-creneaux'
import { exigerEchangesOuverts } from '../../../../../utils/echanges-ouverts'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireVolunteerManagementAccess } from '#server/utils/permissions/volunteer-permissions'
import { userWithProfileAndGravatarSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET .../volunteers/swaps/pending — les échanges qui attendent une décision.
 *
 * Réservé à la gestion des bénévoles. Seuls les `PENDING_MANAGER` y figurent : les demandes que
 * la cible n'a pas encore vues ne concernent pas encore l'organisateur, c'est le choix retenu
 * pour ne pas le noyer.
 */
export default wrapApiHandler(async (event) => {
  const editionId = validateEditionId(event)
  await exigerEchangesOuverts(editionId)
  await requireVolunteerManagementAccess(event, editionId)

  const affectation = {
    select: {
      id: true,
      userId: true,
      timeSlotId: true,
      user: { select: userWithProfileAndGravatarSelect },
      timeSlot: {
        select: {
          id: true,
          title: true,
          startDateTime: true,
          endDateTime: true,
          team: { select: { id: true, name: true, color: true } },
        },
      },
    },
  }

  const demandes = await prisma.volunteerSwapRequest.findMany({
    where: { eventId: editionId, status: 'PENDING_MANAGER' },
    select: {
      id: true,
      status: true,
      createdAt: true,
      peerRespondedAt: true,
      requester: { select: userWithProfileAndGravatarSelect },
      target: { select: userWithProfileAndGravatarSelect },
      requesterAssignment: affectation,
      targetAssignment: affectation,
    },
    // La plus ancienne en attente d'abord : celle dont les deux bénévoles patientent depuis le
    // plus longtemps. Trier par l'imminence du créneau serait plus fin, mais l'urgence tient au
    // premier des DEUX créneaux, ce qu'un `ORDER BY` ne sait pas exprimer.
    orderBy: { peerRespondedAt: 'asc' },
  })

  // Ce que l'échange produit sur le terrain : qui se retrouvera sur chacun des deux créneaux.
  // Deux noms et deux horaires ne suffisent pas à décider — c'est l'effectif qui compte.
  const creneaux = [
    ...new Set(
      demandes.flatMap((d) => [d.requesterAssignment.timeSlotId, d.targetAssignment.timeSlotId])
    ),
  ]

  const affectationsDesCreneaux = creneaux.length
    ? await prisma.volunteerAssignment.findMany({
        where: { timeSlotId: { in: creneaux } },
        select: {
          id: true,
          userId: true,
          timeSlotId: true,
          user: { select: userWithProfileAndGravatarSelect },
        },
      })
    : []

  /**
   * Les mentions « personnes à éviter » des bénévoles concernés.
   *
   * Champ LIBRE, alimenté seulement si l'organisation pose la question. Il est affiché tel quel,
   * jamais rapproché d'un pseudo : « éviter Marie », « pas avec l'équipe bar » ou « personne » ne
   * se comparent pas à un compte. Un rapprochement automatique produirait des faux positifs et,
   * plus grave, des silences rassurants.
   */
  const concernes = [...new Set(affectationsDesCreneaux.map((a) => a.userId))]
  const candidatures = concernes.length
    ? await prisma.editionVolunteerApplication.findMany({
        where: {
          eventId: editionId,
          userId: { in: concernes },
          status: 'ACCEPTED',
          avoidList: { not: null },
        },
        select: { userId: true, avoidList: true },
      })
    : []
  const aEviter = new Map(
    candidatures.filter((c) => c.avoidList?.trim()).map((c) => [c.userId, c.avoidList!.trim()])
  )

  /** Les présents d'un créneau, mention « à éviter » comprise. */
  const presents = (timeSlotId: string) =>
    affectationsDesCreneaux
      .filter((a) => a.timeSlotId === timeSlotId)
      .map((a) => ({ ...a.user, avoidList: aEviter.get(a.userId) ?? null }))

  const membre = (userId: number) => {
    const trouve = affectationsDesCreneaux.find((a) => a.userId === userId)
    return trouve ? { ...trouve.user, avoidList: aEviter.get(userId) ?? null } : null
  }

  return createSuccessResponse({
    requests: demandes.map((d) => ({
      ...d,
      effectifs: {
        offert: effectifApresEchange(
          presents(d.requesterAssignment.timeSlotId),
          d.requesterAssignment.userId,
          membre(d.targetAssignment.userId)
        ),
        convoite: effectifApresEchange(
          presents(d.targetAssignment.timeSlotId),
          d.targetAssignment.userId,
          membre(d.requesterAssignment.userId)
        ),
      },
    })),
  })
}, 'ListPendingVolunteerSwapRequests')
