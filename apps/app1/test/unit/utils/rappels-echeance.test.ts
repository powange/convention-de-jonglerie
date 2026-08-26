import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  joursAvant,
  palierDeRappel,
  typeDeNotification,
  TYPES_DE_RAPPEL,
} from '../../../server/utils/rappels-echeance'

/**
 * Les paliers de rappel d'échéance des tâches.
 *
 * Demandé par les organisateurs : un unique rappel à J-1 laissait moins de deux jours pour agir
 * sur une tâche qui en demande plusieurs. Quatre paliers désormais — J-7, J-3, J-1, J.
 *
 * Ce que ces tests protègent, c'est surtout ce qui NE doit PAS notifier : les jours
 * intermédiaires et le retard. Un `find` remplacé par un `<=` enverrait un rappel chaque jour.
 */

/** Le début de journée que la tâche planifiée calcule (minuit local). */
const minuit = (jour: number, heure = 0) => new Date(2026, 8, jour, heure, 0, 0, 0)

const AUJOURDHUI = minuit(10)

describe('palierDeRappel', () => {
  it('rend un palier pour chacun des quatre jours prévus', () => {
    expect(palierDeRappel(minuit(17), AUJOURDHUI)).toBe('J_MINUS_7')
    expect(palierDeRappel(minuit(13), AUJOURDHUI)).toBe('J_MINUS_3')
    expect(palierDeRappel(minuit(11), AUJOURDHUI)).toBe('J_MINUS_1')
    expect(palierDeRappel(minuit(10), AUJOURDHUI)).toBe('J')
  })

  it("n'envoie rien les jours intermédiaires", () => {
    // J-6 à J-4 et J-2 : le palier suivant s'en chargera.
    for (const jour of [16, 15, 14, 12]) {
      expect(palierDeRappel(minuit(jour), AUJOURDHUI)).toBeNull()
    }
  })

  it("n'envoie rien au-delà de la fenêtre, ni sur une échéance dépassée", () => {
    expect(palierDeRappel(minuit(18), AUJOURDHUI)).toBeNull()
    expect(palierDeRappel(minuit(9), AUJOURDHUI)).toBeNull()
    expect(palierDeRappel(minuit(3), AUJOURDHUI)).toBeNull()
  })

  it("ignore l'heure de l'échéance : le palier se compte en jours pleins", () => {
    // Une échéance demain à 0 h 01 et une autre demain à 23 h 59 sont toutes deux « J-1 ».
    expect(palierDeRappel(new Date(2026, 8, 11, 0, 1), AUJOURDHUI)).toBe('J_MINUS_1')
    expect(palierDeRappel(new Date(2026, 8, 11, 23, 59), AUJOURDHUI)).toBe('J_MINUS_1')
    // Et une échéance aujourd'hui reste « J » même passée de quelques heures.
    expect(palierDeRappel(new Date(2026, 8, 10, 8, 0), AUJOURDHUI)).toBe('J')
  })
})

describe("au passage à l'heure d'été", () => {
  // Le fuseau est imposé ici : la CI tourne en UTC, où ces dates n'ont aucun changement d'heure.
  // Sans cela le test passerait sans rien vérifier — y compris sur une implémentation fautive.
  const fuseauInitial = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'Europe/Paris'
  })
  afterAll(() => {
    process.env.TZ = fuseauInitial
  })

  it("ne décale pas d'un jour sur une journée de 23 heures", () => {
    // Le 28 mars 2027, 2 h devient 3 h : de ce minuit-là au suivant il ne s'écoule que 23 heures.
    // Diviser un écart de millisecondes par 86 400 000 rendrait 0,96 — soit « échéance
    // aujourd'hui » pour une tâche due demain, et le rappel J-1 perdu.
    const veille = new Date(2027, 2, 28)
    expect((new Date(2027, 2, 29).getTime() - veille.getTime()) / 3_600_000).toBe(23)

    expect(joursAvant(new Date(2027, 2, 29), veille)).toBe(1)
    expect(palierDeRappel(new Date(2027, 2, 29), veille)).toBe('J_MINUS_1')
  })
})

describe('typeDeNotification', () => {
  it('donne une clé distincte par palier — c’est elle qui déduplique', () => {
    expect(typeDeNotification('J_MINUS_7')).toBe('task_deadline_reminder_j_minus_7')
    expect(typeDeNotification('J')).toBe('task_deadline_reminder_j')
    expect(new Set(TYPES_DE_RAPPEL).size).toBe(4)
  })

  it('conserve les deux types déjà en base, pour ne pas renotifier le passé', () => {
    // Ces deux valeurs ont déjà été écrites dans `Notification` par l'ancienne version : les
    // renommer ferait repartir un rappel sur des tâches déjà annoncées.
    expect(TYPES_DE_RAPPEL).toContain('task_deadline_reminder_j_minus_1')
    expect(TYPES_DE_RAPPEL).toContain('task_deadline_reminder_j')
  })
})
