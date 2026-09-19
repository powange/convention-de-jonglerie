import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const mockCanManage = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../server/api/editions/[id]/ticketing/stats/validations.get'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * La courbe d'affluence — les tranches horaires, et ce qu'elles comptent.
 *
 * Deux défauts la rendaient trompeuse : elle découpait les tranches à l'heure de la MACHINE (le
 * conteneur tourne en UTC, donc un afflux à 18 h sur place s'affichait à 16 h), et elle lisait
 * l'état courant — une entrée validée puis annulée en disparaissait complètement.
 */
describe('GET /api/editions/[id]/ticketing/stats/validations', () => {
  const evenement = { context: { params: { id: '42' }, user: { id: 1 } } }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    global.getQuery = vi.fn().mockReturnValue({ granularity: '60' })
    prismaMock.event.findUnique.mockResolvedValue({
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2026-08-03T00:00:00Z'),
      volunteerSettings: null,
    })
    /**
     * ⚠️ Un fuseau DISTANT, et volontairement à décalage non entier.
     *
     * Le conteneur de test tourne en `Europe/Paris`. Écrire ces tests autour de Paris les rendrait
     * vides : neutraliser le fuseau de l'édition ferait retomber sur la pendule de la machine,
     * c'est-à-dire sur Paris, et rien ne distinguerait les deux. `Asia/Kolkata` (+05:30) a en plus
     * un décalage d'une demi-heure, qui fait diverger les bornes même à granularité d'une heure.
     */
    prismaMock.edition.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' })
    prismaMock.entryValidationLog.findMany.mockResolvedValue([])
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
  })

  const mouvement = (attrs: Record<string, unknown>) => ({
    participantKind: 'VOLUNTEER',
    participantId: 1,
    movement: 'VALIDATED',
    createdAt: new Date('2026-08-01T16:30:00Z'),
    ...attrs,
  })

  it('retourne les périodes sans planter (régression: `edition is not defined`)', async () => {
    const resultat: any = await handler(evenement as any)

    // Les périodes proviennent de l'Event (evStart/evEnd), plus de la variable `edition`.
    expect(resultat.periods).toBeDefined()
    expect(resultat.periods.setup.end).toBe(resultat.periods.event.start)
    expect(resultat.periods.teardown.start).toBe(resultat.periods.event.end)
    expect(Array.isArray(resultat.timestamps)).toBe(true)
    expect(resultat.totals).toEqual({
      participants: 0,
      others: 0,
      volunteers: 0,
      artists: 0,
      organizers: 0,
      cancellations: 0,
    })
  })

  it('compte une validation dans sa tranche', async () => {
    prismaMock.entryValidationLog.findMany.mockResolvedValue([
      mouvement({ participantKind: 'TICKET', participantId: 300 }),
    ])
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([{ id: 300 }])

    const resultat: any = await handler(evenement as any)

    expect(resultat.totals.participants).toBe(1)
  })

  /**
   * Les deux écrans de validations ne comptaient pas la même chose : `stats.get.ts` écartait les
   * lignes annulées et les commandes remboursées, celui-ci ne filtrait rien. Deux validations
   * d'écart sur l'édition 1, sans qu'aucun des deux ne dise sa règle.
   *
   * La règle survit au passage au journal : elle décide désormais quels billets comptent comme
   * PARTICIPANTS, les autres rejoignant « autres » au lieu de disparaître.
   */
  it('applique « quels billets comptent » au groupe des participants', async () => {
    prismaMock.entryValidationLog.findMany.mockResolvedValue([
      mouvement({ participantKind: 'TICKET', participantId: 300 }),
    ])

    await handler(evenement as any)

    const critere = prismaMock.ticketingOrderItem.findMany.mock.calls[0][0].where
    expect(critere).toMatchObject({
      state: { in: ['Processed', 'Pending'] },
      order: { editionId: 42, status: { not: 'Refunded' } },
      tier: { countAsParticipant: true },
    })
  })

  it('rejette 404 si l’événement est introuvable', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null)

    await expect(handler(evenement as any)).rejects.toThrow('Edition not found')
  })

  it("refuse l'accès sans droits de gestion de la billetterie", async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toThrow(/Droits insuffisants/)
  })

  it('lit le JOURNAL, et non plus l’état des quatre tables', async () => {
    await handler(evenement as any)

    // L'état ne porte que la dernière situation : une entrée validée puis annulée en
    // disparaissait, et les annulations n'y figuraient pas.
    expect(prismaMock.entryValidationLog.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.editionVolunteerApplication.findMany).not.toHaveBeenCalled()
    expect(prismaMock.editionArtist.findMany).not.toHaveBeenCalled()
  })

  it('découpe les tranches à l’heure du LIEU, pas à celle de la machine', async () => {
    /**
     * Un mouvement à 10 h UTC, soit **15 h 30 à Calcutta**.
     *
     *   · découpé sur l'horloge du LIEU → tranche de 15 h 00, pile
     *   · découpé sur la pendule de la machine (Paris, 12 h) → tranche de 12 h à Paris,
     *     soit 15 h 30 à Calcutta
     *
     * C'est la demi-heure qui les sépare, et c'est pourquoi le fuseau choisi en a une : à
     * décalage entier, les deux découpages coïncident et le test ne prouverait rien.
     */
    prismaMock.entryValidationLog.findMany.mockResolvedValue([
      mouvement({ createdAt: new Date('2026-08-01T10:00:00Z') }),
    ])

    const resultat: any = await handler(evenement as any)

    const index = resultat.volunteers.findIndex((n: number) => n === 1)
    expect(index).toBeGreaterThanOrEqual(0)
    const { DateTime } = await import('luxon')
    const tranche = DateTime.fromISO(resultat.timestamps[index], { setZone: true }).setZone(
      'Asia/Kolkata'
    )
    expect(tranche.hour).toBe(15)
    expect(tranche.minute).toBe(0)
  })

  it('rend le fuseau utilisé, et plus aucun libellé composé en français', async () => {
    const resultat: any = await handler(evenement as any)

    // Le serveur composait « Lun 15/06 14h » avec setLocale('fr') : la langue de l'écran était
    // décidée ici, pour tout le monde.
    expect(resultat.labels).toBeUndefined()
    expect(resultat.timezone).toBe('Asia/Kolkata')
  })

  it('compte les annulations dans leur PROPRE série', async () => {
    prismaMock.entryValidationLog.findMany.mockResolvedValue([
      mouvement({}),
      mouvement({ movement: 'INVALIDATED' }),
    ])

    const resultat: any = await handler(evenement as any)

    // Elles ne se retranchent pas des arrivées : une arrivée a eu lieu même si l'entrée a été
    // retirée ensuite. Et sur les éditions reprises, aucune annulation n'existe — une courbe qui
    // les soustrairait y serait fausse en silence.
    expect(resultat.totals.volunteers).toBe(1)
    expect(resultat.totals.cancellations).toBe(1)
  })

  it('range un billet sans tarif comptabilisé dans « autres » plutôt que de le perdre', async () => {
    prismaMock.entryValidationLog.findMany.mockResolvedValue([
      mouvement({ participantKind: 'TICKET', participantId: 300 }),
    ])
    // Le billet ne ressort pas de la requête « participants » : tarif sans countAsParticipant,
    // ou billet annulé depuis.
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])

    const resultat: any = await handler(evenement as any)

    // Un billet sans tarif ne satisfaisait ni `countAsParticipant: true` ni `false` : il
    // disparaissait du graphique tout en ayant été validé au guichet — 47 lignes sont dans ce cas
    // en production. Il rejoint « autres », comme une ligne annulée depuis : l'ancienne version
    // les écartait toutes deux, ce qui revenait à nier une arrivée qui a bien eu lieu.
    expect(resultat.totals.others).toBe(1)
    expect(resultat.totals.participants).toBe(0)
  })
})
