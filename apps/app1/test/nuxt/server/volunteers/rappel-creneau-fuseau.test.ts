import { describe, it, expect, beforeEach, vi } from 'vitest'

/*
 * ⚠️ `defineTask` EST UN AUTO-IMPORT DE NITRO, absent des tests : sans ce doublon, le fichier de la
 * tâche échoue au CHARGEMENT sur « defineTask is not defined », avant qu'aucun test ne s'exécute.
 *
 * 📍 Une fiche du rapport concluait qu'« une tâche planifiée n'est pas déclenchable depuis les
 * tests ». C'est vrai de son DÉCLENCHEMENT — l'ordonnanceur ne tourne pas ici — mais pas de son
 * exécution : `run()` s'appelle directement, et c'est tout ce qu'il faut pour éprouver ce qu'elle
 * calcule. Le seul obstacle était cette ligne.
 *
 * `vi.hoisted` et non un appel ordinaire : les imports sont remontés au-dessus du corps du module,
 * donc une affectation écrite ici en haut arriverait TROP TARD.
 */
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
 * Le rappel envoyé trente minutes avant un créneau.
 *
 * ⚠️ CE QUI N'ALLAIT PAS, et c'est un défaut d'une autre nature que celui du courriel de
 * publication. Celui-ci n'avait AUCUN fuseau, donc prenait celui du serveur ; le rappel, lui,
 * codait `Europe/Paris` EN DUR.
 *
 * Résultat : la bonne heure pour les conventions françaises, la mauvaise pour toutes les autres.
 * « Votre créneau commence à 14:00 » arrivait avec l'heure de Paris à quelqu'un qui est au Québec.
 * Le message dit une heure, la montre en dit une autre, et rien n'indique laquelle croire — sur un
 * rappel envoyé trente minutes avant, c'est le genre d'écart qui fait manquer un créneau.
 *
 * ⚠️ LES DEUX SURFACES DEVAIENT ÊTRE CORRIGÉES ENSEMBLE. N'en traiter qu'une ferait dire deux
 * heures différentes au même créneau selon qu'on lit le courriel de publication ou le rappel.
 */

/** Un créneau qui démarre à 08:00 UTC, dans la fenêtre que la tâche retient. */
const creneauDans30Minutes = (timezone: string | null) => {
  const debut = new Date(Date.now() + 30 * 60 * 1000)
  return {
    id: 'slot-1',
    title: 'Bar du soir',
    startDateTime: debut,
    delayMinutes: 0,
    team: { name: 'Bar', color: '#fff' },
    event: { name: 'EJC', edition: { timezone } },
    assignments: [
      { user: { id: 7, email: 'b@exemple.test', pseudo: 'bene', nom: 'M', prenom: 'Camille' } },
    ],
  }
}

describe('rappel de créneau — l’heure annoncée', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** Le message du premier rappel envoyé. */
  const messageDuRappel = () => mockNotifier.mock.calls[0]?.[0]?.message as string

  it('demande le fuseau de l’édition avec le créneau', async () => {
    /*
     * 🔬 L'assertion sur la FORME de la requête, et elle n'est pas redondante avec les suivantes :
     * le mock de Prisma rend ce qu'on lui dit, donc les tests d'heure resteraient verts même si le
     * `select` cessait de demander le fuseau — c'est la base réelle qui rendrait alors `undefined`,
     * et le rappel repartirait sur l'heure du serveur, en silence.
     */
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([])

    await tache.run({ payload: {} } as any)

    const include = prismaMock.volunteerTimeSlot.findMany.mock.calls[0][0].include
    expect(include.event.select.edition).toEqual({ select: { timezone: true } })
  })

  it('annonce l’heure d’AUCKLAND pour une édition néo-zélandaise', async () => {
    /*
     * Douze heures d'écart avec UTC, et deux avec Paris : aucune implémentation qui ignore le
     * fuseau de l'édition — ni celle du serveur, ni l'ancien `Europe/Paris` codé en dur — ne peut
     * rendre cette heure-là par hasard.
     */
    const creneau = creneauDans30Minutes('Pacific/Auckland')
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([creneau])

    await tache.run({ payload: {} } as any)

    const attendue = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Pacific/Auckland',
    }).format(creneau.startDateTime)

    expect(messageDuRappel()).toContain(attendue)
  })

  it('n’emploie PLUS Europe/Paris quand l’édition est ailleurs', async () => {
    /*
     * 🔬 L'assertion qui voit précisément l'ancien défaut. Le test précédent prouve que la bonne
     * heure est là ; celui-ci prouve que la MAUVAISE n'y est plus — les deux étant distinctes, un
     * message qui contiendrait les deux passerait le premier test tout en restant faux.
     */
    const creneau = creneauDans30Minutes('Pacific/Auckland')
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([creneau])

    await tache.run({ payload: {} } as any)

    const heureDeParis = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    }).format(creneau.startDateTime)

    expect(messageDuRappel()).not.toContain(heureDeParis)
  })

  it('reste juste pour une édition française', async () => {
    // Non-régression : le cas qui marchait déjà ne doit pas être cassé par la correction.
    const creneau = creneauDans30Minutes('Europe/Paris')
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([creneau])

    await tache.run({ payload: {} } as any)

    const attendue = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    }).format(creneau.startDateTime)

    expect(messageDuRappel()).toContain(attendue)
  })

  it('envoie quand même quand l’édition n’a pas de fuseau', async () => {
    /*
     * Le champ est facultatif et beaucoup d'éditions ne le renseignent pas. Sans fuseau, une heure
     * est tout de même rendue et le rappel part : ne rien envoyer serait pire que d'envoyer une
     * heure au fuseau par défaut, sur un message qui prévient d'un créneau imminent.
     */
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([creneauDans30Minutes(null)])

    await tache.run({ payload: {} } as any)

    expect(mockNotifier).toHaveBeenCalledTimes(1)
    expect(messageDuRappel()).toMatch(/\d{2}:\d{2}/)
  })

  it('ne rappelle rien quand aucun créneau n’approche', async () => {
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([])

    const resultat: any = await tache.run({ payload: {} } as any)

    expect(mockNotifier).not.toHaveBeenCalled()
    expect(resultat.notificationsSent).toBe(0)
  })
})
