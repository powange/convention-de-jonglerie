import { describe, expect, it } from 'vitest'

import {
  construireFriseProgramme,
  grouperParJournee,
  nomDuLieu,
  type EntreeProgramme,
} from '../../../shared/utils/program-timeline'

describe('construireFriseProgramme', () => {
  it('réunit les trois sources dans l’ordre chronologique', () => {
    const frise = construireFriseProgramme({
      workshops: [
        {
          id: 1,
          title: 'Jonglerie à 3 balles',
          startDateTime: '2026-09-26T14:00:00.000Z',
          endDateTime: '2026-09-26T15:30:00.000Z',
        },
      ],
      spectacles: [
        {
          id: 1,
          title: 'Gala',
          startDateTime: '2026-09-26T20:00:00.000Z',
          duration: 90,
          isPublic: true,
        },
      ],
      elements: [
        {
          id: 1,
          title: 'Repas du soir',
          startDateTime: '2026-09-26T18:30:00.000Z',
          endDateTime: '2026-09-26T19:30:00.000Z',
          isPublic: true,
        },
      ],
    })

    expect(frise.map((e) => e.titre)).toEqual(['Jonglerie à 3 balles', 'Repas du soir', 'Gala'])
    expect(frise.map((e) => e.source)).toEqual(['workshop', 'element', 'spectacle'])
  })

  /**
   * La règle qui surprendrait sinon : les workshops n'ont aucun état de publication en base et sont
   * déjà publics dès leur création sur leur propre page. Les masquer ici les ferait disparaître
   * d'un programme public sans que personne l'ait demandé.
   */
  it('publie toujours les workshops, faute d’état de publication en base', () => {
    const frise = construireFriseProgramme({
      workshops: [
        {
          id: 7,
          title: 'Workshop',
          startDateTime: '2026-09-26T10:00:00.000Z',
          endDateTime: '2026-09-26T11:00:00.000Z',
        },
      ],
    })
    expect(frise).toHaveLength(1)
    expect(frise[0]!.publie).toBe(true)
  })

  it('écarte les brouillons par défaut, spectacles comme éléments', () => {
    const sources = {
      spectacles: [
        { id: 1, title: 'Gala secret', startDateTime: '2026-09-26T20:00:00.000Z', isPublic: false },
      ],
      elements: [
        {
          id: 1,
          title: 'Repas en préparation',
          startDateTime: '2026-09-26T18:00:00.000Z',
          endDateTime: '2026-09-26T19:00:00.000Z',
          isPublic: false,
        },
      ],
    }

    expect(construireFriseProgramme(sources)).toHaveLength(0)
    expect(construireFriseProgramme(sources, { inclureBrouillons: true })).toHaveLength(2)
  })

  it('marque les brouillons comme tels quand on les inclut', () => {
    const frise = construireFriseProgramme(
      {
        elements: [
          {
            id: 1,
            title: 'Brouillon',
            startDateTime: '2026-09-26T18:00:00.000Z',
            endDateTime: '2026-09-26T19:00:00.000Z',
            isPublic: false,
          },
        ],
      },
      { inclureBrouillons: true }
    )
    expect(frise[0]!.publie).toBe(false)
  })

  // Un spectacle stocke une durée, pas une heure de fin : c'est ce que connaît un programmateur.
  it('déduit la fin d’un spectacle de sa durée', () => {
    const frise = construireFriseProgramme({
      spectacles: [
        {
          id: 1,
          title: 'Gala',
          startDateTime: '2026-09-26T20:00:00.000Z',
          duration: 90,
          isPublic: true,
        },
      ],
    })
    expect(frise[0]!.fin).toBe('2026-09-26T21:30:00.000Z')
  })

  /**
   * Sans durée, on rend `null` plutôt qu'une fin arbitraire : une fin inventée ferait dire à la
   * frise qu'un spectacle est terminé alors que personne n'en sait rien.
   */
  it('laisse la fin vide quand la durée manque ou n’a pas de sens', () => {
    for (const duration of [null, undefined, 0, -30]) {
      const frise = construireFriseProgramme({
        spectacles: [
          {
            id: 1,
            title: 'Gala',
            startDateTime: '2026-09-26T20:00:00.000Z',
            duration,
            isPublic: true,
          },
        ],
      })
      expect(frise[0]!.fin, `durée ${duration}`).toBeNull()
    }
  })

  // Les identifiants se chevauchent d'une source à l'autre : le workshop 3 et le spectacle 3 coexistent.
  it('donne des clés distinctes à des identifiants identiques', () => {
    const frise = construireFriseProgramme({
      workshops: [
        {
          id: 3,
          title: 'A',
          startDateTime: '2026-09-26T10:00:00.000Z',
          endDateTime: '2026-09-26T11:00:00.000Z',
        },
      ],
      spectacles: [
        { id: 3, title: 'B', startDateTime: '2026-09-26T11:00:00.000Z', isPublic: true },
      ],
      elements: [
        {
          id: 3,
          title: 'C',
          startDateTime: '2026-09-26T12:00:00.000Z',
          endDateTime: '2026-09-26T13:00:00.000Z',
          isPublic: true,
        },
      ],
    })
    expect(new Set(frise.map((e) => e.cle)).size).toBe(3)
  })

  // Deux entrées à la même heure doivent garder un ordre stable d'un appel à l'autre.
  it('départage les horaires identiques par le titre', () => {
    const frise = construireFriseProgramme({
      elements: [
        {
          id: 1,
          title: 'Zumba',
          startDateTime: '2026-09-26T10:00:00.000Z',
          endDateTime: '2026-09-26T11:00:00.000Z',
          isPublic: true,
        },
        {
          id: 2,
          title: 'Accueil',
          startDateTime: '2026-09-26T10:00:00.000Z',
          endDateTime: '2026-09-26T11:00:00.000Z',
          isPublic: true,
        },
      ],
    })
    expect(frise.map((e) => e.titre)).toEqual(['Accueil', 'Zumba'])
  })

  it('reprend le lieu de chaque source à sa manière', () => {
    const frise = construireFriseProgramme({
      workshops: [
        {
          id: 1,
          title: 'A',
          startDateTime: '2026-09-26T10:00:00.000Z',
          endDateTime: '2026-09-26T11:00:00.000Z',
          location: { name: 'Gymnase', zone: { id: 4, name: 'Nord', color: '#ff0000' } },
        },
      ],
      spectacles: [
        {
          id: 1,
          title: 'B',
          startDateTime: '2026-09-26T12:00:00.000Z',
          location: 'Chapiteau',
          marker: { id: 9, name: 'Entrée', color: null },
          isPublic: true,
        },
      ],
      elements: [
        {
          id: 1,
          title: 'C',
          startDateTime: '2026-09-26T13:00:00.000Z',
          endDateTime: '2026-09-26T14:00:00.000Z',
          locationName: 'Devant la buvette',
          zone: { id: 2, name: 'Sud', color: '#00ff00' },
          isPublic: true,
        },
      ],
    })
    expect(frise.map((e) => [e.lieuTexte, e.zone, e.repere])).toEqual([
      ['Gymnase', { id: 4, nom: 'Nord', couleur: '#ff0000' }, null],
      ['Chapiteau', null, { id: 9, nom: 'Entrée', couleur: null }],
      ['Devant la buvette', { id: 2, nom: 'Sud', couleur: '#00ff00' }, null],
    ])
  })

  /**
   * Le texte libre et le lieu de carte cohabitent au lieu de se remplacer : « côté buvette »
   * précise la zone, il ne la désigne pas. Les fondre en un seul nom, comme avant, empêchait la
   * frise de gestion de réafficher le texte saisi sans risquer d'enregistrer le nom d'une zone
   * comme s'il avait été tapé à la main.
   */
  it('garde le texte libre et le lieu de carte côte à côte', () => {
    const frise = construireFriseProgramme({
      elements: [
        {
          id: 1,
          title: 'Apéro',
          startDateTime: '2026-10-02T18:00:00.000Z',
          locationName: 'côté buvette',
          zone: { id: 9, name: 'Salle des fêtes', color: '#123456' },
          isPublic: true,
        },
      ],
    })
    expect(frise[0]!.lieuTexte).toBe('côté buvette')
    expect(frise[0]!.zone).toEqual({ id: 9, nom: 'Salle des fêtes', couleur: '#123456' })
  })

  /**
   * Tous les moments d'un programme n'annoncent pas de fin — un accueil qui ouvre, une scène
   * ouverte qui dure ce qu'elle dure. On rend `null` plutôt qu'une fin inventée.
   */
  it('accepte un élément sans heure de fin', () => {
    for (const endDateTime of [null, undefined]) {
      const frise = construireFriseProgramme({
        elements: [
          {
            id: 1,
            title: 'Accueil ouvert',
            startDateTime: '2026-10-02T14:00:00.000Z',
            endDateTime,
            isPublic: true,
          },
        ],
      })
      expect(frise[0]!.fin, `fin ${endDateTime}`).toBeNull()
      expect(frise[0]!.debut).toBe('2026-10-02T14:00:00.000Z')
    }
  })

  /**
   * Sans cette reprise, une entrée rattachée à la carte n'affichait aucun lieu — et le lien vers
   * la carte restait invisible faute d'étiquette à cliquer.
   */
  it('accepte des sources absentes', () => {
    expect(construireFriseProgramme({})).toEqual([])
  })
})

/**
 * Sans cette règle, une entrée rattachée à la carte n'affichait aucun lieu là où l'on ne montre
 * qu'un nom — et le lien vers la carte restait invisible faute d'étiquette à cliquer.
 */
describe('nomDuLieu', () => {
  const entree = (p: Partial<EntreeProgramme> = {}) =>
    ({ lieuTexte: null, zone: null, repere: null, ...p }) as EntreeProgramme

  it('nomme la zone ou le repère quand le texte libre manque', () => {
    expect(nomDuLieu(entree({ zone: { id: 9, nom: 'Salle des fêtes', couleur: null } }))).toBe(
      'Salle des fêtes'
    )
    expect(nomDuLieu(entree({ repere: { id: 6, nom: 'Esplanade', couleur: null } }))).toBe(
      'Esplanade'
    )
  })

  // Le texte libre est une précision voulue par l'organisateur : il prime sur le nom de la zone.
  it('préfère le texte libre au nom de la zone', () => {
    expect(
      nomDuLieu(
        entree({
          lieuTexte: 'côté buvette',
          zone: { id: 9, nom: 'Salle des fêtes', couleur: null },
        })
      )
    ).toBe('côté buvette')
  })

  it('ne nomme rien quand il n’y a pas de lieu', () => {
    expect(nomDuLieu(entree())).toBeNull()
  })
})

describe('grouperParJournee', () => {
  it('regroupe et trie les journées', () => {
    const frise = construireFriseProgramme({
      elements: [
        {
          id: 1,
          title: 'Dimanche',
          startDateTime: '2026-09-28T10:00:00.000Z',
          endDateTime: '2026-09-28T11:00:00.000Z',
          isPublic: true,
        },
        {
          id: 2,
          title: 'Samedi',
          startDateTime: '2026-09-27T10:00:00.000Z',
          endDateTime: '2026-09-27T11:00:00.000Z',
          isPublic: true,
        },
      ],
    })
    const journees = grouperParJournee(frise)
    expect(journees.map((j) => j.date)).toEqual(['2026-09-27', '2026-09-28'])
    expect(journees[0]!.entrees.map((e) => e.titre)).toEqual(['Samedi'])
  })

  /**
   * Une scène ouverte de 23 h appartient à la soirée où le public la vit. Sans le fuseau de
   * l'édition, elle basculait au lendemain dès que le programme était consulté depuis un fuseau
   * plus à l'est, et la frise affichait une journée de trop.
   */
  it('rattache une fin de soirée à la journée vécue sur place', () => {
    const frise = construireFriseProgramme({
      elements: [
        {
          id: 1,
          title: 'Scène ouverte',
          // 23 h à Paris le 27, soit déjà le 28 en temps universel.
          startDateTime: '2026-09-27T21:00:00.000Z',
          isPublic: true,
        },
      ],
    })
    expect(grouperParJournee(frise, 'Europe/Paris').map((j) => j.date)).toEqual(['2026-09-27'])
    expect(grouperParJournee(frise, 'UTC').map((j) => j.date)).toEqual(['2026-09-27'])
    // Depuis Melbourne, ce même instant tombe au lendemain : c'est ce que le fuseau de l'édition
    // évite de faire subir au programme.
    expect(grouperParJournee(frise, 'Australia/Melbourne').map((j) => j.date)).toEqual([
      '2026-09-28',
    ])
  })

  /**
   * Une scène ouverte de 00 h 30 prolonge la soirée de la veille : c'est ainsi que le public la
   * vit, et la ranger au lendemain la ferait apparaître en tête d'une journée pas encore
   * commencée, loin des créneaux qu'elle prolonge.
   */
  it('rattache le début de nuit à la soirée de la veille', () => {
    const frise = construireFriseProgramme({
      elements: [
        {
          id: 1,
          title: 'Gala',
          // 21 h à Paris le 6 août.
          startDateTime: '2026-08-06T19:00:00.000Z',
          isPublic: true,
        },
        {
          id: 2,
          title: 'Scène ouverte',
          // 00 h 30 à Paris, donc le 7 au calendrier — mais la soirée du 6.
          startDateTime: '2026-08-06T22:30:00.000Z',
          isPublic: true,
        },
        {
          id: 3,
          title: 'Petit déjeuner',
          // 08 h à Paris le 7 : une vraie journée nouvelle.
          startDateTime: '2026-08-07T06:00:00.000Z',
          isPublic: true,
        },
      ],
    })
    const journees = grouperParJournee(frise, 'Europe/Paris')
    expect(journees.map((j) => [j.date, j.entrees.map((e) => e.titre)])).toEqual([
      ['2026-08-06', ['Gala', 'Scène ouverte']],
      ['2026-08-07', ['Petit déjeuner']],
    ])
  })

  it('rend une liste vide sans entrée', () => {
    expect(grouperParJournee([])).toEqual([])
  })
})
