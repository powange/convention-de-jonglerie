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

  /**
   * Le cas signalé : la dernière journée n'a pas de repère suivant, sa section court jusqu'au bout
   * de la page. Un modèle à qui l'on demande de recopier fidèlement recopiait alors les crédits du
   * site comme s'ils faisaient partie du programme du dimanche.
   */
  it('coupe la dernière journée avant le pied de page', () => {
    const page = [
      'Saturday — accueil',
      'Sunday — ateliers',
      'Monday — from 10:00 | Goodbye and see you soon!',
      '© 2026',
      'Designed and built with ❤️ by Andrej',
    ].join('\n')

    const s = decouperParJournee(page, journees)
    expect(s['2026-08-03']).toContain('Goodbye and see you soon!')
    expect(s['2026-08-03']).not.toContain('©')
    expect(s['2026-08-03']).not.toContain('Andrej')
  })

  /**
   * L'avertissement observé sur la page de l'EJC. Demander au modèle de l'ignorer ne suffisait
   * pas : on lui demande par ailleurs de recopier fidèlement ce qu'on lui donne. Mieux vaut ne
   * pas le lui donner.
   */
  it('coupe avant un avertissement adressé au lecteur de la page', () => {
    const page = [
      'Saturday — accueil',
      'Sunday — ateliers',
      'Monday — from 10:00 | Goodbye and see you soon!',
      'The program is still under development, so we reserve the right to change times, locations, etc.',
      '© 2026',
    ].join('\n')

    const s = decouperParJournee(page, journees)
    expect(s['2026-08-03']).toBe('Monday — from 10:00 | Goodbye and see you soon!')
  })

  it('reconnaît un avertissement en français', () => {
    const page = [
      'Saturday — accueil',
      'Sunday — ateliers',
      'Monday — départ à 14h',
      'Ce programme est susceptible de modification jusqu’au dernier moment.',
    ].join('\n')

    const s = decouperParJournee(page, journees)
    expect(s['2026-08-03']).toBe('Monday — départ à 14h')
  })

  /**
   * Le risque du filtrage : « subject to change » peut apparaître dans le programme réel d'une
   * journée. Le chercher partout ferait perdre tout ce qui suit cette ligne. On ne l'applique
   * donc qu'à la dernière section, la seule qui s'étende jusqu'au bout de la page.
   */
  it('ne coupe pas sur un avertissement au milieu du programme', () => {
    const page = [
      'Saturday — accueil',
      'Sunday — 10:00 ateliers (times subject to change)',
      '20:30 gala',
      'Monday — départ',
    ].join('\n')

    const s = decouperParJournee(page, journees)
    expect(s['2026-08-02']).toContain('20:30 gala')
  })

  it('reconnaît les mentions légales et la politique de confidentialité', () => {
    const page = [
      'Saturday — accueil',
      'Sunday — ateliers',
      'Monday — départ',
      'Mentions légales',
      'Politique de confidentialité',
    ].join('\n')

    const s = decouperParJournee(page, journees)
    expect(s['2026-08-03']).toBe('Monday — départ')
  })

  // Vider une section parce qu'elle commence par un tel marqueur ferait perdre la journée entière.
  it('ne coupe jamais sur la première ligne', () => {
    const page = ['Saturday — accueil', 'Sunday — ateliers', 'Monday © soirée de clôture'].join(
      '\n'
    )

    const s = decouperParJournee(page, journees)
    expect(s['2026-08-03']).toContain('soirée de clôture')
  })

  it('laisse intactes les journées suivies d’un repère', () => {
    const page = ['Saturday — accueil', '© 2026', 'Sunday — ateliers', 'Monday — départ'].join('\n')

    const s = decouperParJournee(page, journees)
    expect(s['2026-08-01']).toBe('Saturday — accueil')
    expect(s['2026-08-02']).toContain('ateliers')
  })

  /**
   * Les deux défauts signalés sur l'EJC : l'en-tête « August 8th » se retrouvait en tête du
   * relevé, et le début de l'en-tête suivant — « 📅 Sunday, » — restait accroché à la fin, parce
   * que la coupe tombait à la position exacte du repère et non au début de sa ligne.
   */
  it('retire l’en-tête de la journée et n’emporte pas le début du suivant', () => {
    const page = [
      '📅 SATURDAY, August 1st',
      '09:00 | JOGGLING ROAD RACE 5km',
      '17:00 | Gala show',
      '📅 Sunday, August 2nd',
      '10:00 | Ateliers',
    ].join('\n')

    const s = decouperParJournee(page, journees)
    expect(s['2026-08-01']).toBe('09:00 | JOGGLING ROAD RACE 5km\n17:00 | Gala show')
    expect(s['2026-08-01']).not.toContain('August 1st')
    expect(s['2026-08-01']).not.toContain('Sunday')
  })

  // Une journée dont le déroulé commence sur la ligne du titre ne doit pas être amputée.
  it('conserve la première ligne quand elle porte aussi le contenu', () => {
    const page = ['Saturday — accueil', 'Sunday — ateliers', 'Monday — départ à 14h'].join('\n')
    const s = decouperParJournee(page, journees)

    expect(s['2026-08-01']).toBe('Saturday — accueil')
    expect(s['2026-08-03']).toBe('Monday — départ à 14h')
  })

  it('retire un en-tête même sans émoji ni ponctuation', () => {
    const page = ['August 1', '10:00 accueil', 'August 2', '10:00 ateliers'].join('\n')
    const s = decouperParJournee(page, journees)

    expect(s['2026-08-01']).toBe('10:00 accueil')
  })

  /**
   * Les marqueurs doivent rester assez précis pour ne pas mordre sur du vrai programme : un
   * atelier « Cookie decorating » est une activité de convention parfaitement ordinaire.
   */
  it('ne coupe pas sur un mot qui appartient au programme', () => {
    const page = [
      'Saturday — accueil',
      'Sunday — 10:00 Cookie decorating workshop',
      '14:00 show designed by Anna',
      '20:30 gala',
      'Monday — départ',
    ].join('\n')

    const s = decouperParJournee(page, journees)
    expect(s['2026-08-02']).toContain('Cookie decorating')
    expect(s['2026-08-02']).toContain('20:30 gala')
  })

  // La casse de la page ne doit pas décider du découpage.
  it('ignore la casse des repères', () => {
    const s = decouperParJournee('SATURDAY: accueil\nSUNDAY: ateliers\nMONDAY: fin', journees)
    expect(s['2026-08-01']).toContain('accueil')
    expect(s['2026-08-02']).toContain('ateliers')
  })
})
