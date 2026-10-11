import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  NotificationHelpers,
  NotificationService,
} from '../../../../server/utils/notification-service'

/**
 * Où mènent les notifications de tâche — constat B2.
 *
 * ## Le défaut
 *
 * `taskAssigned` et `taskCommented` posaient `actionUrl: /editions/<id>/gestion/tasks`, la page de
 * gestion, réservée à `canManageTasks`. Or un assigné peut parfaitement n'être qu'un **bénévole
 * accepté** — c'est `assertAssigneesAreAssignable` qui le dit — et pour lui le bouton « Voir la
 * tâche » menait sur un écran dont le premier appel répond **403**. La notification arrivait, le
 * lien ne menait nulle part.
 *
 * 📍 La bonne adresse existait **dans le même fichier**, à quelques lignes : le rappel d'échéance
 * visait déjà `/my-tasks`. Mais aucune des trois n'ouvrait la **tâche** — on arrivait devant sa
 * liste entière, à charge de retrouver celle dont on venait de nous parler.
 *
 * ## ⚠️ Ce que ce fichier garde, et pourquoi il ne suffit pas seul
 *
 * Il mesure l'adresse POSÉE. Que la page sache l'honorer est éprouvé à part
 * (`test/nuxt/pages/my-tasks-ouverture-par-url.test.ts`) : une adresse juste dont personne ne lit
 * le paramètre ne corrige rien, et ce dépôt a payé ce défaut cinq fois.
 */
const EDITION = 9
const TACHE = 77

/** Deux nombres DISTINCTS, et c'est volontaire : avec un seul, `?task=${editionId}` passerait. */
const ADRESSE_ATTENDUE = `/editions/${EDITION}/my-tasks?task=${TACHE}`

let creer: ReturnType<typeof vi.spyOn>

describe('les trois notifications de tâche', () => {
  beforeEach(() => {
    creer = vi.spyOn(NotificationService, 'create').mockResolvedValue(undefined as never)
  })
  afterEach(() => {
    creer.mockRestore()
  })

  const adressePosee = () => (creer.mock.calls[0]![0] as { actionUrl: string }).actionUrl

  it('⚠️ « TÂCHE ASSIGNÉE » MÈNE À MES TÂCHES, et ouvre la tâche', async () => {
    await NotificationHelpers.taskAssigned(1, 'Monter le chapiteau', 'Édition', EDITION, TACHE)
    expect(adressePosee()).toBe(ADRESSE_ATTENDUE)
  })

  it('⚠️ « NOUVEAU COMMENTAIRE » AUSSI', async () => {
    await NotificationHelpers.taskCommented(
      1,
      'Camille',
      'Monter le chapiteau',
      'Édition',
      EDITION,
      TACHE
    )
    expect(adressePosee()).toBe(ADRESSE_ATTENDUE)
  })

  it('le rappel d’échéance visait la bonne page, il ouvre maintenant la bonne tâche', async () => {
    /*
     * Celui-ci n'était pas cassé au sens du 403 : il est ici parce que les trois doivent répondre
     * la même chose. Deux adresses pour une même question, c'est ainsi que l'écart est né.
     */
    await NotificationHelpers.taskDeadlineReminder(
      1,
      'Monter le chapiteau',
      'Édition',
      EDITION,
      TACHE,
      'J_MINUS_1'
    )
    expect(adressePosee()).toBe(ADRESSE_ATTENDUE)
  })

  it('aucune ne mène à l’espace de gestion', async () => {
    /*
     * LE TÉMOIN NÉGATIF, et il n'est pas redondant : il nomme le défaut d'origine. Un correctif
     * partiel — une seule des deux adresses changée — le ferait tomber en disant laquelle, là où
     * les cas ci-dessus diraient seulement « ce n'est pas la bonne chaîne ».
     */
    await NotificationHelpers.taskAssigned(1, 'T', 'E', EDITION, TACHE)
    await NotificationHelpers.taskCommented(1, 'C', 'T', 'E', EDITION, TACHE)
    await NotificationHelpers.taskDeadlineReminder(1, 'T', 'E', EDITION, TACHE, 'J')

    expect(creer).toHaveBeenCalledTimes(3)
    for (const appel of creer.mock.calls) {
      expect((appel[0] as { actionUrl: string }).actionUrl).not.toContain('/gestion/')
    }
  })
})
