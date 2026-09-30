import { describe, it, expect, beforeEach, vi } from 'vitest'

// `defineTask` est un auto-import de Nitro, absent des tests : sans ce doublon, le fichier de la
// tâche échoue au CHARGEMENT. `vi.hoisted` parce que les imports sont remontés au-dessus du corps.
vi.hoisted(() => {
  ;(globalThis as any).defineTask = (definition: any) => definition
})

const mockNotifier = vi.hoisted(() => vi.fn(async () => ({})))
vi.mock('#server/utils/notification-service', () => ({
  NotificationService: { create: mockNotifier },
}))

import tache from '../../../../../layers/volunteers/server/tasks/volunteer-reminders'

const prismaMock = (globalThis as any).prisma

/**
 * Le rappel ne part qu'UNE fois.
 *
 * ⚠️ CE QUI N'ALLAIT PAS, et le bénévole le voyait quatre ou cinq fois. Cette tâche tourne CHAQUE
 * MINUTE et retient les créneaux qui démarrent dans 28 à 32 MINUTES. Un même créneau tombe donc
 * dans la fenêtre à quatre ou cinq passages consécutifs — et rien ne gardait trace de l'envoi
 * précédent. Quatre notifications identiques, à une minute d'intervalle, juste avant de partir
 * prendre son poste.
 *
 * La fenêtre de quatre minutes n'est pas un défaut : elle existe pour que les créneaux RETARDÉS
 * soient chargés malgré leur décalage. La resserrer priverait certains bénévoles de tout rappel.
 * Ce qui manquait, c'est la marque.
 *
 * 🔬 DEUX NIVEAUX DE PROTECTION, et les deux sont éprouvés séparément parce qu'ils ne couvrent pas
 * la même chose :
 *
 * • le `where: { reminderSentAt: null }` de la requête écarte les affectations déjà rappelées —
 *   c'est lui qui évite de transporter chaque minute ce qu'on ne notifiera pas ;
 * • l'`updateMany` CONDITIONNEL posé AVANT l'envoi tranche entre deux exécutions simultanées :
 *   celle qui n'écrit aucune ligne n'envoie rien. Le premier ne suffit pas, rien ne garantissant
 *   qu'un passage soit terminé quand le suivant commence.
 */

const creneauDans30Minutes = () => ({
  id: 'slot-1',
  title: 'Bar du soir',
  startDateTime: new Date(Date.now() + 30 * 60 * 1000),
  delayMinutes: 0,
  team: { name: 'Bar', color: '#fff' },
  event: { name: 'EJC', edition: { timezone: 'Europe/Paris' } },
  assignments: [
    {
      id: 'aff-1',
      reminderSentAt: null,
      user: { id: 7, email: 'b@exemple.test', pseudo: 'bene', nom: 'M', prenom: 'Camille' },
    },
    {
      id: 'aff-2',
      reminderSentAt: null,
      user: { id: 8, email: 'c@exemple.test', pseudo: 'cene', nom: 'D', prenom: 'Dominique' },
    },
  ],
})

describe('rappel de créneau — une seule fois', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.volunteerAssignment.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([creneauDans30Minutes()])
  })

  it('ne demande QUE les affectations pas encore rappelées', async () => {
    /*
     * 🔬 L'assertion sur la FORME de la requête. Le mock rend ce qu'on lui dit : sans elle, on ne
     * saurait jamais si le filtre est parti à la base. Et c'est ce filtre qui allège la requête,
     * jouée soixante fois par heure.
     */
    await tache.run({ payload: {} } as any)

    const include = prismaMock.volunteerTimeSlot.findMany.mock.calls[0][0].include
    expect(include.assignments.where).toEqual({ reminderSentAt: null })
  })

  it('pose la marque AVANT d’envoyer, et sur la bonne affectation', async () => {
    /*
     * ⚠️ L'ORDRE EST LE CŒUR DU LOT. Une marque posée APRÈS l'envoi laisse la fenêtre ouverte
     * pendant toute la durée de l'envoi : la minute suivante, la tâche relit une affectation
     * encore vierge et renvoie. C'est exactement ce qui se passait, sans marque du tout.
     */
    await tache.run({ payload: {} } as any)

    const ordreMarque = prismaMock.volunteerAssignment.updateMany.mock.invocationCallOrder[0]
    const ordreEnvoi = mockNotifier.mock.invocationCallOrder[0]
    expect(ordreMarque).toBeLessThan(ordreEnvoi)

    expect(prismaMock.volunteerAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: 'aff-1', reminderSentAt: null },
      data: { reminderSentAt: expect.any(Date) },
    })
  })

  it('la marque est CONDITIONNELLE : deux exécutions ne diffusent pas toutes les deux', async () => {
    /*
     * 🔬 L'assertion qui voit la course. Une exécution concurrente a déjà posé la marque : notre
     * `updateMany` n'écrit alors AUCUNE ligne, et c'est à ce `count` de 0 qu'on reconnaît qu'il ne
     * faut rien envoyer.
     *
     * Sans le `reminderSentAt: null` dans le `where`, l'écriture réussirait toujours, `count`
     * vaudrait 1, et les deux exécutions enverraient — le défaut reviendrait par la porte de
     * derrière, un cran plus bas.
     */
    prismaMock.volunteerAssignment.updateMany.mockResolvedValue({ count: 0 })

    const resultat: any = await tache.run({ payload: {} } as any)

    expect(mockNotifier).not.toHaveBeenCalled()
    expect(resultat.notificationsSent).toBe(0)
  })

  it('envoie à CHAQUE personne affectée, une fois chacune', async () => {
    // Le pendant : la déduplication est par AFFECTATION, pas par créneau. Deux bénévoles sur le
    // même créneau reçoivent bien chacun leur rappel.
    await tache.run({ payload: {} } as any)

    expect(mockNotifier).toHaveBeenCalledTimes(2)
    const destinataires = mockNotifier.mock.calls.map((appel: any) => appel[0].userId)
    expect(destinataires).toEqual([7, 8])
  })

  it('n’envoie rien de plus quand toutes les affectations sont déjà marquées', async () => {
    /*
     * Ce que rend la base au passage suivant : le `where` de la requête ayant écarté les
     * affectations marquées, le créneau arrive sans aucune. Il ne doit alors produire ni envoi, ni
     * écriture inutile.
     */
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      { ...creneauDans30Minutes(), assignments: [] },
    ])

    await tache.run({ payload: {} } as any)

    expect(mockNotifier).not.toHaveBeenCalled()
    expect(prismaMock.volunteerAssignment.updateMany).not.toHaveBeenCalled()
  })

  it('une personne affectée APRÈS le premier passage reçoit son rappel', async () => {
    /*
     * ⚠️ POURQUOI LA MARQUE EST SUR L'AFFECTATION ET NON SUR LE CRÉNEAU. Quelqu'un ajouté à la
     * dernière minute — le cas courant d'un remplacement — arrive avec sa propre affectation
     * vierge. Une marque posée sur le créneau l'aurait privé de tout rappel, en silence, et
     * précisément dans le cas où il en a le plus besoin.
     */
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      {
        ...creneauDans30Minutes(),
        assignments: [
          {
            id: 'aff-tardive',
            reminderSentAt: null,
            user: { id: 9, email: 'd@exemple.test', pseudo: 'dene', nom: 'R', prenom: 'Dominique' },
          },
        ],
      },
    ])

    await tache.run({ payload: {} } as any)

    expect(mockNotifier).toHaveBeenCalledTimes(1)
    expect(mockNotifier.mock.calls[0][0].userId).toBe(9)
  })
})
