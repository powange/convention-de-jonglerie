import { describe, expect, it } from 'vitest'

import { jourDeLEdition } from '../../../app/utils/jour-edition'
import {
  calculateVolunteersStatsByDay,
  calculateVolunteersStatsByTeam,
} from '../../../app/utils/volunteer-stats'

/**
 * À quelle journée appartient un créneau.
 *
 * Le défaut : les trois relevés déduisaient le jour de la date UTC (`toISOString()`), quand le
 * planning affiche en heure locale. En France l'été, un créneau commençant à 00h30 le samedi vaut
 * 22h30 le vendredi en UTC — ses heures étaient donc comptées le vendredi, et son créneau aussi.
 * Une plage de deux heures chaque nuit mal rattachée, précisément celle des permanences de nuit.
 */
describe('jourDeLEdition', () => {
  it('rattache une nuit parisienne au bon jour', () => {
    // 00h30 le samedi à Paris = 22h30 le vendredi en UTC. C'est le cœur du défaut.
    expect(jourDeLEdition('2026-09-25T22:30:00Z', 'Europe/Paris')).toBe('2026-09-26')
  })

  it('ne déplace pas un créneau de plein jour', () => {
    expect(jourDeLEdition('2026-09-26T09:00:00Z', 'Europe/Paris')).toBe('2026-09-26')
  })

  it('tient compte du changement d’heure', () => {
    // Fin octobre, Paris repasse à UTC+1 : la bascule se fait alors à 23h UTC et non à 22h.
    expect(jourDeLEdition('2026-11-14T23:30:00Z', 'Europe/Paris')).toBe('2026-11-15')
    expect(jourDeLEdition('2026-11-14T22:30:00Z', 'Europe/Paris')).toBe('2026-11-14')
  })

  it('suit un fuseau en retard sur UTC', () => {
    // Le miroir du cas parisien : à New York, 01h00 UTC est encore la veille au soir.
    expect(jourDeLEdition('2026-09-26T01:00:00Z', 'America/New_York')).toBe('2026-09-25')
  })

  it('retombe sur le fuseau de la machine quand l’édition n’en déclare pas', () => {
    // 8 éditions sur 38 n'ont pas de fuseau. Le repli doit rester d'accord avec le calendrier,
    // qui affiche lui aussi en heure locale — et NON repartir sur l'UTC, qui était le défaut.
    const instant = new Date('2026-09-25T22:30:00Z')
    const attendu = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant)

    expect(jourDeLEdition(instant, null)).toBe(attendu)
    expect(jourDeLEdition(instant, '')).toBe(attendu)
  })

  it('ne casse pas sur un fuseau inconnu', () => {
    // Une chaîne mal saisie ne doit pas vider tout un relevé de statistiques.
    expect(jourDeLEdition('2026-09-26T09:00:00Z', 'Pas/UnFuseau')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('rend une chaîne vide sur une date illisible', () => {
    expect(jourDeLEdition('n’importe quoi', 'Europe/Paris')).toBe('')
  })
})

const equipe = [{ id: 'hyg', name: 'Hygiène' }]

/** Un créneau donné en heure de Paris, stocké en UTC comme le fait la base. */
const creneau = (titre: string, debutParis: string, finParis: string, besoin: number) => ({
  id: titre,
  title: titre,
  startDateTime: new Date(`${debutParis}+02:00`).toISOString(),
  endDateTime: new Date(`${finParis}+02:00`).toISOString(),
  teamId: 'hyg',
  maxVolunteers: besoin,
  // Ces relevés lisent la forme CONVERTIE côté client, pas celle de l'API.
  assignedVolunteersList: [{ user: { id: 1, pseudo: 'jean', nom: null, prenom: null } }],
  assignedOrganizersList: [],
})

/**
 * La permanence de nuit du samedi : c'est elle qui basculait sur le vendredi.
 *
 * 00h30 → 02h30 à Paris, pour 2 personnes demandées, soit 4 heures à pourvoir.
 */
const nuitDuSamedi = creneau('Plonge de nuit', '2026-09-26T00:30', '2026-09-26T02:30', 2)
const matinDuSamedi = creneau('Ménage matin', '2026-09-26T09:00', '2026-09-26T11:00', 2)
const soirDuVendredi = creneau('Plonge du soir', '2026-09-25T22:00', '2026-09-26T00:00', 1)

describe('heures par équipe, jour par jour', () => {
  const journees = (fuseau?: string | null) =>
    calculateVolunteersStatsByTeam(
      [soirDuVendredi, nuitDuSamedi, matinDuSamedi] as never,
      equipe,
      'Sans équipe',
      fuseau
    )[0]!.dayDetails.map((j) => `${j.date}:${j.hours}h/${j.slots}`)

  it('compte la permanence de nuit sur SA journée', () => {
    expect(journees('Europe/Paris')).toEqual(['2026-09-25:2h/1', '2026-09-26:8h/2'])
  })

  it('range chaque créneau du bon côté à New York aussi', () => {
    // La règle suit vraiment le fuseau, elle ne décale pas tout d'un bloc : vus de New York, les
    // deux créneaux de la nuit tombent le 25, mais celui de 9h du matin reste le 26.
    expect(journees('America/New_York')).toEqual(['2026-09-25:6h/2', '2026-09-26:4h/1'])
  })
})

describe('heures par jour', () => {
  it('rattache elle aussi la nuit à la bonne journée', () => {
    // Même défaut, même correction : les trois relevés partageaient la ligne fautive.
    const parJour = calculateVolunteersStatsByDay(
      [soirDuVendredi, nuitDuSamedi] as never,
      [],
      'Europe/Paris'
    )

    expect(parJour.map((j) => j.date)).toEqual(['2026-09-25', '2026-09-26'])
  })
})
