import { z } from 'zod'

import {
  demandeExpiree,
  echangePossiblePourLaCible,
  type AffectationCandidate,
} from '../../../../../../utils/echange-creneaux'
import { exigerEchangesOuverts } from '../../../../../../utils/echanges-ouverts'
import { exigerPlanningPublie } from '../../../../../../utils/planning-publie'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({ accept: z.boolean() })

/**
 * PATCH .../swaps/:swapId/respond — le bénévole visé accepte ou refuse.
 *
 * Son accord ne déclenche rien sur le planning : il fait passer la demande en attente d'un
 * organisateur. Un arrangement entre deux personnes peut dégarnir un poste que ni l'une ni
 * l'autre ne voit.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    await exigerEchangesOuverts(editionId)
    // Les échanges sont fermés tant que le planning n'est pas publié : un bénévole qui ne connaît
    // pas son créneau n'a rien à échanger, et `candidates` divulguerait les créneaux des autres
    // par la bande. Les deux endpoints réservés à la gestion (`pending`, `decide`) restent
    // ouverts, pour qu'un responsable puisse solder un reliquat après avoir dépublié.
    await exigerPlanningPublie(editionId, false)
    const swapId = String(getRouterParam(event, 'swapId') || '')
    if (!swapId) throw createError({ status: 400, message: 'Demande invalide' })

    const { accept } = bodySchema.parse(await readBody(event))

    const creneau = {
      select: { id: true, startDateTime: true, endDateTime: true, teamId: true, eventId: true },
    }
    const demande = await prisma.volunteerSwapRequest.findFirst({
      where: { id: swapId, eventId: editionId },
      select: {
        id: true,
        status: true,
        targetId: true,
        requesterId: true,
        requester: { select: { id: true, pseudo: true } },
        requesterAssignment: { select: { id: true, userId: true, timeSlot: creneau } },
        targetAssignment: { select: { id: true, userId: true, timeSlot: creneau } },
      },
    })

    if (!demande) throw createError({ status: 404, message: 'Demande introuvable' })
    if (demande.targetId !== user.id) {
      throw createError({ status: 403, message: 'Cette demande ne vous est pas adressée' })
    }
    if (demande.status !== 'PENDING_PEER') {
      throw createError({ status: 409, message: 'Cette demande a déjà été traitée' })
    }

    // Contrôlé ici et pas seulement par la tâche planifiée : entre deux passages de celle-ci, une
    // demande périmée pourrait être acceptée.
    if (demandeExpiree(demande.requesterAssignment.timeSlot, demande.targetAssignment.timeSlot)) {
      await prisma.volunteerSwapRequest.update({
        where: { id: demande.id },
        data: { status: 'EXPIRED' },
      })
      throw createError({ status: 409, message: 'L’un des deux créneaux est passé' })
    }

    if (!accept) {
      await prisma.volunteerSwapRequest.update({
        where: { id: demande.id },
        data: { status: 'REFUSED', peerRespondedAt: new Date() },
      })
      await prevenir(demande.requesterId, 'REFUSED')
      return createSuccessResponse({ status: 'REFUSED' })
    }

    // Le chevauchement se rejuge au moment de répondre : depuis la proposition, la cible a pu
    // recevoir une autre affectation.
    const siennes = await prisma.volunteerAssignment.findMany({
      where: { userId: user.id, timeSlot: { eventId: editionId } },
      select: { id: true, userId: true, timeSlot: creneau },
    })
    const possible = echangePossiblePourLaCible(
      user.id,
      demande.targetAssignment.id,
      demande.requesterAssignment.timeSlot,
      siennes as unknown as AffectationCandidate[]
    )
    if (!possible) {
      throw createError({
        status: 409,
        message: 'Ce créneau chevaucherait désormais l’un des vôtres',
      })
    }

    await prisma.volunteerSwapRequest.update({
      where: { id: demande.id },
      data: { status: 'PENDING_MANAGER', peerRespondedAt: new Date() },
    })

    // Le demandeur sait que son pair a dit oui ; les organisateurs qui gèrent les bénévoles sont
    // sollicités maintenant, et pas avant : une demande refusée entre bénévoles ne les atteint pas.
    await prevenir(demande.requesterId, 'PEER_ACCEPTED')
    await prevenirLesResponsables()

    return createSuccessResponse({ status: 'PENDING_MANAGER' })

    async function prevenir(destinataire: number, kind: 'REFUSED' | 'PEER_ACCEPTED') {
      const edition = await prisma.edition.findUnique({
        where: { id: editionId },
        select: { name: true, convention: { select: { name: true } } },
      })
      await safeNotify(
        () =>
          NotificationHelpers.volunteerSwap(destinataire, kind, {
            editionId,
            editionName: edition?.name || edition?.convention.name || `Édition #${editionId}`,
            swapId: demande!.id,
            otherName: user.pseudo,
          }),
        'volunteer swap response'
      )
    }

    /**
     * Ceux qui peuvent TRANCHER cet échange, et qu'il faut donc prévenir.
     *
     * ⚠️ CETTE LISTE ÉTAIT RECOMPOSÉE À LA MAIN, et elle oubliait deux personnes :
     * `edition.creatorId` et `convention.authorId`. Or `requireVolunteerManagementAccess` les
     * reconnaît bien comme décideurs — ils PEUVENT trancher, ils n'étaient simplement jamais
     * avertis.
     *
     * ⚠️⚠️ ET CE N'EST PAS UN CAS MARGINAL, MESURÉ : l'auteur d'une convention reçoit six droits à
     * la création (`conventions/index.post.ts`), et `canManageVolunteers` N'EN FAIT PAS PARTIE.
     * Une convention gérée par son seul auteur — le cas de la plupart des petites éditions —
     * n'avait donc AUCUN destinataire. La demande restait en `PENDING_MANAGER` jusqu'à ce que la
     * tâche d'expiration la ferme, et les deux bénévoles attendaient une décision que personne ne
     * savait devoir prendre.
     *
     * `listerGestionnairesBenevoles` répond à la même question que la garde d'accès, et c'est
     * déjà elle qui prévient à la RÉCEPTION D'UNE CANDIDATURE : deux réponses différentes à
     * « qui gère les bénévoles ? » étaient précisément la cause.
     *
     * 🔌 IMPORT DYNAMIQUE depuis le layer, comme `applications/index.post.ts` le fait déjà pour
     * cette même fonction : c'est le motif établi pour atteindre `apps/app1` d'ici.
     */
    async function prevenirLesResponsables() {
      const edition = await prisma.edition.findUnique({
        where: { id: editionId },
        select: {
          name: true,
          convention: { select: { name: true } },
        },
      })
      if (!edition) return

      const { listerGestionnairesBenevoles } = await import('#server/utils/organizer-management')
      const gestionnaires = await listerGestionnairesBenevoles(editionId)

      /*
       * ⚠️ NI LE DEMANDEUR NI LA CIBLE, même s'ils gèrent les bénévoles. Un organisateur qui est
       * aussi bénévole n'a pas à recevoir une notification lui annonçant son propre échange —
       * il vient de le demander, ou de l'accepter à l'instant.
       */
      const destinataires = new Set(
        gestionnaires.filter(
          (identifiant) => identifiant !== demande!.requesterId && identifiant !== user.id
        )
      )

      for (const destinataire of destinataires) {
        await safeNotify(
          () =>
            NotificationHelpers.volunteerSwap(destinataire, 'PEER_ACCEPTED', {
              editionId,
              editionName: edition.name || edition.convention.name || `Édition #${editionId}`,
              swapId: demande!.id,
              otherName: user.pseudo,
            }),
          'volunteer swap awaiting decision'
        )
      }
    }
  },
  { operationName: 'RespondToVolunteerSwapRequest' }
)
