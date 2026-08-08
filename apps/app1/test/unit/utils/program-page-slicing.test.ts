import { describe, expect, it } from 'vitest'

import { decouperParJournee } from '../../../shared/utils/program-page-slicing'

/**
 * Le découpage sert la vitesse : sans lui, le modèle relit toute la page une fois par journée.
 * Il sert aussi la fidélité — une section courte laisse moins de place à l'invention qu'une page
 * entière où il faut d'abord trouver le bon passage.
 *
 * Il est heuristique, donc son échec doit rester lisible : une journée non localisée rend `null`,
 * et l'appelant retombe sur la page entière plutôt que sur une section fausse.
 */
const journees = [
  { date: '2026-08-01', jourFr: 'samedi', jourEn: 'Saturday', index: 1 },
  { date: '2026-08-02', jourFr: 'dimanche', jourEn: 'Sunday', index: 2 },
  { date: '2026-08-03', jourFr: 'lundi', jourEn: 'Monday', index: 3 },
]

describe('decouperParJournee', () => {
  it('découpe une page annoncée par noms de jours anglais', () => {
    const page = [
      'Programme',
      'Saturday — registrations from 12:00',
      'Welcome party 18:00',
      'Sunday — workshops 10:00',
      'Gala 20:30',
      'Monday — joggling race 09:00',
    ].join('\n')

    const s = decouperParJournee(page, journees)
    expect(s['2026-08-01']).toContain('registrations from 12:00')
    expect(s['2026-08-01']).toContain('Welcome party')
    expect(s['2026-08-01']).not.toContain('workshops')
    expect(s['2026-08-02']).toContain('workshops 10:00')
    expect(s['2026-08-02']).not.toContain('joggling')
    expect(s['2026-08-03']).toContain('joggling race')
  })

  it('découpe une page annoncée par dates complètes', () => {
    const page = '2026-08-01\nAccueil\n2026-08-02\nAteliers\n2026-08-03\nDépart'
    const s = decouperParJournee(page, journees)

    expect(s['2026-08-01']).toContain('Accueil')
    expect(s['2026-08-02']).toContain('Ateliers')
    expect(s['2026-08-03']).toContain('Départ')
  })

  it('reconnaît « 1er août » comme le 1er du mois', () => {
    const page = '1er août : accueil\n2 août : ateliers\n3 août : départ'
    const s = decouperParJournee(page, journees)

    expect(s['2026-08-01']).toContain('accueil')
    expect(s['2026-08-02']).toContain('ateliers')
  })

  it('reconnaît « day N »', () => {
    const page = 'Day 1 : arrivals\nDay 2 : shows\nDay 3 : goodbye'
    const s = decouperParJournee(page, journees)

    expect(s['2026-08-01']).toContain('arrivals')
    expect(s['2026-08-03']).toContain('goodbye')
  })

  /**
   * Une convention de deux semaines revoit chaque nom de jour. Chercher à partir de la journée
   * précédente évite d'attribuer au premier samedi le contenu du second.
   */
  it('n’attribue pas au premier samedi le contenu du second', () => {
    const deuxSemaines = [
      { date: '2026-08-01', jourFr: 'samedi', jourEn: 'Saturday', index: 1 },
      { date: '2026-08-08', jourFr: 'samedi', jourEn: 'Saturday', index: 8 },
    ]
    const page = 'Saturday — ouverture\n... du contenu ...\nSaturday — clôture'
    const s = decouperParJournee(page, deuxSemaines)

    expect(s['2026-08-01']).toContain('ouverture')
    expect(s['2026-08-01']).not.toContain('clôture')
    expect(s['2026-08-08']).toContain('clôture')
  })

  // Le cas qui doit rester lisible : mieux vaut avouer l'échec que rendre une section fausse.
  it('rend null pour une journée absente de la page', () => {
    const page = 'Saturday — accueil\nMonday — départ'
    const s = decouperParJournee(page, journees)

    expect(s['2026-08-01']).toContain('accueil')
    expect(s['2026-08-02']).toBeNull()
    expect(s['2026-08-03']).toContain('départ')
  })

  it('rend null partout sur une page sans aucun repère', () => {
    const s = decouperParJournee('Une page qui ne parle pas de dates du tout.', journees)
    expect(Object.values(s)).toEqual([null, null, null])
  })

  // La casse de la page ne doit pas décider du découpage.
  it('ignore la casse des repères', () => {
    const s = decouperParJournee('SATURDAY: accueil\nSUNDAY: ateliers\nMONDAY: fin', journees)
    expect(s['2026-08-01']).toContain('accueil')
    expect(s['2026-08-02']).toContain('ateliers')
  })
})
