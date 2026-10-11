import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAdmin = vi.hoisted(() => vi.fn())
const mockEventReminder = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockAdmin,
}))
vi.mock('#server/utils/notification-service', () => ({
  NotificationHelpers: { eventReminder: mockEventReminder },
}))

import handler from '../../../../../../server/api/admin/notifications/send-reminders.post'

const prismaMock = (globalThis as any).prisma

/**
 * Le rappel manuel d'édition — constat B5 de l'administration.
 *
 * ## Le défaut
 *
 * Le libellé était composé `` `${edition.convention.name} - ${edition.title}` ``. `Edition` **n'a
 * pas** de champ `title` — seulement `name`, nullable : la notification reçue s'intitulait
 * « Convention X - **undefined** », et elle partait vraiment. Ce fichier avait déjà été corrigé une
 * fois pour un champ inexistant (le commentaire sur `titleKey` le raconte) ; celui-ci avait
 * survécu.
 *
 * ## ⚠️ CE POINT D'API N'AVAIT AUCUN TEST
 *
 * Il envoie des notifications à tous les favoris et à tous les bénévoles acceptés d'une édition :
 * un libellé faux part donc en nombre, et rien ne le rattrape ensuite — une notification ne se
 * corrige pas après coup.
 */
/*
 * ⚠️ UNE MINUTE DE MOINS, PAS DE PLUS, et ce détail m'a coûté un tour : le handler calcule
 * `Math.ceil((startDate - now) / un jour)`. À trois jours plus une minute, le quotient vaut 3,0007
 * et l'arrondi SUPÉRIEUR rend 4 — aucun palier, aucun rappel, et l'échec se lit « attendu 1 appel,
 * reçu 0 » sans dire pourquoi. Il faut se placer juste EN DEÇÀ du jour visé.
 */
const DANS_TROIS_JOURS = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 60 * 1000)
const DANS_CINQ_JOURS = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 - 60 * 1000)

const edition = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  startDate: DANS_TROIS_JOURS,
  name: 'Jongle en Zik 2025',
  convention: { name: 'Jongle en Zik' },
  favoritedBy: [{ id: 101, pseudo: 'camille' }],
  event: { volunteerApplications: [] },
  ...extra,
})

/** Le libellé réellement passé au service de notification. */
const libelle = () => mockEventReminder.mock.calls.at(-1)?.[1] as string

describe('POST /api/admin/notifications/send-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    mockEventReminder.mockResolvedValue(undefined)
    prismaMock.edition.findMany.mockReset()
    prismaMock.notification.findFirst.mockReset()
    // Aucun rappel déjà envoyé : la déduplication des 24 h laisse passer.
    prismaMock.notification.findFirst.mockResolvedValue(null)
  })

  it('⚠️ LE LIBELLÉ NE CONTIENT PLUS « undefined »', async () => {
    prismaMock.edition.findMany.mockResolvedValue([edition()])

    await handler({} as any)

    expect(mockEventReminder).toHaveBeenCalledTimes(1)
    expect(libelle()).not.toContain('undefined')
    // Et c'est le nom de l'édition SEUL : 21 éditions sur 38 portent déjà celui de la convention.
    expect(libelle()).toBe('Jongle en Zik 2025')
  })

  it('retombe sur le nom de la convention pour une édition sans nom', async () => {
    // 32 éditions sur 70 sont dans ce cas : c'est le chemin le plus fréquent.
    prismaMock.edition.findMany.mockResolvedValue([edition({ name: null })])

    await handler({} as any)

    expect(libelle()).toBe('Jongle en Zik')
  })

  it('prévient les favoris ET les bénévoles acceptés, une fois chacun', async () => {
    /*
     * LE TÉMOIN. Sans lui, un handler qui n'enverrait plus rien satisferait les deux cas précédents
     * — ils vérifient la FORME d'un libellé, pas qu'il y ait des destinataires. Et la même personne
     * peut être à la fois favorite et bénévole : l'ensemble la dédoublonne.
     */
    prismaMock.edition.findMany.mockResolvedValue([
      edition({
        favoritedBy: [{ id: 101, pseudo: 'camille' }],
        event: {
          volunteerApplications: [
            { user: { id: 101, pseudo: 'camille' } },
            { user: { id: 202, pseudo: 'alex' } },
          ],
        },
      }),
    ])

    const res: any = await handler({} as any)

    expect(mockEventReminder).toHaveBeenCalledTimes(2)
    expect(res.data.remindersSent).toBe(2)
  })

  it('n’envoie rien pour une édition qui ne tombe ni à J-3 ni à J-7', async () => {
    /*
     * Le second témoin : le point d'API charge toutes les éditions des sept prochains jours, et
     * ne retient que deux paliers. Sans ce cas, une garde qui laisserait tout passer resterait
     * invisible — on recevrait un rappel chaque jour pendant une semaine.
     */
    prismaMock.edition.findMany.mockResolvedValue([edition({ startDate: DANS_CINQ_JOURS })])

    const res: any = await handler({} as any)

    expect(mockEventReminder).not.toHaveBeenCalled()
    expect(res.data.remindersSent).toBe(0)
    // L'édition a bien été EXAMINÉE : le compteur des éditions parcourues ne dépend pas du palier.
    expect(res.data.editionsProcessed).toBe(1)
  })

  it('ne renvoie pas un rappel déjà parti dans les 24 heures', async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: 999 })
    prismaMock.edition.findMany.mockResolvedValue([edition()])

    const res: any = await handler({} as any)

    expect(mockEventReminder).not.toHaveBeenCalled()
    expect(res.data.remindersSent).toBe(0)
  })
})
