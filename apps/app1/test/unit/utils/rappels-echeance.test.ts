import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'

import {
  joursAvant,
  palierDeRappel,
  typeDeNotification,
  TYPES_DE_RAPPEL,
} from '../../../server/utils/rappels-echeance'
import { FUSEAU_DES_TACHES } from '../../../server/utils/scheduled-tasks'

/**
 * Les paliers de rappel d'échéance des tâches.
 *
 * Demandé par les organisateurs : un unique rappel à J-1 laissait moins de deux jours pour agir
 * sur une tâche qui en demande plusieurs. Quatre paliers désormais — J-7, J-3, J-1, J.
 *
 * Ce que ces tests protègent, c'est surtout ce qui NE doit PAS notifier : les jours
 * intermédiaires et le retard. Un `find` remplacé par un `<=` enverrait un rappel chaque jour.
 */

/**
 * Un instant précis, exprimé AU FUSEAU DES TÂCHES.
 *
 * ⚠️ C'était `new Date(2026, 8, jour, heure)`, c'est-à-dire l'heure de la MACHINE. Les assertions
 * restaient vraies parce que le calcul employait lui aussi l'heure machine des deux côtés : le test
 * ne pouvait donc pas voir que le palier dépendait du fuseau du serveur. Il mesurait une cohérence
 * interne, pas le bon résultat.
 *
 * Les dates sont désormais construites dans le fuseau qu'on passe au calcul, donc le test dit la
 * même chose sur un poste à Paris et sur une CI en UTC.
 */
const aParis = (jour: number, heure = 0, minute = 0) =>
  DateTime.fromObject(
    { year: 2026, month: 9, day: jour, hour: heure, minute },
    { zone: FUSEAU_DES_TACHES }
  ).toJSDate()

const minuit = (jour: number, heure = 0) => aParis(jour, heure)

const AUJOURDHUI = minuit(10)

/** Le palier, toujours calculé au fuseau des tâches. */
const palier = (echeance: Date, debut: Date = AUJOURDHUI) =>
  palierDeRappel(echeance, debut, FUSEAU_DES_TACHES)

describe('palierDeRappel', () => {
  it('rend un palier pour chacun des quatre jours prévus', () => {
    expect(palier(minuit(17))).toBe('J_MINUS_7')
    expect(palier(minuit(13))).toBe('J_MINUS_3')
    expect(palier(minuit(11))).toBe('J_MINUS_1')
    expect(palier(minuit(10))).toBe('J')
  })

  it("n'envoie rien les jours intermédiaires", () => {
    // J-6 à J-4 et J-2 : le palier suivant s'en chargera.
    for (const jour of [16, 15, 14, 12]) {
      expect(palier(minuit(jour))).toBeNull()
    }
  })

  it("n'envoie rien au-delà de la fenêtre, ni sur une échéance dépassée", () => {
    expect(palier(minuit(18))).toBeNull()
    expect(palier(minuit(9))).toBeNull()
    expect(palier(minuit(3))).toBeNull()
  })

  it("ignore l'heure de l'échéance : le palier se compte en jours pleins", () => {
    // Une échéance demain à 0 h 01 et une autre demain à 23 h 59 sont toutes deux « J-1 ».
    expect(palier(aParis(11, 0, 1))).toBe('J_MINUS_1')
    expect(palier(aParis(11, 23, 59))).toBe('J_MINUS_1')
    // Et une échéance aujourd'hui reste « J » même passée de quelques heures.
    expect(palier(aParis(10, 8))).toBe('J')
  })
})

describe("au passage à l'heure d'été", () => {
  /*
   * ⚠️ PLUS BESOIN DE FORCER `process.env.TZ`. Le bloc précédent le faisait — la CI tourne en UTC,
   * où ces dates n'ont aucun changement d'heure, et sans cela le test passait sans rien vérifier.
   * Le fuseau est maintenant un ARGUMENT du calcul : il n'y a plus d'horloge de machine à tromper.
   */
  const le = (jour: number) =>
    DateTime.fromObject({ year: 2027, month: 3, day: jour }, { zone: FUSEAU_DES_TACHES }).toJSDate()

  it("ne décale pas d'un jour sur une journée de 23 heures", () => {
    // Le 28 mars 2027, 2 h devient 3 h : de ce minuit-là au suivant il ne s'écoule que 23 heures.
    // Diviser un écart de millisecondes par 86 400 000 rendrait 0,96 — soit « échéance
    // aujourd'hui » pour une tâche due demain, et le rappel J-1 perdu.
    const veille = le(28)
    expect((le(29).getTime() - veille.getTime()) / 3_600_000).toBe(23)

    expect(joursAvant(le(29), veille, FUSEAU_DES_TACHES)).toBe(1)
    expect(palierDeRappel(le(29), veille, FUSEAU_DES_TACHES)).toBe('J_MINUS_1')
  })
})

describe('⚠️ le fuseau du calcul, et non celui de la machine', () => {
  /**
   * LE CŒUR DU CONSTAT A6.
   *
   * Le conteneur tourne en UTC. L'ancien calcul ouvrait la journée courante avec
   * `setHours(0, 0, 0, 0)` — minuit UTC, soit 2 h du matin à Paris — et comparait les calendriers
   * de la MACHINE. Une échéance « demain 00 h 30 » heure de Paris y tombait donc dans la journée en
   * cours : l'assigné recevait son rappel « jour même » la veille.
   *
   * ⚠️ IL FAUT DÉPLACER LES DEUX BORNES POUR VOIR LE DÉFAUT, et c'est la moitié qu'on oublie : mon
   * premier essai gardait minuit-à-Paris comme journée courante et ne changeait que la zone de
   * lecture. Les deux bornes glissaient alors ensemble, les deux dispositions rendaient J-1, et le
   * cas ne prouvait rien. C'est le couple (journée courante, fuseau) qui fait le résultat.
   */
  const ECHEANCE = aParis(11, 0, 30)

  it('range une échéance à 00 h 30 heure de Paris dans le LENDEMAIN', () => {
    // Ce que fait le code aujourd'hui : journée ouverte à minuit à Paris, comparaison à Paris.
    expect(palierDeRappel(ECHEANCE, AUJOURDHUI, FUSEAU_DES_TACHES)).toBe('J_MINUS_1')
  })

  it('⚠️ LÀ OÙ L’ANCIEN COUPLE — minuit UTC, lecture UTC — la classait « aujourd’hui »', () => {
    const minuitUtc = DateTime.fromISO('2026-09-10T00:00:00Z').toJSDate()

    expect(palierDeRappel(ECHEANCE, minuitUtc, 'UTC')).toBe('J')
  })

  it('⚠️ LIT RÉELLEMENT LE FUSEAU QU’ON LUI PASSE', () => {
    /*
     * Le cas qui distingue « le fuseau est un argument » de « le fuseau est figé ». La journée
     * courante est prise à MIDI, de sorte que son jour civil soit le même à Paris et en UTC : seule
     * l'échéance change alors de jour selon le fuseau, et les deux lectures divergent.
     *
     * Sans cela, une implémentation qui forcerait UTC — ou Paris — satisferait les deux cas
     * ci-dessus, puisque leurs deux bornes glissent ensemble.
     */
    const midiLe10 = aParis(10, 12)
    const echeanceLe17ATrenteMinutes = aParis(17, 0, 30)

    expect(palierDeRappel(echeanceLe17ATrenteMinutes, midiLe10, FUSEAU_DES_TACHES)).toBe(
      'J_MINUS_7'
    )
    // En UTC, cette échéance est encore le 16 : six jours, donc aucun palier.
    expect(palierDeRappel(echeanceLe17ATrenteMinutes, midiLe10, 'UTC')).toBeNull()
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
