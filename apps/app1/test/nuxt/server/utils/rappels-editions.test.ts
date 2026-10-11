import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEventReminder = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/notification-service', () => ({
  NotificationHelpers: { eventReminder: mockEventReminder },
}))

import { envoyerLesRappelsDEdition } from '../../../../server/utils/rappels-editions'

const prismaMock = (globalThis as any).prisma

/**
 * Les rappels « votre édition commence bientôt » — constat B4 de l'administration.
 *
 * ## ⚠️⚠️ LE DÉFAUT : UNE TÂCHE QUI ANNONÇAIT DES ENVOIS SANS RIEN ENVOYER
 *
 * `convention-favorites-reminders` tournait chaque jour à 10 h. Le corps de sa boucle était un
 * `// TODO: Intégrer avec le système de notifications` qui incrémentait un compteur **sans créer
 * aucune notification**. Le journal écrivait « N notifications », le catalogue de `/admin/crons`
 * promettait qu'elle notifiait les favoris, et un administrateur qui la lançait à la main lisait un
 * **succès et un compteur non nul**. Rien ne partait, depuis toujours.
 *
 * La logique existait du mauvais côté : dans le point d'API d'administration, jamais planifié.
 *
 * ## 📍 L'INSTANT EST UN PARAMÈTRE
 *
 * Un rappel calé sur des paliers ne s'éprouve pas autrement : avec `new Date()` enfoui, les cas
 * seraient verts ou rouges selon l'heure de la CI. C'est la leçon déjà écrite sur les filtres
 * d'échéance des tâches.
 */
const MAINTENANT = new Date('2026-10-11T12:00:00Z')
const JOUR = 24 * 60 * 60 * 1000

/**
 * ⚠️ UNE MINUTE EN DEÇÀ DU JOUR VISÉ, et ce détail se paie : le palier se calcule par un arrondi
 * SUPÉRIEUR. « Dans trois jours plus une minute » vaut 4 — aucun palier, aucun rappel, et l'échec
 * se lit « attendu 1 appel, reçu 0 » sans dire pourquoi.
 */
const dans = (jours: number) => new Date(MAINTENANT.getTime() + jours * JOUR - 60_000)

const edition = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  startDate: dans(3),
  name: 'Jongle en Zik 2025',
  convention: { name: 'Jongle en Zik' },
  favoritedBy: [{ id: 101 }],
  event: { volunteerApplications: [] },
  ...extra,
})

describe('envoyerLesRappelsDEdition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEventReminder.mockResolvedValue(undefined)
    prismaMock.edition.findMany.mockReset()
    prismaMock.notification.findFirst.mockReset()
    prismaMock.notification.findFirst.mockResolvedValue(null)
  })

  it('⚠️ ENVOIE VRAIMENT UNE NOTIFICATION, une par personne', async () => {
    prismaMock.edition.findMany.mockResolvedValue([edition()])

    const res = await envoyerLesRappelsDEdition(MAINTENANT)

    expect(mockEventReminder).toHaveBeenCalledTimes(1)
    expect(mockEventReminder).toHaveBeenCalledWith(101, 'Jongle en Zik 2025', 7, 3)
    expect(res).toEqual({ editionsProcessed: 1, notificationsSent: 1 })
  })

  it('prévient aussi les bénévoles acceptés, et ne double personne', async () => {
    /*
     * La même personne peut avoir mis l'édition en favori ET être bénévole acceptée : deux
     * notifications identiques à la même seconde dévalueraient les suivantes. D'où l'ensemble.
     */
    prismaMock.edition.findMany.mockResolvedValue([
      edition({
        favoritedBy: [{ id: 101 }],
        event: { volunteerApplications: [{ user: { id: 101 } }, { user: { id: 202 } }] },
      }),
    ])

    const res = await envoyerLesRappelsDEdition(MAINTENANT)

    expect(mockEventReminder).toHaveBeenCalledTimes(2)
    expect(res.notificationsSent).toBe(2)
  })

  it('notifie aussi à J-7', async () => {
    prismaMock.edition.findMany.mockResolvedValue([edition({ startDate: dans(7) })])

    const res = await envoyerLesRappelsDEdition(MAINTENANT)

    expect(mockEventReminder).toHaveBeenCalledWith(101, 'Jongle en Zik 2025', 7, 7)
    expect(res.notificationsSent).toBe(1)
  })

  it('⚠️ N’ENVOIE RIEN HORS DES DEUX PALIERS', async () => {
    /*
     * LE TÉMOIN. La requête charge TOUTES les éditions des sept prochains jours : sans ce filtre,
     * on recevrait un rappel chaque jour pendant une semaine. Et il faut le mesurer, parce qu'une
     * garde qui laisserait tout passer produirait exactement les mêmes compteurs qu'un succès.
     */
    prismaMock.edition.findMany.mockResolvedValue([
      edition({ startDate: dans(1) }),
      edition({ startDate: dans(5) }),
      edition({ startDate: dans(6) }),
    ])

    const res = await envoyerLesRappelsDEdition(MAINTENANT)

    expect(mockEventReminder).not.toHaveBeenCalled()
    // Les éditions ont bien été EXAMINÉES : le compteur ne dépend pas du palier.
    expect(res).toEqual({ editionsProcessed: 3, notificationsSent: 0 })
  })

  it('⚠️ UNE RELANCE IMMÉDIATE N’ENVOIE RIEN DE PLUS', async () => {
    /*
     * C'est la déduplication qui rend un cron QUOTIDIEN sûr — et un rejeu manuel inoffensif. Elle
     * porte sur `titleKey` et non sur un titre : `Notification` n'a pas de colonne `title`, le
     * titre est une CLÉ de traduction. Chercher dans un champ inexistant faisait rejeter la
     * requête entière par Prisma, et ce fichier-ci en porte la trace.
     */
    prismaMock.edition.findMany.mockResolvedValue([edition()])
    prismaMock.notification.findFirst.mockResolvedValue({ id: 999 })

    const res = await envoyerLesRappelsDEdition(MAINTENANT)

    expect(mockEventReminder).not.toHaveBeenCalled()
    expect(res.notificationsSent).toBe(0)
  })

  it('cherche la trace sur la bonne clé et la bonne fenêtre', async () => {
    /*
     * L'assertion non creuse : le bouchon central IGNORE le `where`, donc les deux cas ci-dessus
     * resteraient verts si la déduplication cessait de filtrer sur l'édition — et un rappel
     * envoyé pour une AUTRE édition ferait taire celui-ci.
     */
    prismaMock.edition.findMany.mockResolvedValue([edition()])

    await envoyerLesRappelsDEdition(MAINTENANT)

    expect(prismaMock.notification.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 101,
        category: 'edition',
        entityType: 'Edition',
        entityId: '7',
        titleKey: 'notifications.edition.reminder.title',
        createdAt: { gte: new Date(MAINTENANT.getTime() - JOUR) },
      },
    })
  })

  it('un échec sur une personne n’empêche pas les autres', async () => {
    prismaMock.edition.findMany.mockResolvedValue([
      edition({ favoritedBy: [{ id: 101 }, { id: 202 }] }),
    ])
    mockEventReminder.mockRejectedValueOnce(new Error('service indisponible'))

    const res = await envoyerLesRappelsDEdition(MAINTENANT)

    expect(mockEventReminder).toHaveBeenCalledTimes(2)
    // Le compteur ne compte que ce qui est VRAIMENT parti : c'était tout le défaut d'origine.
    expect(res.notificationsSent).toBe(1)
  })

  it('une édition sans nom est annoncée par celui de sa convention', async () => {
    // 32 éditions sur 70 sont dans ce cas en base de développement (cf. constat B5).
    prismaMock.edition.findMany.mockResolvedValue([edition({ name: null })])

    await envoyerLesRappelsDEdition(MAINTENANT)

    expect(mockEventReminder).toHaveBeenCalledWith(101, 'Jongle en Zik', 7, 3)
  })
})
