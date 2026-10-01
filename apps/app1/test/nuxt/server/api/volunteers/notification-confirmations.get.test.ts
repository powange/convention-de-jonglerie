import { describe, it, expect, vi, beforeEach } from 'vitest'

const canManage = vi.hoisted(() => vi.fn(async () => true))

vi.mock('../../../../../server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { canManage } }),
}))

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event?.context?.user) {
      throw createError({ status: 401, message: 'Unauthorized' })
    }
    return event.context.user
  }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/notification/[groupId]/confirmations.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Par quoi ce point d'API retrouve les destinataires d'une notification groupée.
 *
 * ⚠️ RELEVÉ EN PRODUCTION le 30 septembre 2026, DOUZE fois sur une seule édition, par
 * `/check-error-logs` : il répondait 500. L'organisateur ouvrait l'écran de suivi de sa
 * notification et ne pouvait pas savoir qui avait confirmé — les douze occurrences en douze
 * minutes disent qu'il a réessayé.
 *
 * LA CAUSE : le filtre portait sur `assignedTeams`, un champ JSON qui N'EXISTE PLUS sur
 * `EditionVolunteerApplication`. Prisma rejetait la requête ENTIÈRE
 * (`Unknown argument 'assignedTeams'`). Le point d'API voisin qui ENVOIE la notification avait été
 * migré vers la relation `teamAssignments` — il porte même le commentaire qui le dit — mais celui
 * qui relit ses destinataires avait été oublié.
 *
 * ⚠️⚠️ CE FICHIER NE PEUT PAS PROUVER LE DÉFAUT, et c'est important de le savoir : le mock central
 * de Prisma IGNORE le `where`, donc il aurait rendu ses lignes avec le champ mort comme avec le
 * bon. Ce qui l'attrape est `test/integration/notification-destinataires-par-equipe.db.test.ts`,
 * où une vraie requête se fait refuser.
 *
 * Ce que ces cas tiennent, en revanche : la FORME de la requête — donc qu'on ne réintroduise pas
 * le champ mort, et que la sélection reste celle de l'envoi, sans quoi le taux de confirmation
 * serait faux au lieu d'être absent.
 */

const EDITION = 22
const GROUPE = 'grp-1'
const organisateur = { id: 3, pseudo: 'Orga' }

const groupe = {
  id: GROUPE,
  eventId: EDITION,
  title: 'Bénévoles - Jongle en Zik',
  targetType: 'teams',
  selectedTeams: ["Check'in Gymnase", 'Bar'],
  recipientCount: 2,
  createdAt: new Date(),
  event: { name: 'Jongle en Zik 2026' },
  sender: { pseudo: 'Orga' },
  confirmations: [],
}

describe('GET .../volunteers/notification/[groupId]/confirmations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canManage.mockResolvedValue(true as never)
    global.getRouterParam = vi.fn((_e: unknown, nom: string) =>
      nom === 'groupId' ? GROUPE : String(EDITION)
    )
    prismaMock.volunteerNotificationGroup.findFirst.mockResolvedValue(groupe)
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
  })

  const evenement = { context: { user: organisateur } } as any

  it('🔬 filtre par la RELATION teamAssignments, et jamais par le champ mort', async () => {
    await handler(evenement)

    const where = prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0].where

    expect(where.teamAssignments).toEqual({
      some: { team: { name: { in: ["Check'in Gymnase", 'Bar'] } } },
    })
    // L'assertion négative compte autant : c'est le champ qui faisait répondre 500.
    expect(where).not.toHaveProperty('assignedTeams')
    expect(JSON.stringify(where)).not.toContain('array_contains')
  })

  it('🔬 pose la MÊME question que l’envoi, en une seule condition', async () => {
    /*
     * L'ancienne version construisait un `OR` d'une condition par équipe. La nouvelle emploie un
     * `in`, exactement comme `notifications.post.ts`. Ce n'est pas une préférence de style : cet
     * écran COMPARE les destinataires aux confirmations, et deux façons de répondre à « qui était
     * visé ? » donneraient un taux de confirmation faux — un défaut silencieux, là où celui-ci au
     * moins criait.
     */
    await handler(evenement)

    const where = prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0].where

    expect(where).not.toHaveProperty('OR')
    expect(where.eventId).toBe(EDITION)
    expect(where.status).toBe('ACCEPTED')
  })

  it('ne filtre PAS par équipe quand la notification visait tout le monde', async () => {
    // `targetType: 'all'` : la liste des destinataires est celle des bénévoles acceptés, sans
    // restriction. Un filtre résiduel en ferait disparaître une partie du suivi.
    prismaMock.volunteerNotificationGroup.findFirst.mockResolvedValue({
      ...groupe,
      targetType: 'all',
      selectedTeams: null,
    })

    await handler(evenement)

    const where = prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0].where

    expect(where).not.toHaveProperty('teamAssignments')
    expect(where.status).toBe('ACCEPTED')
  })

  it('ne filtre pas non plus sur une liste d’équipes VIDE', async () => {
    // Le cas limite que la garde existante couvre : une liste vide ne doit pas produire un filtre
    // qui ne correspond à personne, ce qui viderait le suivi sans rien dire.
    prismaMock.volunteerNotificationGroup.findFirst.mockResolvedValue({
      ...groupe,
      selectedTeams: [],
    })

    await handler(evenement)

    expect(
      prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0].where
    ).not.toHaveProperty('teamAssignments')
  })

  it('sépare ceux qui ont confirmé de ceux qui n’ont pas répondu', async () => {
    /*
     * Le cœur de l'écran, et la raison pour laquelle le 500 était gênant : seules les
     * confirmations dont `confirmedAt` n'est pas nul comptent. Une ligne créée mais non confirmée
     * ne doit pas gonfler le taux.
     */
    prismaMock.volunteerNotificationGroup.findFirst.mockResolvedValue({
      ...groupe,
      confirmations: [
        { confirmedAt: new Date(), user: { id: 10, pseudo: 'A' } },
        { confirmedAt: null, user: { id: 11, pseudo: 'B' } },
      ],
    })
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      { id: 1, user: { id: 10, pseudo: 'A' } },
      { id: 2, user: { id: 11, pseudo: 'B' } },
    ])

    const reponse: any = await handler(evenement)

    expect(reponse.confirmed.map((v: any) => v.user.id)).toEqual([10])
    expect(reponse.pending.map((v: any) => v.user.id)).toEqual([11])
    // Le taux ne compte que les confirmations réelles : 1 sur 2 destinataires annoncés.
    expect(reponse.stats.confirmationRate).toBe(50)
  })

  it('refuse qui ne gère pas les bénévoles', async () => {
    canManage.mockResolvedValue(false as never)

    await expect(handler(evenement)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.editionVolunteerApplication.findMany).not.toHaveBeenCalled()
  })

  it('rend 404 pour un groupe introuvable', async () => {
    prismaMock.volunteerNotificationGroup.findFirst.mockResolvedValue(null)

    await expect(handler(evenement)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuse un anonyme', async () => {
    await expect(handler({ context: {} } as any)).rejects.toMatchObject({ statusCode: 401 })
  })
})
