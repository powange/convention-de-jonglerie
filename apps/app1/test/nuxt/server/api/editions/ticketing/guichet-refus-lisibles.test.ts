import { describe, it, expect, vi, beforeEach } from 'vitest'

// wrapApiHandler et validateEditionId sont auto-importés (Nitro) dans les handlers : on fournit
// des équivalents globaux avant leur chargement (vi.hoisted s'exécute avant les imports).
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const mockCanAccess = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAccess,
}))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/utils/notification-service', () => ({
  NotificationHelpers: { volunteerEntryValidated: vi.fn() },
  safeNotify: vi.fn(),
}))
vi.mock('#server/utils/editions/volunteers/responsables-equipe', () => ({
  utilisateursResponsablesDeLEquipe: vi.fn().mockResolvedValue([]),
}))
const mockUpdateUserInfo = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/editions/ticketing/user-info-update', () => ({
  updateUserInfo: mockUpdateUserInfo,
}))

import validateHandler from '../../../../../../server/api/editions/[id]/ticketing/validate-entry.post'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Au guichet, un refus doit se lire — constat D6.
 *
 * ## Le défaut
 *
 * Les refus 4xx levés dans le `try` étaient réécrits en **500 générique** par le `catch` final.
 * La phrase existait, elle était juste, et personne ne la lisait jamais : scanner un billet annulé
 * affichait « Erreur lors de la validation des entrées » au lieu de « Ce billet a été annulé et ne
 * donne plus droit d'entrée ». **Au comptoir, la différence est entre comprendre et appeler
 * quelqu'un.**
 *
 * ## ⚠️ CE QUE CES TESTS DOIVENT MESURER
 *
 * Le **code** ET le **message**. Vérifier seulement que l'appel échoue serait vert avant comme
 * après : il échouait déjà, en 500. Et vérifier seulement le code laisserait passer un message
 * générique accompagné du bon statut, ce qui ne règle rien pour la personne au comptoir.
 */
const evenement = (corps: unknown) =>
  ({
    context: { params: { id: '22' }, user: { id: 1, pseudo: 'caissier' } },
    __corps: corps,
  }) as never

describe('validate-entry — les refus restent lisibles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccess.mockResolvedValue(true)
    global.readBody = vi.fn(async (e: any) => e.__corps)
    global.getRouterParam = vi.fn((_e: any, nom: string) => (nom === 'id' ? '22' : undefined))
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.ticketingOrderItem.updateMany.mockResolvedValue({ count: 0 })
  })

  it('⚠️ UN BILLET ANNULÉ REND 400 AVEC SA PHRASE, pas un 500 générique', async () => {
    // Le premier `findMany` du bloc cherche les billets annulés : lui en rendre un déclenche le
    // refus que le `catch` avalait.
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([{ id: 7 }])

    const refus = await validateHandler(evenement({ participantIds: [7], type: 'ticket' })).catch(
      (e: any) => e
    )

    expect(refus.statusCode ?? refus.status).toBe(400)
    expect(refus.message).toContain('annulé')
    // Le témoin : ce n'est PAS le message générique du catch.
    expect(refus.message).not.toContain('Erreur lors de la validation')
  })

  it('⚠️ UN REFUS LEVÉ PAR UN UTIL APPELÉ REMONTE AUSSI — 409 « adresse déjà utilisée »', async () => {
    /*
     * LE CAS QUE LA FICHE NOMME, et le plus instructif : le refus n'est pas écrit dans ce
     * fichier. Il vient de `updateUserInfo`, appelé dans le `try`. Un relais qui ne regarderait
     * que les erreurs levées sur place le laisserait devenir un 500 — et c'est précisément ce qui
     * se passait pour le 409 « adresse déjà utilisée » et le 403 « cette adresse est déjà
     * vérifiée ».
     */
    mockUpdateUserInfo.mockRejectedValue(
      // `isHttpError` ne demande qu'un `status` ou `statusCode` NUMÉRIQUE : c'est tout ce qui
      // distingue un refus d'une panne, et c'est volontairement minimal.
      Object.assign(new Error('Cette adresse email est déjà utilisée'), { statusCode: 409 })
    )
    /*
     * ⚠️ LA BRANCHE BÉNÉVOLE, et non celle des billets. `updateUserInfo` est appelé dans les
     * trois branches, mais seule celle-ci s'atteint sans décor supplémentaire. Mon premier essai
     * passait `type: 'ticket'` : le handler n'atteignait jamais l'appel, rendait une réponse de
     * succès, et l'assertion lisait `undefined` au lieu d'un code — en accusant le relais.
     */
    prismaMock.editionVolunteerApplication.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([{ userId: 5 }])

    const refus = await validateHandler(
      evenement({
        participantIds: [7],
        type: 'volunteer',
        userInfo: { email: 'deja@exemple.test' },
      })
    ).catch((e: any) => e)

    expect(refus.statusCode ?? refus.status).toBe(409)
    expect(refus.message).toContain('déjà utilisée')
    expect(refus.message).not.toContain('Erreur lors de la validation')
  })

  it('une VRAIE panne reste un 500 — le relais ne masque pas les erreurs techniques', async () => {
    /*
     * LE TÉMOIN NÉGATIF, sans lequel un relais qui relaierait TOUT satisferait les deux cas
     * ci-dessus. Une erreur sans statut HTTP — une base indisponible, un bug — doit continuer à
     * ressortir en 500 : c'est bien une panne, et l'annoncer autrement enverrait le caissier
     * chercher une cause chez lui.
     */
    prismaMock.ticketingOrderItem.findMany.mockRejectedValue(new Error('base indisponible'))

    const refus = await validateHandler(evenement({ participantIds: [7], type: 'ticket' })).catch(
      (e: any) => e
    )

    expect(refus.statusCode ?? refus.status).toBe(500)
  })
})
