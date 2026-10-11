import { describe, it, expect, beforeEach, vi } from 'vitest'

// `defineTask` est un auto-import de Nitro, absent des tests : sans ce doublon, le fichier de la
// tâche échoue au CHARGEMENT. `vi.hoisted` parce que les imports sont remontés au-dessus du corps.
vi.hoisted(() => {
  ;(globalThis as any).defineTask = (definition: any) => definition
})

// ⚠️ `vi.hoisted` ICI AUSSI : la fabrique de `vi.mock` est remontée au-dessus du corps du module,
// donc un `const` déclaré plus haut y est encore en zone morte — « Cannot access before
// initialization », et le fichier entier échoue au chargement sans qu'aucun test ne s'exécute.
const mockCreate = vi.hoisted(() => vi.fn(async () => ({})))
vi.mock('#server/utils/notification-service', () => ({
  NotificationService: { create: mockCreate },
}))

import tache from '../../../../../layers/volunteers/server/tasks/volunteer-reminders'

const prismaMock = (globalThis as any).prisma

/**
 * Le rappel « dans 30 minutes » ignorait les organisateurs affectés — constat B5.
 *
 * ## Le défaut
 *
 * La tâche ne chargeait que `assignments`, c'est-à-dire les bénévoles. Un organisateur posé sur un
 * créneau via `OrganizerSlotAssignment` — compté comme occupant partout ailleurs dans le module —
 * ne recevait **jamais** son rappel. Et le lien de la notification menait à
 * `/profile/mes-candidatures-benevole`, une page de **candidatures** : un organisateur n'en a pas
 * et y voyait une liste vide.
 *
 * ## ⚠️ POURQUOI UNE COLONNE A DÛ ÊTRE AJOUTÉE
 *
 * `OrganizerSlotAssignment` n'avait pas de `reminderSentAt`. Sans marque, l'organisateur aurait
 * reçu le rappel **quatre à cinq fois** : la tâche tourne chaque minute sur une fenêtre de 28 à
 * 32 minutes, donc un même créneau y tombe à plusieurs passages consécutifs. C'est exactement le
 * défaut que #642 avait refermé pour les seuls bénévoles — l'étendre aux organisateurs sans la
 * colonne l'aurait rouvert pour eux.
 */
const MAINTENANT = () => new Date(Date.now() + 30 * 60 * 1000)

/**
 * ⚠️ TROIS IDENTIFIANTS DISTINCTS PAR ORGANISATEUR, un par niveau de la chaîne.
 *
 * `EditionOrganizer.organizerId` référence `ConventionOrganizer`, **pas** `User` : le compte se lit
 * `organizer.userId`. Avec un seul nombre, lire le mauvais champ serait indiscernable — et c'est
 * une erreur que j'ai réellement commise sur le lot précédent, où le test la consacrait.
 */
const organisateur = (ligne: number, conventionOrganizer: number, compte: number) => ({
  editionOrganizerId: ligne,
  editionOrganizer: { organizerId: conventionOrganizer, organizer: { userId: compte } },
})

const creneau = (options: { benevoles?: number[]; organisateurs?: number[][] } = {}) => ({
  id: 'slot-1',
  eventId: 22,
  title: 'Bar du soir',
  startDateTime: MAINTENANT(),
  delayMinutes: 0,
  team: { name: 'Bar', color: '#fff' },
  event: { name: 'EJC', edition: { timezone: 'Europe/Paris' } },
  assignments: (options.benevoles ?? []).map((id) => ({
    id: `aff-${id}`,
    reminderSentAt: null,
    user: { id, email: `u${id}@exemple.test`, pseudo: `u${id}`, nom: 'M', prenom: 'Camille' },
  })),
  organizerAssignments: (options.organisateurs ?? []).map(([ligne, co, compte]) =>
    organisateur(ligne!, co!, compte!)
  ),
})

describe('rappel de créneau — les organisateurs aussi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.volunteerAssignment.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.organizerSlotAssignment.updateMany.mockResolvedValue({ count: 1 })
  })

  it('⚠️ RAPPELLE UN ORGANISATEUR AFFECTÉ, sur son VRAI compte', async () => {
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      creneau({ organisateurs: [[7, 11, 9]] }),
    ])

    await tache.run({ payload: {} } as never)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    // 9 et non 7 (la ligne) ni 11 (le ConventionOrganizer) : la chaîne complète est suivie.
    expect(mockCreate.mock.calls[0][0].userId).toBe(9)
  })

  it('rappelle bénévoles ET organisateurs du même créneau', async () => {
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      creneau({ benevoles: [5], organisateurs: [[7, 11, 9]] }),
    ])

    await tache.run({ payload: {} } as never)

    expect(mockCreate.mock.calls.map((c) => c[0].userId).sort()).toEqual([5, 9])
  })

  it('⚠️ UN SEUL RAPPEL pour qui est bénévole ET organisateur du même créneau', async () => {
    /*
     * Les deux tables la portent : sans regroupement par compte, la personne recevrait DEUX
     * messages identiques à la même seconde. Le cas n'est pas théorique — un organisateur peut
     * candidater comme bénévole sur son édition.
     */
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      creneau({ benevoles: [9], organisateurs: [[7, 11, 9]] }),
    ])

    await tache.run({ payload: {} } as never)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0][0].userId).toBe(9)
  })

  it('⚠️ PREND LES DEUX MARQUES pour cette personne, pas seulement une', async () => {
    /*
     * L'ASSERTION QUI ÉVITE DE DÉPLACER LE DÉFAUT. Si l'on ne marquait que l'affectation de
     * bénévole, celle d'organisateur resterait vierge et déclencherait un SECOND rappel à la
     * minute suivante — le défaut qu'on vient de fermer, repoussé d'un cran. Rien, dans la
     * réponse ou à l'écran, ne le montrerait.
     */
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      creneau({ benevoles: [9], organisateurs: [[7, 11, 9]] }),
    ])

    await tache.run({ payload: {} } as never)

    expect(prismaMock.volunteerAssignment.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.organizerSlotAssignment.updateMany).toHaveBeenCalledTimes(1)
    // La marque de l'organisateur est bornée au créneau : la clé est composite.
    expect(prismaMock.organizerSlotAssignment.updateMany.mock.calls[0][0].where).toMatchObject({
      editionOrganizerId: 7,
      timeSlotId: 'slot-1',
      reminderSentAt: null,
    })
  })

  it('ne rappelle pas un organisateur déjà marqué', async () => {
    // La marque est CONDITIONNELLE : aucune ligne écrite ⇒ un autre passage s'en est chargé.
    prismaMock.organizerSlotAssignment.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      creneau({ organisateurs: [[7, 11, 9]] }),
    ])

    await tache.run({ payload: {} } as never)

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('demande à la base de ne charger que les affectations d’organisateur non rappelées', async () => {
    /*
     * Le bouchon central IGNORE le `where` : il rend ce qu'on lui dit. Les cas ci-dessus
     * resteraient donc verts si la requête cessait de filtrer, et en production le rappel
     * repartirait à chaque minute. Seule la FORME de la requête le dit.
     */
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([])

    await tache.run({ payload: {} } as never)

    const demande = prismaMock.volunteerTimeSlot.findMany.mock.calls[0][0]
    expect(demande.include.organizerAssignments.where).toEqual({ reminderSentAt: null })
    expect(demande.include.organizerAssignments.select).toEqual({
      editionOrganizerId: true,
      editionOrganizer: { select: { organizer: { select: { userId: true } } } },
    })
  })

  it('⚠️ LE LIEN MÈNE AU PLANNING DE L’ÉDITION, pas à la page des candidatures', async () => {
    /*
     * Second volet du constat. `/profile/mes-candidatures-benevole` ne montre que les
     * candidatures : un organisateur n'en a pas et y verrait une liste vide, et même un bénévole
     * y arrive une page trop loin de son planning. `aDroitAuPlanning` compte les équipes
     * d'organisateur, donc la page d'édition sert bien les deux populations.
     */
    prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([
      creneau({ organisateurs: [[7, 11, 9]] }),
    ])

    await tache.run({ payload: {} } as never)

    expect(mockCreate.mock.calls[0][0].actionUrl).toBe('/editions/22/volunteers')
  })
})
