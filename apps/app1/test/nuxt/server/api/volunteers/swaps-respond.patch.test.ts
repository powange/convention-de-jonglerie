import { describe, it, expect, vi, beforeEach } from 'vitest'

const listerGestionnairesBenevoles = vi.hoisted(() => vi.fn(async () => [] as number[]))
const volunteerSwap = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('../../../../../server/utils/organizer-management', () => ({
  listerGestionnairesBenevoles,
}))

vi.mock('../../../../../server/utils/notification-service', () => ({
  NotificationHelpers: { volunteerSwap },
  // Le vrai `safeNotify` avale les erreurs : on garde ce comportement, mais sans passer par le
  // module réel qui, lui, écrirait en base.
  safeNotify: vi.fn(async (action: () => Promise<unknown>) => {
    try {
      await action()
    } catch {
      /* comme le vrai : une notification perdue ne fait pas échouer l'échange */
    }
  }),
}))

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event?.context?.user) {
      throw createError({ status: 401, message: 'Unauthorized' })
    }
    return event.context.user
  }),
}))

vi.mock('../../../../../../../layers/volunteers/server/utils/echanges-ouverts', () => ({
  exigerEchangesOuverts: vi.fn(async () => undefined),
}))

vi.mock('../../../../../../../layers/volunteers/server/utils/planning-publie', () => ({
  exigerPlanningPublie: vi.fn(async () => undefined),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/swaps/[swapId]/respond.patch'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Qui est prévenu quand le pair ACCEPTE un échange de créneau.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. L'accord du bénévole visé ne change rien au planning : il fait passer la
 * demande en `PENDING_MANAGER`, en attente d'un organisateur. Mais la liste des destinataires était
 * recomposée À LA MAIN, et elle oubliait `edition.creatorId` et `convention.authorId` — que
 * `requireVolunteerManagementAccess` reconnaît pourtant comme décideurs.
 *
 * ⚠️⚠️ ET CE N'EST PAS UN CAS MARGINAL, MESURÉ : l'auteur d'une convention reçoit SIX droits à la
 * création, et `canManageVolunteers` N'EN FAIT PAS PARTIE. Une convention gérée par son seul
 * auteur — le cas de la plupart des petites éditions — n'avait donc AUCUN destinataire. La demande
 * restait en attente jusqu'à ce que la tâche d'expiration la ferme, et les deux bénévoles
 * attendaient une décision que personne ne savait devoir prendre.
 *
 * 📍 DÉCISION DE L'UTILISATEUR, sur questionnaire : prévenir CEUX QUI PEUVENT TRANCHER — donc la
 * liste de `listerGestionnairesBenevoles`, celle que la réception d'une candidature emploie déjà.
 * Deux réponses différentes à « qui gère les bénévoles ? » étaient précisément la cause.
 *
 * 📍 POURQUOI AUCUN POINT D'API D'ÉCHANGE N'AVAIT DE TEST : `volunteerSwapRequest` manquait au
 * mock central de Prisma. Le handler échouait au premier accès sur un modèle inexistant, avant
 * qu'aucune assertion ne s'exécute. Cause de harnais, pas de paresse — deuxième fois dans la même
 * journée.
 */

const EDITION = 7
const CIBLE = 20
const DEMANDEUR = 21

/*
 * ⚠️ DATES RELATIVES, ET NON FIGÉES. `demandeExpiree` refuse un échange dont l'un des créneaux est
 * PASSÉ : une date écrite en dur part verte et échoue le jour où elle est dépassée — chez
 * quelqu'un d'autre, et en accusant le lot en cours. Ce dépôt a déjà payé ce piège une fois, sur
 * une fenêtre de modification de quinze minutes.
 *
 * Ma première version datait ces créneaux de juin 2026, déjà passé : les sept tests qui vont
 * jusqu'à la notification échouaient sur « L'un des deux créneaux est passé », ce qui n'avait rien
 * à voir avec ce qu'ils éprouvent.
 */
const DANS_UNE_SEMAINE = Date.now() + 7 * 24 * 3600 * 1000

const creneau = (id: string, decalageJours: number) => ({
  id,
  startDateTime: new Date(DANS_UNE_SEMAINE + decalageJours * 24 * 3600 * 1000),
  endDateTime: new Date(DANS_UNE_SEMAINE + decalageJours * 24 * 3600 * 1000 + 3 * 3600 * 1000),
  teamId: 'team-1',
  eventId: EDITION,
})

const demande = {
  id: 'swap-1',
  status: 'PENDING_PEER',
  targetId: CIBLE,
  requesterId: DEMANDEUR,
  requester: { id: DEMANDEUR, pseudo: 'Dominique' },
  requesterAssignment: {
    id: 'aff-demandeur',
    userId: DEMANDEUR,
    timeSlot: creneau('cr-1', 0),
  },
  targetAssignment: {
    id: 'aff-cible',
    userId: CIBLE,
    // Un jour plus tard : les deux créneaux ne se chevauchent pas.
    timeSlot: creneau('cr-2', 1),
  },
}

const evenement = { context: { user: { id: CIBLE, pseudo: 'Alex' } } } as any

/** Les comptes réellement notifiés, tous types confondus. */
const notifies = () => volunteerSwap.mock.calls.map((appel: any) => appel[0] as number)

/** Les comptes notifiés d'une décision à prendre. */
const sollicitesPourTrancher = () =>
  volunteerSwap.mock.calls
    .filter((appel: any) => appel[1] === 'PEER_ACCEPTED' && appel[0] !== DEMANDEUR)
    .map((appel: any) => appel[0] as number)

describe('PATCH .../swaps/[swapId]/respond — qui est prévenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn((_e: unknown, nom: string) =>
      nom === 'swapId' ? 'swap-1' : String(EDITION)
    )
    global.readBody = vi.fn().mockResolvedValue({ accept: true })
    prismaMock.volunteerSwapRequest.findFirst.mockResolvedValue(demande)
    prismaMock.volunteerSwapRequest.update.mockResolvedValue({})
    // Les créneaux de la cible : le sien, donc aucun chevauchement avec celui du demandeur.
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([
      { id: 'aff-cible', userId: CIBLE, timeSlot: demande.targetAssignment.timeSlot },
    ])
    prismaMock.edition.findUnique.mockResolvedValue({
      name: 'Édition 2026',
      convention: { name: 'Convention' },
    })
    listerGestionnairesBenevoles.mockResolvedValue([] as never)
  })

  it('🔬 prévient l’AUTEUR de la convention, seul gestionnaire', async () => {
    /*
     * LE CAS QUI NE MARCHAIT PAS, et le plus courant sur les petites éditions. L'auteur n'a pas
     * `canManageVolunteers` — la création ne lui donne pas ce droit —, donc l'ancienne liste,
     * bâtie sur ce seul droit, était VIDE. Personne n'était prévenu, et la demande expirait.
     */
    listerGestionnairesBenevoles.mockResolvedValue([99] as never)

    await handler(evenement)

    expect(sollicitesPourTrancher()).toEqual([99])
    expect(listerGestionnairesBenevoles).toHaveBeenCalledWith(EDITION)
  })

  it('prévient le DEMANDEUR que son pair a dit oui', async () => {
    // L'autre moitié du message : il attend une réponse depuis sa demande.
    listerGestionnairesBenevoles.mockResolvedValue([99] as never)

    await handler(evenement)

    expect(notifies()).toContain(DEMANDEUR)
  })

  it('n’envoie RIEN au demandeur en double, même s’il gère les bénévoles', async () => {
    /*
     * ⚠️ Un organisateur est souvent aussi bénévole de son édition. Il vient de DEMANDER cet
     * échange : lui annoncer « une demande attend votre décision » en plus du « votre pair a
     * accepté » ferait deux notifications pour un seul fait, dont une absurde.
     */
    listerGestionnairesBenevoles.mockResolvedValue([DEMANDEUR, 99] as never)

    await handler(evenement)

    expect(sollicitesPourTrancher()).toEqual([99])
    expect(notifies().filter((id) => id === DEMANDEUR)).toHaveLength(1)
  })

  it('n’envoie RIEN à la CIBLE, qui vient d’accepter', async () => {
    /*
     * 🔬 Même raison, l'autre côté : elle vient de cliquer « j'accepte ». Lui demander de trancher
     * son propre échange n'a pas de sens — et c'est elle qui déclenche l'appel, donc le cas est
     * facile à laisser passer.
     */
    listerGestionnairesBenevoles.mockResolvedValue([CIBLE, 99] as never)

    await handler(evenement)

    expect(notifies()).not.toContain(CIBLE)
    expect(sollicitesPourTrancher()).toEqual([99])
  })

  it('dédoublonne les gestionnaires', async () => {
    // Le droit se porte sur la convention ET par édition : un même compte figure dans les deux.
    listerGestionnairesBenevoles.mockResolvedValue([99, 99, 100] as never)

    await handler(evenement)

    expect(sollicitesPourTrancher()).toEqual([99, 100])
  })

  it('passe la demande en attente d’un organisateur', async () => {
    // L'accord entre deux bénévoles ne touche PAS le planning : un arrangement peut dégarnir un
    // poste que ni l'un ni l'autre ne voit.
    listerGestionnairesBenevoles.mockResolvedValue([99] as never)

    const reponse: any = await handler(evenement)

    expect(reponse.data.status).toBe('PENDING_MANAGER')
    expect(prismaMock.volunteerSwapRequest.update.mock.calls[0][0].data.status).toBe(
      'PENDING_MANAGER'
    )
  })

  it('ne prévient PERSONNE d’une décision quand le pair REFUSE', async () => {
    /*
     * Un refus entre bénévoles ne concerne pas les organisateurs : la demande est close, il n'y a
     * rien à trancher. Seul le demandeur l'apprend.
     */
    global.readBody = vi.fn().mockResolvedValue({ accept: false })
    listerGestionnairesBenevoles.mockResolvedValue([99] as never)

    await handler(evenement)

    expect(listerGestionnairesBenevoles).not.toHaveBeenCalled()
    expect(notifies()).toEqual([DEMANDEUR])
  })

  it('REFUSE une demande qui ne nous est pas adressée', async () => {
    // Le cœur de ce point d'API : accepter à la place de quelqu'un d'autre lui prendrait son
    // créneau.
    await expect(handler({ context: { user: { id: 999 } } } as any)).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.volunteerSwapRequest.update).not.toHaveBeenCalled()
  })

  it('refuse une demande déjà tranchée', async () => {
    prismaMock.volunteerSwapRequest.findFirst.mockResolvedValue({
      ...demande,
      status: 'PENDING_MANAGER',
    })

    await expect(handler(evenement)).rejects.toThrow()
  })

  it('rend 404 pour une demande introuvable', async () => {
    prismaMock.volunteerSwapRequest.findFirst.mockResolvedValue(null)

    await expect(handler(evenement)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuse un anonyme', async () => {
    await expect(handler({ context: {} } as any)).rejects.toMatchObject({ statusCode: 401 })
  })
})
