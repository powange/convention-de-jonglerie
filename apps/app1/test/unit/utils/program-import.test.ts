import { describe, expect, it } from 'vitest'

import {
  construireElementsDeJournee,
  normaliserTitre,
  planifierImportProgramme,
  resumerPlan,
  type ElementExistant,
  type ElementPropose,
} from '../../../shared/utils/program-import'

const propose = (p: Partial<ElementPropose> = {}): ElementPropose => ({
  titre: 'Scène ouverte',
  debut: '2026-10-02T18:00:00.000Z',
  ...p,
})

const existant = (p: Partial<ElementExistant> = {}): ElementExistant => ({
  id: 1,
  title: 'Scène ouverte',
  startDateTime: '2026-10-02T18:00:00.000Z',
  ...p,
})

describe('planifierImportProgramme', () => {
  it('crée ce qui n’existe pas', () => {
    const plan = planifierImportProgramme([propose()], [])
    expect(plan).toEqual([{ action: 'creer', propose: propose() }])
  })

  it('ne propose rien quand tout est identique', () => {
    const plan = planifierImportProgramme([propose()], [existant()])
    expect(plan[0]!.action).toBe('inchange')
  })

  /**
   * Le cas qui justifie l'appariement sur le titre et le jour plutôt que sur l'horaire : c'est
   * précisément l'horaire qui change quand un organisateur décale un spectacle. S'apparier dessus
   * ferait apparaître un doublon là où il faut une correction.
   */
  it('propose une correction d’horaire plutôt qu’un doublon', () => {
    const plan = planifierImportProgramme(
      [propose({ debut: '2026-10-02T19:30:00.000Z' })],
      [existant()]
    )
    expect(plan[0]!.action).toBe('mettre_a_jour')
    expect(plan[0]).toMatchObject({
      existantId: 1,
      modifications: [
        {
          champ: 'debut',
          avant: '2026-10-02T18:00:00.000Z',
          apres: '2026-10-02T19:30:00.000Z',
        },
      ],
    })
  })

  // Accents, casse et espaces varient d'une passe à l'autre sans que le contenu change.
  it('apparie malgré la casse, les accents et les espaces', () => {
    for (const titre of ['SCENE OUVERTE', 'scene  ouverte', ' Scène Ouverte ']) {
      const plan = planifierImportProgramme([propose({ titre })], [existant()])
      expect(plan[0]!.action, titre).not.toBe('creer')
    }
  })

  it('signale chaque champ modifié', () => {
    const plan = planifierImportProgramme(
      [
        propose({
          description: 'Venez essayer vos numéros',
          fin: '2026-10-02T20:00:00.000Z',
          lieu: 'Chapiteau',
        }),
      ],
      [existant({ description: null, endDateTime: null, locationName: null })]
    )
    expect(plan[0]!.action).toBe('mettre_a_jour')
    const champs = (plan[0] as { modifications: { champ: string }[] }).modifications.map(
      (m) => m.champ
    )
    expect(champs.sort()).toEqual(['description', 'fin', 'lieu'])
  })

  /**
   * Deux moments homonymes le même jour sont indiscernables. Traiter le second comme un nouvel
   * élément vaut mieux que d'écraser le premier : une création superflue se supprime, une donnée
   * écrasée est perdue.
   */
  it('n’apparie qu’une fois un existant, et crée l’homonyme suivant', () => {
    const plan = planifierImportProgramme(
      [
        propose({ debut: '2026-10-02T12:00:00.000Z' }),
        propose({ debut: '2026-10-02T20:00:00.000Z' }),
      ],
      [existant({ startDateTime: '2026-10-02T12:00:00.000Z' })]
    )
    expect(plan.map((p) => p.action)).toEqual(['inchange', 'creer'])
  })

  // Un même titre à deux jours différents désigne deux moments distincts.
  it('ne confond pas deux journées', () => {
    const plan = planifierImportProgramme(
      [propose({ debut: '2026-10-03T18:00:00.000Z' })],
      [existant()]
    )
    expect(plan[0]!.action).toBe('creer')
  })

  it('considère une fin absente et une fin vide comme identiques', () => {
    const plan = planifierImportProgramme(
      [propose({ fin: null })],
      [existant({ endDateTime: null })]
    )
    expect(plan[0]!.action).toBe('inchange')
  })

  it('ne se laisse pas tromper par des espaces autour d’un texte', () => {
    const plan = planifierImportProgramme(
      [propose({ description: '  Un texte  ', lieu: ' Chapiteau ' })],
      [existant({ description: 'Un texte', locationName: 'Chapiteau' })]
    )
    expect(plan[0]!.action).toBe('inchange')
  })

  it('accepte une liste vide', () => {
    expect(planifierImportProgramme([], [existant()])).toEqual([])
  })
})

describe('resumerPlan', () => {
  it('compte chaque nature d’action', () => {
    const plan = planifierImportProgramme(
      [
        propose({ titre: 'Nouveau' }),
        propose({ debut: '2026-10-02T19:00:00.000Z' }),
        propose({ titre: 'Gala', debut: '2026-10-02T21:00:00.000Z' }),
      ],
      [existant(), existant({ id: 2, title: 'Gala', startDateTime: '2026-10-02T21:00:00.000Z' })]
    )
    expect(resumerPlan(plan)).toEqual({ creations: 1, miseAJour: 1, inchanges: 1 })
  })
})

describe('normaliserTitre', () => {
  it('efface accents, casse et espaces superflus', () => {
    expect(normaliserTitre('  Scène   OUVERTE ')).toBe('scene ouverte')
  })
})

describe('construireElementsDeJournee', () => {
  const heureLocale = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  it('compose la date-heure à partir de la journée et de l’heure', () => {
    const { elements } = construireElementsDeJournee('2026-10-02', [
      { titre: 'Scène ouverte', debut: '18:30', fin: '20:00', lieu: 'Chapiteau' },
    ])
    expect(elements).toHaveLength(1)
    expect(heureLocale(elements[0]!.debut)).toBe('18:30')
    expect(heureLocale(elements[0]!.fin!)).toBe('20:00')
    expect(elements[0]!.lieu).toBe('Chapiteau')
  })

  // Les sites écrivent « 18h30 » aussi souvent que « 18:30 ».
  it('accepte les deux écritures de l’heure', () => {
    for (const debut of ['18:30', '18h30', '18 h 30', '8:05']) {
      const { elements } = construireElementsDeJournee('2026-10-02', [{ titre: 'X', debut }])
      expect(elements, debut).toHaveLength(1)
    }
  })

  /**
   * Une scène ouverte qui commence à 23 h et finit à 1 h est courante. Refuser ce créneau le
   * perdrait ; le placer le même jour donnerait une durée négative.
   */
  it('reporte au lendemain une fin antérieure au début', () => {
    const { elements } = construireElementsDeJournee('2026-10-02', [
      { titre: 'Jam', debut: '23:00', fin: '01:00' },
    ])
    const debut = new Date(elements[0]!.debut)
    const fin = new Date(elements[0]!.fin!)
    expect(fin.getTime() - debut.getTime()).toBe(2 * 60 * 60 * 1000)
    expect(fin.getDate()).toBe(3)
  })

  /**
   * La règle qui protège du modèle : sans titre ou sans heure lisible, on écarte plutôt que de
   * composer un créneau à partir de rien.
   */
  it('écarte ce qui n’a ni titre ni heure lisible, et le compte', () => {
    const { elements, ignores } = construireElementsDeJournee('2026-10-02', [
      { titre: 'Bon', debut: '10:00' },
      { titre: '   ', debut: '11:00' },
      { titre: 'Sans heure' },
      { titre: 'Heure absurde', debut: '99:99' },
      { titre: 'Heure en toutes lettres', debut: 'dix heures' },
    ])
    expect(elements.map((e) => e.titre)).toEqual(['Bon'])
    expect(ignores).toBe(4)
  })

  it('laisse la fin vide quand elle est absente ou illisible', () => {
    const { elements } = construireElementsDeJournee('2026-10-02', [
      { titre: 'A', debut: '10:00' },
      { titre: 'B', debut: '11:00', fin: 'plus tard' },
    ])
    expect(elements.map((e) => e.fin)).toEqual([null, null])
  })

  it('tolère une réponse qui n’est pas une liste', () => {
    for (const brut of [null, undefined, {}, 'texte', 42]) {
      expect(construireElementsDeJournee('2026-10-02', brut).elements).toEqual([])
    }
  })

  it('rend description et lieu vides plutôt que des chaînes creuses', () => {
    const { elements } = construireElementsDeJournee('2026-10-02', [
      { titre: 'A', debut: '10:00', description: '   ', lieu: '' },
    ])
    expect(elements[0]!.description).toBeNull()
    expect(elements[0]!.lieu).toBeNull()
  })
})
